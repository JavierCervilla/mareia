#!/usr/bin/env bash
# Descarga las efemérides de referencia del USNO (Astronomical Applications Department).
# Se ejecuta A MANO y su salida se COMMITEA: los tests nunca salen a la red.
# Ver README.md para la procedencia, las unidades y el alcance como oráculo.
set -euo pipefail
cd "$(dirname "$0")"

# Sitios de prueba (los dos puertos de referencia de Mareia). tz=0 → todas las horas son UTC.
SITES=("madrid:40.4168,-3.7038" "las-palmas:28.1235,-15.4363")
DATES=(2026-01-20 2026-03-20 2026-05-05 2026-06-21 2026-08-12 2026-09-23 2026-11-11 2026-12-21)

for site in "${SITES[@]}"; do
  name="${site%%:*}"
  coords="${site#*:}"
  mkdir -p "oneday/${name}"
  for date in "${DATES[@]}"; do
    curl -sSf --max-time 60 \
      "https://aa.usno.navy.mil/api/rstt/oneday?date=${date}&coords=${coords}&tz=0" \
      -o "oneday/${name}/${date}.json"
    echo "oneday/${name}/${date}.json"
  done
done

curl -sSf --max-time 60 "https://aa.usno.navy.mil/api/moon/phases/year?year=2026" -o "moon-phases-2026.json"
echo "moon-phases-2026.json"
