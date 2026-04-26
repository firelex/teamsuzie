import { ApprovalQueue, InMemoryApprovalStore } from '@teamsuzie/approvals';
import {
  connectMcpServers,
  loadSkills,
  parseMcpConfigText,
  tools as builtInTools,
  type AnyToolDefinition,
  type McpManager,
  type SkillLoadResult,
  type ToolContext,
} from '@teamsuzie/agent-loop';
import { config } from './config';

/**
 * Module-scope state. Survives warm restarts inside one serverless instance,
 * resets on cold start. Demo-grade only — wire a persistent store
 * (Vercel Postgres / KV / Upstash) for real persistence.
 */
const approvals = new ApprovalQueue({ store: new InMemoryApprovalStore() });

let skillsState: SkillLoadResult = { skills: [], systemPrompt: '', derivedHosts: [] };
let mcp: McpManager = { tools: [], status: [], shutdown: async () => {} };
let bootPromise: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  if (config.skills.catalogUrl) {
    try {
      skillsState = await loadSkills({
        catalogUrl: config.skills.catalogUrl,
        catalogToken: config.skills.catalogToken,
        allow: config.skills.allow.length ? config.skills.allow : undefined,
        renderContext: config.skills.renderContext,
      });
    } catch (error) {
      console.error('Skill load failed:', error instanceof Error ? error.message : error);
    }
  }

  if (config.mcp.configJson) {
    try {
      const servers = parseMcpConfigText(config.mcp.configJson);
      const stdioConfigured = servers.find((s) => 'command' in s);
      if (stdioConfigured) {
        throw new Error(
          `MCP server "${stdioConfigured.name}" uses stdio transport. Stdio is not supported on Vercel — use Streamable HTTP servers (provide "url" instead of "command"). See README.`,
        );
      }
      if (servers.length > 0) {
        mcp = await connectMcpServers({ servers });
      }
    } catch (error) {
      console.error('MCP bootstrap failed:', error instanceof Error ? error.message : error);
    }
  }
}

export function ensureBoot(): Promise<void> {
  if (!bootPromise) bootPromise = bootstrap();
  return bootPromise;
}

export function getApprovals(): ApprovalQueue {
  return approvals;
}

export function getSkillsState(): SkillLoadResult {
  return skillsState;
}

export function getMcp(): McpManager {
  return mcp;
}

export function getActiveTools(): AnyToolDefinition[] {
  return [...builtInTools, ...mcp.tools];
}

export function getToolContext(): ToolContext {
  const hosts = [
    ...new Set([...config.tools.allowedHttpHosts, ...skillsState.derivedHosts]),
  ];
  return {
    approvals,
    vectorDbBaseUrl: config.vectorDb.baseUrl,
    vectorDbApiKey: config.vectorDb.apiKey,
    allowedHttpHosts: hosts,
  };
}
