import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Return standard OpenAI formatted error if requesting OpenAI endpoints
  if (req.originalUrl.startsWith('/v1/chat') || req.originalUrl.startsWith('/v1/models')) {
    return res.status(statusCode).json({
      error: {
        message,
        type: 'api_error',
        param: null,
        code: statusCode === 429 ? 'rate_limit_exceeded' : 'internal_error'
      }
    });
  }

  // General JSON error
  return res.status(statusCode).json({
    error: {
      code: statusCode,
      message
    }
  });
}
