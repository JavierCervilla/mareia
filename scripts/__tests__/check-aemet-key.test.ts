/**
 * El canal del operador, probado **ejecutando el script** (residuo R-1 del pase adversario T-18).
 *
 * Por qué existe este fichero. T-18 dejó un «trinquete al revés» que exigía que el aviso completo
 * —nombre de la variable, URL de alta, los pasos— siguiera saliendo de `inspectAemetKey`. Pero lo
 * que el humano lee no es esa función: es la salida de `scripts/check-aemet-key.ts`, que el
 * workflow `aemet-key.yml` vuelca dentro de un issue de GitHub. Y ese script **no lo alcanzaba
 * ningún job**: `pnpm test` no lo ve porque es Deno, y `deno task test` corre sólo sobre
 * `apps/api/src/`.
 *
 * El adversario lo midió: mutando dos líneas del script —imprimir la frase pública en vez del
 * mensaje del operador y quitar los pasos del stderr— el issue quedaba en «La credencial de AEMET
 * ha caducado» + «Hace falta acción humana», sin variable, sin URL y sin los tres pasos, **con la
 * suite entera en verde** (`pnpm test` 499/0, `deno task test` 20/0). El aviso dejaba de servir para
 * lo único para lo que existe y nadie se enteraba.
 *
 * Así que aquí no se importa nada del script: se **lanza como subproceso**, con la misma línea de
 * comando que usa el workflow, y se afirma sobre su stdout, su stderr y su código de salida. Probar
 * la función y no el artefacto es el error que llevamos toda la épica encontrando.
 *
 * Las claves son JWT sintéticos con firma de relleno: este código no verifica firmas, sólo lee una
 * fecha del payload. No hay ni puede haber una credencial real en el repositorio.
 */

import assert from "node:assert/strict";

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/\/$/u, "");
const SCRIPT = "scripts/check-aemet-key.ts";
/** La misma línea que corre el workflow. Se afirma más abajo que sigue siendo la misma. */
const ARGUMENTOS = ["run", "--allow-env=AEMET_API_KEY", SCRIPT] as const;

const DIA_MS = 86_400_000;

