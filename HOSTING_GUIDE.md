# TinyLink — Hosting & Deployment Guide
URL Shortener on Cloudflare Workers (Free Tier)

**Current version: 3.0** — modular TypeScript codebase with OLED Dark/Light themes, Vault auth + brute-force rate limiting, burn-after-read click limits, salted SHA-256 link passwords, UTM builder, labels/tags, custom OG cards, visitor country tracking, preview-bot filtering, opt-in `/stats/:slug` pages, SVG/PNG QR Studio, bulk delete, JSON backup/import, and PWA Service Worker support.

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

- When `ADMIN_TOKEN` is **set**, the dashboard opens with **Unlock TinyLink Console** (Private Vault) and persists the token in `localStorage` (`tl_admin_token`) until locked.
- Requests send `X-Auth-Token` (also accepts `Authorization: Bearer ...`).
- Repeated failed admin authentication attempts from an IP are temporarily rate-limited in KV (`rl:*` keys, HTTP `429` with `Retry-After` after `10` failed attempts in `300s`). A valid authentication clears the failure counter.
- To rotate later, run `npx wrangler secret put ADMIN_TOKEN` with a new passphrase.

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
- `GET /:slug` — Edge redirect (`302`), OG social preview (for known bots), password prompt (`200`), `410` (Expired / Click Limit Reached), or `404` (Not Found)
- `POST /:slug` — Password verification form submission (`303` redirect on match, `401` on mismatch)
- `GET /manifest.webmanifest`, `GET /icon.svg`, & `GET /sw.js` — PWA install, Service Worker shell, & mobile Share Target
- `GET /api/health` — Unauthenticated status ping

---

## Step 5 — Test via `curl`

```bash
BASE="https://url-shortener.your-subdomain.workers.dev"
TOKEN="<YOUR_ADMIN_TOKEN>"

# Create a tagged short link expiring in 7 days with public stats & max clicks
curl -X POST "$BASE/api/shorten" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{
    "url": "https://example.com/long-url",
    "custom": "demo",
    "expiresIn": "7",
    "label": "Demo Link",
    "tags": ["docs", "launch"],
    "maxClicks": 100,
    "publicStats": true
  }'

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
