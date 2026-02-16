import { getDb } from '../db/index';
import { createApp } from '../app';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import request from 'supertest';

export function createTestApp(): { app: Express; db: Database.Database } {
  const db = getDb(':memory:');
  const app = createApp(db);
  return { app, db };
}

/**
 * Registers a user and returns the auth cookie string for use in subsequent requests.
 */
export async function registerAndGetCookie(
  app: Express,
  user: { email: string; name: string; password: string } = {
    email: 'test@example.com',
    name: 'Test User',
    password: 'password123',
  }
): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send(user)
    .expect(201);

  const setCookieHeader = res.headers['set-cookie'];
  if (!setCookieHeader) {
    throw new Error('No set-cookie header returned from register');
  }

  // set-cookie can be a string or array of strings
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];

  const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
  if (!tokenCookie) {
    throw new Error('No token cookie returned from register');
  }

  return tokenCookie.split(';')[0]; // e.g. "token=eyJ..."
}
