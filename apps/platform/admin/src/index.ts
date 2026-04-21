import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import {
  Agent,
  AgentProfile,
  AgentWorkspaceFile,
  AuditLog,
  OrgDomain,
  Organization,
  OrganizationMember,
  SequelizeService,
  SessionService,
  User,
  UserAccessToken,
  createAuthRouter,
  createRequestId,
} from '@teamsuzie/shared-auth';
import type { ModelCtor } from 'sequelize-typescript';
import { config, sharedAuthConfig } from './config.js';
import { ChatController } from './controllers/chat.js';
import { AgentsController } from './controllers/agents.js';
import { SkillsController } from './controllers/skills.js';
import { ApprovalsController } from './controllers/approvals.js';
import { WorkspaceController } from './controllers/workspace.js';
import { createChatRouter } from './routes/chat.js';
import { createAgentsRouter, createAgentProfilesRouter } from './routes/agents.js';
import { createSkillsRouter } from './routes/skills.js';
import { createApprovalsRouter } from './routes/approvals.js';
import { createWorkspaceRouter } from './routes/workspace.js';
import { ChatProxyService } from './services/chat-proxy.js';
import { AgentsService } from './services/agents.js';
import { SkillsService } from './services/skills.js';
import { WorkspaceService } from './services/workspace.js';
import { createApprovalQueue } from './services/approvals.js';
import { ensureSeed } from './services/seed.js';
import { printStartupError } from './services/startup-errors.js';
import { getSession } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '../client/dist');

async function main() {
  const app = express();
  app.use(createRequestId());
  app.use(cors({ origin: config.allowedOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  // Sequelize bootstrap. The admin owns no tables of its own yet; it just
  // registers the shared-auth models so `sync()` creates the schema phases
  // 1-7 will write into.
  type ModelWithAssociate = ModelCtor & { associate: (models: unknown) => void };
  const sequelizeService = new SequelizeService(
    sharedAuthConfig,
    [
      User,
      Organization,
      OrganizationMember,
      AgentProfile,
      Agent,
      OrgDomain,
      UserAccessToken,
      AuditLog,
      AgentWorkspaceFile,
    ] as ModelWithAssociate[],
  );

  try {
    await sequelizeService.getSequelize().authenticate();
    await sequelizeService.getSequelize().sync();
    console.log('[DB] Schema synced (shared-auth)');
  } catch (err) {
    printStartupError(err);
    process.exit(1);
  }

  if (config.nodeEnv === 'development') {
    try {
      const summary = await ensureSeed();
      if (summary.created) {
        console.log('[seed] created demo data');
        console.log(`  admin login: ${summary.adminEmail} / ${summary.adminPassword}`);
        console.log(`  demo login:  ${summary.demoEmail} / ${summary.demoPassword}`);
      }
    } catch (err) {
      console.warn('[seed] skipped — will retry on next boot');
      console.warn(`  reason: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Session middleware (Redis-backed).
  const sessionService = new SessionService(sharedAuthConfig);
  sessionService.init(app);

  // Chat proxy — survives from the pre-thicken admin. Powers the /chat page.
  const chatProxyService = new ChatProxyService();
  const chatController = new ChatController(chatProxyService);

  // Open endpoint: surfaces title + (dev-only) demo creds for the login page.
  app.get('/api/health', (_req, res) => {
    const demo =
      config.nodeEnv === 'development'
        ? { email: config.demo.email, password: config.demo.password }
        : undefined;

    res.json({
      status: 'ok',
      service: 'admin',
      title: config.title,
      agentsConfigured: config.agents.length,
      demo,
    });
  });

  // Auth: /api/auth/login, /api/auth/register, /api/auth/logout, /api/auth/me, ...
  app.use('/api/auth', createAuthRouter(sharedAuthConfig));

  // Lightweight session probe for the client.
  app.get('/api/session', (req, res) => {
    const session = getSession(req);
    if (!session.userId) {
      res.json({ user: null });
      return;
    }
    res.json({
      user: {
        id: session.userId,
        email: session.userEmail,
        name: session.userName,
        role: session.userRole,
      },
    });
  });

  // Agents registry — Phase 1. Powers the Agents page and feeds the chat proxy.
  const agentsService = new AgentsService();
  const agentsController = new AgentsController(agentsService);
  app.use('/api/agents', createAgentsRouter(agentsController));
  app.use('/api/agent-profiles', createAgentProfilesRouter(agentsController));

  // Skills — Phase 2. Backed by packages/skills templates on disk.
  const skillsService = new SkillsService(SkillsService.defaultSkillsDir());
  const skillsController = new SkillsController(skillsService);
  app.use('/api/skill-templates', createSkillsRouter(skillsController));

  // Approvals — Phase 3. In-memory queue for v1; swap for a DB-backed store
  // once we need persistence across process restarts.
  const approvalQueue = createApprovalQueue();
  const approvalsController = new ApprovalsController(approvalQueue);
  app.use('/api/approvals', createApprovalsRouter(approvalsController));

  // Workspace artifacts — Phase 4. Text-only (markdown/json/yaml/text) via
  // AgentWorkspaceFile. Binary file delivery (pptx/xlsx/docx) needs a blob
  // column migration or an object-storage service; intentionally out of v1.
  const workspaceService = new WorkspaceService();
  const workspaceController = new WorkspaceController(workspaceService);
  app.use('/api/workspace', createWorkspaceRouter(workspaceController));

  app.use('/api/chat', createChatRouter(chatController));

  app.use(express.static(clientDistDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistDir, 'index.html'), (error) => {
      if (error) next();
    });
  });

  const server = createServer(app);
  chatController.initWebSocket(server);

  server.listen(config.port, () => {
    console.log(`Admin listening on ${config.publicUrl}`);
    console.log(`  agents configured: ${config.agents.length}`);
    if (config.nodeEnv === 'development') {
      console.log(`  open http://localhost:5175 and sign in with the demo creds shown on the login page`);
    }
  });
}

void main();
