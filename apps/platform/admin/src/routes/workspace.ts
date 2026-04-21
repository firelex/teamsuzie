import { Router } from 'express';
import { WorkspaceController } from '../controllers/workspace.js';
import { requireSession } from '../middleware/auth.js';

export function createWorkspaceRouter(controller: WorkspaceController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/files', controller.list);
  router.post('/files', controller.upsert);
  router.get('/files/:id', controller.get);
  router.delete('/files/:id', controller.remove);

  return router;
}
