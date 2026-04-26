import type { ApprovalQueue } from '@teamsuzie/approvals';

export interface ToolContext {
  approvals: ApprovalQueue;
  vectorDbBaseUrl: string;
  vectorDbApiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: TArgs, ctx: ToolContext): Promise<TResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, unknown>;

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toOpenAITools(tools: AnyToolDefinition[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
