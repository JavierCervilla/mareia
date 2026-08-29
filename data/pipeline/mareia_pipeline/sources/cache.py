"""Descarga HTTP con caché local en disco.

La caché hace que el pipeline sea barato de re-ejecutar y amable con los servidores públicos de los
que dependemos. Vive en ``data/pipeline/.cache`` y está ignorada por git: borrarla obliga a volver a
descargar, que es exactamente lo que hace ``make clean-cache`` para probar el camino desde cero.

No se usa ninguna credencial: todas las fuentes son públicas y anónimas.
"""

from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache"

_USER_AGENT = "mareia-pipeline/1.0 (+https://github.com/universelle-io/mareia) python-urllib"
_TIMEOUT_SECONDS = 300


def _cache_path(url: str, suffix: str) -> Path:
    return CACHE_DIR / f"{hashlib.sha256(url.encode()).hexdigest()[:32]}{suffix}"


def fetch(url: str, *, suffix: str = ".bin", refresh: bool = False) -> bytes:
    """Descarga ``url`` (o la sirve de caché) y devuelve el cuerpo en bytes.

    ``refresh=True`` fuerza la descarga aunque haya copia local.
    """
    path = _cache_path(url, suffix)
    if path.exists() and not refresh:
        return path.read_bytes()
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
        body = response.read()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return body


def sha256(data: bytes) -> str:
    """Huella hexadecimal de un cuerpo descargado, para poder citarla en el informe QC."""
    return hashlib.sha256(data).hexdigest()
