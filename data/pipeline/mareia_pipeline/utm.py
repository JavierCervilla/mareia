"""De coordenadas UTM en metros a latitud y longitud, con sólo la biblioteca estándar.

Existe porque los GeoJSON de RAMPE **no son GeoJSON estándar**: declaran un CRS proyectado en
``crs.properties.name`` y sus coordenadas son metros, no grados. El RFC 7946 dice que un GeoJSON es
longitud/latitud en WGS84 y no admite otro CRS, así que cualquier lector que los trate como GeoJSON
estándar leerá metros como grados **en silencio y sin error**: un puerto y un área a setecientos
kilómetros de distancia aparente pasarían por vecinos.

``requirements.txt`` declara la política de la casa —«todo lo demás sale de la biblioteca estándar a
propósito: menos superficie que fijar y menos que pueda romperse dentro de un año»— y el pipeline no
tiene ``pyproj``, ``shapely`` ni ``geopandas``. Traer una dependencia nativa con los datos de PROJ
por dos inversiones de UTM sería caro, así que se escribe aquí la inversa de la transversa de
Mercator (series de Krüger, orden 3) y se paga el coste de mantenerla con el gate P1, que es lo que
la ata a la realidad: ``errores_de_reproyeccion`` la mide contra cuatro cosas distintas, y una de
ellas —el arco de meridiano por cuadratura numérica— **no comparte una línea de código con la
serie**, que es lo que hace que sea una comprobación y no un eco.

El modo de fallo que todo este módulo existe para impedir no es que la reproyección **falle**: es
que **acierte a producir basura**. Una zona equivocada no levanta ninguna excepción; devuelve una
coordenada perfectamente formada a mil kilómetros de donde está el sitio. Por eso no hay zona por
defecto en ninguna parte: ``proyeccion_de_urn`` aborta cuando no reconoce el EPSG.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

from mareia_pipeline.geo import haversine_km

#: Factor de escala en el meridiano central. Lo fija la definición de UTM, no nosotros.
K0 = 0.9996

#: Falso este de UTM, en metros: mueve el meridiano central a x = 500 km para que no haya negativos.
FALSO_ESTE = 500_000.0

#: Falso norte en el hemisferio norte. Toda la costa española está aquí; el hemisferio sur tendría
#: 10.000.000 y **no se implementa** porque no hay ningún dato nuestro que lo necesite: una rama sin
#: dato que la ejercite es una rama sin probar.
FALSO_NORTE = 0.0


class ErrorCrs(ValueError):
    """El fichero declara un CRS que este módulo no sabe reproyectar, así que no se publica nada.

    Es la única salida posible, y es deliberado que no haya ninguna otra: caer hacia atrás a una
    zona por defecto reproyectaría con la zona equivocada, que no da error y coloca las áreas
    canarias a más de mil kilómetros de Canarias.
    """


@dataclass(frozen=True)
class Elipsoide:
    """Elipsoide de referencia: semieje mayor en metros y aplanamiento."""

    nombre: str
    a: float
    f: float

    @property
    def n(self) -> float:
        """Tercer aplanamiento ``n = f / (2 − f)``, que es el parámetro de las series de Krüger."""
        return self.f / (2 - self.f)

    @property
    def e2(self) -> float:
        """Primera excentricidad al cuadrado."""
        return self.f * (2 - self.f)


#: Los dos elipsoides que hacen falta. Se distinguen aunque la diferencia entre ellos sea de menos
#: de un milímetro sobre el terreno (el aplanamiento difiere en la doceava cifra): copiar uno en el
#: otro sería gratis hoy y una suposición sin motivo mañana, y el coste de tenerlos separados es
#: esta línea.
GRS80 = Elipsoide("GRS80", 6_378_137.0, 1 / 298.257222101)
WGS84 = Elipsoide("WGS84", 6_378_137.0, 1 / 298.257223563)


@dataclass(frozen=True)
class Proyeccion:
    """Una zona UTM concreta sobre un elipsoide concreto, identificada por su código EPSG."""

    epsg: int
    nombre: str
    zona: int
    elipsoide: Elipsoide

    @property
    def meridiano_central(self) -> float:
        """Longitud del meridiano central de la zona, en grados."""
        return self.zona * 6 - 183


#: **Mapa cerrado a propósito.** Sólo están los dos EPSG que declaran los ficheros de RAMPE, medidos
#: el 2026-08-30. Añadir una zona es una decisión con nombre y apellidos —hay que saber qué dato la
#: necesita y con qué elipsoide—, no algo que deba ocurrir por inercia al aparecer un fichero nuevo.
PROYECCIONES: dict[int, Proyeccion] = {
    25830: Proyeccion(25830, "ETRS89 / UTM zona 30N", 30, GRS80),
    32628: Proyeccion(32628, "WGS 84 / UTM zona 28N", 28, WGS84),
}

#: Las dos formas en las que un GeoJSON escribe un CRS por su código EPSG: la URN de OGC —con o sin
#: versión del registro en medio, que las dos son legales— y la forma corta.
#:
#: Es tolerante con el **formato** y estricta con el **código**, y el reparto es intencionado: que
#: MITECO escriba mañana ``urn:ogc:def:crs:EPSG:9.1:25830`` es una variante de la misma zona que ya
#: sabemos reproyectar y ponerse rojo por eso sería un falso rojo; que escriba un código que no está
#: en ``PROYECCIONES`` es exactamente lo que hay que parar.
_URN_EPSG = re.compile(r"^(?:urn:ogc:def:crs:EPSG:[^:]*:|EPSG:)(\d+)$", re.IGNORECASE)


def proyeccion_de_urn(urn: str) -> Proyeccion:
    """``urn:ogc:def:crs:EPSG::25830`` → la proyección correspondiente, o aborta.

    Aborta en los dos casos, y los distingue en el mensaje porque son averías distintas: una cadena
    que no sabemos ni leer (la fuente cambió de forma) y un código que sabemos leer pero no
    reproyectar (la fuente añadió una zona nueva).
    """
    casa = _URN_EPSG.match(urn.strip())
    if not casa:
        raise ErrorCrs(
            f"no se reconoce {urn!r} como un CRS por código EPSG. No se reproyecta a ojo: las "
            "coordenadas están en metros y suponer la zona coloca el área donde no está, sin dar "
            "ningún error."
        )
    codigo = int(casa.group(1))
    if codigo not in PROYECCIONES:
        conocidos = ", ".join(f"EPSG:{c}" for c in sorted(PROYECCIONES))
        raise ErrorCrs(
            f"EPSG:{codigo} no está entre los que este pipeline sabe reproyectar ({conocidos}). "
            "No hay zona por defecto: reproyectar con la zona equivocada no falla, acierta a "
            "producir una coordenada bien formada a cientos de kilómetros de su sitio."
        )
    return PROYECCIONES[codigo]


def _beta(n: float) -> tuple[float, float, float]:
    """Coeficientes β de la serie inversa de Krüger, hasta n³."""
    return (
        n / 2 - 2 * n**2 / 3 + 37 * n**3 / 96,
        n**2 / 48 + n**3 / 15,
        17 * n**3 / 480,
    )


def _delta(n: float) -> tuple[float, float, float]:
    """Coeficientes δ que llevan de la latitud conforme a la geodésica, hasta n³."""
    return (
        2 * n - 2 * n**2 / 3 - 2 * n**3,
        7 * n**2 / 3 - 8 * n**3 / 5,
        56 * n**3 / 15,
    )


def _radio_rectificante(elipsoide: Elipsoide) -> float:
    """Radio de la esfera rectificante ``A``: el que da al meridiano su longitud verdadera."""
    n = elipsoide.n
    return elipsoide.a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)


def a_geograficas(este: float, norte: float, proyeccion: Proyeccion) -> tuple[float, float]:
    """``(este, norte)`` en metros → ``(lat, lon)`` en grados decimales.

    Inversa de la transversa de Mercator por series de Krüger a orden 3 en el tercer aplanamiento.
    El orden 3 basta y sobra para lo que publicamos —el gate P1 lo mide en menos de un milímetro
    sobre el meridiano central, y las distancias que este pipeline publica van redondeadas a la
    décima de kilómetro—, así que subir de orden sería precisión que nadie lee a cambio de código
    que hay que mantener.
    """
    n = proyeccion.elipsoide.n
    radio = _radio_rectificante(proyeccion.elipsoide)
    xi = (norte - FALSO_NORTE) / (K0 * radio)
    eta = (este - FALSO_ESTE) / (K0 * radio)
    beta = _beta(n)
    xi_prima = xi - sum(
        b * math.sin(2 * (j + 1) * xi) * math.cosh(2 * (j + 1) * eta) for j, b in enumerate(beta)
    )
    eta_prima = eta - sum(
        b * math.cos(2 * (j + 1) * xi) * math.sinh(2 * (j + 1) * eta) for j, b in enumerate(beta)
    )
    # Latitud conforme; de ahí a la geodésica con la serie δ.
    chi = math.asin(math.sin(xi_prima) / math.cosh(eta_prima))
    latitud = chi + sum(d * math.sin(2 * (j + 1) * chi) for j, d in enumerate(_delta(n)))
    longitud = math.radians(proyeccion.meridiano_central) + math.atan2(
        math.sinh(eta_prima), math.cos(xi_prima)
    )
    return math.degrees(latitud), math.degrees(longitud)


# --------------------------------------------------------------------------------------------
# P1 · la reproyección está atada a algo que no es ella misma
# --------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Ancla:
    """Un punto proyectado del que sabemos, por una fuente ajena a este código, dónde cae.

    La referencia es la coordenada del **puerto homónimo** del catálogo público, que sale de
    GeoNames: una fuente que no tiene nada que ver ni con RAMPE ni con este módulo. Por eso el ancla
    mide en kilómetros y no en milímetros —un puerto no está en el mismo punto que el borde de su
    reserva— y por eso vale para lo que tiene que valer: cazar la **zona equivocada**, cuyo error no
    es de kilómetros sino de centenares.
    """

    sitio: str
    este: float
    norte: float
    epsg: int
    puerto: str
    lat_referencia: float
    lon_referencia: float
    #: Distancia medida el 2026-08-30 entre el punto reproyectado y el puerto de referencia.
    distancia_medida_km: float


#: Tolerancia del ancla geográfica, en kilómetros, y por qué es ésta y no otra.
#:
#: Medido el 2026-08-30 con la zona **correcta**: Cabo de Palos cae a 7,96 km de su puerto y El
#: Hierro a 17,9 km del suyo. Medido con la zona **equivocada**, el mismo par de puntos cae a 520,8
#: km (zona 29), 535,6 km (zona 31) y 1.048,4 km (zona 28) en el caso peninsular, y a 578,4 km (zona
#: 29) y 1.168,7 km (zona 30) en el canario.
#:
#: 25 km deja un factor de 1,4 sobre lo peor que medimos como correcto y un factor de 20 por debajo
#: de lo mejor que medimos como catastrófico. El gate vive en ese hueco de casi dos órdenes de
#: magnitud, que es lo que lo hace un gate y no una superstición: ninguna de las dos partes está
#: cerca de la línea.
TOLERANCIA_ANCLA_KM = 25.0

#: Tolerancia del arco de meridiano, en grados. La cuadratura de Simpson del arco meridiano es un
#: cálculo que no comparte nada con la serie de Krüger, así que la discrepancia entre las dos es la
#: medida honesta del error de la serie. Medido entre 0° y 80° cada 5°, en los dos elipsoides: 6,4 ×
#: 10⁻⁹ ° en el peor punto, o sea **0,7 mm**. 10⁻⁸ ° (≈ 1,1 mm) deja margen para la propia
#: cuadratura sin dejar sitio para nada que pudiera mover una distancia publicada, que va redondeada
#: a la décima de kilómetro: hay ocho órdenes de magnitud entre este gate y lo que se lee.
TOLERANCIA_MERIDIANO_GRADOS = 1e-8

#: Tolerancia de las invariantes exactas, en grados. No son aproximaciones: sobre el meridiano
#: central la longitud **es** la del meridiano central, y en el ecuador la latitud **es** cero. Lo
#: único que separa el resultado del valor exacto es el redondeo del flotante, y medido sale 4,4 ×
#: 10⁻¹⁶ °. 10⁻¹² ° es tres órdenes por encima del ruido y sigue siendo un micrómetro.
TOLERANCIA_INVARIANTE_GRADOS = 1e-12

#: Tolerancia relativa del factor de escala. La comprobación compara la derivada de la longitud
#: respecto al este —tomada como diferencia finita sobre una cuerda de 2 km— contra el valor cerrado
#: que impone la definición de UTM (escala k0 sobre el meridiano central). El error de truncamiento
#: de la diferencia finita es de orden (1 km / ν)² ≈ 2,4 × 10⁻⁸, y medido sale 1,1 × 10⁻⁸: la
#: tolerancia de 10⁻⁷ acota el truncamiento, no la serie.
TOLERANCIA_ESCALA_RELATIVA = 1e-7

#: Los dos puntos que la trayectoria midió contra la fuente real, cada uno en su zona. Son las
#: primeras coordenadas de la primera *feature* de cada fichero de RAMPE 2025, y su referencia es el
#: puerto del catálogo público que da nombre al sitio.
ANCLAS: tuple[Ancla, ...] = (
    Ancla(
        sitio="Reserva marina de Cabo de Palos e Islas Hormigas",
        este=710636.3039999995,
        norte=4170823.772,
        epsg=25830,
        puerto="cabo-de-palos",
        lat_referencia=37.6338,
        lon_referencia=-0.696,
        distancia_medida_km=7.96,
    ),
    Ancla(
        sitio="Espacio marino de la zona occidental de El Hierro",
        este=193847.20639999956,
        norte=3074113.499399999,
        epsg=32628,
        puerto="el-pinar-de-el-hierro",
        lat_referencia=27.6399,
        lon_referencia=-17.9804,
        distancia_medida_km=17.93,
    ),
)


def _arco_de_meridiano(latitud: float, elipsoide: Elipsoide, *, pasos: int = 2000) -> float:
    """Distancia del ecuador a ``latitud`` sobre el meridiano, por cuadratura de Simpson.

    **No comparte una línea con la serie de Krüger, y ése es todo el motivo por el que existe.** Es
    la integral del radio de curvatura meridiano, calculada punto a punto: si la serie estuviera mal
    truncada, o un coeficiente tuviera un signo cambiado, esto no lo repetiría, lo desmentiría. Una
    comprobación que reusara la misma serie sólo diría que la serie es igual a sí misma.
    """
    e2 = elipsoide.e2

    def radio(t: float) -> float:
        return elipsoide.a * (1 - e2) / (1 - e2 * math.sin(t) ** 2) ** 1.5

    if latitud == 0:
        return 0.0
    h = latitud / pasos
    total = radio(0.0) + radio(latitud)
    for i in range(1, pasos):
        total += (4 if i % 2 else 2) * radio(i * h)
    return total * h / 3


def _errores_de_meridiano() -> list[str]:
    """La latitud sobre el meridiano central coincide con la que dice el arco meridiano."""
    fallos: list[str] = []
    for proyeccion in PROYECCIONES.values():
        for grados in range(0, 81, 5):
            norte = K0 * _arco_de_meridiano(math.radians(grados), proyeccion.elipsoide)
            latitud, _ = a_geograficas(FALSO_ESTE, norte, proyeccion)
            desvio = abs(latitud - grados)
            if desvio > TOLERANCIA_MERIDIANO_GRADOS:
                fallos.append(
                    f"EPSG:{proyeccion.epsg}: a {grados}° sobre el meridiano central la inversa "
                    f"devuelve {latitud:.9f}°, que se desvía {desvio:.2e}° del arco de meridiano "
                    f"calculado por cuadratura (tolerancia {TOLERANCIA_MERIDIANO_GRADOS:.0e}°)"
                )
    return fallos


def _errores_de_invariantes() -> list[str]:
    """Las tres igualdades que la definición de UTM hace exactas, comprobadas como exactas."""
    fallos: list[str] = []
    for proyeccion in PROYECCIONES.values():
        etiqueta = f"EPSG:{proyeccion.epsg}"
        # 1 · El falso este es el meridiano central, a cualquier altura.
        for norte in (0.0, 3_000_000.0, 4_400_000.0, 8_000_000.0):
            _, longitud = a_geograficas(FALSO_ESTE, norte, proyeccion)
            desvio = abs(longitud - proyeccion.meridiano_central)
            if desvio > TOLERANCIA_INVARIANTE_GRADOS:
                fallos.append(
                    f"{etiqueta}: en el falso este y norte {norte:.0f} la longitud sale "
                    f"{longitud:.12f}° y el meridiano central es {proyeccion.meridiano_central}° "
                    f"(desvío {desvio:.2e}°)"
                )
        # 2 · El origen de la zona es el ecuador.
        latitud, _ = a_geograficas(FALSO_ESTE, FALSO_NORTE, proyeccion)
        if abs(latitud) > TOLERANCIA_INVARIANTE_GRADOS:
            fallos.append(f"{etiqueta}: el origen de la zona sale a latitud {latitud:.12f}° y no 0°")
        # 3 · La proyección es simétrica respecto al meridiano central. Caza un signo cambiado en
        # la serie, que es el fallo que las dos comprobaciones anteriores no pueden ver porque las
        # dos viven justo encima del meridiano central.
        for desplazamiento in (50_000.0, 200_000.0):
            lat_oeste, lon_oeste = a_geograficas(
                FALSO_ESTE - desplazamiento, 4_400_000.0, proyeccion
            )
            lat_este, lon_este = a_geograficas(FALSO_ESTE + desplazamiento, 4_400_000.0, proyeccion)
            centro = (lon_oeste + lon_este) / 2
            if abs(lat_oeste - lat_este) > TOLERANCIA_INVARIANTE_GRADOS:
                fallos.append(
                    f"{etiqueta}: a ±{desplazamiento:.0f} m del meridiano central las latitudes "
                    f"salen {lat_oeste:.12f}° y {lat_este:.12f}°, y la proyección es simétrica"
                )
            if abs(centro - proyeccion.meridiano_central) > TOLERANCIA_INVARIANTE_GRADOS:
                fallos.append(
                    f"{etiqueta}: a ±{desplazamiento:.0f} m del meridiano central las longitudes "
                    f"({lon_oeste:.12f}°, {lon_este:.12f}°) no salen centradas en "
                    f"{proyeccion.meridiano_central}°"
                )
    return fallos


def _errores_de_escala() -> list[str]:
    """Sobre el meridiano central la escala es ``k0``, y eso fija cuánto vale un metro en longitud.

    Es la comprobación que ata la **longitud**, que es la mitad que el arco de meridiano no toca. El
    valor esperado sale de la geometría del elipsoide (el radio del primer vertical por el coseno de
    la latitud), no de la serie.
    """
    fallos: list[str] = []
    cuerda = 1_000.0
    for proyeccion in PROYECCIONES.values():
        elipsoide = proyeccion.elipsoide
        for grados in (25, 30, 37, 43):
            latitud = math.radians(grados)
            norte = K0 * _arco_de_meridiano(latitud, elipsoide)
            _, lon_oeste = a_geograficas(FALSO_ESTE - cuerda, norte, proyeccion)
            _, lon_este = a_geograficas(FALSO_ESTE + cuerda, norte, proyeccion)
            radio_primer_vertical = elipsoide.a / math.sqrt(1 - elipsoide.e2 * math.sin(latitud) ** 2)
            esperado = 2 * cuerda / (K0 * radio_primer_vertical * math.cos(latitud))
            obtenido = math.radians(lon_este - lon_oeste)
            desvio = abs(obtenido / esperado - 1)
            if desvio > TOLERANCIA_ESCALA_RELATIVA:
                fallos.append(
                    f"EPSG:{proyeccion.epsg}: a {grados}° la escala sobre el meridiano central se "
                    f"desvía {desvio:.2e} de k0={K0} (tolerancia "
                    f"{TOLERANCIA_ESCALA_RELATIVA:.0e})"
                )
    return fallos


def _errores_de_anclas() -> list[str]:
    """Los puntos de referencia caen donde el mapa dice que están."""
    fallos: list[str] = []
    for ancla in ANCLAS:
        latitud, longitud = a_geograficas(ancla.este, ancla.norte, PROYECCIONES[ancla.epsg])
        distancia = haversine_km(latitud, longitud, ancla.lat_referencia, ancla.lon_referencia)
        if distancia > TOLERANCIA_ANCLA_KM:
            fallos.append(
                f"«{ancla.sitio}» reproyectado con EPSG:{ancla.epsg} cae en "
                f"{latitud:.4f}, {longitud:.4f}, a {distancia:.1f} km del puerto de "
                f"{ancla.puerto} (tolerancia {TOLERANCIA_ANCLA_KM:.0f} km; medido "
                f"{ancla.distancia_medida_km} km). Con la zona equivocada el error es de cientos "
                "de kilómetros: comprueba qué EPSG se está usando antes que la tolerancia."
            )
    return fallos


def errores_de_reproyeccion() -> list[str]:
    """Gate P1: la inversa de Krüger sigue cayendo donde debe. Offline y determinista.

    Cuatro capas, y son cuatro porque cada una ata algo que las otras no pueden:

    * **Arco de meridiano** — la latitud, contra una cuadratura numérica que no comparte código con
      la serie. Es la única capa que puede desmentir a la serie en vez de repetirla.
    * **Invariantes** — las tres igualdades exactas de UTM (meridiano central, ecuador, simetría).
      Cazan un coeficiente con el signo cambiado, que el arco de meridiano no ve porque vive justo
      encima del meridiano central.
    * **Escala** — la longitud, contra el radio del primer vertical. Es la mitad que el arco de
      meridiano deja fuera.
    * **Anclas geográficas** — dos puntos reales de RAMPE contra la coordenada de su puerto en el
      catálogo público, que viene de GeoNames. Miden en kilómetros, y es lo que se quiere: son las
      que cazan la **zona equivocada**, que es el fallo que no da ningún error y publica basura con
      aspecto de coordenada.
    """
    return [
        *_errores_de_meridiano(),
        *_errores_de_invariantes(),
        *_errores_de_escala(),
        *_errores_de_anclas(),
    ]
