import type { Request, Response } from 'express';
import { AuditLog, getRequestActor } from '@teamsuzie/shared-auth';
import {
  ApprovalQueueError,
  type ApprovalItem,
  type ApprovalQueue,
  type ApprovalStatus,
} from '@teamsuzie/approvals';
import { getSession } from '../middleware/auth.js';

const KNOWN_STATUSES: ReadonlyArray<ApprovalStatus> = [
  'pending',
  'approved',
  'rejected',
  'dispatched',
  'failed',
];

function parseStatus(raw: unknown): ApprovalStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  return KNOWN_STATUSES.includes(raw as ApprovalStatus) ? (raw as ApprovalStatus) : undefined;
}

function asObject(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

export class ApprovalsController {
  constructor(private readonly queue: ApprovalQueue) {}

  private logOk(req: Request, action: string, extra = ''): void {
    const actor = getRequestActor(req);
    console.log(
      `[admin.approvals.${action}] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''}`,
    );
  }

  private logFail(req: Request, action: string, err: unknown, extra = ''): void {
    const actor = getRequestActor(req);
    console.error(
      `[admin.approvals.${action}] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''} err=${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async writeAudit(
    actorId: string | null,
    action: string,
    item: ApprovalItem,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await AuditLog.create({
        actor_type: 'user',
        actor_id: actorId,
        action,
        resource_type: 'approval',
        resource_id: item.id,
        details: {
          action_type: item.action_type,
          subject_id: item.subject_id,
          status: item.status,
          ...details,
        },
      } as Partial<AuditLog>);
    } catch (err) {
      console.warn(
        `[admin.approvals.audit] write failed action=${action} item=${item.id} err=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = parseStatus(req.query.status);
      const items = await this.queue.list(status ? { status } : {});
      this.logOk(req, 'list', `status=${status ?? 'all'} count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'list', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list approvals' });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    try {
      const item = await this.queue.get(id);
      if (!item) {
        res.status(404).json({ error: 'Approval not found' });
        return;
      }
      this.logOk(req, 'get', `id=${id}`);
      res.json({ item });
    } catch (err) {
      this.logFail(req, 'get', err, `id=${id}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load approval' });
    }
  };

  propose = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const body = asObject(req.body);
    if (!body) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const action_type = typeof body.action_type === 'string' ? body.action_type.trim() : '';
    const subject_id =
      typeof body.subject_id === 'string' && body.subject_id.trim() ? body.subject_id.trim() : session.userId!;
    const payload = body.payload ?? {};
    const metadata = asObject(body.metadata);

    if (!action_type) {
      res.status(400).json({ error: 'action_type is required' });
      return;
    }

    try {
      const item = await this.queue.propose({
        subject_id,
        action_type,
        payload,
        metadata: {
          proposed_by_email: session.userEmail,
          ...(metadata ?? {}),
        },
      });
      await this.writeAudit(session.userId ?? null, 'approval.propose', item);
      this.logOk(req, 'propose', `id=${item.id} action_type=${action_type}`);
      res.status(201).json({ item });
    } catch (err) {
      this.logFail(req, 'propose', err, `action_type=${action_type}`);
      if (err instanceof ApprovalQueueError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to propose approval' });
    }
  };

  review = async (req: Request, res: Response): Promise<void> => {
    const session = getSession(req);
    const id = String(req.params.id);
    const body = asObject(req.body);
    const verdict = body?.verdict;
    const reason = typeof body?.reason === 'string' ? body.reason : undefined;

    if (verdict !== 'approve' && verdict !== 'reject') {
      res.status(400).json({ error: 'verdict must be "approve" or "reject"' });
      return;
    }

    try {
      const reviewed = await this.queue.review(id, {
        reviewer_id: session.userId!,
        verdict,
        reason,
      });

      let finalItem: ApprovalItem = reviewed;

      if (reviewed.status === 'approved') {
        const hasDispatcher = this.queue.listActionTypes().includes(reviewed.action_type);
        if (hasDispatcher) {
          finalItem = await this.queue.dispatch(id);
        }
      }

      await this.writeAudit(session.userId ?? null, `approval.${verdict}`, finalItem, {
        reason: reason ?? null,
        dispatched: finalItem.status === 'dispatched',
        dispatch_error: finalItem.dispatch?.error ?? null,
      });

      this.logOk(
        req,
        'review',
        `id=${id} verdict=${verdict} status=${finalItem.status}${finalItem.dispatch?.error ? ` dispatch_error=${finalItem.dispatch.error}` : ''}`,
      );
      res.json({ item: finalItem });
    } catch (err) {
      this.logFail(req, 'review', err, `id=${id} verdict=${verdict}`);
      if (err instanceof ApprovalQueueError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'INVALID_STATE' ? 409 : 400;
        res.status(status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Review failed' });
    }
  };

  listActionTypes = async (req: Request, res: Response): Promise<void> => {
    try {
      const action_types = this.queue.listActionTypes();
      this.logOk(req, 'listActionTypes', `count=${action_types.length}`);
      res.json({ action_types });
    } catch (err) {
      this.logFail(req, 'listActionTypes', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list action types' });
    }
  };
}
