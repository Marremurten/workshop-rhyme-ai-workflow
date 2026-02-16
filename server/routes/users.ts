import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth';

export function createUsersRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/users
  router.get('/', requireAuth, (_req: Request, res: Response) => {
    const users = db.prepare('SELECT id, email, name FROM users').all();
    res.status(200).json({ users });
  });

  return router;
}