/** JWT sintético que caduca cuando se le diga. Firma de relleno: sólo se lee el `exp`. */
function jwt(caducaEnMs: number): string {
  const b64 = (valor: unknown): string =>
    btoa(JSON.stringify(valor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ exp: caducaEnMs / 1000 })}.firma-de-prueba`;
}

interface Salida {
  readonly codigo: number;
  readonly stdout: string;
  readonly stderr: string;
  /** Las líneas maquinales que el workflow parsea (`estado`, `escalon`, `aviso_id`). */
  readonly campos: Readonly<Record<string, string>>;
  /** Lo que de verdad acaba dentro del issue: todo menos las líneas maquinales. */
  readonly resumen: string;
}

/**
 * Ejecuta el script con la clave que se le pase y devuelve lo mismo que ve el workflow.
 *
 * `AEMET_API_KEY: ""` es la instancia sin clave: el script hace `trim()` sobre lo que le llega, y
 * la cadena vacía es indistinguible de la variable ausente para su lógica. Se pasa así en vez de
 * limpiar el entorno entero porque el subproceso `deno` necesita el suyo para arrancar.
 */
async function ejecutar(clave: string | undefined): Promise<Salida> {
  const proceso = new Deno.Command("deno", {
    args: [...ARGUMENTOS],
    cwd: RAIZ,
    env: { AEMET_API_KEY: clave ?? "", NO_COLOR: "1" },
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await proceso.output();
  const texto = new TextDecoder().decode(stdout);
  const campos: Record<string, string> = {};
  const resumen: string[] = [];
  for (const linea of texto.split("\n")) {
    const corte = /^(estado|escalon|aviso_id)=(.*)$/u.exec(linea);
    if (corte?.[1] === undefined) {
      resumen.push(linea);
      continue;
    }
    campos[corte[1]] = corte[2] ?? "";
  }
  return {
    codigo: code,
    stdout: texto,
    stderr: new TextDecoder().decode(stderr),
    campos,
    resumen: resumen.join("\n").trim(),
  };
}

/** Las señas del aviso al operador. Escritas a mano a propósito: un gate no importa lo que vigila. */
const SENAS_DEL_OPERADOR = [
  "AEMET_API_KEY",
  "opendata.aemet.es/centrodedescargas/altaUsuario",
  "Renuévala",
  "actualiza el secreto",
] as const;

/**
 * El gate de R-1, y el que mata la mutación que el adversario midió: lo que se imprime es el
 * **mensaje del operador**, no la frase pública, y el stderr lleva los **tres pasos** de la
 * renovación. Cambiar `state.message` por `publicCredentialView(state).message` o quitar los pasos
 * pone esto en rojo — que es lo que no pasaba antes de este fichero.
 */
Deno.test("una clave caducada avisa al operador con el manual entero, no con la frase pública", async () => {
  const salida = await ejecutar(jwt(Date.now() - 3.5 * DIA_MS));

  assert.equal(salida.codigo, 1, `tiene que salir pidiendo acción humana: ${salida.stdout}`);
  assert.equal(salida.campos["estado"], "expired");
  assert.equal(salida.campos["escalon"], "0", "caducada es su propio escalón");
  assert.match(salida.campos["aviso_id"] ?? "", /^aemet:.+:vencida:\d{4}-\d{2}-\d{2}$/u);

  // Lo que llega al issue: la línea `[aemet-key] …` (stdout, ya sin las maquinales) y el stderr.
  const loQueLeeElHumano = `${salida.resumen}\n${salida.stderr}`;
  for (const sena of SENAS_DEL_OPERADOR) {
    assert.ok(
      loQueLeeElHumano.includes(sena),
      `el aviso que acaba en el issue perdió «${sena}» y deja de servir para lo único que existe:\n${loQueLeeElHumano}`,
    );
  }
  // Los tres pasos, numerados: sin ellos «hace falta acción humana» no dice qué acción.
  for (const paso of ["1.", "2.", "3."]) {
    assert.ok(
      salida.stderr.includes(paso),
      `el aviso perdió el paso «${paso}» de la renovación:\n${salida.stderr}`,
    );
  }
  // Y dice cuánto lleva muerta, con el número arreglado en T-18/A-20 (no «hace 4 día(s)» a los 3).
  assert.match(salida.resumen, /caducó hace 3 día\(s\)/u);
});

Deno.test("una clave a punto de caducar avisa en su escalón y no en cualquiera", async () => {
  const salida = await ejecutar(jwt(Date.now() + 3.5 * DIA_MS));

  assert.equal(salida.codigo, 1);
  assert.equal(salida.campos["estado"], "expiring");
  assert.equal(salida.campos["escalon"], "7", "a 3 días el escalón cruzado es el de 7, no el de 21");
  assert.match(salida.campos["aviso_id"] ?? "", /^aemet:.+:d7$/u);
  for (const sena of SENAS_DEL_OPERADOR.filter((s) => s !== "Renuévala")) {
    assert.ok(salida.stderr.includes(sena) || salida.resumen.includes(sena), `perdió «${sena}»`);
  }
});

Deno.test("una clave ilegible no se calla: avisa a diario y sin atarse a ninguna fecha", async () => {
  const salida = await ejecutar("esto-no-es-un-jwt");

  assert.equal(salida.codigo, 1);
  assert.equal(salida.campos["estado"], "unreadable");
  assert.equal(salida.campos["escalon"], "ilegible");
  assert.match(salida.campos["aviso_id"] ?? "", /^aemet:ilegible:\d{4}-\d{2}-\d{2}$/u);
});

/**
 * El `exp` que rompía el borde público (A-19) llega también por aquí, y aquí romper es peor: un
 * comprobador que revienta deja de vigilar la fecha. Que degrade a `unreadable` significa que el
 * canal sigue hablando en vez de morirse con un `RangeError`.
 */
Deno.test("un `exp` que no cabe en una fecha degrada el aviso, no lo revienta", async () => {
  const b64 = (valor: unknown): string =>
    btoa(JSON.stringify(valor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const clave = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ exp: 1e14 })}.firma-de-prueba`;
  const salida = await ejecutar(clave);

  assert.equal(salida.codigo, 1, `el comprobador reventó en vez de degradar: ${salida.stderr}`);
  assert.equal(salida.campos["estado"], "unreadable");
});

Deno.test("una clave sana no molesta a nadie y no deja aviso que contar", async () => {
  const salida = await ejecutar(jwt(Date.now() + 90 * DIA_MS));

  assert.equal(salida.codigo, 0);
  assert.equal(salida.campos["estado"], "valid");
  assert.equal(salida.campos["aviso_id"], "", "una clave sana no puede abrir ni comentar un issue");
});

/**
 * Sin clave la instancia degrada de forma explícita y eso es una decisión válida, no una avería:
 * el script sale en 0. Que esto tenga su propio recorrido importa porque es el caso que apagaría
 * el canal si alguien lo tratara como los demás (un secreto borrado por accidente cerraría el aviso
 * que lo delata; el workflow ya lo sabe y por eso sólo cierra con `valid`).
 */
Deno.test("sin clave configurada el comprobador no inventa una avería", async () => {
  const salida = await ejecutar(undefined);

  assert.equal(salida.codigo, 0);
  assert.equal(salida.campos["estado"], "missing");
  assert.equal(salida.campos["aviso_id"], "");
});

/**
 * Y el trinquete de este trinquete: que lo que se ejecuta aquí sea **la misma línea** que ejecuta el
 * workflow. Si alguien cambia el comando en `aemet-key.yml` —otro permiso, otra ruta— este fichero
 * seguiría verde probando un artefacto que ya no es el que corre en producción, que es exactamente
 * la familia de fallo que R-1 denunció.
 */
Deno.test("el recorrido ejecuta la misma línea de comando que el workflow del operador", async () => {
  const workflow = await Deno.readTextFile(`${RAIZ}/.github/workflows/aemet-key.yml`);
  assert.ok(
    workflow.includes(`deno ${ARGUMENTOS.join(" ")}`),
    `el workflow ya no invoca «deno ${ARGUMENTOS.join(" ")}»: re-apunta este recorrido en vez de ` +
      `dejarlo probando un comando que nadie corre`,
  );
});
