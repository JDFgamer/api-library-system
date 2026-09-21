# D05 — Núcleo financiero transaccional: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D04 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Implementar Money en centavos dentro del dominio; mantener importes decimales en API y almacenamiento mediante mappers durante transición.
2. Crear casos de uso transaccionales; contadores atómicos por escuela; idempotencia persistida dentro de la transacción.
3. Migrar ventas y créditos conjuntamente; adaptar llamadas desde cotizaciones legado al nuevo caso de uso.
4. Definir política de devolución parcial, anulaciones y notas sin doble compensación; conservar ambos endpoints de devolución.
5. Implementar imputación de pagos por antigüedad propuesta, estados settled por venta y vencimientos configurados.
6. Incluir Idempotency-Key en CORS; misma clave/payload reproduce respuesta; payload diferente=409; claves aisladas por tenant.
7. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
8. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D05-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Contadores inicializados bajo pausa breve de escritores desde máximo actual; índice único (school,number) existente. Idempotencia y asignaciones aditivas; no convertir datos históricos a centavos en disco ni recalcular saldos automáticamente.

## Nota de recuperación

Revertir sólo a artefacto financiero compatible con contadores/idempotencia y asignaciones. Si legado no lo es, pausar escrituras financieras y corregir hacia adelante; nunca restaurar snapshot perdiendo cobros.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-13, UC-14, UC-15.
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
