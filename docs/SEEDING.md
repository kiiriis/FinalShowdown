# Seeding from the CSV

The repo ships with `Final Showdown - Applications.csv` — the original Google Sheet export. `npm run seed` reads that file and writes `User`, `Job`, and `JobEntry` rows into Postgres.

---

## What the seeder does

1. **Ensures users exist.** Upserts four `User` rows (Krish, Murtaza, Stavan, Parth) using the mapping in `USER_DISPLAY_NAMES`. If a name has no email override, a placeholder `<name>@final-showdown.local` is used — the row will be updated the first time that person signs in with Google.
2. **Ensures the admin user exists.** Upserts `ADMIN_SEED_EMAIL`. Imported jobs are recorded as added by this user.
3. **Parses the CSV.** Headers are assumed to be the originals: `Company`, `Position`, `Link`, `Krish Status`, `Murtaza Status`, `Stavan's Status`, `Parth's Status`, `Krish Referral`, `Murtaza Referral`, `Stavan's Referral Status`, `Parth's Referral`.
4. **For each row:**
   - Finds the `Job` by `link`. If it doesn't exist, creates it.
   - For each user, parses their status + referral columns. If both are effectively empty, skips. Otherwise, **upserts** a `JobEntry`.

---

## Idempotency — exactly what's safe to re-run

- **New rows in the CSV** → added as new Jobs + JobEntries. ✅
- **Existing rows already in the DB** → the Job is matched by link and left alone. The Job's company/position/notes are **not** overwritten by the CSV. ✅
- **Existing JobEntries** → **overwritten** with whatever the CSV says. ⚠️

That last point matters. If Krish updated his status in the UI from "Applied" to "Offer", and the CSV still shows "Applied", re-running the seeder will revert his entry to "Applied".

---

## When to re-seed

| Situation | Re-run `npm run seed`? |
| --- | --- |
| You added a new column of jobs to the sheet and want them in the DB | Yes. |
| You edited statuses in the sheet after the UI went live | ⚠️ Only if the sheet is the source of truth. Otherwise users lose their UI edits. |
| You want to wipe the DB and start fresh | Reset first (see below). |
| You want to just add new jobs without touching existing entries | See [skip-existing-entries patch](#if-you-want-to-only-add-not-overwrite). |

---

## How to re-seed from an updated sheet

1. In Google Sheets, **File → Download → Comma-separated values (.csv)**.
2. Replace `Final Showdown - Applications.csv` in the repo root with the new export. Keep the filename exactly as-is — the seeder hardcodes it.
3. Run:
   ```bash
   npm run seed
   ```
4. Commit the updated CSV if you want the next deploy-time seed to use it.

From Render's shell the same command works.

---

## Resetting and re-seeding (nuclear option)

> This destroys everything in your Neon database. Make sure that's what you want.

```bash
npx prisma migrate reset --force
npm run seed
```

`migrate reset` drops the schema, re-runs migrations, then runs the seed script configured in `prisma.seed` (which we don't have), so we run `npm run seed` explicitly.

---

## If you want to only add, not overwrite

The current seeder does this in `scripts/seed-from-csv.ts`:

```ts
const res = await prisma.jobEntry.upsert({
  where: { jobId_userId: { jobId: job.id, userId: u.id } },
  create: { jobId: job.id, userId: u.id, status, referral },
  update: { status, referral },    // ← overwrites UI edits
});
```

To make the seeder add-only (never touch an existing entry), change the `upsert` to a `create` guarded by an existence check, or swap to `prisma.jobEntry.createMany({ skipDuplicates: true })`. The caveat of `createMany`: it won't populate `referral` on a partially-filled entry, so you'd want to split the logic.

The simplest add-only patch:

```ts
const existing = await prisma.jobEntry.findUnique({
  where: { jobId_userId: { jobId: job.id, userId: u.id } },
});
if (existing) continue;
await prisma.jobEntry.create({
  data: { jobId: job.id, userId: u.id, status, referral },
});
```

Drop that in if you end up needing it; we can't have both behaviors without a flag, and the current project norm is "sheet is the source of truth until the app launches, then the app is."

---

## What happens to the `addedBy` field?

Every Job imported from the CSV is stamped as added by `ADMIN_SEED_EMAIL`. This is a lossy compression — the sheet doesn't record who added each row. If you care about attributing a specific historic job to a specific user, edit the Job manually after seeding.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `CSV not found at …` | Run from repo root. The path is `process.cwd()/Final Showdown - Applications.csv`. |
| `ADMIN_SEED_EMAIL is required…` | `.env` is missing that key, or a shell export is overriding it to empty. |
| `The table public.User does not exist` | Migrations haven't run. Run `npx prisma migrate deploy` first. If you're still hitting this against Neon, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#pgbouncer-cant-see-the-tables-you-just-migrated). |
| Seed runs but the board is empty | Double-check you're connected to the right database. `psql $DIRECT_URL -c 'select count(*) from "Job";'` should return ~1500. |
