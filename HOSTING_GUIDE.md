# TinyLink — Hosting & Deployment Guide
URL Shortener on Cloudflare Workers (Free Tier)

**Current version: 3.2** — security-hardened modular TypeScript codebase with signed `HttpOnly` cookie sessions, fail-closed `ADMIN_TOKEN`, strict non-inline CSP (`/assets/*.js`), same-origin CORS/CSRF protection, PBKDF2-HMAC-SHA256 link passwords + per-link `429` brute-force lockouts, comprehensive IPv4/IPv6 SSRF protection, Smart Conditional Edge Routing, masked-secret Outgoing Webhooks, OLED Dark/Light themes, burn-after-read click limits, UTM builder, labels/tags, custom OG cards, visitor country tracking, preview-bot filtering, opt-in `/stats/:slug` pages, sanitized SVG/PNG QR Studio, CSV formula-safe export, bulk delete, JSON backup/import, and PWA Service Worker support.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                     │
│        (Free: 100k req/day, global edge routing)         │
├──────────────────────────────────────────────────────────┤
│  KV Namespace URL_KV (Free: 100k reads/day, 1GB total)   │
│  Stores: URLs, labels, tags, click caps, salted hashes,  │
│  countries, referrers, device stats, hourly/daily buckets│
└──────────────────────────────────────────────────────────┘
```

One Worker serves the JSON API, edge redirects, password gates, opt-in public stats, PWA manifest/icon/service-worker, dashboard UI, and branded status pages.

---

## Prerequisites

- A free Cloudflare account ([cloudflare.com](https://cloudflare.com))
- Node.js 18+ (`node -v`)
- Wrangler CLI authenticated (`npx wrangler login`)

---

## Step 1 — Install Dependencies

```bash
cd url-shortener
npm install
```

Packages used:
- `wrangler` — Cloudflare Workers CLI
- `typescript` & `@cloudflare/workers-types` — strict type checking
- `vitest` — automated offline Worker & script test runner
- `qrcode` — SVG QR generation directly inside the Worker

---

## Step 2 — Configure KV Namespace (`URL_KV`)

```bash
npx wrangler kv namespace create URL_KV
```

Copy `wrangler.example.toml` to `wrangler.toml` and paste the returned hex namespace ID:

```toml
[[kv_namespaces]]
binding = "URL_KV"
id = "your-kv-namespace-id"
```

---

## Step 3 — Set an Admin Token (Recommended)

Protect dashboard management and API writes:

```bash
npx wrangler secret put ADMIN_TOKEN
```

- TinyLink **fails closed** (`503`) when `ADMIN_TOKEN` is unset (unless `ALLOW_PUBLIC_ADMIN = "true"` is explicitly configured for local sandboxes).
- When `ADMIN_TOKEN` is **set**, the dashboard opens with **Unlock TinyLink Console** (Private Vault) and exchanges your token via `POST /api/auth/login` for a signed `HttpOnly; SameSite=Strict` session cookie scoped to `/api`. Nothing is stored in `localStorage`.
- API clients and automation scripts authenticate via `X-Auth-Token` or `Authorization: Bearer ...` headers (`?token=` query parameters are rejected).
- Mutating `/api/*` endpoints enforce same-origin `Origin` and `Sec-Fetch-Site` CSRF validation alongside strict non-wildcard CORS (extendable via `ALLOWED_ORIGINS`).
- Repeated failed admin logins or link password unlocks from an IP (`CF-Connecting-IP`) are rate-limited in KV (`rl:*` / `rlpwd:*` keys, HTTP `429` with `Retry-After` after `10` failed attempts in `300s`). Valid authentication resets the failure counter.
- To rotate later, run `npx wrangler secret put ADMIN_TOKEN` with a new passphrase (this immediately invalidates previously signed session cookies).

---

## Step 4 — Verify & Deploy

```bash
npm run check
npm test
npx wrangler deploy
```

Live endpoints served automatically:
- `GET /` — Dashboard UI (supports `?url=...` and `?text=...` prefill)
- `GET /stats/:slug` — Opt-in read-only public analytics page (`404` unless `publicStats: true`)
- `GET /:slug` — Edge redirect (`302`), OG social preview (for known bots), password prompt (`200`), `410` (Expired / Click Limit Reached), `425` (Scheduled / Not Active Yet), or `404` (Not Found)
- `POST /:slug` — Password verification form submission (`303` redirect on match, `401` on mismatch)
- `GET /manifest.webmanifest`, `GET /icon.svg`, & `GET /sw.js` — PWA install, Service Worker shell, & mobile Share Target
- `GET /api/health` — Unauthenticated status ping
- `GET /api/auth/session`, `POST /api/auth/login`, & `POST /api/auth/logout` — Signed `HttpOnly` session lifecycle
- `GET /api/settings/webhooks` & `POST /api/settings/webhooks` — Webhook configuration (returns `hasSecret`, never plaintext secrets)
- `POST /api/settings/webhooks/test` — Instant webhook connectivity probe (`redirect: "manual"`)

---

## Step 5 — Test via `curl`

```bash
BASE="https://url-shortener.your-subdomain.workers.dev"
TOKEN="<YOUR_ADMIN_TOKEN>"

# Create a smart link with geotargeting, device routing, and scheduled activation
curl -X POST "$BASE/api/shorten" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{
    "url": "https://example.com/global",
    "custom": "smart-demo",
    "geoRoutes": { "IN": "https://example.com/india", "GB": "https://example.com/uk" },
    "deviceRoutes": { "ios": "https://apps.apple.com/app/123", "android": "https://play.google.com/store/apps/123" },
    "startsAt": "2026-12-01T00:00:00Z",
    "fallbackUrl": "https://example.com/coming-soon",
    "label": "Smart Global Link"
  }'

# Configure outgoing webhook event stream (Discord, Slack, or generic HTTP)
curl -X POST "$BASE/api/settings/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{
    "url": "https://discord.com/api/webhooks/...",
    "secret": "my-hmac-secret",
    "events": { "onClicked": true, "onLimitReached": true, "onExpired": true },
    "enabled": true
  }'

# Send test ping to verify webhook connectivity
curl -X POST "$BASE/api/settings/webhooks/test" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN"

# List all links
curl "$BASE/api/list" -H "X-Auth-Token: $TOKEN"

# Inspect analytics (countries, botClicks, timeline, devices, referrers, QR SVG)
curl "$BASE/api/analytics/demo" -H "X-Auth-Token: $TOKEN"

# Update destination URL, tags, and clear expiry
curl -X PUT "$BASE/api/urls/demo" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"url": "https://example.com/updated", "expiresIn": "never", "tags": ["updated"]}'

# Bulk delete multiple slugs (max 45 per request)
curl -X POST "$BASE/api/bulk-delete" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"slugs": ["demo"]}'

# Import backup batch (max 20 per request; mode: "skip" or "overwrite")
curl -X POST "$BASE/api/import" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"mode": "skip", "links": [{"slug": "imported", "originalUrl": "https://example.com"}]}'
```

---

## Optional Free Custom Domain

TinyLink automatically reads `window.location.host` and `req.url` host to generate short links without code edits.

1. Open **Cloudflare Dashboard → Workers & Pages → `url-shortener`**.
2. Go to **Settings → Domains & Routes → Add → Custom Domain**.
3. Enter a subdomain on any Cloudflare-managed domain (e.g. `go.yourdomain.com`).
4. Wait ~60 seconds for automatic SSL/DNS provisioning.

---

## Free Tier Quotas & Behavior Notes

| Resource | Free Tier | Notes |
|----------|-----------|-------|
| Worker Requests | 100,000 / day | Redirects, API calls, and HTML loads |
| KV Reads | 100,000 / day | Dashboard list uses KV metadata fast-path (auto-falls back when UTM URLs exceed KV's 1 KB metadata cap) |
| KV Writes | 1,000 / day | Bulk delete caps at `45`/req and JSON import caps at `20`/req to stay well within Cloudflare Free's 50 subrequest limit |
| KV Storage | 1 GB | Millions of link records |

**Expiration & limit behavior:** Expired or exhausted (`maxClicks`) links stay stored in KV rather than auto-purging, so **Expired / Used** counts, **HTTP 410** notices, click history, and renewals remain available until you delete them (individually or via **Select Expired → Delete Selected**).

---

## Maintenance & Troubleshooting

| Issue | Resolution |
|-------|------------|
| `TypeScript` or tests fail | Run `npm run check && npm test` and inspect `src/*.ts` |
| Wrong KV ID on deploy | Verify `id` in `wrangler.toml` matches `npx wrangler kv namespace list` |
| Locked out of dashboard (`429`) | Wait up to `Retry-After` seconds (300s max window) or rotate secret via `npx wrangler secret put ADMIN_TOKEN` |
| Stale wrangler account cache | Delete `.wrangler/` and run `npx wrangler whoami` |
| Redirect target blocked | TinyLink intentionally rejects `localhost`, `127.0.0.1`, `[::1]`, and self-links |
