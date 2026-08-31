"""La ingesta de fotos lee lo que dicen Wikidata y Commons, y es educada al preguntárselo.

Tres familias de recorridos, y cada una cubre una forma distinta de equivocarse:

1. **Las respuestas se leen contra capturas reales** (`tests/fixtures/commons/`), no contra un JSON
   inventado que se parezca a lo que creemos que devuelve la API. Es el mismo criterio que usan los
   recorridos del BOE y de RAMPE: un doble escrito de memoria comprueba que el parser entiende
   nuestra idea de la fuente.
2. **Los cinco «no» tienen que ser distinguibles**: no hay ítem, el nombre lo declaran varios
   ítems, el ítem no es ese taxón, el ítem no tiene `P18`, y ninguna de sus `P18` acredita lo que
   hace falta. Los cinco acaban en `sinFoto` con motivo, y **ninguno interrumpe la ingesta**.
3. **Ser educado se comprueba, no se declara.** Wikimedia limita por IP; que el cliente obedezca el
   `Retry-After` es una promesa que sólo vale si hay un recorrido que la ponga en rojo cuando deje
   de cumplirse — y que además compruebe lo contrario: que un `404` **no** se reintenta, porque
   reintentar lo que no existe es lento y esconde el error de verdad.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
from pathlib import Path
from typing import Any

import pytest

from mareia_pipeline.sources import cache, commons

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "commons"

#: El taxón con el que se midió la fuente el 2026-08-30: tres `P18`, licencia CC BY-SA 4.0 y autor
#: en un enlace HTML. Es el ejemplo del plan de T-23.
ENTIDAD = "Q217129"
NOMBRE = "Dicentrarchus labrax"


def _fixture(nombre: str) -> bytes:
    return (FIXTURES / nombre).read_bytes()


def _busqueda() -> bytes:
    return _fixture("wikidata-busqueda-dicentrarchus-labrax.json")


def _p225_exacto() -> bytes:
    """La captura de `haswbstatement:"P225=Dicentrarchus labrax"`: un solo ítem, `Q217129`."""
    return _fixture("wikidata-p225-exacto-dicentrarchus-labrax.json")


def _p225() -> bytes:
    return _fixture("wikidata-p225-q217129.json")


def _p18() -> bytes:
    return _fixture("wikidata-p18-q217129.json")


def _imageinfo() -> bytes:
    return _fixture("commons-imageinfo-dicentrarchus-labrax.json")


def _imageinfo_dominio_publico() -> bytes:
    """La captura de `File:Belone belone1.jpg`: `pd`, `Copyrighted=False` y **sin `LicenseUrl`**.

    Es uno de los 25 de 26 ficheros de dominio público que había detrás de los huecos del
    2026-08-30, y está aquí porque el caso que rompía el contrato no se puede probar con un doble:
    lo que hay que comprobar es que la fuente **de verdad** no manda URL de condiciones cuando la
    imagen no las tiene.
    """
    return _fixture("commons-imageinfo-belone-belone.json")


def _imageinfo_sin_atribucion() -> bytes:
    """La captura de `File:Atlantic cod.jpg`: `pd`, `Copyrighted=False`, `AttributionRequired=false`
    y **sin `Artist`**.

    Es uno de los dos ficheros de la NOAA que estaban detrás de los huecos del bacalao y de las
    lisas el 2026-08-31, y está aquí por lo mismo que el de dominio público: que Commons de verdad
    declara que no hace falta atribuir no se puede probar con un doble escrito por nosotros, porque
    entonces lo que se probaría es nuestra idea de la fuente.
    """
    return _fixture("commons-imageinfo-atlantic-cod.json")


def _imageinfo_que_exige_atribuir() -> bytes:
    """La captura de `File:Monkfish.jpg`: `cc-by-sa-3.0`, `AttributionRequired=true` y sin `Artist`.

    El caso simétrico y el que no se puede publicar: la licencia exige atribuir y la fuente no dice
    a quién. Es la única `P18` del género `Lophius`, y por eso ese hueco no se cerró relajando el
    autor sino con la foto de una especie que nombra la propia norma.
    """
    return _fixture("commons-imageinfo-monkfish.json")


# =====================================================================================
# 1 · Leer lo que la fuente dice de verdad
# =====================================================================================


def test_al_item_se_llega_por_el_nombre_que_el_item_declara() -> None:
    """La pregunta buena del punto 1: qué ítem declara exactamente este nombre científico."""
    assert commons.leer_items_por_nombre(_p225_exacto(), consultado=NOMBRE) == (ENTIDAD,)


def test_que_nadie_declare_el_nombre_no_es_un_error() -> None:
    """Es un desenlace: se cae a la búsqueda de texto, que es la reserva."""
    vacia = json.dumps({"query": {"searchinfo": {"totalhits": 0}, "search": []}}).encode()
    assert commons.leer_items_por_nombre(vacia, consultado="Xxx yyy") == ()


def test_las_comillas_del_filtro_de_nombre_no_son_adorno() -> None:
    """Medido el 2026-08-31: sin comillas, un binomio parte el filtro y devuelve vacío.

    Con nombres de una palabra funcionan las dos formas, que es exactamente cómo un error así pasa
    la prueba fácil y se rompe en los taxones con binomio, o sea en casi todos los de la norma.
    """
    url = commons.url_por_nombre_cientifico("Gadus morhua")
    assert 'haswbstatement:"P225=Gadus morhua"' in urllib.parse.unquote_plus(url)
    assert "list=search" in url


def test_la_busqueda_devuelve_el_item_del_taxon() -> None:
    """`wbsearchentities` resuelve el nombre científico por alias: medido, `Q217129`."""
    assert commons.leer_busqueda(_busqueda(), consultado=NOMBRE) == ENTIDAD


def test_una_busqueda_sin_resultados_no_es_un_error() -> None:
    """Que Wikidata no tenga el taxón es un desenlace, no una avería: no hay foto y ya está."""
    vacia = json.dumps({"searchinfo": {"search": "x"}, "search": [], "success": 1}).encode()
    assert commons.leer_busqueda(vacia, consultado="Xxx yyy") is None


def test_una_respuesta_que_no_es_de_la_api_aborta() -> None:
    """Lo que no sabemos leer no se interpreta a medias: se aborta diciéndolo."""
    with pytest.raises(commons.ErrorCommons):
        commons.leer_busqueda(b"<html>error del proxy</html>", consultado=NOMBRE)


def test_el_item_declara_su_nombre_cientifico() -> None:
    """`P225` es lo que convierte la búsqueda de texto en una comprobación."""
    assert commons.leer_nombre_cientifico(_p225(), entidad=ENTIDAD) == NOMBRE


def test_las_imagenes_del_item_salen_con_su_prefijo_de_fichero() -> None:
    """Medido: `Q217129` tiene **tres** `P18`, y el dataset las nombra como `File:…`."""
    imagenes = commons.leer_imagenes(_p18(), entidad=ENTIDAD)
    assert len(imagenes) == 3
    assert all(fichero.startswith("File:") for fichero in imagenes)
    assert imagenes[0] == "File:Dicentrarchus labrax LoroParqueTenerife seabass IMG 4959.JPG"


def test_el_rango_de_wikidata_manda_en_el_orden_y_en_el_descarte() -> None:
    """Los `deprecated` no se publican y los `preferred` van delante, y el orden es de la fuente.

    Se construye mutando **la captura real**: así el recorrido comprueba el criterio sobre la forma
    que tiene de verdad la respuesta, no sobre un esqueleto escrito a mano que podría no tener
    ``rank`` en el sitio en que lo tiene Wikidata.
    """
    crudo = json.loads(_p18())
    enunciados = crudo["claims"]["P18"]
    enunciados[0]["rank"] = commons.RANGO_DESCARTADO
    enunciados[2]["rank"] = commons.RANGO_PREFERIDO
    imagenes = commons.leer_imagenes(json.dumps(crudo).encode(), entidad=ENTIDAD)
    esperado = commons.leer_imagenes(_p18(), entidad=ENTIDAD)
    assert imagenes == (esperado[2], esperado[1])


def test_un_item_sin_p18_devuelve_ninguna_imagen() -> None:
    """Sin `P18` no hay foto, y eso se lee sin excepciones: es el caso más frecuente del «no»."""
    assert commons.leer_imagenes(json.dumps({"claims": {}}).encode(), entidad="Q1") == ()


def test_los_metadatos_traen_autor_licencia_y_url() -> None:
    """El `extmetadata` del fichero medido: autor en un enlace, `CC BY-SA 4.0` y su URL."""
    metadatos = commons.leer_metadatos(_imageinfo(), fichero="File:x")
    assert metadatos.autor == "Bjoertvedt"
    assert metadatos.licencia == "CC BY-SA 4.0"
    assert metadatos.licencia_url == "https://creativecommons.org/licenses/by-sa/4.0"
    assert metadatos.descripcion.startswith("https://commons.wikimedia.org/wiki/File:")
    assert metadatos.completa


def test_la_url_publicada_no_lleva_los_utm_de_la_api() -> None:
    """Medido: la API pega `utm_source`/`utm_campaign`/`utm_content` a la URL del fichero.

    Publicarlos atribuiría a Commons un tráfico que sale de nuestras páginas. Se comprueba además
    que la captura **de verdad los trae**: si un día dejaran de venir, este recorrido tiene que
    dejar de estar comprobando el vacío.
    """
    crudo = json.loads(_imageinfo())
    original = next(iter(crudo["query"]["pages"].values()))["imageinfo"][0]["url"]
    assert "utm_source=" in original
    metadatos = commons.leer_metadatos(_imageinfo(), fichero="File:x")
    assert "utm_" not in metadatos.url
    assert metadatos.url.startswith("https://upload.wikimedia.org/")


def test_el_autor_se_publica_en_texto_y_no_en_html() -> None:
    """`Artist` viene con marcado; el dataset guarda el nombre, que es lo que se acredita."""
    assert commons.texto_plano('<a href="//x" title="y">Hans Hillewaert</a>') == "Hans Hillewaert"
    assert commons.texto_plano("Ana &amp; Luis") == "Ana & Luis"
    assert commons.texto_plano("<span></span>") is None


def test_un_fichero_de_dominio_publico_se_publica_sin_url_de_condiciones() -> None:
    """El dominio público no tiene condiciones, así que no hay URL de condiciones que exigirle.

    Exigírsela era un error de categoría, y el precio medido el 2026-08-30 fueron **15 especies**
    sin foto teniendo una perfectamente acreditada — y, peor, con un motivo publicado que decía que
    faltaba el autor o la licencia de ficheros que publican las dos cosas.
    """
    metadatos = commons.leer_metadatos(
        _imageinfo_dominio_publico(), fichero="File:Belone belone1.jpg"
    )
    assert metadatos.autor == "Kr\u00fcger"
    assert metadatos.licencia == "Public domain"
    assert metadatos.licencia_codigo == "pd"
    assert metadatos.licencia_url is None
    assert metadatos.dominio_publico
    assert metadatos.completa, metadatos.carencias


def test_el_dominio_publico_lo_dicen_dos_campos_y_no_uno() -> None:
    """`License = pd` es una afirmación; `License = pd` **y** `Copyrighted = False` es una
    comprobación.

    Un fichero que dijera ser de dominio público con la plantilla y a la vez declarase derechos se
    está contradiciendo, y la excepción —la única puerta por la que una foto se publica sin URL de
    licencia— no se abre con un solo campo, que es justo por donde se colaría lo que no debe.
    """
    crudo = json.loads(_imageinfo_dominio_publico())
    extra = next(iter(crudo["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
    extra["Copyrighted"]["value"] = "True"
    metadatos = commons.leer_metadatos(json.dumps(crudo).encode(), fichero="File:x")
    assert not metadatos.dominio_publico
    assert metadatos.carencias == ("licenciaUrl",)
    assert not metadatos.completa


def test_una_licencia_con_condiciones_y_sin_url_sigue_sin_publicarse() -> None:
    """La excepción es del dominio público y de nadie más: «sin URL» no es un pase libre.

    Una `CC BY-SA 4.0` sí tiene condiciones que enlazar, y publicarla sin decir dónde están es
    exactamente lo que el contrato original quería impedir. Eso no cambia.
    """
    crudo = json.loads(_imageinfo())
    extra = next(iter(crudo["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
    del extra["LicenseUrl"]
    metadatos = commons.leer_metadatos(json.dumps(crudo).encode(), fichero="File:x")
    assert metadatos.licencia_codigo == "cc-by-sa-4.0"
    assert not metadatos.dominio_publico
    assert metadatos.carencias == ("licenciaUrl",)


def test_una_licencia_sin_codigo_legible_por_maquina_no_esta_completa() -> None:
    """`licenciaCodigo` es obligatorio siempre: es lo que hace la excepción **comprobable**.

    Sin él, el gate F2 —que lee el JSON publicado y no la ingesta— no puede distinguir «dominio
    público, no hay condiciones» de «se nos perdió la URL».
    """
    crudo = json.loads(_imageinfo())
    extra = next(iter(crudo["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
    del extra["License"]
    metadatos = commons.leer_metadatos(json.dumps(crudo).encode(), fichero="File:x")
    assert metadatos.carencias == ("licenciaCodigo",)


def test_un_fichero_cuya_fuente_no_exige_atribuir_se_publica_sin_autor() -> None:
    """Medido en `File:Atlantic cod.jpg`: `AttributionRequired=false`, `Copyrighted=False`, sin
    `Artist`. Publicarlo sin acreditar a nadie no incumple nada, porque **lo dice su fuente**.

    Exigir el autor aquí era el mismo error de categoría que exigirle su URL al dominio público, y
    costó lo mismo: dos especies —el bacalao y las lisas— sin foto teniendo una perfectamente
    publicable, con un motivo que además hablaba de un incumplimiento que no existía.
    """
    metadatos = commons.leer_metadatos(_imageinfo_sin_atribucion(), fichero="File:x")
    assert metadatos.autor is None
    assert metadatos.atribucion_requerida == "false"
    assert not metadatos.exige_atribuir
    assert metadatos.puede_publicarse_sin_autor
    assert metadatos.completa, metadatos.carencias


def test_un_fichero_que_exige_atribuir_y_no_dice_a_quien_no_se_publica() -> None:
    """Medido en `File:Monkfish.jpg`: `cc-by-sa-3.0`, `AttributionRequired=true` y sin `Artist`.

    Es el recorrido que impide que la excepción de arriba se lea como «sin autor se publica igual».
    Aquí quien lo impide es la licencia del fichero, no nosotros: es la única `P18` del género
    `Lophius`, y ese hueco se cerró con la foto de una especie que nombra la propia norma, no
    relajando esto.
    """
    metadatos = commons.leer_metadatos(_imageinfo_que_exige_atribuir(), fichero="File:x")
    assert metadatos.autor is None
    assert metadatos.atribucion_requerida == "true"
    assert metadatos.exige_atribuir
    assert not metadatos.puede_publicarse_sin_autor
    assert metadatos.carencias == ("autor",)


def test_que_la_fuente_no_diga_nada_sobre_atribuir_no_es_un_permiso() -> None:
    """El silencio de un tercero no autoriza nada, así que la ausencia se lee como «sí hace falta».

    Es la diferencia entre comparar contra el `"false"` explícito y comprobar si el campo falta, y
    es justo por donde se colaría una foto sin crédito de cualquier fichero cuyos metadatos estén a
    medias.
    """
    crudo = json.loads(_imageinfo_sin_atribucion())
    extra = next(iter(crudo["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
    del extra[commons.ATRIBUCION_REQUERIDA]
    metadatos = commons.leer_metadatos(json.dumps(crudo).encode(), fichero="File:x")
    assert metadatos.exige_atribuir
    assert metadatos.carencias == ("autor",)


def test_la_excepcion_del_autor_tampoco_la_abre_un_solo_campo() -> None:
    """`AttributionRequired=false` es una afirmación; con `Copyrighted=False` es una comprobación.

    Un fichero que dijera a la vez que no hace falta atribuir y que está sujeto a derechos se está
    contradiciendo, y la puerta por la que una foto se publica sin acreditar a nadie no se abre con
    un solo campo, que es justo por donde se colaría lo que no debe.
    """
    crudo = json.loads(_imageinfo_sin_atribucion())
    extra = next(iter(crudo["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
    extra[commons.CON_DERECHOS]["value"] = "True"
    metadatos = commons.leer_metadatos(json.dumps(crudo).encode(), fichero="File:x")
    assert not metadatos.exige_atribuir
    assert not metadatos.puede_publicarse_sin_autor
    assert "autor" in metadatos.carencias


def test_un_fichero_sin_autor_no_esta_completo() -> None:
    """Falta el autor de un fichero que exige atribuir → no se publica, y se dice **qué** falta."""
    crudo = json.loads(_imageinfo())
    pagina = next(iter(crudo["query"]["pages"].values()))
    del pagina["imageinfo"][0]["extmetadata"]["Artist"]
    metadatos = commons.leer_metadatos(json.dumps(crudo).encode(), fichero="File:x")
    assert metadatos.carencias == ("autor",)
    assert not metadatos.completa


def test_un_fichero_que_no_existe_en_commons_no_revienta() -> None:
    """`missing` es un desenlace: la `P18` apunta a un fichero que no está en Commons."""
    ausente = json.dumps(
        {"query": {"pages": {"-1": {"title": "File:x", "missing": ""}}}}
    ).encode()
    metadatos = commons.leer_metadatos(ausente, fichero="File:x")
    assert not metadatos.completa
    assert "url" in metadatos.carencias


# =====================================================================================
# 2 · Los cuatro «no», que tienen que poder distinguirse
# =====================================================================================


def _red(monkeypatch: pytest.MonkeyPatch, respuestas: dict[str, bytes]) -> list[str]:
    """Sustituye la red por un diccionario de URL → cuerpo, y anota lo que se pidió."""
    pedidas: list[str] = []

    def descargar(url: str, *, refresh: bool = False) -> bytes:
        pedidas.append(url)
        if url not in respuestas:
            raise AssertionError(f"la ingesta pidió una URL que no se esperaba: {url}")
        return respuestas[url]

    monkeypatch.setattr(commons, "descargar", descargar)
    return pedidas


def _respuestas_completas() -> dict[str, bytes]:
    return {
        commons.url_por_nombre_cientifico(NOMBRE): _p225_exacto(),
        commons.url_busqueda(NOMBRE): _busqueda(),
        commons.url_claims(ENTIDAD, commons.PROPIEDAD_NOMBRE_CIENTIFICO): _p225(),
        commons.url_claims(ENTIDAD, commons.PROPIEDAD_IMAGEN): _p18(),
        **{
            commons.url_imageinfo(fichero): _imageinfo()
            for fichero in commons.leer_imagenes(_p18(), entidad=ENTIDAD)
        },
    }


def test_el_camino_entero_publica_la_foto_con_su_procedencia(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Búsqueda → `P225` → `P18` → `imageinfo`, y la foto sale con quién la identificó."""
    _red(monkeypatch, _respuestas_completas())
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.PUBLICABLE
    assert resultado.foto is not None
    assert resultado.foto.entidad == ENTIDAD
    assert resultado.foto.autor == "Bjoertvedt"
    assert resultado.motivo is None


