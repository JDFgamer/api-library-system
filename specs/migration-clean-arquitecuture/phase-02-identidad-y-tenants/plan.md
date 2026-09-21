# D02 — Identidad, permisos y aislamiento: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D01 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Crear TenantContext y puertos de hash, JWT y repositorios; implementar casos de uso de identidad.
2. Separar tipo access/refresh; definir rotación, almacenamiento de revocaciones y rechazo de tokens legacy ambiguos.
3. Aplicar permisos globales sólo a superadmin; admin opera su escuela; documentar cambios de seguridad en contrato.
4. Migrar CRUD de usuarios, admins, escuelas, POS y settings, con DTOs explícitos y allowlist de configuración.
5. Crear settings válidos al aprovisionar escuela; añadir tests de escuela/POS/usuario inactivos.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D02-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Añadir almacenamiento de refresh y campos opcionales. Crear settings faltantes de forma idempotente. Auditoría previa de duplicados; no borrar usuarios ni escuelas.

## Nota de recuperación

Volver a artefacto compatible que conserve endurecimiento de seguridad; invalidar sesiones nuevas si es necesario y exigir login. No volver al refresh ambiguo ni restaurar acceso entre escuelas.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-04, UC-05, UC-06, UC-07.
- Adapters y composición con tests de dependencias.
- Contratos HTTP/SSE actualizados y pruebas automatizadas identificadas.
- Script dry-run/idempotente de datos o declaración explícita de que no se necesita.
- Evidencia por caso, comparación de contratos y deploy ID cuando se publique.

## Registro de avance

| Campo | Valor |
|---|---|
| Estado de la fase | PENDIENTE |
| Commit probado | Pendiente |
| Deploy ID | Sin deploy |
| Tests ejecutados | NOT_RUN |
| Resultados obtenidos | Pendientes |
| Evidencias | Pendientes |
| Próximo paso / fallos | Pendiente |

Repetir este registro si hay más de una entrega o ejecución de pruebas.
