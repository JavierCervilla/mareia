"""Argumentos astronómicos y correcciones nodales de Schureman.

Implementa los seis argumentos fundamentales de la expansión de Doodson y las familias de factor
nodal ``f`` / ángulo nodal ``u`` de Schureman (1958, *Manual of Harmonic Analysis and Prediction of
Tides*), que son las que usa el análisis TICON-4 del que provienen nuestras constantes.

Referencia temporal: siglos julianos desde la época de Schureman (1899-12-31 12:00 UT).
"""

from __future__ import annotations

import datetime as dt
import math

import numpy as np

#: Época a la que están referidos los polinomios de longitudes medias usados abajo: 1900-01-01
#: 00:00 UT. (Ojo: NO es el "1900 enero 0.5" de mediodía; media jornada de diferencia desplaza la
#: longitud media de la Luna 6,6°, que son ~25 min de error en la pleamar.)
_EPOCH = dt.datetime(1900, 1, 1, 0, 0, 0, tzinfo=dt.timezone.utc)
_JULIAN_CENTURY_HOURS = 876600.0  # 36525 días × 24 h

#: Siglos julianos entre la época de arriba y J2000.0 (36524,5 días), para la oblicuidad.
_CENTURIES_EPOCH_TO_J2000 = 36524.5 / 36525.0

#: Inclinación de la órbita lunar sobre la eclíptica, en grados (constante).
_I_ORBIT_DEG = 5.145

#: Velocidades de los argumentos fundamentales (T, s, h, p, N', p1) en grados por hora solar media.
ARGUMENT_SPEEDS_DEG_PER_HOUR: tuple[float, float, float, float, float, float] = (
    15.0,
    0.5490165,
    0.0410686,
    0.0046418,
    0.0022064,
    0.0000020,
)


def hours_since_epoch(when: dt.datetime) -> float:
    """Horas transcurridas desde la época de Schureman (el instante debe ser consciente de zona)."""
    if when.tzinfo is None:
        raise ValueError("se requiere un datetime con zona horaria (usa UTC)")
    return (when.astimezone(dt.timezone.utc) - _EPOCH).total_seconds() / 3600.0


def fundamental_arguments(hours: np.ndarray | float) -> np.ndarray:
    """Argumentos ``(T, s, h, p, N', p1)`` en grados para las horas dadas desde la época.

    Devuelve un array de forma ``(6, n)``. ``T`` es el ángulo horario del sol medio en Greenwich
    (``15°·t + 180°``) y ``N'`` es el nodo ascendente con el signo invertido, que es el convenio en
    el que los coeficientes de Doodson del catálogo están escritos.
    """
    t = np.atleast_1d(np.asarray(hours, dtype=float))
    c = t / _JULIAN_CENTURY_HOURS  # siglos julianos

    solar_hour_angle = 15.0 * t + 180.0
    s = 277.0248 + 481267.8906 * c + 0.0020 * c**2 + 0.0000002 * c**3
    h = 280.1895 + 36000.7689 * c + 0.000303 * c**2
    p = 334.3853 + 4069.0340 * c - 0.010340 * c**2 - 0.0000122 * c**3
    node = 259.1568 - 1934.1420 * c + 0.002078 * c**2 + 0.0000022 * c**3
    p1 = 281.2208 + 1.7192 * c + 0.000453 * c**2 + 0.0000030 * c**3

    return np.vstack([solar_hour_angle, s, h, p, node * -1.0, p1])


def obliquity_deg(centuries_since_epoch: float) -> float:
    """Oblicuidad media de la eclíptica, en grados (IAU: 23,43929° − 0,0130042°/siglo desde J2000)."""
    return 23.43929 - 0.0130042 * (centuries_since_epoch - _CENTURIES_EPOCH_TO_J2000)


def _wrap180(degrees: float) -> float:
    """Normaliza un ángulo al intervalo (−180°, 180°]."""
    return (degrees + 180.0) % 360.0 - 180.0


def _inclination_deg(node_deg: float, omega_deg: float) -> float:
    """Inclinación ``I`` del plano orbital lunar sobre el ecuador terrestre."""
    node = math.radians(node_deg)
    omega = math.radians(omega_deg)
    i_orbit = math.radians(_I_ORBIT_DEG)
    cos_i = math.cos(i_orbit) * math.cos(omega) - math.sin(i_orbit) * math.sin(omega) * math.cos(
        node
    )
    return math.degrees(math.acos(cos_i))


def _xi_nu_deg(node_deg: float, omega_deg: float) -> tuple[float, float]:
    """Ángulos auxiliares ``ξ`` y ``ν`` de Schureman, en grados."""
    node = math.radians(node_deg)
    omega = math.radians(omega_deg)
    i_orbit = math.radians(_I_ORBIT_DEG)
    half_diff = 0.5 * (omega - i_orbit)
    half_sum = 0.5 * (omega + i_orbit)
    e1 = math.atan(math.cos(half_diff) / math.cos(half_sum) * math.tan(0.5 * node)) - 0.5 * node
    e2 = math.atan(math.sin(half_diff) / math.sin(half_sum) * math.tan(0.5 * node)) - 0.5 * node
    return _wrap180(math.degrees(-(e1 + e2))), _wrap180(math.degrees(e1 - e2))


