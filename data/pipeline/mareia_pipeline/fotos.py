"""El dataset de fotos (`fotos/v1`): una foto por especie, con **su** autor y **su** licencia.

Aquí vive lo que es de Mareia y no de Wikidata ni de Commons: por qué nombre se pregunta la foto de
cada especie, qué forma tiene `data/especies/fotos.json` y qué tiene que declarar una entrada para
poder publicarse (el **gate F2**). Leer las dos APIs es cosa de `sources/commons.py`.

**Tres reglas gobiernan el fichero entero.**

1. **Se pregunta por el taxón que resolvió WoRMS, no por el literal del BOE.** El nombre de la
   norma es de 1995 y a veces trae erratas (`Thunnus aibacares`); preguntar por él a un buscador
   sería identificar un animal por una grafía que la ciencia no usa. Una especie sin taxón resuelto
   **no se pregunta**: cae a `sinFoto` con su motivo.
2. **`sinFoto` es obligatorio y explícito.** Toda clave del catálogo está exactamente en un sitio:
   o en `fotos` con su foto, o en `sinFoto` con el motivo de no tenerla. Una especie que
   sencillamente no apareciera sería un hueco mudo, que es lo que costó los diez puertos sin área
   de T-21.
3. **No hay «la licencia de las fotos».** Licencia, autor y URL de licencia van **por fichero**,
   dentro de cada entrada, porque en la muestra del plan salieron **seis licencias distintas en
   doce ficheros**. Un pie global sería falso para las seis a la vez.
4. **`licenciaUrl` es condicional, y `licenciaCodigo` es lo que lo hace comprobable.** El contrato
   original la exigía en toda foto y eso dejó fuera 15 especies cuya única imagen es de dominio
   público —que no tiene condiciones, así que no hay URL de condiciones que enlazar— publicando
   además un motivo falso. Desde la enmienda del 2026-08-30: obligatoria y URL válida cuando la
   licencia tiene condiciones, **ausente** cuando no las tiene, y el `licenciaCodigo` de Commons
   siempre, para que el gate pueda distinguir «no hay condiciones» de «se nos perdió la URL».

Y la de siempre: **la identificación no es nuestra**. Cada foto publica en `identificadaPor` el
ítem de Wikidata y la propiedad (`P18`) de los que sale, para que quien dude pueda ir a mirarlo.

**El contrato de campos está congelado en `docs/trayectorias/T-23-plan.md`** y este módulo no le
añade ni uno: en T-20 los dos carriles divergieron en nueve campos y costó un ciclo entero de
reconciliación. Lo que sobra aquí (fuentes, censos, el reparto de licencias) se cuenta en
`data/especies/README.md` y en la salida de la ingesta, no dentro del artefacto.
"""

from __future__ import annotations

import datetime as dt
import json
import urllib.parse
from pathlib import Path
from typing import Any

from mareia_pipeline.sources import commons

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET = REPO_ROOT / "data" / "especies" / "fotos.json"

SCHEMA = "fotos/v1"

#: Los campos que una foto publicada tiene que traer **siempre**: sin `url` no hay imagen, sin
#: `descripcion` no hay dónde comprobarla, y sin `autor`, `licencia` y `licenciaCodigo` la foto no se
#: puede publicar. El gate F2 los exige todos, sin excepción y sin admitir la cadena vacía.
CAMPOS_DE_FOTO: tuple[str, ...] = (
    "fichero",
    "url",
    "descripcion",
    "autor",
    "licencia",
    "licenciaCodigo",
)

#: El único campo **condicional** del contrato, y lo es en los dos sentidos (ver `errores_de_fotos`):
#: obligatorio y URL válida cuando la licencia tiene condiciones, y **ausente** cuando no las tiene.
CAMPO_LICENCIA_URL = "licenciaUrl"

#: Los códigos de licencia que no tienen condiciones que enlazar. Es el allowlist cerrado de la
#: ingesta, y se importa en vez de repetirse: dos listas iguales escritas en dos sitios son dos
#: listas que un día dejan de serlo, y aquí la que manda es la que decidió si la foto se publicaba.
LICENCIAS_SIN_CONDICIONES = commons.LICENCIAS_SIN_CONDICIONES

#: Los campos de `identificadaPor`: quién identificó el taxón, en qué ítem y por qué propiedad.
CAMPOS_DE_IDENTIFICACION: tuple[str, ...] = ("fuente", "entidad", "propiedad")

#: Los campos de `identificadaPor` que además tienen un único valor válido. Publicar
#: `"fuente": "Mareia"` sería atribuirnos una decisión que no hemos tomado, y `"propiedad": "P373"`
#: —la categoría de Commons— sería decir que la imagen sale de donde no sale.
IDENTIFICACION_ESPERADA: dict[str, str] = {
    "fuente": commons.FUENTE_IDENTIFICACION,
    "propiedad": commons.PROPIEDAD_IMAGEN,
}

