import { config } from '@/lib/config';
import { ensureBoot, getActiveTools, getMcp, getSkillsState, getToolContext } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureBoot();

  let reachable = false;
  let runtimeError: string | undefined;
  try {
    const probe = await fetch(`${config.agent.baseUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    reachable = probe.status > 0;
  } catch (error) {
    try {
      const probe = await fetch(config.agent.baseUrl, { signal: AbortSignal.timeout(5_000) });
      reachable = probe.status > 0;
    } catch (inner) {
      runtimeError = inner instanceof Error ? inner.message : 'Health check failed';
    }
    if (!reachable && runtimeError === undefined) {
      runtimeError = error instanceof Error ? error.message : 'Health check failed';
    }
  }

  const skillsState = getSkillsState();
  const mcp = getMcp();
  const toolCtx = getToolContext();

  return Response.json({
    status: 'ok',
    title: config.title,
    agent: {
      name: config.agent.name,
      description: config.agent.description,
      reachable,
      ...(runtimeError ? { error: runtimeError } : {}),
    },
    tools: getActiveTools().map((t) => ({ name: t.name, description: t.description })),
    skills: skillsState.skills.map((s) => ({
      skillName: s.skillName,
      name: s.name,
      description: s.description,
      sourceId: s.sourceId,
    })),
    mcp: mcp.status,
    allowedHttpHosts: toolCtx.allowedHttpHosts ?? [],
  });
}
