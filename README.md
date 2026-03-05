# Kanban Board

A full-stack kanban board for collaborative task management. Built with React, Express, and SQLite.

## Features

- **Authentication** - Email/password registration and login with JWT tokens (HTTP-only cookies)
- **Kanban Board** - Four columns: To Do, In Progress, Review, Done
- **Drag and Drop** - Reorder tasks within and across columns using @dnd-kit
- **Task Management** - Create, edit, delete, and assign tasks to users
- **Dark Theme** - Modern dark UI with Tailwind CSS
- **Toast Notifications** - Success/error feedback with auto-dismiss

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 18, TypeScript, Vite          |
| Styling    | Tailwind CSS                        |
| Drag & Drop| @dnd-kit/core                       |
| Backend    | Express.js, TypeScript              |
| Database   | SQLite (better-sqlite3)             |
| Auth       | JWT + bcrypt                        |
| Testing    | Vitest, React Testing Library, Supertest |
| Linting    | ESLint 9, Prettier                  |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts both the Vite dev server (http://localhost:5173) and the Express API server (port 3001) concurrently. The Vite dev server proxies `/api` requests to the backend.

### Environment Variables

| Variable     | Default        | Description              |
| ------------ | -------------- | ------------------------ |
| `PORT`       | `3001`         | Express server port      |
| `JWT_SECRET` | `"dev-secret"` | JWT signing key          |
| `NODE_ENV`   | -              | Set to `production` for secure cookies |

> **Note:** Set a strong `JWT_SECRET` in production.

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start frontend + backend in dev mode     |
| `npm run build`      | Build frontend for production            |
| `npm run server`     | Start backend only                       |
| `npm test`           | Run tests with Vitest                    |
| `npm run lint`       | Lint with ESLint                         |
| `npm run lint:fix`   | Auto-fix lint issues                     |
| `npm run format`     | Format code with Prettier                |
| `npm run format:check` | Check formatting                       |

## Project Structure

```
src/                        # Frontend (React)
  components/
    Board.tsx               # Main kanban board
    Column.tsx              # Board column
    TaskCard.tsx            # Draggable task card
    CreateTaskForm.tsx      # Inline task creation
    EditTaskModal.tsx       # Task editing modal
    LoginForm.tsx           # Login form
    RegisterForm.tsx        # Registration form
    BoardHeader.tsx         # Header with user info
    Toast.tsx               # Toast notifications
    ui/                     # Reusable UI primitives
      Button.tsx
      FormField.tsx
      Modal.tsx
  hooks/
    useAuth.tsx             # Auth context & provider
    useTasks.ts             # Task state & CRUD
    useBoardDragDrop.ts     # Drag-drop logic
    useToast.ts             # Toast notification state
  api/
    client.ts               # API client (fetch wrapper)
  types.ts                  # Shared TypeScript types
  constants.ts              # Column definitions

server/                     # Backend (Express)
  routes/
    auth.ts                 # Register, login, logout, me
    tasks.ts                # Task CRUD + move/reorder
    users.ts                # List users
  middleware/
    auth.ts                 # JWT verification
    error.ts                # Error handling
  db/
    index.ts                # SQLite setup & schema
  app.ts                    # Express app setup
  config.ts                 # JWT configuration
  index.ts                  # Server entry point
```

## API Endpoints

### Auth

| Method | Endpoint             | Description         |
| ------ | -------------------- | ------------------- |
| POST   | `/api/auth/register` | Create account      |
| POST   | `/api/auth/login`    | Sign in             |
| GET    | `/api/auth/me`       | Get current user    |
| POST   | `/api/auth/logout`   | Sign out            |

### Tasks (requires auth)

| Method | Endpoint               | Description          |
| ------ | ---------------------- | -------------------- |
| GET    | `/api/tasks`           | List all tasks       |
| POST   | `/api/tasks`           | Create a task        |
| PUT    | `/api/tasks/:id`       | Update a task        |
| DELETE | `/api/tasks/:id`       | Delete a task        |
| PATCH  | `/api/tasks/:id/move`  | Move/reorder a task  |

### Users (requires auth)

| Method | Endpoint     | Description    |
| ------ | ------------ | -------------- |
| GET    | `/api/users` | List all users |

## Database

SQLite database is created automatically at `data/kanban.db` on first run. Schema includes:

- **users** - id, email, name, password_hash, created_at
- **tasks** - id, title, description, column, position, assignee_id, created_by, created_at, updated_at

Tasks use fractional positioning for efficient drag-and-drop reordering without updating all rows.