def test_el_camino_normal_no_busca_el_nombre_como_texto(monkeypatch: pytest.MonkeyPatch) -> None:
    """La búsqueda de texto es la **reserva**, y sólo se paga cuando hace falta.

    No es una cuestión de peticiones: es que el buscador es quien se equivocaba. Si el camino
    normal siguiera pasando por él, la comprobación de `P225` volvería a ser lo único que separa la
    foto de otro animal de la nuestra, que es de donde venimos.
    """
    pedidas = _red(monkeypatch, _respuestas_completas())
    assert commons.resolver(NOMBRE).desenlace == commons.PUBLICABLE
    assert commons.url_busqueda(NOMBRE) not in pedidas


def test_sin_item_en_wikidata_no_hay_foto_y_se_dice(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ni lo declara nadie ni lo encuentra la búsqueda: no hay ítem, y el motivo lo dice entero."""
    sin_declarantes = json.dumps({"query": {"search": []}}).encode()
    sin_resultados = json.dumps({"search": [], "success": 1}).encode()
    pedidas = _red(
        monkeypatch,
        {
            commons.url_por_nombre_cientifico(NOMBRE): sin_declarantes,
            commons.url_busqueda(NOMBRE): sin_resultados,
        },
    )
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.SIN_ITEM
    assert "ningún ítem de Wikidata declara" in resultado.motivo
    assert len(pedidas) == 2, "no se sigue preguntando por un taxón que no tiene ítem"


def _p31(*instancias: str) -> bytes:
    """Un `wbgetclaims` de `P31` con los ítems que se le quieran dar. Vacío = no declara ninguno."""
    return json.dumps(
        {
            "claims": {
                commons.PROPIEDAD_INSTANCIA_DE: [
                    {
                        "mainsnak": {
                            "snaktype": "value",
                            "datavalue": {"value": {"entity-type": "item", "id": i}},
                        },
                        "rank": "normal",
                    }
                    for i in instancias
                ]
            }
        }
    ).encode()


def _dos_items_declarando_el_nombre() -> bytes:
    """La captura real de `P225` exacto, mutada para que devuelva dos ítems en vez de uno."""
    crudo = json.loads(_p225_exacto())
    crudo["query"]["search"].append({"ns": 0, "title": "Q9999", "pageid": 1})
    return json.dumps(crudo).encode()


def test_si_dos_items_declaran_el_mismo_nombre_y_nada_los_desempata_no_se_elige(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Dos ítems que dicen ser el mismo taxón son un problema de Wikidata, no una elección nuestra.

    Ninguno lleva la marca de duplicado y la búsqueda de texto lleva a un tercero, así que los dos
    caminos con los que la fuente puede deshacer el empate se han intentado y **ninguno lo deshace**.
    Ahí no se elige.

    Y se exige que el hueco **nombre los dos ítems**: sin eso, quien lea «hay ambigüedad» no tiene
    por dónde ir a resolverla.
    """
    respuestas = _respuestas_completas()
    respuestas[commons.url_por_nombre_cientifico(NOMBRE)] = _dos_items_declarando_el_nombre()
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_INSTANCIA_DE)] = _p31()
    respuestas[commons.url_claims("Q9999", commons.PROPIEDAD_INSTANCIA_DE)] = _p31()
    respuestas[commons.url_busqueda(NOMBRE)] = json.dumps(
        {"search": [{"id": "Q1234"}]}
    ).encode()
    pedidas = _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.AMBIGUO
    assert resultado.foto is None
    assert ENTIDAD in resultado.motivo and "Q9999" in resultado.motivo
    # Lo que de verdad hay que probar no es cuántas preguntas se hacen, sino que **ninguna de ellas
    # es sobre un ítem que hayamos elegido**: las únicas admisibles son las de deshacer el empate
    # (el `P31` de cada candidato y la búsqueda de texto). Pedir el `P225` o la `P18` de uno de los
    # dos sería haber elegido, y es el rojo que este recorrido existe para dar.
    admisibles = {
        commons.url_por_nombre_cientifico(NOMBRE),
        commons.url_busqueda(NOMBRE),
        commons.url_claims(ENTIDAD, commons.PROPIEDAD_INSTANCIA_DE),
        commons.url_claims("Q9999", commons.PROPIEDAD_INSTANCIA_DE),
    }
    assert set(pedidas) <= admisibles, (
        "con el empate sin deshacer se ha preguntado por algo que sólo tiene sentido sobre un ítem "
        f"ya elegido: {sorted(set(pedidas) - admisibles)}"
    )


