# Architecture

How Final Showdown is put together. If you want to know *where* something lives or *why* it works the way it does, this is the page.

---

## Data model

Three tables, one compound unique key. That's the whole thing.

```
┌────────────┐        ┌───────────────┐        ┌────────┐
│    User    │◀──────▶│   JobEntry    │◀──────▶│  Job   │
├────────────┤  1:N   ├───────────────┤  N:1   ├────────┤
│ id (cuid)  │        │ id            │        │ id     │
│ email (uq) │        │ jobId         │        │ company│
│ name       │        │ userId        │        │ position│
│ displayName│        │ status (enum) │        │ link(uq)│
│ image?     │        │ referral(enum)│        │ notes? │
│ createdAt  │        │ updatedAt     │        │ addedBy│
└────────────┘        └───────────────┘        │createdAt│
                      UNIQUE(jobId,userId)     │updatedAt│
                                               └────────┘
```

- **User** — one row per allowlisted friend, keyed by email.
- **Job** — one row per posting. Link is `UNIQUE`, so duplicate imports and duplicate POSTs collapse automatically.
- **JobEntry** — one row per `(job, user)` pair. Holds that user's application status and referral state. `@@unique([jobId, userId])` guarantees there's never more than one.

Why a separate `JobEntry` instead of "Alice Status / Bob Status / …" columns on `Job`? Because adding a 5th or 6th friend is then a data change, not a schema change. Same reason we don't hard-code the user list.

Enums:

```prisma
enum AppStatus       { NONE  APPLIED  APPLIED_WITH_REFERRAL  SKIPPED  REJECTED  EXPIRED  OFFER }
enum ReferralStatus  { NONE  REQUESTED  RECEIVED  NOT_NEEDED }
```

`NONE` is the default for both — an entry with both fields `NONE` is indistinguishable from no entry at all. The seeder takes advantage of this: it skips writing entries that would be all-`NONE`.

### Coupling rules between status and referral

Enforced client-side in `components/status-pill.tsx` so the UI stays consistent:

- Changing your status to `APPLIED_WITH_REFERRAL` auto-sets referral to `RECEIVED`.
- Changing your referral to `RECEIVED` while status is `APPLIED` auto-promotes status to `APPLIED_WITH_REFERRAL`.
- Changing your referral back to `REQUESTED` while status is `APPLIED_WITH_REFERRAL` demotes it to `APPLIED`.

The server trusts whatever the client sends (after authz). If you want to harden this, move the coupling into `app/api/entries/route.ts`.

---

## Request flow

### Read path — the jobs board (`/`)

1. `app/page.tsx` is a Server Component. It calls `auth()` and then `getAllJobs()` / `getAllUsers()` from `lib/data.ts`.
2. The resulting job list (with nested `addedBy` + `entries`) is passed as a prop to `<JobsBoard>` (a Client Component).
3. `<JobsBoard>` handles all filtering, sorting, and status-pill updates on the client. Filter state lives in URL search params so refreshes are stable.

### Read path — the dashboard (`/dashboard`)

1. `app/dashboard/page.tsx` is a Server Component that calls `getDashboardData()` — a single aggregate query that returns users, timeline, per-user stats, referral queue, and any "import days" (days with 100+ jobs, treated as bulk CSV imports and hidden from the timeline).
2. Charts in `components/charts/` are Client Components wrapping Recharts.

### Write path — editing your status

1. User clicks their own pill → dropdown opens → they pick a new status or referral.
2. `components/status-pill.tsx` applies the coupling rules, optimistically updates local state, and sends `PATCH /api/entries` with `{ jobId, userId, status, referral }`.
3. `app/api/entries/route.ts` validates with zod, checks that `userId === session.user.id` **or** the caller is admin (`isAdminEmail`), then `prisma.jobEntry.upsert` on the compound unique key.
4. If the server rejects, the pill rolls back its optimistic update and shows a toast.

All board mutations are optimistic: the change is applied to local state and the dialog closes immediately, the request runs in the background, and the UI reverts with an error toast if the server rejects it. The actor never blocks on `router.refresh()` — the mutation response carries the authoritative row. The one exception is marking a job EXPIRED, which triggers a refresh to pull in the server-side cascade to other users.

### Write path — creating / editing / deleting a job

- `POST /api/jobs` — any signed-in user; rejects duplicate links with 409.
- `PATCH /api/jobs/[id]` — creator or admin only.
- `DELETE /api/jobs/[id]` — creator or admin only. Cascade deletes associated `JobEntry` rows.

---

## Auth

- NextAuth v5 (beta) with the Google provider, JWT session strategy (no session rows in Postgres).
- `lib/auth.ts` exports `handlers`, `auth`, `signIn`, `signOut`.
- `callbacks.signIn` enforces the `ALLOWED_EMAILS` allowlist and upserts the `User` row on first sign-in.
- `callbacks.jwt` looks up the DB user id and caches it in the token so server components can do `session.user.id` without an extra query on every request.
- `isAdminEmail(email)` checks against `ADMIN_SEED_EMAIL`.

All API routes start with `const session = await auth();` and return 401 if there's no user id. Authorization (who can edit what) happens after that.

---

## UI primitives

All `components/ui/*` files are shadcn-style wrappers over Radix primitives. They're checked into the repo rather than installed as a dependency so we can tweak them freely. Styling uses Tailwind + `class-variance-authority` for variant handling and `tailwind-merge` via `cn()` for safe class composition.

Theming is driven by `next-themes` (see `components/theme-provider.tsx`). There are three first-class themes — `light` (Paper), `graphite` (Graphite), and `dark` (Carbon) — applied as a class on `<html>`. Graphite and Carbon are both dark-family: `tailwind.config.ts` uses a custom `darkMode` variant so `dark:` utilities match either class. Design tokens live in `app/globals.css`; the visual system is documented in [`DESIGN.md`](../DESIGN.md), and chart colors are centralized in `lib/chart-colors.ts` (a CVD-validated palette).

---

## Why these choices

- **Neon over Supabase/RDS.** Free tier, serverless (no idle billing), and the pooled endpoint plays nicely with Next.js serverless routes.
- **JWT sessions, no adapter tables.** With a 5-user allowlist there's no reason to store sessions in Postgres. This also means deploying auth doesn't require running more migrations.
- **Server Components for reads, Client Components for writes + filter state.** Reads happen on the server (no client-side fetch, no waterfall). Filtering 1500 rows is a client job (instant, no network).
- **One aggregate query for the dashboard.** Everything the dashboard needs comes from one call to `getDashboardData()`. Cheap, predictable, easy to cache later.
- **Framer Motion intentionally kept lightweight.** We removed per-row enter/exit animations after seeing search lag on 1500-row filters. See `jobs-board.tsx` for the `useDeferredValue` + in-memory `searchIndex` pattern.
