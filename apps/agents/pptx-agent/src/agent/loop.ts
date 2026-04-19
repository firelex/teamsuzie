import { config } from '../config.js';
import { buildSystemPrompt } from './system-prompt.js';
import { toolDefinitions } from './tools.js';
import { initializePresentation, getState, savePresentation } from '../services/presentation.js';
import { executeSandboxedCode } from '../sandbox/executor.js';
import { previewSlides } from '../services/preview.js';
import { searchDocs } from '../services/docs.js';
import { PATTERNS, searchPatterns } from './patterns.js';
import { PALETTES, searchPalettes } from './palettes.js';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

interface LLMResponse {
    choices: Array<{
        message: {
            role: string;
            content: string | null;
            tool_calls?: ToolCall[];
        };
        finish_reason: string;
    }>;
}

export interface AgentResult {
    filePath: string;
    slideCount: number;
}

export interface ProgressCallback {
    (message: string): void;
}

const MAX_ITERATIONS = 50;

async function callLLM(messages: ChatMessage[], model: string): Promise<LLMResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (config.llmKey) {
        headers['Authorization'] = `Bearer ${config.llmKey}`;
    }

    const body: Record<string, unknown> = {
        model,
        messages,
        tools: toolDefinitions,
        max_tokens: 16384,
    };

    const res = await fetch(`${config.llmProxyUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`LLM proxy error ${res.status}: ${text}`);
    }

    return await res.json() as LLMResponse;
}

async function handleToolCall(toolCall: ToolCall): Promise<string> {
    const { name, arguments: argsStr } = toolCall.function;
    let args: Record<string, unknown>;

    try {
        args = JSON.parse(argsStr);
    } catch {
        return JSON.stringify({ error: `Invalid JSON arguments: ${argsStr}` });
    }

    switch (name) {
        case 'initialize_presentation': {
            const state = initializePresentation(
                args.title as string,
                args.theme as { colors?: Record<string, string>; fonts?: { header: string; body: string } } | undefined,
            );
            return JSON.stringify({
                success: true,
                title: state.title,
                colors: state.designSystem.colors,
                fonts: state.designSystem.fonts,
                slide_dimensions: '10" x 5.625" (widescreen 16:9)',
            });
        }

        case 'add_slides': {
            const state = getState();
            if (!state) {
                return JSON.stringify({ success: false, error: 'No presentation initialized. Call initialize_presentation first.' });
            }
            const result = await executeSandboxedCode(
                args.code as string,
                state.pres,
                state.designSystem,
            );
            return JSON.stringify({
                success: result.success,
                slide_count: result.slideCount,
                error: result.error,
            });
        }

        case 'preview_slides': {
            const state = getState();
            if (!state) {
                return JSON.stringify({ success: false, error: 'No presentation initialized.' });
            }
            try {
                const images = await previewSlides(args.slide_numbers as number[] | undefined);
                return JSON.stringify({ success: true, images });
            } catch (e) {
                return JSON.stringify({
                    success: false,
                    error: `Preview failed: ${(e as Error).message}. LibreOffice and pdftoppm must be installed.`,
                });
            }
        }

        case 'read_pptxgenjs_docs': {
            const sections = searchDocs(args.topic as string);
            if (sections.length === 0) {
                return JSON.stringify({ sections: [], message: 'No matching documentation found for that topic.' });
            }
            return JSON.stringify({ sections });
        }

        case 'finalize_presentation': {
            const state = getState();
            if (!state) {
                return JSON.stringify({ success: false, error: 'No presentation initialized.' });
            }
            try {
                const result = await savePresentation(args.filename as string);
                return JSON.stringify({
                    success: true,
                    file_path: result.filePath,
                    slide_count: result.slideCount,
                });
            } catch (e) {
                return JSON.stringify({
                    success: false,
                    error: `Save failed: ${(e as Error).message}`,
                });
            }
        }

        case 'browse_layout_patterns': {
            const query = args.query as string;
            // Try exact match by ID first
            const exact = PATTERNS.find(p => p.id === query);
            if (exact) {
                return JSON.stringify({ patterns: [exact] });
            }
            const results = searchPatterns(query);
            if (results.length === 0) {
                return JSON.stringify({ patterns: [], available: PATTERNS.map(p => ({ id: p.id, name: p.name })) });
            }
            return JSON.stringify({ patterns: results });
        }

        case 'browse_color_palettes': {
            const query = args.query as string;
            const exact = PALETTES.find(p => p.id === query);
            if (exact) {
                return JSON.stringify({ palettes: [exact] });
            }
            const results = searchPalettes(query);
            if (results.length === 0) {
                return JSON.stringify({ palettes: [], available: PALETTES.map(p => ({ id: p.id, name: p.name, description: p.description })) });
            }
            return JSON.stringify({ palettes: results });
        }

        default:
            return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
}

export async function runAgentLoop(
    userPrompt: string,
    model?: string,
    onProgress?: ProgressCallback,
): Promise<AgentResult> {
    const activeModel = model || config.model;
    const log = onProgress || ((msg: string) => console.log(`[AGENT] ${msg}`));

    log(`Starting with model: ${activeModel}`);

    const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt },
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        log(`Iteration ${iteration + 1}/${MAX_ITERATIONS}`);

        const response = await callLLM(messages, activeModel);
        const choice = response.choices[0];

        if (!choice) {
            throw new Error('No response from LLM');
        }

        const assistantMsg = choice.message;

        // Build the assistant message for history
        const historyMsg: ChatMessage = {
            role: 'assistant',
            content: assistantMsg.content || '',
        };
        if (assistantMsg.tool_calls?.length) {
            historyMsg.tool_calls = assistantMsg.tool_calls;
        }
        messages.push(historyMsg);

        if (assistantMsg.content) {
            // Show full text for QA feedback, truncate routine messages
            const isAfterPreview = messages.some((m, i) => i > messages.length - 4 && m.role === 'tool' && typeof m.content === 'string' && m.content.includes('Preview images attached'));
            if (isAfterPreview || assistantMsg.content.length <= 500) {
                log(`Assistant: ${assistantMsg.content}`);
            } else {
                log(`Assistant: ${assistantMsg.content.slice(0, 300)}...`);
            }
        }

        // If no tool calls, we're done
        if (!assistantMsg.tool_calls?.length) {
            log('Agent finished without finalizing. Looking for saved file...');
            // Check if a file was saved in a previous iteration
            break;
        }

        // Execute tool calls
        for (const toolCall of assistantMsg.tool_calls) {
            log(`Tool: ${toolCall.function.name}`);

            const result = await handleToolCall(toolCall);
            const parsed = JSON.parse(result);

            // For preview_slides, return string tool result + follow-up user message with images
            if (toolCall.function.name === 'preview_slides' && parsed.success && parsed.images?.length) {
                // Tool result must be a string
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ success: true, slide_count: parsed.images.length, message: 'Preview images attached in the next message. Examine each carefully for layout issues, text overflow, alignment problems, or design inconsistencies.' }),
                });

                // Send images as a follow-up user message with multimodal content
                const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
                    { type: 'text', text: `Here are the preview images of ${parsed.images.length} slide(s). Examine each carefully:` },
                ];

                for (const img of parsed.images) {
                    contentParts.push({
                        type: 'text',
                        text: `\n--- Slide ${img.slide_number} ---`,
                    });
                    contentParts.push({
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${img.image_base64}` },
                    });
                }

                messages.push({
                    role: 'user',
                    content: contentParts,
                });

                log(`Preview: ${parsed.images.length} slide image(s) sent for QA`);
            } else {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: result,
                });
            }

            // Check if finalize was called successfully
            if (toolCall.function.name === 'finalize_presentation' && parsed.success) {
                log(`Presentation saved: ${parsed.file_path} (${parsed.slide_count} slides)`);
                return {
                    filePath: parsed.file_path,
                    slideCount: parsed.slide_count,
                };
            }
        }
    }

    throw new Error('Agent exceeded maximum iterations without finalizing the presentation');
}