def test_la_marca_de_duplicado_de_wikidata_deshace_el_empate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Uno de los dos ítems dice ser una página duplicada, así que la fuente ya eligió por nosotros.

    Esto es lo contrario de desempatar: no se aplica ningún criterio propio —ni el primero, ni el
    de número más bajo, ni el que tenga foto—, se lee un enunciado del propio Wikidata.
    """
    respuestas = _respuestas_completas()
    respuestas[commons.url_por_nombre_cientifico(NOMBRE)] = _dos_items_declarando_el_nombre()
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_INSTANCIA_DE)] = _p31()
    respuestas[commons.url_claims("Q9999", commons.PROPIEDAD_INSTANCIA_DE)] = _p31(
        commons.ENTIDAD_PAGINA_DUPLICADA
    )
    # La búsqueda de texto lleva a un tercero A PROPÓSITO: si llevara a uno de los dos, este
    # recorrido se pondría verde por la concordancia y no probaría nada de la marca de duplicado
    # —que es exactamente lo que pasaba antes de escribir esta línea, comprobado con el sabotaje—.
    respuestas[commons.url_busqueda(NOMBRE)] = json.dumps({"search": [{"id": "Q1234"}]}).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.PUBLICABLE
    assert resultado.entidad == ENTIDAD


def test_si_los_dos_estan_marcados_como_duplicados_el_filtro_no_dice_nada(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un filtro que se lo lleva todo no ha deshecho nada, y vaciar la lista sería otra afirmación.

    «No sé cuál de los dos» y «no queda ninguno» son dos frases distintas. Si el filtro se llevara
    la lista entera, el segundo camino —la concordancia— ya no llegaría a mirarse, y una fila que
    la fuente **sí** sabe resolver caería como ambigua. Aquí los dos están marcados, así que el
    filtro no informa; la búsqueda de texto coincide con uno y ésa es la que decide.
    """
    respuestas = _respuestas_completas()
    respuestas[commons.url_por_nombre_cientifico(NOMBRE)] = _dos_items_declarando_el_nombre()
    duplicado = _p31(commons.ENTIDAD_PAGINA_DUPLICADA)
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_INSTANCIA_DE)] = duplicado
    respuestas[commons.url_claims("Q9999", commons.PROPIEDAD_INSTANCIA_DE)] = duplicado
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.PUBLICABLE
    assert resultado.entidad == ENTIDAD


