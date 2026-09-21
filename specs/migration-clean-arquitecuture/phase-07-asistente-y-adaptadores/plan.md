# D07 — Asistente, conversaciones y servicios externos: plan de trabajo

[Spec](spec.md) · [Pruebas](test_plan.md) · [Protocolo global](../plan.md).

## Punto de partida

Tener probados los cambios de D06 necesarios para esta fase. Revisar las decisiones funcionales del spec y avanzar por un caso de uso a la vez.

## Pasos de implementación

1. Definir puertos LLM, reloj, notificaciones y streaming; separar herramientas del asistente de acceso a datos.
2. Implementar adapters deterministas para tests sin llamadas pagas; mantener protocolo SSE capturado.
3. Migrar historial, handoff humano, configuración, rotación y métricas.
4. Inventariar usos efectivos de OpenAI, nodemailer, Cloudinary y MercadoPago; aislar callers existentes; dependencia instalada no implica feature activa.
5. Preservar límites, limpieza al desconectar y errores del proveedor.
6. Implementar todos los escenarios de test_plan.md y el contrato de repositorios; mantener exports al final.
7. Completar el inventario método+ruta → caso de uso → test y registrar diferencias de contrato.

## Comprobar el avance

1. Ejecutar typecheck, lint, build y los tests de los casos modificados.
2. Ejecutar los escenarios D07-Txx y la regresión relacionada sobre datos aislados.
3. Registrar resultados obtenidos, evidencias y commit. Corregir fallos antes de cerrar la fase.
4. Si se publica, agregar el deploy ID real y comprobar los flujos modificados.

## Datos a tener en cuenta

Conservar conversaciones y mensajes; campos opcionales para observabilidad. Retención y Redis fuera del alcance inicial.

## Nota de recuperación

Cambiar al adapter anterior compatible con conversaciones y configuración nuevas; mantener claves rotadas invalidadas.

Conservar la referencia al commit compatible anterior y la evidencia de las pruebas de recuperación aplicables.

## Entregables

- Casos de uso y puertos para UC-19, UC-20, UC-21, UC-22.
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
