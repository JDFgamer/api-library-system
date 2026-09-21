# D08 — Reportes, regresión completa y cierre: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D07 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Migrar dashboard a query services/puertos de lectura y agregaciones; no forzar hidratación de entidades para reportes.
2. Comparar agregaciones con oráculos aritméticos independientes y límites de fecha.
3. Eliminar servicios legacy sólo cuando inventario de imports y rutas confirme reemplazo completo.
4. Conservar aliases públicos; retirar únicamente código interno muerto.
5. Ejecutar regresión acumulada, carga comparativa y ensayo rollback; cerrar trazabilidad de todas las rutas.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D08-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Sólo índices/proyecciones aditivas verificadas; no purgar datos ni retirar campos usados por la versión de rollback.

## Nota de recuperación

Reponer versión 07 compatible manteniendo reportes anteriores; conservar proyecciones nuevas sin usarlas. No retirar campos hasta otro ciclo de retención documentado.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-23, UC-24, UC-25.
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
