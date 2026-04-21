import { Router } from 'express';
import { ApprovalsController } from '../controllers/approvals.js';
import { requireSession } from '../middleware/auth.js';
import { sessionOrAgentKey } from '../middleware/agent-key-auth.js';

export function createApprovalsRouter(controller: ApprovalsController): Router {
  const router = Router();

  // Propose accepts either an admin session (operator dogfooding) or an agent
  // bearer key (agent-driven proposal). Everything else is operator-only.
  router.post('/', sessionOrAgentKey, controller.propose);

  router.use(requireSession);
  router.get('/', controller.list);
  router.get('/action-types', controller.listActionTypes);
  router.get('/:id', controller.get);
  router.post('/:id/review', controller.review);

  return router;
}
