import { timingSafeEqual } from 'crypto';
import { Types } from 'mongoose';
import * as settingsService from '../../Settings/index.js';
import { UserModel } from '../../../models/User/index.js';
import { SchoolModel } from '../../../models/School/index.js';
import { SettingModel } from '../../../models/Setting/index.js';
import type { SettingLean } from '../../../models/Setting/index.js';
import { ValidationError, NotFoundError } from '../../../utils/errors.js';
import { generateBotKey, hashBotKey } from '../keys/index.js';
import type {
  BotAdminConfig,
  BotPublicConfig,
  BotBusinessContext,
  UpdateBotConfigInput,
  PublicConfigParams,
  SchoolBotStatus,
  SetSchoolBotInput,
} from './types.js';

export type {
  BotAdminConfig,
  BotPublicConfig,
  BotBusinessContext,
  UpdateBotConfigInput,
  PublicConfigParams,
  SchoolBotStatus,
  SetSchoolBotInput,
};

const DEFAULT_GREETING = '¡Hola! Soy el asistente de este negocio. ¿Qué estás buscando hoy?';
const SELLER_NAME = 'Bot';
const EMAIL_DOMAIN = 'bot.internal';

/**
 * Normaliza un WhatsApp al formato internacional que wa.me exige (Argentina).
 * "3816346097" → "5493816346097" · "93816346097" → "5493816346097" · "549..." se respeta.
 */
export const normalizeWhatsappNumber = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('54')) return digits;
  if (digits.length === 10) return `549${digits}`;
  if (digits.length === 11 && digits.startsWith('9')) return `54${digits}`;
  return digits;
};

const emptyToDefaults = (settings: SettingLean): { greeting: string; quickReplies: string[] } => ({
  greeting: settings.botGreeting || DEFAULT_GREETING,
  quickReplies: Array.isArray(settings.botQuickReplies) ? settings.botQuickReplies : [],
});

const toBusinessContext = (settings: SettingLean): BotBusinessContext => ({
  businessType: settings.botBusinessType ?? '',
  businessDescription: settings.botBusinessDescription ?? '',
  offTopics: Array.isArray(settings.botOffTopics) ? settings.botOffTopics : [],
  offTopicReply: settings.botOffTopicReply ?? '',
});

export const getBotAdminConfig = async (schoolId: string, botUrlBase: string): Promise<BotAdminConfig> => {
  const [settings, school] = await Promise.all([
    SettingModel.findOne({ school: schoolId }).lean(),
    SchoolModel.findOne({ _id: schoolId }).lean(),
  ]);
  if (!settings || !school) throw new NotFoundError('Negocio no encontrado');

  const { greeting, quickReplies } = emptyToDefaults(settings as unknown as SettingLean);
  const enabled = Boolean(settings.botEnabled);
  const botKey = settings.botKey ?? '';
  const botLink = enabled && botKey
    ? `${botUrlBase}/b/${school.slug}?key=${botKey}`
    : '';
  const businessContext = toBusinessContext(settings as unknown as SettingLean);

  return {
    enabled,
    greeting,
    quickReplies,
    whatsappNumber: settings.whatsappNumber ?? '',
    transferAlias: settings.transferAlias ?? '',
    transferCbu: settings.transferCbu ?? '',
    botLink,
    businessType: businessContext.businessType,
    businessDescription: businessContext.businessDescription,
    offTopics: businessContext.offTopics,
    offTopicReply: businessContext.offTopicReply,
    statusMessages: {
      confirmed: settings.botStatusMessages?.confirmed ?? '',
      paid: settings.botStatusMessages?.paid ?? '',
      ready: settings.botStatusMessages?.ready ?? '',
    },
  };
};

const ensureBotSeller = async (schoolId: string, settings: SettingLean): Promise<Types.ObjectId> => {
  if (settings.botSellerId) return settings.botSellerId;
  const existing = await UserModel.findOne({ school: schoolId, role: 'seller', name: SELLER_NAME }).lean();
  if (existing) return existing._id as Types.ObjectId;
  const suffix = Math.random().toString(36).slice(2, 10);
  const created = await UserModel.create({
    name: SELLER_NAME,
    email: `bot-${schoolId.slice(-6)}-${suffix}@${EMAIL_DOMAIN}`,
    passwordHash: `bot-${suffix}`,
    pinHash: `bot-${suffix}`,
    role: 'seller',
    active: true,
    school: schoolId,
  });
  return created._id as Types.ObjectId;
};

