# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 5000 (0.0.0.0) with Turbopack
npm run build      # Production build
npm start          # Start production server
npm run lint       # ESLint via next lint
npm run typecheck  # TypeScript type checking (tsc --noEmit)
```

Docker helpers (if running containerized):
```bash
./docker.sh start    # Start
./docker.sh stop     # Stop
./docker.sh logs     # View logs
./docker.sh rebuild  # Rebuild after code changes
```

## Architecture

**S3 Navigator** is a Next.js 15 App Router application. All AWS API calls run exclusively as Next.js Server Actions (`'use server'`) — no AWS SDK code runs in the browser.

### State Management (localStorage-backed React Contexts)

All application state is persisted in browser localStorage. Context providers are layered in `src/app/layout.tsx` in this order (outer → inner):

1. **`UserContext`** (`src/context/UserContext.tsx`) — User accounts and roles. Default admin credentials: `admin` / `s3brows3r`. Roles: `viewer`, `uploader`, `bucket-creator`, `admin`.
2. **`AuthContext`** (`src/context/AuthContext.tsx`) — Authentication state; reads/writes `s3-user` in localStorage.
3. **`BucketAssignmentContext`** (`src/context/BucketAssignmentContext.tsx`) — Maps users to buckets with `read-only` or `read-write` permissions; stored as `s3-bucket-assignments`.
4. **`BucketContext`** (`src/context/BucketContext.tsx`) — Bucket configs stored as `s3-buckets`. Derives per-user visible buckets and permission checks by combining ownership and assignments.

### Permissions Model

`src/hooks/use-permission.ts` exposes role-based capability checks:
- `viewer` — download only
- `uploader` — download + upload
- `bucket-creator` — uploader + create/edit/delete own buckets
- `admin` — full access including user management

Bucket-level permissions (`read-only` / `read-write`) are layered on top of role permissions via `BucketAssignmentContext`.

### Server Actions

`src/actions/s3.ts` — All S3 operations (list, get, upload, ZIP download, connection validation). Downloads return base64-encoded data rather than streams.

`src/actions/audit.ts` — Appends audit log entries to `./logs/audit-YYYY-MM-DD.log` files on the server filesystem.

`src/actions/logo.ts` — Handles logo upload/read from the server filesystem.

### Pages (App Router)

- `/` — Home/dashboard; redirects to login or bucket list
- `/login` — Login page
- `/buckets/[id]` — S3 browser for a specific bucket (main browsing UI)
- `/admin` — Admin panel
- `/admin/audit` — PCI-DSS audit trail viewer
- `/users` — User management (admin only)
- `/bucket-assignments` — Assign users to buckets (admin only)
- `/profile` — User profile

### Key Components

- `src/components/s3-browser.tsx` — Core file browser UI (folder navigation, search, pagination, downloads, uploads)
- `src/components/credentials-form.tsx` — Bucket add/edit form with connection testing
- `src/components/app-sidebar.tsx` — Navigation sidebar
- `src/components/upload-dialog.tsx` — File upload dialog
- `src/components/object-details.tsx` — File detail/preview panel

### UI Components

All UI primitives are shadcn/ui components in `src/components/ui/`. Use `src/lib/utils.ts` (`cn()`) for className merging.

### AI / Genkit

`src/ai/genkit.ts` and `src/ai/dev.ts` bootstrap Firebase Genkit with Google AI. Run the Genkit dev UI with `npm run genkit:dev`.

### Notable Constraints

- File upload limit: 100MB
- Downloads buffer entire files in server memory before sending to client — avoid very large files
- No backend database; all data lives in browser localStorage (clearing it resets all config)
- Passwords stored in plaintext in localStorage (not production-grade)
- A `VERSION` file must exist at the project root (read at server startup in `layout.tsx`)
