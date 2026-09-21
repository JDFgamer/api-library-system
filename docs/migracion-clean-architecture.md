# Propuesta de migración a Clean Architecture y Repository Pattern

## 1. Resumen ejecutivo

La API es un monolito modular en TypeScript, Express y MongoDB/Mongoose. El flujo actual es funcional, pero las reglas de negocio, el acceso a datos, la autorización y la transformación HTTP están demasiado concentrados en servicios grandes.

La recomendación es una migración incremental hacia una Clean Architecture aplicada como **monolito modular**. Cada módulo debería separar dominio, casos de uso, adaptadores HTTP e infraestructura. Los repositorios deben abstraer MongoDB, mientras que las entidades deben contener invariantes del negocio.

No se recomienda una reescritura completa de una sola vez. El enfoque de menor riesgo es el patrón *Strangler*: incorporar módulos nuevos con la arquitectura objetivo y migrar progresivamente los flujos existentes sin romper la API pública ni el esquema de datos.

## 2. Estado actual

### Flujo predominante

```text
Rutas Express
  -> middlewares (JWT, roles, validación)
  -> controllers
  -> services
  -> modelos Mongoose
  -> MongoDB
```

La estructura actual es un monolito modular, pero la separación es principalmente técnica. Los servicios contienen simultáneamente reglas de negocio, consultas MongoDB, transacciones, autorización parcial, generación de números y composición de respuestas.

### Observaciones relevantes del relevamiento

- `Services/Sales/index.ts` y `Services/Quotes/index.ts` son archivos grandes y concentran múltiples responsabilidades.
- Existen validaciones de tenant incompletas en algunos flujos, especialmente al agregar productos a cotizaciones.
- La generación de números con `max(number) + 1` puede colisionar bajo concurrencia.
- Hay flujos financieros que requieren idempotencia y consistencia entre venta, stock, caja y crédito.
- Los tests actuales pasan, pero las pruebas de integración utilizan un servidor de prueba propio y el reporte de cobertura no cubre adecuadamente el código productivo.
- El manejo de errores no es uniforme: varios `throw new Error()` terminan como errores HTTP 500 genéricos.
- La configuración local de MongoDB debe ejecutarse como replica set para soportar correctamente las transacciones usadas por la aplicación.

## 3. Arquitectura propuesta

```text
HTTP / Express
  -> Presentation (controllers, schemas, mappers)
  -> Application (use cases, DTOs, permisos, transacciones)
  -> Domain (entities, value objects, invariants, domain events)
  <- Ports (repositories, clock, transactions, external services)
  -> Infrastructure (MongoDB, Mongoose, JWT, LLM, Redis, email)
```

La regla principal es que el dominio no conozca Express, Mongoose, JWT ni MongoDB. Las dependencias deben apuntar hacia el dominio; infraestructura implementa los puertos definidos por aplicación o dominio.

## 4. Estructura de carpetas sugerida

```text
src/
  main/
    app.ts
    server.ts
    container.ts
  shared/
    domain/
      Entity.ts
      ValueObject.ts
      DomainError.ts
      Money.ts
    application/
      Result.ts
      UnitOfWork.ts
      TenantContext.ts
    infrastructure/
      database/
      logging/
      config/
  modules/
    sales/
      domain/
        entities/
        value-objects/
        repositories/
      application/
        use-cases/
        dto/
      infrastructure/
        mongodb/
      presentation/
        http/
    inventory/
    cash/
    credits/
    customers/
    orders/
    identity/
    tenants/
    assistant/
```

Cada módulo debe poder evolucionar sin importar directamente los modelos Mongoose de otro módulo.

## 5. Responsabilidad por capa

| Capa | Responsabilidad | No debería hacer |
|---|---|---|
| Presentation | HTTP, autenticación, validación de entrada, status codes y mapeo de salida | Reglas financieras o consultas MongoDB |
| Application | Orquestar casos de uso, autorización, transacciones y DTOs | Conocer detalles de Express o Mongoose |
| Domain | Entidades, value objects, invariantes y eventos de negocio | Leer/escribir MongoDB |
| Infrastructure | Implementar repositorios, persistencia, JWT y servicios externos | Definir reglas de negocio que deberían estar en dominio |

## 6. Entidades y agregados recomendados

No todo documento Mongo debe convertirse automáticamente en una entidad rica. Conviene identificar agregados con límites transaccionales claros.

