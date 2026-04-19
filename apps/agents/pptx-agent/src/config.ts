import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the LLM model for the pptx-agent loop.
 *
 * **Required.** No code fallback by design — matches the policy used by
 * admin, docx-agent, and xlsx-agent. A silent default hides
 * misconfiguration and costs hours of debugging. Reads (in order):
 *   - `PPTX_AGENT_MODEL` (pptx-specific override for testing)
 *   - `DEFAULT_LLM_MODEL` (platform default, shared by all agents)
 * Throws loudly if neither is set.
 */
function resolveModel(): string {
    const v = (process.env.PPTX_AGENT_MODEL || process.env.DEFAULT_LLM_MODEL || '').trim();
    if (!v) {
        throw new Error(
            'pptx-agent: DEFAULT_LLM_MODEL environment variable is required ' +
            '(e.g. `dashscope/qwen3.6-plus`). PPTX_AGENT_MODEL is accepted as ' +
            'a pptx-specific override.',
        );
    }
    return v;
}

export const config = {
    model: resolveModel(),
    llmKey: process.env.PPTX_AGENT_LLM_KEY || 'pptx-agent',
    llmProxyUrl: (process.env.LLM_PROXY_URL || 'http://localhost:4000').replace(/\/$/, ''),
    port: parseInt(process.env.PPTX_AGENT_PORT || '3009', 10),
    outputDir: path.resolve(process.env.PPTX_AGENT_OUTPUT_DIR || path.join(__dirname, '../output')),
    adminApiUrl: (process.env.ADMIN_API_URL || 'http://localhost:3008').replace(/\/$/, ''),
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:3009').replace(/\/$/, ''),
};
