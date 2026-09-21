# D01 — Base de pruebas y contratos: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Identificar el estado actual del código y preparar datos de prueba aislados. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Extraer createApp con dependencias explícitas; conservar ambos entrypoints y CORS.
2. Crear harness con Supertest sobre createApp real y MongoMemoryReplSet; reemplazar gradualmente el servidor mock.
3. Capturar OpenAPI y fixtures de contratos desde rutas, schemas y controllers; incluir seguridad, aliases y protocolo SSE.
4. Corregir coverage para incluir producción en raíz y src; introducir pruebas de límites de dependencias.
5. Implementar fixtures, failpoints y runners propuestos en el protocolo global; registrar diferencias de contrato para revisarlas fuera de la migración.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D01-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

No cambiar documentos de negocio. Replica set y datasets aislados de prueba.

## Nota de recuperación

Reponer el artefacto anterior; no requiere revertir datos. Mantener snapshots de contratos y evidencia del nuevo harness.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-01, UC-02, UC-03.
- Adapters y composición con tests de dependencias.
- Contratos HTTP/SSE actualizados y pruebas automatizadas identificadas.
- Script dry-run/idempotente de datos o declaración explícita de que no se necesita.
- Evidencia por caso, comparación de contratos y deploy ID cuando se publique.

## Registro de avance

| Campo | Valor |
|---|---|
| Estado de la fase | EN CURSO — base `createApp`, handler serverless testeable y validación normalizada iniciados |
| Commit probado | Working tree (sin commit) |
| Deploy ID | Sin deploy |
| Tests ejecutados | `npm run typecheck`; `npm run build`; `npm run lint`; `npm run test:run -- src/test/migration/phase-01`; `npm run test:run`; `npm run test:coverage` |
| Resultados obtenidos | PASS: D01 inicial (3 assertions); regresión 388/388; cobertura 31.59% líneas globales y archivos de raíz incluidos. Lint sin errores, 32 warnings preexistentes en tests. |
| Evidencias | `src/test/migration/phase-01/base-and-validation.test.ts`; salida local del 2026-09-20 |
| Próximo paso / fallos | Implementar `MongoMemoryReplSet`, fixture común y runner por `--case`; inventariar rutas/contratos. D01-T03/T04/T05 completos aún pendientes. |

Repetir este registro si hay más de una entrega o ejecución de pruebas.
