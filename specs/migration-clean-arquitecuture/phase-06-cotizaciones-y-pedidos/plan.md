# D06 — Cotizaciones y pedidos del bot: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D05 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Crear Order/Quote con transiciones explícitas y mappers del documento actual.
2. Migrar endpoints públicos de pedidos y adaptador del bot hacia casos de uso.
3. Conectar la confirmación de pago con el caso de uso financiero migrado.
4. Definir diferencia entre aviso público de pago y confirmación financiera administrativa.
5. Mantener los códigos y validadores actuales durante esta fase; documentar cualquier evolución futura como cambio funcional separado.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D06-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Campos opcionales quoteId/idempotencia y nuevo formato de código coexistente. No renumerar pedidos históricos; índice parcial único para vínculo venta-pedido.

## Nota de recuperación

Mantener lector de ambos formatos y confirmación idempotente. Revertir a versión puente, nunca a parser exclusivo PED de cuatro dígitos.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-16, UC-17, UC-18.
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
