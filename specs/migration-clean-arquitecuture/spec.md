# Especificación general de migración a Clean Architecture

Estado: propuesta documentada; implementación y despliegues pendientes.

## Objetivo y alcance

Migrar toda la API a un monolito modular con dominio independiente, casos de uso explícitos, repositorios específicos y Unit of Work. Mantener contratos REST/SSE y datos existentes, registrando las correcciones funcionales y de seguridad como cambios deliberados. Este documento y [plan.md](plan.md) sustituyen el desglose preliminar de fases de [la propuesta original](../../docs/migracion-clean-architecture.md); conservan su orientación general.

Se proponen **8 fases de trabajo para una sola persona con ayuda de IA**, sin fechas ni estimaciones. Cada fase puede requerir uno o varios cambios; publicar se decide según el avance probado. D01–D08 son identificadores de fase, mientras que el deploy ID real se registra por separado cuando se publica.

La carpeta usa exactamente el nombre solicitado: `migration-clean-arquitecuture`. Ejemplos de nombres de fase: `phase-01-base-y-contratos`, `phase-05-ventas-devoluciones-y-creditos`, `phase-08-reportes-y-cierre`. El prefijo numérico establece el orden y el sufijo describe el resultado.

## Arquitectura objetivo y reglas

- Presentation recibe HTTP/SSE, valida DTOs y traduce errores; no consulta modelos.
- Application aplica permisos y coordina casos de uso y transacciones mediante puertos.
- Domain contiene entidades e invariantes sin Express, Mongoose, JWT ni drivers.
- Infrastructure implementa repositorios, proveedores y transacciones; la composición ocurre en main.
- TenantContext se obtiene de identidad verificada; nunca se acepta schoolId del body para cambiar el alcance autenticado.
- Los repositorios de escritura operan dentro del mismo Unit of Work cuando hay efectos financieros relacionados.
- Lecturas de reportes pueden usar query services especializados sin hidratar entidades.
- Cada archivo nuevo usa exports nombrados al final: `export { Sale };` y `export type { SaleRepository };`. Los entrypoints que requieren default export por plataforma conservan su contrato.
- Módulos migrados y legado coexisten por composición explícita, con un único escritor por flujo financiero.
- No introducir microservicios, Redis, un nuevo proveedor de pagos ni conversiones masivas de dinero en esta migración.

## Catálogo de casos de uso

| ID | Caso de uso | Superficie actual | Fase |
|---|---|---|---|
| UC-01 | Arrancar, consultar salud y cerrar conexiones | GET /health; arranque local y handler serverless | D01 |
| UC-02 | Validar entradas y traducir errores | Todas las rutas: body, query y params | D01 |
| UC-03 | Congelar el contrato público y ejecutar regresión real | Inventario de todos los routers montados en server.ts | D01 |
| UC-04 | Ingresar por email/PIN, renovar sesión y consultar identidad | POST /auth/login, /login-email, /login-pin, /refresh; GET /auth/me | D02 |
| UC-05 | Administrar usuarios y administradores | /users (incluye summary); /admins y /admins/superadmin/:id | D02 |
| UC-06 | Administrar y resolver escuelas | /schools; /schools/public; /schools/public/:slug | D02 |
| UC-07 | Administrar POS y configuración | /pos; GET y PUT /settings | D02 |
| UC-08 | Gestionar catálogo y consultar stock bajo | /products CRUD y /products/low-stock | D03 |
| UC-09 | Ajustar existencias | PATCH /products/:id/stock | D03 |
| UC-10 | Gestionar clientes, deudores e historial | /clients CRUD; /clients/debtors; /clients/:id/history | D03 |
| UC-11 | Abrir, consultar y cerrar caja | /cash-shifts/open, /active, /:id/close, /:id/detail, /summary/daily y listados | D04 |
| UC-12 | Registrar, listar, agregar y eliminar movimientos | /cash-shifts/:cashShiftId/movements; aliases bajo /cash-movements | D04 |
| UC-13 | Previsualizar, crear, listar y consultar ventas | /sales/preview; /sales; /sales/:id; /sales/summary | D05 |
| UC-14 | Anular, devolver y emitir nota de crédito | /sales/:id/void; /sales/:id/return; /sales/returns; /sales/:id/credit-note | D05 |
| UC-15 | Consultar deuda e imputar pagos | /credits, /summary, /history, /client/:clientId y /settle | D05 |
| UC-16 | Previsualizar, crear, consultar y cancelar cotizaciones | /quotes/preview; /quotes CRUD disponible | D06 |
| UC-17 | Crear pedido, actualizar cliente y obtener enlace | /ai/create-order; /ai/orders/:publicCode/customer, /whatsapp, /paid | D06 |
| UC-18 | Administrar, cambiar estado y cobrar pedido | /ai/admin/orders; /:id/cancel, /status, /pay | D06 |
| UC-19 | Conversar y recuperar configuración/historial | POST /ai/chat; GET /ai/config, /ai/history | D07 |
| UC-20 | Administrar configuración, clave y métricas del bot | /ai/admin/config; /rotate-key; /metrics | D07 |
| UC-21 | Listar, pausar, responder y reanudar conversaciones | /ai/admin/conversations y acciones por id | D07 |
| UC-22 | Habilitar el bot por negocio | GET /ai/superadmin/bots; PUT /ai/superadmin/bots/:schoolId | D07 |
| UC-23 | Consultar indicadores y cierres | /dashboard/today, /sales-chart, /sales-by-hour, /top-products, /daily-closing, /shifts, /overview | D08 |
| UC-24 | Operar jornada completa tras migración | Login → apertura → venta → devolución → cobro → cierre → reporte | D08 |
| UC-25 | Verificar la entrega y registrar evidencia | Deploy ID, pruebas de flujos y compatibilidad | D08 |

