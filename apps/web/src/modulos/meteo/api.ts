/**
 * Dónde vive el API que la isla meteo consulta.
 *
 * Por defecto, **el mismo origen que sirve la página**: es como está pensado el despliegue (README:
 * la web y el API comparten dominio) y así la sección funciona sin configurar nada y sin CORS. Si
 * algún día T-15 los separa, `API_BASE_URL` lo dice en build y viaja al HTML como atributo.
 *
 * La barra final se recorta aquí y no en el sitio donde se compone la URL: `https://api.mareia.es/`
 * y `https://api.mareia.es` son la misma configuración escrita de dos maneras, y la que falla
 * —`//v1/modules/...`— falla lejos de donde se escribió.
 */

/** Nombre de la variable de entorno, en un solo sitio para que el error no mienta. */
export const VARIABLE_API = "API_BASE_URL";

/**
 * Origen del API a partir del entorno del build. Cadena vacía = mismo origen que la página.
 *
 * @throws {RangeError} si el valor no es una URL absoluta. Un origen mal escrito deja la sección
 * meteo muda en las 12 páginas y no se nota hasta que alguien la abre; que rompa el build.
 */
export function baseDelApi(entorno: Record<string, string | undefined> = process.env): string {
  const declarado = entorno[VARIABLE_API]?.trim();
  if (declarado === undefined || declarado === "") {
    return "";
  }
  if (!URL.canParse(declarado)) {
    throw new RangeError(
      `${VARIABLE_API} debe ser una URL absoluta (p. ej. https://api.mareia.es); llegó ` +
        `${JSON.stringify(declarado)}`,
    );
  }
  return declarado.replace(/\/+$/u, "");
}

/** El origen del API de ESTE build, resuelto una sola vez para las 12 páginas. */
export const API_BASE: string = baseDelApi();