def test_cuando_coinciden_los_dos_caminos_esa_concordancia_desempata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Preguntar por el nombre declarado y buscarlo como texto fallan de maneras distintas.

    El exacto trae de más cuando Wikidata tiene ítems repetidos; el de texto trae otra cosa cuando
    el nombre se parece a un apellido o a un planeta. Que ambos señalen al mismo ítem es entonces
    una **comprobación**, no una preferencia — el mismo principio con el que este módulo acepta el
    dominio público sólo cuando `License` y `Copyrighted` dicen lo mismo.
    """
    respuestas = _respuestas_completas()
    respuestas[commons.url_por_nombre_cientifico(NOMBRE)] = _dos_items_declarando_el_nombre()
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_INSTANCIA_DE)] = _p31()
    respuestas[commons.url_claims("Q9999", commons.PROPIEDAD_INSTANCIA_DE)] = _p31()
    # La búsqueda de texto (la captura real) lleva a ENTIDAD, que está entre los dos candidatos.
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.PUBLICABLE
    assert resultado.entidad == ENTIDAD


def test_si_nadie_declara_el_nombre_la_busqueda_de_texto_sigue_siendo_la_reserva(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Peor que preguntar por el nombre declarado, pero mejor que un hueco: y se comprueba igual.

    El `P225` del ítem que devuelva la búsqueda se sigue leyendo, que es lo que impide que la
    reserva sea una puerta trasera por la que entre la foto de otro animal.
    """
    respuestas = _respuestas_completas()
    respuestas[commons.url_por_nombre_cientifico(NOMBRE)] = json.dumps(
        {"query": {"search": []}}
    ).encode()
    pedidas = _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.PUBLICABLE
    assert commons.url_busqueda(NOMBRE) in pedidas
    assert commons.url_claims(ENTIDAD, commons.PROPIEDAD_NOMBRE_CIENTIFICO) in pedidas


