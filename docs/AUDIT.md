# FinalShowdown — Codebase Audit

_Date: 2026-04-21 • Scope: Next.js 15 App Router app on Neon/Render for a 5-person job-tracker._

This report aggregates findings from four parallel review passes (database/latency, real-time refresh, security, frontend/UX, backend architecture). Every finding cites `file:line` against the **current code on `main`** and includes a concrete fix.

Severities:

- **P0** — fix now (correctness, data loss, security, or hard latency wall)
- **P1** — fix soon (user-perceived lag, UX pitfall, or medium risk)
- **P2** — nice-to-have, tech-debt, hardening

---

## TL;DR — the five things that matter most

| # | Issue | Severity | Where |
|---|-------|---------:|-------|
| 1 | `getDashboardData` loads every job + every entry and aggregates in JS on every page view | **P0** | `lib/data.ts:44-203` |
| 2 | In-memory SSE emitter only works with a single Node instance — silently breaks if Render scales to ≥2 | **P0** | `lib/events.ts:13-19` |
| 3 | Missing Prisma indexes on `(jobId, userId, status)`, `JobEntry.referral`, `Job.updatedAt` | **P1** | `prisma/schema.prisma:40-54` |
| 4 | `router.refresh()` on every SSE event refetches the whole page — clobbers open dialogs, scroll, focus | **P1** | `lib/use-live-refresh.ts:40,55,77,87` |
| 5 | No rate-limit / connection cap on `/api/events`; no structured error handling or logging on any route | **P1** | `app/api/events/route.ts`, all `app/api/**/route.ts` |

Everything else (below) is smaller surface area but still worth doing.

---

## 1. Database / latency

### 1.1 `getDashboardData` does JS aggregation over the full dataset — **P0**

`lib/data.ts:44-203` loads `getAllUsers()` + `getAllJobs()` (which includes every `JobEntry`), then scans the result 5+ times in JavaScript to build:

- per-user status counts (line 50-95)
- jobs-added timeline (line 102-121)
- referral-requested list (line 124-130)
- applications-over-time day/week/month series (line 137-192)

At current size (~1,500 jobs × 5 users × ≥1 entry each) that is ~7,500 rows pulled into Node on every dashboard view, re-parsed and re-looped from scratch. `app/dashboard/page.tsx:21` sets `force-dynamic`, so nothing is cached — cold DB → 500 ms+ per visit, and it only gets worse as the CSV grows.

**Fix:**

- Replace the JS counting with `prisma.jobEntry.groupBy({ by: ["userId","status"], _count: true })` and a second `groupBy` for referrals.
- For the timeline series, use raw SQL with `date_trunc('day', "createdAt")` / `date_trunc('week', ...)`  / `date_trunc('month', ...)` and `GROUP BY` — pushes O(n) aggregation to Postgres, which has indexes.
- Keep the dashboard `force-dynamic` if you want live-freshness, but add `export const revalidate = 10` (or `unstable_cache` on the aggregation function) so back-to-back visits don't re-query.

### 1.2 In-memory `EventEmitter` does not survive horizontal scaling — **P0**

`lib/events.ts:13-19` creates a process-local `EventEmitter`. `app/api/events/route.ts:31` subscribes SSE clients on that same process. This works today because Render free-tier runs one instance, but:

- On deploy/restart (which free tier does aggressively), every connected client disconnects and silently misses any mutation that landed during the reboot window.
- The moment you scale to 2+ instances or move to any serverless/edge runtime, clients on instance A will **never** see changes posted on instance B — UI goes stale and users think the DB is broken.

**Fix:** put a broadcast channel behind the emitter. Cheapest options:

- **Postgres `LISTEN`/`NOTIFY`** (works on Neon, no new infra — `lib/events.ts` becomes a thin wrapper around `prisma.$executeRawUnsafe('NOTIFY ...')` on write and a `LISTEN` pg client on the SSE route).
- **Upstash Redis pub/sub** (free tier, one `publish()`/one subscriber per SSE connection).
- If you stay single-instance forever, at least document it in `render.yaml` with a `numInstances: 1` pin and a comment referencing this file.

### 1.3 Missing composite / support indexes — **P1**

`prisma/schema.prisma:40-54` has:

- `JobEntry @@unique([jobId, userId])` ✅ (covers jobId-prefix lookups)
- `JobEntry @@index([userId])`, `@@index([status])` — two single-column indexes, not a composite

Hot queries that are not indexed well:

