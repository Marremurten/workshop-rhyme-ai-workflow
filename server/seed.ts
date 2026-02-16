import { getDb } from './db/index';
import bcrypt from 'bcrypt';

const db = getDb();

// Create users
const hash = bcrypt.hashSync('password123', 10);

db.prepare('INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)').run('alice@example.com', 'Alice', hash);
db.prepare('INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)').run('bob@example.com', 'Bob', hash);

const alice = db.prepare('SELECT id FROM users WHERE email = ?').get('alice@example.com') as { id: number };
const bob = db.prepare('SELECT id FROM users WHERE email = ?').get('bob@example.com') as { id: number };

// Clear existing tasks
db.prepare('DELETE FROM tasks').run();

const tasks = [
  {
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment to staging.',
    column: 'todo',
    assignee_id: alice.id,
    created_by: alice.id,
  },
  {
    title: 'Design user profile page',
    description: 'Create mockups for the user profile page including avatar upload and settings.',
    column: 'todo',
    assignee_id: bob.id,
    created_by: alice.id,
  },
  {
    title: 'Implement search API endpoint',
    description: 'Add full-text search for tasks with filtering by assignee and column.',
    column: 'in_progress',
    assignee_id: alice.id,
    created_by: alice.id,
  },
  {
    title: 'Fix drag-and-drop on mobile',
    description: 'Touch events are not registering correctly on iOS Safari. Investigate pointer events.',
    column: 'review',
    assignee_id: bob.id,
    created_by: bob.id,
  },
  {
    title: 'Add email notifications',
    description: 'Send email when a task is assigned to a user or moved to review.',
    column: 'review',
    assignee_id: alice.id,
    created_by: bob.id,
  },
  {
    title: 'Upgrade to React 19',
    description: 'Migrate to React 19 and update deprecated lifecycle methods.',
    column: 'done',
    assignee_id: bob.id,
    created_by: alice.id,
  },
];

const insert = db.prepare(
  'INSERT INTO tasks (title, description, "column", position, assignee_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
);

tasks.forEach((task, i) => {
  insert.run(task.title, task.description, task.column, (i + 1) * 1000, task.assignee_id, task.created_by);
});

console.log('Seeded 2 users and 6 tasks.');
console.log('Login: alice@example.com / password123');
console.log('Login: bob@example.com / password123');

db.close();
