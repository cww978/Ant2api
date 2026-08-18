import { Request, Response, NextFunction } from 'express';
import { KeyManagerService } from '../services/key-manager.js';
import { config } from '../config.js';
import { ApiKeyItem } from '../services/storage.js';

export interface AuthenticatedRequest extends Request {
  apiKeyItem?: ApiKeyItem;
  isAdmin?: boolean;
}

const keyManager = KeyManagerService.getInstance();

export function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Support Authorization: Bearer sk-... or x-api-key: sk-...
  const authHeader = req.headers['authorization'] || req.headers['x-api-key'] as string;
  let token = '';

  if (typeof authHeader === 'string') {
    token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  }

  // If token is the admin password, allow with super-admin bypass
  if (token && (token === config.adminPassword || token === config.jwtSecret)) {
    req.isAdmin = true;
    return next();
  }

  // If no token provided, fallback to default active root key for convenience (e.g. tools with requires_openai_auth = false)
  if (!token) {
    const keys = keyManager.getAllKeys().filter(k => k.enabled);
    if (keys.length > 0) {
      req.apiKeyItem = keys[0];
      return next();
    }
  }

  const requestedModel = req.body?.model || (req.params as any)?.model;
  const validation = keyManager.validateKey(token, requestedModel);

  if (!validation.valid) {
    return res.status(401).json({
      error: {
        message: validation.error || 'Unauthorized: Invalid API key',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key'
      }
    });
  }

  req.apiKeyItem = validation.keyItem;
  next();
}

export function adminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-key'] as string;
  let token = '';

  if (typeof authHeader === 'string') {
    token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  }

  // Also check admin cookie or query param if needed
  if (!token && req.query.admin_key) {
    token = String(req.query.admin_key);
  }

  if (token === config.adminPassword || token === config.jwtSecret) {
    req.isAdmin = true;
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Admin authorization failed. Please check your admin password.'
  });
}
