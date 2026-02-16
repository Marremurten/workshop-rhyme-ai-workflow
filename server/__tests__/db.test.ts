import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from '../db/index';
import type Database from 'better-sqlite3';

describe('database module', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('getDb()', () => {
    it('returns a database connection', () => {
      db = getDb(':memory:');
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
      expect(typeof db.exec).toBe('function');
    });
  });

  describe('users table', () => {
    it('exists with correct columns', () => {
      db = getDb(':memory:');
      const columns = db
        .prepare("PRAGMA table_info('users')")
        .all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>;

      const columnMap = Object.fromEntries(
        columns.map((col) => [col.name, col])
      );

      expect(columns).toHaveLength(5);

      // id: integer primary key
      expect(columnMap.id).toBeDefined();
      expect(columnMap.id.type).toBe('INTEGER');
      expect(columnMap.id.pk).toBe(1);

      // email: text unique not null
      expect(columnMap.email).toBeDefined();
      expect(columnMap.email.type).toBe('TEXT');
      expect(columnMap.email.notnull).toBe(1);

      // name: text not null
      expect(columnMap.name).toBeDefined();
      expect(columnMap.name.type).toBe('TEXT');
      expect(columnMap.name.notnull).toBe(1);

      // password_hash: text not null
      expect(columnMap.password_hash).toBeDefined();
      expect(columnMap.password_hash.type).toBe('TEXT');
      expect(columnMap.password_hash.notnull).toBe(1);

      // created_at: text not null
      expect(columnMap.created_at).toBeDefined();
      expect(columnMap.created_at.type).toBe('TEXT');
      expect(columnMap.created_at.notnull).toBe(1);
    });

    it('has a unique constraint on email', () => {
      db = getDb(':memory:');
      db.prepare(
        "INSERT INTO users (email, name, password_hash) VALUES ('a@b.com', 'Alice', 'hash1')"
      ).run();

      expect(() => {
        db.prepare(
          "INSERT INTO users (email, name, password_hash) VALUES ('a@b.com', 'Bob', 'hash2')"
        ).run();
      }).toThrow();
    });
  });

  describe('tasks table', () => {
    it('exists with correct columns', () => {
      db = getDb(':memory:');
      const columns = db
        .prepare("PRAGMA table_info('tasks')")
        .all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>;

      const columnMap = Object.fromEntries(
        columns.map((col) => [col.name, col])
      );

      expect(columns).toHaveLength(9);

      // id: integer primary key
      expect(columnMap.id).toBeDefined();
      expect(columnMap.id.type).toBe('INTEGER');
      expect(columnMap.id.pk).toBe(1);

      // title: text not null
      expect(columnMap.title).toBeDefined();
      expect(columnMap.title.type).toBe('TEXT');
      expect(columnMap.title.notnull).toBe(1);

      // description: text, nullable
      expect(columnMap.description).toBeDefined();
      expect(columnMap.description.type).toBe('TEXT');
      expect(columnMap.description.notnull).toBe(0);

      // column: text not null
      expect(columnMap.column).toBeDefined();
      expect(columnMap.column.type).toBe('TEXT');
      expect(columnMap.column.notnull).toBe(1);

      // position: real not null
      expect(columnMap.position).toBeDefined();
      expect(columnMap.position.type).toBe('REAL');
      expect(columnMap.position.notnull).toBe(1);

      // assignee_id: integer, nullable, FK to users
      expect(columnMap.assignee_id).toBeDefined();
      expect(columnMap.assignee_id.type).toBe('INTEGER');
      expect(columnMap.assignee_id.notnull).toBe(0);

      // created_by: integer not null, FK to users
      expect(columnMap.created_by).toBeDefined();
      expect(columnMap.created_by.type).toBe('INTEGER');
      expect(columnMap.created_by.notnull).toBe(1);

      // created_at: text not null
      expect(columnMap.created_at).toBeDefined();
      expect(columnMap.created_at.type).toBe('TEXT');
      expect(columnMap.created_at.notnull).toBe(1);

      // updated_at: text not null
      expect(columnMap.updated_at).toBeDefined();
      expect(columnMap.updated_at.type).toBe('TEXT');
      expect(columnMap.updated_at.notnull).toBe(1);
    });

    it('has foreign key from assignee_id to users(id)', () => {
      db = getDb(':memory:');
      const fks = db
        .prepare("PRAGMA foreign_key_list('tasks')")
        .all() as Array<{ from: string; to: string; table: string }>;

      const assigneeFk = fks.find((fk) => fk.from === 'assignee_id');
      expect(assigneeFk).toBeDefined();
      expect(assigneeFk!.table).toBe('users');
      expect(assigneeFk!.to).toBe('id');
    });

    it('has foreign key from created_by to users(id)', () => {
      db = getDb(':memory:');
      const fks = db
        .prepare("PRAGMA foreign_key_list('tasks')")
        .all() as Array<{ from: string; to: string; table: string }>;

      const createdByFk = fks.find((fk) => fk.from === 'created_by');
      expect(createdByFk).toBeDefined();
      expect(createdByFk!.table).toBe('users');
      expect(createdByFk!.to).toBe('id');
    });

    it('rejects task with nonexistent created_by (foreign key constraint)', () => {
      db = getDb(':memory:');

      expect(() => {
        db.prepare(
          "INSERT INTO tasks (title, column, position, created_by) VALUES ('Test', 'todo', 1.0, 999)"
        ).run();
      }).toThrow();
    });

    it('rejects invalid column values (check constraint)', () => {
      db = getDb(':memory:');

      // Insert a user first so foreign key is satisfied
      db.prepare(
        "INSERT INTO users (email, name, password_hash) VALUES ('a@b.com', 'Alice', 'hash1')"
      ).run();
      const user = db.prepare('SELECT id FROM users').get() as { id: number };

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (title, column, position, created_by) VALUES (?, ?, ?, ?)'
        ).run('Test', 'invalid_column', 1.0, user.id);
      }).toThrow();
    });

    it('accepts valid column values: todo, in_progress, done', () => {
      db = getDb(':memory:');

      db.prepare(
        "INSERT INTO users (email, name, password_hash) VALUES ('a@b.com', 'Alice', 'hash1')"
      ).run();
      const user = db.prepare('SELECT id FROM users').get() as { id: number };

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (title, column, position, created_by) VALUES (?, ?, ?, ?)'
        ).run('Task 1', 'todo', 1.0, user.id);
      }).not.toThrow();

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (title, column, position, created_by) VALUES (?, ?, ?, ?)'
        ).run('Task 2', 'in_progress', 2.0, user.id);
      }).not.toThrow();

      expect(() => {
        db.prepare(
          'INSERT INTO tasks (title, column, position, created_by) VALUES (?, ?, ?, ?)'
        ).run('Task 3', 'done', 3.0, user.id);
      }).not.toThrow();
    });
  });

  describe('indexes', () => {
    it('has idx_tasks_column_position index', () => {
      db = getDb(':memory:');
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks'"
        )
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_tasks_column_position');
    });
  });
});
