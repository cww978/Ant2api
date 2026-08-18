import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error.js';
import openAiRouter from './routes/openai.js';
import claudeRouter from './routes/claude.js';
import geminiRouter from './routes/gemini.js';
import codexRouter from './routes/codex.js';
import adminRouter from './routes/admin.js';
import staticRouter from './routes/static.js';
import { WebSocketHandlerService } from './services/websocket-server.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// API Routes
app.use('/v1', openAiRouter);
app.use('/v1', claudeRouter);
app.use('/v1', codexRouter);
app.use('/v1/engines', codexRouter);
app.use('/v1beta', geminiRouter);
app.use('/api/admin', adminRouter);

// Web Management UI
app.use('/', staticRouter);

// Global Error Handler
app.use(errorHandler);

// Start Server
const server = app.listen(config.port, config.host, () => {
  // Attach native WebSocket support for /v1/responses and Codex clients
  WebSocketHandlerService.getInstance().attach(server);

  console.log(`
=============================================================
  🚀 Ant2api Gateway is running!
  -----------------------------------------------------------
  🌐 Web Dashboard:     http://localhost:${config.port}
  🔑 Admin Password:    ${config.adminPassword}
  📡 OpenAI Endpoint:   http://localhost:${config.port}/v1/chat/completions
  📡 Claude Endpoint:   http://localhost:${config.port}/v1/messages
  📡 Codex Endpoint:    http://localhost:${config.port}/v1/completions
  📡 WebSocket Endpoint:ws://localhost:${config.port}/v1/responses
  📡 Gemini Endpoint:   http://localhost:${config.port}/v1beta/models
  📊 Health Check:      http://localhost:${config.port}/health
=============================================================
`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
