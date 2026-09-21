# D07 — Asistente, conversaciones y servicios externos: especificación

Estado: propuesta; implementación pendiente. [Especificación global](../spec.md) · [Plan de fase](plan.md) · [Pruebas](test_plan.md).

## Alcance y fuentes actuales

Chat SSE, configuración bot, historial, intervención humana, métricas y habilitación del add-on.

Código de referencia: Services/Ai/*; Controllers/Ai/public y admin; BotConversation, LlmUsageLog. Verificar rutas y schemas vigentes antes de implementar.

## Casos de uso

| ID | Objetivo | Rutas/superficie |
|---|---|---|
| UC-19 | Conversar y recuperar configuración/historial | POST /ai/chat; GET /ai/config, /ai/history |
| UC-20 | Administrar configuración, clave y métricas del bot | /ai/admin/config; /rotate-key; /metrics |
| UC-21 | Listar, pausar, responder y reanudar conversaciones | /ai/admin/conversations y acciones por id |
| UC-22 | Habilitar el bot por negocio | GET /ai/superadmin/bots; PUT /ai/superadmin/bots/:schoolId |

## Contrato y diseño

Aplicar reglas de dependencia y exports del spec global. Cada caso de uso recibe DTO validado y contexto autenticado cuando corresponde, llama puertos definidos por dominio/aplicación y devuelve DTO sin documentos Mongoose. Los endpoints públicos se validan con la credencial y alcance que fija su contrato.

Los errores objetivo de la fase se traducen mediante el mapper HTTP global. Registrar cambios frente al baseline en OpenAPI y fixtures de contrato, incluidos status, campos, headers y permisos. No aceptar diferencias no explicadas.

## Persistencia y compatibilidad

Conservar conversaciones y mensajes; campos opcionales para observabilidad. Retención y Redis fuera del alcance inicial.

## Aceptación verificable

- D07-T01: SSE determinista; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D07-T02: Desconexión y fallos; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D07-T03: Intervención humana; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D07-T04: Configuración, rotación y add-on; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D07-T05: Límites y métricas; debe cumplir todas las assertions de [test_plan.md](test_plan.md).
- D07-T06: Adapters y rollback; debe cumplir todas las assertions de [test_plan.md](test_plan.md).

Además, la regresión de fases anteriores debe pasar y cada operación de los prefijos a cargo de esta fase debe figurar en el inventario D01 con pruebas de contrato y paridad aplicables.

## Fuera de esta fase

Los casos de uso asignados a fases posteriores continúan por sus adapters actuales, salvo los puentes explícitos descritos en el plan. No introducir cambios no relacionados en API o estructura persistida.