export const updateBotAdminConfig = async (input: UpdateBotConfigInput): Promise<BotAdminConfig> => {
  const { schoolId, botUrlBase } = input;

  const settings = await settingsService.getSettings(schoolId);
  const current = await SettingModel.findOne({ school: schoolId });
  if (!current) throw new NotFoundError('Negocio no encontrado');

  const wasEnabled = Boolean(current.botEnabled);
  const shouldEnable = input.enabled ?? wasEnabled;

  const updates: Record<string, unknown> = {};
  if (input.greeting !== undefined) updates.botGreeting = input.greeting;
  if (input.quickReplies !== undefined) updates.botQuickReplies = input.quickReplies;
  // Normalizar el WhatsApp al formato internacional (wa.me lo exige): el dueño
  // puede escribir "3816346097" y se guarda "5493816346097".
  if (input.whatsappNumber !== undefined) updates.whatsappNumber = normalizeWhatsappNumber(input.whatsappNumber);
  if (input.transferAlias !== undefined) updates.transferAlias = input.transferAlias.trim();
  if (input.transferCbu !== undefined) updates.transferCbu = input.transferCbu.replace(/[\s.-]/g, '');
  if (input.businessType !== undefined) updates.botBusinessType = input.businessType;
  if (input.businessDescription !== undefined) updates.botBusinessDescription = input.businessDescription;
  if (input.offTopics !== undefined) updates.botOffTopics = input.offTopics;
  if (input.offTopicReply !== undefined) updates.botOffTopicReply = input.offTopicReply;
  if (input.statusMessages !== undefined) {
    // Mensajes automáticos por cambio de estado del pedido (se administran en el admin).
    updates.botStatusMessages = {
      confirmed: input.statusMessages.confirmed?.trim() ?? '',
      paid: input.statusMessages.paid?.trim() ?? '',
      ready: input.statusMessages.ready?.trim() ?? '',
    };
  }
  updates.botEnabled = shouldEnable;

  if (shouldEnable && !wasEnabled) {
    const sellerId = await ensureBotSeller(schoolId, settings);
    updates.botSellerId = sellerId;
    if (!current.botKeyHash) {
      const botKey = generateBotKey();
      updates.botKey = botKey;
      updates.botKeyHash = await hashBotKey(botKey);
    }
  }

  Object.assign(current, updates);
  await current.save();

  return getBotAdminConfig(schoolId, botUrlBase);
};

export const rotateBotKey = async (schoolId: string): Promise<string> => {
  const newKey = generateBotKey();
  await SettingModel.findOneAndUpdate(
    { school: schoolId },
    { botKey: newKey, botKeyHash: await hashBotKey(newKey) }
  );
  return newKey;
};

export const toPublicConfig = (params: PublicConfigParams): BotPublicConfig => {
  const { schoolId, businessName, settings } = params;
  const alias = settings.transferAlias ?? '';
  const cbu = settings.transferCbu ?? '';
  return {
    enabled: Boolean(settings.botEnabled && settings.botKeyHash),
    greeting: settings.botGreeting || DEFAULT_GREETING,
    quickReplies: Array.isArray(settings.botQuickReplies) ? settings.botQuickReplies : [],
    businessName,
    whatsappNumber: settings.whatsappNumber ?? '',
    // Datos de transferencia: solo viajan al widget si hay algo cargado (para la
    // card de pago y el mensaje prearmado del deeplink).
    transferInfo: alias || cbu ? { alias, cbu } : null,
    botKeyHash: settings.botKeyHash ?? '',
    botSellerId: settings.botSellerId ? String(settings.botSellerId) : null,
    schoolId,
    businessContext: toBusinessContext(settings),
  };
};

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

export const validateBotKeyAgainst = async (config: BotPublicConfig, botKey: string): Promise<void> => {
  if (!config.enabled) {
    throw new ValidationError('Bot no disponible para este negocio');
  }
  if (!config.botKeyHash) {
    throw new ValidationError('Credencial del bot inválida');
  }
  const inputHash = await hashBotKey(botKey);
  if (!safeEqual(inputHash, config.botKeyHash)) {
    throw new ValidationError('Credencial del bot inválida');
  }
};

export const getPublicConfigBySlug = async (slug: string): Promise<BotPublicConfig> => {
  const school = await SchoolModel.findOne({ slug, active: true }).lean();
  if (!school) throw new NotFoundError('Negocio no encontrado');

  const settings = await SettingModel.findOne({ school: school._id }).lean();
  if (!settings) throw new NotFoundError('Negocio no encontrado');

  return toPublicConfig({
    schoolId: String(school._id),
    businessName: school.name,
    settings: settings as unknown as SettingLean,
  });
};

export const listSchoolBots = async (botUrlBase: string): Promise<SchoolBotStatus[]> => {
  const [schools, settings] = await Promise.all([
    SchoolModel.find({}).sort({ name: 1 }).lean(),
    SettingModel.find({}).lean(),
  ]);

  const settingsBySchool = new Map(settings.map(s => [String(s.school), s]));

  return schools.map(school => {
    const schoolSettings = settingsBySchool.get(String(school._id));
    const botEnabled = Boolean(schoolSettings?.botEnabled);
    const botKey = schoolSettings?.botKey ?? '';
    const botLink = botEnabled && botKey
      ? `${botUrlBase}/b/${school.slug}?key=${botKey}`
      : '';

    return {
      schoolId: String(school._id),
      name: school.name,
      slug: school.slug,
      active: school.active,
      botEnabled,
      botLink,
    };
  });
};

export const setSchoolBotStatus = async (input: SetSchoolBotInput): Promise<SchoolBotStatus> => {
  const school = await SchoolModel.findById(input.schoolId).lean();
  if (!school) throw new NotFoundError('Negocio no encontrado');

  if (input.enabled) {
    await updateBotAdminConfig({
      schoolId: input.schoolId,
      enabled: true,
      botUrlBase: input.botUrlBase,
    });
  } else {
    await SettingModel.findOneAndUpdate(
      { school: input.schoolId },
      { botEnabled: false }
    );
  }

  const [statuses] = await Promise.all([listSchoolBots(input.botUrlBase)]);
  const status = statuses.find(s => s.schoolId === input.schoolId);
  if (!status) throw new NotFoundError('Negocio no encontrado');
  return status;
};
