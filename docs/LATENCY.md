# Latency Diagnosis & Fix Plan

_Date: 2026-04-24 • Problem: 10-12s first page load on Render deployment; DB changes do not feel real-time after load._

Complements `docs/AUDIT.md` — this file is focused specifically on the perceived-latency problem and the prioritized order to fix it.

---

## TL;DR

The Node server is kept warm by UptimeRobot. The **Neon database compute is not**. That, plus every page render doing maximal work with zero caching, is the 10-12s. The "not real-time" feel is the same queries re-running on every SSE event via `router.refresh()`.

Fix Tier 1 (below) and first load drops from 10-12s to 1-2s without touching application code.

---

## Why the first hit takes 10-12 seconds

UptimeRobot keeps the Node process warm. It does **not** keep Neon's compute warm. That's the single biggest misconception about the current setup.

| Layer | Contribution | Evidence |
|---|---|---|
| Neon compute scale-to-zero | **5-10s** (dominant) | Neon suspends compute after ~5min idle. First query after idle pays a full compute cold-boot regardless of how warm Render is. |
| Render free tier | 1-3s | `render.yaml:5` → `plan: free`. Shared CPU/disk. If UptimeRobot's ping cycle > Render's spin-down window, you also pay Node cold-start. |
| No health check / no warmup path | adds to above | `render.yaml` has no `healthCheckPath`. The ping likely hits `/`, which redirects unauthenticated to `/login` — never touches the DB, so Neon stays cold. |
| Every page render is `force-dynamic` | 2-4s | `app/page.tsx:9`, `app/dashboard/page.tsx:21`. Every visit re-runs all queries from scratch, no cache. |
| `auth()` does a DB round-trip | 200-500ms | `lib/auth.ts:71-81` — JWT callback runs `prisma.user.findUnique()` on every request. |
| `getAllJobs()` + `getAllUsers()` pull everything | 1-3s | `lib/data.ts:20-39` — no pagination, fetches every job × every entry (~7,500 rows at current size). |
| `getDashboardData` JS aggregation over that | 1-2s | `lib/data.ts:44-203` — 5+ loops over the full dataset in Node. |

`lib/db.ts:5-11` Prisma singleton is correct; that is not the issue.

---

## Why it doesn't feel real-time after the page loads

SSE wiring itself is fine (`app/api/events/route.ts`, `lib/use-live-refresh.ts`). The problem is what happens when an event arrives:

1. `lib/use-live-refresh.ts:55` calls `router.refresh()`.
2. `router.refresh()` re-renders the server component.
3. Server component re-runs `auth()` + `getAllJobs()` + `getAllUsers()` + (on dashboard) `getDashboardData()`.
4. User waits **2-5 seconds again** — same heavy queries as a fresh page visit.
5. Side effects: open dialogs close, scroll resets, focus is lost, `StatusPill` optimistic state flickers (`components/status-pill.tsx:58-60`).

The UI knows instantly that something changed — but the render step is as slow as a cold page load, because it **is** a cold page load under the hood.

Secondary: `lib/events.ts` in-memory `EventEmitter` does not survive deploys/restarts (AUDIT §1.2) and breaks if Render ever scales to ≥2 instances.

---

## Fix plan — execute in this order

### Tier 1 — biggest wins, minutes of work (NO app-code change)

1. **Disable Neon scale-to-zero** for this project in the Neon console (Settings → Compute). Or: keep it on but point UptimeRobot at a DB-touching endpoint every 2-3 min. Expected impact: **-5 to -10 seconds** on first load.
2. **Add `/api/health`** that does `SELECT 1` via Prisma, set `healthCheckPath: /api/health` in `render.yaml`, and point UptimeRobot at that URL. Keeps BOTH the Node process AND Neon warm.
3. **Verify on Render dashboard** that `DATABASE_URL` uses `...-pooler.c-6.us-east-1.aws.neon.tech` (pooled), not the direct host. If wrong, every query opens a fresh connection.
4. **Upgrade Render to Starter ($7/mo)** — removes spin-down entirely. Biggest perf-per-dollar win.

### Tier 2 — fixes the non-real-time feel (few hours)

5. **Stop calling `router.refresh()` on every SSE event.** Extend `ChangeEvent` in `lib/events.ts:3-7` to include `{ jobId, entryId }`. In `lib/use-live-refresh.ts`, patch the single row into `JobsBoard` state (the component already has `upsertEntry` / `upsertNote` at `components/jobs-board.tsx:610-641`). Only fall back to full refresh on deletes. Updates become instant AND preserve dialogs/scroll/focus.
6. **Rewrite `getDashboardData`** using `prisma.jobEntry.groupBy({ by: ["userId","status"], _count: true })` + raw SQL `date_trunc` for timelines. Pushes O(n) aggregation to Postgres. Removes 1-2s per dashboard load.
7. **Add missing indexes** from AUDIT §1.3 — composite `@@index([jobId, status])`, `@@index([referral])`, `@@index([updatedAt])` on both `Job` and `JobEntry`.
8. **Add `app/loading.tsx` and `app/dashboard/loading.tsx`** skeletons. Doesn't reduce real latency, but masks the remainder.

### Tier 3 — hardening

9. Add `output: "standalone"` to `next.config.mjs` — smaller cold-start footprint.
10. Replace in-memory SSE emitter with Postgres `LISTEN`/`NOTIFY` so SSE survives deploys and future horizontal scaling.

---

## The one-line mental model

> The Node server is warm, but the **database compute is cold**, and the **page has zero caching and does maximal work on every render**.

Fix Neon scale-to-zero + point UptimeRobot at a DB-touching health route, and the 10-12s drops to 1-2s without an application-code change. Then fix `router.refresh()` → surgical state patch to make updates truly real-time.
