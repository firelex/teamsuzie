// Chat / tool-use loop
export {
  runChatTurn,
  streamChatCompletion,
  readChatStream,
} from './chat-provider.js';
export type {
  ChatMessage,
  ChatMessageRole,
  ChatToolCall,
  ChatStreamEvent,
  AgentTarget,
  RunChatTurnOptions,
} from './chat-provider.js';

// Skills bridge
export { loadSkills } from './skills.js';
export type { SkillLoadConfig, LoadedSkill, SkillLoadResult } from './skills.js';

// MCP client
export {
  connectMcpServers,
  parseMcpConfigFile,
  parseMcpConfigText,
  MCP_TOOL_NAME_SEPARATOR,
} from './mcp.js';
export type {
  McpManager,
  McpServerSpec,
  McpServerStatus,
  StdioServerSpec,
  HttpServerSpec,
  ConnectMcpOptions,
} from './mcp.js';

// Tool registry + built-ins
export { tools, findTool, toOpenAITools } from './tools/index.js';
export { httpRequestTool, isHostAllowed } from './tools/http-request.js';
export { vectorSearchTool } from './tools/vector-search.js';
export { proposeActionTool } from './tools/propose-action.js';
export type {
  AnyToolDefinition,
  OpenAITool,
  ToolContext,
  ToolDefinition,
} from './tools/index.js';
