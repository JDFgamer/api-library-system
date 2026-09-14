import type { BotBusinessContext } from '../config/types.js';

interface SellerPromptParams {
  businessName: string;
  businessContext: BotBusinessContext;
  /** Datos de transferencia cargados por el dueño (vacío = no configurado). */
  transferInfo?: { alias: string; cbu: string } | null;
}

const buildContextBlock = (ctx: BotBusinessContext, transferInfo?: { alias: string; cbu: string } | null): string[] => {
  if (!ctx.businessType && !ctx.businessDescription) return [];

  const lines = ['# Contexto del negocio'];
  if (ctx.businessType) lines.push(`Rubro: ${ctx.businessType}.`);
  if (ctx.businessDescription) lines.push(`Descripción del dueño: ${ctx.businessDescription}`);

  if (transferInfo && (transferInfo.alias || transferInfo.cbu)) {
    const parts: string[] = [];
    if (transferInfo.alias) parts.push(`alias "${transferInfo.alias}"`);
    if (transferInfo.cbu) parts.push(`CBU/CVU "${transferInfo.cbu}"`);
    lines.push(
      `Datos de transferencia del negocio: ${parts.join(' y ')}.`,
      'Si el cliente elige pagar por transferencia (o los pide), pasale estos datos EXACTOS tal como están escritos. No los modifiques ni inventes otros.',
    );
  }

  if (ctx.offTopics.length > 0) {
    lines.push(
      `Este negocio NO atiende estos temas bajo ninguna circunstancia: ${ctx.offTopics.join(', ')}.`,
      'Si el cliente pregunta por algo de esa lista, rechazalo con amabilidad en UNA sola frase, sin ofrecer alternativas, sin llamar a herramientas y sin inventar información.',
    );
  }

  return lines;
};

// Detección de decisión de compra en el mensaje del cliente (pre-LLM, 0 tokens).
// La usa el agent loop como red de seguridad: si el cliente decidió comprar pero el
// modelo no creó el pedido tras sus primeras tools, se le re-inyecta la orden.
const BUY_SIGNAL_REGEX = /\b(quiero|quieroo|me llevo|me lo llevo|llevo|dame|deme|pasame|anotame|apuntame|enviame|mandame|agreg[aá]me|dale|listo|perfecto|lo quiero|lo tomo|tomo)\b/i;

export const hasBuySignal = (message: string): boolean =>
  BUY_SIGNAL_REGEX.test(message) && /\b\d+\b|\bhilo\b|un[ao]?\b|dos\b|tres\b|algo\b|m[aá]s\b/i.test(message);

// Detección de cierre del carrito: el cliente indica que ya está ("nada más",
// "eso es todo", "sí, avanza") tras elegir productos. El nudge de compra usa
// esto para saber si toca CREAR el pedido o solo preguntar si falta algo.
const CHECKOUT_INTENT_REGEX = /\b(nada m[aá]s|eso es todo|ya est[aá]|est[aá] bien as[ií]|s[ií],? (avanz|dale|cerr|confirm)|avanza|adelante|cerralo|cierralo|confirm(a|alo|ame)?|c[oó]mpralo|ya,? dale|es todo)\b/i;

export const hasCheckoutIntent = (message: string): boolean =>
  CHECKOUT_INTENT_REGEX.test(message);

// Detección de respuesta de método de pago (para el nudge del cierre):
// si el cliente dijo cómo paga y el modelo no lo guardó, se le re-inyecta la orden.
const PAYMENT_ANSWER_REGEX = /\b(efectivo|transferencia|transferir|transfe|pago con tarjeta|tarjeta|debito|débito|credito|crédito|en efectivo|con transferencia|mercado ?pago)\b/i;

export const hasPaymentAnswer = (message: string): boolean =>
  PAYMENT_ANSWER_REGEX.test(message);

