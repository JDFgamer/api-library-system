# D06 — Cotizaciones y pedidos del bot: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-06
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D06-T01 — Cotización básica

**Trazabilidad:** UC-16, UC-17, UC-18 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** P1 stock10 precio100, CA A. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /quotes/preview y POST /quotes con items P1 cantidad2 discount10; GET lista e id; PATCH /quotes/id/cancel.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Subtotal200 total190; preview no persiste; creación no descuenta stock según política propuesta sin reserva; cancelación cambia estado una vez. GET conserva DTO legacy.

**Automatización:** implementar caso D06-T01 en `src/test/migration/phase-06`. Ejecutar mediante runner `--case D06-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D06-T02 — Ítems acumulados y tenant

**Trazabilidad:** UC-16, UC-17, UC-18 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Cotización A contiene8 P1; P1 stock10; producto B disponible. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Invocar caso de uso AddQuoteItems con3 P1; repetir con productoB usando tenantA. No inventar ruta HTTP: probar puerto de aplicación y caller del bot.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Conflicto409 equivalente de dominio por acumulado11; producto ajeno404. Cotización sigue con8 unidades y total800.

**Automatización:** implementar caso D06-T02 en `src/test/migration/phase-06`. Ejecutar mediante runner `--case D06-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D06-T03 — Pago y recuperación

**Trazabilidad:** UC-16, UC-17, UC-18 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Pedido A2 P1 total200; caja y stock disponibles. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /ai/admin/orders/id/pay {paymentMethod:'cash'} en paralelo dos veces; inyectar fallo tras insertar venta antes de confirmar pedido; reintentar después del fallo.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Una venta ligada al pedido, stock descontado2 una vez, caja+200 una vez, pedido paid. Fallo revierte todo o reintento recupera misma venta; nunca segunda venta.

**Automatización:** implementar caso D06-T03 en `src/test/migration/phase-06`. Ejecutar mediante runner `--case D06-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D06-T04 — Estados y aviso público

**Trazabilidad:** UC-16, UC-17, UC-18 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Pedido A no pagado; botKeyA y slugA. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Actualizar customer con nombre/teléfono; consultar whatsapp; POST /ai/orders/code/paid; admin status confirmed luego ready; cobrar; intentar cancelar pedido paid.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Cliente actualizado y enlace asociado al pedido; aviso público no crea venta ni confirma fondos. Estados legales avanzan; cancelar paid409 sin alterar venta.

**Automatización:** implementar caso D06-T04 en `src/test/migration/phase-06`. Ejecutar mediante runner `--case D06-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D06-T05 — Códigos y autenticación pública

**Trazabilidad:** UC-16, UC-17, UC-18 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Pedido antiguo PED-1234 y nuevo formato generado; tenants A/B. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Acceder a ambos códigos con botKey/slug correctos; cambiar botKey o slug a B; forzar colisión del generador y reintentar creación.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Ambos formatos aceptados; credencial incorrecta401, pedido ajeno404; no filtra datos. Colisión no sobrescribe pedido y genera código alternativo con límite de reintentos explícito.

**Automatización:** implementar caso D06-T05 en `src/test/migration/phase-06`. Ejecutar mediante runner `--case D06-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D06-T06 — Paridad de pedidos y rollback

**Trazabilidad:** UC-16, UC-17, UC-18 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Pedidos legacy y nuevos. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Listar /ai/admin/orders y /quotes con filtros; revertir a lector puente y consultar/cobrar pedido de código nuevo dos veces.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Sin pérdida de IDs, estados ni importes; lista paginada por tenant. Rollback reconoce nuevo código y pago permanece único.

**Automatización:** implementar caso D06-T06 en `src/test/migration/phase-06`. Ejecutar mediante runner `--case D06-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-16, UC-17, UC-18, ejecutar con fixture separado:

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
