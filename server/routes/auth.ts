import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth';
import { COOKIE_OPTIONS, signToken } from '../config';

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
    const token = signToken(user.id);

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
    const token = signToken(user.id);

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
    const { maxAge: _, ...clearOptions } = COOKIE_OPTIONS;
    res.clearCookie('token', clearOptions);
    res.status(200).json({ message: 'Logged out' });
  });

  return router;
}
