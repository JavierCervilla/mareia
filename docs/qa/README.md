# QA · informes del Guardián

Aquí se versionan los **informes del pase adversario** (skill `qa-adversarial`). El check de CI
`adversarial` exige uno cuando el PR toca UI (`apps/web/src/`, `.astro`, `.css`):

- Nombre: `informe-adversario<-sufijo>.md` — es el patrón que busca `.qa-adversarial`.
- Plantilla: `.qa-adversarial-presets/informe-adversario.md` (secciones obligatorias: Promesa,
  Clases atacadas, Hallazgos, No reproducidos).
- Escape consciente, en el **asunto** del commit: `[skip-adv]`.

Las reproducciones de los hallazgos van en `tests/e2e/journeys/adversarial/`, con `test.fail()`
mientras el bug está abierto.

## Registro de escapes

- **T-01** (`[skip-adv]`): el único "UI" del PR de scaffold es la página hello — no hay promesa de
  feature que atacar. El primer pase adversario real llega con las páginas de puerto (T-09+).
- **T-06** (`[skip-adv]`): el toque a `apps/web/src/` es el registry tipado de módulos
  (`modules.config.ts` + `sectionsForPort`, sin render ni superficie visible). La promesa del contrato
  de módulos se atacará cuando haya UI que lo consuma (T-09/T-10/T-11).
