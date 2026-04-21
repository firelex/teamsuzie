import { Router, type Request, type Response } from 'express';
import type { ApprovalQueue } from '@teamsuzie/approvals';
import { getRequestActor } from '@teamsuzie/shared-auth';
import { getSession, requireSession } from '../middleware/auth.js';

interface Deps {
  queue: ApprovalQueue;
}

export function createApprovalsRouter({ queue }: Deps): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const items = await queue.list(
      status
        ? { status: status as 'pending' | 'approved' | 'rejected' | 'dispatched' | 'failed' }
        : {},
    );
    res.json({ items });
  });

  router.post('/:id/review', async (req: Request<{ id: string }>, res: Response) => {
    const session = getSession(req);
    const actor = getRequestActor(req);
    const id = req.params.id;
    const { verdict, reason, edited_payload } = req.body ?? {};
    if (verdict !== 'approve' && verdict !== 'reject') {
      res.status(400).json({ error: 'verdict must be "approve" or "reject"' });
      return;
    }
    try {
      const reviewed = await queue.review(id, {
        reviewer_id: session.userId!,
        verdict,
        reason,
        edited_payload,
      });

      // Auto-dispatch on approve so the UX is one-click for approvers.
      // Production setups often defer dispatch to a worker instead.
      if (reviewed.status === 'approved') {
        const dispatched = await queue.dispatch(id);
        console.log(
          `[ops.approvals.review] dispatched item=${id} verdict=approve actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}`,
        );
        res.json({ item: dispatched });
        return;
      }

      console.log(
        `[ops.approvals.review] item=${id} verdict=${verdict} status=${reviewed.status} actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}`,
      );
      res.json({ item: reviewed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review failed';
      console.error(
        `[ops.approvals.review] fail item=${id} verdict=${verdict} actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'} err=${message}`,
      );
      res.status(400).json({ error: message });
    }
  });

  return router;
}
