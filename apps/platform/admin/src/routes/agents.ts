import { Router } from 'express';
import { AgentsController } from '../controllers/agents.js';
import { requireSession } from '../middleware/auth.js';

export function createAgentsRouter(controller: AgentsController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

export function createAgentProfilesRouter(controller: AgentsController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', controller.listProfiles);

  return router;
}
