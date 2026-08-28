# Informe adversario — <feature> (<T-XXX>)

<!--
  Plantilla del rol `qa-adversario` (skill qa-adversarial, doctrina_adversarial).
  Copia este fichero a Contexto_Base_SRE/trayectorias/<T-XXX>/artifacts/informe-adversario.md.
  Las cuatro secciones de abajo son OBLIGATORIAS: `adversarial-presence.sh` comprueba que están.
  Comprueba que existen, no si fueron agresivas — eso no lo puede medir un script.
-->

- **Trayectoria:** <T-XXX> · **PR:** #<n> · **Fecha:** <YYYY-MM-DD>
- **Superficie atacada:** <rutas/pantallas>
- **Entorno:** staging efímero (`qa-staging.sh`), local · sin cloud

## Promesa

<Una línea: qué promete esta feature, leída del contrato/spec y NO del diff. Si no puedes escribirla,
no tienes contra qué atacar — vuelve al contrato antes de seguir.>

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| A1 | <si envío el formulario dos veces en 200 ms, se crean dos proyectos> | 🔴 roto / 🟢 aguantó |
| A6 | <nombre de 10.000 caracteres> | 🟢 aguantó |

**Descartadas y por qué:** <A3 (no hay mutación de red en esta pantalla), A7 (superficie sin recursos por
usuario)…>. Un descarte razonado es información; un descarte silencioso parece cobertura.

## Hallazgos

### H1 · <clase> · <título de una línea>

- **Qué se consigue:** <el efecto observable, en términos del usuario, no del código>
- **Repro:** `tests/e2e/journeys/adversarial/<archivo>.spec.ts`
- **Bundle:** `qa-bundles/<snapshotId>/FAILURE.md`
- **Estado:** abierto (`test.fail()` puesto) / arreglado (`test.fail()` retirado → gate permanente)
- **Severidad:** <corrupción de estado / pérdida de datos / bloqueo del usuario / molestia>
- **Escalado:** <sí, al rol `seguridad` (clase A7) / no>

## No reproducidos

Sospechas que **no** se materializaron. Se listan a propósito: sin esto, una pasada estéril y una pasada
alucinada se ven igual desde fuera.

| Sospecha | Qué pasó al intentarlo |
|---|---|
| <la sesión caducada pierde el borrador> | <redirige a login y vuelve con el borrador intacto> |

## Juicios de producto (A12 — sin test, ponderar como tales)

<Lo que la clase A12 destapa no siempre tiene reproducción. Va aquí, marcado como juicio y no como hecho,
para que el lector lo pese distinto.>

## Recuento

**<N> reproducidos · <M> no reproducidos · <K> juicios de producto** → al ledger
(`04_Logs_de_Trayectoria/adversarial_ledger.md`).
