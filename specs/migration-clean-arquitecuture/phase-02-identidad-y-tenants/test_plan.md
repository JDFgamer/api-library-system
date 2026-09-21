# D02 — Identidad, permisos y aislamiento: plan detallado de pruebas

[Spec](spec.md) · [Plan](plan.md) · [Protocolo compartido](../plan.md#protocolo-de-pruebas-compartido).

## Preparación

Usar datos aislados y el fixture común de D01. Cada caso comienza desde un fixture nuevo. Los resultados esperados describen paridad de comportamiento y separación de capas; no definen cambios funcionales o de seguridad.

## Casos detallados

### D02-T01 — Contrato de sesión

**Precondiciones:** Usuarios de prueba con email, contraseña y PIN válidos.

**Pasos:**

1. Ejecutar los flujos de login disponibles y consultar `/auth/me` con la sesión obtenida.
2. Ejecutar `/auth/refresh` con el dato válido que exige el contrato actual.
3. Comparar status, campos públicos y tipos de respuesta entre el adapter anterior y el candidato.

**Resultado esperado:** Las rutas conservan su contrato público. Las respuestas no exponen campos internos de persistencia. El caso de uso de sesión no importa Express ni Mongoose.

**Resultado obtenido:** pendiente. **Estado:** NOT_RUN. **Evidencia:** pendiente.

### D02-T02 — Casos de uso de usuarios y administradores

**Precondiciones:** Datos de usuario y administrador del fixture.

**Pasos:**

1. Ejecutar las operaciones disponibles de listado, alta, consulta, edición y baja para `/users` y `/admins`.
2. Comparar DTOs y efectos persistidos con el contrato congelado en D01.
3. Inspeccionar imports de controller, caso de uso, dominio y repositorio.

**Resultado esperado:** El flujo conserva sus respuestas y persistencia esperadas. Controller y dominio no acceden directamente a modelos Mongoose.

**Resultado obtenido:** pendiente. **Estado:** NOT_RUN. **Evidencia:** pendiente.

### D02-T03 — Casos de uso de escuelas y POS

**Precondiciones:** Escuelas y POS del fixture.

**Pasos:**

1. Ejecutar rutas públicas y privadas existentes de `/schools` y operaciones de `/pos` con los datos del fixture.
2. Verificar alta, lectura, actualización y baja de acuerdo con las operaciones disponibles.
3. Comparar el DTO de Mongoose anterior con el mapper del repositorio nuevo.

**Resultado esperado:** Las rutas mantienen su contrato y los mappers producen DTOs equivalentes. Las reglas permanecen en el caso de uso y el repositorio se limita a persistencia.

**Resultado obtenido:** pendiente. **Estado:** NOT_RUN. **Evidencia:** pendiente.

### D02-T04 — Caso de uso de configuración

**Precondiciones:** Configuración existente en el fixture.

**Pasos:**

1. Ejecutar GET y PUT `/settings` con un payload válido del contrato actual.
2. Leer la configuración por la API y por el repositorio candidato.
3. Comparar datos persistidos y DTOs con el adapter anterior.

**Resultado esperado:** GET y PUT preservan contrato y efectos actuales. La configuración se lee y escribe a través del repositorio, sin consultas Mongoose en controller o caso de uso.

**Resultado obtenido:** pendiente. **Estado:** NOT_RUN. **Evidencia:** pendiente.

### D02-T05 — Paridad y dependencias del módulo

**Precondiciones:** Implementación candidata y adapter anterior disponibles en el entorno de prueba.

**Pasos:**

1. Ejecutar los escenarios positivos de sesión, usuarios, escuelas, POS y configuración sobre ambos adapters.
2. Normalizar únicamente IDs y timestamps generados.
3. Ejecutar la prueba de límites de importación del módulo.

**Resultado esperado:** No hay diferencias funcionales sin documentar. Domain y application no importan Express ni Mongoose; los puertos se implementan en infraestructura.

**Resultado obtenido:** pendiente. **Estado:** NOT_RUN. **Evidencia:** pendiente.

## Regresión del módulo

Para cada operación inventariada de `/auth`, `/users`, `/admins`, `/schools`, `/pos` y `/settings`, ejecutar:

| Variante | Assertion |
|---|---|
| Request válido | Conserva status, schema y efecto del contrato D01 |
| Request inválido | Conserva la respuesta de validación del contrato |
| Lectura posterior | La persistencia coincide con el DTO de respuesta |
| Paridad | Adapter anterior y candidato coinciden salvo IDs/timestamps dinámicos |

Registrar cada ejecución con commit, resultado, evidencia y deploy ID si se publica.
