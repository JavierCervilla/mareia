import type { AppModule } from "@mareia/module-contract";
import { createWeatherModule } from "@mareia/module-weather";
// @ts-types="@types/express"
import type { Router } from "express";

import { createWeatherDeps } from "./weather-deps.ts";

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
 * Cada módulo se construye con sus dependencias ya resueltas (`create<X>Deps()`), que es donde vive
 * todo lo que el módulo no debe saber: el entorno, el disco, el runtime. Aquí solo se declara
 * **quién está activo**.
 */
export const activeModules: readonly ApiModule[] = [createWeatherModule(createWeatherDeps())];