## Cobertura de módulos y rutas

Los paths del catálogo se combinan con los prefijos de server.ts; no hay prefijo /api en ese archivo. La fuente de métodos, payloads y roles es routes/* y Controllers/*/types.ts; las respuestas se verifican en controllers/services.

| Prefijo o componente | Fase |
|---|---|
| /health, arranque local/serverless, CORS, validación, errores, configuración y conexión | D01 |
| /auth, /users, /admins, /schools, /pos, /settings | D02 |
| /products, /clients | D03 |
| /cash-shifts, /cash-movements | D04 |
| /sales, /credits | D05 |
| /quotes, /ai/create-order, /ai/orders/*, /ai/admin/orders* | D06 |
| Resto de /ai: chat, config, history, conversaciones, métricas, claves y superadmin | D07 |
| /dashboard y cierre de dependencias internas | D08 |

Preservar aliases /auth/login-email y /auth/login, así como los paths montados /cash-movements/cash-shifts/:cashShiftId/movements y /cash-movements/cash-movements. D01 deberá producir un inventario exacto método+ruta: una fila por operación, schema de request, status/schema de response, autenticación, owner UC y prueba. La cobertura por prefijo de esta propuesta no reemplaza ese inventario ejecutable.

## Compatibilidad y correcciones objetivo

Compatibilidad significa conservar IDs, nombres de campos, unidades monetarias, tipos, paginación, aliases y protocolo SSE. No significa preservar los errores detectados. Cambios objetivo:

| Cambio | Fase | Criterio |
|---|---|---|
| Tests sobre la app productiva y cobertura real | D01 | No aceptar cobertura 0/0 como evidencia |
| Refresh tipado, permisos de escuelas y tenant | D02 | Rechazar escalamiento y acceso cruzado |
| Settings válido y allowlist | D02 | Sin error required key/value; sin mass assignment |
| Stock condicional y unicidad de caja | D03/D04 | Concurrencia no genera stock negativo ni cajas duplicadas |
| Contadores, idempotencia, devolución con number | D05 | Sin doble efecto ni documento financiero inválido |
| Aplicación de cobros y settled | D05 | Saldo por cliente coincide con deuda pendiente por venta |
| Cotización con producto ajeno/cantidad acumulada | D06 | Rechazo sin mutación parcial |
| Pago de pedido y cancelación de paid | D06 | Venta única y transición válida |
| Reportes y filtros booleanos/fechas | D01/D08 | Datos y filtros coinciden con oráculo |

Objetivo de errores: 400 entrada inválida, 401 identidad/credencial inválida, 403 rol insuficiente, 404 recurso inexistente o ajeno para un rol autorizado, 409 conflicto de estado/concurrencia/idempotencia. Las pruebas que introducen estos cambios verifican el objetivo; otros status exitosos se conservan desde el contrato capturado en D01.

## Decisiones a cerrar antes de la fase correspondiente

Estas decisiones tienen una propuesta inicial, pero afectan reglas de negocio y requieren quedar fijadas en los contratos antes de implementar/promover la fase. La documentación puede avanzar sin resolverlas; un test que dependa de una decisión sin fijar se marca BLOCKED.

| Decisión | Propuesta inicial | Fase |
|---|---|---|
| Permisos de escuela | Superadmin gestiona global; admin sólo su escuela; seller usa resolución pública mínima | D02 |
| Transición de tokens | Invalidar refresh legacy ambiguos y solicitar nuevo login; comunicar efecto al cliente | D02 |
| Caja única | Una abierta por escuela+POS; revisar relación actual vendedor/POS y compatibilidad de clientes | D04 |
| Nota de crédito vs devolución genérica | Fijar matriz explícita de stock, efectivo y deuda para evitar doble reversión | D05 |
| Imputación y vencimiento | FIFO por antigüedad; fixture de vencimiento a30 días; no asumir que es regla actual | D05 |
| Cotización y stock | Sin reserva al cotizar; validar stock al cobrar | D06 |
| Aviso público de pago | Señal de intención, sin acreditación financiera; confirmación por admin | D06 |
| Códigos nuevos | Lectura dual antes de emisión; comprobar consumidores frontend | D06 |
| Fecha de reportes | Días de negocio en America/Argentina/Tucuman; registrar excepciones contractuales | D08 |

## Criterios globales de aceptación

Todos los casos de uso tienen owner, pruebas y evidencia. Las suites acumuladas pasan sobre la app real, con repositorios Mongo reales para integración. Dominio y aplicación no importan tecnología de transporte/persistencia. Las operaciones financieras concilian stock, caja, deuda y documentos bajo concurrencia, fallos y reintentos. Los cambios conservan compatibilidad de datos, con pruebas de recuperación donde corresponda. El avance se registra con resultados, evidencias y deploy ID si ya se publicó.

No se ejecutó esta migración ni sus pruebas al redactar estos archivos. Los ejemplos de imports, runners, fixtures y failpoints de los planes son entregables futuros; no se presentan como herramientas existentes.

## Documentos por fase

- [D01: Base de pruebas y contratos](phase-01-base-y-contratos/spec.md) — [plan](phase-01-base-y-contratos/plan.md) — [pruebas](phase-01-base-y-contratos/test_plan.md).
- [D02: Identidad, permisos y aislamiento](phase-02-identidad-y-tenants/spec.md) — [plan](phase-02-identidad-y-tenants/plan.md) — [pruebas](phase-02-identidad-y-tenants/test_plan.md).
- [D03: Catálogo, inventario básico y clientes](phase-03-catalogo-y-clientes/spec.md) — [plan](phase-03-catalogo-y-clientes/plan.md) — [pruebas](phase-03-catalogo-y-clientes/test_plan.md).
- [D04: Cajas y movimientos](phase-04-cajas-y-movimientos/spec.md) — [plan](phase-04-cajas-y-movimientos/plan.md) — [pruebas](phase-04-cajas-y-movimientos/test_plan.md).
- [D05: Núcleo financiero transaccional](phase-05-ventas-devoluciones-y-creditos/spec.md) — [plan](phase-05-ventas-devoluciones-y-creditos/plan.md) — [pruebas](phase-05-ventas-devoluciones-y-creditos/test_plan.md).
- [D06: Cotizaciones y pedidos del bot](phase-06-cotizaciones-y-pedidos/spec.md) — [plan](phase-06-cotizaciones-y-pedidos/plan.md) — [pruebas](phase-06-cotizaciones-y-pedidos/test_plan.md).
- [D07: Asistente, conversaciones y servicios externos](phase-07-asistente-y-adaptadores/spec.md) — [plan](phase-07-asistente-y-adaptadores/plan.md) — [pruebas](phase-07-asistente-y-adaptadores/test_plan.md).
- [D08: Reportes, regresión completa y cierre](phase-08-reportes-y-cierre/spec.md) — [plan](phase-08-reportes-y-cierre/plan.md) — [pruebas](phase-08-reportes-y-cierre/test_plan.md).
