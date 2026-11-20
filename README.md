# Caize Todo — High-Performance Multi-Tenant Task Management Platform

A production-grade, collaborative task management platform engineered with a strict **modular monolith architecture**, end-to-end TypeScript type safety, multi-tenant relational isolation, accessible dual-view visualization (List View & Kanban Board), fine-grained role-based access control (RBAC), real-time notification dispatch, audit trail logging, and persistent cloud storage backed by Supabase PostgreSQL.

---

## 1. Project Overview

**Caize Todo** addresses the complexity of modern personal and collaborative task management by combining minimalist, high-velocity UX with rigorous enterprise-grade engineering principles. 

Modern task managers frequently suffer from architectural anti-patterns: bloated client-side state, unindexed relational queries, lack of multi-tenant zero-trust boundaries, or loose authorization checks that lead to information disclosure. Caize Todo was built from the ground up to demonstrate how a modern full-stack web application can maintain:

- **Absolute Separation of Concerns**: Strict boundary layers between UI components, API transport, business domain logic, repository queries, and schema definitions.
- **Zero-Trust Multi-Tenancy**: All client requests resolve user identity strictly from verified server-side session contexts (`ctx.user.id`), with defense-in-depth Row-Level Security (RLS) active in PostgreSQL.
- **Dual-View Ergonomics**: Fluid switching between an accessible structured List View and an interactive Kanban Board with `@dnd-kit` drag-and-drop mechanics.
- **Real-Time Collaboration**: Role-based list sharing (`OWNER`, `EDITOR`, `VIEWER`), secure invitation tokens, activity audit feeds, and in-app notification center.
- **Advanced Task Ergonomics**: Four-tier priority hierarchy (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), timezone-safe calendar due dates, overdue tracking, server-side `ilike` search, and deterministic multi-key sorting.

---

## 2. Project Development Status

- **Current Development Phase**: **PHASE 10**
- **Implementation Status**: **100% COMPLETE & VERIFIED**
- **Repository Milestone**: **Phase 10: File Attachments & Asset Management Milestone**

### Milestone Summary
The project has successfully completed ten foundational development phases, moving progressively from initial single-list persistence to full multi-tenant collaboration, notifications, advanced task metadata, dynamic color-coded tag organization, recurring task scheduling engines, and secure cloud file attachments with asset management. Every layer—from Drizzle ORM schemas and Supabase Storage to React UI components—has undergone rigorous verification with automated tests, zero TypeScript errors, successful production build compilation, and end-to-end live Supabase database and storage verification.

---

## 3. Implemented Features (Phases 1 – 8)

### Phase 1: Core Architecture & Single-List Persistence
- Modular monolith directory structure separating presentation, tRPC API routes, domain services, data repositories, and Drizzle schemas.
- Full CRUD operations for tasks with title, optional description, and audit timestamps.
- RFC-compliant input validation via Zod schemas.
- Vitest unit testing harness with in-memory repository abstractions.

### Phase 2 & 2.1: Multi-List Support & Status Lifecycle
- User ability to create, rename, and delete multiple independent Todo lists.
- Three-state task lifecycle: `TODO`, `IN_PROGRESS`, and `DONE` managed via PostgreSQL ENUM.
- Relational foreign-key cascade integrity (`ON DELETE CASCADE`) ensuring complete cleanup of child tasks.
- Migration to RFC 4122 v4 compliant UUIDs across all primary and foreign keys, standardizing the default Personal list to `00000000-0000-4000-8000-000000000001`.

### Phase 3 & 3.1: Dual-View Experience & Accessible Kanban Board
- Instant toggle between structured **List View** and visual **Kanban Board View**.
- Per-list view preference persistence stored in `localStorage` with SSR hydration guards.
- Three-column Kanban board mapped directly to the unified underlying database status enum (`TODO`, `IN_PROGRESS`, `DONE`).
- Fluid drag-and-drop task movement powered by `@dnd-kit`, featuring pointer, touch (with hold delay to avoid scroll hijacking), and keyboard sensors.
- Accessible explicit fallback controls (`→ In Progress`, `✓ Done`, `↩ Reopen`) ensuring 100% keyboard and screen-reader usability.

