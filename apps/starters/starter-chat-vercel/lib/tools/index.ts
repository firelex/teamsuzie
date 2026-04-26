import { httpRequestTool } from './http-request';
import { proposeActionTool } from './propose-action';
import { vectorSearchTool } from './vector-search';
import type { AnyToolDefinition } from './types';

export { toOpenAITools } from './types';
export type { AnyToolDefinition, OpenAITool, ToolContext, ToolDefinition } from './types';

export const tools: AnyToolDefinition[] = [vectorSearchTool, proposeActionTool, httpRequestTool];

export function findTool(name: string): AnyToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}
