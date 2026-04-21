import { Router, type Request, type Response } from 'express';
import { User } from '@teamsuzie/shared-auth';
import { Contact } from '../models/contact.js';
import { getSession, requireSession } from '../middleware/auth.js';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function createExportRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/contacts.csv', async (req: Request, res: Response) => {
    const session = getSession(req);
    const me = await User.findByPk(session.userId!);
    const orgId = me?.default_organization_id;
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return;
    }
    const contacts = await Contact.findAll({
      where: { organization_id: orgId },
      order: [['created_at', 'DESC']],
    });

    const header = ['name', 'email', 'company', 'notes', 'created_at'];
    const lines = [
      header.join(','),
      ...contacts.map((c) =>
        [c.name, c.email, c.company, c.notes, c.created_at.toISOString()]
          .map(csvCell)
          .join(','),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(lines.join('\n'));
  });

  return router;
}