| Query | Where | Missing index |
|-------|-------|---------------|
| EXPIRED cascade `updateMany({ where: { jobId, userId: { in }, status: "NONE" } })` | `app/api/entries/route.ts:64-70` | `@@index([jobId, status])` or cover the `in` with the unique |
| Referral board (`entries.filter(e => e.referral === "REQUESTED")`) | `lib/data.ts:126-130` | `@@index([referral])` |
| Applied-over-time sort on `entry.updatedAt` | `lib/data.ts:141,148` | `@@index([updatedAt])` on both `Job` and `JobEntry` (today only `Job.createdAt` is indexed) |

**Fix:** add those three indexes in a new migration. Each is cheap at this scale, and with #1.1 above they turn the dashboard into a handful of indexed `GROUP BY`s instead of a table dump.

### 1.4 Verify `DATABASE_URL` is Neon's **pooled** URL on Render — **P1 (config, not code)**

`lib/db.ts:5-11` is a correct singleton — that's fine. The pooling question is purely an env-var question:

- `DATABASE_URL` (used by the app at runtime) **must** point at Neon's pgbouncer endpoint (`...-pooler.neon.tech/...?sslmode=require`).
- `DIRECT_URL` (used by `prisma migrate`) must point at the direct, non-pooled endpoint.

Both are wired into `prisma/schema.prisma:7-8`, so the only failure mode is a misconfigured Render env var. Open the Render dashboard → final-showdown → Environment and confirm the `-pooler` hostname is on `DATABASE_URL`. If not, each request opens a fresh Postgres connection and you will brownout under any real traffic.

### 1.5 GET `/api/jobs` exists but is unused and returns everything — **P2**

`app/api/jobs/route.ts:14-25` returns every job × every entry to anyone logged in, no pagination. The page currently fetches via `lib/data.ts` server-side, so this endpoint is dead weight — but it still responds. Either:

- Delete the handler (and keep GET logic in server components).
- Or keep it, add `?cursor=` + `take` pagination, and lock down to return only fields the client needs.

---

## 2. Real-time / live-refresh

### 2.1 `router.refresh()` on every SSE event is the wrong granularity — **P1**

`lib/use-live-refresh.ts:40,55,77,87` calls `router.refresh()` on every change event. Consequences:

- The jobs page re-fetches every job + every entry on every teammate's status change — 5 users = 5× broadcast of a full page render to everyone.
- **Open dialogs close**, scroll position resets mid-scroll, and `StatusPill`'s `useEffect` at `components/status-pill.tsx:58-60` resets any in-flight optimistic state back to server state — a visible flicker if someone else edits while you're mid-click.
- Keyboard focus is lost (accessibility regression).

**Fix:** switch to payload-driven, surgical updates.

1. Include the changed `jobId` / `entryId` in the `ChangeEvent` (`lib/events.ts:3-7`) — today the payload has no identifiers.
2. In the client, subscribe to events and patch just that row into the `jobs` state array inside `JobsBoard` (the component already has `upsertEntry` / `upsertNote` helpers at `components/jobs-board.tsx:610-641` that would reuse perfectly). Only fall back to `router.refresh()` on deletes or when you don't have the row cached.
3. For deletes / cascades, a minimal refetch via a dedicated `/api/jobs/:id` GET is far cheaper than a page reload.

### 2.2 StatusPill local state can be clobbered mid-save — **P1**

`components/status-pill.tsx:58-60` runs `setLocal({ status, referral, entryId })` on every prop change. If an SSE event arrives between `save()` issuing `fetch` (line 86) and the response returning (line 102), `router.refresh()` → new props → `useEffect` → optimistic value is reset to the stale server state, then the final response overwrites again a moment later. User sees a flicker or the wrong value briefly.

**Fix:** guard the `useEffect` with a "saving" ref — skip the prop-sync when a local save is in flight:

```ts
const savingRef = React.useRef(false);
React.useEffect(() => {
  if (savingRef.current) return;
  setLocal({ status, referral, entryId });
}, [status, referral, entryId]);
```

Set `savingRef.current = true` at the top of `save()`, clear in `finally`.

### 2.3 SSE `onerror` is silent — **P2**

`app/api/events/route.ts` correctly heartbeats every 25 s and the client watchdog (`lib/use-live-refresh.ts:14,96-98`) forces reconnect after 40 s of silence. That's a good design. Two small gaps:

- `es.onerror` (`lib/use-live-refresh.ts:65-68`) only has a comment — consider calling `forceReconnect()` directly so a clear error doesn't wait the full 40 s watchdog window.
- No backoff: if the server is truly down, clients reconnect in tight 250 ms loops (`forceReconnect` at line 74-78). Add exponential backoff capped at ~30 s.

