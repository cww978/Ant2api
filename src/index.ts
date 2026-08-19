import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error.js';
import adminRouter from './routes/admin.js';
import staticRouter from './routes/static.js';
import { ProxyLifecycleService } from './services/proxy-lifecycle.js';

const app = express();

// Middlewares for Admin Server
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Admin health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ant2api-admin-server',
    version: '1.0.0',
    adminPort: config.adminPort,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Admin REST API Routes
app.use('/api/admin', adminRouter);

// Web Management UI (Next.js React Build / Static Assets)
app.use('/', staticRouter);

// Global Error Handler
app.use(errorHandler);

// Start Admin Server
const adminServer = app.listen(config.adminPort, config.adminHost, async () => {
  console.log(`
=============================================================
  🎛️  Ant2api Admin Web Management Console
  -----------------------------------------------------------
  🌐 Web Dashboard:     http://localhost:${config.adminPort}
  🔑 Admin Password:    ${config.adminPassword}
  📊 Admin Health:      http://localhost:${config.adminPort}/health
=============================================================
  `);

  // Initialize and auto-start the Reverse Proxy Service on its separate port
  const proxyLifecycle = ProxyLifecycleService.getInstance();
  await proxyLifecycle.init();
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing servers');
  await ProxyLifecycleService.getInstance().stop();
  adminServer.close(() => {
    console.log('Admin server closed');
  });
});

export default app;

