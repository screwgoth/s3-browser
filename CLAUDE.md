# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

S3 Navigator is a self-hosted, database-backed S3 bucket browser built with Next.js 15 (App Router) + PostgreSQL. Users browse/upload/download files across multiple S3-compatible buckets. All AWS SDK calls run server-side (Server Actions) — credentials are never sent to the browser.

> Note: The README's "Architecture" and "Limitations" sections describe an older **localStorage** design. The current codebase is **PostgreSQL-backed** (users, sessions, encrypted bucket credentials, audit logs). Trust the code in `src/lib/` and `scripts/schema.sql` over the README when they conflict.

## Commands

```bash
npm run dev          # dev server on http://localhost:5000 (port 5000, not 3000)
npm run build        # production build
npm run start        # start production build (README uses: pm2 start npm --name s3-browser -- run start)
npm run lint         # next lint
npm run typecheck    # tsc --noEmit

npm run generate-keys # generate ENCRYPTION_KEY / secrets for .env

# App lifecycle (PM2 + database, wraps db.sh)
./app.sh setup [prod|dev]   # install + db setup + build + start (mode defaults to prod)
./app.sh start|stop|restart|status|logs|build|migrate|seed|reset|purge [prod|dev]
# prod = `next start` on 3000 (PM2 name "s3-browser")
# dev  = `next dev` on 5000 (PM2 name "s3-browser-dev"); PORT env overrides either

# Database (wraps docker-compose.db.yml: Postgres 16 + pgAdmin)
./db.sh setup        # start db + run migrations + seed (first-time setup)
./db.sh start|stop|status|logs|backup|restore|reset
npm run db:migrate               # scripts/migrate.js (applies scripts/schema.sql)
npm run db:migrate:assignments   # bucket_assignments migration
npm run db:seed                  # seed default admin (admin/admin)
npm run db:reset                 # drop + recreate

# E2E tests (Playwright, Chromium, serial — specs share DB state)
npx playwright test                          # all specs (auto-starts dev server on :5000)
npx playwright test e2e/bucket-management.spec.ts   # single spec
npx playwright test -g "test name"           # single test by title
```

There is no unit-test runner configured — only Playwright e2e tests in `e2e/`.

## Environment

Required in `.env` (see `.env.example`): `DATABASE_URL`, `ENCRYPTION_KEY` (base64, exactly 32 bytes decoded), `NEXTAUTH_SECRET`. Losing `ENCRYPTION_KEY` makes stored AWS credentials unrecoverable. Optional `LOGO_S3_*` vars enable S3-hosted app logo.

Ensure every new code changes, like a Bug fix or a new feature implementation, is done on a new branch which is forked from `master`

## Architecture

**Auth & session flow** (single source of truth is the DB, not the client):
- `src/middleware.ts` — only checks that a `session_token` cookie *exists*; it does NOT validate. Public routes: `/login`, `/api/auth/login`. Auth-check routes (bypass validation): `/api/auth/session`, `/api/auth/change-password`, `/change-password`. Real validation happens downstream.
- `src/lib/auth.ts` — bcrypt hashing, `authenticate()`, `validateSession()`, sessions table (24h expiry). Enforces `must_change_password`.
- `src/lib/session.ts` — server-side helpers `getCurrentUser()` (redirects to `/login`) and `getCurrentUserOptional()` (returns null). Use these in Server Components and API routes to get the authenticated user.
- `src/context/AuthContext.tsx` — client-side auth state, hydrated from `/api/auth/session`. Client permission gating via `src/hooks/use-permission.ts`. **Client permission checks are UX-only; always re-check authorization server-side.**

**RBAC roles** (ascending): `viewer` → `uploader` → `bucket-creator` → `admin`.
- `canDownload`: everyone. `canUpload`: uploader+. `canCreateBucket`: bucket-creator+. `canManageUsers`: admin only.

**S3 operations** — `src/actions/s3.ts` (`'use server'`). All list/download/upload go through Server Actions using `@aws-sdk/client-s3`. Downloads (single/multi/folder-ZIP via `jszip`) are buffered in server memory and returned base64 — large files can time out. Supports optional AWS session tokens (STS/SSO temporary creds). Credentials come decrypted from the DB, never from the client.

**Credential encryption** — `src/lib/encryption.ts`, AES-256-GCM. Bucket AWS keys are encrypted at rest; `src/lib/buckets.ts` encrypts on write / decrypts on read.

**Bucket access model** — a bucket is owned by its creator (`buckets.user_id`) but can be shared with other users via `bucket_assignments` (with a `permission` level). API responses populate `owner_username` / `is_owned` / `permission` on `Bucket`. Context: `src/context/BucketContext.tsx` and `BucketAssignmentContext.tsx`.

**Audit logging** — `src/lib/audit.ts` + `src/actions/audit-record.ts`. All significant operations (auth, bucket CRUD, S3 access) write to `audit_logs`. Viewable at `/admin/audit`.

**Data layer** — `src/lib/db.ts` exposes `query()` and `transaction()` over a shared `pg` Pool. Domain modules `src/lib/{users,buckets,audit,auth}.ts` wrap it. Schema in `scripts/schema.sql` (tables: `users`, `buckets`, `bucket_assignments`, `audit_logs`, `app_settings`, `sessions`).

**Routing** — App Router. Pages under `src/app/*` (e.g. `buckets/[id]`, `admin/audit`, `users`, `bucket-assignments`). REST endpoints under `src/app/api/**/route.ts`.

**AI** — `src/ai/` uses Genkit (`@genkit-ai/googleai`); run with `npm run genkit:dev`. Peripheral to the core app.

## Conventions

- Path alias `@/*` → `./src/*`.
- UI: Tailwind + shadcn/ui components live in `src/components/ui/` (`components.json` config). `lucide-react` icons.
- Forms: `react-hook-form` + `zod` (with `@hookform/resolvers`). Zod also validates Server Action inputs (see `S3ConfigSchema` in `src/actions/s3.ts`).
- App version is read from the `VERSION` file at runtime in `src/app/layout.tsx`.
- File upload cap: 100MB per file.
- Create a new git branch for every new feature or bug fix
- Limit the output from Claude to only essential information or questions on which I need to take a decision
- Before every push update the `VERSION` file to next minor version.
