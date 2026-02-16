import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' });
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
}
