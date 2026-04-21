import { Router } from 'express';
import { ActivityController } from '../controllers/activity.js';
import { requireSession } from '../middleware/auth.js';

export function createActivityRouter(controller: ActivityController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', controller.list);
  router.get('/recent-agents', controller.recentlyActive);
  router.get('/usage', controller.listUsage);
  router.get('/usage-summary', controller.usageSummary);

  return router;
}