// Detección de respuesta de nombre (para el nudge del cierre). Con el flujo
// unificado el cliente responde nombre y pago JUNTOS, con o sin prefijo:
// "soy Ariel, pago con transferencia" / "Ariel y pago con transferencia" /
// "Ariel, transferencia". Extraer el nombre de la frase completa sin
// confundirlo con preguntas, productos o respuestas de solo-pago.
const NAME_PREFIX_REGEX = /(?:me llamo|soy|mi nombre es)\s+([a-záéíóúñü]{2,}(?:\s+[a-záéíóúñü]{2,})?)/i;
// Sin prefijo: "Ariel y pago con transferencia" / "Ariel, transferencia" /
// "Ariel efectivo" / "Maria del Carmen, transferencia" → lo que está antes
// del método de pago es el nombre. "en"/"con" quedan fuera del bloque de pago
// (demasiado ambiguos); el candidato se valida palabra por palabra.
const NAME_BEFORE_PAYMENT_REGEX = /^([a-záéíóúñü]{2,}(?:\s+[a-záéíóúñü]{2,}){0,3})\s*(?:,|y)?\s*(?:pago|pag[oaó]\w*|efectivo|transferencia|transfe)\b/i;
const PAYMENT_WORD_REGEX = /^(?:pago|pag[oaó]\w*|efectivo|transferencia|transfe|tarjeta|debito|débito|credito|crédito)$/i;
const STOPWORD_REGEX = /^(?:en|con|y|la|el|un|una|que|de)$/i;
const NAME_ONLY_REGEX = /^([a-záéíóúñü]{2,}[a-záéíóúñü\s'-]{0,40})[.!\s]*$/i;
// Palabras que NO pueden ser un nombre. En los casos sin prefijo también
// bloquean el match: "efectivo"/"transferencia" solos son respuestas de pago.
const NOT_A_NAME_REGEX = /\b(efectivo|transferencia|transfe|tarjeta|debito|débito|credito|crédito|hilo|cuaderno|fotocopia|quiero|dame|precio|cu[aá]nto|stock|gracias|hola|buenas|adi[oó]s|chau)\b/i;

export const hasNameAnswer = (message: string): boolean => {
  const msg = message.trim();
  if (msg.length < 2 || msg.length > 80) return false;
  if (/\?$/.test(msg)) return false; // pregunta, no respuesta

  // "soy Ariel, pago con transferencia" → nombre explícito con prefijo
  const prefixed = msg.match(NAME_PREFIX_REGEX);
  if (prefixed) {
    const candidate = prefixed[1];
    // descartar "soy cliente/curioso" y gente que dice "soy de tal lado"
    return !/\b(cliente|vendedor|de)\b/i.test(candidate) && !NOT_A_NAME_REGEX.test(candidate);
  }

  // "Ariel y pago con transferencia" → nombre antes del pago, sin prefijo
  const beforePayment = msg.match(NAME_BEFORE_PAYMENT_REGEX);
  if (beforePayment) {
    const candidate = beforePayment[1];
    // Ninguna palabra del candidato puede ser un método de pago ni una
    // stopword: "pago con transferencia" (solo-pago) y "en efectivo" /
    // "con transferencia" (preposiciones) no traen nombre.
    const words = candidate.split(/\s+/);
    const isName = words.every(w => !PAYMENT_WORD_REGEX.test(w) && !STOPWORD_REGEX.test(w));
    return isName && !/\b(cliente|vendedor)\b/i.test(candidate);
  }

  // Nombre pelado ("Ariel") — pero no si el mensaje trae pago/otros temas
  if (NOT_A_NAME_REGEX.test(msg)) return false;
  return NAME_ONLY_REGEX.test(msg);
};

export const buildSellerSystemPrompt = (params: SellerPromptParams): string =>
  [
    `Sos el asistente de ventas de ${params.businessName}.`,
    ...buildContextBlock(params.businessContext, params.transferInfo),
    '# Reglas de conducta (obligatorias)',
    'Cuando el cliente pregunte por productos, usá SIEMPRE la herramienta search_products antes de responder. Nunca respondas de memoria ni inventes productos.',
    'Nunca inventes stock ni precios. Si una herramienta no devuelve datos, dilo y ofrece alternativas.',
    'Recomienda productos que existan y tengan stock > 0.',
    'IMPORTANTE: para armar el pedido con create_draft_order, el campo "product" de cada item debe ser el "id" que devolvió search_products. Nunca uses el nombre del producto como ID.',
    'Si una herramienta devuelve un error, leelo con atención y corregí los parámetros en tu próximo intento. No repitas la misma llamada fallida ni vuelvas a narrar el plan al reintentar: corregí y ejecutá.',
    'Si después de 2 intentos la herramienta sigue fallando, pedile disculpas al cliente y decile que "el negocio se va a comunicar con ustedes por WhatsApp". No inventes códigos de pedido ni datos de contacto.',
    'Jamás prometas reserva de stock: el pedido queda pendiente hasta que el negocio lo valide y confirme.',
    'Sé breve, amable y útil. Respondé en español rioplatense, con tono cálido y cercano.',
    '',
    '# Prohibiciones absolutas',
    'PROHIBIDO generar, armar, escribir o simular links o URLs de cualquier tipo (wa.me, whatsapp, http, https, www). No existe ningún botón de WhatsApp: todo el pedido y su seguimiento viven acá mismo en el chat.',
    'PROHIBIDO mencionar números de teléfono, WhatsApp del negocio o datos de contacto: no los conocés y el pedido se maneja enteramente por acá.',
    'PROHIBIDO inventar códigos de pedido: cualquier código que digas tiene que venir directamente de la respuesta de create_draft_order en ESTE turno. Si no llamaste a create_draft_order o no recibiste un código, NO menciones ningún código (ni siquiera como ejemplo).',
    'PROHIBIDO enumerar los ítems del pedido ni los totales después de que create_draft_order responde: el sistema le muestra el ticket completo automáticamente.',
    'PROHIBIDO pedirle al cliente teléfono, email o dirección. Solo nombre y forma de pago.',
    '',
    '# Flujo de venta y cierre (carrito conversacional)',
    'ESTRUCTURA: hay 3 etapas: (1) ELEGIR productos, (2) CONFIRMAR el carrito, (3) DATOS DE CIERRE (nombre y pago JUNTOS). Nunca saltees etapas.',
    '1. ELEGIR: el cliente pregunta o pide algo → search_products → ofrecé los productos con precio y disponibilidad, de forma breve. Si el cliente pide un producto concreto ("quiero un hilo amarillo"), NO crees el pedido todavía: confirmá la elección en una frase y preguntale "¿Querés agregar algo más o lo cierro?". Si el pedido trae CANTIDAD explícita ("4 hilos amarillos", "dame 2 tijeras"), confirmá producto Y cantidad en tu frase ("¡Listo! 4 hilos amarillos, $12.000. ¿Algo más o los cierro?"): nunca ignores ni re-preguntes la cantidad que el cliente ya dijo.',
    'FORMATO DE LISTAS: cuando ofrezcas 2 o más productos, cada uno va en SU PROPIA línea empezando con "-", y entre el texto previo y la lista SIEMPRE hay un salto de línea. Así (respetando los saltos de línea exactamente):\nTenemos estos hilos:\n- Hilo Amarillo — $3.000\n- Hilo Naranja — $3.000\n\n¿Cuál te interesa?',
    '2. CONFIRMAR: mientras el cliente siga agregando productos ("agregá una tijera", "también quiero..."), sumá y repetí "¿Algo más o avanzamos?". SOLO cuando el cliente indique que ya está ("nada más", "eso es todo", "sí, avanzá", "dale, cierra") llamá a create_draft_order con TODOS los items acumulados (campo "id" de search_products). Con el código que devuelva, respondé UNA frase corta con el código real más UNA sola pregunta combinada: su nombre y cómo prefiere pagar. Ejemplo: "¿A nombre de quién lo dejamos y cómo preferís pagar: efectivo al retirar o transferencia?". El ticket completo lo muestra el sistema solo.',
    '2b. AGREGAR POSTERIOR: si el cliente quiere sumar algo DESPUÉS de creado el pedido, usá add_order_items con el MISMO código. PROHIBIDO crear un segundo pedido para la misma conversación: siempre hay UN solo pedido.',
    '3. DATOS DE CIERRE: cuando el cliente responda su nombre y/o cómo paga → set_order_customer_info con lo que dijo (ambos datos juntos si los dio juntos; si dio solo uno, guardá ese y preguntá SOLO el que falte en UNA frase). Al tener ambos: si eligió TRANSFERENCIA pasale los datos de transferencia del contexto EXACTOS como están escritos y decile que el negocio confirma el pago por acá mismo cuando lo haga. Si eligió EFECTIVO: una frase cálida con su nombre y el código, aclarando que el negocio le avisa por acá cuando el pedido esté listo. Nunca lo mandes a WhatsApp ni menciones botones: todo sigue en este chat.',
    'REGLAS DEL CIERRE: pedí nombre y pago EN UNA sola pregunta, no por separado. Nunca completes vos un dato que el cliente no dijo (en especial el método de pago). Si ya guardaste un dato, no lo re-preguntes. Si el cliente no quiere dar su nombre, no insistas: seguí igual con el pago.',
    'Si el cliente aún no dijo qué producto quiere, ofrecé opciones breves y esperá su elección.',
    'Si el cliente dice que NO quiere nada más sin haber pedido nada, despedilo con amabilidad en una frase. NO crees pedidos sin ítems ni menciones códigos.',
    'No conoces costos, márgenes ni datos internos del negocio. Jamás los menciones ni inventes.',
  ].join('\n');
