# Final Showdown

A shared job-application tracker for a tight group of friends. Everyone sees everyone's progress, nobody has to fight a spreadsheet, and the dashboard tells you who's actually putting in the work.

Built with Next.js 15 (App Router), Prisma + Postgres (Neon), NextAuth with Google OAuth, Tailwind, shadcn-style UI, Framer Motion, and Recharts. Deployed on Render.

---

## What it does

- **Shared jobs board.** Company, position, link, optional notes. Add once, everyone sees it.
- **Per-user status pill.** Each person has their own status on every job: Applied, Applied (ref), Skipped, Rejected, Expired, Offer, or Not applied. Color-coded so the table reads at a glance.
- **Referral requests.** Mark "requested" and the squad sees it on the dashboard.
- **Invite-only auth.** Google sign-in, restricted to an email allowlist.
- **Dashboard.** KPIs, donut chart of your status mix, stacked bar showdown, 90-day timeline of jobs added, leaderboard, open-referral queue.
- **Admin overrides.** The admin email can edit any row or any status pill — handy when someone forgets to update.
- **CSV seeder.** Idempotent import from the original Google Sheet so launch-day history carries over.
- **Polished UI.** Light/dark/system theme, smooth animations, toasts, keyboard shortcuts, responsive down to mobile.

---

## Quick links

- [Development guide](docs/DEVELOPMENT.md) — run it locally
- [Architecture](docs/ARCHITECTURE.md) — data model, routes, where things live
- [Deployment](docs/DEPLOYMENT.md) — ship it to Render + Neon
- [Seeding](docs/SEEDING.md) — importing and re-importing the CSV
- [Troubleshooting](docs/TROUBLESHOOTING.md) — things that have already gone wrong so you don't repeat them

---

## Stack

| Concern | Tool |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, TypeScript) |
| Database | Postgres on [Neon](https://neon.tech) (free serverless tier) |
| ORM | Prisma 6 |
| Auth | NextAuth / Auth.js v5, Google provider, JWT sessions |
| UI | Tailwind CSS + shadcn-style primitives + lucide-react |
| Animations | Framer Motion |
| Charts | Recharts |
| Theme | next-themes |
| Forms | react-hook-form + zod |
| Toasts | sonner |
| Deploy | Render (web service) |

---

## 60-second setup

```bash
# 1. clone + install
git clone <your-fork-url>
cd FinalShowdown
npm install

# 2. fill in env
cp .env.example .env
# then edit .env — see docs/DEVELOPMENT.md for each variable

# 3. create tables + seed from CSV
npx prisma migrate deploy
npm run seed

# 4. run it
npm run dev
# → http://localhost:3000
```

Sign in with an allowlisted Google account. That's it.

Full walkthrough (including how to set up Neon and Google OAuth): [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## npm scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | `prisma generate` + `next build` for production |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | `prisma migrate deploy` — apply migrations (prod-safe) |
| `npm run db:push` | `prisma db push` — sync schema without a migration (dev only) |
| `npm run seed` | Import `Final Showdown - Applications.csv` into Postgres (idempotent) |

---

## Keyboard shortcuts

- `N` — new job
- `/` — focus search
- `D` — go to dashboard

---

## Who can do what

| Action | Anyone allowlisted | Job creator | Admin (`ADMIN_SEED_EMAIL`) |
| --- | --- | --- | --- |
| View all jobs + statuses | ✅ | ✅ | ✅ |
| Change **own** status / referral | ✅ | ✅ | ✅ |
| Change **someone else's** status | ❌ | ❌ | ✅ |
| Edit a job's fields / notes | ❌ | ✅ | ✅ |
| Delete a job | ❌ | ✅ | ✅ |

---

## Deploying

Short version: push to GitHub → connect to Render via `render.yaml` blueprint → fill in env vars → first deploy runs migrations → seed once from the Render shell.

Step-by-step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## License

Private project for a small group of friends. Not published. No license granted.
