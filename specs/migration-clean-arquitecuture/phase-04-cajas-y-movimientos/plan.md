# D04 — Cajas y movimientos: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D03 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Crear CashShift, CashMovement y repositorios con permisos por tenant y POS.
2. Concentrar apertura/cierre y movimientos en casos de uso; proteger apertura concurrente mediante índice y manejo de conflicto.
3. Mantener aliases existentes apuntando al mismo caso de uso; no retirar rutas aún.
4. Introducir UnitOfWork común sin cambiar todavía escritores financieros legado; probar interoperabilidad.
5. Documentar semántica contable del borrado actual antes de reemplazarlo por reversión en otra versión.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D04-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Índice parcial de caja abierta con alcance validado por POS; reportar cajas duplicadas antes de crearlo. Mantener documentos y aliases.

## Nota de recuperación

Volver a bindings anteriores compatibles con índice de caja abierta. Caja creada con candidato debe poder consultarse/cerrarse con rollback.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-11, UC-12.
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
