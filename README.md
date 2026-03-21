# data.rukapay — Executive Analytics Dashboard

Password-protected **Next.js** app for RukaPay executives, styled to match **`rdbs_core_fn`** (Tailwind + HSL design tokens, Geist / Outfit fonts). Charts use **D3.js**. Metrics come from **`rdbs_core/data_service`** (FastAPI) via **server-side proxy** routes — the browser never talks to the data service directly with secrets.

## Prerequisites

- Node 18+
- **Yarn** (Classic **1.x** — this repo uses `yarn.lock`; `packageManager` in `package.json` pins `yarn@1.22.22`)
- Running **`rdbs_core/data_service`** (default `http://localhost:8001`)

## Setup

```bash
cd data.rukapay
cp .env.example .env
# Edit .env: DATA_SERVICE_URL, EXEC_DASH_PASSWORD, SESSION_SECRET
yarn install
yarn dev
```

Open [http://localhost:3002](http://localhost:3002) — you will be redirected to `/login`, then `/dashboard` after sign-in.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATA_SERVICE_URL` | Base URL of the data service (e.g. `http://localhost:8001`) |
| `EXEC_DASH_PASSWORD` | Shared password checked on `POST /api/auth/login` |
| `SESSION_SECRET` | HMAC key for JWT session cookie (`jose`) — use a long random string |

In **production** (`NODE_ENV=production`), session cookies use `Secure` — **HTTPS is required** on `data.rukapay`.

## Auth

- **Login**: `POST /api/auth/login` with JSON `{ "password": "..." }` — sets HTTP-only cookie `exec_session`.
- **Logout**: `POST /api/auth/logout` — clears cookie.
- **Middleware** protects `/dashboard/*`; unauthenticated users are redirected to `/login`.
- **Analytics proxy**: `GET /api/analytics/*` forwards to `{DATA_SERVICE_URL}/analytics/*` after verifying the same session cookie.

No email, no user database, no separate auth microservice.

## Dashboard tabs

The dashboard is split into **Overview**, **Transactions**, **Users**, **Wallets**, and **Merchants**. Each tab has its own date range and any extra controls (granularity, merchant period/sort, etc.). All metrics use **Africa/Kampala** (Kampala) — there is no timezone picker. Data loads when you open a tab; use **Apply** after changing filters.

## Troubleshooting

- **`502` / “Data service unreachable”** — `DATA_SERVICE_URL` in `.env` must point at a running **`rdbs_core/data_service`** (e.g. `http://localhost:8001`). Start the service, then reload the tab and click **Apply**.
- **`500` / SESSION or config errors** — ensure `SESSION_SECRET` and `EXEC_DASH_PASSWORD` are set in `.env` for the Next app.
- **Merchants tab `500` from the data service** — restart **`rdbs_core/data_service`** after pulling the latest code (the `/analytics/merchants/top` query must not use `:limit`/`:offset` bind names, and SQL comments must not contain those tokens—see `analytics_repository.fetch_top_merchants`). Confirm with: `curl -sS "http://localhost:8001/analytics/merchants/top?start_date=2026-01-01&end_date=2026-01-31&timezone=Africa%2FKampala&period=weekly&sort_by=tpv&limit=5&offset=0"` (expect HTTP **200** and JSON).

## Analytics endpoints used

See `rdbs_core/data_service/README.md` and `ANALYTICS_METRICS.md`. The dashboard calls:

- `/analytics/overview`
- `/analytics/transactions/timeseries`
- `/analytics/users/activity`
- `/analytics/wallets/growth`
- `/analytics/merchants/top`
- `/analytics/tpv/by-channel`

## CORS

Because requests go **same-origin** to `/api/analytics`, you typically **do not** need CORS on the data service for this app. If you call the data service from the browser directly (not recommended), configure CORS there.

## Relationship to other repos

- **`rdbs_core_fn`**: Visual reference — `tailwind.config.js` pattern, `globals.css` tokens, shadcn-style UI primitives.
- **`rdbs_core/data_service`**: Sole backend for analytics in this app.

## Scripts

- `yarn dev` — dev server on port **3002**
- `yarn build` / `yarn start` — production
