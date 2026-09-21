# D07 — Asistente, conversaciones y servicios externos: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-07
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D07-T01 — SSE determinista

**Trazabilidad:** UC-19, UC-20, UC-21, UC-22 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** BotA activo; LLM fake retorna dos fragmentos conocidos. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /ai/chat {slug:slugA,botKey:botKeyA,sessionId:'qa-session-01',message:'Hola'}; leer stream hasta cierre con timeout10s; consultar /ai/history para misma sesión.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 200 text/event-stream, frames válidos event/data y separación en blanco; orden/tipos coinciden con snapshot fase01. Texto final coincide con fake y queda en historial de A.

**Automatización:** implementar caso D07-T01 en `src/test/migration/phase-07`. Ejecutar mediante runner `--case D07-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D07-T02 — Desconexión y fallos

**Trazabilidad:** UC-19, UC-20, UC-21, UC-22 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Fake LLM lento, y variante que falla antes/después de headers. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Abrir chat y abortar cliente tras primer fragmento; observar cancelación. Repetir con timeout proveedor y error antes de headers.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Cancelación libera stream y trabajo; no doble respuesta ni handles abiertos. Error previo HTTP documentado; posterior evento error según contrato y cierre; no se escribe JSON HTTP sobre SSE ya abierto.

**Automatización:** implementar caso D07-T02 en `src/test/migration/phase-07`. Ejecutar mediante runner `--case D07-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D07-T03 — Intervención humana

**Trazabilidad:** UC-19, UC-20, UC-21, UC-22 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Conversación A creada. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Listar /ai/admin/conversations; GET id; PATCH pause; POST reply {content:'Te responde QA'}; enviar chat público; PATCH resume y enviar otro.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Pausada no invoca LLM; respuesta humana aparece una vez; reanudada vuelve a invocarlo. B no puede leer ni responder conversación A (404).

**Automatización:** implementar caso D07-T03 en `src/test/migration/phase-07`. Ejecutar mediante runner `--case D07-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D07-T04 — Configuración, rotación y add-on

**Trazabilidad:** UC-19, UC-20, UC-21, UC-22 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Admin A y superadmin; bot activo. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. GET/PUT /ai/admin/config con greeting válido; POST /rotate-key; consultar config pública con clave vieja/nueva. Superadmin deshabilita bot; repetir chat. Admin intenta /superadmin/bots.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Greeting actualizado; clave vieja401, nueva válida. Bot deshabilitado no invoca LLM ni crea pedidos. Admin403 en superadmin. Respuestas públicas nunca exponen hash ni claves internas.

**Automatización:** implementar caso D07-T04 en `src/test/migration/phase-07`. Ejecutar mediante runner `--case D07-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D07-T05 — Límites y métricas

**Trazabilidad:** UC-19, UC-20, UC-21, UC-22 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Fake clock y umbral configurado en fixture; contadores iniciales0. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Enviar límite permitido de chats y uno adicional; consultar /ai/admin/metrics; simular herramienta que recibe productId B; repetir sesión de A desde B.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Exceso429 antes de SSE; métricas reflejan usos exitosos y fallos según definición congelada. Herramienta rechaza B y no genera venta/consulta ajena; historial no cruza tenant.

**Automatización:** implementar caso D07-T05 en `src/test/migration/phase-07`. Ejecutar mediante runner `--case D07-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D07-T06 — Adapters y rollback

**Trazabilidad:** UC-19, UC-20, UC-21, UC-22 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Adapters fake para cada integración efectivamente usada; conversación preexistente. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Ejecutar suite con red externa bloqueada; simular éxito/error del proveedor en callers reales. Revertir candidato y leer conversación/config actuales.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Suite sin red paga; errores tipados sin secretos en logs. Datos legibles tras rollback y clave revocada sigue rechazada.

**Automatización:** implementar caso D07-T06 en `src/test/migration/phase-07`. Ejecutar mediante runner `--case D07-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-19, UC-20, UC-21, UC-22, ejecutar con fixture separado:

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
