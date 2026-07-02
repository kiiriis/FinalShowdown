# Final Showdown

A shared job-application tracker for a small group of friends racing through the same job hunt. One board everyone edits, per-person tracking on every posting, and a live dashboard that turns the grind into a friendly competition — because the fastest way to send 500 applications is to make it a race.

Built with Next.js 15 (App Router, React 19), Prisma + Postgres, Auth.js v5 with Google OAuth, Tailwind, Framer Motion, and Recharts. Deploys to Render + Neon on free tiers.

## Features

- **Shared jobs board** — company, position, link, notes. Add a posting once, everyone sees it live (server-sent events refresh other tabs). Duplicate links are detected — including tracking-param and trailing-slash variants — and rejected with a "jump to it" shortcut.
- **Per-person tracking on every job** — application status (Applied, Applied with referral, Skipped, Rejected, Expired, Offer), LinkedIn referral state, cold-email state, follow-up reminders after a configurable number of days, and per-user notes.
- **Search, filters, and a date range** — token search across company/position/link/notes, status filters, "someone needs a referral", "nobody applied yet", and a calendar range over the day each job was added.
- **Race-control dashboard** — KPI tiles, status donut, stacked per-user totals, applications-over-time with day/week/month granularity, and the standings: position markers, pace bars scaled to the leader, gold for P1.
- **Message templates** — personal LinkedIn connection-request and referral-ask templates with placeholder substitution (`{{companyName}}`, `{{jobLink}}`, …), one click to copy per job.
- **Invite-only** — Google sign-in restricted to an email allowlist. An admin email can edit or delete anyone's rows.
- **Expired cascade** — when someone marks a posting expired, everyone who hadn't acted on it is auto-marked expired too.
- **Three themes** — Paper (light), Graphite (gray), Carbon (dark), with full `prefers-reduced-motion` support. The visual system is documented in [DESIGN.md](DESIGN.md).
- **CSV import** — migrate your group's existing spreadsheet with an idempotent, column-mapped seeder.

## Quick start

```bash
git clone https://github.com/kiiriis/FinalShowdown.git
cd FinalShowdown
npm install

cp .env.example .env        # then fill it in — see below
npx prisma migrate deploy   # create tables
npm run dev                 # → http://localhost:3000
```

You need:

1. **A Postgres database** — a free [Neon](https://neon.tech) project works; copy the pooled connection string into `DATABASE_URL` and the direct one into `DIRECT_URL`.
2. **Google OAuth credentials** — create an OAuth client at [console.cloud.google.com](https://console.cloud.google.com) with redirect URI `http://localhost:3000/api/auth/callback/google`, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. **A session secret** — `openssl rand -base64 32` into `NEXTAUTH_SECRET`.
4. **Your league** — `ALLOWED_EMAILS` (who can sign in), `USER_DISPLAY_NAMES` (short names for the board), `ADMIN_SEED_EMAIL` (who can edit anything).

Every variable is documented in [.env.example](.env.example) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

### Importing an existing spreadsheet

If your group already tracks applications in a sheet, export it as CSV, copy [seed.config.example.json](seed.config.example.json) to `seed.config.json`, map each person's status/referral columns, and run `npm run seed`. Details and idempotency caveats: [docs/SEEDING.md](docs/SEEDING.md).

## Keyboard shortcuts

`N` — new job · `/` — focus search · `D` — dashboard

## Who can do what

| Action | Anyone allowlisted | Job creator | Admin (`ADMIN_SEED_EMAIL`) |
| --- | --- | --- | --- |
| View all jobs + statuses | ✅ | ✅ | ✅ |
| Change **own** status / referral / notes | ✅ | ✅ | ✅ |
| Change **someone else's** status | ❌ | ❌ | ✅ |
| Edit a job's fields / notes | ❌ | ✅ | ✅ |
| Delete a job | ❌ | ✅ | ✅ |

## npm scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + `next build` |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run db:migrate` | `prisma migrate deploy` — apply migrations (prod-safe) |
| `npm run db:push` | `prisma db push` — sync schema without a migration (dev only) |
| `npm run seed` | Import your CSV per `seed.config.json` (idempotent) |

## Architecture at a glance

```
app/                    Next.js App Router
  (app)/                Authenticated pages: board (/), dashboard, settings
  api/                  Route handlers: jobs, entries, SSE events, auth, health
  login/                Public sign-in page
components/             Board, dialogs, charts, nav + shadcn-style ui/ primitives
lib/                    auth, prisma client, data queries, search, url dedup,
                        status maps, chart palette, motion tokens, SSE bus
prisma/                 Schema + checked-in migrations
scripts/                CSV seeder + maintenance tools
```

Three tables carry everything: `User`, `Job`, and `JobEntry` (one row per person-per-job, `UNIQUE(jobId, userId)`). Reads happen in Server Components; writes go through zod-validated route handlers; a small in-process SSE bus tells other open tabs to refresh. The full picture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

| Doc | What's in it |
| --- | --- |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, every env var, npm scripts, file tree |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data model, request flows, auth, why-these-choices |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Shipping to Render + Neon, health checks, migrations |
| [docs/SEEDING.md](docs/SEEDING.md) | CSV import: config, idempotency, re-seeding safely |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Failure modes that have actually happened |
| [DESIGN.md](DESIGN.md) | The visual system: tokens, themes, type, motion |
| [PRODUCT.md](PRODUCT.md) | Who this is for and the design principles |

## Deploying

Push to GitHub → create a Render blueprint from [render.yaml](render.yaml) → fill in env vars → the first deploy runs migrations → seed once from the Render shell if you're importing a sheet. Step-by-step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Security posture

- Every API route requires a session; sign-in is allowlist-gated (`ALLOWED_EMAILS`).
- Authorization on top of that: users can only modify their own tracking entries; jobs can only be edited/deleted by their creator or the admin.
- All request bodies are zod-validated; notes and templates are length-capped.
- JWT sessions — no session rows in the database. Secrets live only in env vars (`.env` is gitignored; [.env.example](.env.example) is the contract).
- No telemetry, and no third-party calls at runtime beyond Google OAuth and your own database.

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Contributing

It's a small app with an opinionated scope — a private league for a handful of friends. Bug fixes and quality-of-life PRs are welcome; open an issue first for anything bigger. Run `npm run lint` and `npm run build` before submitting.

## License

[MIT](LICENSE)