### Phase 4 & 4.2: Supabase Authentication & Multi-Tenant Data Isolation
- End-to-end user authentication with `@supabase/ssr`, supporting email/password registration and login.
- Google OAuth 2.0 integration with secure callback handling and state validation.
- Next.js Session Middleware refreshing session JWTs and protecting private routes with zero client exposure.
- Server-derived identity: Frontend never supplies a `userId`; tRPC `protectedProcedure` resolves identity directly from the cryptographically verified session token.
- Information Disclosure Prevention: Cross-tenant unauthorized access attempts consistently throw `NotFoundError` rather than `ForbiddenError`, eliminating UUID existence enumeration vectors.

### Phase 5 & 5.7: List Sharing, Role-Based Collaboration & Invitations
- Collaborative shared lists supporting three distinct permission tiers:
  - **OWNER**: Full administrative control (manage collaborators, rename list, delete list, manage tasks).
  - **EDITOR**: Read and write access (create tasks, modify details, change status, delete tasks).
  - **VIEWER**: Strict read-only access (view tasks, view activity; all mutations blocked).
- Cryptographic invitation token lifecycle: generate unique invitation tokens, dispatch invitations, accept via `/invite/[token]`, or revoke.
- Delivery strategy pattern supporting console delivery (local development) and Resend API (production transactional emails).
- OAuth open-redirect defense validating target URLs against origin whitelists.

### Phase 6: Real-Time Notifications & Keyset Activity Audit Trail
- Persistent in-app **Notification Center** with bell icon, unread counter badge, mark-as-read toggles, and mark-all-read actions.
- Notifications dispatched automatically for invitation receipt, invitation acceptance, role updates, and list removal.
- Immutable **Activity History Timeline** auditing task creations, updates, renames, status movements, and deletions.
- High-efficiency composite keyset pagination (`(created_at, id)`) preventing offset drift and index degradation on large audit tables.

### Phase 7: Task Priorities, Calendar Due Dates, Search & Deterministic Sorting
- **Four-Tier Priority Model**: `LOW`, `MEDIUM`, `HIGH`, `URGENT` backed by PostgreSQL ENUM `todo_priority`, defaulting to `MEDIUM`.
- **Calendar Due Dates**: ISO `YYYY-MM-DD` strings stored via PostgreSQL `date` type with zero-timezone conversion shifts.
- **Overdue Invariant Engine**: Tasks due in the past are marked overdue only when in `TODO` or `IN_PROGRESS`. Tasks marked `DONE` or due today are never flagged overdue.
- **Server-Side Full-Text Search**: Case-insensitive SQL `ilike` pattern matching across task titles and descriptions.
- **Multi-Facet Filtering**: Filter concurrently by status, priority, and due date categories (`ALL`, `OVERDUE`, `TODAY`, `THIS_WEEK`, `NO_DUE_DATE`).
- **Deterministic Multi-Key Sorting**: Multi-key sort orders with `NULLS LAST` for calendar dates and weighted `CASE` rankings for priorities, always broken deterministically by `createdAt` and unique `id`.
- **Activity Log Delta Tracking & No-Op Suppression**: Detailed metadata capture recording previous and new values for priorities and due dates, while suppressing database writes and activity logs when mutations contain identical values.

