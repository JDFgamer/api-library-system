# D01 — Base de pruebas y contratos: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Arranque Express local y serverless, contratos HTTP y SSE, errores y validación compartida, infraestructura transaccional de prueba.

Código de referencia: server.ts; middleware/*; vitest.config.ts; src/test/*; config/*. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-01 | Arrancar, consultar salud y cerrar conexiones | GET /health; arranque local y handler serverless |
| UC-02 | Validar entradas y traducir errores | Todas las rutas: body, query y params |
| UC-03 | Congelar el contrato público y ejecutar regresión real | Inventario de todos los routers montados en server.ts |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

No cambiar documentos de negocio. Replica set y datasets aislados de prueba.

## Aceptación verificable

- D01-T01: API real y entradas de ejecución; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D01-T02: Validación efectiva; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D01-T03: Contrato y rutas completas; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D01-T04: Transacción real; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D01-T05: Cobertura y arquitectura; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con pruebas de contrato y paridad aplicables.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
