# D04 — Cajas y movimientos: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-04
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D04-T01 — Apertura y cierre

**Trazabilidad:** UC-11, UC-12 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Seller A asociado a POS A, sin caja abierta. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /cash-shifts/open {openingAmount:1000}; guardar shiftId; GET /active y /:id/detail; POST /:id/close {closingAmount:1000,note:'QA'}.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Apertura crea una caja open; consultas muestran mismo ID y apertura 1000. Cierre deja closed y diferencia 0; /active informa ausencia según contrato.

**Automatización:** implementar caso D04-T01 en `src/test/migration/phase-04`. Ejecutar mediante runner `--case D04-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D04-T02 — Apertura concurrente

**Trazabilidad:** UC-11, UC-12 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Dos usuarios autorizados en mismo POS A, sin cajas. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Enviar simultáneamente dos POST /cash-shifts/open con openingAmount=1000; contar cajas abiertas por school/POS.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Exactamente una creación exitosa y un 409; una sola caja open. En POS diferente ambas aperturas pueden prosperar.

**Automatización:** implementar caso D04-T02 en `src/test/migration/phase-04`. Ejecutar mediante runner `--case D04-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D04-T03 — Movimientos y aliases

**Trazabilidad:** UC-11, UC-12 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Caja A abierta con 1000. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /cash-shifts/shiftId/movements {type:'in',category:'change',amount:200,description:'QA ingreso'}; POST alias /cash-movements/cash-shifts/shiftId/movements con out/expense/50. Consultar ambos listados y aggregated.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Dos movimientos, ingreso 200 y egreso 50; saldo esperado 1150. Ambos aliases listan las mismas operaciones sin duplicarlas.

**Automatización:** implementar caso D04-T03 en `src/test/migration/phase-04`. Ejecutar mediante runner `--case D04-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D04-T04 — Caja cerrada y caja ajena

**Trazabilidad:** UC-11, UC-12 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Caja A cerrada, caja B abierta. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Intentar movimiento en A cerrada y B usando seller A. Repetir cierre A. Consultar detalle B.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 409 sobre estado cerrado, 404 sobre B. Sin movimientos nuevos ni alteración de cierre anterior.

**Automatización:** implementar caso D04-T04 en `src/test/migration/phase-04`. Ejecutar mediante runner `--case D04-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D04-T05 — Listado y borrado legado

**Trazabilidad:** UC-11, UC-12 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Caja A abierta y movimiento manual de egreso 50. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. GET /cash-movements/cash-movements; DELETE /cash-movements/cash-movements/movementId; consultar aggregated y /cash-shifts/summary/daily.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Sólo A visible; eliminación sigue contrato congelado y restaura efecto contable una sola vez. Repetición no revierte dos veces. Conservar evidencia de auditoría según política documentada.

**Automatización:** implementar caso D04-T05 en `src/test/migration/phase-04`. Ejecutar mediante runner `--case D04-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D04-T06 — Coexistencia y rollback

**Trazabilidad:** UC-11, UC-12 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Caja creada con candidato; P1 stock=10. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Crear venta cash de 100 por flujo legado sobre caja nueva; consultar caja con adapter nuevo. Cambiar al artefacto compatible y cerrar con saldo esperado.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Venta y cierre funcionan; saldo sube exactamente 100. Ninguna dependencia directa a modelos desde controllers migrados.

**Automatización:** implementar caso D04-T06 en `src/test/migration/phase-04`. Ejecutar mediante runner `--case D04-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-11, UC-12, ejecutar con fixture separado:

| Variante | Acción | Assertion |
|---|---|---|
| Request válido | Payload del contrato actual | Status, schema, campos y efectos equivalentes |
| Request inválido | Omitir campo requerido o usar ID mal formado | Respuesta de validación equivalente; sin escrituras cuando aplique |
| Lectura posterior | Repetir GET luego de una operación | Persistencia y DTOs equivalentes |
| Paginación | Página 1 y 2 con limit 1 sobre dos registros | Sin duplicados y total equivalente |
| Compatibilidad | Mismo fixture con candidato y versión base | DTO/status equivalentes salvo diferencias de mapeo documentadas |

Si una variante no aplica, registrar N/A con justificación.

## Cierre de pruebas

Todos los escenarios obligatorios y sus variantes deben quedar PASS. Adjuntar logs, datos iniciales/finales y versión del contrato. Los casos FAIL o BLOCKED quedan pendientes de resolver. Registrar también resultado de suites anteriores y pruebas de recuperación aplicables; ningún resultado se presume por haber pasado lint/build.
