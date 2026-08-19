import http, { Server as HttpServer } from 'http';
import { Duplex } from 'stream';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { StorageService, ProxyServiceSettings } from './storage.js';
import { requestLogger } from '../middleware/logger.js';
import { errorHandler } from '../middleware/error.js';
import openAiRouter from '../routes/openai.js';
import geminiRouter from '../routes/gemini.js';
import codexRouter from '../routes/codex.js';
import { WebSocketHandlerService } from './websocket-server.js';
import { config } from '../config.js';

export interface ProxyServiceStatusInfo {
  status: 'running' | 'stopped' | 'restarting' | 'error';
  port: number;
  host: string;
  allowLan: boolean;
  startTime: number | null;
  uptime: number;
  error: string | null;
  timeoutSeconds: number;
  autoStart: boolean;
  authEnabled: boolean;
  authMode: 'auto' | 'strict' | 'disabled';
  masterApiKey: string;
  userAgentOverride: boolean;
  customUserAgent: string;
}

export class ProxyLifecycleService {
  private static instance: ProxyLifecycleService;
  private storage = StorageService.getInstance();
  private server: HttpServer | null = null;
  private openSockets = new Set<Duplex>();
  private status: 'running' | 'stopped' | 'restarting' | 'error' = 'stopped';
  private startTime: number | null = null;
  private activePort: number = 8090;
  private activeHost: string = '127.0.0.1';
  private lastError: string | null = null;

  private constructor() {
    const settings = this.storage.getProxySettings();
    this.activePort = settings.port || config.proxyPort || 8090;
    this.activeHost = settings.allowLan ? '0.0.0.0' : (settings.host || '127.0.0.1');
  }

  public static getInstance(): ProxyLifecycleService {
    if (!ProxyLifecycleService.instance) {
      ProxyLifecycleService.instance = new ProxyLifecycleService();
    }
    return ProxyLifecycleService.instance;
  }

  /**
   * Initializes the proxy lifecycle service during app boot.
   */
  public async init(): Promise<void> {
    const settings = this.storage.getProxySettings();
    if (settings.autoStart) {
      try {
        console.log(`[ProxyService] Auto-starting reverse proxy on port ${settings.port}...`);
        await this.start();
      } catch (err: any) {
        console.error(`[ProxyService] Auto-start failed: ${err.message}`);
      }
    } else {
      console.log(`[ProxyService] Auto-start is disabled. Reverse proxy is stopped.`);
    }
  }

  /**
   * Starts the reverse proxy service on configured port and host
   */
  public async start(): Promise<ProxyServiceStatusInfo> {
    if (this.status === 'running' && this.server) {
      return this.getStatus();
    }

    const settings = this.storage.getProxySettings();
    const targetPort = settings.port || config.proxyPort || 8090;
    const targetHost = settings.allowLan ? '0.0.0.0' : (settings.host || '127.0.0.1');

    this.activePort = targetPort;
    this.activeHost = targetHost;
    this.status = 'restarting';
    this.lastError = null;

    try {
      const app = this.createProxyApp(settings);
      const server = http.createServer(app);

      // Track active sockets for immediate clean teardown
      server.on('connection', (socket: Duplex) => {
        this.openSockets.add(socket);
        socket.on('close', () => {
          this.openSockets.delete(socket);
        });
      });

      // Attach WebSocket handler for /v1/responses and Codex clients
      WebSocketHandlerService.getInstance().attach(server);

      await new Promise<void>((resolve, reject) => {
        const onError = (err: any) => {
          server.removeAllListeners('listening');
          reject(err);
        };
        server.once('error', onError);
        server.listen(targetPort, targetHost, () => {
          server.removeListener('error', onError);
          resolve();
        });
      });

      this.server = server;
      this.status = 'running';
      this.startTime = Date.now();

      console.log(`
=============================================================
  🚀 Ant2api Reverse Proxy Service is RUNNING!
  -----------------------------------------------------------
  📡 Proxy Listen Host:  ${targetHost}
  📡 Proxy Listen Port:  ${targetPort}
  📡 OpenAI Endpoint:    http://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${targetPort}/v1/chat/completions
  📡 Codex Endpoint:     http://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${targetPort}/v1/completions
  📡 Responses API:      http://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${targetPort}/v1/responses
  📡 WebSocket Endpoint: ws://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${targetPort}/v1/responses
  📡 Gemini Endpoint:    http://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${targetPort}/v1beta/models
  📊 Health Check:       http://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${targetPort}/health
=============================================================
      `);

      return this.getStatus();
    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message || 'Failed to start proxy server';
      console.error(`[ProxyService] Error starting reverse proxy:`, err);
      throw err;
    }
  }

