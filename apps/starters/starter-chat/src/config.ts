import 'dotenv/config';

export const config = {
  port: parseInt(process.env.STARTER_CHAT_PORT || '16311', 10),
  publicUrl: (process.env.STARTER_CHAT_PUBLIC_URL || 'http://localhost:16311').replace(/\/$/, ''),
  allowedOrigin: process.env.STARTER_CHAT_ALLOWED_ORIGIN || 'http://localhost:17276',
  title: process.env.STARTER_CHAT_TITLE || 'Starter Chat',
  agent: {
    name: process.env.STARTER_CHAT_AGENT_NAME || 'Suzie',
    description: process.env.STARTER_CHAT_AGENT_DESCRIPTION || 'OpenAI-compatible assistant',
    baseUrl: (process.env.STARTER_CHAT_AGENT_BASE_URL || 'http://localhost:4000').replace(/\/$/, ''),
    apiKey: process.env.STARTER_CHAT_AGENT_API_KEY || undefined,
    model: process.env.STARTER_CHAT_MODEL || 'openai/gpt-4.1-mini',
  },
};
