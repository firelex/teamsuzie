import { Router, type Request, type Response } from 'express';
import { User } from '@teamsuzie/shared-auth';
import type { ApprovalQueue } from '@teamsuzie/approvals';
import { Contact } from '../models/contact.js';
import { getSession, requireSession } from '../middleware/auth.js';
import {
  ACTION_DELETE_CONTACT,
  type DeleteContactPayload,
} from '../services/approvals.js';
import { config } from '../config.js';

interface Deps {
  queue: ApprovalQueue;
}

async function resolveOrgId(userId: string): Promise<string | null> {
  const user = await User.findByPk(userId);
  return user?.default_organization_id ?? null;
}

export function createContactsRouter({ queue }: Deps): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req: Request, res: Response) => {
    const session = getSession(req);
    const orgId = await resolveOrgId(session.userId!);
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return;
    }
    const contacts = await Contact.findAll({
      where: { organization_id: orgId },
      order: [['created_at', 'DESC']],
    });
    res.json({
      items: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        notes: c.notes,
        created_at: c.created_at,
      })),
    });
  });

  router.post('/', async (req: Request, res: Response) => {
    const session = getSession(req);
    const orgId = await resolveOrgId(session.userId!);
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return;
    }
    const { name, email, company, notes } = req.body ?? {};
    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }
    const contact = await Contact.create({
      organization_id: orgId,
      name,
      email,
      company: company ?? null,
      notes: notes ?? null,
      created_by: session.userId!,
      updated_by: session.userId!,
    });
    res.status(201).json({ contact });
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    const session = getSession(req);
    const orgId = await resolveOrgId(session.userId!);
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return;
    }
    const contact = await Contact.findOne({
      where: { id: req.params.id, organization_id: orgId },
    });
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    const { name, email, company, notes } = req.body ?? {};
    if (name !== undefined) contact.name = name;
    if (email !== undefined) contact.email = email;
    if (company !== undefined) contact.company = company;
    if (notes !== undefined) contact.notes = notes;
    contact.updated_by = session.userId!;
    await contact.save();
    res.json({ contact });
  });

  /**
   * Delete flow:
   * - If STARTER_OPS_APPROVALS_ENABLED=true (default), submit a `contact.delete`
   *   proposal to the approval queue and return 202 with the approval id. The
   *   actual delete runs when a reviewer approves + dispatches.
   * - If disabled, delete immediately (for local/simple use).
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    const session = getSession(req);
    const orgId = await resolveOrgId(session.userId!);
    if (!orgId) {
      res.status(400).json({ error: 'User has no default organization' });
      return;
    }
    const contact = await Contact.findOne({
      where: { id: req.params.id, organization_id: orgId },
    });
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    if (!config.approvals.enabled) {
      await contact.destroy();
      res.json({ deleted: true, mode: 'direct' });
      return;
    }

    const approval = await queue.propose<DeleteContactPayload>({
      subject_id: session.userId!,
      action_type: ACTION_DELETE_CONTACT,
      payload: { contact_id: contact.id, organization_id: orgId },
      metadata: {
        contact_name: contact.name,
        contact_email: contact.email,
        proposed_by_email: session.userEmail,
      },
    });

    res.status(202).json({ approval_id: approval.id, mode: 'approval' });
  });

  return router;
}