### 2.4 `useLiveRefresh` re-runs when `router` identity changes — **P2**

`lib/use-live-refresh.ts:113` lists `[router, currentUserId]` as deps. The Next.js `router` object is stable in practice but not guaranteed — if a future Next version changes that, this effect will tear down and rebuild the SSE connection on every render. Safer: `[currentUserId]` only, or extract `router.refresh` into a `useCallback`-stable ref.

---

## 3. Security

### 3.1 (Correction to earlier reports) `.env` is NOT committed — ✅ verified

`git ls-files | grep env` returns only `.env.example`. `.gitignore:10` pattern covers `.env`, `.env.local`, `.env.*.local`. **No action needed** — an earlier agent called this CRITICAL; it's not.

### 3.2 No rate-limit / connection cap on `/api/events` — **P1**

`app/api/events/route.ts:7-12` only checks auth. An authenticated user can open N tabs, each holding an SSE connection — every mutation fan-outs to all of them, and the in-process `emitter.setMaxListeners(50)` (`lib/events.ts:17`) only prints a warning at 50+. With 5 allowlisted users this is low risk, but:

- A bug that reconnects in a tight loop on the client will silently blow through the 50 cap.
- A future misconfigured tab or browser extension will do the same.

**Fix:** on connect, track `(userId, connectionCount)` in a small `Map` keyed off the session and reject the 4th+ concurrent connection per user with 429.

### 3.3 No CSRF / same-origin check on custom mutation routes — **P2**

NextAuth v5 protects its own `/api/auth/*` routes. The custom handlers at `app/api/jobs/route.ts:27`, `app/api/jobs/[id]/route.ts:14,47`, and `app/api/entries/route.ts:18` accept authenticated POST/PATCH/DELETE without a same-origin check. Practical attack surface is narrow (browsers CORS-block JSON POSTs from other origins via preflight, and all three routes parse JSON only — `req.json()`), so this is mostly defense-in-depth.

**Fix:** add a tiny middleware that checks `req.headers.get("origin")` / `"referer"` matches `NEXTAUTH_URL` on all non-GET routes. A ~10-line `middleware.ts`.

### 3.4 EXPIRED cascade is auto-applied to other users with no opt-out — **P2 / product decision**

`app/api/entries/route.ts:57-83` — any signed-in user marking EXPIRED flips every teammate with status `NONE` to EXPIRED and creates entries for users who had none. The comment (line 53-56) says this is intentional. Two things worth confirming:

- Should only the job creator (or admin) trigger the cascade? As written, any of the 5 users can cascade-clean any job. For 5 friends this is fine; if the allowlist ever grows, revisit.
- The `createMany` on line 72-80 creates EXPIRED entries even for users who had intentionally no entry yet. That's the intended behavior per the comment — but if a future product rule says "don't auto-create entries", you'll need to split this into "update existing only" + "create only if ≥ N users have already acted".

### 3.5 No response headers (CSP, HSTS, X-Frame-Options) — **P2**

`next.config.mjs:1-14` does not set security headers. Render terminates TLS and sets HSTS at the edge, but CSP and frame-denial are on you.

**Fix:** add a `headers()` block in `next.config.mjs`:

```js
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' https://lh3.googleusercontent.com https://avatars.githubusercontent.com data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self';" },
    ],
  }];
}
```

(Tighten the CSP after testing — Next.js inline scripts may need nonces.)

### 3.6 `Job.addedBy` has no `onDelete` — **P2**

`prisma/schema.prisma:31` — the relation defaults to Prisma's implicit `Restrict`. Today that means you physically cannot delete a user from the DB if they've added any jobs, which is probably *desired* (preserves attribution). Worth stating explicitly:

```prisma
addedBy User @relation("AddedBy", fields: [addedById], references: [id], onDelete: Restrict)
```

Or, if you'd rather allow user deletion and reattribute: make `addedById` nullable and use `onDelete: SetNull`.

### 3.7 Session email comes from JWT, never re-normalized — **P2 (nit)**

`lib/auth.ts:25-29` `isAdminEmail` lowercases on compare, so casing doesn't matter. But `session.user.email` handed to other code paths isn't forced lowercase in the `session` callback (line 83-89). Harmless today; a minute-long fix to normalize it once in the session callback avoids future foot-guns.

---

## 4. Frontend / UX

### 4.1 JobsBoard does full-list filter/sort/group on the client — **P1**

