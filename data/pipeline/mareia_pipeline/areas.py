"""Áreas marinas protegidas publicables: de RAMPE al derivado ``areas-protegidas/v1``.

Aquí vive lo que es **de Mareia** y no de MITECO: qué se le cuenta a un puerto, con qué criterio y
con qué forma. El parseo y la reproyección de la fuente están en ``sources/rampe.py`` y ``utm.py``.

Tres decisiones dan forma al módulo, y las tres tienen el mismo motivo de fondo —**qué error es el
que no hace daño**—:

1. **No cruza ni un vértice.** El derivado publica hechos —nombre oficial, tipo, código, distancia
   aproximada, si el puerto cae dentro— y **ninguna geometría**. Es primero una cuestión de
   licencia: la página de descarga de MITECO no declara condiciones de uso, y lo que una licencia no
   declarada desde luego no permite es redistribuir la capa. Y es después una cuestión de peso: las
   86 áreas son 1.076.504 vértices, y lo que se publica cabe en 88 kB para los 153 puertos. El
   gate P2 lo mide sobre el artefacto, no sobre la intención de este módulo.

2. **La distancia es al borde del polígono, medida arista a arista.** No al vértice más cercano,
   que es lo que hacía la primera versión de este módulo por ser una línea de código en vez de
   veinte. La cota por vértice parecía inofensiva porque el error cae siempre del mismo lado —el
   vértice está igual de lejos o más lejos que el borde—, y **ese lado es el peligroso**: aleja, y
   una sección cuya única razón de ser es avisar, alejando, avisa de menos. Medido sobre RAMPE 2025
   contra los 153 puertos: la cota por vértice **perdía 6 relaciones reales** de 348, entre ellas 3
   de las 6 del Corredor de Migración de Cetáceos del Mediterráneo, que es la **única AMP** del
   catálogo. La causa está en la fuente y no en el método: RAMPE no tiene vértices densos —mediana
   de arista 2,01 m, pero 728 aristas pasan de 1 km, 286 de 5 km y la mayor mide **159,6 km**—, y el
   error de la cota es del orden de media arista. Pollença tenía el Corredor a 27,6 km de su borde
   y a 69,8 km de su vértice más cercano.

   La distancia sigue publicándose como aproximación y el campo sigue llamándose
   ``distanciaAproxKm``, porque sigue siéndolo: se mide sobre una esfera y no sobre el elipsoide
   (hasta 0,37 % en las latitudes de la costa española, o sea 110 m a 30 km), la arista se toma como
   arco de círculo máximo cuando en origen es una recta en un plano UTM (medido densificando en
   metros UTM antes de reproyectar: ≤ 15,3 m entre lo que se publica), y se **redondea hacia
   arriba** a la décima. Lo que ya no es es una cota de otra cosa.

3. **Y sigue haciendo falta mirar si el puerto cae dentro**, pero por otro motivo que el que decía
   esta cabecera. No es que el borde engañe: es que la distancia al borde **no distingue los dos
   lados**, y estar a 3 km del borde por dentro no es lo mismo que estar a 3 km por fuera. El
   punto-en-polígono es barato y responde una pregunta que ninguna distancia responde. Además cubre
   el caso del puerto muy metido en un área muy grande, cuyo borde caería más allá del radio.
   Medido sobre RAMPE 2025: hay 10 puertos dentro de un área y los diez están además a 0,1 km o
   menos del borde, así que hoy no rescata ninguna relación; publica un hecho distinto y más fuerte
   —«estás dentro»— y el modo de fallo que tapa seguiría siendo invisible.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mareia_pipeline import geo
from mareia_pipeline.sources import rampe

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET = REPO_ROOT / "data" / "geo" / "areas-protegidas.json"
PORTS_JSON = REPO_ROOT / "data" / "geo" / "ports.json"

SCHEMA = "areas-protegidas/v1"

#: Radio del aviso, en kilómetros. Es una decisión de producto, no una medida: 30 km es «lo tienes
#: al lado» para quien sale a pescar del puerto, y se declara en el propio dataset para que la
#: página pueda decir **hasta dónde se ha mirado** cuando no encuentra nada.
RADIO_KM = 30.0

#: A cuánto se redondea la distancia publicada. Una décima de kilómetro es cien metros, que es
#: aproximadamente el orden de lo que esta aproximación puede equivocarse por sí sola; publicar más
#: cifras sería fingir una precisión que el método no tiene.
DECIMALES_KM = 1

LICENCIA = "MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen"
LICENCIA_URL = (
    "https://www.miteco.gob.es/es/biodiversidad/temas/biodiversidad-marina/"
    "espacios-marinos-protegidos/rampe.html"
)
AVISO = (
    "Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un "
    "área protegida cerca no autoriza a pescar: esto dice dónde NO se puede, nunca dónde sí."
)


@dataclass(frozen=True)
class AreaIndexada:
    """Un área con su caja envolvente ya calculada.

    La caja se calcula **una vez** y no en cada consulta, y no es una micro-optimización gratuita:
    recorrerla por puerto sería recorrer 1.076.504 vértices ciento cincuenta y tres veces sólo para
    descartar lo que está a media península.
    """

    area: rampe.Area
    caja: tuple[float, float, float, float]


@dataclass(frozen=True)
class Vecindad:
    """Un área que le toca a un puerto, con lo que se sabe de la relación entre las dos."""

    area: rampe.Area
    #: Al **borde**: es la que se publica y la que decide si el área entra en el aviso.
    distancia_km: float
    #: Al vértice más cercano. No se publica: es el otro lado de ``comparativa_de``.
    distancia_al_vertice_km: float
    dentro: bool


def indexar(areas: tuple[rampe.Area, ...]) -> tuple[AreaIndexada, ...]:
    return tuple(AreaIndexada(area=area, caja=area.caja) for area in areas)


def _puede_estar_cerca(lat: float, lon: float, caja: tuple[float, float, float, float]) -> bool:
    """Descarte barato por caja envolvente, generoso a propósito.

    Los márgenes usan 100 km por grado en las dos direcciones, que es **menos** de lo que mide un
    grado de verdad (110,6 km de latitud y 111,3 · cos φ de longitud), así que la caja siempre se
    ensancha de más. Un descarte que se quede corto es un área que no se publica sin que nadie se
    entere; uno que se pase sólo cuesta unos microsegundos de cálculo exacto.
    """
    lat_min, lat_max, lon_min, lon_max = caja
    margen_lat = RADIO_KM / 100.0
    margen_lon = RADIO_KM / (100.0 * max(0.2, math.cos(math.radians(lat))))
    return (
        lat_min - margen_lat <= lat <= lat_max + margen_lat
        and lon_min - margen_lon <= lon <= lon_max + margen_lon
    )


def distancias_a(lat: float, lon: float, area: rampe.Area) -> tuple[float, float]:
    """Kilómetros del punto ``(al borde, al vértice más cercano)`` del área.

    Las dos en la misma pasada porque recorren lo mismo —el millón de vértices de RAMPE— y porque
    hay un gate que las compara: calcularlas en dos sitios distintos sería invitar a que se separen.

    El borde se mide arista a arista con ``geo.distancia_a_segmento_km``. El anillo se recorre
    **como ciclo**, con la arista que cierra incluida, igual que hace ``_dentro_del_anillo``: los
    3.187 anillos de RAMPE 2025 vienen cerrados —medido—, así que esa arista es degenerada y no
    aporta nada, pero el día que la fuente publique un anillo abierto las dos funciones seguirán
    hablando del mismo polígono.
    """
    punto = geo.unitario(lat, lon)
    al_borde = math.inf
    al_vertice = math.inf
    for poligono in area.poligonos:
        for anillo in poligono:
            vectores = [geo.unitario(vertice[0], vertice[1]) for vertice in anillo]
            for indice, vector in enumerate(vectores):
                al_vertice = min(al_vertice, geo.distancia_entre_unitarios_km(punto, vector))
                siguiente = vectores[(indice + 1) % len(vectores)]
                al_borde = min(al_borde, geo.distancia_a_segmento_km(punto, vector, siguiente))
    return al_borde, al_vertice


def distancia_al_borde_km(lat: float, lon: float, area: rampe.Area) -> float:
    """Kilómetros del punto al borde del área: la distancia que se publica."""
    return distancias_a(lat, lon, area)[0]


def distancia_al_vertice_mas_cercano(lat: float, lon: float, area: rampe.Area) -> float:
    """Kilómetros del punto al vértice más cercano: la métrica **vieja**, que ya no se publica.

    Sigue aquí porque es el otro lado de ``comparativa_de``, el gate que mide cuánto se separan las
    dos y se pone rojo si la fuente cambia de densidad.
    """
    return distancias_a(lat, lon, area)[1]


def _dentro_del_anillo(lat: float, lon: float, anillo: rampe.Anillo) -> bool:
    """Lanzamiento de rayo clásico, en grados.

    Trabajar en grados es correcto aquí porque ninguna área de RAMPE cruza el antimeridiano ni un
    polo: el rayo no se puede envolver sobre sí mismo. Fuera de esa condición no valdría, y por eso
    queda escrita.
    """
    dentro = False
    total = len(anillo)
    anterior = total - 1
    for actual in range(total):
        lat_a, lon_a = anillo[actual]
        lat_b, lon_b = anillo[anterior]
        if (lon_a > lon) != (lon_b > lon) and lat < (lat_b - lat_a) * (lon - lon_a) / (
            lon_b - lon_a
        ) + lat_a:
            dentro = not dentro
        anterior = actual
    return dentro


def dentro_del_area(lat: float, lon: float, area: rampe.Area) -> bool:
    """¿Cae el punto dentro del área, agujeros incluidos?

    En cada polígono el primer anillo es el contorno y los demás son huecos —islas que el área
    rodea sin incluir—, así que un punto dentro de un hueco **no** está dentro del área. Ignorar los
    huecos daría por protegida la tierra firme que el espacio marino rodea.
    """
    for poligono in area.poligonos:
        if not _dentro_del_anillo(lat, lon, poligono[0]):
            continue
        if any(_dentro_del_anillo(lat, lon, hueco) for hueco in poligono[1:]):
            continue
        return True
    return False


def candidatas_de(
    lat: float, lon: float, indexadas: tuple[AreaIndexada, ...]
) -> list[Vecindad]:
    """Todo lo que sobrevive al descarte por caja, con **las dos** distancias medidas.

    Es la pasada cara y es una sola: ``vecindad_de`` filtra de aquí lo que se publica y
    ``comparativa_de`` mira de aquí lo que las dos métricas dicen distinto. Publicar y comparar
    tienen que ver exactamente el mismo conjunto de candidatas o la comparación no significa nada.
    """
    candidatas: list[Vecindad] = []
    for indexada in indexadas:
        if not _puede_estar_cerca(lat, lon, indexada.caja):
            continue
        al_borde, al_vertice = distancias_a(lat, lon, indexada.area)
        candidatas.append(
            Vecindad(
                area=indexada.area,
                distancia_km=al_borde,
                distancia_al_vertice_km=al_vertice,
                dentro=dentro_del_area(lat, lon, indexada.area),
            )
        )
    return candidatas


def vecindad_de(
    lat: float, lon: float, indexadas: tuple[AreaIndexada, ...], *, radio_km: float = RADIO_KM
) -> list[Vecindad]:
    """Las áreas que le tocan a un punto, ordenadas de más cerca a más lejos.

    Entra un área si su **borde** está a ``radio_km`` **o** si el punto cae dentro de ella. La
    disyunción es el punto 3 de la cabecera: son dos preguntas distintas y ninguna implica la otra.
    """
    vecinas = [
        candidata
        for candidata in candidatas_de(lat, lon, indexadas)
        if candidata.distancia_km <= radio_km or candidata.dentro
    ]
    vecinas.sort(key=lambda vecina: (vecina.distancia_km, vecina.area.nombre))
    return vecinas


#: Cuántas relaciones de diferencia hay hoy entre medir al borde y medir al vértice: **6**, las
#: seis que la cota por vértice perdía. Es un **trinquete de dos lados** y no un techo, y por eso el
#: gate se pone rojo tanto si sube como si baja.
#:
#: Lo que este número mide de verdad es **la densidad de vértices de la fuente**: las dos distancias
#: se separan como media arista, así que mientras RAMPE publique aristas de 160 km habrá relaciones
#: que sólo el borde encuentra. Que **suba** significa que la fuente ha perdido densidad y que la
#: métrica vieja habría perdido todavía más. Que **baje** significa que la ha ganado —buena
#: noticia— o que alguien ha vuelto a medir al vértice sin que se note, que es el modo de fallo por
#: el que el gate mira también hacia abajo: con un techo solo, revertir la métrica lo dejaría verde.
#: Moverlo es una decisión con su PR y su medición, no un ajuste.
DIVERGENCIA_MEDIDA_RELACIONES = 6

#: Margen para comparar dos distancias que la aritmética exacta obliga a ordenar. El borde nunca
#: puede quedar más lejos que el vértice —el vértice **es** un punto del borde—, así que cualquier
#: diferencia por encima del ruido del flotante es un error de programación en la distancia
#: punto-segmento, no un dato. Un micrómetro.
_RUIDO_DEL_FLOTANTE_KM = 1e-9


def _estadisticas_de_arista(areas: tuple[rampe.Area, ...]) -> dict[str, Any]:
    """Cuánto miden las aristas de la fuente: la causa raíz, publicada para poder citarla.

    Sin esto, «la cota por vértice pierde relaciones» es una afirmación sobre nuestro código. Con
    esto es una afirmación sobre RAMPE, que es donde está el motivo: una arista de 160 km entre dos
    vértices consecutivos hace que el vértice más cercano no diga nada sobre dónde está el borde.
    """
    mayor = 0.0
    de_mas_de_un_km = 0
    for area in areas:
        for poligono in area.poligonos:
            for anillo in poligono:
                vectores = [geo.unitario(v[0], v[1]) for v in anillo]
                for indice, vector in enumerate(vectores):
                    siguiente = vectores[(indice + 1) % len(vectores)]
                    metros = geo.distancia_entre_unitarios_km(vector, siguiente) * 1_000.0
                    mayor = max(mayor, metros)
                    de_mas_de_un_km += metros > 1_000.0
    return {"aristaMaxM": round(mayor, 1), "aristasDeMasDeUnKm": de_mas_de_un_km}


def comparativa_de(
    catalogo: dict[str, Any],
    indexadas: tuple[AreaIndexada, ...],
    areas: tuple[rampe.Area, ...],
    *,
    radio_km: float = RADIO_KM,
) -> dict[str, Any]:
    """Qué publicaría cada una de las dos métricas, medido sobre el catálogo entero.

    Es el gate del cambio de T-21 y **no** una nota histórica. La distancia al borde y la distancia
    al vértice se separan como media arista, así que esta comparación es un termómetro de la
    densidad de la fuente: el día que RAMPE cambie de densidad —a mejor o a peor— este bloque se
    mueve, y por eso se recalcula en cada ingesta y se publica en el artefacto.

    Se publica en el artefacto porque `run.py check` corre **sin red**: sin estas cifras dentro del
    fichero, la única forma de comprobar la divergencia sería volver a descargar los 54,8 MB de
    RAMPE, que es justo lo que CI no hace.
    """
    entran = 0
    salen = 0
    borde_mas_lejos = 0
    por_borde = 0
    por_vertice = 0
    mayor_diferencia = 0.0
    donde = ""
    for puerto in catalogo["ports"]:
        for candidata in candidatas_de(puerto["lat"], puerto["lon"], indexadas):
            publica_borde = candidata.distancia_km <= radio_km or candidata.dentro
            publica_vertice = candidata.distancia_al_vertice_km <= radio_km or candidata.dentro
            por_borde += publica_borde
            por_vertice += publica_vertice
            entran += publica_borde and not publica_vertice
            salen += publica_vertice and not publica_borde
            diferencia = candidata.distancia_al_vertice_km - candidata.distancia_km
            borde_mas_lejos += diferencia < -_RUIDO_DEL_FLOTANTE_KM
            if publica_borde and diferencia > mayor_diferencia:
                mayor_diferencia = diferencia
                donde = f"{puerto['slug']} · {candidata.area.nombre}"
    return {
        "relacionesPorBorde": por_borde,
        "relacionesPorVertice": por_vertice,
        "entranSoloPorElBorde": entran,
        "salenAlMedirElBorde": salen,
        "bordeMasLejosQueVertice": borde_mas_lejos,
        "mayorDiferenciaKm": round(mayor_diferencia, DECIMALES_KM),
        "mayorDiferenciaEn": donde,
        **_estadisticas_de_arista(areas),
    }


def errores_de_divergencia(
    dataset: dict[str, Any], *, divergencia: int = DIVERGENCIA_MEDIDA_RELACIONES
) -> list[str]:
    """Gate P5: las dos métricas siguen diciendo lo que dijeron el día que se cambió de una a otra.

    Tres cosas, y las tres pueden ponerse rojas por motivos distintos:

    * **Ninguna relación puede salir al medir el borde**, ni el borde quedar más lejos que el
      vértice. No es un umbral: es aritmética. El vértice **es** un punto del borde, así que la
      distancia al borde es menor o igual siempre. Un rojo aquí es un error en la distancia
      punto-segmento, y por eso el mensaje no invita a ajustar nada.
    * **Cuántas relaciones entran sólo por el borde** tiene trinquete por los dos lados, y es la
      medida de la densidad de la fuente. Ver ``DIVERGENCIA_MEDIDA_RELACIONES``.
    * **La comparativa describe lo que se publica**: si `relacionesPorBorde` y el resumen no
      coinciden, la comparativa es de otra ejecución y no dice nada de este fichero.
    """
    comparativa = dataset.get("comparativa")
    if not isinstance(comparativa, dict):
        return [
            "el dataset no publica el bloque `comparativa`, así que no hay forma de saber sin red "
            "cuánto se separan la distancia al borde y la distancia al vértice"
        ]
    fallos: list[str] = []
    salen = comparativa.get("salenAlMedirElBorde")
    if salen:
        fallos.append(
            f"{salen} relación(es) desaparecen al medir al borde en vez de al vértice, y eso no "
            "puede pasar: el vértice es un punto del borde, así que el borde nunca está más lejos. "
            "No ajustes el umbral, mira `geo.distancia_a_segmento_km`"
        )
    mas_lejos = comparativa.get("bordeMasLejosQueVertice")
    if mas_lejos:
        fallos.append(
            f"en {mas_lejos} par(es) puerto–área el borde sale más lejos que el vértice más "
            "cercano, que es imposible: la distancia punto-segmento está mal"
        )
    entran = comparativa.get("entranSoloPorElBorde")
    if isinstance(entran, int) and entran > divergencia:
        fallos.append(
            f"{entran} relaciones entran sólo al medir el borde y lo medido son {divergencia}: la "
            "fuente ha bajado de densidad de vértices (arista máxima publicada "
            f"{comparativa.get('aristaMaxM')} m), así que la cota por vértice habría perdido "
            "todavía más. Vuelve a medir y explica el cambio antes de tocar "
            "DIVERGENCIA_MEDIDA_RELACIONES"
        )
    if isinstance(entran, int) and entran < divergencia:
        fallos.append(
            f"sólo {entran} relaciones entran por el borde y lo medido son {divergencia}: o la "
            "fuente ha densificado sus polígonos —que sería una buena noticia— o la distancia ha "
            "vuelto a medirse al vértice sin que se note. El gate mira también hacia abajo porque "
            "con un techo solo esa vuelta atrás daría verde"
        )
    relaciones = dataset.get("resumen", {}).get("relaciones")
    if comparativa.get("relacionesPorBorde") != relaciones:
        fallos.append(
            f"la comparativa dice {comparativa.get('relacionesPorBorde')} relaciones por borde y el "
            f"resumen publica {relaciones}: la comparativa no es de este fichero"
        )
    return fallos


def _sin_areas(radio_km: float) -> str:
    """El motivo que publica un puerto sin ninguna área cerca.

    Se escribe **dentro del dato** en vez de dejar el puerto fuera del fichero, y es la decisión que
    más se nota en el portal: una sección que desaparece se lee como «no hay nada que saber», y una
    que dice «ninguna a menos de 30 km» dice lo que sabemos y hasta dónde hemos mirado. El carril
    que publica la página no puede escribir la segunda si el puerto no está en el JSON.
    """
    return (
        f"ninguna área marina protegida de RAMPE 2025 tiene su borde a menos de {radio_km:.0f} km "
        "de este puerto, y el puerto tampoco cae dentro de ninguna. No mirar más lejos es una "
        "decisión nuestra, no una ausencia de la fuente."
    )


def _decima_hacia_arriba(kilometros: float) -> float:
    """La distancia publicada, redondeada **hacia arriba** a la décima y no a la más cercana.

    La página escribe «a menos de N km» a partir de esta cifra, así que el redondeo tiene que
    empujar hacia el lado en el que esa frase sigue siendo verdad. Cuesta como mucho 99 m de
    exageración, y es lo único que queda —ahora sí gratis— de la vieja regla de «aleja, nunca
    acerca» que la cota por vértice pagaba perdiendo relaciones enteras.
    """
    factor = 10**DECIMALES_KM
    return math.ceil(kilometros * factor) / factor


def _area_a_json(vecina: Vecindad) -> dict[str, Any]:
    return {
        "nombre": vecina.area.nombre,
        "tipo": vecina.area.tipo,
        "codigo": vecina.area.codigo,
        "distanciaAproxKm": _decima_hacia_arriba(vecina.distancia_km),
        "dentro": vecina.dentro,
    }


def construir_dataset(
    catalogo: dict[str, Any],
    areas: tuple[rampe.Area, ...],
    *,
    descargado_en: dt.date,
    sha256: str,
    radio_km: float = RADIO_KM,
) -> dict[str, Any]:
    """El documento ``areas-protegidas/v1`` completo, listo para escribirse."""
    indexadas = indexar(areas)
    puertos = []
    for puerto in catalogo["ports"]:
        vecinas = vecindad_de(puerto["lat"], puerto["lon"], indexadas, radio_km=radio_km)
        puertos.append(
            {
                "slug": puerto["slug"],
                "areas": [_area_a_json(vecina) for vecina in vecinas],
                "motivo": None if vecinas else _sin_areas(radio_km),
            }
        )
    return {
        "schema": SCHEMA,
        "fuente": {
            "nombre": "RAMPE 2025 · Red de Áreas Marinas Protegidas de España",
            "organismo": "Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO)",
            "url": rampe.URL,
            "paginaUrl": LICENCIA_URL,
            "licencia": LICENCIA,
            "aviso": AVISO,
            "descargadoEn": descargado_en.isoformat(),
            "sha256": sha256,
            "censo": _censo(areas),
        },
        "criterio": {
            "radioKm": radio_km,
            "distancia": (
                "distancia al BORDE del área —punto a segmento sobre cada arista del polígono—, "
                f"redondeada hacia arriba a {DECIMALES_KM} decimal de kilómetro. Es aproximada: se "
                "mide sobre una esfera y no sobre el elipsoide, y la arista se toma como arco de "
                "círculo máximo cuando en origen es una recta en un plano UTM. No debe presentarse "
                "como una medida."
            ),
            "dentro": (
                "true si el punto del puerto cae dentro del polígono del área, huecos excluidos. "
                "Responde lo que ninguna distancia responde —de qué lado del borde está el "
                "puerto— y cubre el caso del puerto muy metido en un área muy grande, cuyo borde "
                "quedaría más allá del radio."
            ),
            "sinGeometria": (
                "este dataset no publica geometría de ninguna clase. Ni vértices, ni polígonos, ni "
                "cajas envolventes, ni geometría simplificada."
            ),
        },
        "comparativa": comparativa_de(catalogo, indexadas, areas, radio_km=radio_km),
        "resumen": resumen_de(puertos),
        "puertos": puertos,
    }


def _censo(areas: tuple[rampe.Area, ...]) -> dict[str, Any]:
    """Lo que traía la fuente el día de la ingesta. Es el rastro que permite auditar el derivado."""
    return {
        "areas": len(areas),
        # `verticesEnOrigen` y no `vertices`: es un **recuento** de la fuente, no una lista de
        # vértices, y el gate P2 prohíbe la clave `vertices` sin excepciones. Antes que abrirle una
        # excepción al gate se le cambia el nombre al campo, que además así dice lo que es.
        "verticesEnOrigen": sum(area.vertices for area in areas),
        "porFichero": {
            fichero: sum(1 for area in areas if area.fichero == fichero)
            for fichero in sorted({area.fichero for area in areas})
        },
        "porEpsg": {
            str(epsg): sum(1 for area in areas if area.epsg == epsg)
            for epsg in sorted({area.epsg for area in areas})
        },
        "porTipo": dict(sorted(Counter(area.tipo for area in areas).items())),
    }


def resumen_de(puertos: list[dict[str, Any]]) -> dict[str, Any]:
    """El resumen, **derivado del contenido** y nunca escrito a mano.

    Que se calcule aquí es lo que permite al gate recalcularlo y compararlo: un resumen tecleado se
    queda viejo en silencio y es entonces la parte del fichero en la que más se confía y menos se
    puede confiar.
    """
    con_area = [puerto for puerto in puertos if puerto["areas"]]
    reparto = Counter(len(puerto["areas"]) for puerto in con_area)
    return {
        "puertos": len(puertos),
        "conArea": len(con_area),
        "sinArea": len(puertos) - len(con_area),
        "relaciones": sum(len(puerto["areas"]) for puerto in puertos),
        "reparto": {str(cuantas): reparto[cuantas] for cuantas in sorted(reparto)},
    }


def volcar(dataset: dict[str, Any], destino: Path = DATASET) -> None:
    """Escribe el dataset con el mismo formato que el resto de datos del repositorio."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cargar(origen: Path = DATASET) -> dict[str, Any]:
    """Lee el dataset publicado."""
    return json.loads(origen.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------------------------
# P2 · la geometría no cruza
# --------------------------------------------------------------------------------------------

#: Claves que un derivado sin geometría no puede tener. La lista es en minúsculas y se compara sin
#: acentos ni mayúsculas: lo que se persigue es el concepto, no la ortografía de quien lo escriba.
CLAVES_PROHIBIDAS: frozenset[str] = frozenset(
    {
        "coordinates",
        "coordenadas",
        "geometry",
        "geometria",
        "poligono",
        "poligonos",
        "polygon",
        "polygons",
        "anillo",
        "anillos",
        "ring",
        "rings",
        "vertice",
        "vertices",
        "bbox",
        "caja",
        "geojson",
        "wkt",
        "shape",
        "outline",
        "path",
        "points",
        "puntos",
    }
)

#: Tope de bytes del documento entero y de la parte de un puerto. Se mide sobre la serialización
#: **compacta**, no sobre el fichero en disco, para que reformatear el JSON no mueva el límite.
#:
#: Medido sobre el dataset publicado: los 153 puertos y las 348 relaciones ocupan 58.445 bytes
#: compactos (87.854 en disco, con sangrado) y el puerto más gordo —Garachico, con seis áreas—
#: ocupa 849. Los topes dejan un factor de 2,1 y de 2,4: holgura para que la fuente crezca, y
#: ningún sitio donde quepa un anillo.
#:
#: El tope es la tercera regla de P2 y la que no se puede esquivar cambiándole el nombre a un campo:
#: las 86 áreas son 1.076.504 vértices y **no hay forma de que un polígono quepa en dos kilobytes**,
#: se llame como se llame la clave o venga codificado como venga. Las otras dos reglas dicen que no
#: hay geometría con esta forma; ésta dice que no hay sitio para ninguna.
TOPE_BYTES_FICHERO = 120_000
TOPE_BYTES_PUERTO = 2_000


def _normalizar(clave: str) -> str:
    tabla = str.maketrans("áéíóúü", "aeiouu")
    return clave.strip().lower().translate(tabla)


def _recorrer(nodo: Any, camino: str, fallos: list[str]) -> None:
    if isinstance(nodo, dict):
        for clave, valor in nodo.items():
            if _normalizar(str(clave)) in CLAVES_PROHIBIDAS:
                fallos.append(
                    f"{camino}.{clave}: es una clave de geometría y este dataset no publica "
                    "geometría (ver `criterio.sinGeometria`)"
                )
            _recorrer(valor, f"{camino}.{clave}", fallos)
    elif isinstance(nodo, list):
        numeros = [x for x in nodo if isinstance(x, int | float) and not isinstance(x, bool)]
        if numeros:
            fallos.append(
                f"{camino}: es una lista con {len(numeros)} número(s) sueltos. Un anillo, una "
                "coordenada y una caja envolvente son exactamente eso, así que aquí no hay ninguna "
                "lista de números: los recuentos van como campos con nombre"
            )
        for indice, valor in enumerate(nodo):
            _recorrer(valor, f"{camino}[{indice}]", fallos)


def errores_de_geometria(dataset: dict[str, Any]) -> list[str]:
    """Gate P2: en el artefacto publicado no hay ni un vértice. Tres reglas y ninguna sobra.

    * **Por nombre** — ninguna clave del vocabulario de la geometría. Caza lo evidente y lo dice
      claro, que es lo que hace útil un mensaje de gate.
    * **Por forma** — ninguna lista de números en todo el documento. Caza el vértice que entra con
      un nombre inocente, que es como entraría de verdad.
    * **Por tamaño** — el fichero y la parte de cada puerto tienen tope. Es la única de las tres que
      no depende de cómo se llame ni de qué forma tenga lo que se cuele: en dos kilobytes no cabe un
      polígono, venga como venga.

    Se mide sobre el **documento cargado del disco**, no sobre lo que este módulo pensaba escribir.
    """
    fallos: list[str] = []
    _recorrer(dataset, "$", fallos)
    bytes_totales = len(json.dumps(dataset, ensure_ascii=False).encode())
    if bytes_totales > TOPE_BYTES_FICHERO:
        fallos.append(
            f"el dataset ocupa {bytes_totales} bytes y el tope es {TOPE_BYTES_FICHERO}: algo ha "
            "engordado mucho y la primera sospecha es geometría"
        )
    for puerto in dataset.get("puertos", []):
        ocupa = len(json.dumps(puerto, ensure_ascii=False).encode())
        if ocupa > TOPE_BYTES_PUERTO:
            fallos.append(
                f"el puerto {puerto.get('slug')!r} ocupa {ocupa} bytes y el tope por puerto es "
                f"{TOPE_BYTES_PUERTO}"
            )
    return fallos


# --------------------------------------------------------------------------------------------
# Coherencia del derivado: que el resumen no pueda mentir y que no falte ningún puerto
# --------------------------------------------------------------------------------------------


def errores_de_cobertura(dataset: dict[str, Any], catalogo: dict[str, Any]) -> list[str]:
    """Están **todos** los puertos, una vez cada uno, y el resumen dice lo que hay.

    Los puertos sin ninguna área son el motivo de que esto exista: son los que se caerían del
    fichero sin que nada se pusiera rojo, y entonces su página no podría decir «ninguna a menos de
    30 km» —que es un dato— y se limitaría a no decir nada, que se lee como otra cosa.
    """
    fallos: list[str] = []
    if dataset.get("schema") != SCHEMA:
        fallos.append(f"el dataset declara schema {dataset.get('schema')!r} y se esperaba {SCHEMA!r}")
    for campo in ("nombre", "organismo", "url", "licencia", "aviso", "descargadoEn", "sha256"):
        if not dataset.get("fuente", {}).get(campo):
            fallos.append(f"fuente: no declara {campo}")
    esperados = [puerto["slug"] for puerto in catalogo["ports"]]
    publicados = [puerto["slug"] for puerto in dataset.get("puertos", [])]
    for falta in sorted(set(esperados) - set(publicados)):
        fallos.append(
            f"el puerto {falta!r} está en el catálogo y no en el dataset: su página no podría decir "
            "ni que no hay áreas cerca"
        )
    for sobra in sorted(set(publicados) - set(esperados)):
        fallos.append(f"el dataset publica {sobra!r}, que no está en el catálogo")
    repetidos = sorted({slug for slug in publicados if publicados.count(slug) > 1})
    if repetidos:
        fallos.append(f"el dataset repite los puertos {', '.join(repetidos)}")
    for puerto in dataset.get("puertos", []):
        tiene_areas = bool(puerto.get("areas"))
        motivo = puerto.get("motivo")
        if not tiene_areas and not motivo:
            fallos.append(
                f"el puerto {puerto.get('slug')!r} no tiene áreas y tampoco dice por qué: una lista "
                "vacía sin motivo no se puede publicar como «ninguna a menos de 30 km»"
            )
        if tiene_areas and motivo:
            fallos.append(f"el puerto {puerto.get('slug')!r} tiene áreas y además un motivo de vacío")
        for area in puerto.get("areas", []):
            for campo in ("nombre", "tipo", "codigo", "distanciaAproxKm", "dentro"):
                if area.get(campo) is None:
                    fallos.append(f"{puerto.get('slug')}/{area.get('nombre')}: no declara {campo}")
            distancia = area.get("distanciaAproxKm")
            radio = dataset.get("criterio", {}).get("radioKm", RADIO_KM)
            if isinstance(distancia, int | float) and distancia > radio and not area.get("dentro"):
                fallos.append(
                    f"{puerto.get('slug')}/{area.get('nombre')}: está a {distancia} km, más del "
                    f"radio declarado de {radio} km, y el puerto no cae dentro"
                )
    recalculado = resumen_de(dataset.get("puertos", []))
    if dataset.get("resumen") != recalculado:
        fallos.append(
            f"el resumen publicado dice {dataset.get('resumen')} y el contenido dice {recalculado}"
        )
    return fallos
