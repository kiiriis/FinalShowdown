# Deployment

Shipping Final Showdown to [Render](https://render.com) with Postgres on [Neon](https://neon.tech).

---

## Before you start — checklist

- [ ] Repo is on GitHub (Render connects via GitHub).
- [ ] `prisma/migrations/` is committed. (Render runs `prisma migrate deploy`, which needs these files in git.)
- [ ] `Final Showdown - Applications.csv` is committed in the repo root if you want to seed from Render's shell. (It's already there; don't rename it.)
- [ ] You have a Neon project with both **pooled** and **direct** connection strings on hand.
- [ ] Google OAuth client ID/secret ready. If not, see [DEVELOPMENT.md → Google OAuth client](DEVELOPMENT.md#2-google-oauth-client).

---

## Option A — Blueprint deploy (recommended)

The repo contains a `render.yaml` blueprint, so Render can provision the whole service in one click.

1. **Push to GitHub.**
2. **Render → New → Blueprint** → pick the repo.
3. Render reads `render.yaml` and creates a web service named `final-showdown`.
4. Fill in each env var (they're marked `sync: false`, so Render prompts for them):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string |
   | `DIRECT_URL` | Neon direct connection string |
   | `NEXTAUTH_URL` | `https://final-showdown.onrender.com` (your actual Render URL) |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `GOOGLE_CLIENT_ID` | from Google Cloud |
   | `GOOGLE_CLIENT_SECRET` | from Google Cloud |
   | `ALLOWED_EMAILS` | comma-separated |
   | `USER_DISPLAY_NAMES` | optional, `email=Name,…` |
   | `ADMIN_SEED_EMAIL` | the admin's email |

5. **Deploy.** Render will:
   - `npm install`
   - `npx prisma migrate deploy`
   - `npm run build`
   - `npm run start`

6. **Update the Google OAuth redirect URI** to include your Render URL:
   ```
   https://final-showdown.onrender.com/api/auth/callback/google
   ```
   Save in Google Cloud Console.

7. **Seed the database.** Open the Render **Shell** tab for the service and run:
   ```bash
   npm run seed
   ```
   It takes a minute or two. Safe to re-run — the seeder is idempotent.

8. Open the Render URL and sign in.

---

## Option B — Manual web service (no blueprint)

If you'd rather wire it up by hand:

1. **Render → New → Web Service** → connect your GitHub repo.
2. Settings:
   - **Environment:** Node
   - **Build command:** `npm install && npx prisma migrate deploy && npm run build`
   - **Start command:** `npm run start`
   - **Node version:** 20 (set `NODE_VERSION=20` in env vars)
3. Paste in all env vars listed above.
4. Deploy. Update the Google OAuth redirect URI. Seed from the shell.

---

## Updating a running deployment

Pushing to `main` triggers `autoDeploy: true` in `render.yaml`. The build command re-runs, which means:

- New migrations in `prisma/migrations/` are applied automatically.
- The CSV seeder is **not** re-run on deploy (it's not in the build command). To re-seed, run `npm run seed` from the Render shell.

---

## Rotating a compromised secret

1. Regenerate the secret (Google Cloud for OAuth, or `openssl rand -base64 32` for `NEXTAUTH_SECRET`).
2. Update the value in Render → **Environment**.
3. Click **Manual Deploy → Clear build cache & deploy**. Rotating `NEXTAUTH_SECRET` will invalidate all existing sessions, so users will have to sign in again.

---

## Adding a new friend

1. In Render → **Environment**, add their email to `ALLOWED_EMAILS`.
2. Optionally append `email=Name` to `USER_DISPLAY_NAMES`.
3. **Manual Deploy → Deploy latest commit** (env changes trigger a restart but not always a full redeploy; deploying latest forces it).
4. Tell them to sign in — their `User` row is auto-created on first sign-in.

---

## Render free-tier caveats

- Services sleep after ~15 minutes of inactivity. First request after a sleep takes roughly 30 seconds.
- One web service per free workspace at a time.
- If you need always-on, upgrade to the Starter plan.

Neon's free tier never sleeps on the compute you're using through the pooled endpoint — the connection is established on demand.

---

## Rollback

Render keeps a deploy history under the **Events** tab. To roll back:

1. Find the last known-good deploy.
2. Click **Rollback** on that row.

**Be careful if the rolled-back commit doesn't match the current DB schema.** If you ran a migration and then try to roll back to a pre-migration commit, the app will crash because the Prisma client expects columns that no longer match its generated types. In that case, either:

- Forward-fix by deploying a new commit that handles the current schema, or
- Restore the Neon database from a branch snapshot (Neon → your project → **Branches**).

---

## Health-check / sanity script

After any big change, open the deployed site and run through this list:

- [ ] Sign in works with an allowlisted Google account.
- [ ] A non-allowlisted account is rejected.
- [ ] The jobs board renders ~1500 rows without flicker.
- [ ] Clicking your own status pill changes the color after a moment; a hard refresh keeps the change.
- [ ] Clicking someone else's pill does nothing (unless you're admin).
- [ ] Dashboard KPIs are non-zero after seeding.
- [ ] `/api/auth/signout` actually returns you to `/login`.
