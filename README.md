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
2. Run `npm install`.
3. Run `npm run db:push`.
4. Run `npm run dev`.

Without `DATABASE_URL`, the home page uses representative pilot data and the report API returns a service-unavailable response.

## MVP roadmap

- Account and organization verification
- Claim, release, and completion evidence workflows
- Photo uploads with EXIF removal and moderation
- City-service referral adapters and status follow-up
- Private neighbor consent and helper approval
- Business service pledges, background-check policy, and insurance indicators
- Abuse reporting, rate limits, audit history, and administrator tools
- Geographic search without exposing vulnerable residents' locations
