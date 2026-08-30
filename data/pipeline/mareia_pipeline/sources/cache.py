"""Descarga HTTP con caché local en disco.

La caché hace que el pipeline sea barato de re-ejecutar y amable con los servidores públicos de los
que dependemos. Vive en ``data/pipeline/.cache`` y está ignorada por git: borrarla obliga a volver a
descargar, que es exactamente lo que hace ``make clean-cache`` para probar el camino desde cero.

No se usa ninguna credencial: todas las fuentes son públicas y anónimas.
"""

from __future__ import annotations

import hashlib
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache"

_USER_AGENT = "mareia-pipeline/1.0 (+https://github.com/universelle-io/mareia) python-urllib"
_TIMEOUT_SECONDS = 300

#: Códigos que significan «ahora no, vuelve luego» y no «esto no existe». Wikimedia devuelve 429
#: cuando el límite de la IP se ha agotado y 503 cuando el clúster está saturado; los dos traen (o
#: pueden traer) ``Retry-After``, y los dos se reintentan. Cualquier otro error se propaga: un 404
#: reintentado cuatro veces sigue siendo un 404, y esconderlo detrás de esperas sólo lo hace lento.
REINTENTABLES = (429, 503)

#: Cuánto se espera cuando el servidor dice que esperemos pero no dice cuánto. Medido contra
#: Wikimedia el 2026-08-30: su 429 trae ``retry-after: 16``, así que quedarse corto vuelve a chocar.
ESPERA_POR_DEFECTO = 20

#: Tope de la espera obedecida. Existe para que un ``Retry-After`` absurdo —o un ``Retry-After``
#: escrito como fecha HTTP, que aquí no se sabe leer— no deje la ingesta colgada media hora sin
#: decir nada. Si el servidor pide más que esto, se espera esto y se reintenta; si sigue diciendo
#: que no, la ingesta falla y lo dice, que es mejor que dormir.
ESPERA_MAXIMA = 60


def _cache_path(url: str, suffix: str) -> Path:
    return CACHE_DIR / f"{hashlib.sha256(url.encode()).hexdigest()[:32]}{suffix}"


def _descargar(url: str, *, agente: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": agente})
    with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
        return response.read()


def _guardar(path: Path, body: bytes) -> bytes:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return body


def fetch(url: str, *, suffix: str = ".bin", refresh: bool = False) -> bytes:
    """Descarga ``url`` (o la sirve de caché) y devuelve el cuerpo en bytes.

    ``refresh=True`` fuerza la descarga aunque haya copia local.
    """
    path = _cache_path(url, suffix)
    if path.exists() and not refresh:
        return path.read_bytes()
    return _guardar(path, _descargar(url, agente=_USER_AGENT))


def espera_pedida(error: urllib.error.HTTPError) -> int:
    """Los segundos que pide la cabecera ``Retry-After``, acotados por ``ESPERA_MAXIMA``.

    Sin cabecera —o con una que no sea un número de segundos, porque el RFC también admite fecha—
    se espera ``ESPERA_POR_DEFECTO``: la alternativa sería reintentar inmediatamente, que es
    exactamente lo que el servidor acaba de pedir que no hagamos.
    """
    cruda = (error.headers.get("Retry-After") or "").strip() if error.headers else ""
    segundos = int(cruda) if cruda.isdigit() else ESPERA_POR_DEFECTO
    return min(max(segundos, 1), ESPERA_MAXIMA)


def fetch_educado(
    url: str,
    *,
    suffix: str = ".bin",
    refresh: bool = False,
    agente: str,
    intentos: int = 4,
    pausa: float = 0.0,
    dormir: Callable[[float], None] = time.sleep,
) -> bytes:
    """Como ``fetch``, pero identificándose y **obedeciendo el ``Retry-After``** del servidor.

    Existe porque Wikimedia limita **por IP** y esta corre en un datacenter compartido: medido el
    2026-08-30, sin ``User-Agent`` propio la respuesta es un ``429`` con ``retry-after: 16`` y
    ``server: envoy``, o sea que el límite lo pone la fuente y no nuestro proxy. Un cliente que
    reintentara enseguida —o que no reintentara y abortase— convertiría un «espera un momento» en
    una ingesta rota o en una que empeora el problema.

    Tres piezas, y ninguna sobra:

    * ``agente`` es obligatorio y no tiene valor por defecto: la política de Wikimedia exige un
      ``User-Agent`` que diga quién eres y dónde encontrarte, y dejarlo opcional es la forma segura
      de que algún día se llame ``python-urllib``.
    * ``pausa`` se duerme **antes de cada petición que de verdad sale a la red**, nunca antes de un
      acierto de caché: la concurrencia baja es la parte de ser educado que no depende de que el
      servidor se queje.
    * ``dormir`` se inyecta para que la suite pueda comprobar que la espera se obedece sin esperar.
    """
    path = _cache_path(url, suffix)
    if path.exists() and not refresh:
        return path.read_bytes()
    for intento in range(1, intentos + 1):
        if pausa:
            dormir(pausa)
        try:
            return _guardar(path, _descargar(url, agente=agente))
        except urllib.error.HTTPError as error:
            if error.code not in REINTENTABLES or intento == intentos:
                raise
            dormir(espera_pedida(error))
    raise AssertionError("inalcanzable: el bucle sale por return o por raise")


def sha256(data: bytes) -> str:
    """Huella hexadecimal de un cuerpo descargado, para poder citarla en el informe QC."""
    return hashlib.sha256(data).hexdigest()