MOTIVO_SIN_TAXON = (
    "el catálogo no resuelve esta fila a ningún taxón de WoRMS, así que no hay nombre científico "
    "por el que preguntar: buscar el literal del BOE —que puede ser una errata de 1995— sería "
    "identificar a un animal por conjetura"
)


def nombre_a_consultar(especie: dict[str, Any]) -> str | None:
    """Por qué nombre se le pide la foto a una especie del catálogo, o ``None`` si no hay ninguno.

    El aceptado cuando WoRMS da uno, y si no el que WoRMS devolvió: es el mismo criterio que
    ``especies.nombre_para_obis``, y por el mismo motivo —Wikidata resuelve sus taxones contra
    nomenclaturas vivas, así que preguntar por un nombre que WoRMS da por superado es preguntar por
    una etiqueta que ya casi nadie usa—.
    """
    taxon = especie.get("taxon") or {}
    if not taxon.get("resuelto"):
        return None
    aceptado = taxon.get("aceptado") or {}
    return aceptado.get("nombre") or taxon.get("nombreCientifico")


def _foto_a_json(foto: commons.Foto) -> dict[str, Any]:
    """Una foto → su entrada del dataset. **Estos campos y no otros** (contrato congelado).

    `licenciaUrl` se **omite** —no se escribe vacía ni a `null`— cuando la licencia no tiene
    condiciones que enlazar. Escribir `""` o `null` diría «aquí falta algo» de una foto a la que no
    le falta nada, y dejaría abierto el sitio donde después cabría una URL rota.
    """
    entrada: dict[str, Any] = {
        "fichero": foto.fichero,
        "url": foto.url,
        "descripcion": foto.descripcion,
        "autor": foto.autor,
        "licencia": foto.licencia,
        "licenciaCodigo": foto.licencia_codigo,
    }
    if foto.licencia_url is not None:
        entrada[CAMPO_LICENCIA_URL] = foto.licencia_url
    entrada["identificadaPor"] = {
        "fuente": commons.FUENTE_IDENTIFICACION,
        "entidad": foto.entidad,
        "propiedad": commons.PROPIEDAD_IMAGEN,
    }
    return entrada


def construir_dataset(
    catalogo: dict[str, Any],
    resultados: dict[str, commons.Resultado],
    *,
    consultado_en: dt.date,
) -> dict[str, Any]:
    """El catálogo de T-20 + lo que contestaron Wikidata y Commons → el documento ``fotos/v1``.

    Parte pura: no toca la red, así que la suite construye el dataset entero con respuestas de
    mentira y el gate F2 se prueba sobre lo mismo que se publica.

    ``consultadoEn`` se publica arriba y a la vista porque los metadatos **se congelan** el día de
    la ingesta: si mañana en Commons le cambian la licencia a una foto, lo que dice este fichero es
    lo que la fuente decía ese día, y la fecha es lo único que permite darse cuenta.
    """
    fotos: dict[str, Any] = {}
    sin_foto: dict[str, Any] = {}
    for especie in catalogo["especies"]:
        clave = especie["clave"]
        nombre = nombre_a_consultar(especie)
        if nombre is None:
            sin_foto[clave] = {"motivo": MOTIVO_SIN_TAXON}
            continue
        resultado = resultados.get(nombre)
        if resultado is None:
            raise ValueError(
                f"falta la consulta de «{nombre}» ({clave}): el dataset no se construye a medias, "
                "porque una especie que desaparece del fichero es un hueco sin motivo"
            )
        if resultado.foto is None:
            sin_foto[clave] = {"motivo": resultado.motivo or ""}
        else:
            fotos[clave] = _foto_a_json(resultado.foto)
    return {
        "schema": SCHEMA,
        "consultadoEn": consultado_en.isoformat(),
        "fotos": dict(sorted(fotos.items())),
        "sinFoto": dict(sorted(sin_foto.items())),
    }


