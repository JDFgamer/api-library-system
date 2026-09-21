# D02 — Identidad, permisos y aislamiento: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Auth, usuarios, administradores, escuelas, POS y configuración general; contexto de tenant obligatorio.

Código de referencia: Services/Auth, Users, Admins, Schools, Pos, Settings; routes y Controllers correspondientes. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-04 | Ingresar por email/PIN, renovar sesión y consultar identidad | POST /auth/login, /login-email, /login-pin, /refresh; GET /auth/me |
| UC-05 | Administrar usuarios y administradores | /users (incluye summary); /admins y /admins/superadmin/:id |
| UC-06 | Administrar y resolver escuelas | /schools; /schools/public; /schools/public/:slug |
| UC-07 | Administrar POS y configuración | /pos; GET y PUT /settings |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Registrar la paridad frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos y headers. Cualquier diferencia funcional se documenta fuera de esta migración.

## Persistencia y compatibilidad

Conservar colecciones, IDs y formatos de documentos. Los adapters nuevos deben poder leer y escribir los datos existentes.

## Aceptación verificable

- D02-T01: Contrato de sesión; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D02-T02: Casos de uso de usuarios y administradores; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D02-T03: Casos de uso de escuelas y POS; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D02-T04: Caso de uso de configuración; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D02-T05: Paridad y dependencias del módulo; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con sus pruebas de paridad y contrato.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
