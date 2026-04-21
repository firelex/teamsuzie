import type { Request, Response } from 'express';
import { getRequestActor } from '@teamsuzie/shared-auth';
import { SkillsService } from '../services/skills.js';

export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  private logOk(req: Request, action: string, extra = ''): void {
    const actor = getRequestActor(req);
    console.log(
      `[admin.skills.${action}] ok actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''}`,
    );
  }

  private logFail(req: Request, action: string, err: unknown, extra = ''): void {
    const actor = getRequestActor(req);
    console.error(
      `[admin.skills.${action}] fail actor=${actor.type}:${actor.userId ?? '-'} org=${actor.orgId ?? '-'} req=${actor.requestId ?? '-'}${extra ? ' ' + extra : ''} err=${err instanceof Error ? err.message : String(err)}`,
    );
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const items = this.skills.list();
      this.logOk(req, 'list', `count=${items.length}`);
      res.json({ items });
    } catch (err) {
      this.logFail(req, 'list', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list skills' });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug);
    try {
      const detail = this.skills.get(slug);
      if (!detail) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      this.logOk(req, 'get', `slug=${slug}`);
      res.json({ skill: detail });
    } catch (err) {
      this.logFail(req, 'get', err, `slug=${slug}`);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load skill' });
    }
  };
}
