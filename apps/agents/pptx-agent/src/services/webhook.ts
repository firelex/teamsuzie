import { config } from '../config.js';

interface WebhookInfo {
    agentId: string;
    openclawAgentId: string | null;
    mainSessionKey: string | null;
    deliverTargets: Array<{ channel: string; to: string }>;
    url: string;
    token: string;
}

function getAgentApiKey(headers: Record<string, string | undefined>): string | null {
    const candidates = [
        headers['x-api-key'],
        headers['x-agent-api-key'],
        headers['authorization']?.replace('Bearer ', ''),
    ].filter(Boolean);
    return (candidates as string[]).find(k => k.startsWith('dtk_')) || null;
}

async function resolveWebhook(agentApiKey: string): Promise<WebhookInfo> {
    const res = await fetch(`${config.adminApiUrl}/api/agents/resolve-by-key`, {
        headers: { 'X-Agent-API-Key': agentApiKey },
    });
    if (!res.ok) {
        throw new Error(`resolve-by-key returned HTTP ${res.status}`);
    }
    const data = await res.json() as {
        agent_id: string;
        openclaw_agent_id?: string | null;
        main_session_key?: string | null;
        deliver_targets?: Array<{ channel: string; to: string }>;
        webhook_url: string | null;
        webhook_token: string | null;
    };
    if (!data.webhook_url) {
        throw new Error(`Agent ${data.agent_id.slice(0, 8)} has no webhook_url`);
    }
    return {
        agentId: data.agent_id,
        openclawAgentId: (data.openclaw_agent_id || '').trim() || null,
        mainSessionKey: (data.main_session_key || '').trim() || null,
        deliverTargets: data.deliver_targets || [],
        url: data.webhook_url,
        token: (data.webhook_token || '').trim(),
    };
}

/**
 * Execution session key for this workflow. Stays on `bg:<workflow>` even
 * when delivery targets a Matrix room — otherwise the presentation
 * completion would serialize with live chat in that room via the room's
 * shared session.
 */
function buildBackgroundSessionKey(openclawAgentId: string, workflow: string): string {
    return `agent:${openclawAgentId}:bg:${workflow}`;
}

async function fireAgentWebhook(
    jobId: string,
    message: string,
    agentApiKey: string,
    deliveryMode: 'message-tool' | 'cron-direct',
): Promise<void> {
    const { openclawAgentId, deliverTargets, url: webhookUrl, token } = await resolveWebhook(agentApiKey);

    if (!openclawAgentId) throw new Error('Missing openclaw_agent_id');
    if (!deliverTargets.length) throw new Error('No deliver_targets — agent has no channel bindings');

    const primaryTarget = deliverTargets[0];
    const hookAgentUrl = webhookUrl.replace(/\/hooks\/wake$/, '/hooks/agent');
    const sessionKey = buildBackgroundSessionKey(openclawAgentId, 'presentations');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body: Record<string, unknown> = {
        name: 'PptxAgent',
        message,
        wakeMode: 'now',
        agentId: openclawAgentId,
        accountId: openclawAgentId,
        sessionKey,
    };

    if (deliveryMode === 'cron-direct') {
        body.deliver = true;
        body.channel = primaryTarget.channel;
        body.to = primaryTarget.to;
    }

    const res = await fetch(hookAgentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        let details = '';
        try { details = await res.text(); } catch {}
        throw new Error(`hooks/agent failed (status=${res.status}) ${details}`.trim());
    }
    console.log(
        `[WEBHOOK] Fired for job ${jobId} → ${hookAgentUrl} ` +
        `(mode=${deliveryMode}, status=${res.status})`,
    );
}

export async function fireCompletionWebhook(
    jobId: string,
    filename: string,
    downloadUrl: string,
    agentApiKey: string,
): Promise<void> {
    const { deliverTargets } = await resolveWebhook(agentApiKey);
    const primaryTo = deliverTargets[0]?.to ?? 'current';

    const text = `Presentation ready: "${filename}" completed. Job ID: ${jobId}. Download: ${downloadUrl} (filename: ${filename})

Required delivery behavior for this turn — attachment via message tool ONLY:
1) Download the file into your workspace using the download URL (e.g. exec curl -fL "${downloadUrl}" -o /tmp/${filename}).
2) Call the message tool ONCE with to="${primaryTo}", a short caption, and filePath set to the downloaded file — this uploads the PPTX as an attachment.
3) Do not send the download link as text, do not paste execution logs, do not describe the file. The attachment IS the reply.
4) If the message tool fails, report the exact failure — do not fall back to pasting the URL.`;
    await fireAgentWebhook(jobId, text, agentApiKey, 'message-tool');
}

export { getAgentApiKey };
