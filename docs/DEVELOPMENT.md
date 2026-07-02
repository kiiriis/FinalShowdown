# Development

How to run Final Showdown locally and what every environment variable does.

---

## Prerequisites

- Node 20 or newer (`node -v`)
- npm 10 or newer
- A Neon Postgres project (free tier is plenty)
- A Google Cloud OAuth client

---

## 1. Neon Postgres

1. Sign in at [neon.tech](https://neon.tech) and create a new project (region closest to you is fine).
2. On the project dashboard, find the two connection strings:
   - **Pooled** (PgBouncer, transaction mode) → this goes into `DATABASE_URL`.
   - **Direct** (unpooled) → this goes into `DIRECT_URL`.
3. Both URLs must end with `?sslmode=require`. The pooled one should additionally include `&pgbouncer=true`.

Why two URLs? Prisma runs queries through the pooled endpoint (cheap, scales with serverless), but migrations and introspection need a direct connection.

---

## 2. Google OAuth client

1. [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application.**
3. Authorized redirect URIs (add both, even for local dev):
   ```
   http://localhost:3000/api/auth/callback/google
   https://YOUR-APP.onrender.com/api/auth/callback/google
   ```
4. Save. Copy the **Client ID** and **Client Secret** — you'll paste them into `.env`.

The consent screen can stay in "Testing" mode as long as every allowlisted email is added as a test user.

---

## 3. Fill in `.env`

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable | What to set | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string | Must include `pgbouncer=true&sslmode=require`. |
| `DIRECT_URL` | Neon direct connection string | Used by Prisma for migrations. |
| `NEXTAUTH_URL` | `http://localhost:3000` for dev | In prod, set to the Render URL. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Required — auth breaks silently without it. |
| `GOOGLE_CLIENT_ID` | from Google Cloud | — |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud | — |
| `ALLOWED_EMAILS` | comma-separated emails | Only these can sign in. Case-insensitive. |
| `USER_DISPLAY_NAMES` | `email=Name,email=Name` | Optional. Overrides the Google profile name. |
| `ADMIN_SEED_EMAIL` | one email | Owns CSV-imported jobs **and** gains permission to edit any user's status/job. |

> ⚠️ **Do not `export DATABASE_URL=...` in your shell.** Exported shell vars silently override `.env`. If something feels off, run `echo $DATABASE_URL` in a fresh terminal first. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#the-wrong-database-is-being-used).

---

## 4. Install + migrate + seed + run

```bash
npm install
npx prisma migrate deploy        # apply existing migrations
npm run seed                     # imports ~1500 rows from the CSV (idempotent)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with an allowlisted Google account.

---

## Day-to-day scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server on :3000 with fast refresh. |
| `npm run build` | Production build (`prisma generate` + `next build`). |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npm run db:migrate` | Apply migrations (production-safe). |
| `npm run db:push` | Push schema without creating a migration. **Dev only.** |
| `npm run seed` | Run the CSV seeder. See [SEEDING.md](SEEDING.md). |

---

## Changing the Prisma schema

1. Edit `prisma/schema.prisma`.
2. Create a migration locally:
   ```bash
   npx prisma migrate dev --name short_description
   ```
   This writes the SQL into `prisma/migrations/` **and** applies it to your Neon database.
3. Commit the new migration folder — Render's deploy command runs `prisma migrate deploy` and needs these files in git.

---

## Folder layout

```
app/                     Next.js App Router
  layout.tsx             Theme provider, top nav, toaster
  page.tsx               Jobs board (home)
  dashboard/page.tsx     KPIs, charts, standings, referral queue
  login/page.tsx         Google sign-in
  api/
    auth/[...nextauth]/  NextAuth handler
    jobs/                GET list, POST create
    jobs/[id]/           PATCH / DELETE a job
    entries/             PATCH a (job, user) status entry

components/
  ui/                    shadcn-style primitives (button, dialog, dropdown, …)
  charts/                Recharts wrappers (donut, bar, timeline)
  jobs-board.tsx         Main filterable, sortable list
  status-pill.tsx        Inline status + referral editor
  add-job-dialog.tsx     New-job modal
  edit-job-dialog.tsx    Edit-job modal (creator or admin only)
  nav.tsx                Top bar, user menu, theme toggle
  theme-provider.tsx     Wraps next-themes
  theme-toggle.tsx       Sun/moon switcher

lib/
  auth.ts                NextAuth config, allowlist, `isAdminEmail` helper
  db.ts                  Prisma client singleton (survives hot reload)
  data.ts                Server-side queries for dashboard aggregates
  status-maps.ts         Enum → label + Tailwind class + CSV parsers
  utils.ts               Small helpers (`cn`, `initials`, `formatRelative`)

prisma/
  schema.prisma          User / Job / JobEntry
  migrations/            Checked in — Render runs `migrate deploy` against these

scripts/
  seed-from-csv.ts       Idempotent CSV importer (config in seed.config.json)
  *.ts                   One-off maintenance tools — each has a doc comment

types/
  next-auth.d.ts         Session shape augmentation

seed.config.example.json Template for the CSV importer's column mapping
```

Architecture deep-dive: [ARCHITECTURE.md](ARCHITECTURE.md).
