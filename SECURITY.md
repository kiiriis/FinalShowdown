# Security Policy

Final Showdown is a small, invite-only app: every route requires an
authenticated session, and sign-in is restricted to an explicit email
allowlist. There is no anonymous surface beyond the login page and the
`/api/health` liveness check.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use
GitHub's [private vulnerability reporting](../../security/advisories/new) on
this repository. Include steps to reproduce and the impact you believe it has.
You should hear back within a week.

## Scope notes for self-hosters

- Keep `NEXTAUTH_SECRET` private and rotate it if it ever leaks — it signs
  every session token.
- `ALLOWED_EMAILS` is the whole access-control story: anyone on that list can
  read the entire board, and the `ADMIN_SEED_EMAIL` account can edit anything.
- The app stores job links, statuses, and free-text notes. Treat your database
  and its backups as containing personal data.
- Dependency hygiene: `npm audit` is expected to be clean; CI-less deploys
  should re-run it before shipping.
