import { SettingModel } from '../../models/Setting/index.js';
import type { SettingLean } from '../../models/Setting/index.js';
import { withId } from '../../utils/lean.js';

const BOT_SETTING_FIELDS = [
  'botEnabled',
  'botGreeting',
  'botQuickReplies',
  'botKeyHash',
  'botKey',
  'botSellerId',
  'whatsappNumber',
] as const;

export function stripBotSettings<T extends Record<string, unknown>>(settings: T): Omit<T, (typeof BOT_SETTING_FIELDS)[number]> {
  const stripped = { ...settings };
  for (const field of BOT_SETTING_FIELDS) {
    delete stripped[field];
  }
  return stripped;
}

export async function getSettings(schoolId: string): Promise<SettingLean> {
  let settings = await SettingModel.findOne({ school: schoolId }).lean();

  if (!settings) {
    const defaultSettings = await SettingModel.create({ school: schoolId });
    settings = defaultSettings.toJSON() as unknown as typeof settings;
  }

  return withId(stripBotSettings(settings as unknown as Record<string, unknown>)) as unknown as SettingLean;
}

export async function updateSettings(schoolId: string, data: Partial<SettingLean>): Promise<SettingLean> {
  const safeData = stripBotSettings(data as unknown as Record<string, unknown>);

  const current = await SettingModel.findOne({ school: schoolId });

  if (!current) {
    const newSettings = await SettingModel.create({ ...safeData, school: schoolId });
    return withId(stripBotSettings(newSettings.toJSON() as Record<string, unknown>)) as unknown as SettingLean;
  }

  Object.assign(current, safeData);
  await current.save();

  return withId(stripBotSettings(current.toJSON() as Record<string, unknown>)) as unknown as SettingLean;
}
