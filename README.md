# RyannReceipt

Retro thermal-receipt generator and expense/warranty tracker — part of the Ryann Suite.
Full-stack Next.js App Router app; route handlers under `app/api` act as the BFF.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase keys
npm run dev
```

- `/studio` — receipt designer (guest mode, draft persisted to localStorage)
- `GET /api/auth/google/token` — issues a GIS nonce (raw value in an httpOnly cookie, SHA-256 hash returned)
- `POST /api/auth/google/token` — `{ credential }` from GIS → Supabase `signInWithIdToken`, session set in httpOnly cookies

See `ryannreceipt_specification.md` for the architecture and database schema.