| Agregado | Entidades/objetos principales | Invariantes importantes |
|---|---|---|
| Tenant | `School`, `PointOfSale`, `Settings` | Los recursos no pueden cruzar tenant; POS activo pertenece a la escuela |
| Identity | `User`, `Role`, `RefreshToken` | Permisos por rol y tenant; refresh token separado del access token |
| Inventory | `Product`, `StockMovement` | Stock no negativo; producto activo y perteneciente al tenant |
| Sales | `Sale`, `SaleItem`, `Payment` | Totales consistentes; número único; devolución válida |
| Cash | `CashShift`, `CashMovement` | Una caja abierta por POS; movimientos auditables |
| Credits | `CustomerAccount`, `CreditAllocation` | Saldos y aplicaciones consistentes |
| Orders | `Quote`/`Order`, `OrderItem` | Estados válidos; pago idempotente; código público seguro |
| Assistant | `Conversation`, `Message` | Acceso por tenant y control de acciones permitidas |

## 7. Repository Pattern

No conviene crear un repositorio genérico con métodos como `find`, `save` y `delete` para todas las entidades. Es preferible definir interfaces orientadas a casos de uso.

```ts
export interface SaleRepository {
  findById(id: SaleId, tenantId: TenantId): Promise<Sale | null>;
  save(sale: Sale): Promise<void>;
  nextNumber(tenantId: TenantId): Promise<number>;
  existsByIdempotencyKey(tenantId: TenantId, key: string): Promise<boolean>;
}
```

La implementación `MongoSaleRepository` traduce entre documentos Mongoose y entidades de dominio. El caso de uso sólo conoce la interfaz.

### Unit of Work

Ventas, stock, caja y créditos deben coordinarse mediante un `UnitOfWork` o una sesión transaccional. La operación debe ser atómica y tener una clave de idempotencia.

```text
CreateSaleUseCase
  -> validar tenant, usuario, POS y stock
  -> abrir UnitOfWork
  -> reservar/actualizar stock
  -> guardar venta
  -> registrar movimiento de caja o crédito
  -> confirmar transacción
```

## 8. Ejemplo de entidad de dominio

```ts
export class Sale {
  private constructor(
    readonly id: SaleId,
    readonly tenantId: TenantId,
    private readonly items: SaleItem[],
    private readonly total: Money,
  ) {}

  static create(input: CreateSaleInput): Sale {
    if (input.items.length === 0) {
      throw new DomainError('La venta debe contener al menos un producto');
    }

    const total = input.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      Money.zero(input.currency),
    );

    return new Sale(input.id, input.tenantId, input.items, total);
  }

  getTotal(): Money {
    return this.total;
  }
}
```

La entidad protege invariantes. La persistencia se ocupa de guardar el estado, no de decidir si una venta es válida.

## 9. Esfuerzo estimado

Las siguientes cifras son días-persona aproximados y dependen de cuánto comportamiento actual deba conservarse sin cambios.

| Alcance | Resultado | Esfuerzo aproximado |
|---|---|---:|
| Reorganización estructural | Carpetas, DI básica y separación inicial | 12–18 días |
| Migración parcial crítica | Ventas, inventario, caja y créditos | 25–35 días |
| Migración completa | Entidades, repositorios, casos de uso y tests por módulo | 40–60 días |
| Completa más escalabilidad | Redis, eventos, observabilidad y hardening | 55–75 días |

Con una persona, la migración completa representa aproximadamente 8–12 semanas. Con dos personas puede bajar a 5–7 semanas, aunque no de forma lineal por la necesidad de coordinar contratos, migraciones y pruebas.

## 10. Plan de migración incremental

### Fase 1: seguridad y línea base — 4 a 6 días

- Extraer `createApp()` del arranque del servidor.
- Probar la API real, no sólo el servidor mock de tests.
- Configurar MongoDB como replica set en desarrollo y CI.
- Incorporar `MongoMemoryReplSet` para pruebas transaccionales.
- Corregir cobertura y separar pruebas unitarias de integración.
- Resolver errores de prioridad alta: autorización de escuelas, refresh tokens, tenant de productos, devoluciones y settings.

### Fase 2: kernel compartido — 4 a 6 días

- `TenantContext` obligatorio en casos de uso.
- `AppError` y mapa consistente a HTTP.
- `Money` con enteros en centavos o `Decimal128`.
- `UnitOfWork` y manejo uniforme de sesiones.
- Contenedor de dependencias explícito.
- Logger y correlation/idempotency keys.

### Fase 3: módulos de bajo riesgo — 6 a 9 días

Migrar primero productos, clientes, usuarios, POS y settings. Son buenos candidatos para validar la estructura sin afectar los flujos financieros centrales.

### Fase 4: núcleo financiero — 12 a 18 días

Migrar ventas, inventario, caja, créditos y devoluciones como flujo coordinado. Incorporar contadores atómicos, índices de tenant e idempotencia.

### Fase 5: cotizaciones y bot — 8 a 12 días

Separar el canal WhatsApp/SSE de los casos de uso. El bot debe llamar casos de uso, nunca acceder directamente a modelos Mongoose.

### Fase 6: dashboard y limpieza — 5 a 8 días

