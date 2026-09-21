# D03 — Catálogo, inventario básico y clientes: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D02 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Definir Product y Client, repositorios por tenant y mappers compatibles.
2. Mover CRUD a casos de uso y parsear filtros tipados una sola vez.
3. Migrar operaciones add/set de stock y mantener sus contratos actuales.
4. Documentar restricciones e índices existentes antes de modificar adaptadores de persistencia.
5. Mantener historial y deudores mediante puertos de lectura del módulo financiero.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D03-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Conservar IDs, school, importes y colecciones. Índices nuevos sólo tras auditoría; ninguna deduplicación automática.

## Nota de recuperación

Cambiar bindings al adapter compatible anterior; mantener índices compatibles y datos nuevos. No ejecutar downgrade destructivo.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-08, UC-09, UC-10.
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
