# Plan de trabajo individual con IA

Leer primero [spec.md](spec.md). Este plan está pensado para que vos lo trabajes con ayuda de IA, avanzando por cambios pequeños y comprobables. No hay calendario, estimaciones ni roles de equipo que asignar.

## Orden de las fases

| Fase | Carpeta | Casos de uso | Dependencia |
|---|---|---|---|
| D01 | [phase-01-base-y-contratos](phase-01-base-y-contratos/plan.md) | UC-01, UC-02, UC-03 | Baseline actual |
| D02 | [phase-02-identidad-y-tenants](phase-02-identidad-y-tenants/plan.md) | UC-04, UC-05, UC-06, UC-07 | D01 |
| D03 | [phase-03-catalogo-y-clientes](phase-03-catalogo-y-clientes/plan.md) | UC-08, UC-09, UC-10 | D02 |
| D04 | [phase-04-cajas-y-movimientos](phase-04-cajas-y-movimientos/plan.md) | UC-11, UC-12 | D03 |
| D05 | [phase-05-ventas-devoluciones-y-creditos](phase-05-ventas-devoluciones-y-creditos/plan.md) | UC-13, UC-14, UC-15 | D04 |
| D06 | [phase-06-cotizaciones-y-pedidos](phase-06-cotizaciones-y-pedidos/plan.md) | UC-16, UC-17, UC-18 | D05 |
| D07 | [phase-07-asistente-y-adaptadores](phase-07-asistente-y-adaptadores/plan.md) | UC-19, UC-20, UC-21, UC-22 | D06 |
| D08 | [phase-08-reportes-y-cierre](phase-08-reportes-y-cierre/plan.md) | UC-23, UC-24, UC-25 | D07 |

D01–D08 identifican fases y se conservan para mantener las referencias de los tests. **No son el deploy ID real**. Podés hacer varias entregas en una fase o agrupar fases ya probadas; registrá el deploy ID cuando efectivamente publiques.

D04 prepara cajas; D05 migra juntos ventas, stock y créditos, incluidos los llamados desde pedidos existentes. D06 migra la gestión de pedidos sobre ese núcleo.

## Cómo trabajar cada fase

1. Leer su spec.md y elegir un caso de uso o un cambio acotado del plan.md.
2. Implementarlo con IA y revisar el cambio.
3. Ejecutar los tests correspondientes y la regresión de los flujos afectados.
4. Guardar evidencia: qué ejecutaste, qué esperabas, qué pasó y sobre qué commit.
5. Corregir fallos antes de dar el caso por terminado. Al cerrar la fase, ejecutar su suite completa y las pruebas acumuladas.
6. Cuando hagas un deploy, anotar su ID y comprobar los flujos modificados. Si todavía no publicaste, dejar “sin deploy”.

Si cambia la estructura de datos, probar primero con datos aislados y conservar una nota breve de compatibilidad con la versión anterior. Las pruebas de recuperación que protegen ventas y cobros se mantienen en sus test_plan.md.

## Registro simple de avance

Se puede repetir este registro tantas veces como haga falta dentro del plan de cada fase.

| Campo | Valor |
|---|---|
| Fase / casos de uso | Dxx / UC-xx |
| Estado | Pendiente, en curso, probado o con fallos |
| Commit | Hash del cambio probado |
| Deploy ID | Sin deploy; completar con el ID real al publicar |
| Tests ejecutados | IDs Dxx-Tyy |
| Resultado | PASS, FAIL, BLOCKED o NOT_RUN |
| Evidencias | Ruta o enlace a logs, respuestas y assertions |
| Pendientes | Fallos o decisiones que faltan resolver |

No hace falta un pipeline o entorno de staging obligatorio para seguir este plan. Las pruebas con escrituras usan datos aislados; no ventas o cobros reales.

## Protocolo de pruebas compartido

Cada test_plan.md es ejecutable como procedimiento manual o como especificación de automatización. Los escenarios detallan fixture, acciones y resultados verificables. Los comandos siguientes se ejecutan desde la raíz del repositorio.

