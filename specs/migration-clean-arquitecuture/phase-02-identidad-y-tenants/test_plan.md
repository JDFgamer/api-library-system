# D02 — Identidad, permisos y aislamiento: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Preparación y protocolo compartidos](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Leer el protocolo global, implementar/disponer del harness D01 y preparar su fixture. Ejecutar en BD aislada con replica set. Tokens y IDs se resuelven desde el manifiesto. Cada caso y variante comienza con reset propio, salvo continuidad indicada explícitamente.

Los valores indicados son **resultados esperados**, no resultados observados. Estado inicial de todos los casos: NOT_RUN. Si falta runner, configuración, decisión contractual o failpoint requerido, registrar BLOCKED con motivo y no sustituir la prueba por una afirmación.

## Ejecución de la suite

Después de implementar el harness y los archivos de prueba:

```sh
npm run test:run -- src/test/migration/phase-02
```

Antes de cerrar la fase, ejecutar también npm run typecheck, npm run lint, npm run build y toda la regresión acumulada. Para ejecución humana se usan los mismos requests y assertions; concurrencia/fallos se disparan con el runner por ID descrito en el plan global.

## Casos detallados

### D02-T01 — Login y renovación

**Trazabilidad:** UC-04, UC-05, UC-06, UC-07 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Admin A, seller A, contraseñas/PIN del fixture. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. POST /auth/login y /auth/login-email con email/password de admin A; POST /auth/login-pin con pin/schoolId de seller A. GET /auth/me con cada access. POST /auth/refresh con refresh válido.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 200; identidad, rol y escuela correctos. Nuevo access usable en /auth/me. Ninguna contraseña, hash o botKey en respuesta.

**Automatización:** implementar caso D02-T01 en `src/test/migration/phase-02`. Ejecutar mediante runner `--case D02-T01`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D02-T02 — Tipos y revocación de token

**Trazabilidad:** UC-04, UC-05, UC-06, UC-07 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Tokens obtenidos en test anterior. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Usar access como refresh; usar refresh como Bearer en /auth/me; rotar refresh y reutilizar el anterior; avanzar reloj más allá de expiración; probar refresh ausente.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 401 para tokens incorrectos, revocados o expirados; 400 para campo requerido ausente. Sin emisión de sesiones en rechazos. Política nueva documentada para clientes.

**Automatización:** implementar caso D02-T02 en `src/test/migration/phase-02`. Ejecutar mediante runner `--case D02-T02`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D02-T03 — Matriz de permisos y tenant

**Trazabilidad:** UC-04, UC-05, UC-06, UC-07 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Dos escuelas; IDs de B conocidos por ejecutor. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Con seller A intentar POST /schools; con admin A intentar DELETE /schools/B y GET /users/usuarioB; con superadmin listar /admins; repetir sin token. GET /schools/public anónimo.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** 403 para rol insuficiente, 404 para recurso ajeno a un rol habilitado, 401 sin token en rutas privadas. Público sólo muestra campos permitidos de escuelas activas; B permanece intacta.

**Automatización:** implementar caso D02-T03 en `src/test/migration/phase-02`. Ejecutar mediante runner `--case D02-T03`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D02-T04 — Inactivación y gestión

**Trazabilidad:** UC-04, UC-05, UC-06, UC-07 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Base aislada por variante. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Parametrizar user, POS y school: desactivar cada uno y repetir login/refresh/operación protegida. Con admin A crear/editar/desactivar usuario y POS A; con superadmin gestionar admin A y credenciales propias.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Identidad inactiva no opera (401 propuesto); CRUD autorizado conserva contrato y tenant. /users/summary y listados reflejan cambios. Credenciales ajenas no modificables.

**Automatización:** implementar caso D02-T04 en `src/test/migration/phase-02`. Ejecutar mediante runner `--case D02-T04`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D02-T05 — Settings y aprovisionamiento

**Trazabilidad:** UC-04, UC-05, UC-06, UC-07 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Escuela A sin documento Setting. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. GET /settings; PUT /settings con campo permitido fijado en contrato y luego school=B, botKey y campos ajenos a allowlist. Ejecutar backfill dos veces.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** GET devuelve configuración válida sin error required key/value. PUT permitido persiste; campos prohibidos producen 400 sin cambios parciales. Backfill crea un solo registro válido por clave/escuela.

**Automatización:** implementar caso D02-T05 en `src/test/migration/phase-02`. Ejecutar mediante runner `--case D02-T05`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

### D02-T06 — Repositorios y rollback de sesión

**Trazabilidad:** UC-04, UC-05, UC-06, UC-07 (seleccionar operaciones del caso en inventario D01). **Necesario para cerrar la fase:** sí.

**Precondiciones y datos:** Adapters nuevos y legado endurecido disponibles. Usar fixture global y el actor indicado; si no se especifica actor para ruta privada, usar admin A con POS/caja válidos. Donde el test menciona seller usar seller A.

**Pasos:**

1. Preparar datos y registrar conteos/saldos iniciales; resolver aliases a IDs reales.
2. Ejecutar CRUD de identidad por puertos; comprobar imports. Emitir token con candidato, pasar al artefacto de rollback y probar /auth/me y login.
3. Consultar documentos afectados desde conexión independiente o API de lectura; comparar resultados HTTP y persistencia con las assertions siguientes.
4. Guardar request/response y evidencia de cada variante. Liberar conexiones y dejar el dataset aislado listo para reset.

**Resultado esperado y assertions:** Dominio/aplicación sin Mongoose/Express. Rollback permite login; tokens incompatibles se rechazan explícitamente, nunca elevan permisos.

**Automatización:** implementar caso D02-T06 en `src/test/migration/phase-02`. Ejecutar mediante runner `--case D02-T06`; el runner debe fallar si cualquier assertion no coincide. Unitarias de dominio pueden usar fakes; verificaciones de BD/concurrencia usan replica set y la aplicación real.

**Resultado obtenido:** pendiente de ejecución.  
**Estado:** NOT_RUN.  
**Evidencia / incidencia:** pendiente.

## Regresión parametrizada de todas las operaciones de la fase

Para cada método+ruta del inventario D01 asignado a UC-04, UC-05, UC-06, UC-07, ejecutar con fixture separado:

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
