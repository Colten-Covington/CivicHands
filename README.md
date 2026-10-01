# CivicHands

CivicHands is a community-care board for reporting local needs, coordinating safe volunteer help, and keeping city-managed hazards visible.

## Principles

- No points, streaks, rankings, or competitive leaderboards.
- Public cleanup and private neighbor assistance are separate workflows.
- Dangerous roadway, utility, tree, and infrastructure issues are referred to the proper city service.
- Exact addresses and sensitive details for neighbor requests are never public.
- Trust comes from verified completion history and community references.

## Local setup

1. Copy `.env.example` to `.env.local` and add a Neon `DATABASE_URL`.
2. Set `ADMIN_EMAILS` to the email address(es) of the first administrator(s). Optionally set `ADMIN_TEMP_PASSWORD` to have their accounts created for you (see [Administrator temporary passwords](#administrator-temporary-passwords)).
3. Run `npm install`.
4. Run `npm run db:migrate` (or `npm run db:push` for a throwaway database; don't later run migrations against a pushed database without baselining it, see [Migration errors](#migration-errors)).
5. Run `npm run dev`, then sign up with an `ADMIN_EMAILS` address (or, with `ADMIN_TEMP_PASSWORD` set, run `npm run db:bootstrap-admins` and sign in with the temporary password). It becomes an administrator only while the deployment has no active administrator; after that, administrators manage roles from `/admin`.

Without `DATABASE_URL`, the home page shows clearly labeled sample reports, accounts are disabled, and the report API returns a service-unavailable response. With a database, only real reports are shown.

The map uses OpenStreetMap street tiles by default, OpenFreeMap vector tiles for 3D buildings, and U.S. Geological Survey imagery for the satellite view. These third-party tile services require a network connection; if a provider is unavailable, switch views or try again later.

For production, configure `DATABASE_URL` in the deployment environment. Vercel runs the Drizzle migrations, then applies `ADMIN_TEMP_PASSWORD` if it's set, automatically during production builds when `DATABASE_URL` is set; production builds without it skip migrations and use sample data, and preview builds do not modify the production database. Create the administrator accounts before sharing the site publicly, set `NODE_ENV=production` (secure cookies), and set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` when running more than one instance.

### Migration errors

`npm run db:migrate` and the Vercel build run `scripts/migrate.mjs`, which prints the database host, the migrations it found, and on failure the underlying Postgres error (code, detail, failing query) with a hint. (`drizzle-kit migrate` hides these behind `exited with 1`.)

If it reports that a type or table **already exists** (codes `42710`/`42P07`), the database schema was created with `db:push` and has no migration history. If that schema matches the current migrations, record them as applied without running them by putting the production `DATABASE_URL` in `.env.local` and running `npm run db:migrate:baseline`, then redeploy. Otherwise, point `DATABASE_URL` at an empty database.

## Roles and workflows

| Who | Can do |
| --- | --- |
| Visitor | Browse the map, read each report's public history, read the transparency log |
| Member (signed in) | Change their password, pin reports (10 per day), claim community cleanup, mark claimed work complete, apply to become a vetted helper, accept or decline offers on their own neighbor requests |
| Vetted helper | Everything a member can do, plus offer help on neighbor support requests |
| City official | Manage every report: change status, post public updates, hide or restore reports |
| Administrator | Everything a city official can do, plus vet helpers, revoke helper status, designate city officials and administrators, suspend accounts, set a new password for another account, clear sign-in lockouts, sign accounts out of all devices, and view and filter the full audit log |

- **Community cleanup:** any signed-in member can claim an open report; they can release it or mark it complete.
- **City referral:** volunteers can't claim these; city officials post status changes and public updates.
- **Neighbor support:** only vetted helpers can offer; the requester picks a helper, and only that helper sees the exact location.

## Privacy and the audit trail

Every state change writes an append-only `audit_events` row in the same database batch as the change.

- **Public (`/transparency` and each report's history):** what happened, when, and the actor's role. City officials and administrators act in a public capacity and are named with their title. Residents and helpers are never named.
- **Private (administrators only):** moderation and suspension reasons, helper vetting notes, and which account was affected.
- **Never public:** emails, password hashes, helper applications, offer messages, and exact neighbor-support locations. On the public map and `/api/needs`, neighbor-support pins are rounded to roughly 1 km.

Passwords are hashed with scrypt. Session tokens are random, stored only as SHA-256 hashes, and sent as `httpOnly`, `SameSite=Lax` cookies. Accounts lock for 15 minutes after 5 failed sign-ins, and suspending an account signs it out everywhere.

### Passwords without email

There is no email-based password reset yet, so:

- **Members** change their own password from **Your account → Password** (requires the current password; other devices are signed out).
- **Administrators** can set a temporary password for any other account, including other administrators, from **Admin → Users & roles → Manage → Set a new password**. They must re-enter their own password; the account is unlocked and signed out everywhere, and the change is recorded in the audit log (the password itself never is). Share it privately.
- **If no administrator can sign in** (for example, the only administrator forgot their password), use `ADMIN_TEMP_PASSWORD` below. Alternatively, someone with database access can put the `DATABASE_URL` in `.env.local` and run `npm run user:set-password -- admin@example.org`, which prompts for the password without echoing it.

Whoever signs in with a temporary password is sent to **Your account → Password** and must choose a new one; until then, administrator and city official tools are paused.

### Administrator temporary passwords

Set `ADMIN_TEMP_PASSWORD` (at least 12 characters) alongside `ADMIN_EMAILS` in the deployment environment (in Vercel, the Production environment), then deploy. During the production build, after migrations, `scripts/bootstrap-admins.mjs` goes through each `ADMIN_EMAILS` address:

| Account | While there's no active administrator | Once an administrator exists |
| --- | --- | --- |
| Doesn't exist | Created as an administrator (display name "Administrator") with the temporary password | Skipped; sign up, then have an administrator grant the role |
| Exists, administrator | Temporary password set | Temporary password set |
| Exists, not an administrator | Promoted and temporary password set | Skipped |
| Suspended | Skipped | Skipped |

Setting the temporary password also clears any sign-in lockout, signs the account out everywhere, and writes a system audit event. The password is never logged.

Each distinct value is applied to an account **once**, even if a later deployment changes the configured value and then rolls back to an earlier one. Later deploys with an already-applied `ADMIN_TEMP_PASSWORD` leave the account alone, so they won't undo the password the administrator chose. To recover a forgotten administrator password, change `ADMIN_TEMP_PASSWORD` to a new value and redeploy. Remove the variable once the administrator has signed in and picked their own password; anyone who can read the deployment's environment variables can sign in as these administrators until then. Locally, run `npm run db:bootstrap-admins`; it reads `.env.local`.

## MVP roadmap

- Email verification and password reset
- Organization verification and in-app messaging between requesters and helpers
- Completion evidence workflows
- Photo uploads with EXIF removal and moderation
- City-service referral adapters and status follow-up
- Private neighbor consent and helper approval
- Business service pledges, background-check policy, and insurance indicators
- Resident abuse reporting and IP-based rate limits
- Geographic search without exposing vulnerable residents' locations
