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
5. **`autor` también es condicional, y `atribucionRequerida` es lo que lo hace comprobable**
   (enmienda del 2026-08-31, mismo patrón y por la misma razón). Puede faltar **sólo** cuando la
   propia Commons declara `AttributionRequired = "false"` y `Copyrighted = "False"` —medido, los
   dos ficheros de la NOAA del bacalao y de las lisas—, y entonces la ficha dice que Commons no
   registra autor en vez de pintar un crédito vacío. Con `atribucionRequerida` en `true` y sin
   autor, el gate F2 se pone **rojo**: ahí quien lo impide es la licencia del fichero.
6. **Una fila puede publicar la foto de otro taxón, pero sólo si lo elige la norma y lo dice la
   página.** Dos filas del BOE no pueden ilustrarse con su propio taxón: la que nombra varias
   especies en una celda —que por eso el catálogo deja sin resolver— y la de un género cuya única
   `P18` no se puede publicar. En las dos, la foto sale de **una especie que nombra el propio
   BOE**, y la entrada publica `prestadaDe` para que la ficha lo rotule. La elección la hace la
   norma; nosotros sólo la decimos en voz alta. Si no hay ninguna especie nombrada, se queda en
   `sinFoto` con su motivo: ahí sí estaríamos eligiendo nosotros.

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
import re
import urllib.parse
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mareia_pipeline.sources import commons

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET = REPO_ROOT / "data" / "especies" / "fotos.json"

SCHEMA = "fotos/v1"

#: Los campos que una foto publicada tiene que traer **siempre**: sin `url` no hay imagen, sin
#: `descripcion` no hay dónde comprobarla, y sin `licencia` ni `licenciaCodigo` la foto no se puede
#: publicar. El gate F2 los exige todos, sin excepción y sin admitir la cadena vacía.
CAMPOS_DE_FOTO: tuple[str, ...] = (
    "fichero",
    "url",
    "descripcion",
    "licencia",
    "licenciaCodigo",
)

#: El campo **condicional** de la licencia, y lo es en los dos sentidos (ver `errores_de_fotos`):
#: obligatorio y URL válida cuando la licencia tiene condiciones, y **ausente** cuando no las tiene.
CAMPO_LICENCIA_URL = "licenciaUrl"

#: El campo **condicional** del crédito: obligatorio salvo que la foto declare que su fuente no
#: exige atribuir. Es el que se cae de `CAMPOS_DE_FOTO`, no una excepción escondida dentro de ellos.
CAMPO_AUTOR = "autor"

#: Lo que declara la fuente sobre atribuir, publicado **en toda foto** y como booleano de verdad.
#: Es a `autor` lo que `licenciaCodigo` es a `licenciaUrl`: sin él, «Commons dice que no hace falta
#: atribuir» y «se nos perdió el autor» son el mismo JSON, y el gate no puede distinguirlos.
CAMPO_ATRIBUCION = "atribucionRequerida"

#: De qué otro taxón es la foto, cuando la fila no puede ilustrarse con el suyo. Sólo aparece en las
#: entradas prestadas: en una foto normal, decir de qué taxón es sería ruido.
CAMPO_PRESTADA = "prestadaDe"

#: Los campos de `prestadaDe`: qué clase de préstamo es, de qué especie es la foto y **en qué fila
#: la nombra la norma**, que es lo que hace comprobable que la elección no la hemos hecho nosotros.
CAMPOS_DE_PRESTAMO: tuple[str, ...] = ("tipo", "nombre", "nombreBoe")

#: La fila regula un **género** y su propia imagen no se puede publicar: la foto es de una especie
#: de ese género que la norma nombra en otra fila.
PRESTAMO_UNA_DEL_GENERO = "una_del_genero"

#: La fila nombra **varias especies** en una celda, así que el catálogo no la resuelve a ningún
#: taxón: la foto es de la primera que la norma nombra en esa misma fila.
PRESTAMO_LA_PRIMERA_DE_LA_FILA = "la_primera_de_la_fila"

#: Los dos tipos de préstamo. Es un conjunto cerrado a propósito: un tipo nuevo es un rótulo nuevo
#: en la ficha, y una entrada prestada cuyo rótulo la página no sepa escribir se publicaría muda.
TIPOS_DE_PRESTAMO: frozenset[str] = frozenset(
    {PRESTAMO_UNA_DEL_GENERO, PRESTAMO_LA_PRIMERA_DE_LA_FILA}
)

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


# --------------------------------------------------------------------------------------------
# Las especies que nombra la norma · de dónde sale una foto prestada
# --------------------------------------------------------------------------------------------

