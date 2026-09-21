# D05 — Núcleo financiero transaccional: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-05
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D05-T01 — Venta y dinero exacto

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Caja A apertura 1000; P1 precio100 stock10. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /sales/preview y POST /sales con {items:[{product:P1,quantity:2}],discount:10,paymentMethod:'cash',amountReceived:200}; usar Idempotency-Key QA-S1 en creación.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Preview 200 sin escrituras; creación 201, subtotal200 total190 change10, stock8 y efecto caja+190. Probar dominio Money con 0.1+0.2:30 centavos y DTO0.30.

**Automatización:** implementar caso D05-T01 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T02 — Métodos y servicios

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Reset independiente por cash/transfer/credit; CA balance0; servicio precio50 stock0. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Vender P1 por100 con cada paymentMethod; para credit incluir clientId=CA; vender servicio sin stock. Consultar cuenta y caja.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Cash afecta efectivo+100; transfer registra100 sin aumentar efectivo físico; credit balanceCA=100 sin ingreso efectivo. Servicio vendible sin stock negativo; crédito sin cliente=400.

**Automatización:** implementar caso D05-T02 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T03 — Stock concurrente e idempotencia

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** P1 stock1; caja abierta; misma escuela. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Enviar dos ventas con claves diferentes y cantidad1 en paralelo. Resetear stock10; enviar 10 solicitudes idénticas clave QA-S2; reenviar QA-S2 con cantidad2; repetir clave en B con fixture B.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Primera carrera: una201, otra409, stock0 y una venta. Reintentos: mismo ID/status201, una venta y un descuento de stock. Payload distinto409. Clave B independiente.

**Automatización:** implementar caso D05-T03 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T04 — Atomicidad y numeración

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** P1 stock10, caja1000, CA balance0. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Parametrizar failpoint después de stock, venta, caja, crédito y antes de commit; crear venta y leer desde conexión externa tras error. Luego ejecutar20 ventas concurrentes con stock100 y claves únicas.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Por fallo: stock10, saldo1000, balance0, cero ventas/movimientos nuevos. Lote exitoso:20 ventas, números únicos por escuela; se permiten huecos, nunca duplicados. No 500 por carrera de número.

**Automatización:** implementar caso D05-T04 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T05 — Devolución parcial y anulación

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Venta cash de2 P1 a100, sin descuento, stock inicial10; ejecutar variantes con reset. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /sales/id/return {reason:'QA',items:[{productId:P1,quantity:1}],method:'cash'}; intentar devolver2 más. En otra venta POST /void {reason:'QA'} dos veces.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Primera devolución200, documento con number y originalSale, stock9, reembolso100. Exceso409 sin cambios. Anulación revierte total y stock una vez; segunda409. No se admite devolución sobre venta anulada.

**Automatización:** implementar caso D05-T05 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T06 — Devolución genérica y nota

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Caja abierta; cliente CA; venta de100. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /sales/returns {items:[{product:P1,quantity:1}],clientId:CA,method:'cash'} en fixture separado. POST /sales/id/credit-note con reason QA y repetir.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Genérica201 y efecto según contrato contable documentado; número obligatorio presente. Nota201 vinculada al original; repetición409 o replay de misma clave, nunca doble compensación. Matriz de stock/caja/crédito fijada antes de implementar este caso.

**Automatización:** implementar caso D05-T06 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T07 — Cobros e imputación

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Dos ventas crédito CA:100 antigua y200 nueva; balance300; política FIFO propuesta. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /credits/client/CA/settle {amount:150,method:'cash'}; consultar crédito/historial. Pagar150 restantes. Resetear balance100; lanzar dos cobros80 concurrentes con claves distintas.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Primer pago saldo150: venta100 settled y venta200 pendiente150; segundo saldo0 y ambas settled. Carrera: un cobro80 exitoso, otro409, saldo20. Sobrepago rechazado sin movimientos huérfanos.

**Automatización:** implementar caso D05-T07 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T07`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T08 — Deuda vencida y aislamiento

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Reloj fijo; deuda antigua100 y reciente200, pago50 aplicado a antigua; vencimiento30 días en fixture. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. GET /credits?overdue=true y /credits/summary; GET /credits/history y /client/CA. Admin B intenta cobrar CA; seller A intenta /credits.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Vencido50 y deuda total250; reportes e historial concilian. B404, seller403. Cambiar filtro overdue=false no se interpreta como true.

**Automatización:** implementar caso D05-T08 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T08`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D05-T09 — Rollback financiero

**Trazabilidad:** UC-13, UC-14, UC-15 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Artefacto compatible anterior disponible y dataset de candidato con ventas, devoluciones y pagos. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Desplegar rollback en staging; leer operaciones nuevas, crear siguiente venta y reintentar cobro con misma clave; comparar números y balances.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** ID de cobro repetido estable, ningún pago duplicado, numeración continúa y saldos coinciden. Si artefacto no soporta datos nuevos: prueba BLOCKED y se impide rollback automático.

**Automatización:** implementar caso D05-T09 en `src/test/migration/phase-05`. Ejecutar mediante runner `--case D05-T09`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-13, UC-14, UC-15, ejecutar con fixture separado:

| Variante | Acción | Assertion |
|---|---|---|
| Positiva | Actor habilitado y payload válido capturado en contrato | Status, schema, campos y efectos exactos del contrato |
| Entrada inválida | Omitir campo requerido o usar ID mal formado | 400 y cero escrituras cuando aplique validación |
| Sin credencial | Omitir JWT o botKey en ruta protegida por esa credencial | 401; sin datos privados |
| Rol insuficiente | Usar seller contra operación de admin o admin contra superadmin | 403; cero cambios |
| Tenant B | Cambiar ID por recurso B con token/credencial A | 404 o rechazo de credencial según contrato; B intacto |
| Lectura | Repetir GET y comparar conteos de negocio | Sin mutaciones de negocio; exceptuar aprovisionamiento explícito de settings |
| Paginación | Página1 y2 con limit1 sobre2 registros del tenant | Sin IDs duplicados y total correcto |
| Compatibilidad | Mismo fixture con candidato y versión base compatible | DTO/status equivalentes salvo cambio registrado |

Si una variante no aplica (por ejemplo rol en endpoint público), registrar N/A con justificación. No aplicar N/A a pruebas financieras, de tenant o de credenciales cuando la operación las requiere.

## Cierre de pruebas

Todos los escenarios obligatorios y sus variantes deben quedar PASS. Adjuntar logs, datos iniciales/finales y versión del contrato. Los casos FAIL o BLOCKED quedan pendientes de resolver. Registrar también resultado de suites anteriores y pruebas de recuperación aplicables; ningún resultado se presume por haber pasado lint/build.
