/**
 * Que lo que contesta el API **tenga la forma del contrato** antes de dárselo a la vista.
 *
 * Existe por el hallazgo H-2 del pase adversario de T-11: la isla solo se defendía de que la
 * petición no saliera y de que el estado HTTP no fuera 2xx. Un 200 con el cuerpo cambiado —un
 * backend a medio desplegar sin `marine`, un proxy que devuelve su propio JSON, una versión del
 * módulo por delante de la del sitio construido— entraba entero en `vistaMeteo`, que da la forma
 * por hecha: lee `cuerpo.marine.status`, mete `fetchedAt` en `Date.parse` y llama `.toFixed()`
 * sobre cada magnitud. Las tres cosas lanzan, y la excepción no se veía: la sección se quedaba en
 * «Pidiendo el estado del mar…» con `aria-busy="true"` para siempre. Un quinto estado que no está
 * en el contrato y que además miente.
 *
 * Tres decisiones:
 *
 * - **Se valida el cuerpo ENTERO o no se usa ninguno.** Si el `forecast` llega con una magnitud
 *   como cadena, tampoco se publica el `marine` que venía bien: un cuerpo que ya ha demostrado no
 *   cumplir el contrato no es medio fiable, y publicar la mitad sería enseñar un número que no se
 *   puede defender. La degradación parcial de verdad —una fuente caída— ya la expresa el propio
 *   contrato con `status: "unavailable"`, y esa sí se respeta bloque a bloque.
 * - **Se comprueba lo que la vista LEE, no todo lo que el contrato declara.** `port` y
 *   `attributions` no se miran: rechazar una respuesta por un campo que no se pinta sería inventar
 *   una avería. Lo que se mira es exactamente lo que puede hacer estallar el pintado.
 * - **Las magnitudes se enumeran con un tipo que obliga a estar completo**
 *   (`Record<keyof …, true>`): si el módulo añade o renombra un campo, esto no compila. Una lista
 *   escrita a mano se habría quedado atrás en silencio, que es la forma de que un validador diga
 *   que sí a lo que ya no conoce.
 */

import type {
  BulletinPayload,
  ForecastConditions,
  MarineConditions,
  WeatherPayload,
} from "@mareia/module-weather/ui";

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Un número de verdad: ni `NaN`, ni infinito, ni una cadena que se parece a un número. */
function esNumero(valor: unknown): boolean {
  return typeof valor === "number" && Number.isFinite(valor);
}

/** Una magnitud del modelo: número o `null`. El `null` es un hueco declarado, no un fallo. */
function esMagnitud(valor: unknown): boolean {
  return valor === null || esNumero(valor);
}

/**
 * Un instante que `Date.parse` sabe leer. Es la comprobación que faltaba: un `fetchedAt` con la
 * frase «ayer por la tarde» pasaba hasta `Intl.DateTimeFormat.format`, que lanza `Invalid time
 * value` a media sección pintada.
 */
function esInstante(valor: unknown): boolean {
  return typeof valor === "string" && Number.isFinite(Date.parse(valor));
}

/** Los tres campos con los que cualquier fuente servida sella su antigüedad. */
function esSello(registro: Record<string, unknown>): boolean {
  return (
    esInstante(registro["fetchedAt"]) &&
    esNumero(registro["ageSeconds"]) &&
    typeof registro["stale"] === "boolean"
  );
}

/**
 * Las magnitudes de cada fuente, sin su `observedAt` (que se valida como instante, no como número).
 * El tipo las obliga a estar TODAS y sólo ellas: es el seguro contra la deriva con el contrato.
 */
const MAGNITUDES_DEL_MAR: Record<Exclude<keyof MarineConditions, "observedAt">, true> = {
  waveHeightM: true,
  waveDirectionDeg: true,
  wavePeriodS: true,
  windWaveHeightM: true,
  windWaveDirectionDeg: true,
  windWavePeriodS: true,
  swellWaveHeightM: true,
  swellWaveDirectionDeg: true,
  swellWavePeriodS: true,
  seaSurfaceTemperatureC: true,
};

const MAGNITUDES_DE_LA_ATMOSFERA: Record<Exclude<keyof ForecastConditions, "observedAt">, true> = {
  windSpeedKmh: true,
  windDirectionDeg: true,
  windGustsKmh: true,
  pressureMslHpa: true,
  visibilityM: true,
  uvIndex: true,
};

/** El dato de una fuente de Open-Meteo: su instante y sus magnitudes, todas del tipo declarado. */
function esDato(valor: unknown, magnitudes: Record<string, true>): boolean {
  return (
    esRegistro(valor) &&
    esInstante(valor["observedAt"]) &&
    Object.keys(magnitudes).every((campo) => esMagnitud(valor[campo]))
  );
}

/**
 * Un `SourceReport` del contrato: o `unavailable` con su motivo, o `ok` con su sello y su dato.
 * Cualquier otro `status` es una versión del módulo que esta página no sabe leer.
 */
function esInforme(valor: unknown, magnitudes: Record<string, true>): boolean {
  if (!esRegistro(valor)) {
    return false;
  }
  if (valor["status"] === "unavailable") {
    return typeof valor["reason"] === "string";
  }
  return valor["status"] === "ok" && esSello(valor) && esDato(valor["data"], magnitudes);
}

/** La respuesta de `…/weather` con la forma que la sección sabe pintar. */
export function esRespuestaDeMeteo(cuerpo: unknown): cuerpo is WeatherPayload {
  return (
    esRegistro(cuerpo) &&
    esInforme(cuerpo["marine"], MAGNITUDES_DEL_MAR) &&
    esInforme(cuerpo["forecast"], MAGNITUDES_DE_LA_ATMOSFERA)
  );
}

/** La zona marítima del boletín: o no la hay (`null`), o dice su nombre y si está verificada. */
function esZona(valor: unknown): boolean {
  return (
    valor === null ||
    (esRegistro(valor) && typeof valor["name"] === "string" && typeof valor["verified"] === "boolean")
  );
}

/**
 * El estado de la credencial de AEMET. Viaja siempre —también cuando el boletín sale bien— y la
 * sección lo lee para explicar por qué no hay boletín, así que su forma también se comprueba.
 */
function esCredencial(valor: unknown): boolean {
  if (!esRegistro(valor)) {
    return false;
  }
  const caduca = valor["expiresAt"];
  return typeof valor["status"] === "string" && (caduca === undefined || typeof caduca === "string");
}

/** La respuesta de `…/bulletin` con la forma que la sección sabe pintar. */
export function esRespuestaDeBoletin(cuerpo: unknown): cuerpo is BulletinPayload {
  if (!esRegistro(cuerpo) || !esZona(cuerpo["zone"]) || !esCredencial(cuerpo["credential"])) {
    return false;
  }
  if (cuerpo["status"] === "unavailable") {
    return typeof cuerpo["reason"] === "string";
  }
  // `document` no se valida: el esquema del boletín costero de AEMET sigue sin verificar y
  // `parrafosDelBoletin` ya es tolerante con su forma y honesto cuando no la reconoce.
  return (
    cuerpo["status"] === "ok" && esSello(cuerpo) && (cuerpo["issuedAt"] === null || esInstante(cuerpo["issuedAt"]))
  );
}
