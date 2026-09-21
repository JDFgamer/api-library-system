# D03 — Catálogo, inventario básico y clientes: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-03
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D03-T01 — CRUD de producto y servicio

**Trazabilidad:** UC-08, UC-09, UC-10 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Admin A; base reseteada. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /products con {name:'Cuaderno QA',type:'product',price:100,stock:10,code:'QA-P1'}; GET id; PATCH price=120; crear servicio price=50,stock=0; DELETE producto en fixture separado.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 201 en creación, lecturas/edición según contrato capturado; precio pasa a 120. Baja respeta semántica actual congelada; historial anterior mantiene precio original. Servicio no exige existencias para vender en fase 05.

**Automatización:** implementar caso D03-T01 en `src/test/migration/phase-03`. Ejecutar mediante runner `--case D03-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D03-T02 — Stock y concurrencia

**Trazabilidad:** UC-08, UC-09, UC-10 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** P1 stock=10. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. PATCH /products/P1/stock con {quantity:5,operation:'add'}; luego {quantity:4,operation:'set'}; luego {quantity:-5,operation:'add'}. Resetear stock=1 y lanzar dos decrementos de -1 en paralelo.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Stock 15, luego 4; decremento inválido 409 y stock 4. En concurrencia sólo un decremento exitoso, otro 409, stock final 0.

**Automatización:** implementar caso D03-T02 en `src/test/migration/phase-03`. Ejecutar mediante runner `--case D03-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D03-T03 — Filtros y stock bajo

**Trazabilidad:** UC-08, UC-09, UC-10 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** P1 activo stock=2 minStock=3; P2 inactivo; producto B homónimo. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. GET /products?active=false; GET /products/low-stock; listar con page=1&limit=1 y page=2&limit=1; buscar nombre.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** active=false devuelve sólo inactivos de A; low-stock incluye P1; páginas sin duplicados y total correcto. Nunca productos B.

**Automatización:** implementar caso D03-T03 en `src/test/migration/phase-03`. Ejecutar mediante runner `--case D03-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D03-T04 — Clientes e historia

**Trazabilidad:** UC-08, UC-09, UC-10 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Cliente CA dni único y cliente CB de B. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /clients con fullName/dni válidos; GET, PATCH, consultar /history y /debtors; intentar DNI duplicado en A; usar DNI igual en B.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** CRUD conserva contrato; duplicado A=409; DNI en B permitido. CA sin deuda no aparece en deudores; historial coincide con sus operaciones.

**Automatización:** implementar caso D03-T04 en `src/test/migration/phase-03`. Ejecutar mediante runner `--case D03-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D03-T05 — Aislamiento de repositorios

**Trazabilidad:** UC-08, UC-09, UC-10 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Admin A y seller A; IDs P_B y C_B. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Admin A lee/modifica/elimina P_B y C_B; seller A intenta crear producto. Probar puertos directamente con tenant A e ID B.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 404 en recursos ajenos, 403 al crear producto con seller; documentos B sin cambios. Repositorio tampoco retorna entidad B.

**Automatización:** implementar caso D03-T05 en `src/test/migration/phase-03`. Ejecutar mediante runner `--case D03-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D03-T06 — Compatibilidad de datos e índices

**Trazabilidad:** UC-08, UC-09, UC-10 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Copia sintética con producto legacy y duplicados de código. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Leer documento legacy con adapter nuevo y anterior; ejecutar auditoría y migración de índices dos veces sin corregir duplicados.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** DTOs equivalentes; auditoría enumera IDs duplicados y bloquea índice conflictivo sin borrar datos. Tras resolver fixture, ejecución repetida no duplica índices.

**Automatización:** implementar caso D03-T06 en `src/test/migration/phase-03`. Ejecutar mediante runner `--case D03-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-08, UC-09, UC-10, ejecutar con fixture separado:

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
