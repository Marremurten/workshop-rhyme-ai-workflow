import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    if (!decoded.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