class NodalState:
    """Estado nodal congelado en un instante: factores ``f`` y ángulos ``u`` por familia.

    Las correcciones nodales varían con el ciclo de 18,61 años del nodo lunar, así que para una
    ventana de predicción de días o semanas basta evaluarlas una vez en el centro de la ventana —
    que es exactamente lo que hacen los servicios hidrográficos.
    """

    def __init__(self, when: dt.datetime, perigee_deg: float | None = None) -> None:
        hours = hours_since_epoch(when)
        args = fundamental_arguments(hours)
        node_deg = -float(args[4, 0])
        self.node_deg = node_deg % 360.0
        perigee = float(args[3, 0]) if perigee_deg is None else perigee_deg
        omega_deg = obliquity_deg(hours / _JULIAN_CENTURY_HOURS)

        inclination = _inclination_deg(node_deg, omega_deg)
        xi_deg, nu_deg = _xi_nu_deg(node_deg, omega_deg)
        self.inclination_deg = inclination
        self.xi_deg = xi_deg
        self.nu_deg = nu_deg

        incl = math.radians(inclination)
        nu = math.radians(nu_deg)
        # P = p − ξ, el argumento del perigeo corregido, que gobierna M1 y L2.
        p_angle = math.radians(perigee - xi_deg)

        nu_prime_deg = math.degrees(
            math.atan2(math.sin(2 * incl) * math.sin(nu), math.sin(2 * incl) * math.cos(nu) + 0.3347)
        )
        nu_2prime_deg = 0.5 * math.degrees(
            math.atan2(
                math.sin(incl) ** 2 * math.sin(2 * nu),
                math.sin(incl) ** 2 * math.cos(2 * nu) + 0.0727,
            )
        )

        f_m2 = math.cos(0.5 * incl) ** 4 / 0.9154
        f_o1 = math.sin(incl) * math.cos(0.5 * incl) ** 2 / 0.3800
        tan_half_i = math.tan(0.5 * incl)
        # R de Schureman para L2. La raíz va en el numerador (f(L2) = f(M2)·R): medido contra
        # observaciones IOC en Brest y Vigo da f(L2) ≈ 1,38-1,46 frente a los 1,33 de esta fórmula
        # y los 0,71 de la lectura inversa, así que el signo del exponente queda zanjado por el dato.
        r_factor = math.sqrt(1 - 12 * tan_half_i**2 * math.cos(2 * p_angle) + 36 * tan_half_i**4)
        r_angle_deg = math.degrees(
            math.atan2(
                math.sin(2 * p_angle),
                (1.0 / 6.0) / tan_half_i**2 - math.cos(2 * p_angle),
            )
        )
        q_angle_deg = math.degrees(
            math.atan2(
                (5 * math.cos(incl) - 1) * math.sin(p_angle),
                (7 * math.cos(incl) + 1) * math.cos(p_angle),
            )
        )

        u_m2 = 2 * xi_deg - 2 * nu_deg
        self.f: dict[str, float] = {
            "unity": 1.0,
            "Mm": (2.0 / 3.0 - math.sin(incl) ** 2) / 0.5021,
            "Mf": math.sin(incl) ** 2 / 0.1578,
            "O1": f_o1,
            "J1": math.sin(2 * incl) / 0.7214,
            "OO1": math.sin(incl) * math.sin(0.5 * incl) ** 2 / 0.0164,
            "M1": f_o1 * math.sqrt(2.310 + 1.435 * math.cos(2 * p_angle)),
            "M2": f_m2,
            "M3": math.cos(0.5 * incl) ** 6 / 0.8758,
            "L2": f_m2 * r_factor,
            "K1": math.sqrt(
                0.8965 * math.sin(2 * incl) ** 2 + 0.6001 * math.sin(2 * incl) * math.cos(nu) + 0.1006
            ),
            "K2": math.sqrt(
                19.0444 * math.sin(incl) ** 4
                + 2.7702 * math.sin(incl) ** 2 * math.cos(2 * nu)
                + 0.0981
            ),
        }
        self.u_deg: dict[str, float] = {
            "unity": 0.0,
            "Mm": 0.0,
            "Mf": -2 * xi_deg,
            "O1": 2 * xi_deg - nu_deg,
            "J1": -nu_deg,
            "OO1": -2 * xi_deg - nu_deg,
            "M1": xi_deg - nu_deg + q_angle_deg,
            "M2": u_m2,
            "M3": 1.5 * u_m2,
            "L2": u_m2 - r_angle_deg,
            "K1": -nu_prime_deg,
            "K2": -2 * nu_2prime_deg,
        }
