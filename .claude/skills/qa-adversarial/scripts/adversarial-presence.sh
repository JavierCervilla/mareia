#!/usr/bin/env bash
# =============================================================================
# Check de PRESENCIA del pase adversario (skill `qa-adversarial`, doctrina_adversarial).
#
# Si el PR toca UI, exige que traiga un informe adversario bien formado. Comprueba QUE EXISTE y que
# tiene las secciones obligatorias — NO juzga si el pase fue agresivo: eso no lo puede medir un script,
# y prometerlo sería un diente falso (ver §Enforcement honesto de la doctrina).
#
# Uso:
#   adversarial-presence.sh [--base-ref <ref>] [--config <fichero>] [--quiet]
#
#   --base-ref   Rama/commit contra el que diffear. Default: $GITHUB_BASE_REF (con origin/), u
#                origin/main si no hay. Se compara con `git diff --name-only <base>...HEAD`.
#   --config     Marcador JSON con los patrones del proyecto. Default: .qa-adversarial en la raíz.
#   --quiet      Solo el veredicto final.
#
# Salidas: 0 = pasa o no aplica · 1 = falta el informe / está mal formado · 2 = error de uso.
# Escape: `[skip-adv]` en cualquier commit del rango (mismo criterio que `[skip-traj]`: existe para no
# romper la sesión, no para saltarse la disciplina).
# =============================================================================
set -euo pipefail

BASE_REF=""
CONFIG=".qa-adversarial"
QUIET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --base-ref) BASE_REF="${2:-}"; shift 2 ;;
    --config)   CONFIG="${2:-}"; shift 2 ;;
    --quiet)    QUIET=1; shift ;;
    -h|--help)  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "uso: $0 [--base-ref <ref>] [--config <fichero>] [--quiet]" >&2; exit 2 ;;
  esac
done

say() { [ "$QUIET" -eq 1 ] || echo "$@"; }

# --- Patrones (marcador del proyecto si existe; si no, los defaults del Dashboard) ---------------
# `uiPattern` NO debe casar tests ni artefactos: si casara, un PR que solo añade recorridos
# adversarios se exigiría a sí mismo un informe y el check se volvería un bucle.
UI_PATTERN='^(dashboard/(app|components|src)/|[^ ]*\.(tsx|jsx|css)$)'
REPORT_PATTERN='^Contexto_Base_SRE/trayectorias/[^/]+/artifacts/informe-adversario[^/]*\.md$'
EXCLUDE_PATTERN='(^|/)(tests?|__tests__|e2e)/|\.spec\.(ts|tsx|js)$|\.test\.(ts|tsx|js)$'

if [ -f "$CONFIG" ]; then
  if command -v jq >/dev/null 2>&1; then
    UI_PATTERN=$(jq -r '.uiPattern // empty' "$CONFIG" 2>/dev/null || true)
    REPORT_PATTERN=$(jq -r '.reportPattern // empty' "$CONFIG" 2>/dev/null || true)
    EXCLUDE_PATTERN=$(jq -r '.excludePattern // empty' "$CONFIG" 2>/dev/null || true)
    [ -n "$UI_PATTERN" ] || UI_PATTERN='^(dashboard/(app|components|src)/|[^ ]*\.(tsx|jsx|css)$)'
    [ -n "$REPORT_PATTERN" ] || REPORT_PATTERN='^Contexto_Base_SRE/trayectorias/[^/]+/artifacts/informe-adversario[^/]*\.md$'
    [ -n "$EXCLUDE_PATTERN" ] || EXCLUDE_PATTERN='(^|/)(tests?|__tests__|e2e)/|\.spec\.(ts|tsx|js)$|\.test\.(ts|tsx|js)$'
  else
    say "⚠️  hay $CONFIG pero no hay jq: uso los patrones por defecto."
  fi
else
  say "ℹ️  sin $CONFIG: uso los patrones por defecto (proyecto no onboardado a qa-adversarial)."
fi

# --- Rango del diff ------------------------------------------------------------------------------
if [ -z "$BASE_REF" ]; then
  if [ -n "${GITHUB_BASE_REF:-}" ]; then BASE_REF="origin/${GITHUB_BASE_REF}"; else BASE_REF="origin/main"; fi
fi

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  # Fail-open deliberado: sin base no hay diff que juzgar, y un check que revienta por un checkout
  # superficial acaba desactivado. Se avisa fuerte para que no pase inadvertido.
  echo "⚠️  no encuentro la base '$BASE_REF' (¿checkout con fetch-depth: 1?) — no puedo decidir, dejo pasar."
  exit 0
