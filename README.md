# Final Showdown — Shared Job Tracker

A full-stack web app for 4–5 friends to track job applications together. See who applied, who skipped, and who needs a referral — all on a polished dashboard with charts.

Built with **Next.js 15, Prisma, Postgres, NextAuth (Google), Tailwind, shadcn-style UI, Framer Motion, Recharts**.

---

## What you get

- 🔐 Google sign-in locked to an email allowlist (invite-only)
- 📋 Shared jobs list — everyone's statuses visible, inline-edit your own
- 🏷️ Per-user status pills: Applied / Referred / Skipped / Rejected / Expired / Offer
- 🤝 Referral-request flag so friends can see who needs help
- 📊 Dashboard: KPIs, donut chart, stacked showdown bar, 90-day timeline, leaderboard, referral queue
- 🌓 Light / Dark / System theme, smooth animations, keyboard shortcuts (`N` new job, `/` search, `D` dashboard)
- 🕒 Every job records `addedBy` + `createdAt`
- 📥 One-shot seeder imports your existing CSV (~1500 rows) on first deploy

---

## One-time setup

### 1. Create the Postgres database (Neon — free)

1. Go to [neon.tech](https://neon.tech) → sign in → **Create Project**.
2. Copy two connection strings from the project dashboard:
   - **Pooled** → paste into `DATABASE_URL` below
   - **Direct** (unpooled) → paste into `DIRECT_URL` (used for migrations)

### 2. Create the Google OAuth client

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**.
2. Create Project (or use existing) → **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. **Authorized redirect URIs** — add both:
   ```
   http://localhost:3000/api/auth/callback/google
   https://YOUR-APP-NAME.onrender.com/api/auth/callback/google
   ```
5. Save. Copy the **Client ID** and **Client Secret**.

### 3. Fill in `.env`

```bash
cp .env.example .env
```

Open `.env` and set:

| Key | What to put |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |
| `NEXTAUTH_URL` | `http://localhost:3000` for dev; your Render URL in prod |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | From step 2 |
| `GOOGLE_CLIENT_SECRET` | From step 2 |
| `ALLOWED_EMAILS` | `"you@gmail.com,friend1@...,friend2@...,friend3@..."` |
| `USER_DISPLAY_NAMES` | `"you@gmail.com=Krish,friend1@...=Murtaza,friend2@...=Stavan,friend3@...=Parth"` |
| `ADMIN_SEED_EMAIL` | The email that should own the CSV-imported jobs |

### 4. Install & run locally

```bash
npm install
npx prisma migrate dev --name init    # first time: creates tables
npm run seed                          # imports 1500+ rows from CSV (idempotent)
npm run dev
```

Open <http://localhost:3000>, sign in with an allow-listed Google account.

---

## Deploying to Render

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. On Render: **New → Blueprint** → point at your repo.
3. Render reads `render.yaml` and creates the web service.
4. Fill in each env var in the Render dashboard (same values as your local `.env`, but set `NEXTAUTH_URL` to the Render URL).
5. Go back to Google OAuth → add the Render redirect URI.
6. First deploy will run `prisma migrate deploy` automatically.
7. To seed the CSV, open the Render **Shell** for the service and run:
   ```
   npm run seed
   ```

### Option B — Manual service

- **New → Web Service** from repo
- Build command: `npm install && npx prisma migrate deploy && npm run build`
- Start command: `npm run start`
- Node version: 20
- Paste in env vars from `.env`
- After first deploy, open the Render shell and run `npm run seed`.

> **Render free tier note:** services sleep after 15 min of inactivity. First request after a sleep takes ~30s to wake. That's fine for 5 users; upgrade if you want always-on.

---

## Adding a new friend

1. Add their email to `ALLOWED_EMAILS` in Render env.
2. Optionally add `email=Name` to `USER_DISPLAY_NAMES`.
3. Redeploy (or just **Manual Deploy → Clear cache & deploy**).
4. Tell them to sign in — their user row is auto-created.

---

## Project layout

```
app/                    Next.js App Router pages + API routes
  page.tsx              Jobs list (home)
  dashboard/page.tsx    Charts + leaderboard
  login/page.tsx        Google sign-in
  api/jobs/             CRUD for jobs
  api/entries/          Per-user status upsert
  api/auth/             NextAuth
components/
  ui/                   Primitive components (button, dialog, …)
  charts/               Recharts wrappers
  jobs-board.tsx        Main list with filters + inline editing
  status-pill.tsx       Editable status/referral pill
  add-job-dialog.tsx    Modal form
  nav.tsx               Top nav with theme toggle + user menu
lib/
  auth.ts               NextAuth config + email allowlist
  db.ts                 Prisma client singleton
  data.ts               Server-side queries
  status-maps.ts        Enum → label/style + CSV parsers
prisma/schema.prisma    User / Job / JobEntry models
scripts/seed-from-csv.ts    CSV importer
```

---

## Data model

- **User** — one row per allowlisted friend, identified by email.
- **Job** — a single posting (company, position, link, notes, addedBy, createdAt). Deduped by link.
- **JobEntry** — per `(job, user)` pair: application status + referral request.

Scales from 4 to 50 users without schema change.

---

## Tips

- Keyboard: `N` = new job, `/` = search, `D` = dashboard.
- Dark mode: top-right sun/moon icon.
- You can only delete jobs you added yourself.
- Duplicate-link detection warns if someone tries to re-add a posting.
