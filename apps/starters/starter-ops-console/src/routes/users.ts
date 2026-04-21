import { Router, type Request, type Response } from 'express';
import { OrganizationMember, User } from '@teamsuzie/shared-auth';
import { getSession, requireSession } from '../middleware/auth.js';

/**
 * Read-only users list scoped to the current user's default organization.
 * Roles shown are the OrganizationMember role (owner/admin/member), not the
 * global User.role. Future phases: role change, deactivate.
 */
export function createUsersRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req: Request, res: Response) => {
    const session = getSession(req);
    const me = await User.findByPk(session.userId!);
    const orgId = me?.default_organization_id;
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return;
    }
    const members = await OrganizationMember.findAll({
      where: { organization_id: orgId },
    });
    const userIds = members.map((m) => m.user_id);
    const users = await User.findAll({ where: { id: userIds } });
    const userById = new Map(users.map((u) => [u.id, u]));

    res.json({
      items: members
        .map((m) => {
          const u = userById.get(m.user_id);
          if (!u) return null;
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: m.role,
            joined_at: m.created_at,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    });
  });

  return router;
}