#: Las abreviaturas que la norma escribe donde iría un epíteto. `spp` —y `spps`, que es como lo
#: escribe el Anexo II— abrevia «species pluralis»: nombra el género entero, no una especie, y
#: leerlas como epíteto convertiría «Sepia spp» en la especie «Sepia spp», que no existe.
ABREVIATURAS_DE_GENERO: frozenset[str] = frozenset({"sp", "spp", "spps", "ssp", "subsp"})

#: Un binomio escrito entero: género en mayúscula, epíteto en minúscula.
_BINOMIO = re.compile(r"\b([A-Z][a-z]+)\s+([a-z]+)\b")

#: Un nombre con el género abreviado, como el `L. Budegassa` de la fila del rape. **Nombra una
#: especie pero no sirve para preguntar por ella**: `L.` no es un género, es una letra.
_ABREVIADO = re.compile(r"\b[A-Z]\.\s*[A-Za-z]+\b")


def binomios_que_nombra(literal: str) -> tuple[str, ...]:
    """Los nombres de especie que un literal del BOE escribe **enteros**, en el orden de la norma.

    Es el único sitio del proyecto donde se lee el literal de 1995 para preguntar por él, y hace
    falta decir por qué se puede: **lo que sale de aquí no se publica, se pregunta**, y la pregunta
    es la del punto 1 de `sources.commons` —qué ítem declara exactamente este nombre científico—,
    que a una errata como `Thunnus aibacares` no le contesta nadie. La grafía mala no se convierte
    en una foto equivocada: se convierte en un hueco con su motivo.
    """
    return tuple(
        f"{genero} {epiteto}"
        for genero, epiteto in _BINOMIO.findall(literal)
        if epiteto not in ABREVIATURAS_DE_GENERO
    )


def cuantas_especies_nombra(literal: str) -> int:
    """Cuántas especies nombra un literal del BOE, contando también las de género abreviado.

    Se cuentan las abreviadas aunque no se pueda preguntar por ellas porque lo que decide si una
    fila es «de varias especies» es lo que la norma nombra, no lo que nosotros sabemos consultar:
    `Lophius piscatorius, L. Budegassa` nombra **dos**, y publicar la foto de la primera sin decir
    que hay otra sería contar media fila.
    """
    return len(binomios_que_nombra(literal)) + len(_ABREVIADO.findall(literal))


@dataclass(frozen=True)
class Prestamo:
    """De qué especie sale la foto de una fila que no puede ilustrarse con su propio taxón.

    `nombre_boe` es el literal de la fila donde **la norma** nombra esa especie, y es el campo que
    convierte el préstamo en algo comprobable: sin él, «la elige la norma» sería una afirmación
    nuestra sobre un texto que el lector tendría que ir a buscar.
    """

    tipo: str
    nombre: str
    nombre_boe: str


def prestamos_posibles(catalogo: dict[str, Any]) -> dict[str, Prestamo]:
    """Qué especie podría prestarle la foto a cada fila que no puede publicar la suya.

    Dos casos, y los dos salen del propio catálogo sin que elijamos nada:

    * **La fila nombra varias especies** y por eso el catálogo la deja sin taxón (repartir una fila
      legal en dos decide a qué alcance se aplica una talla mínima, y esa decisión no es nuestra).
      Para la foto no hace falta repartir nada: se usa la **primera** que la norma nombra, y la
      ficha dice que hay más.
    * **La fila regula un género**. Si su propia `P18` no se puede publicar, la foto sale de una
      especie de ese género **que la norma nombre en otra fila**. Cuál, si hay varias, lo decide el
      orden de la norma, que es el del catálogo: no hay ningún criterio nuestro metido ahí.

    Se calcula para **todas** las filas candidatas y no sólo para las que fallan porque esto es una
    función pura del catálogo; quién decide si el préstamo llega a usarse es `construir_dataset`,
    que es quien sabe si la fila publicó su propia foto.
    """
    especies = catalogo["especies"]
    posibles: dict[str, Prestamo] = {}
    for especie in especies:
        literal = especie["nombreBoe"]
        propios = binomios_que_nombra(literal)
        if nombre_a_consultar(especie) is None:
            if propios and cuantas_especies_nombra(literal) > 1:
                posibles[especie["clave"]] = Prestamo(
                    PRESTAMO_LA_PRIMERA_DE_LA_FILA, propios[0], literal
                )
            continue
        if (especie.get("taxon") or {}).get("rango") != "genero":
            continue
        genero = nombre_a_consultar(especie)
        for otra in especies:
            if otra["clave"] == especie["clave"]:
                continue
            nombres = [n for n in binomios_que_nombra(otra["nombreBoe"]) if n.startswith(f"{genero} ")]
            if nombres:
                posibles[especie["clave"]] = Prestamo(
                    PRESTAMO_UNA_DEL_GENERO, nombres[0], otra["nombreBoe"]
                )
                break
    return posibles


