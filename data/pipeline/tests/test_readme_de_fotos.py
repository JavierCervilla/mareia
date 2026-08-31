"""El `README` de `data/especies` publica el reparto de licencias que el dataset **de verdad** tiene.

Es el mismo gate que T-14A puso sobre el README de la raíz, y por el mismo motivo: aquel decía que
el dataset «se publica bajo CC-BY 4.0» cuando dos tercios de los puertos eran CC-BY-NC. Aquí la
afirmación que puede envejecer mal es la tabla de licencias de las fotos, que es justo la que
sostiene la decisión de diseño de todo el fichero —licencia **por fichero** y no un pie global—.

Dos decisiones, y las dos vienen prestadas de aquel gate:

1. **Recomputa, no lee una declaración.** Las cifras salen de contar `fotos.json` una a una, no de
   un campo resumen: un gate que compara la declaración con otra declaración del mismo autor no
   comprueba nada.
2. **Obliga, además de prohibir.** El conjunto de licencias del README tiene que ser **exactamente**
   el medido. Sobrar es feo; **faltar es la falta grave**, porque es publicar una imagen sin decir
   bajo qué condiciones se reutiliza.

El alcance es el bloque delimitado con `<!-- gate:licencias-de-fotos -->`. Se delimita a propósito:
fuera de él la prosa tiene que poder nombrar una licencia **como ejemplo** —la `CC BY-SA 3.0 de` de
la muestra del plan, que en el censo final no sale— sin que eso cuente como declararla.
"""

from __future__ import annotations

import re

from mareia_pipeline import fotos
from mareia_pipeline.schema import REPO_ROOT

README = REPO_ROOT / "data" / "especies" / "README.md"

BLOQUE = "licencias-de-fotos"

_FILA = re.compile(r"^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|", re.MULTILINE)


def _bloque(nombre: str) -> str:
    texto = README.read_text(encoding="utf-8")
    apertura, cierre = f"<!-- gate:{nombre} -->", f"<!-- /gate:{nombre} -->"
    assert apertura in texto and cierre in texto, (
        f"el README ya no tiene el bloque `{nombre}` delimitado por {apertura} … {cierre}. "
        "Borrar el bloque no es una forma de pasar el gate: es lo que el gate vigila."
    )
    return texto.split(apertura, 1)[1].split(cierre, 1)[0]


def _declarado() -> dict[str, int]:
    return {licencia: int(cuantas) for licencia, cuantas in _FILA.findall(_bloque(BLOQUE))}


def test_el_readme_declara_exactamente_las_licencias_que_hay() -> None:
    """Ni una licencia de más ni una de menos, y con su recuento recontado sobre el dataset."""
    assert _declarado() == fotos.reparto_de_licencias(fotos.cargar())


def test_la_suma_de_la_tabla_son_las_fotos_publicadas() -> None:
    """Si la tabla suma otra cosa que el número de fotos, hay ficheros sin licencia declarada."""
    assert sum(_declarado().values()) == len(fotos.cargar()["fotos"])


def test_el_readme_no_anuncia_una_licencia_global_de_las_fotos() -> None:
    """La afirmación que este dataset no puede hacer: «las fotos son CC BY-SA», o cualquiera de sus
    parientes. Sería falsa para las otras seis licencias a la vez, y esa frase es exactamente la que
    aparece cuando alguien se cansa de mostrar la licencia junto a cada foto."""
    texto = README.read_text(encoding="utf-8").lower()
    for frase in (
        "las fotos se publican bajo",
        "las fotos son cc",
        "todas las fotos son",
        "licencia de las fotos es",
    ):
        assert frase not in texto, f"el README anuncia una licencia global de las fotos: «{frase}»"