Mover reportes a agregaciones MongoDB o proyecciones/materializaciones. Eliminar duplicación de rutas y reducir servicios grandes.

## 11. Comparación: esquema actual vs. propuesta

| Dimensión | Esquema actual | Clean Architecture + repositorios |
|---|---|---|
| Velocidad inicial | Alta | Media |
| Curva de aprendizaje | Baja | Media/alta |
| Acoplamiento a Mongoose | Alto | Bajo, aislado en infraestructura |
| Test unitario de negocio | Difícil | Sencillo |
| Trazabilidad del flujo | Variable; servicios grandes | Clara: controller → use case → dominio |
| Reutilización de reglas | Baja/media | Alta |
| Cambio de persistencia | Costoso | Acotado a adaptadores |
| Evolución a eventos o colas | Difícil | Preparada mediante puertos/eventos |
| Consistencia transaccional | Dispersa | Centralizada en Unit of Work |
| Riesgo de regresión al migrar | Nulo si no se cambia | Medio durante la transición |
| Cantidad de código | Menor | Mayor, pero más explícito |
| Mantenibilidad a largo plazo | Decrece con el crecimiento | Alta si se respetan los límites |
| Rendimiento | Bueno en el estado actual | Similar; depende de repositorios y consultas |

## 12. Ventajas y desventajas

### Esquema actual

**Ventajas**

- Menor cantidad de abstracciones.
- Fácil de iniciar y desplegar.
- Mongoose permite desarrollar consultas rápidamente.
- No requiere una migración inmediata de datos.

**Desventajas**

- Los servicios grandes mezclan demasiadas responsabilidades.
- Las reglas de tenant, permisos y consistencia pueden aplicarse de forma desigual.
- Los tests dependen de infraestructura y son menos expresivos a nivel de negocio.
- Cambiar MongoDB, agregar eventos o dividir módulos resulta costoso.
- Las transacciones e idempotencia quedan repartidas en distintos métodos.

### Clean Architecture + Repository Pattern

**Ventajas**

- Casos de uso claros y fáciles de seguir.
- Dominio testeable sin levantar Express ni MongoDB.
- Persistencia reemplazable y consultas centralizadas.
- Mejor control de invariantes, tenant y permisos.
- Facilita observabilidad, eventos, colas y futura extracción de módulos.

**Desventajas**

- Mayor cantidad de interfaces, mapeadores y archivos.
- Requiere disciplina para que el dominio no termine dependiendo de Mongoose.
- La migración inicial consume tiempo y puede introducir regresiones.
- Un repositorio mal diseñado puede ocultar consultas importantes o generar sobre-abstracción.
- No mejora automáticamente el rendimiento: los índices y agregaciones siguen siendo necesarios.

## 13. Decisiones técnicas recomendadas

- Usar un monolito modular como destino inmediato; no dividir en microservicios todavía.
- Definir `tenantId`/`schoolId` como parte obligatoria del contexto de aplicación y de los repositorios.
- Usar repositorios específicos por agregado, no un CRUD genérico.
- Introducir `UnitOfWork` para ventas, stock, caja y créditos.
- Generar números con una colección de contadores atómicos, no con `max + 1`.
- Agregar idempotency keys y un índice único para pagos o creación de ventas desde cotizaciones.
- Separar access token y refresh token mediante tipo, audiencia y/o secretos distintos.
- Usar códigos públicos de cotización más largos y con alcance por tenant.
- Crear índices compuestos por tenant y claves de búsqueda reales.
- Reemplazar cálculos masivos en memoria por agregaciones MongoDB.
- Estandarizar errores de dominio y respuestas HTTP.
- Mantener contratos REST compatibles durante la migración.

## 14. Criterios de finalización

La migración puede considerarse exitosa cuando:

- Cada módulo tiene casos de uso identificables.
- Ningún controller importa directamente modelos Mongoose.
- El dominio no depende de Express ni Mongoose.
- Las operaciones financieras críticas tienen transacción e idempotencia.
- Todas las consultas multi-tenant reciben el tenant explícitamente.
- Existen pruebas de dominio, aplicación e integración contra la API real.
- La cobertura mide código productivo real.
- Los tiempos de consulta principales están respaldados por índices y mediciones `explain`.
- El equipo puede rastrear un request desde la ruta hasta el caso de uso y el repositorio.

## 15. Conclusión

La propuesta es viable y conveniente para hacer crecer la aplicación, pero debe ejecutarse por etapas. El mayor retorno se obtiene al migrar primero el núcleo financiero y los límites de tenant, acompañado por una base de tests real. La arquitectura objetivo recomendada es un **monolito modular con Clean Architecture, entidades de dominio, repositorios específicos y Unit of Work**. Esto reduce el acoplamiento actual y prepara la API para escalar en funcionalidades, equipo y volumen sin asumir todavía el costo operativo de microservicios.

