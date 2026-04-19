import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { config } from './config.js';
import { ChatController } from './controllers/chat.js';
import { createChatRouter } from './routes/chat.js';
import { ChatProxyService } from './services/chat-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '../client/dist');

const app = express();
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const chatProxyService = new ChatProxyService();
const chatController = new ChatController(chatProxyService);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'admin',
    agentsConfigured: config.agents.length,
  });
});

app.use('/api/chat', createChatRouter(chatController));

app.use(express.static(clientDistDir));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
    next();
    return;
  }

  res.sendFile(path.join(clientDistDir, 'index.html'), (error) => {
    if (error) {
      next();
    }
  });
});

const server = createServer(app);
chatController.initWebSocket(server);

server.listen(config.port, () => {
  console.log(`Admin listening on ${config.publicUrl}`);
});
