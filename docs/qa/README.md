# QA · informes del Guardián

Aquí se versionan los **informes del pase adversario** (skill `qa-adversarial`). El check de CI
`adversarial` exige uno cuando el PR toca UI (`apps/web/src/`, `.astro`, `.css`):

- Nombre: `informe-adversario<-sufijo>.md` — es el patrón que busca `.qa-adversarial`.
- Plantilla: `.qa-adversarial-presets/informe-adversario.md` (secciones obligatorias: Promesa,
  Clases atacadas, Hallazgos, No reproducidos).
- Escape consciente, en el **asunto** del commit: `[skip-adv]`.

Las reproducciones de los hallazgos van en `tests/e2e/journeys/adversarial/`, con `test.fail()`
mientras el bug está abierto.
