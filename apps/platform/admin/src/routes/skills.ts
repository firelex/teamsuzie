import { Router } from 'express';
import { SkillsController } from '../controllers/skills.js';
import { requireSession } from '../middleware/auth.js';

export function createSkillsRouter(controller: SkillsController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', controller.list);
  router.get('/:slug', controller.get);

  return router;
}
