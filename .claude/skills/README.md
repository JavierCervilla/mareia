# Skills vendorizadas (gates del AgenticFramework)

Copias **verbatim** de los runners que el CI de Mareia necesita ejecutar, tomadas de
`AgenticFramework/.claude/skills/`. Se vendorizan (y no se referencian) porque el workflow de este
repo no puede depender de otro repositorio.

| Ruta | Origen | Lo usa |
|---|---|---|
| `security-gate/scripts/security-gate.sh` + `deps-cut.sh` + `presets/` | skill `security-gate` | job `security` de CI |
| `qa-adversarial/scripts/adversarial-presence.sh` | skill `qa-adversarial` | job `adversarial` de CI |

El gate anti-slop no necesita runner vendorizado: es ESLint (`pnpm lint`) con el preset
`eslint.anti-slop.mjs`, también copiado verbatim en la raíz.

**Refresco**: re-ejecuta los `install.sh` de cada skill y vuelve a copiar los scripts; no edites
estas copias a mano (la divergencia silenciosa es justo lo que hace inútil una vendorización).

Los marcadores de presencia en la raíz (`.anti-slop-gate`, `.security-gate`, `.qa-staging`,
`.qa-adversarial`) son lo que leen los hooks del framework para no bloquear commits en este repo.
