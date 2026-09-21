# D05 — Núcleo financiero transaccional: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Ventas, stock vendido, anulaciones, devoluciones, notas de crédito, cobros y cuentas corrientes.

Código de referencia: Services/Sales, Credits; Sale, Product, CashShift, CreditMovement y Client. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-13 | Previsualizar, crear, listar y consultar ventas | /sales/preview; /sales; /sales/:id; /sales/summary |
| UC-14 | Anular, devolver y emitir nota de crédito | /sales/:id/void; /sales/:id/return; /sales/returns; /sales/:id/credit-note |
| UC-15 | Consultar deuda e imputar pagos | /credits, /summary, /history, /client/:clientId y /settle |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

Contadores inicializados bajo pausa breve de escritores desde máximo actual; índice único (school,number) existente. Idempotencia y asignaciones aditivas; no convertir datos históricos a centavos en disco ni recalcular saldos automáticamente.

## Aceptación verificable

- D05-T01: Venta y dinero exacto; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T02: Métodos y servicios; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T03: Stock concurrente e idempotencia; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T04: Atomicidad y numeración; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T05: Devolución parcial y anulación; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T06: Devolución genérica y nota; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T07: Cobros e imputación; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T08: Deuda vencida y aislamiento; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D05-T09: Rollback financiero; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con un caso positivo, uno inválido y uno de autorización/tenant cuando corresponda.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
