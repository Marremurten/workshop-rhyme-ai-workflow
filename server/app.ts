import express from 'express';
import cookieParser from 'cookie-parser';
import type Database from 'better-sqlite3';
import { errorHandler } from './middleware/error';

export function createApp(db: Database.Database): express.Express {
  const app = express();

  app.use(cookieParser());
  app.use(express.json());

  // Make db available on the app for routes to use
  app.set('db', db);

  // Eagerly register error handler for JSON parse errors etc.
  // Express only invokes 4-param handlers when next(err) is called,
  // so this won't interfere with normal request flow.
  app.use(errorHandler);

  // Lazily append the 404 catch-all on first request,
  // so that routes added after createApp() are registered before it.
  let finalized = false;
  app.use((req, res, next) => {
    if (!finalized) {
      finalized = true;

      // 404 catch-all (appended after all routes)
      app.use((_req: express.Request, res: express.Response) => {
        res.status(404).json({ error: 'Not found' });
      });

      // Also add error handler at the very end for errors from routes
      app.use(errorHandler);
    }
    next();
  });

  return app;
}
