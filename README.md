# Caize Todo Application — Authenticated Multi-Tenant Task Manager & Dual-View Kanban Board (Phase 4)

A production-grade, minimalist task management application built with a **modular monolith architecture** emphasizing separation of concerns, end-to-end type safety, multi-tenant user authentication, data isolation, dual-view visualization (List & Kanban Board), accessible drag-and-drop task movement, and real-world database persistence with Supabase PostgreSQL.

---

## 1. Project Overview & Evolution

Evolved through progressive phases:
- **Phase 1**: Core architecture, single-list foundation, Zod validation, and decoupled layers.
- **Phase 2**: Multi-list personal management, foreign-key cascade integrity, task status enum (`TODO`, `IN_PROGRESS`, `DONE`), and safe deletion policies.
- **Phase 2.1**: Database migration to an RFC 4122 v4 compliant UUID (`00000000-0000-4000-8000-000000000001`) for the default personal list.
- **Phase 3**: Dual-view experience (List View & Kanban Board View) with per-list view preference persistence via `localStorage`.
- **Phase 3.1**: Accessible Drag-and-Drop enhancement using `@dnd-kit`, allowing smooth card movement across status columns with pointer, touch, and keyboard sensors.
- **Phase 4**: User Authentication, Identity & Multi-Tenant Data Ownership using Supabase Auth (`@supabase/ssr`), Next.js Session Middleware, Zero-Trust server-side authorization in tRPC `protectedProcedure`, and PostgreSQL Row-Level Security (RLS).

### Core Architectural Pillars
- **Strict Layer Separation**: Presentation, API Transport, Domain Services, Data Access (Repositories), Validations, and Database Schema remain strictly decoupled.
- **Multi-Tenant Data Ownership**: Strict relational hierarchy: `User (auth.users) → Todo Lists (todo_lists.user_id) → Todos (todos.list_id)`.
- **Zero-Trust Client Boundary**: The frontend never supplies a `userId`. All mutations and queries resolve identity strictly from verified server-side session context (`ctx.user.id`).
- **Information Disclosure Defense**: Unauthorized access attempts to other users' lists or tasks always resolve to `NotFoundError` rather than `ForbiddenError`, eliminating UUID existence oracle vectors.
- **Defense-in-Depth RLS**: Database Row-Level Security policies active on `todo_lists` and `todos` preventing unauthorized access via public anon client keys.
- **Unified Domain Data**: Both List and Kanban Board views operate on the exact same underlying Todo records and database status enum (`'TODO' | 'IN_PROGRESS' | 'DONE'`).
- **Drag-and-Drop with Accessible Fallbacks**: Tasks can be moved by dragging or via explicit accessible transition buttons (`→ In Progress`, `✓ Done`, `↩ Reopen`).
- **112 Automated Vitest Tests**: 100% passing tests covering auth validation, cross-tenant isolation, tRPC procedures, services, repositories, hooks, and React UI components.
- **Live Supabase PostgreSQL Verification**: Verified live with transaction pooler runtime and session pooler migrations.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Turbopack) | React full-stack framework with React Server Components & middleware routing |
| **Authentication** | [Supabase Auth](https://supabase.com/docs/guides/auth) + `@supabase/ssr` | User registration, sign in, JWT verification, and secure HTTP-only cookies |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict mode enabled, zero `any` usage, end-to-end type inference |
| **API Transport** | [tRPC v11](https://trpc.io/) | Type-safe RPC with automatic client inference and `protectedProcedure` auth guard |
| **Database ORM** | [Drizzle ORM](https://orm.drizzle.team/) | Lightweight, type-safe SQL query builder and schema management |
| **Database** | [PostgreSQL (Supabase)](https://supabase.com/) | Real relational database with transaction connection pooling & RLS |
| **Validation** | [Zod](https://zod.dev/) | Single source of truth for auth, list, and task input schemas |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Accessible, responsive, minimalist design with neutral palette |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/) | Lightweight accessible drag-and-drop toolkit with touch & pointer sensors |
| **Testing** | [Vitest](https://vitest.dev/) + React Testing Library | Unit, service, repository, tRPC caller, and component testing |

---

## 3. Architecture & Data Flow

```
[Browser / Presentation Layer]
  ├── /login, /register (Auth Pages & Forms)
  └── / (TodoDashboard, ListSidebar, ViewSwitcher, TodoList, KanbanBoard, UserMenu)
         │  (HTTP-only Cookies / Bearer Session)
         ▼
[Next.js Middleware] (src/middleware.ts)
  └── Refreshes session tokens & redirects unauthenticated traffic to /login
         │
         ▼
[tRPC API Layer] (createTRPCContext + protectedProcedure)
  ├── Server-side auth verification via Supabase Server Client (ctx.user.id)
  └── Rejects unauthenticated calls with TRPCError UNAUTHORIZED
         │
         ▼
[Domain Services Layer] (TodoListService, TodoService)
  ├── Scopes every operation strictly to ctx.user.id
  ├── Auto-provisions "Personal" list for new accounts
  └── Throws domain NotFoundError on cross-tenant access attempts
         │
         ▼
[Data Access Repositories] (TodoListRepository, TodoRepository)
  ├── Scoped SQL queries (WHERE user_id = $userId)
  └── Atomic status updates and task deletions via list_id subqueries
         │
         ▼
[PostgreSQL Database] (Supabase)
  ├── auth.users (Supabase managed user accounts)
  ├── todo_lists (user_id REFERENCES auth.users(id) ON DELETE CASCADE)
  ├── todos (list_id REFERENCES todo_lists(id) ON DELETE CASCADE)
  └── Row-Level Security (RLS) active on all tables
```

---

## 4. Database Schema & Migrations

The database schema is managed via Drizzle Kit:

- `0000_futuristic_fixer.sql`: Initial `todos` table.
- `0001_lucky_alice.sql`: `todo_lists` table, foreign-key relationship, status enum.
- `0002_fix_default_list_uuid.sql`: Migrated default list ID to RFC 4122 v4 UUID (`00000000-0000-4000-8000-000000000001`).
- `0003_add_user_ownership.sql`: Added `user_id` foreign key referencing `auth.users(id)`, created indexes `(user_id)` and `(user_id, created_at)`, and enabled Row-Level Security (RLS) policies on `todo_lists` and `todos`.

---

## 5. Running the Application & Test Suite

### Environment Configuration
Ensure `.env.local` is configured with:
```env
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
SUPABASE_SERVICE_ROLE_KEY="[service-role-key]"
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-1-[region].pooler.supabase.com:5432/postgres"
```

### Development Server
```bash
npm run dev
```
Visit `http://localhost:3000`. If unauthenticated, you will be redirected to `/login`. You can create an account at `/register` or sign in.

### Run Automated Tests
```bash
npm test
```
Executes all 112 automated Vitest tests across 15 test suites.

### Type Check & Production Build
```bash
npx tsc --noEmit
npm run build
```

### Live Supabase Multi-Tenant Verification Script
```bash
npx tsx scripts/verify-phase4-live.ts
```
Creates two test accounts on Supabase, verifies cross-tenant isolation and zero-trust rejections, and cleans up after completion.
