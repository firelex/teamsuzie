import 'dotenv/config';

export const config = {
  port: parseInt(process.env.STARTER_CHAT_PORT || '14311', 10),
  publicUrl: (process.env.STARTER_CHAT_PUBLIC_URL || 'http://localhost:14311').replace(/\/$/, ''),
  allowedOrigin: process.env.STARTER_CHAT_ALLOWED_ORIGIN || 'http://localhost:15276',
  title: process.env.STARTER_CHAT_TITLE || 'Starter Chat',
  agent: {
    name: process.env.STARTER_CHAT_AGENT_NAME || 'Suzie',
    description: process.env.STARTER_CHAT_AGENT_DESCRIPTION || 'OpenClaw-compatible assistant',
    baseUrl: (process.env.STARTER_CHAT_AGENT_BASE_URL || 'http://localhost:18789').replace(/\/$/, ''),
    apiKey: process.env.STARTER_CHAT_AGENT_API_KEY || undefined,
    openclawAgentId: process.env.STARTER_CHAT_OPENCLAW_AGENT_ID || undefined,
  },
};
