# Reproducciones adversarias

Cada fichero de aquí es un **hallazgo del pase adversario** reproducido (skill `qa-adversarial`,
`[[doctrina_adversarial]]`). Reglas que no se negocian:

- El assert afirma **el comportamiento correcto**, nunca el síntoma del bug. Así el mismo spec pasa
  a verde el día del fix, sin tocar una línea.
- Mientras el bug esté **abierto**, el spec lleva `test.fail()`: CI sigue verde y el hallazgo queda
  documentado y ejecutable. Cuando alguien lo arregle, Playwright avisará de que "pasó lo que se
  esperaba que fallara" → **quita `test.fail()`** y el ataque queda como gate permanente.
- Escribe el spec **sin** `test.fail()` la primera vez y córrelo: ahí nace el failure bundle, que es
  la evidencia. Con `test.fail()` puesto de entrada no hay bundle (el fallo era el esperado).
- Nombra por clase: `a1-doble-submit.spec.ts`, `a7-recurso-ajeno.spec.ts`.