`components/jobs-board.tsx:141-262` runs `filter`, `sort`, then day-bucketing over the full `jobs` array on every filter/search keystroke. Current data is ~1,500 rows so it works (the `useDeferredValue` at line 89 takes most of the sting out), but at 5,000+ or on a phone this gets visibly janky. `visibleCount` paging (line 102) only limits what's *rendered*, not what's *processed*.

**Fix options:**

- **Cheap:** memoize the per-job search text (`searchIndex` at line 114 is already a step toward this) and move filter/sort into a Web Worker via `comlink` if perf becomes an issue.
- **Better:** move filter + sort to the server. Turn `/` into a proper paginated route with `?q=&status=&sort=&cursor=`, do the SQL server-side, stream page-of-200 at a time. Lets you scale past 10K jobs without blinking.
- **If you stay client-side:** add `react-window` / `@tanstack/react-virtual` around the `<ul>` at line 411 so DOM size stays bounded regardless of `visibleCount`.

### 4.2 No `loading.tsx` — **P2**

Neither `app/dashboard/` nor `app/` has a `loading.tsx`. With `force-dynamic` dashboards and a cold Neon connection, users see a blank page for 500 ms–1 s on first visit (worse on Render cold starts).

**Fix:** add `app/dashboard/loading.tsx` and `app/loading.tsx` with skeletons of the KPI row + card outlines. Free perceived-perf win.

### 4.3 Keyboard shortcut `D` fires even while dropdown-select is open — **P2**

`components/jobs-board.tsx:126-139` — the check is `tag === "INPUT" || tag === "TEXTAREA"`. Radix dropdowns render menu items as `<div role="menuitem">`, so typing `d` while a StatusPill dropdown is open (to navigate the menu) will navigate to `/dashboard` and lose the open menu.

**Fix:** also bail out when `document.activeElement?.closest('[role="menu"], [role="dialog"], [contenteditable="true"]')` is truthy.

### 4.4 `handleDelete` uses browser `confirm()` — **P2**

`components/jobs-board.tsx:264-274` uses the native `confirm()` dialog, which looks inconsistent with the rest of the (nicely themed) UI and is awkward on mobile.

**Fix:** use a Radix `AlertDialog` (already have `@radix-ui/react-dialog`), or at least a sonner-based destructive confirm. Same for the EXPIRED cascade — consider a softer warning when marking EXPIRED because the effect is non-local.

### 4.5 `AddJobDialog` keyboard shortcut `N` — verify it's input-guarded — **P2**

Not inspected in this pass; the frontend agent reported the check is consistent but please confirm `components/add-job-dialog.tsx`'s `N` handler uses the same `contenteditable`/`role=menu` guard as recommended in 4.3.

### 4.6 Dark mode contrast audit — **P2**

Several places use `text-muted-foreground` on `bg-muted`-adjacent surfaces (e.g. status pills in `components/status-pill.tsx:119-124`, day-group headers in `components/jobs-board.tsx:384-409`). Run an axe/WAVE pass in dark mode specifically; pills with the "NONE" style in particular can dip below WCAG AA.

### 4.7 Framer Motion on every status change — **P2**

`components/status-pill.tsx:129-149` animates each pill on every status change, keyed off `local.status` / `local.referral`. For a few hundred pills rendered at once (5 users × 200 visible jobs = 1,000 pills), re-mounting motion nodes on live-refresh can cost a frame or two.

**Fix:** wrap `StatusPill` in `React.memo` with custom comparator, and respect `prefers-reduced-motion` (`useReducedMotion()` hook from framer-motion) to skip the scale animation entirely for users who opt out.

---

## 5. Backend / architecture

### 5.1 No error handling on Prisma calls — **P1**

Every route handler (`app/api/jobs/route.ts:50`, `app/api/jobs/[id]/route.ts:39,67`, `app/api/entries/route.ts:37-51, 63-81`) calls Prisma without a try/catch. A unique-violation, connection-exhausted, or migration-drift error propagates as an unhandled 500 with Prisma's internal message visible to the client in dev and silently swallowed in prod.

**Fix:** wrap each handler in a single try/catch, map `Prisma.PrismaClientKnownRequestError` codes to friendly 4xx responses (e.g. `P2002` → 409 with `"field already exists"`), and log the raw error server-side.

### 5.2 No structured logging / observability — **P1**

`lib/db.ts:8` logs at `error` level only, to `console`. There's no request log, no error sink, no SSE connection counter, no per-route timing. When the dashboard feels slow in prod, you have nothing to look at.

**Fix (minimum viable):**

