// Reproducción de referencia del pase adversario (skill `qa-adversarial`, clase A1 · concurrencia y
// doble envío). Cópialo como plantilla; no es un test de este repo.
//
// Lo que enseña este ejemplo:
//   0. LA REGLA QUE MÁS SE FALLA: el assert afirma el comportamiento CORRECTO (debe haber UN proyecto),
//      nunca el síntoma del bug. Con el bug vivo el assert falla —que es lo que `test.fail()` espera— y
//      el día que se arregle, el mismo spec pasa a verde sin tocar una línea. Si afirmas el bug
//      (`toHaveCount(2)`), el trinquete funciona al revés: hoy pasa y el fix lo pone en rojo.
//   1. El assert es ESPECÍFICO del síntoma (cuenta exacta), no un `toBeVisible()` genérico. Con
//      `test.fail()` puesto, un assert flojo se conforma con que el test falle por CUALQUIER motivo —
//      un selector podrido lo mantendría "verde" y el hallazgo se pudriría sin avisar.
//   2. `qa.step()` narra los pasos: es lo que aparece en el FAILURE.md del bundle y lo que hace que
//      otro pueda entender el ataque sin releer el código.
//   3. `test.fail()` se añade DESPUÉS de haber corrido el spec sin él. El bundle —la evidencia— solo
//      nace cuando el fallo es inesperado; si pones `test.fail()` de entrada, te quedas sin prueba.

import { test, expect } from "../../fixtures/qa-bundle";

test("A1 · doble submit del alta crea dos proyectos", async ({ page, qa }) => {
  // Hallazgo ABIERTO: se espera que falle, así CI sigue verde mientras el bug vive.
  // Cuando alguien lo arregle, el test pasará, Playwright lo marcará en rojo por "esperaba fallo" y
  // esa es la señal para BORRAR esta línea → el ataque queda como recorrido gate permanente.
  test.fail();

  const nombre = `Adversario A1 ${Date.now()}`;

  qa.step("abrir el alta de proyecto");
  await page.goto("/projects");

  qa.step(`rellenar el formulario con "${nombre}"`);
  await page.getByLabel("Nombre", { exact: true }).fill(nombre);

  // El ataque: dos envíos en la misma vuelta del event loop, como un doble click real o dos pestañas.
  qa.step("enviar dos veces sin esperar a la primera respuesta");
  const enviar = page.getByRole("button", { name: "Crear", exact: true });
  await Promise.all([enviar.click(), enviar.click()]);

  qa.step("contar cuántos proyectos con ese nombre existen");
  await page.goto("/projects");
  const filas = page.getByRole("link", { name: nombre, exact: true });

  // Lo que la app DEBE hacer: un envío, un proyecto. Hoy hay dos (el hallazgo), así que esto falla y
  // `test.fail()` lo absorbe. Cuando llegue el fix —botón deshabilitado tras el primer click, o
  // idempotencia en la server action— este mismo assert pasará y el spec se queda como gate tal cual.
  await expect(filas).toHaveCount(1);
});