  /**
   * Stops the reverse proxy service
   */
  public async stop(): Promise<ProxyServiceStatusInfo> {
    if (!this.server && this.status === 'stopped') {
      return this.getStatus();
    }

    this.status = 'stopped';
    this.startTime = null;

    if (this.server) {
      const srv = this.server;
      this.server = null;

      // Close all active connections immediately
      for (const socket of this.openSockets) {
        try {
          socket.destroy();
        } catch {}
      }
      this.openSockets.clear();

      await new Promise<void>((resolve) => {
        srv.close(() => {
          resolve();
        });
      });

      console.log(`[ProxyService] Reverse proxy server stopped on port ${this.activePort}`);
    }

    return this.getStatus();
  }

  /**
   * Restarts the reverse proxy service with optional new configuration
   */
  public async restart(newSettings?: Partial<ProxyServiceSettings>): Promise<ProxyServiceStatusInfo> {
    this.status = 'restarting';

    if (newSettings && Object.keys(newSettings).length > 0) {
      this.storage.updateProxySettings(newSettings);
    }

    await this.stop();
    return await this.start();
  }

  /**
   * Returns complete real-time status of the proxy service
   */
  public getStatus(): ProxyServiceStatusInfo {
    const settings = this.storage.getProxySettings();
    const uptime = this.startTime && this.status === 'running'
      ? Math.floor((Date.now() - this.startTime) / 1000)
      : 0;

    return {
      status: this.status,
      port: this.activePort || settings.port || 8090,
      host: this.activeHost || (settings.allowLan ? '0.0.0.0' : '127.0.0.1'),
      allowLan: settings.allowLan,
      startTime: this.startTime,
      uptime,
      error: this.lastError,
      timeoutSeconds: settings.timeoutSeconds,
      autoStart: settings.autoStart,
      authEnabled: settings.authEnabled,
      authMode: settings.authMode,
      masterApiKey: settings.masterApiKey,
      userAgentOverride: settings.userAgentOverride,
      customUserAgent: settings.customUserAgent
    };
  }

  private createProxyApp(settings: ProxyServiceSettings): Express {
    const app = express();

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // User-Agent & Headers customization middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (settings.userAgentOverride && settings.customUserAgent) {
        res.setHeader('X-Proxy-User-Agent', settings.customUserAgent);
      }
      res.setHeader('X-Powered-By', 'Ant2api-Proxy');
      next();
    });

    app.use(requestLogger);

    // Health check endpoint (always accessible)
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'ant2api-reverse-proxy',
        version: '1.0.0',
        proxyPort: this.activePort,
        uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
        timestamp: Date.now()
      });
    });

    app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Ant2api Reverse Proxy Service',
        status: 'running',
        endpoints: {
          openai: '/v1/chat/completions',
          codex: '/v1/completions',
          responses: '/v1/responses',
          gemini: '/v1beta/models',
          health: '/health'
        },
        dashboardNotice: 'Web management dashboard runs on the separate admin port.'
      });
    });

    // API Routes for clients
    app.use('/v1', openAiRouter);
    app.use('/v1', codexRouter);
    app.use('/v1/engines', codexRouter);
    app.use('/v1beta', geminiRouter);

    app.use(errorHandler);

    return app;
  }
}
