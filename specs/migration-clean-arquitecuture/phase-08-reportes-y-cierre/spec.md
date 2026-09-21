# D08 — Reportes, regresión completa y cierre: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Dashboard, proyecciones de lectura, eliminación de dependencias legacy y validación integral.

Código de referencia: Services/Dashboard; composición global; todos los módulos migrados. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-23 | Consultar indicadores y cierres | /dashboard/today, /sales-chart, /sales-by-hour, /top-products, /daily-closing, /shifts, /overview |
| UC-24 | Operar jornada completa tras migración | Login → apertura → venta → devolución → cobro → cierre → reporte |
| UC-25 | Verificar la entrega y registrar evidencia | Deploy ID, pruebas de flujos y compatibilidad |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

Sólo índices/proyecciones aditivas verificadas; no purgar datos ni retirar campos usados por la versión de rollback.

## Aceptación verificable

- D08-T01: Oráculo de jornada; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D08-T02: Todos los reportes y fechas; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D08-T03: Carga reproducible; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D08-T04: Arquitectura y rutas completas; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D08-T05: Rollback completo; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D08-T06: Verificación de entrega; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con pruebas de contrato y paridad aplicables.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