def _prestamo_a_json(prestamo: Prestamo) -> dict[str, Any]:
    return {
        "tipo": prestamo.tipo,
        "nombre": prestamo.nombre,
        "nombreBoe": prestamo.nombre_boe,
    }


def _foto_a_json(foto: commons.Foto, prestamo: Prestamo | None = None) -> dict[str, Any]:
    """Una foto → su entrada del dataset. **Estos campos y no otros** (contrato congelado).

    Dos campos se **omiten** —no se escriben vacíos ni a `null`— cuando no aplican. `licenciaUrl`,
    cuando la licencia no tiene condiciones que enlazar; `autor`, cuando la fuente no registra
    ninguno **y** declara que no hace falta atribuir. Escribir `""` o `null` diría «aquí falta
    algo» de una foto a la que no le falta nada, y dejaría abierto el sitio donde después cabría un
    crédito vacío o una URL rota.

    `atribucionRequerida` no se omite nunca, tenga autor o no: es la condición, y una condición que
    sólo se publica cuando se cumple no la puede comprobar nadie.
    """
    entrada: dict[str, Any] = {
        "fichero": foto.fichero,
        "url": foto.url,
        "descripcion": foto.descripcion,
    }
    if foto.autor is not None:
        entrada[CAMPO_AUTOR] = foto.autor
    entrada[CAMPO_ATRIBUCION] = foto.atribucion_requerida
    entrada["licencia"] = foto.licencia
    entrada["licenciaCodigo"] = foto.licencia_codigo
    if foto.licencia_url is not None:
        entrada[CAMPO_LICENCIA_URL] = foto.licencia_url
    if prestamo is not None:
        entrada[CAMPO_PRESTADA] = _prestamo_a_json(prestamo)
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
    prestamos: Mapping[str, Prestamo] | None = None,
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
    prestamos = prestamos or {}

    def consultado(nombre: str, clave: str) -> commons.Resultado:
        resultado = resultados.get(nombre)
        if resultado is None:
            raise ValueError(
                f"falta la consulta de «{nombre}» ({clave}): el dataset no se construye a medias, "
                "porque una especie que desaparece del fichero es un hueco sin motivo"
            )
        return resultado

    for especie in catalogo["especies"]:
        clave = especie["clave"]
        nombre = nombre_a_consultar(especie)
        propia = None if nombre is None else consultado(nombre, clave)
        if propia is not None and propia.foto is not None:
            fotos[clave] = _foto_a_json(propia.foto)
            continue
        # La fila no publica su propio taxón. Antes de rotular el hueco, la única salida que no es
        # una conjetura nuestra: una especie que **la norma** nombra (regla 6 de la cabecera).
        prestamo = prestamos.get(clave)
        prestada = None if prestamo is None else consultado(prestamo.nombre, clave)
        if prestamo is not None and prestada is not None and prestada.foto is not None:
            fotos[clave] = _foto_a_json(prestada.foto, prestamo)
            continue
        if propia is None:
            sin_foto[clave] = {"motivo": MOTIVO_SIN_TAXON}
        else:
            sin_foto[clave] = {"motivo": propia.motivo or ""}
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


def _errores_de_autor(clave: str, entrada: dict[str, Any]) -> list[str]:
    """El crédito: **obligatorio salvo que la propia fuente diga que no hace falta atribuir**.

    La condición se lee del artefacto (`atribucionRequerida`) y no se recomputa, que es el porqué
    del campo: el gate mira **lo publicado**, no lo que la ingesta se acuerde de haber hecho. Y se
    exige booleano de verdad, no la cadena `"false"`: `"false"` es un valor verdadero en casi todos
    los lenguajes que van a leer este JSON, y la excepción no puede depender de eso.

    Los tres desenlaces:

    * `atribucionRequerida = true` **y sin autor** → rojo, y es el importante. Ahí quien lo impide
      es la licencia del fichero: publicar `File:Monkfish.jpg` —`cc-by-sa-3.0`, que exige atribuir,
      y sin `Artist`— sin nombrar a nadie sería incumplirla, no un descuido de forma.
    * `atribucionRequerida = false` y sin autor → se publica. Lo declara Commons, no nosotros, y la
      ficha dice que la fuente no registra autor en vez de pintar un crédito vacío.
    * Con autor, en los dos casos → se publica, y el autor no puede ser la cadena vacía, que es la
      forma en que un crédito desaparece sin que nada enrojezca.
    """
    exige = entrada.get(CAMPO_ATRIBUCION)
    autor = entrada.get(CAMPO_AUTOR)
    if not isinstance(exige, bool):
        return [
            f"«{clave}» publica una foto sin «{CAMPO_ATRIBUCION}» booleano ({exige!r}). Es la "
            "condición que decide si el autor puede faltar, y una condición que no se publica —o "
            "que se publica como texto— no la puede comprobar nadie sobre el artefacto"
        ]
    if CAMPO_AUTOR in entrada and (not isinstance(autor, str) or not autor.strip()):
        return [
            f"«{clave}» publica «{CAMPO_AUTOR}» = {autor!r}. Un crédito vacío no acredita a nadie: "
            "o está el nombre, o el campo no está y la foto declara que su fuente no exige atribuir"
        ]
    if exige and CAMPO_AUTOR not in entrada:
        return [
            f"«{clave}» publica una foto que declara «{CAMPO_ATRIBUCION}»: true y no dice de quién "
            "es. Quien lo impide aquí es la licencia del fichero, no nosotros: reutilizar una "
            "imagen que exige atribuir sin nombrar a su autor es incumplirla. La especie tenía que "
            "haber caído a «sinFoto» con su motivo"
        ]
    return []


