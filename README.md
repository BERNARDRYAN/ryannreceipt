# RyannReceipt

Retro thermal-receipt generator and expense & warranty tracker, part of the Ryann Suite.
Full-stack Next.js 16 (App Router); route handlers under `app/api` are the BFF.
Deployed to Cloudflare Workers via OpenNext.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase keys
npm run dev
```

Run both SQL files in `supabase/migrations/` (in order) in the Supabase SQL editor.
They only create `receipt_*` objects and are safe to re-run.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest): totals, rounding, mapping, history |
| `npm run test:e2e` | Browser tests (Playwright, drives installed Edge) on :3100 |
| `npm run cf:preview` | Build for Cloudflare and run locally in workerd |
| `npm run cf:deploy` | Build and deploy to Cloudflare Workers |

## Deploying to Cloudflare

1. `npx wrangler login`
2. Build-time public vars come from `.env.local` (they are inlined into the bundle).
3. `npm run cf:deploy` → `https://ryannreceipt.<subdomain>.workers.dev`
4. Add that URL to the Google OAuth client's **Authorized JavaScript origins**.

Rate limiting uses Cloudflare's Rate Limiting bindings (`RL_AUTH`, `RL_WRITE`,
`RL_READ` in `wrangler.jsonc`) on top of an in-memory window.

## Using it

- **Templates**: first visit opens a gallery (Kopitiam, Grocery, Electronics, Ride, Hawker, Blank); later via **New ▾**.
- **Four steps**: Shop → Items → Payment → Look. Click any line on the paper to jump to its field.
- **Looks**: one-click paper/typeface/grain combinations; finer control under *More options*.
- **Shortcuts**: Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z redo, Ctrl/⌘+S export PNG, Ctrl/⌘+P print, Alt+N new, `?` help.
- **Languages**: English, 中文, Bahasa Melayu (Settings ⚙). Light/dark/system theme in the same menu.
- **History**: monthly spend, categories, optional monthly budget, warranty tracker, CSV export.

## Architecture

- **Local-first.** Receipts live in a Zustand store persisted to localStorage
  (`lib/store/receipt-store.ts`). Guests never need an account.
- **Cloud sync.** Signed-in users autosave the open receipt; after sign-in, local
  drafts can be synced in one go. The local uuid is the cloud row id.
- **Auth.** Google Identity Services → `POST /api/auth/google/token` with a
  server-issued nonce → Supabase `signInWithIdToken`. Session cookies are httpOnly.
- **BFF.** `/api/receipts`, `/api/receipts/[id]`, `/api/presets`, `/api/account`:
  same-origin check on writes, rate limits, Zod validation, totals recomputed
  server-side, RLS as the final boundary.
- **Account data deletion** removes RyannReceipt rows only. The Supabase auth user
  is shared with RyannPace/RyannPlan and is never deleted from here.
- **Offline.** `public/sw.js` caches the app shell and static assets; `/api` is never cached.
- **i18n.** `lib/i18n/{en,zh,ms}.ts`; English is the source of truth and the other
  dictionaries are type-checked for missing keys. Printed receipt labels stay English.

See `ryannreceipt_specification.md` for the original specification.
