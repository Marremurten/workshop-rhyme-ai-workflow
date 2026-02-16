import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestApp } from './helpers';
import { requireAuth } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

describe('Express app', () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('unknown routes', () => {
    it('returns 404 JSON for unknown GET route', async () => {
      ({ app, db } = createTestApp());

      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('returns 404 JSON for unknown POST route', async () => {
      ({ app, db } = createTestApp());

      const res = await request(app).post('/api/nonexistent').send({ foo: 'bar' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });

  describe('malformed JSON body', () => {
    it('returns 400 for malformed JSON', async () => {
      ({ app, db } = createTestApp());

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});

describe('auth middleware (requireAuth)', () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  /**
   * We mount a small test route that uses requireAuth, then returns req.userId.
   * This lets us test the middleware in isolation without depending on real routes.
   */
  function createAppWithTestRoute() {
    const { app: testApp, db: testDb } = createTestApp();

    testApp.get(
      '/test/protected',
      requireAuth,
      (req: any, res: any) => {
        res.json({ userId: req.userId });
      }
    );

    return { app: testApp, db: testDb };
  }

  it('proceeds and sets req.userId when a valid JWT cookie is present', async () => {
    ({ app, db } = createAppWithTestRoute());

    const token = jwt.sign({ userId: 42 }, JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .get('/test/protected')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 42 });
  });

  it('returns 401 when no cookie is present', async () => {
    ({ app, db } = createAppWithTestRoute());

    const res = await request(app).get('/test/protected');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when JWT is expired', async () => {
    ({ app, db } = createAppWithTestRoute());

    const token = jwt.sign({ userId: 42 }, JWT_SECRET, { expiresIn: '-1s' });

    const res = await request(app)
      .get('/test/protected')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when JWT is signed with wrong secret', async () => {
    ({ app, db } = createAppWithTestRoute());

    const token = jwt.sign({ userId: 42 }, 'wrong-secret', { expiresIn: '1h' });

    const res = await request(app)
      .get('/test/protected')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when token is malformed', async () => {
    ({ app, db } = createAppWithTestRoute());

    const res = await request(app)
      .get('/test/protected')
      .set('Cookie', 'token=not-a-valid-jwt-at-all');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