fi

CHANGED=$(git diff --name-only "$BASE_REF...HEAD" || true)
if [ -z "$CHANGED" ]; then say "✅ sin cambios respecto a $BASE_REF — no aplica."; exit 0; fi

# --- Escape --------------------------------------------------------------------------------------
# SOLO en el ASUNTO (primera línea) del commit, nunca en el cuerpo. Con `%B` el check se saltaba a sí
# mismo en cuanto un commit *hablaba* del escape — le pasó al commit que introdujo este script, que
# documentaba "[skip-adv]" en su propio mensaje. Un escape que se dispara al mencionarlo no es un
# escape: es un agujero. El asunto es donde se pone una marca a propósito; el cuerpo es donde se
# explica algo.
if git log --format=%s "$BASE_REF...HEAD" | grep -qF '[skip-adv]'; then
  say "⏭️  [skip-adv] en el asunto de un commit del rango — el pase adversario se salta a propósito."
  exit 0
fi

# --- ¿Toca UI? -----------------------------------------------------------------------------------
UI_TOUCHED=$(printf '%s\n' "$CHANGED" | grep -Ev "$EXCLUDE_PATTERN" | grep -E "$UI_PATTERN" || true)
if [ -z "$UI_TOUCHED" ]; then
  say "✅ el PR no toca UI de producción — el pase adversario no aplica."
  exit 0
fi

if [ "$QUIET" -eq 0 ]; then
  echo "🎯 el PR toca UI:"
  printf '%s\n' "$UI_TOUCHED" | head -20 | sed 's/^/     /'
  [ "$(printf '%s\n' "$UI_TOUCHED" | wc -l)" -gt 20 ] && echo "     … y más"
fi

# --- ¿Trae informe? --------------------------------------------------------------------------------
REPORTS=$(printf '%s\n' "$CHANGED" | grep -E "$REPORT_PATTERN" || true)
if [ -z "$REPORTS" ]; then
  cat >&2 <<EOF

❌ FALTA EL INFORME ADVERSARIO.

Este PR toca UI de producción y no trae ningún informe que case con:
    $REPORT_PATTERN

Qué hacer (skill \`qa-adversarial\`):
  1. bash .claude/skills/qa-staging/scripts/qa-staging.sh --report-dir /tmp/qa   # staging efímero
  2. Lanza el rol \`qa-adversario\` (o corre tú la taxonomía de 12 clases).
  3. cp .claude/skills/qa-adversarial/presets/informe-adversario.md \\
       Contexto_Base_SRE/trayectorias/<T-XXX>/artifacts/informe-adversario.md   # y rellénalo

Este check comprueba que el informe EXISTE y está bien formado. No juzga si el pase fue agresivo
— eso lo pondera el humano leyendo el ledger.
Escape consciente: \`[skip-adv]\` en el ASUNTO (primera línea) de un commit — en el cuerpo no cuenta,
para que documentar el escape no lo dispare.
EOF
  exit 1
fi

# --- ¿Está bien formado? ----------------------------------------------------------------------------
# Un stub vacío pasaría un check de existencia a secas. Exigimos las secciones que hacen el informe
# legible: la promesa (contra qué se atacó), las clases (qué se intentó) y AMBOS recuentos —
# los no reproducidos son lo único que distingue una pasada estéril de una alucinada.
STATUS=0
while IFS= read -r r; do
  [ -n "$r" ] || continue
  [ -f "$r" ] || { echo "⚠️  $r está en el diff pero no en el árbol (¿borrado?) — lo ignoro."; continue; }
  MISSING=""
  for sec in "## Promesa" "## Clases atacadas" "## Hallazgos" "## No reproducidos"; do
    grep -qF "$sec" "$r" || MISSING="$MISSING\n     · $sec"
  done
  if [ -n "$MISSING" ]; then
    # shellcheck disable=SC2059
    printf "❌ %s está mal formado; le faltan secciones obligatorias:$MISSING\n" "$r" >&2
    STATUS=1
  else
    say "✅ $r — presente y bien formado."
  fi
done <<EOF
$REPORTS
EOF

if [ "$STATUS" -ne 0 ]; then
  echo "" >&2
  echo "Plantilla: .claude/skills/qa-adversarial/presets/informe-adversario.md" >&2
  exit 1
fi

say ""
say "✅ pase adversario presente. (Presencia, no agresividad: el contenido lo pondera el humano.)"
exit 0
