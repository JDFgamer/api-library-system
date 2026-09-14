import { Router } from 'express';
import { validate } from '../../middleware/validation.js';
import * as aiController from '../../Controllers/Ai/index.js';
import {
  aiChatSchema,
  aiConfigSchema,
  aiHistorySchema,
  aiCreateOrderSchema,
  aiAdminUpdateConfigSchema,
  aiSuperadminBotSchema,
  aiListConversationsSchema,
  aiConversationIdSchema,
  aiReplyConversationSchema,
  aiSetOrderStatusSchema,
  aiPayOrderSchema,
  aiSetCustomerInfoSchema,
  aiOrderWhatsappSchema,
  aiMarkOrderPaidSchema,
} from '../../Controllers/Ai/types.js';
import { authMiddleware, requireAdmin, requireSuperAdmin } from '../../middleware/auth.js';

const router = Router();

// Públicos (validados por botKey de cada negocio)
router.post('/chat', validate(aiChatSchema), aiController.runSseChat);
router.get('/config', validate(aiConfigSchema), aiController.getPublicBotConfig);
router.get('/history', validate(aiHistorySchema), aiController.getPublicChatHistory);
router.post('/create-order', validate(aiCreateOrderSchema), aiController.createDraftOrder);
router.patch('/orders/:publicCode/customer', validate(aiSetCustomerInfoSchema), aiController.setOrderCustomerInfo);
router.get('/orders/:publicCode/whatsapp', validate(aiOrderWhatsappSchema), aiController.getOrderWhatsappLink);
router.post('/orders/:publicCode/paid', validate(aiMarkOrderPaidSchema), aiController.markOrderPaid);

// Admin del negocio (JWT admin, scope schoolId)
router.get('/admin/config', authMiddleware, requireAdmin, aiController.getAdminBotConfig);
router.put('/admin/config', authMiddleware, requireAdmin, validate(aiAdminUpdateConfigSchema), aiController.updateAdminBotConfig);
router.post('/admin/rotate-key', authMiddleware, requireAdmin, aiController.rotateAdminBotKey);
router.get('/admin/metrics', authMiddleware, requireAdmin, aiController.getAdminBotMetrics);

// Bandeja de mensajes del bot (staff ve conversaciones e interviene)
router.get('/admin/conversations', authMiddleware, requireAdmin, validate(aiListConversationsSchema), aiController.listConversations);
router.get('/admin/conversations/:id', authMiddleware, requireAdmin, validate(aiConversationIdSchema), aiController.getConversation);
router.patch('/admin/conversations/:id/pause', authMiddleware, requireAdmin, validate(aiConversationIdSchema), aiController.pauseConversation);
router.patch('/admin/conversations/:id/resume', authMiddleware, requireAdmin, validate(aiConversationIdSchema), aiController.resumeConversation);
router.post('/admin/conversations/:id/reply', authMiddleware, requireAdmin, validate(aiReplyConversationSchema), aiController.replyConversation);

// Pedidos del bot (quotes source: 'bot')
router.get('/admin/orders', authMiddleware, requireAdmin, aiController.listBotOrders);
router.patch('/admin/orders/:id/cancel', authMiddleware, requireAdmin, validate(aiConversationIdSchema), aiController.cancelBotOrder);
router.patch('/admin/orders/:id/status', authMiddleware, requireAdmin, validate(aiSetOrderStatusSchema), aiController.setBotOrderStatus);
router.post('/admin/orders/:id/pay', authMiddleware, requireAdmin, validate(aiPayOrderSchema), aiController.payBotOrder);

// Superadmin (add-on por negocio)
router.get('/superadmin/bots', authMiddleware, requireSuperAdmin, aiController.listSchoolBots);
router.put('/superadmin/bots/:schoolId', authMiddleware, requireSuperAdmin, validate(aiSuperadminBotSchema), aiController.setSchoolBot);

export default router;
