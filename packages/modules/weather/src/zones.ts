/**
 * Qué zona marítima de AEMET le toca a cada puerto.
 *
 * El mapeo vive en `aemet-zones.json` —dato de configuración, no código— para que añadir un puerto
 * al piloto sea editar un JSON. Aquí solo se indexa por slug y se le pone tipo.
 */

import zonesDocument from "./aemet-zones.json" with { type: "json" };

/** Una zona del boletín costero de AEMET. */
export interface CoastalZone {
  /** Código de la zona en el endpoint `costera/costa/{code}`. */
  readonly code: string;
  /** Nombre legible, para que la respuesta diga de qué zona habla el boletín. */
  readonly name: string;
  /**
   * `false` mientras el código no se haya comprobado contra la API real (hace falta una API key).
   * Viaja en la respuesta a propósito: quien la consuma sabe que ese dato aún no está verificado.
   */
  readonly verified: boolean;
}

interface ZoneRecord extends CoastalZone {
  readonly ports: readonly string[];
}

const ZONES: readonly ZoneRecord[] = zonesDocument.zones;

const BY_PORT = new Map<string, CoastalZone>(
  ZONES.flatMap((zone) =>
    zone.ports.map(
      (slug): [string, CoastalZone] => [
        slug,
        { code: zone.code, name: zone.name, verified: zone.verified },
      ],
    ),
  ),
);

/** Todas las zonas declaradas, para tests y diagnóstico. */
export const COASTAL_ZONES: readonly ZoneRecord[] = ZONES;

/** Zona de un puerto, o `undefined` si ese puerto todavía no tiene zona asignada. */
export function zoneForPort(slug: string): CoastalZone | undefined {
  return BY_PORT.get(slug);
}
