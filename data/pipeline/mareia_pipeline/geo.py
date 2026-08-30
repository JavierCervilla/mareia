"""Distancias geográficas: punto a punto y punto a arista, sobre la misma esfera.

Las dos familias viven en el mismo fichero **porque tienen que compartir el radio**. En cuanto una
distancia al vértice y una distancia al borde se comparan entre sí —y en ``areas`` se comparan, es
un gate—, medirlas sobre esferas distintas convertiría la diferencia entre las dos métricas en la
diferencia entre dos radios copiados a mano.
"""

from __future__ import annotations

import math

_EARTH_RADIUS_KM = 6371.0088

#: Un punto de la esfera como vector unitario ``(x, y, z)``.
Unitario = tuple[float, float, float]


def haversine_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    """Distancia de círculo máximo entre dos puntos, en kilómetros."""
    phi_a, phi_b = math.radians(lat_a), math.radians(lat_b)
    delta_phi = math.radians(lat_b - lat_a)
    delta_lambda = math.radians(lon_b - lon_a)
    inner = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(inner))


def unitario(latitud: float, longitud: float) -> Unitario:
    """``(lat, lon)`` en grados → el vector unitario que apunta a ese sitio.

    La API de aquí abajo trabaja con vectores y no con grados, y no es gratuito: se llama **una vez
    por arista** sobre el millón de aristas de RAMPE, y cada vértice es el final de una arista y el
    principio de la siguiente. Pasando grados, los tres senos y cosenos de cada vértice se
    calcularían dos veces.
    """
    fi = math.radians(latitud)
    lam = math.radians(longitud)
    coseno = math.cos(fi)
    return (coseno * math.cos(lam), coseno * math.sin(lam), math.sin(fi))


def _producto_escalar(u: Unitario, v: Unitario) -> float:
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]


def _producto_vectorial(u: Unitario, v: Unitario) -> Unitario:
    return (
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    )


def _norma(u: Unitario) -> float:
    return math.sqrt(u[0] ** 2 + u[1] ** 2 + u[2] ** 2)


def distancia_entre_unitarios_km(u: Unitario, v: Unitario) -> float:
    """Lo mismo que ``haversine_km``, con los puntos ya en forma de vector.

    Se calcula con ``atan2(|u × v|, u · v)`` y no con ``acos(u · v)`` porque el arcocoseno pierde
    todas sus cifras cuando los dos puntos están cerca, que es justo el caso que aquí importa: dos
    vértices consecutivos de RAMPE están a dos metros el uno del otro.
    """
    return _EARTH_RADIUS_KM * math.atan2(
        _norma(_producto_vectorial(u, v)), _producto_escalar(u, v)
    )


def distancia_a_segmento_km(punto: Unitario, a: Unitario, b: Unitario) -> float:
    """Distancia del punto al **arco de círculo máximo** que va de ``a`` a ``b``, en kilómetros.

    Es la distancia punto-segmento de toda la vida, hecha sobre la esfera en vez de sobre el plano:
    el pie de la perpendicular es la proyección del punto sobre el plano del círculo máximo que pasa
    por ``a`` y ``b``, y la distancia al círculo entero es ``asin`` de la componente que se ha
    quitado. Si ese pie cae **fuera** del arco, el mínimo está en un extremo, así que se devuelve el
    más cercano de los dos.

    Que la arista se tome como arco de círculo máximo es una decisión con error, porque los datos de
    origen son **rectas en un plano UTM** y no arcos. El error está medido, y contra el modelo bueno:
    se densificaron las aristas de RAMPE 2025 **en metros UTM** —donde la fuente las define— antes de
    reproyectarlas, y frente a ese borde verdadero nuestro arco mueve la distancia como mucho
    **15,3 m**, en Pollença contra la arista de 159,6 km del Corredor de Cetáceos. Muy por debajo de
    la décima de kilómetro con la que se publica.

    El modelo esférico —el mismo de ``haversine_km``, que este pipeline ya usaba para todo— aporta
    su propio error frente a la geodésica del elipsoide, y es el mayor de los dos: entre 26° y 45° de
    latitud el radio de curvatura se aparta hasta un **0,37 %** del radio medio, o sea **110 m a
    30 km**. Es un error que este pipeline ya tenía en todas sus distancias, no uno que traiga la
    métrica nueva.
    """
    normal = _producto_vectorial(a, b)
    norma_normal = _norma(normal)
    extremo_mas_cercano = min(
        distancia_entre_unitarios_km(punto, a), distancia_entre_unitarios_km(punto, b)
    )
    if norma_normal == 0.0:
        # `a` y `b` son el mismo punto (o antípodas): no definen un arco, sólo un extremo.
        return extremo_mas_cercano
    seno_fuera = _producto_escalar(punto, normal) / norma_normal
    fuera: Unitario = (
        seno_fuera * normal[0] / norma_normal,
        seno_fuera * normal[1] / norma_normal,
        seno_fuera * normal[2] / norma_normal,
    )
    sin_normalizar: Unitario = (
        punto[0] - fuera[0],
        punto[1] - fuera[1],
        punto[2] - fuera[2],
    )
    norma_pie = _norma(sin_normalizar)
    if norma_pie == 0.0:
        # El punto es el polo del círculo máximo: está a 90° de todo él, extremos incluidos.
        return extremo_mas_cercano
    pie: Unitario = (
        sin_normalizar[0] / norma_pie,
        sin_normalizar[1] / norma_pie,
        sin_normalizar[2] / norma_pie,
    )
    # El pie cae dentro del arco si forma con los dos extremos un ángulo menor que el que forman
    # ellos entre sí. Con el coseno basta y así no hace falta ningún arcocoseno.
    coseno_arco = _producto_escalar(a, b)
    dentro_del_arco = (
        _producto_escalar(a, pie) >= coseno_arco and _producto_escalar(b, pie) >= coseno_arco
    )
    if not dentro_del_arco:
        return extremo_mas_cercano
    return _EARTH_RADIUS_KM * math.asin(min(1.0, abs(seno_fuera)))
