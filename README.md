# Caize Todo Application — Multi-List Personal Task Manager (Phase 2)

A production-grade, minimalist task management application built with a **modular monolith architecture** emphasizing separation of concerns, end-to-end type safety, maintainability, clean domain design, and real-world database persistence with Supabase PostgreSQL.

---

## 1. Project Overview & Evolution

Evolved from a single-list prototype into a **multiple-list personal Todo manager**. Users can create, rename, and delete custom task lists (e.g., *College*, *Personal*, *Projects*, *Habits*), organize tasks with three-state status tracking (`TODO`, `IN_PROGRESS`, `DONE`), and delete lists safely with protected cascade deletion policies.

### Core Architectural Pillars
- **Strict Layer Separation**: Presentation, API Transport, Domain Services, Data Access (Repositories), Validations, and Database Schema remain strictly decoupled.
- **Relational Integrity**: Foreign key enforcement (`todos.list_id` → `todo_lists.id`) with PostgreSQL cascade deletes and compound index `(list_id, created_at)`.
- **Domain-Driven Error Handling**: Domain services throw lightweight, framework-agnostic errors (`NotFoundError`, `ValidationError`) mapped centrally to standard `TRPCError` codes at the network boundary.
- **Automated Test Suite**: 79 automated tests across Vitest covering validations, services, repositories, tRPC caller pipelines, and interactive UI components.
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
[Presentation Layer] (ListSidebar, TodoDashboard, TodoForm, TodoItem, TodoList)
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
   - **`ListSidebar`**: Sidebar navigation displaying all lists, task count badges, inline list creation, inline renaming, and safe deletion confirmation dialogs.
   - **`TodoDashboard`**: Responsive two-column dashboard coordinating list selection and task view.
   - **`TodoForm`**: Task creation with title, optional description, and initial status selector (`TODO`, `IN_PROGRESS`, `DONE`).
   - **`TodoItem`**: Individual task card with interactive status dropdown (color badges, strikethrough for completed tasks), creation timestamp, inline delete confirmation, and retry feedback.
   - **`TodoList`**: Task listing for the selected list with loading skeleton, error fallback, and empty states.

2. **API Layer (`src/server/api/`)**
   - **`list.router.ts`**: Procedures `todoList.list`, `todoList.create`, `todoList.rename`, `todoList.delete`.
   - **`todo.router.ts`**: Procedures `todo.list`, `todo.create`, `todo.updateStatus`, `todo.delete`.
   - **`trpc.ts`**: Centralized error middleware translating application errors (`NotFoundError` → `NOT_FOUND`, `ValidationError` → `BAD_REQUEST`, `DatabaseConfigurationError` → `INTERNAL_SERVER_ERROR`).

3. **Business Logic Layer (`src/server/services/`)**
   - **`todo-list.service.ts`**: Enforces business rules for lists: trimmed non-empty names, safe deletion policy (rejects list deletion if tasks > 0 unless `force: true`).
   - **`todo.service.ts`**: Enforces task creation rules: non-empty trimmed titles, list existence verification, default `TODO` status, single atomic deletion.

4. **Data Access Layer (`src/server/repositories/`)**
   - **`todo-list.repository.ts`**: Single efficient `LEFT JOIN ... COUNT(todos.id) GROUP BY todo_lists.id` for list counts, atomic name update, atomic delete with `RETURNING id`.
   - **`todo.repository.ts`**: Scoped queries `findAllByListId` ordered by `createdAt desc`, atomic `updateStatus`, single atomic `delete` with `RETURNING id`.

5. **Database Layer (`src/db/`)**
   - **`schema/lists.ts`**: `todo_lists` table (`id` UUID, `name` text, `created_at`, `updated_at`).
   - **`schema/todos.ts`**: `todos` table (`id` UUID, `list_id` UUID foreign key with `onDelete: cascade`, `title`, `description`, `status` enum `['TODO', 'IN_PROGRESS', 'DONE']`, `created_at`, `updated_at`), with compound index `(list_id, created_at)`.
   - **`migrations/`**: Drizzle SQL migrations (`0000_futuristic_fixer.sql`, `0001_lucky_alice.sql`).

---

## 4. Database Schema

```sql
-- Status Enum
CREATE TYPE "public"."todo_status" AS ENUM('TODO', 'IN_PROGRESS', 'DONE');

-- Lists Table
CREATE TABLE "todo_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Todos Table
CREATE TABLE "todos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL REFERENCES "todo_lists"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" "todo_status" DEFAULT 'TODO' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "todos_list_id_created_at_idx" ON "todos" ("list_id", "created_at");
```

---

## 5. Development & Testing Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles optimized production build with Turbopack |
| `npm test` | Runs the complete 79-test Vitest test suite |
| `npx tsx --env-file=.env.local scripts/verify-phase2-live.ts` | Runs the automated live Supabase integration suite |
| `npm run db:generate` | Generates new SQL migration files from Drizzle schemas |
| `npm run db:migrate` | Applies pending migrations to PostgreSQL |
| `npm run db:studio` | Opens interactive Drizzle Studio database viewer |

---

## 6. Safe Deletion Policy

When a user requests to delete a list:
1. **Empty list (`taskCount === 0`)**: Deletes immediately.
2. **List containing tasks (`taskCount > 0`) without confirmation (`force === false`)**: Rejected at the domain service layer with a `ValidationError`.
3. **List containing tasks with confirmation (`force === true`)**: The UI displays a warning modal stating the exact task count and consequences. Upon explicit confirmation, the list and all cascaded tasks are permanently removed in a single atomic database operation.
