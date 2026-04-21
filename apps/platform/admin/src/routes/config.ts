import { Router } from 'express';
import { ConfigController } from '../controllers/config.js';
import { requireSession } from '../middleware/auth.js';

export function createConfigRouter(controller: ConfigController): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/definitions', controller.listDefinitions);
  router.get('/values', controller.listValues);
  router.get('/values/:key', controller.getValue);
  router.put('/values/:key', controller.setValue);
  router.delete('/values/:key', controller.unsetValue);

  return router;
}