### Phase 8: Color-Coded Tags, Labels & Multi-Tag Filtering
- **List-Scoped Tag Architecture**: Normalized relational design with `tags` table and `todo_tags` junction table (`ON DELETE CASCADE`), ensuring tags belong directly to individual lists for consistent collaborative views across all list members.
- **Accessible 10-Color Palette**: 10 curated tag colors (`slate`, `red`, `orange`, `amber`, `emerald`, `teal`, `blue`, `indigo`, `purple`, `pink`) with WCAG-compliant contrast and colored indicator dots in light and dark modes.
- **Case-Insensitive Duplicate Prevention**: Unique constraint and service-level case-insensitive uniqueness check (`lower(name) + listId`) preventing duplicate tag creation.
- **Task Tag Multi-Assignment**: Many-to-many relationship allowing tasks to have multiple tags, customizable during task creation and via inline task editing.
- **Multi-Tag Filtering Engine**: Filter tasks by one or multiple tags with toggleable **AND** (must possess all selected tags) and **OR** (possesses at least one selected tag) matching semantics, interoperable with search, status, priority, due date, and deterministic sorting.
- **N+1 Query Elimination**: Batch tag loader (`findTagsForTodos`) loads all tags for a list view in a single relational join query, grouping tags in-memory.
- **Full RBAC Enforcement**: List OWNER and EDITOR roles can manage and assign tags; VIEWER role is strictly read-only on all tag mutations.
- **Tag Management Modal**: Dedicated dialog in the list toolbar for creating, renaming, recoloring, and deleting tags.
- **Activity History Integration**: Activity logging for `TAG_CREATED`, `TAG_UPDATED`, and `TAG_DELETED` events with formatted event feeds.

### Phase 9: Recurring Tasks & Scheduling Engine
- **Multi-Frequency Scheduling Engine**: Pure date arithmetic recurrence engine supporting `DAILY`, `WEEKLY` (arbitrary weekday sets with fixed weekly anchor avoiding interval drift), `MONTHLY` (anchor day-of-month preserving clamped targets e.g. Jan 31 $\to$ Feb 28 $\to$ Mar 31), `YEARLY` (preserving leap-year Feb 29 targets), and bounded `CUSTOM` intervals.
- **Occurrence Idempotency**: Series tracking via monotonic `UNIQUE(recurrence_rule_id, occurrence_number)` constraint preventing duplicate generation under concurrent completions, rescheduled tasks, or network retries.
- **Pure CQRS Read Invariance**: Normal task listing queries (`todo.list`) remain strictly read-only with 0 side-effects.
- **Multi-Path Occurrence Generation**: Deterministic occurrence generation on task completion (`handleTaskCompletion`), manual list catch-up RPC (`recurrence.syncCatchUp`), and automated background cron (`/api/cron/recurring-tasks`).
- **Recurrence Lifecycle Controls**: Edit recurring series, pause/resume recurrence rules, cancel series, or detach individual tasks into standalone todos.

### Phase 10: File Attachments & Asset Management
- **Supabase Storage Integration**: Direct-to-storage signed uploads (120s TTL) and time-limited signed downloads (300s TTL) using private bucket `caize-todo-attachments`.
- **Two-Phase Deletion & Compensating Sweeper**: Two-phase deletion (`PENDING_DELETION` status $\to$ immediate UI hide $\to$ storage delete $\to$ hard delete row) prevents orphaned storage paths or lost references if storage or application crashes.
- **Atomic Slot Reservation Under Concurrency**: Bounded 10 attachments per task enforced atomically via `SELECT ... FOR UPDATE` row locks during `createUploadUrl`, eliminating race-condition quota bypasses.
- **Database Relationship Integrity**: Composite foreign key `(todo_id, list_id) REFERENCES todos(id, list_id) ON DELETE CASCADE` on `todo_attachments` mathematically guaranteeing zero cross-tenant leakage.
- **Defense-in-Depth Validation**: Strict MIME/extension allowlist (PNG, JPEG, WebP, PDF, DOCX, XLSX, TXT, CSV, MD), 10MB maximum file size, filename sanitization against path traversal, and 16-byte magic byte signature verification on upload confirmation before activation.
- **Interactive UI Components**: `AttachmentCountBadge` with paperclip icon on List and Kanban task cards, `TaskAttachmentsPanel` with drag-and-drop / file selector, upload progress bar (`0%` $\to$ `100%`), preview modal for images, download button, and activity audit logging (`ATTACHMENT_UPLOADED`, `ATTACHMENT_DELETED`).

