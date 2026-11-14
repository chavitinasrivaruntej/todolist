# Caize Todo Application — Dual-View Personal Task Manager & Kanban Board (Phase 3)

A production-grade, minimalist task management application built with a **modular monolith architecture** emphasizing separation of concerns, end-to-end type safety, maintainability, clean domain design, dual-view visualization (List & Kanban Board), and real-world database persistence with Supabase PostgreSQL.

---

## 1. Project Overview & Evolution

Evolved from a multi-list task manager (Phase 2) into a **dual-view productivity workspace (Phase 3)**. Users can seamlessly switch between a traditional **List View** and a 3-column **Kanban Board View** within each personal Todo list, with independent view preferences preserved across lists.

### Core Architectural Pillars
- **Strict Layer Separation**: Presentation, API Transport, Domain Services, Data Access (Repositories), Validations, and Database Schema remain strictly decoupled.
- **Unified Domain Data**: Both List and Kanban Board views operate on the exact same underlying Todo records and database status enum (`'TODO' | 'IN_PROGRESS' | 'DONE'`).
- **Relational Integrity**: Foreign key enforcement (`todos.list_id` → `todo_lists.id`) with PostgreSQL cascade deletes and compound index `(list_id, created_at)`.
- **Per-List View Preference Persistence**: Uses a resilient client hook backed by `localStorage` to remember whether each list was last viewed in List or Board mode without SSR hydration mismatches.
- **Accessible Kanban Navigation**: Dedicated status transition action buttons (`→ In Progress`, `✓ Done`, `↩ Reopen`) and an accessible mobile tab switcher for responsive column navigation.
- **Automated Test Suite**: 95 automated tests across Vitest covering validations, hooks, services, repositories, tRPC caller pipelines, and interactive UI components.
- **Live Supabase PostgreSQL Verification**: Verified live with transaction pooler runtime and session pooler migrations.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Turbopack) | React full-stack framework with React Server Components & Edge/Node routing |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict mode enabled, zero `any` usage, end-to-end type inference |
| **API Transport** | [tRPC v11](https://trpc.io/) | Type-safe RPC with automatic client inference and zero code-generation |
| **Database ORM** | [Drizzle ORM](https://orm.drizzle.team/) | Lightweight, type-safe SQL query builder and schema management |
| **Database** | [PostgreSQL (Supabase)](https://supabase.com/) | Real relational database with transaction connection pooling |
| **Validation** | [Zod](https://zod.dev/) | Single source of truth for client and server input schemas |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Accessible, responsive, minimalist design with neutral palette |
| **Testing** | [Vitest](https://vitest.dev/) + React Testing Library | Unit, service, repository, tRPC caller, and component testing |

---

## 3. Architecture & Layer Responsibilities

```
[Presentation Layer] (ListSidebar, TodoDashboard, ViewSwitcher, TodoList, KanbanBoard)
         │
         ▼
[API Layer] (tRPC Routers: todoList, todo)
         │
         ▼
[Domain Services] (TodoListService, TodoService)
         │
         ▼
[Data Access Repositories] (TodoListRepository, TodoRepository)
         │
         ▼
[Database Layer] (Drizzle ORM + Supabase PostgreSQL)
```

### Layer Breakdown

1. **Presentation Layer (`src/components/`)**
   - **`ViewSwitcher`**: Segmented button control toggling between List and Board view modes.
   - **`KanbanBoard`**: 3-column Kanban workspace (`To Do`, `In Progress`, `Done`) with desktop side-by-side grid and mobile tab bar.
   - **`KanbanColumn`**: Status column container displaying task counts and empty states.
   - **`KanbanCard`**: Task card with direct status transition actions (`→ In Progress`, `✓ Done`, `↩ Reopen`), inline delete confirmation, and mutation error retry buttons.
   - **`TodoList` & `TodoItem`**: Preserved traditional list view with status badges and deletion feedback.
   - **`TodoForm`**: Always accessible in both views to add tasks with initial status selection.
   - **`ListSidebar`**: Sidebar navigation displaying all personal lists with task count badges and safe deletion warnings.

2. **API Layer (`src/server/api/`)**
   - **`list.router.ts`**: Procedures `todoList.list`, `todoList.create`, `todoList.rename`, `todoList.delete`.
   - **`todo.router.ts`**: Procedures `todo.list`, `todo.create`, `todo.updateStatus`, `todo.delete`.
   - **`trpc.ts`**: Centralized error middleware translating application errors (`NotFoundError` → `NOT_FOUND`, `ValidationError` → `BAD_REQUEST`, `DatabaseConfigurationError` → `INTERNAL_SERVER_ERROR`).

3. **Business Logic Layer (`src/server/services/`)**
   - **`todo-list.service.ts`**: Enforces list rules, name trimming, and safe deletion policies.
   - **`todo.service.ts`**: Enforces task creation rules, status updates, and single atomic deletions.

4. **Data Access Layer (`src/server/repositories/`)**
   - **`todo-list.repository.ts`**: Single efficient `LEFT JOIN ... COUNT(todos.id) GROUP BY todo_lists.id` for list counts, atomic name update, atomic delete with `RETURNING id`.
   - **`todo.repository.ts`**: Scoped queries `findAllByListId` ordered by `createdAt desc`, atomic `updateStatus`, single atomic `delete` with `RETURNING id`.

5. **Database Layer (`src/db/`)**
   - **`schema/lists.ts`**: `todo_lists` table (`id` UUID, `name` text, `created_at`, `updated_at`).
   - **`schema/todos.ts`**: `todos` table (`id` UUID, `list_id` UUID foreign key with `onDelete: cascade`, `title`, `description`, `status` enum `['TODO', 'IN_PROGRESS', 'DONE']`, `created_at`, `updated_at`), with compound index `(list_id, created_at)`.
   - **`migrations/`**: Drizzle SQL migrations (`0000_futuristic_fixer.sql`, `0001_lucky_alice.sql`, `0002_fix_default_list_uuid.sql`).

---

## 4. Development & Testing Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles optimized production build with Turbopack |
| `npm test` | Runs the complete 95-test Vitest test suite |
| `npx tsx --env-file=.env.local scripts/verify-phase3-live.ts` | Runs the automated live Supabase Phase 3 dual-view suite |
| `npm run db:generate` | Generates new SQL migration files from Drizzle schemas |
| `npm run db:migrate` | Applies pending migrations to PostgreSQL |
| `npm run db:studio` | Opens interactive Drizzle Studio database viewer |

---

## 5. Dual-View Features & UX Design

### A. Independent View Preference Persistence
- Each list remembers its own view preference via `useListViewPreference` backed by browser `localStorage`.
- When switching between lists (e.g. *College* in Board view and *Personal* in List view), each list automatically restores its saved view.
- Safe SSR handling ensures zero hydration mismatch warnings on initial page load.

### B. Accessible Status Transition Controls
- Card controls provide instant status transitions without requiring fragile drag-and-drop gestures:
  - From **To Do**: `→ In Progress`, `✓ Done`
  - From **In Progress**: `← To Do`, `✓ Done`
  - From **Done**: `↩ Reopen`, `← In Progress`
- Status mutation failures keep the task in its current column, display an inline error alert, and provide a one-click `Retry` button.

### C. Responsive Mobile Design
- **Desktop ($\ge 768\text{px}$)**: 3-column side-by-side grid.
- **Mobile ($< 768\text{px}$)**: Accessible tab bar (`[To Do (N)] [In Progress (N)] [Done (N)]`) allows comfortable single-column focus without cramped horizontal overflow.
