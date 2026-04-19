import { Router } from 'express';
import { ChatController } from '../controllers/chat.js';

export function createChatRouter(chatController: ChatController): Router {
  const router = Router();
  router.get('/agents', chatController.listAgents);
  return router;
}
