# Kanban Board

React + Express + SQLite kanban board med drag-and-drop.

## Starta projektet

```bash
npm run dev        # Startar bade frontend (Vite) och backend (Express)
npm run seed       # Seedar databasen med testdata
npm test           # Kor tester med Vitest
```

## Teknisk stack

- **Frontend:** React 18, Tailwind CSS, dnd-kit (drag-and-drop)
- **Backend:** Express, better-sqlite3
- **Auth:** JWT via cookies (bcrypt for passwords)
- **Tester:** Vitest, Testing Library, Supertest

## Projektstruktur

```
src/               # React frontend
  api/client.ts    # API-wrapper (fetch-anrop mot backend)
  auth/            # Login/register
  board/           # Board, Column, TaskCard, CreateTaskForm, EditTaskModal
  ui/              # Delade UI-komponenter (Modal, Button, FormField)
shared/types.ts    # Delade TypeScript-typer (frontend + backend)
server/            # Express backend
  routes/tasks.ts  # Task API endpoints (CRUD + move)
  db/index.ts      # SQLite setup och schema
  seed.ts          # Seedar testdata
```

## Inloggning

- alice@example.com / password123
- bob@example.com / password123
- charlie@example.com / password123
