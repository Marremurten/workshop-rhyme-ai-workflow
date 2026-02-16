import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function createAuthRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', (req: Request, res: Response) => {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: 'Email, name, and password are required' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email, name, password_hash);

    const user = { id: result.lastInsertRowid as number, email, name };
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user });
  });

  // POST /api/auth/login
  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = req.body;

    const row = db
      .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
      .get(email) as { id: number; email: string; name: string; password_hash: string } | undefined;

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = { id: row.id, email: row.email, name: row.name };
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(200).json({ user });
  });

  // GET /api/auth/me
  router.get('/me', requireAuth, (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const row = db
      .prepare('SELECT id, email, name FROM users WHERE id = ?')
      .get(userId) as { id: number; email: string; name: string } | undefined;

    if (!row) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(200).json({ user: row });
  });

  // POST /api/auth/logout
  router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    res.status(200).json({ message: 'Logged out' });
  });

  return router;
}
