# D06 — Cotizaciones y pedidos del bot: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Cotizaciones, pedidos públicos y administración de estados/pago; puente transaccional con ventas.

Código de referencia: Services/Quotes; Controllers/Ai (operaciones de pedidos); Quote. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-16 | Previsualizar, crear, consultar y cancelar cotizaciones | /quotes/preview; /quotes CRUD disponible |
| UC-17 | Crear pedido, actualizar cliente y obtener enlace | /ai/create-order; /ai/orders/:publicCode/customer, /whatsapp, /paid |
| UC-18 | Administrar, cambiar estado y cobrar pedido | /ai/admin/orders; /:id/cancel, /status, /pay |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

Campos opcionales quoteId/idempotencia y nuevo formato de código coexistente. No renumerar pedidos históricos; índice parcial único para vínculo venta-pedido.

## Aceptación verificable

- D06-T01: Cotización básica; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D06-T02: Ítems y mapeo de cotización; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D06-T03: Pago y recuperación; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D06-T04: Estados y aviso público; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D06-T05: Códigos y autenticación pública; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D06-T06: Paridad de pedidos y rollback; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con pruebas de contrato y paridad aplicables.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