---

## 4. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Turbopack) | 16.4.6 | Full-stack React framework with React Server Components, server actions, and proxy middleware routing |
| **Runtime & UI** | [React](https://react.dev/) | 19.3.0 | Modern UI rendering engine with component-level state and transitions |
| **Authentication** | [Supabase Auth](https://supabase.com/docs/guides/auth) + `@supabase/ssr` | 0.12.7 | Secure cookie-based authentication, user identity verification, and Google OAuth |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | 5.x (Strict) | End-to-end type safety, strict null checks, and zero runtime type degradation |
| **API Transport** | [tRPC v11](https://trpc.io/) | 11.13.0 | End-to-end type-safe RPC boundary with automatic client type inference |
| **State & Cache** | [@tanstack/react-query](https://tanstack.com/query) | 5.107.1 | Optimistic UI updates, automatic query cache invalidation, and background synchronization |
| **Database ORM** | [Drizzle ORM](https://orm.drizzle.team/) | 0.45.4 | High-performance, lightweight SQL query builder and schema definitions |
| **Database Engine** | [PostgreSQL (Supabase)](https://supabase.com/) | 15+ | Relational persistence, connection pooling (PgBouncer), indexes, and RLS policies |
| **Schema Validation**| [Zod](https://zod.dev/) | 4.6.7 | Single source of truth for runtime validation of API inputs and domain models |
| **Styling & Icons** | [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) | 4.3.3 / 1.73.0 | Minimalist design system, responsive layouts, dark mode support, and iconography |
| **Drag and Drop** | [@dnd-kit/core](https://dndkit.com/) | 6.3.1 | Accessible drag-and-drop primitives with pointer, keyboard, and touch sensor abstractions |
| **Test Harness** | [Vitest](https://vitest.dev/) + React Testing Library | 5.1.0 / 16.3.3 | Lightning-fast test runner for unit, integration, and UI component tests |

---

## 5. Architectural Design

Caize Todo is organized as a **modular monolith** that strictly enforces unidirectional dependencies. No upper layer bypasses an intermediate layer to query the database directly.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer (Next.js)                    │
│  /login, /register, /invite/[token], TodoDashboard, KanbanBoard, Form  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (HTTP Cookies / Session JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Session Middleware                      │
│            Token validation, SSR cookie sync, route protection         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Validated Session Context)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          API Layer (tRPC v11)                          │
│     publicProcedure, protectedProcedure (ctx.user.id resolution)      │
│     Routers: todoRouter, listRouter, sharingRouter, notificationRouter │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Validated DTOs via Zod)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Domain Service Layer                          │
│     TodoService, TodoListService, ListPermissionService, Activity, ... │
│     • Enforces RBAC permissions (OWNER, EDITOR, VIEWER)                │
│     • Manages atomic transactions (withTransaction)                    │
│     • Captures audit deltas & suppresses no-ops                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Domain Entities)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Data Access Layer (Repositories)               │
│     TodoRepository, TodoListRepository, ListMemberRepo, ActivityRepo   │
│     • Parameterized SQL queries via Drizzle ORM                        │
│     • Multi-key deterministic sorting & keyset pagination              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (SQL Queries)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL Database Layer                 │
│     Tables: auth.users, todo_lists, todos, list_members, invitations,  │
│             activity_logs, notifications                               │
│     • Foreign-key cascade deletion (ON DELETE CASCADE)                 │
│     • Composite B-tree indexes & Row-Level Security (RLS) policies     │
└────────────────────────────────────────────────────────────────────────┘
```

### Architectural Principles
1. **Zero-Trust Client Boundary**: Clients cannot inject user IDs. The server derives identity purely from verified session tokens.
2. **Atomic Mutations with Activity Auditing**: Every domain mutation (`TODO_CREATED`, `TODO_UPDATED`, `TODO_STATUS_CHANGED`, `TODO_DELETED`) executes inside an atomic database transaction alongside its corresponding audit log.
3. **Information Disclosure Prevention**: If a user queries an unauthorized resource, the system returns `NotFoundError` rather than `ForbiddenError`, eliminating enumeration attacks.

---

## 6. Database Schema & Relational Design

The database schema is defined declaratively using Drizzle ORM and migrated to PostgreSQL via Drizzle Kit:

```
  auth.users (Supabase Auth)
      │
      ├──< todo_lists (id, user_id, name, created_at, updated_at)
      │        │
      │        ├──< recurrence_rules (id, list_id, frequency, interval, start_date, end_date, max_occurrences, status, next_due_date, ...)
      │        │        │
      │        │        └──< todos (id, list_id, recurrence_rule_id, occurrence_number, title, description, status, priority, due_date, ...)
      │        │                 │
      │        │                 ├──< todo_tags (todo_id, tag_id) >── tags (id, list_id, name, color)
      │        │                 │
      │        │                 └──< todo_attachments (id, todo_id, list_id, storage_path, original_filename, mime_type, file_size, status, ...)
      │        │
      │        ├──< list_members (id, list_id, user_id, role ['OWNER','EDITOR','VIEWER'], joined_at)
      │        │
      │        ├──< invitations (id, list_id, email, token, role, status, expires_at, created_at)
      │        │
      │        └──< activity_logs (id, list_id, actor_id, action, entity_type, entity_id, metadata, created_at)
      │
      └──< notifications (id, user_id, actor_id, list_id, type, title, message, is_read, created_at)
```

### Critical Indexes & Performance Optimizations
- `todos_list_id_idx`: B-tree index on `todos(list_id)` for rapid cascade resolution.
- `todos_list_id_created_at_idx`: Composite index on `todos(list_id, created_at)` for chronological retrieval.
- `todos_list_id_due_date_idx`: Composite index on `todos(list_id, due_date ASC NULLS LAST)` for calendar-based queries.
- `todos_list_id_priority_idx`: Composite index on `todos(list_id, priority)` for priority facet filtering.
- `todos_recurrence_rule_occurrence_unique`: Monotonic composite unique constraint on `todos(recurrence_rule_id, occurrence_number)` ensuring idempotent occurrence generation.
- `todos_id_list_id_unique`: Unique constraint on `todos(id, list_id)` enabling composite foreign key referencing.
- `todo_attachments_todo_list_fk`: Composite foreign key on `todo_attachments(todo_id, list_id) REFERENCES todos(id, list_id) ON DELETE CASCADE`.
- `todo_attachments_todo_status_idx`: Composite index on `todo_attachments(todo_id, status)` for rapid task attachment queries.
- `todo_attachments_list_id_idx`: Index on `todo_attachments(list_id)` for list-scoped queries and cascades.
- `todo_attachments_storage_path_unique`: Unique constraint on `todo_attachments(storage_path)` preventing path collisions.
- `todo_attachments_sweeper_idx`: Partial index on `todo_attachments(status, expires_at)` for upload-timeout sweepers.
- `todo_attachments_pending_deletion_idx`: Partial index on `todo_attachments(status, deleted_at)` for deletion sweepers.
- `recurrence_rules_list_id_idx`: Index on `recurrence_rules(list_id)` for fast list-scoped schedule resolution.
- `recurrence_rules_status_next_due_idx`: Composite index on `recurrence_rules(status, next_due_date)` for high-throughput sweeper cron queries.
- `tags_list_id_idx` & `tags_list_id_name_unique`: Case-insensitive unique constraint on tag names per list.
- `activity_logs_composite_pagination_idx`: Keyset pagination index on `activity_logs(list_id, created_at DESC, id DESC)`.
- `notifications_user_unread_idx`: Composite index on `notifications(user_id, is_read, created_at DESC)` for fast unread count queries.

### Migration Journal Registry
- `0000_futuristic_fixer.sql`: Initial `todos` schema and timestamps.
- `0001_lucky_alice.sql`: Multi-list support (`todo_lists`) and foreign-key relationships.
- `0002_fix_default_list_uuid.sql`: Default list UUID migration (`00000000-0000-4000-8000-000000000001`).
- `0003_add_user_ownership.sql`: Multi-tenant ownership referencing `auth.users(id)` and RLS policies.
- `0004_list_sharing_and_collaboration.sql`: Collaborative roles (`list_members`), invitations, and permission triggers.
- `0005_notifications_and_activity.sql`: Notification center tables and immutable activity audit logs.
- `0006_task_priorities_and_due_dates.sql`: Task priorities (`todo_priority` enum), calendar due dates, and composite indexes.
- `0007_tags_and_labels.sql`: Color-coded tag definitions, task junction mappings, and multi-tag filtering indexes.
- `0008_recurring_tasks_and_schedules.sql`: Recurrence schedule templates, recurrence enums, series tracking counters, and unique occurrence constraints.
- `0009_task_file_attachments.sql`: Task file attachments table (`todo_attachments`), composite foreign key on `(todo_id, list_id)`, attachment status lifecycle enum, storage path constraints, and sweeper indexes.

---

## 7. Authorization & Security Model

| User Role | Read Tasks & Activity | Create / Edit / Delete Tasks | Invite Collaborators | Update Roles / Remove Members | Rename / Delete List |
|---|:---:|:---:|:---:|:---:|:---:|
| **OWNER** | Allowed | Allowed | Allowed | Allowed | Allowed |
| **EDITOR** | Allowed | Allowed | Blocked | Blocked | Blocked |
| **VIEWER** | Allowed | Blocked | Blocked | Blocked | Blocked |
| **Non-Member** | Blocked (`404`) | Blocked (`404`) | Blocked (`404`) | Blocked (`404`) | Blocked (`404`) |

- **Multi-Tenant Isolation**: Verified in automated integration tests. User A can never access, query, or mutate User B's lists or tasks.
- **Invitation Security**: Invitation tokens are 32-byte cryptographically secure random hexadecimal strings with an automatic 7-day expiration window.
- **OAuth Open-Redirect Guard**: Authentication callbacks validate the `next` redirect target to prevent open redirect vulnerabilities to external malicious origins.

---

## 8. Installation & Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v22+
- [npm](https://www.npmjs.com/) v10+
- A [Supabase](https://supabase.com/) project with PostgreSQL and Auth enabled

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/chavitinasrivaruntej/todolist.git
cd todolist
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and provide your Supabase project credentials:
```bash
cp .env.example .env.local
```

Populate the following variables in `.env.local`:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Supabase API Credentials
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR_SUPABASE_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR_SUPABASE_SERVICE_ROLE_KEY]"

# Database Connection (Transaction Mode for App, Direct/Session Mode for Migrations)
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_PASSWORD]@aws-1-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres"

# Email Configuration (Console for local development, Resend for production)
EMAIL_PROVIDER="console"
```

### 3. Run Migrations
Apply the registered Drizzle migrations to your Supabase instance:
```bash
npm run db:migrate
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. Quality Assurance & Verification

Caize Todo adheres to rigorous automated quality gates:

### Run Automated Test Suite
```bash
npm test
```
- **43 test files**, **383 unit and integration tests** passing (100% pass rate).
- Full coverage across validations, repositories, domain services, recurrence calculation engine, Supabase storage adapter, attachment validations, magic bytes verification, tRPC routers, authorization checks, and React UI components.

### TypeScript Compilation Check
```bash
npx tsc --noEmit
```
- Strict mode compilation: **0 errors**.

### ESLint Check
```bash
npm run lint
```
- Codebase style and hook enforcement: **0 errors**.

### Production Build
```bash
npm run build
```
- Production compilation with Next.js Turbopack: **Exit Code 0** across all static, dynamic, and proxy routes.

---

## 10. Long-Term Project Roadmap (12 Phases)

Caize Todo follows a structured 12-phase development trajectory:

```
[Phase 1: Architecture Foundation] ─────────► [DONE]
[Phase 2: Multi-List & Status Engine] ──────► [DONE]
[Phase 3: Dual-View & Kanban Drag-and-Drop] ► [DONE]
[Phase 4: Multi-Tenant Supabase Auth] ──────► [DONE]
[Phase 5: RBAC Collaboration & Invitations] ─► [DONE]
[Phase 6: Notifications & Activity Audit] ──► [DONE]
[Phase 7: Priorities, Due Dates & Search] ──► [DONE]
[Phase 8: Tags, Labels & Multi-Filtering] ──► [DONE]
[Phase 9: Recurring Tasks & Schedule Engine] ► [DONE]
[Phase 10: File Attachments & Asset Storage] ─► [DONE]
────────────────────────────────────────────────────
[Phase 11: Realtime WebSockets & Live Presence] ─► [PLANNED]
[Phase 12: Analytics Dashboard & Productivity Insights] ► [PLANNED]
```

### Planned Future Phases (11 – 12)
- **Phase 11 (Planned)**: Supabase Realtime WebSocket subscriptions for live collaborator presence and instant board sync.
- **Phase 12 (Planned)**: Productivity metrics, weekly completion trends, velocity charts, and CSV/JSON export.

---

## 11. Phase 9 — Recurring Tasks & Scheduling Engine Milestone

Completed, verified, and consolidated with pure date arithmetic recurrence engine supporting `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, and `CUSTOM` intervals, monotonic occurrence idempotency constraints, read-invariant CQRS listing, and automated background sync.

---

## 12. Phase 10 — File Attachments & Asset Management Milestone

This checkpoint marks the official completion, verification, and consolidation of **Phase 10**. All functional and architectural requirements for cloud file attachments, Supabase Storage integration, strict multi-tenant authorization, concurrency-safe quota limits, two-phase deletion, and defense-in-depth magic byte validation are implemented, fully tested, documented, and synchronized to GitHub:

- **Supabase Storage Integration**: Direct-to-storage signed uploads (120s TTL) and time-limited signed downloads (300s TTL) using private bucket `caize-todo-attachments`.
- **Two-Phase Deletion & Compensating Sweeper**: Two-phase deletion (`PENDING_DELETION` status $\to$ immediate UI hide $\to$ storage delete $\to$ hard delete row) prevents orphaned storage paths or lost references if storage or application crashes.
- **Atomic Slot Reservation Under Concurrency**: Bounded 10 attachments per task enforced atomically via `SELECT ... FOR UPDATE` row locks during `createUploadUrl`, eliminating race-condition quota bypasses.
- **Database Relationship Integrity**: Composite foreign key `(todo_id, list_id) REFERENCES todos(id, list_id) ON DELETE CASCADE` on `todo_attachments` mathematically guaranteeing zero cross-tenant leakage.
- **Defense-in-Depth Validation**: Strict MIME/extension allowlist (PNG, JPEG, WebP, PDF, DOCX, XLSX, TXT, CSV, MD), 10MB maximum file size, filename sanitization against path traversal, and 16-byte magic byte signature verification on upload confirmation before activation.
- **Interactive UI Components**: `AttachmentCountBadge` with paperclip icon on List and Kanban task cards, `TaskAttachmentsPanel` with drag-and-drop / file selector, upload progress bar (`0%` $\to$ `100%`), preview modal for images, download button, and activity audit logging (`ATTACHMENT_UPLOADED`, `ATTACHMENT_DELETED`).
- **Verified Test Metrics**: 43 test files, 383 passing tests, 0 failures.
- **Build Status**: Production Next.js 16 Turbopack build verified (`npm run build`).
- **Database Status**: Migration 0009 applied and verified live on Supabase PostgreSQL with active composite foreign key and storage bucket.
- **Git Milestone**: Synchronized with `origin/main` on GitHub.