def volcar(dataset: dict[str, Any], destino: Path = DATASET) -> None:
    """Escribe el dataset con el mismo formato que el resto de datos del repositorio."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cargar(origen: Path = DATASET) -> dict[str, Any]:
    """Lee el dataset publicado."""
    return json.loads(origen.read_text(encoding="utf-8"))


#: Los esquemas que se aceptan en las tres URLs que publica cada foto. `http` está por una
#: medición, no por comodidad: **5 de las 66 fotos** traen la URL de su licencia en `http`
#: —`http://creativecommons.org/licenses/by-sa/3.0/`, la forma que imprimen las plantillas viejas de
#: Commons—. Reescribirlas a `https` sería cambiar lo que dice la fuente sobre sus propias
#: condiciones de uso, y rechazarlas sería tirar cinco fotos perfectamente acreditadas.
ESQUEMAS = ("https", "http")


def _es_url(valor: Any) -> bool:
    """Una URL con esquema y anfitrión. No comprueba que exista: comprueba que sea una URL."""
    if not isinstance(valor, str):
        return False
    partes = urllib.parse.urlsplit(valor.strip())
    return partes.scheme in ESQUEMAS and bool(partes.netloc)


# --------------------------------------------------------------------------------------------
# F2 · ninguna foto sin autor y sin licencia
# --------------------------------------------------------------------------------------------


def _errores_de_licencia(clave: str, entrada: dict[str, Any]) -> list[str]:
    """La regla condicional de `licenciaUrl`, que tiene **dos** mitades y las dos son obligatorias.

    * **Con condiciones** (todo lo que no esté en el allowlist): `licenciaUrl` obligatoria. «Sin
      URL» no es un pase libre; publicar una `CC BY-SA 4.0` sin decir dónde están sus condiciones
      es lo que el contrato original vino a impedir, y eso no cambia.
    * **Sin condiciones** (dominio público): `licenciaUrl` **ausente**. No `""`, no `null`, no
      presente. La ausencia obligatoria es a propósito: la rama del dominio público es el sitio
      exacto donde escondería una URL rota quien quisiera —nadie comprueba el enlace de una foto
      «que total, es de dominio público»—, y publicar unas condiciones donde no las hay es una
      afirmación falsa sobre lo que se puede hacer con la imagen.

    El código de licencia se lee del artefacto y no se recomputa, y ése es justo el porqué de
    `licenciaCodigo`: el gate mira **lo publicado**, no lo que la ingesta se acuerde de haber hecho.
    """
    codigo = entrada.get("licenciaCodigo")
    codigo = codigo.strip().lower() if isinstance(codigo, str) else ""
    url = entrada.get(CAMPO_LICENCIA_URL)
    if codigo in LICENCIAS_SIN_CONDICIONES:
        if CAMPO_LICENCIA_URL not in entrada:
            return []
        return [
            f"«{clave}» publica «licenciaCodigo»: «{codigo}» —que no tiene condiciones de "
            f"reutilización— y además «{CAMPO_LICENCIA_URL}» = {url!r}. Cuando no hay condiciones "
            "no hay URL de condiciones que enlazar, así que el campo tiene que estar ausente: "
            "admitirlo aquí sería dejar abierto el único sitio del dataset donde una URL rota no "
            "la comprobaría nadie"
        ]
    if isinstance(url, str) and url.strip():
        return []
    return [
        f"«{clave}» publica una foto con licencia «{codigo or '(sin código)'}», que tiene "
        f"condiciones, y sin «{CAMPO_LICENCIA_URL}» ({url!r}). La excepción es sólo del dominio "
        f"público ({', '.join(sorted(LICENCIAS_SIN_CONDICIONES))}), corroborado por la propia "
        "fuente: fuera de ahí, una licencia sin decir dónde están sus condiciones no se publica"
    ]


def _errores_de_foto(clave: str, entrada: Any) -> list[str]:
    if not isinstance(entrada, dict):
        return [f"«{clave}» publica una foto que no es un objeto ({type(entrada).__name__})"]
    fallos: list[str] = []
    for campo in CAMPOS_DE_FOTO:
        valor = entrada.get(campo)
        if not isinstance(valor, str) or not valor.strip():
            fallos.append(
                f"«{clave}» publica una foto sin «{campo}» ({valor!r}). Una imagen sin autor o sin "
                "licencia no se puede publicar, y una sin URL no se puede ni mirar: la especie "
                "tenía que haber caído a «sinFoto» con su motivo"
            )
    fallos.extend(_errores_de_licencia(clave, entrada))
    for campo in ("url", CAMPO_LICENCIA_URL, "descripcion"):
        if entrada.get(campo) and not _es_url(entrada[campo]):
            fallos.append(f"«{clave}» publica «{campo}» = {entrada[campo]!r}, que no es una URL")
    identificacion = entrada.get("identificadaPor")
    if not isinstance(identificacion, dict):
        return [
            *fallos,
            f"«{clave}» publica una foto sin «identificadaPor»: la identificación no es nuestra y "
            "sin decir de quién es, la foto es una conjetura firmada por Mareia",
        ]
    for campo in CAMPOS_DE_IDENTIFICACION:
        valor = identificacion.get(campo)
        if not isinstance(valor, str) or not valor.strip():
            fallos.append(f"«{clave}» identifica su foto sin decir «{campo}» ({valor!r})")
    for campo, esperado in IDENTIFICACION_ESPERADA.items():
        if identificacion.get(campo) and identificacion[campo] != esperado:
            fallos.append(
                f"«{clave}» dice que su foto la identificó «{campo}: "
                f"{identificacion[campo]}» y las de este dataset salen todas de «{esperado}»"
            )
    entidad = identificacion.get("entidad")
    if isinstance(entidad, str) and not commons.ENTIDAD.match(entidad.strip()):
        fallos.append(
            f"«{clave}» dice que su foto la identifica el ítem {entidad!r}, que no es un ítem de "
            "Wikidata: la cita tiene que poder comprobarla cualquiera"
        )
    return fallos


def errores_de_fotos(dataset: dict[str, Any]) -> list[str]:
    """**Gate F2**: ninguna foto publicada sin autor, sin licencia y sin quién la identificó.

    **Por qué existe.** Publicar una imagen de Commons sin acreditar a su autor y sin decir bajo
    qué licencia se reutiliza no es un descuido de forma: es incumplir la licencia con la que se
    obtuvo. Y como no hay una licencia común —seis distintas en doce ficheros medidos, incluida una
    `CC BY-SA 3.0 de` de jurisdicción alemana—, no se puede tapar el hueco con un pie de página que
    diga «fotos de Wikimedia Commons»: sería falso para casi todas.

    **Por qué mira el dataset y no la ingesta.** La ingesta ya descarta la foto incompleta, pero eso
    es una promesa del código de hoy; esto es una condición del artefacto que se publica. Una
    entrada editada a mano, un dataset regenerado con otra versión del parser o un campo que se
    vacíe en una migración tienen que salir en rojo aquí, sin red y en cada ejecución de CI.

    Comprueba, entrada a entrada: los seis campos incondicionales del contrato con contenido, la
    regla condicional de `licenciaUrl` (`_errores_de_licencia`), que las URLs que haya sean URLs, y
    que `identificadaPor` diga fuente, ítem y propiedad —con el ítem con forma de ítem de
    Wikidata—, porque una identificación que no se puede ir a comprobar no es una cita.
    """
    fotos = dataset.get("fotos")
    if not isinstance(fotos, dict):
        return ["el dataset no publica un objeto «fotos»"]
    return [
        fallo
        for clave, entrada in sorted(fotos.items())
        for fallo in _errores_de_foto(clave, entrada)
    ]


# --------------------------------------------------------------------------------------------
# Cobertura · ningún hueco mudo: cada especie del catálogo está en un sitio y con motivo
# --------------------------------------------------------------------------------------------


def errores_de_cobertura(dataset: dict[str, Any], catalogo: dict[str, Any]) -> list[str]:
    """Las claves del catálogo están **todas**, cada una en un solo sitio, y los huecos con motivo.

    Se recuenta contra `catalogo.json`, que es quien fija las 86 especies: un dataset de fotos al
    que le faltara una especie sería internamente coherente y más corto, y la ficha de esa especie
    no tendría ni foto ni explicación de por qué no la tiene. Eso es el hueco mudo de T-21.
    """
    fotos = dataset.get("fotos") or {}
    sin_foto = dataset.get("sinFoto")
    fallos: list[str] = []
    if not isinstance(sin_foto, dict):
        return [
            "el dataset no publica el objeto «sinFoto»: es obligatorio aunque esté vacío, porque "
            "es donde se dice por qué falta cada foto que falta"
        ]
    esperadas = {especie["clave"] for especie in catalogo["especies"]}
    publicadas = set(fotos) | set(sin_foto)
    for falta in sorted(esperadas - publicadas):
        fallos.append(
            f"el catálogo publica la especie «{falta}» y el dataset de fotos no dice ni que tenga "
            "foto ni por qué no la tiene"
        )
    for sobra in sorted(publicadas - esperadas):
        fallos.append(f"el dataset de fotos habla de «{sobra}», que no está en el catálogo")
    for repetida in sorted(set(fotos) & set(sin_foto)):
        fallos.append(
            f"«{repetida}» está a la vez en «fotos» y en «sinFoto»: quien lea el dataset no puede "
            "saber si esa especie tiene foto o no"
        )
    for clave, entrada in sorted(sin_foto.items()):
        motivo = (entrada or {}).get("motivo") if isinstance(entrada, dict) else None
        if not isinstance(motivo, str) or not motivo.strip():
            fallos.append(
                f"«{clave}» no tiene foto y tampoco dice por qué: un hueco sin motivo no se "
                "distingue de un olvido"
            )
    return fallos


def reparto_de_licencias(dataset: dict[str, Any]) -> dict[str, int]:
    """Cuántos ficheros hay de cada licencia, contados sobre lo publicado.

    Es el censo que el README tiene que decir bien: no se declara, se cuenta.
    """
    reparto: dict[str, int] = {}
    for entrada in (dataset.get("fotos") or {}).values():
        licencia = entrada.get("licencia", "")
        reparto[licencia] = reparto.get(licencia, 0) + 1
    return dict(sorted(reparto.items(), key=lambda par: (-par[1], par[0])))
