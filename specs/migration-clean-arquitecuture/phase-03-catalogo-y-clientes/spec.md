# D03 — Catálogo, inventario básico y clientes: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Productos, servicios, ajustes de stock y datos maestros de clientes.

Código de referencia: Services/Products, Clients; modelos Product y Client. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-08 | Gestionar catálogo y consultar stock bajo | /products CRUD y /products/low-stock |
| UC-09 | Ajustar existencias | PATCH /products/:id/stock |
| UC-10 | Gestionar clientes, deudores e historial | /clients CRUD; /clients/debtors; /clients/:id/history |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

Conservar IDs, school, importes y colecciones. Índices nuevos sólo tras auditoría; ninguna deduplicación automática.

## Aceptación verificable

- D03-T01: CRUD de producto y servicio; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D03-T02: Stock y concurrencia; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D03-T03: Filtros y stock bajo; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D03-T04: Clientes e historia; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D03-T05: Aislamiento de repositorios; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D03-T06: Compatibilidad de datos e índices; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con un caso positivo, uno inválido y uno de autorización/tenant cuando corresponda.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