def test_si_la_busqueda_lleva_a_otro_taxon_no_se_publica(monkeypatch: pytest.MonkeyPatch) -> None:
    """El recorrido que justifica pedir `P225`: la búsqueda es de texto y puede errar el destino.

    Sin esta comprobación, la foto de otro animal se publicaría bajo el nombre de éste con todos
    los campos bien puestos, que es el fallo que no da error y que nadie ve.
    """
    otro = json.loads(_p225())
    otro["claims"]["P225"][0]["mainsnak"]["datavalue"]["value"] = "Sparus aurata"
    respuestas = _respuestas_completas()
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_NOMBRE_CIENTIFICO)] = json.dumps(
        otro
    ).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.OTRO_TAXON
    assert "Sparus aurata" in resultado.motivo
    assert resultado.foto is None


def test_un_item_que_no_es_un_taxon_tampoco_publica(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un ítem sin `P225` no se puede comprobar, así que no se publica su imagen."""
    respuestas = _respuestas_completas()
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_NOMBRE_CIENTIFICO)] = json.dumps(
        {"claims": {}}
    ).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.OTRO_TAXON
    assert commons.PROPIEDAD_NOMBRE_CIENTIFICO in resultado.motivo


def test_sin_p18_el_hueco_lleva_el_motivo_y_no_se_busca_por_texto(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La regla entera del módulo: sin `P18`, no hay foto. Y no hay plan B de búsqueda."""
    respuestas = _respuestas_completas()
    respuestas[commons.url_claims(ENTIDAD, commons.PROPIEDAD_IMAGEN)] = json.dumps(
        {"claims": {}}
    ).encode()
    pedidas = _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.SIN_IMAGEN
    assert "no tiene P18" in resultado.motivo
    assert not any("commons.wikimedia.org" in url for url in pedidas), (
        "sin P18 no se le pregunta nada a Commons: buscar la imagen por texto es justo lo que "
        "este módulo existe para no hacer"
    )


def test_si_la_primera_imagen_no_acredita_autor_se_prueba_la_siguiente(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Descartar el ítem entero por su primera imagen sería tirar una identificación buena."""
    sin_autor = json.loads(_imageinfo())
    del next(iter(sin_autor["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]["Artist"]
    imagenes = commons.leer_imagenes(_p18(), entidad=ENTIDAD)
    respuestas = _respuestas_completas()
    respuestas[commons.url_imageinfo(imagenes[0])] = json.dumps(sin_autor).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.PUBLICABLE
    assert resultado.foto.autor == "Bjoertvedt"


def test_si_ninguna_imagen_acredita_autor_no_se_publica_ninguna(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Una imagen sin autor o sin licencia no se publica: la fila cae con su motivo entero."""
    sin_autor = json.loads(_imageinfo())
    del next(iter(sin_autor["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]["Artist"]
    respuestas = _respuestas_completas()
    for fichero in commons.leer_imagenes(_p18(), entidad=ENTIDAD):
        respuestas[commons.url_imageinfo(fichero)] = json.dumps(sin_autor).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.SIN_METADATOS
    assert resultado.foto is None
    assert "no publica autor" in resultado.motivo
    assert "ninguna de las 3 imágenes" in resultado.motivo


def test_el_motivo_del_hueco_no_dice_que_falta_lo_que_no_falta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un motivo que no es el motivo es peor que no dar ninguno: el que lo lee no vuelve a preguntar.

    El 2026-08-30, **15 fichas** publicaban «una imagen sin autor o sin licencia no se publica» de
    ficheros que acreditaban las dos cosas y a los que sólo les faltaba una URL de condiciones que
    el dominio público no tiene. Aquí se sabotea al revés —una licencia con condiciones a la que
    se le quita la URL— y se exige que el motivo hable de la licencia y **no** del autor.
    """
    sin_url = json.loads(_imageinfo())
    extra = next(iter(sin_url["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
    del extra["LicenseUrl"]
    respuestas = _respuestas_completas()
    for fichero in commons.leer_imagenes(_p18(), entidad=ENTIDAD):
        respuestas[commons.url_imageinfo(fichero)] = json.dumps(sin_url).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert resultado.desenlace == commons.SIN_METADATOS
    assert "no publica licenciaUrl" in resultado.motivo
    assert "sin autor" not in resultado.motivo, (
        f"el motivo acusa de faltar el autor a un fichero que lo publica: {resultado.motivo}"
    )


def test_cuando_lo_que_falta_es_el_autor_el_motivo_no_habla_de_la_licencia(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """El caso simétrico, que es el de `File:Monkfish.jpg`: licencia y URL sí, autor no."""
    sin_autor = json.loads(_imageinfo())
    del next(iter(sin_autor["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]["Artist"]
    respuestas = _respuestas_completas()
    for fichero in commons.leer_imagenes(_p18(), entidad=ENTIDAD):
        respuestas[commons.url_imageinfo(fichero)] = json.dumps(sin_autor).encode()
    _red(monkeypatch, respuestas)
    resultado = commons.resolver(NOMBRE)
    assert "sin autor" in resultado.motivo
    assert "sin licencia" not in resultado.motivo, (
        f"el motivo acusa de faltar la licencia a un fichero que la publica: {resultado.motivo}"
    )


# =====================================================================================
# 3 · Educado: el `User-Agent`, el `Retry-After` y la pausa
# =====================================================================================


def _http_error(codigo: int, cabeceras: dict[str, str]) -> urllib.error.HTTPError:
    import email.message

    mensaje = email.message.Message()
    for clave, valor in cabeceras.items():
        mensaje[clave] = valor
    return urllib.error.HTTPError("https://x", codigo, "no", mensaje, None)


def test_se_obedece_el_retry_after_que_pide_wikimedia(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Medido contra Wikimedia: `429` con `retry-after: 16`. Se espera **eso**, y se reintenta.

    Un cliente que reintentara enseguida convertiría un «espera un momento» en una ingesta rota, y
    uno que abortara dejaría el dataset a medias por un límite que se va solo en 16 segundos.
    """
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    intentos: list[str] = []
    esperas: list[float] = []

    def descargar(url: str, *, agente: str) -> bytes:
        intentos.append(agente)
        if len(intentos) == 1:
            raise _http_error(429, {"Retry-After": "16", "server": "envoy"})
        return b'{"ok":1}'

    monkeypatch.setattr(cache, "_descargar", descargar)
    cuerpo = cache.fetch_educado(
        "https://www.wikidata.org/w/api.php?x=1",
        suffix=".json",
        agente=commons.AGENTE,
        dormir=esperas.append,
    )
    assert cuerpo == b'{"ok":1}'
    assert esperas == [16], "no se esperó lo que pidió el servidor"
    assert len(intentos) == 2


def test_un_error_que_no_es_de_limite_no_se_reintenta(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Un `404` reintentado cuatro veces sigue siendo un `404`: sólo tarda más en decirlo."""
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    intentos: list[str] = []

    def descargar(url: str, *, agente: str) -> bytes:
        intentos.append(url)
        raise _http_error(404, {})

    monkeypatch.setattr(cache, "_descargar", descargar)
    with pytest.raises(urllib.error.HTTPError):
        cache.fetch_educado("https://x/y", agente=commons.AGENTE, dormir=lambda _: None)
    assert len(intentos) == 1


def test_sin_retry_after_se_espera_algo_y_no_se_machaca_al_servidor(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Si el servidor no dice cuánto, se espera de todas formas: reintentar ya es lo que no quiere."""
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    esperas: list[float] = []
    llamadas: list[int] = []

    def descargar(url: str, *, agente: str) -> bytes:
        llamadas.append(1)
        if len(llamadas) < 3:
            raise _http_error(503, {})
        return b"{}"

    monkeypatch.setattr(cache, "_descargar", descargar)
    cache.fetch_educado("https://x/y", agente=commons.AGENTE, dormir=esperas.append)
    assert esperas == [cache.ESPERA_POR_DEFECTO, cache.ESPERA_POR_DEFECTO]


def test_una_espera_absurda_se_acota() -> None:
    """Un `Retry-After` de una hora no deja la ingesta dormida: se acota y se vuelve a intentar."""
    assert cache.espera_pedida(_http_error(429, {"Retry-After": "3600"})) == cache.ESPERA_MAXIMA
    assert cache.espera_pedida(_http_error(429, {"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"})) == (
        cache.ESPERA_POR_DEFECTO
    )


def test_el_agente_dice_quienes_somos_y_donde_encontrarnos() -> None:
    """Lo exige la política de Wikimedia, y es lo que separa nuestro tráfico del de un bot anónimo.

    Y **no lleva ningún dato personal**: el contacto es el repositorio, que sigue existiendo cuando
    quien lanzó la ingesta ya no está.
    """
    assert commons.AGENTE.startswith("mareia-pipeline/")
    assert "https://github.com/universelle-io/mareia" in commons.AGENTE
    assert "@" not in commons.AGENTE


def test_la_pausa_entre_peticiones_solo_se_paga_cuando_se_sale_a_la_red(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """La concurrencia baja es la parte de ser educado que no espera a que el servidor se queje.

    Y el acierto de caché **no** duerme: si durmiera, re-ejecutar la ingesta entera costaría los
    mismos minutos que la primera vez y la caché dejaría de servir para lo que sirve.
    """
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(cache, "_descargar", lambda url, *, agente: b"{}")
    esperas: list[float] = []
    url = "https://www.wikidata.org/w/api.php?x=2"
    for _ in range(2):
        cache.fetch_educado(
            url, suffix=".json", agente=commons.AGENTE, pausa=0.5, dormir=esperas.append
        )
    assert esperas == [0.5]


def test_las_urls_son_las_que_se_midieron_contra_la_fuente() -> None:
    """Las URLs son la mitad de la procedencia: se citan en el README y se comprueban aquí.

    Sin este recorrido, cambiar `iiextmetadatafilter` o quitar `type=item` pasaría inadvertido
    hasta la siguiente ingesta con red, que no corre en CI.
    """
    busqueda = commons.url_busqueda(NOMBRE)
    assert busqueda.startswith("https://www.wikidata.org/w/api.php?")
    for trozo in ("action=wbsearchentities", "type=item", "search=Dicentrarchus+labrax"):
        assert trozo in busqueda
    claims = commons.url_claims(ENTIDAD, commons.PROPIEDAD_IMAGEN)
    assert "action=wbgetclaims" in claims and "property=P18" in claims and ENTIDAD in claims
    imageinfo = commons.url_imageinfo("File:x y.jpg")
    assert imageinfo.startswith("https://commons.wikimedia.org/w/api.php?")
    assert "titles=File%3Ax+y.jpg" in imageinfo
    assert "iiprop=url%7Cextmetadata" in imageinfo
    for campo in (
        commons.LICENCIA_CORTA,
        commons.ARTISTA,
        commons.LICENCIA_URL,
        commons.LICENCIA_CODIGO,
        commons.CON_DERECHOS,
        commons.ATRIBUCION_REQUERIDA,
    ):
        assert campo in imageinfo


def test_el_fichero_se_nombra_igual_lo_pida_quien_lo_pida() -> None:
    """`url_imageinfo` acepta el nombre con y sin `File:`, y pregunta siempre por lo mismo."""
    assert commons.url_imageinfo("x.jpg") == commons.url_imageinfo("File:x.jpg")


def _sin_red(_: Any = None) -> None:
    raise AssertionError("esta parte del módulo no puede tocar la red")


def test_leer_las_respuestas_no_toca_la_red(monkeypatch: pytest.MonkeyPatch) -> None:
    """Las partes puras son puras: la suite entera de arriba corre sin red y por eso está en CI."""
    monkeypatch.setattr(commons.cache, "fetch_educado", _sin_red)
    assert commons.leer_busqueda(_busqueda(), consultado=NOMBRE) == ENTIDAD
    assert commons.leer_metadatos(_imageinfo(), fichero="File:x").completa
