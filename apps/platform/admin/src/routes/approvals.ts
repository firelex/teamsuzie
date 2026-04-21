import { Router } from 'express';
import { ApprovalsController } from '../controllers/approvals.js';
import { requireSession } from '../middleware/auth.js';

export function createApprovalsRouter(controller: ApprovalsController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', controller.list);
  router.post('/', controller.propose);
  router.get('/action-types', controller.listActionTypes);
  router.get('/:id', controller.get);
  router.post('/:id/review', controller.review);

  return router;
}