- Add a `lib/log.ts` wrapper that emits `{ ts, route, status, ms, userId }` JSON lines.
- Wrap every route handler (or a small `withLogging(handler)` decorator).
- For free-tier: pipe logs to [Axiom](https://axiom.co/) / [Logtail](https://betterstack.com/logs) via a single HTTP POST.
- Optional: track `emitter.listenerCount("change")` once per minute and log it so you can see SSE connection counts.

### 5.3 `merge-duplicate-user.ts` has no guard against running in prod against wrong DB — **P2**

`scripts/merge-duplicate-user.ts` uses `DIRECT_URL` (which is fine for migrations but also points at the prod DB on Render). The script does accept a `--dry` flag, but there's no second "are you sure?" prompt and no environment check.

**Fix:** add a top-of-file `if (!process.argv.includes("--yes-i-mean-it")) { console.error("..."); process.exit(1); }` guard, and print the target DB URL (host only, masked) before any writes.

### 5.4 `render.yaml` has no health check and is on free plan — **P2**

`render.yaml:5` is `plan: free` — the service will spin down and cold-start. A health check path ensures Render at least notices an unhealthy instance; today there's no `healthCheckPath`.

**Fix:**

- Add a tiny `app/api/health/route.ts` that pings Prisma (`SELECT 1`) and returns 200.
- Add `healthCheckPath: /api/health` to `render.yaml`.
- Longer-term: the $7/month Starter plan kills spin-down and is a bigger user-facing win than any of the above perf fixes combined.

### 5.5 Server actions vs REST — **P2**

You're on App Router with `experimental.serverActions` enabled (`next.config.mjs:9-11`) but mutations still go through `fetch()` to `/api/*` handlers. Not wrong — just inconsistent. If you like the current style, delete the experimental flag; if you want the DX win, migrate `POST /api/jobs`, `PATCH /api/jobs/:id`, `DELETE /api/jobs/:id`, `PATCH /api/entries` to server actions and drop the handlers.

### 5.6 Small tech debt items — **P2**

- `lib/data.ts:74-75` has `void entriesByJob` — left over from a change; `entriesByJob` map is built but never used. Delete it.
- `getDashboardData` filters `>= 100 jobs in a day` / `>= 200 applications` as heuristics for "this is a CSV import" (`lib/data.ts:114, 152`). Works today; consider storing an explicit `source: "CSV" | "USER"` column on `Job` so the heuristic can retire.
- `types/next-auth.d.ts` was mentioned by the security agent but not inspected this pass — confirm `session.user.email` is declared (runtime depends on it at `lib/auth.ts:46-49` et al).

---

## 6. Prioritized punch list

Do in this order; each step unblocks the next.

1. **Add `app/api/health/route.ts` and `healthCheckPath` in `render.yaml`** — 10 min, unblocks everything else.
2. **Verify `DATABASE_URL` on Render points to the Neon pooler** — 2 min (1.4).
3. **Add missing indexes migration** — 15 min (1.3).
4. **Rewrite `getDashboardData` with `groupBy` + SQL `date_trunc`** — 1–2 hr (1.1).
5. **Switch `/api/events` payload to include `{ jobId, entryId }` and make `useLiveRefresh` patch state instead of `router.refresh()`** — 2–3 hr (2.1 + 2.2).
6. **Replace in-memory emitter with Postgres `LISTEN`/`NOTIFY` or Redis pub/sub** — 2–4 hr (1.2).
7. **Wrap all route handlers in try/catch + structured logging** — 1 hr (5.1 + 5.2).
8. **Add `middleware.ts` with origin check + `/api/events` connection cap** — 45 min (3.2 + 3.3).
9. **Add `loading.tsx` files and security headers** — 30 min (4.2 + 3.5).
10. **Everything in §4 and §5 marked P2** — as time allows.

Estimated total for all P0 + P1: ~1 full day. All P2: another 0.5–1 day.

---

## 7. Things the review agents flagged that turned out to be wrong or overstated

Keeping these here so future-you doesn't re-re-investigate:

- **".env committed to repo"** — wrong. `.gitignore:10` covers it, `git ls-files` shows only `.env.example`.
- **"Admin email bypass via casing"** — wrong. `lib/auth.ts:25-29` lowercases both sides of the compare.
- **"SSE can go stale up to 40 s"** — technically true but misleading. The 25 s heartbeat + 40 s watchdog + `visibilitychange`/`online` reconnects give you a median-stale of <1 s; 40 s is only the pessimistic worst case when a network partition outlasts the watchdog window.
- **"Delete is not idempotent"** — returning 404 on the second delete is the correct REST response; no change needed.
- **"Session strategy: JWT lacks rotation"** — for a 5-user allowlisted app this is not a meaningful risk; noting for completeness only.