### Comandos existentes

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:coverage
```

Registrar código de salida y logs de cada comando. Las pruebas actuales sobre src/test/test-server.ts no sustituyen las de createApp. La cobertura debe incluir producción en raíz y src; el baseline de líneas debe ser mayor que cero. Para código nuevo de dominio/aplicación se propone>=80% líneas y>=80% branches por módulo, además de todos los escenarios críticos obligatorios. La cobertura acompaña las pruebas de comportamiento; no reemplaza sus resultados.

### Harness a implementar en D01

Crear `src/test/migration/phase-XX/*.test.ts`, fixtures compartidos y `src/test/migration/run-case.ts`. No existen todavía por el solo hecho de redactar esta documentación.

Contrato propuesto del runner:

```sh
NODE_ENV=test npx tsx src/test/migration/run-case.ts --case D05-T03 --reset --evidence-dir /tmp/migration-evidence
npm run test:run -- src/test/migration/phase-05
```

El runner implementado debe buscar el ID de este plan, levantar MongoMemoryReplSet y createApp, preparar el fixture, ejecutar pasos/assertions y cerrar recursos. Sale0 sólo si pasa,1 si falla y2 si faltan precondiciones. `--reset` sólo reinicia la base efímera creada por ese proceso. Debe rechazar URI de producción, no cargar automáticamente credenciales .env productivas ni usar seed:prod. No ejecutar estos comandos propuestos hasta implementar el runner en D01.

La salida debe incluir requests y responses sanitizados, comprobaciones de BD antes/después y resultado de cada assertion. Las rutas sin exposición HTTP se prueban por el puerto de aplicación; no agregar endpoints QA a producción.

### Fixture común y preparación reproducible

D01 implementará `createMigrationFixture()` con los modelos vigentes exclusivamente en el setup de integración, para no depender de que CRUD aún no migrados funcionen. La función crea hashes válidos y devuelve un manifiesto de IDs, credenciales de prueba y referencias. Los tests usan alias del manifiesto, nunca ObjectIds imaginarios.

| Alias | Datos de base |
|---|---|
| A / B | Dos escuelas activas, códigos QA-A/QA-B, slugs qa-a/qa-b |
| SA | Superadmin; email qa-super@example.test |
| AA / AB | Admin por escuela; emails qa-admin-a@example.test y qa-admin-b@example.test |
| VA / VB | Seller por escuela; PIN1234/5678; POS asociado |
| POS_A / POS_B | Activos y pertenecientes a su escuela |
| P1 | A; producto QA-P1, precio100.00, costo60.00, stock10, minStock3 |
| P_B | B; mismo precio/stock, otro ID |
| S1 | A; servicio precio50.00, stock0 |
| CA / CB | Cliente por escuela, balance0, DNI90000001/90000002 |
| Settings A/B | Documento válido según schema actual, bot activado para tests AI |
| botKeyA/B | Claves sintéticas de>=16 caracteres, hash/almacenamiento conforme al código |
| Reloj | Fijo2026-09-20T15:00:00Z; timestamps especiales sólo en tests que lo indiquen |

Contraseña sintética común sugerida `QaMigration-2026!`, nunca usar credenciales reales. Las claves/tokens se mantienen en memoria y se omiten de evidencia. El setup devuelve `tokens.adminA`, `tokens.sellerA`, etc., obtenidos por login HTTP, no firmados manualmente salvo tests unitarios de JWT.

Las cajas comienzan cerradas/ausentes y se abren en cada caso que las necesite. Cada test y cada variante se ejecuta sobre fixture independiente. Variantes que reutilizan datos lo dicen expresamente. Cantidades monetarias del plan están en unidades monetarias públicas; el dominio usa centavos desde D05. No confundir importe con unidades de stock.

### Procedimiento para una persona

1. Preparar entorno local/staging aislado y ejecutar el fixture D01, obtener manifiesto y URL base.
2. Abrir cliente HTTP. Sustituir P1, CA, shiftId, etc. por sus IDs del manifiesto o respuesta anterior.
3. En requests privados agregar Authorization: Bearer con el actor indicado; enviar Content-Type: application/json en cuerpos JSON.
4. Seguir los pasos numerados del caso, capturar respuesta y consultar por API o por modelos con conexión de lectura al mismo dataset.
5. Comparar cada valor esperado, incluyendo ausencia de cambios en fallos. Para concurrencia, failpoints o fake clock, usar el runner del ID: enviar requests manualmente en secuencia no prueba concurrencia.
6. Guardar evidencia sanitizada y completar resultado obtenido; cerrar/resetear sólo el entorno creado para la prueba.

Ejemplo real de payload para crear venta, sustituyendo ID_PRODUCTO_A y TOKEN_SELLER_A:

```http
POST /sales
Authorization: Bearer TOKEN_SELLER_A
Content-Type: application/json
Idempotency-Key: QA-S1

{"items":[{"product":"ID_PRODUCTO_A","quantity":2}],"discount":10,"paymentMethod":"cash","amountReceived":200}
```

Idempotency-Key es una capacidad objetivo de D05, no del baseline actual. La fase debe incluir su aceptación en CORS.

### Procedimiento para una IA

Leer spec y plan global, luego los3 archivos de la fase. Verificar precondiciones, identificar tipos vigentes y construir fixture mediante harness. Ejecutar los IDs de test indicados; para una operación aún no implementada reportar BLOCKED, sin sustituirla por un mock que omita el efecto bajo prueba. Las unitarias pueden usar repositorios fake; las pruebas transaccionales requieren Mongo real en replica set. No modificar el resultado esperado para hacer pasar una implementación defectuosa; proponer cambio de contrato con justificación si existe una divergencia real de requisitos.

Para comparar DTOs dinámicos, D01 fija en contratos los JSON pointers de IDs y resultados. Sólo se normalizan timestamps/IDs generados y campos explícitamente documentados; no se eliminan diferencias de monto, estado, roles o paginación.

### Inyección de fallos y concurrencia

Los failpoints son dependencias exclusivas de test del UnitOfWork/caso de uso: afterStock, afterSale, afterCash, afterCredit, beforeCommit. Deben lanzar un error controlado y devolver fallo sin commit; leer después con otra sesión. Nunca exponerlos por HTTP público.

Para carreras, usar barrera de inicio y Promise.allSettled con solicitudes a createApp, recopilar todos los status y esperar resolución/commit antes de contar datos. Para reintentos tras caída, terminar el proceso de staging de prueba después del punto indicado, reiniciarlo y repetir con la misma clave. No matar procesos productivos.

### Evidencia y resultados

Guardar artefactos fuera del repositorio o en el sistema CI con run-id único. Registro mínimo por caso:

| Campo | Contenido |
|---|---|
| ID y versión | Dxx-Tyy, commit, versión de contrato, actor |
| Deploy ID | ID real si se probó un deploy; “sin deploy” para ejecución local |
| Entorno | Node, Mongo, replica set, URL sanitizada |
| Precondiciones | Fixture, reloj y variantes |
| Entrada/salida | Método, path, payload y status/JSON sanitizados |
| Persistencia | Conteos, stock, saldos y estados antes/después |
| Esperado | Copiado del test_plan |
| Obtenido | Valor observado; nunca completar con el esperado sin ejecutar |
| Resultado | NOT_RUN, PASS, FAIL o BLOCKED |
| Evidencia | Log/CI, request IDs y reporte de assertions |
| Incidencia | Motivo y próxima acción si falla |

Todos los casos están **NOT_RUN** al crear estos documentos. No se ejecutó ningún deploy. Los resultados de tests previos a este plan no acreditan estos nuevos escenarios.

## Cierre de migración

D08 cierra cuando los casos de uso y sus pruebas pasan y los flujos principales funcionan con la nueva arquitectura. Guardar el commit probado, las evidencias y el deploy ID si ya se publicó. Mantener las notas de compatibilidad de datos para poder corregir o volver a una versión compatible sin perder operaciones.
