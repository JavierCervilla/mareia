import type { AppModule } from "@mareia/module-contract";
// @ts-types="@types/express"
import type { Router } from "express";

/**
 * Un módulo visto por esta API: el contrato es agnóstico del framework HTTP (`AppModule<TRouter>`)
 * y es aquí, en el adaptador, donde el router se estrecha a Express. `packages/module-contract` no
 * depende de Express y este archivo no necesita casts.
 */
export type ApiModule = AppModule<Router>;

/**
 * Registry de módulos activos en la API. **Dar de alta o de baja un módulo es editar este array y
 * nada más**: el composition root (`src/http/server.ts`) monta cada `api()` bajo
 * `/v1/modules/<id>` y los publica en `GET /v1/modules`.
 *
 * Vacío a propósito: el core funciona sin ningún módulo (test de arquitectura en
 * `src/http/modules_test.ts`). Los módulos reales llegan en T-08 (weather) y T-10/T-11.
 */
export const activeModules: readonly ApiModule[] = [];
