import { httpRequestTool } from './http-request.js';
import { proposeActionTool } from './propose-action.js';
import { vectorSearchTool } from './vector-search.js';
import type { AnyToolDefinition } from './types.js';

export { toOpenAITools } from './types.js';
export type { AnyToolDefinition, OpenAITool, ToolContext, ToolDefinition } from './types.js';

export const tools: AnyToolDefinition[] = [vectorSearchTool, proposeActionTool, httpRequestTool];

export function findTool(name: string): AnyToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}
