// Config ESLint del monorepo. El gate anti-slop vive en eslint.anti-slop.mjs (preset de la skill
// `code-anti-slop`, copiado tal cual: las reglas NO se relajan aquí).
//
// Nota: el scaffolder genera por defecto una config de Next; Mareia no es Next, así que la base es
// typescript-eslint plano. Los .astro quedan fuera del linter en T-01 (requieren eslint-plugin-astro).
import tseslint from "typescript-eslint";
import antiSlop from "./eslint.anti-slop.mjs";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.astro/**",
      ".deno/**",
      "qa-bundles/**",
      "qa-shots/**",
      // Entorno virtual y caché del pipeline Python: traen JS vendorizado dentro de paquetes de
      // pip (urllib3 lleva un worker de Emscripten) que no es código nuestro y no se lintea.
      "data/pipeline/.venv/**",
      "data/pipeline/.cache/**",
    ],
  },
  ...tseslint.configs.recommended,
  ...antiSlop,
];
