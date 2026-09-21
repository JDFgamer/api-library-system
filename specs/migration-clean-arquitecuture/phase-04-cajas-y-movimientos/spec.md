# D04 — Cajas y movimientos: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Apertura/cierre de cajas, movimientos manuales, consultas y aliases existentes.

Código de referencia: Services/CashShifts, CashMovements; modelos CashShift y CashMovement. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-11 | Abrir, consultar y cerrar caja | /cash-shifts/open, /active, /:id/close, /:id/detail, /summary/daily y listados |
| UC-12 | Registrar, listar, agregar y eliminar movimientos | /cash-shifts/:cashShiftId/movements; aliases bajo /cash-movements |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

Índice parcial de caja abierta con alcance validado por POS; reportar cajas duplicadas antes de crearlo. Mantener documentos y aliases.

## Aceptación verificable

- D04-T01: Apertura y cierre; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D04-T02: Apertura concurrente; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D04-T03: Movimientos y aliases; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D04-T04: Caja cerrada y caja ajena; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D04-T05: Listado y borrado legado; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D04-T06: Coexistencia y rollback; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con pruebas de contrato y paridad aplicables.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
