// Config ESLint del monorepo. El gate anti-slop vive en eslint.anti-slop.mjs (preset de la skill
// `code-anti-slop`, copiado tal cual: las reglas NO se relajan aquí).
//
// Nota: el scaffolder genera por defecto una config de Next; Mareia no es Next, así que la base es
// typescript-eslint plano. Los .astro quedan fuera del linter en T-01 (requieren eslint-plugin-astro).
import importPlugin from "eslint-plugin-import";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";
import antiSlop from "./eslint.anti-slop.mjs";

// --- Registries de producción: re-armar el gate anti-slop ----------------------------------------
// El preset relaja sus reglas en `**/*.config.*` («configs» = tooling, código no-de-producción). Los
// registries `apps/*/src/modules.config.ts` casan con ese glob por su nombre, pero NO son tooling:
// los importa el composition root de la API y (desde T-09) la página de puerto, y en T-08/T-10/T-11
// van a crecer con módulos reales. Sin esto, un `any` o un `console.log` colado al registrar un
// módulo pasaría sin ruido. Se re-arman aquí las cinco reglas que apaga el bloque relajado del
// preset, con la misma severidad y opciones que tienen en su bloque base (el preset no se toca:
// debe seguir byte-idéntico a la skill `code-anti-slop`).
const registriesDeProduccion = [
  {
    files: ["**/modules.config.ts"],
    plugins: { sonarjs },
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      "sonarjs/no-identical-functions": "warn",
    },
  },
];

// --- Zona «capas»: el test de arquitectura del contrato de módulos (T-06) ------------------------
// El dominio es CIEGO a los módulos: si domain-core o usecases pudieran importar un módulo (o
// siquiera su contrato), enchufar/desenchufar pesca o meteo dejaría de ser editar un array y
// pasaría a ser cirugía. Y el contrato no puede mirar hacia arriba (apps), o dejaría de ser
// enchufable en varias superficies.
//
// Se cubre por dos vías a propósito: `import/no-restricted-paths` razona sobre la ruta RESUELTA
// (atrapa los escapes relativos tipo `../../modules/...`) pero es ciego si el import no resuelve —
// justo el caso de un package que importa algo que no es dependencia suya. `no-restricted-imports`
// es sintáctico sobre el especificador y ahí sí muerde. Verificado con sonda: ver el commit.
const CIEGO_A_MODULOS =
  "capas: el dominio es ciego a los módulos. domain-core/usecases no pueden importar " +
  "packages/modules/* ni @mareia/module-contract (los módulos dependen del dominio, no al revés).";
const CONTRATO_SIN_APPS =
  "capas: el contrato de módulos no puede importar de apps/*. Debe seguir siendo enchufable " +
  "desde cualquier superficie (API, web) sin arrastrar ninguna.";

const capas = [
  {
    files: ["packages/domain-core/**/*.ts", "packages/usecases/**/*.ts"],
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: import.meta.dirname,
          zones: [
            {
              target: "./packages/domain-core",
              from: ["./packages/modules", "./packages/module-contract"],
              message: CIEGO_A_MODULOS,
            },
            {
              target: "./packages/usecases",
              from: ["./packages/modules", "./packages/module-contract"],
              message: CIEGO_A_MODULOS,
            },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@mareia/module-*",
                "**/module-contract",
                "**/module-contract/**",
                "**/modules/*",
                "**/modules/*/**",
              ],
              message: CIEGO_A_MODULOS,
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/module-contract/**/*.ts"],
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: import.meta.dirname,
          zones: [
            { target: "./packages/module-contract", from: "./apps", message: CONTRATO_SIN_APPS },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/apps/*", "**/apps/*/**"], message: CONTRATO_SIN_APPS }] },
      ],
    },
  },
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.astro/**",
      ".deno/**",
      "qa-bundles/**",
      "qa-shots/**",
    ],
  },
  ...tseslint.configs.recommended,
  ...antiSlop,
  ...registriesDeProduccion,
  ...capas,
];
