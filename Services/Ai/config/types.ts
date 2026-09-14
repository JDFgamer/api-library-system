export interface BotBusinessContext {
  businessType: string;
  businessDescription: string;
  offTopics: string[];
  offTopicReply: string;
}

/** Mensajes automáticos por cambio de estado del pedido del bot. */
export interface BotStatusMessages {
  confirmed: string;
  paid: string;
  ready: string;
}

export interface BotAdminConfig {
  enabled: boolean;
  greeting: string;
  quickReplies: string[];
  whatsappNumber: string;
  transferAlias: string;
  transferCbu: string;
  botLink: string;
  businessType: string;
  businessDescription: string;
  offTopics: string[];
  offTopicReply: string;
  statusMessages: BotStatusMessages;
}

export interface BotPublicConfig {
  enabled: boolean;
  greeting: string;
  quickReplies: string[];
  businessName: string;
  whatsappNumber: string;
  transferInfo: { alias: string; cbu: string } | null;
  botKeyHash: string;
  botSellerId: string | null;
  schoolId: string;
  businessContext: BotBusinessContext;
}

export interface UpdateBotConfigInput {
  schoolId: string;
  enabled?: boolean;
  greeting?: string;
  quickReplies?: string[];
  whatsappNumber?: string;
  transferAlias?: string;
  transferCbu?: string;
  businessType?: string;
  businessDescription?: string;
  offTopics?: string[];
  offTopicReply?: string;
  statusMessages?: Partial<BotStatusMessages>;
  botUrlBase: string;
}

export interface PublicConfigParams {
  schoolId: string;
  businessName: string;
  settings: import('../../../models/Setting/index.js').SettingLean;
}

export interface SchoolBotStatus {
  schoolId: string;
  name: string;
  slug: string;
  active: boolean;
  botEnabled: boolean;
  botLink: string;
}

export interface SetSchoolBotInput {
  schoolId: string;
  enabled: boolean;
  botUrlBase: string;
}
