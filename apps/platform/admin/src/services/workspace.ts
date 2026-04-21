import {
  Agent,
  AgentWorkspaceFile,
  User,
  type ContentType,
} from '@teamsuzie/shared-auth';

export const CONTENT_TYPES: ReadonlyArray<ContentType> = ['markdown', 'json', 'yaml', 'text'];

export interface WorkspaceFileSummary {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  organization_id: string | null;
  file_path: string;
  content_type: ContentType;
  size_bytes: number;
  created_at: Date;
  updated_at: Date | null;
}

export interface WorkspaceFileDetail extends WorkspaceFileSummary {
  content: string;
}

export interface UpsertFileInput {
  agent_id: string | null;
  file_path: string;
  content: string;
  content_type: ContentType;
}

export interface UpsertResult {
  file: WorkspaceFileDetail;
  created: boolean;
}

function serializeSummary(row: AgentWorkspaceFile): WorkspaceFileSummary {
  return {
    id: row.id,
    agent_id: row.agent_id,
    agent_name: row.agent?.name ?? null,
    organization_id: row.organization_id,
    file_path: row.file_path,
    content_type: row.content_type,
    size_bytes: Buffer.byteLength(row.content, 'utf8'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeDetail(row: AgentWorkspaceFile): WorkspaceFileDetail {
  return { ...serializeSummary(row), content: row.content };
}

export class ServiceInputError extends Error {
  readonly code: string;
  constructor(message: string, code = 'INVALID_INPUT') {
    super(message);
    this.code = code;
    this.name = 'ServiceInputError';
  }
}

export class WorkspaceService {
  async resolveOrgId(userId: string): Promise<string | null> {
    const user = await User.findByPk(userId);
    return user?.default_organization_id ?? null;
  }

  async list(
    organizationId: string,
    filters: { agentId?: string | null } = {},
  ): Promise<WorkspaceFileSummary[]> {
    const where: Record<string, unknown> = { organization_id: organizationId };
    if (filters.agentId !== undefined) {
      where.agent_id = filters.agentId;
    }
    const rows = await AgentWorkspaceFile.findAll({
      where,
      include: [{ model: Agent }],
      order: [['created_at', 'DESC']],
    });
    return rows.map(serializeSummary);
  }

  async get(id: string, organizationId: string): Promise<WorkspaceFileDetail | null> {
    const row = await AgentWorkspaceFile.findOne({
      where: { id, organization_id: organizationId },
      include: [{ model: Agent }],
    });
    return row ? serializeDetail(row) : null;
  }

  async upsert(
    input: UpsertFileInput,
    context: { userId: string; organizationId: string },
  ): Promise<UpsertResult> {
    if (!CONTENT_TYPES.includes(input.content_type)) {
      throw new ServiceInputError(`content_type must be one of: ${CONTENT_TYPES.join(', ')}`);
    }
    if (!input.file_path.trim()) {
      throw new ServiceInputError('file_path is required');
    }
    // Keep paths sane — no absolute paths, no traversal. This is a
    // conservative belt-and-braces check on top of the DB column's 255-char cap.
    if (input.file_path.startsWith('/') || input.file_path.includes('..')) {
      throw new ServiceInputError('file_path must be relative and must not contain ".."');
    }

    // Verify the agent (if any) belongs to the same org before binding the file to it.
    if (input.agent_id) {
      const agent = await Agent.findOne({
        where: { id: input.agent_id, organization_id: context.organizationId },
      });
      if (!agent) {
        throw new ServiceInputError('Unknown agent_id for this organization', 'NOT_FOUND');
      }
    }

    const existing = await AgentWorkspaceFile.findOne({
      where: {
        organization_id: context.organizationId,
        agent_id: input.agent_id,
        file_path: input.file_path,
      },
    });

    if (existing) {
      existing.content = input.content;
      existing.content_type = input.content_type;
      existing.updated_by = context.userId;
      await existing.save();
      const reloaded = await AgentWorkspaceFile.findByPk(existing.id, {
        include: [{ model: Agent }],
      });
      return { file: serializeDetail(reloaded!), created: false };
    }

    const created = await AgentWorkspaceFile.create({
      agent_id: input.agent_id,
      organization_id: context.organizationId,
      file_path: input.file_path,
      content: input.content,
      content_type: input.content_type,
      created_by: context.userId,
      updated_by: context.userId,
    } as Partial<AgentWorkspaceFile>);

    const reloaded = await AgentWorkspaceFile.findByPk(created.id, {
      include: [{ model: Agent }],
    });
    return { file: serializeDetail(reloaded!), created: true };
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const row = await AgentWorkspaceFile.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!row) return false;
    await row.destroy();
    return true;
  }
}
