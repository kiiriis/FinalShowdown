# Troubleshooting

Things that have already gone wrong during development, and how to fix them.

---

## "The wrong database is being used"

### Symptom

- `prisma migrate deploy` reports "No pending migrations".
- `npm run seed` fails with `The table public.User does not exist`.
- The app shows the wrong tables or stale data even though the Neon dashboard looks correct.

### Cause

Shell-exported environment variables override `.env`. If you've ever run:

```bash
export DATABASE_URL="postgresql://…different-project…"
```

in this shell (or in a sourced `.zshrc`), that value wins over whatever is in `.env`, and Prisma silently connects to the wrong database.

### Fix

```bash
echo $DATABASE_URL      # should be empty, OR match .env
echo $DIRECT_URL        # same

# If either prints a value, unset them:
unset DATABASE_URL DIRECT_URL

# Start a fresh terminal if you're unsure what's in your shell history.
```

Then re-run the failing command. Prisma will now read from `.env`.

**Always check `echo $VAR` before suspecting `.env` is wrong.** This has bitten us more than once.

---

## PgBouncer can't see the tables you just migrated

### Symptom

You ran `prisma migrate deploy` successfully (or `migrate reset --force`), verified via `psql $DIRECT_URL` that the tables exist, but `npm run dev` or `npm run seed` still says `The table public.X does not exist`.

### Cause

Neon's pooled endpoint is PgBouncer in transaction mode. After a DDL change, PgBouncer sometimes hands out a connection whose cached catalog doesn't see the new objects yet. It usually resolves on its own in a minute, but not always.

### Fix

Seed or migrate against the direct URL:

```bash
DATABASE_URL="$DIRECT_URL" npm run seed
```

This bypasses PgBouncer entirely. Safe for one-off scripts; don't do it for the running web server (PgBouncer exists for a reason).

---

## Can't click a status pill (no dropdown opens)

### Symptom

Clicking your own status pill does nothing. No dropdown, no console error.

### Cause we've hit

Stale JWT session. If you signed in once with `DATABASE_URL` pointed at the wrong database, your JWT stored a `user.id` that doesn't exist in the correct database. The PATCH request then fails the authz check, but silently (the dropdown itself isn't blocked — something else in the chain is rejecting the user id lookup).

### Fix

Sign out, sign back in.

```text
Top nav → avatar → Sign out
```

If `Sign out` itself is broken (see next section), clear cookies for `localhost:3000`.

---

## Sign out doesn't redirect

### Symptom

Clicking **Sign out** does nothing, or leaves you on the same page with the nav still claiming you're signed in.

### Cause

Older versions used a form POST directly to `/api/auth/signout`, which needs a CSRF token. Current code calls `signOut({ callbackUrl: "/login" })` from `next-auth/react` — make sure `components/nav.tsx` uses that pattern (it does on `main`).

### Fix

If the button is misbehaving on a fork, check `components/nav.tsx` for:

```tsx
import { signOut } from "next-auth/react";
// ...
<DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
  Sign out
</DropdownMenuItem>
```

---

## Google sign-in says "redirect_uri_mismatch"

### Cause

The URL Google is redirecting back to isn't in your OAuth client's allowed list.

### Fix

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), open the OAuth client and make sure **Authorized redirect URIs** includes *exactly*:

```
http://localhost:3000/api/auth/callback/google         (dev)
https://YOUR-APP.onrender.com/api/auth/callback/google (prod)
```

No trailing slash, protocol matches, port matches. Changes take ~1 minute to propagate.

---

## Non-allowlisted email tries to sign in and nothing happens

### Expected behavior

They click "Sign in with Google" → Google shows the consent screen → they pick their account → they're redirected back to `/login` with an `error=AccessDenied` query param.

This is intentional — `callbacks.signIn` in `lib/auth.ts` returns `false` for any email not in `ALLOWED_EMAILS`. The `/login` page surfaces the error message.

### If you want to see a friendlier error

Edit `app/login/page.tsx` to check for `searchParams.error === "AccessDenied"` and show something clearer than the default NextAuth message.

---

## Dashboard Timeline chart is one giant spike and nothing else

### Cause

All ~1500 CSV-imported jobs were inserted with the same `createdAt` (the moment you ran `npm run seed`), so they all land on one day.

### Fix

Already handled — `lib/data.ts` treats any day with 100+ jobs as a "bulk import" and hides it from the chart, while showing a note explaining what was excluded. If you want that threshold tunable, the `100` lives in `getDashboardData()`.

---

## Tailwind classes aren't applying (e.g. "yellow" isn't showing)

### Cause

Tailwind's JIT only scans the files in `tailwind.config.ts → content`. If you add classes in a file whose path isn't listed there, they get purged from the final CSS.

### Fix

Make sure `tailwind.config.ts` includes everywhere you put Tailwind classes. Currently:

```ts
content: [
  "./app/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "./lib/**/*.{ts,tsx}",   // ← needed because lib/status-maps.ts contains class strings
],
```

---

## `prisma migrate dev` fails with "drift detected"

### Cause

Your Neon database has tables that don't match the migration history — usually because someone ran `prisma db push` or changed the schema without creating a migration.

### Fix

If you can lose the local database:

```bash
npx prisma migrate reset --force
```

If the database has real data:

```bash
# introspect what's really there
npx prisma db pull

# manually reconcile schema.prisma with the pulled schema,
# then create a new migration to bring everything back in sync
npx prisma migrate dev --name reconcile_schema_drift
```

---

## Next.js build fails on Render with `prisma: command not found`

### Cause

`prisma` is in `devDependencies`. Render's default build environment installs devDeps during `npm install`, but a customized setup (e.g. `NODE_ENV=production` set at build time) will skip them.

### Fix

Don't set `NODE_ENV=production` during the build — Render sets it for runtime automatically. If you need to force devDep installation:

```yaml
buildCommand: npm install --include=dev && npx prisma migrate deploy && npm run build
```
