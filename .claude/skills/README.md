# Skills vendorizadas (gates del AgenticFramework)

Copias **verbatim** de los runners que el CI de Mareia necesita ejecutar, tomadas de
`AgenticFramework/.claude/skills/`. Se vendorizan (y no se referencian) porque el workflow de este
repo no puede depender de otro repositorio.

| Ruta | Origen | Lo usa |
|---|---|---|
| `security-gate/scripts/security-gate.sh` + `deps-cut.sh` + `presets/` | skill `security-gate` | job `security` de CI |
| `qa-adversarial/scripts/adversarial-presence.sh` | skill `qa-adversarial` | job `adversarial` de CI |
| `frontend-anti-slop/scripts/audit-anti-slop.sh` + `data/*.txt` | skill `frontend-anti-slop` | job `anti-slop` de CI (gate de UI, T-09) |

El gate anti-slop de **backend** no necesita runner vendorizado: es ESLint (`pnpm lint`) con el
preset `eslint.anti-slop.mjs`, también copiado verbatim en la raíz.

El gate de **UI** sí lo necesita (es bash + grep) y tiene además un paso previo que no es
ejecutable: el **brief de diseño**, `apps/web/design-brief.md`, que la skill exige antes de
escribir la primera línea de CSS. El linter escanea `.ts`/`.css`/`.html` pero **no** `.astro`; de
ahí la regla del brief (§8): el CSS de presentación vive en ficheros `.css` importados, no en
bloques `<style>` de página, para que lo que se audita sea lo que se sirve.

**Refresco**: re-ejecuta los `install.sh` de cada skill y vuelve a copiar los scripts; no edites
estas copias a mano (la divergencia silenciosa es justo lo que hace inútil una vendorización).

Los marcadores de presencia en la raíz (`.anti-slop-gate`, `.security-gate`, `.qa-staging`,
`.qa-adversarial`) son lo que leen los hooks del framework para no bloquear commits en este repo.
