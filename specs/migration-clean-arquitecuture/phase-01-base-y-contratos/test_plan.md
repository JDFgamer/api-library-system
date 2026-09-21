# D01 — Base de pruebas y contratos: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-01
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D01-T01 — API real y entradas de ejecución

**Trazabilidad:** UC-01, UC-02, UC-03 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Base sin ventas. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Importar createApp en Supertest sin abrir listener. GET /health. Ejecutar npm run build, levantar dist/server.js en entorno de prueba y repetir GET /health. Invocar también handler con la misma solicitud.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 200; status=ok y timestamp ISO válido en ambos modos. Cerrar aplicación, conexiones y replica set; el proceso termina sin handles abiertos.

**Automatización:** implementar caso D01-T01 en `src/test/migration/phase-01`. Ejecutar mediante runner `--case D01-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D01-T02 — Validación efectiva

**Trazabilidad:** UC-01, UC-02, UC-03 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Admin A autenticado. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. GET /products?page=2&limit=1&active=false; POST /sales/preview con items=[]; GET /products/no-es-objectid; repetir con page=0.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Consulta entrega página 2 y no trata false como true; inputs inválidos retornan 400 con estructura documentada, nunca 500. Ninguna escritura.

**Automatización:** implementar caso D01-T02 en `src/test/migration/phase-01`. Ejecutar mediante runner `--case D01-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D01-T03 — Contrato y rutas completas

**Trazabilidad:** UC-01, UC-02, UC-03 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Inventario de server.ts y routers; fixtures de contratos. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Enumerar cada método+ruta de los 15 routers montados y GET /health. Registrar status, JSON, headers, auth y aliases. Comparar implementación original y createApp con el mismo fixture; normalizar sólo IDs y timestamps dinámicos.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 100% de operaciones inventariadas tienen owner de fase y escenario de contrato. Sin diferencias no registradas. Errores conocidos se describen como correcciones objetivo, no como resultados correctos.

**Automatización:** implementar caso D01-T03 en `src/test/migration/phase-01`. Ejecutar mediante runner `--case D01-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D01-T04 — Transacción real

**Trazabilidad:** UC-01, UC-02, UC-03 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Fixture aislado; failpoint después de guardar una venta de prueba dentro de la sesión. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Guardar venta y movimiento en una transacción; provocar excepción antes del commit. Consultar por IDs desde una conexión diferente. Repetir sin failpoint.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Fallo: 0 documentos nuevos en ambas colecciones. Éxito: ambos visibles. Replica set operativo; no se sustituye Mongo por mocks para esta prueba.

**Automatización:** implementar caso D01-T04 en `src/test/migration/phase-01`. Ejecutar mediante runner `--case D01-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D01-T05 — Cobertura y arquitectura

**Trazabilidad:** UC-01, UC-02, UC-03 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Harness nuevo implementado. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. npm run test:coverage. Abrir coverage/coverage-final.json e inspeccionar rutas cubiertas; ejecutar test de imports de dominio/aplicación.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Aparecen archivos productivos reales en raíz y src, total de líneas mayor a 0. El test de arquitectura detecta una dependencia prohibida en un fixture negativo; la suite productiva queda verde.

**Automatización:** implementar caso D01-T05 en `src/test/migration/phase-01`. Ejecutar mediante runner `--case D01-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-01, UC-02, UC-03, ejecutar con fixture separado:

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
