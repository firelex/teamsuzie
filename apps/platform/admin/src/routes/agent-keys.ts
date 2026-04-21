import { Router } from 'express';
import { AgentKeysController } from '../controllers/agent-keys.js';
import { requireSession } from '../middleware/auth.js';

export function createAgentKeysRouter(controller: AgentKeysController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/scopes', controller.listScopes);
  router.delete('/:id', controller.revoke);

  return router;
}