def _errores_de_prestamo(clave: str, entrada: dict[str, Any]) -> list[str]:
    """Si la foto es de otro taxón, la entrada tiene que decir **de cuál y por qué está aquí**.

    Una foto prestada sin `prestadaDe` es una foto de otro animal publicada bajo el nombre de éste,
    que es exactamente lo que el módulo entero existe para no hacer; y un `prestadaDe` a medias
    —sin la fila del BOE que nombra la especie— convierte «la elige la norma» en una afirmación
    nuestra que nadie puede ir a comprobar. El `tipo` se exige dentro del conjunto cerrado porque
    es lo que la ficha traduce a un rótulo: uno que no esté publicaría la foto prestada sin decirlo.
    """
    if CAMPO_PRESTADA not in entrada:
        return []
    prestada = entrada[CAMPO_PRESTADA]
    if not isinstance(prestada, dict):
        return [
            f"«{clave}» publica «{CAMPO_PRESTADA}» que no es un objeto ({type(prestada).__name__})"
        ]
    fallos = [
        f"«{clave}» publica una foto prestada sin decir «{campo}» ({prestada.get(campo)!r}): sin "
        "eso, es la foto de otro taxón publicada bajo el nombre de éste"
        for campo in CAMPOS_DE_PRESTAMO
        if not isinstance(prestada.get(campo), str) or not prestada[campo].strip()
    ]
    tipo = prestada.get("tipo")
    if isinstance(tipo, str) and tipo.strip() and tipo not in TIPOS_DE_PRESTAMO:
        fallos.append(
            f"«{clave}» dice que su foto es un préstamo de tipo «{tipo}», que no es ninguno de los "
            f"que la ficha sabe rotular ({', '.join(sorted(TIPOS_DE_PRESTAMO))}): una foto prestada "
            "que la página no sabe explicar se publicaría muda"
        )
    nombre = prestada.get("nombre")
    nombre_boe = prestada.get("nombreBoe")
    if isinstance(nombre, str) and isinstance(nombre_boe, str) and nombre not in nombre_boe:
        fallos.append(
            f"«{clave}» dice que la norma nombra «{nombre}» en la fila «{nombre_boe}», y esa fila "
            "no lo nombra. La elección de qué especie ilustra la fila la hace la norma, y si el "
            "literal no la nombra la estaríamos haciendo nosotros"
        )
    return fallos


def _errores_de_foto(clave: str, entrada: Any) -> list[str]:
    if not isinstance(entrada, dict):
        return [f"«{clave}» publica una foto que no es un objeto ({type(entrada).__name__})"]
    fallos: list[str] = []
    for campo in CAMPOS_DE_FOTO:
        valor = entrada.get(campo)
        if not isinstance(valor, str) or not valor.strip():
            fallos.append(
                f"«{clave}» publica una foto sin «{campo}» ({valor!r}). Una imagen sin licencia no "
                "se puede publicar, y una sin URL no se puede ni mirar: la especie tenía que haber "
                "caído a «sinFoto» con su motivo"
            )
    fallos.extend(_errores_de_autor(clave, entrada))
    fallos.extend(_errores_de_licencia(clave, entrada))
    fallos.extend(_errores_de_prestamo(clave, entrada))
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

    Comprueba, entrada a entrada: los cinco campos incondicionales del contrato con contenido, las
    dos reglas condicionales —la de `autor` (`_errores_de_autor`) y la de `licenciaUrl`
    (`_errores_de_licencia`)—, que una foto prestada diga de qué taxón es y en qué fila la nombra
    la norma (`_errores_de_prestamo`), que las URLs que haya sean URLs, y que `identificadaPor`
    diga fuente, ítem y propiedad —con el ítem con forma de ítem de Wikidata—, porque una
    identificación que no se puede ir a comprobar no es una cita.
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
