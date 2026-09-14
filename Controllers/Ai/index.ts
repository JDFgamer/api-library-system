import * as publicController from './public/index.js';
import * as adminController from './admin/index.js';

export const {
  runSseChat,
  getPublicBotConfig,
  getPublicChatHistory,
  createDraftOrder,
  setOrderCustomerInfo,
  getOrderWhatsappLink,
  markOrderPaid,
} = publicController;

export const {
  getAdminBotMetrics,
  getAdminBotConfig,
  updateAdminBotConfig,
  rotateAdminBotKey,
  listSchoolBots,
  setSchoolBot,
  listConversations,
  getConversation,
  pauseConversation,
  resumeConversation,
  replyConversation,
  listBotOrders,
  cancelBotOrder,
  setBotOrderStatus,
  payBotOrder,
} = adminController;
