# D08 — Reportes, regresión completa y cierre: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-08
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D08-T01 — Oráculo de jornada

**Trazabilidad:** UC-23, UC-24, UC-25 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Reloj fijo; caja1000, P1stock10, CA deuda0. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Venta cash2x100; devolución1x100; venta crédito1x100; cobro efectivo40; cerrar con1140. Consultar detalle caja, crédito y dashboard.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Caja1140=1000+200-100+40; deuda60; stock8=10-2+1-1. Reportes distinguen venta neta200 de cobro40, sin contarlo como venta extra.

**Automatización:** implementar caso D08-T01 en `src/test/migration/phase-08`. Ejecutar mediante runner `--case D08-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D08-T02 — Todos los reportes y fechas

**Trazabilidad:** UC-23, UC-24, UC-25 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Ventas a2026-09-20T02:59:59Z y03:00:00Z; zona America/Argentina/Tucuman. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Consultar cada una de las7 rutas dashboard con filtros válidos del schema, desde20/09 00:00 local; añadir ventaB grande para detectar contaminación.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Sólo segunda venta pertenece al día local20. Sumas por hora, productos y cierre concilian con ventas/devoluciones; ningún dato B. Congelar en contrato semántica temporal por endpoint antes de comparar.

**Automatización:** implementar caso D08-T02 en `src/test/migration/phase-08`. Ejecutar mediante runner `--case D08-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D08-T03 — Carga reproducible

**Trazabilidad:** UC-23, UC-24, UC-25 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** 10.000 ventasA,10.000B y1.000 productos sintéticos; misma máquina y dataset para baseline/candidato. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Calentar30s; ejecutar1000 GET con concurrencia10 distribuidos entre dashboard/overview, sales y products; medir p50,p95,5xx y explain de consultas principales.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 0 errores inesperados; p95 candidato<=1.20x baseline bajo mismo entorno. Registrar docsExamined/keysExamined y plan; agregaciones grandes pueden escanear rango, evaluar con mediciones y sin prometer COLLSCAN=0 universal.

**Automatización:** implementar caso D08-T03 en `src/test/migration/phase-08`. Ejecutar mediante runner `--case D08-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D08-T04 — Arquitectura y rutas completas

**Trazabilidad:** UC-23, UC-24, UC-25 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Todos los módulos nuevos y contratos fase01. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Ejecutar pruebas de imports, contrato completo y todas las suites phase-01..08. Comparar operaciones inventariadas con OpenAPI y tabla de owner.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Cero rutas sin caso/test; cero imports Express/Mongoose en dominio/aplicación y cero modelos en controllers migrados. Exports nombrados al final; ninguna referencia productiva a servicios internos retirados.

**Automatización:** implementar caso D08-T04 en `src/test/migration/phase-08`. Ejecutar mediante runner `--case D08-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D08-T05 — Rollback completo

**Trazabilidad:** UC-23, UC-24, UC-25 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Staging versión08 con datos creados por08. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Registrar ventas/cobros/códigos nuevos; volver a07; leerlos y realizar una venta/cobro seguro de staging; reinstalar08 y conciliar.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Datos legibles en ambas versiones; contadores continúan y clave repetida no duplica. Stock/saldos idénticos a oráculo tras alternar versiones.

**Automatización:** implementar caso D08-T05 en `src/test/migration/phase-08`. Ejecutar mediante runner `--case D08-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D08-T06 — Verificación de entrega

**Trazabilidad:** UC-23, UC-24, UC-25 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Todas las suites acumuladas terminadas. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Consultar /health, /auth/me y los listados afectados sobre la versión probada. Si ya se publicó, registrar el deploy ID y repetir esas lecturas sobre el deploy; las operaciones financieras se verifican con datos aislados.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Las respuestas coinciden con el contrato; los casos financieros y de tenant no presentan diferencias. Guardar resultado y evidencia de las consultas, junto con el deploy ID o “sin deploy” si la ejecución fue local.

**Automatización:** implementar caso D08-T06 en `src/test/migration/phase-08`. Ejecutar mediante runner `--case D08-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-23, UC-24, UC-25, ejecutar con fixture separado:

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
