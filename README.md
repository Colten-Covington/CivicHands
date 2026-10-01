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
2. Set `ADMIN_EMAILS` to the email address(es) of the first administrator(s).
3. Run `npm install`.
4. Run `npm run db:migrate` (or `npm run db:push` for a throwaway database).
5. Run `npm run dev`, then sign up with an `ADMIN_EMAILS` address. It becomes an administrator only while the deployment has no active administrator; after that, administrators manage roles from `/admin`.

Without `DATABASE_URL`, the home page shows clearly labeled sample reports, accounts are disabled, and the report API returns a service-unavailable response. With a database, only real reports are shown.

For production, configure `DATABASE_URL` in the deployment environment. Vercel runs the Drizzle migrations automatically during production builds when `DATABASE_URL` is set; production builds without it skip migrations and use sample data, and preview builds do not modify the production database. Create the administrator accounts before sharing the site publicly, set `NODE_ENV=production` (secure cookies), and set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` when running more than one instance.

## Roles and workflows

| Who | Can do |
| --- | --- |
| Visitor | Browse the map, read each report's public history, read the transparency log |
| Member (signed in) | Pin reports (10 per day), claim community cleanup, mark claimed work complete, apply to become a vetted helper, accept or decline offers on their own neighbor requests |
| Vetted helper | Everything a member can do, plus offer help on neighbor support requests |
| City official | Manage every report: change status, post public updates, hide or restore reports |
| Administrator | Everything a city official can do, plus vet helpers, revoke helper status, designate city officials and administrators, suspend accounts, and view the full audit log |

- **Community cleanup:** any signed-in member can claim an open report; they can release it or mark it complete.
- **City referral:** volunteers can't claim these; city officials post status changes and public updates.
- **Neighbor support:** only vetted helpers can offer; the requester picks a helper, and only that helper sees the exact location.

## Privacy and the audit trail

Every state change writes an append-only `audit_events` row in the same database batch as the change.

- **Public (`/transparency` and each report's history):** what happened, when, and the actor's role. City officials and administrators act in a public capacity and are named with their title. Residents and helpers are never named.
- **Private (administrators only):** moderation and suspension reasons, helper vetting notes, and which account was affected.
- **Never public:** emails, password hashes, helper applications, offer messages, and exact neighbor-support locations. On the public map and `/api/needs`, neighbor-support pins are rounded to roughly 1 km.

Passwords are hashed with scrypt. Session tokens are random, stored only as SHA-256 hashes, and sent as `httpOnly`, `SameSite=Lax` cookies. Accounts lock for 15 minutes after 5 failed sign-ins, and suspending an account signs it out everywhere.

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
