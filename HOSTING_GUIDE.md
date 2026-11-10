# TinyLink — Hosting & Deployment Guide
URL Shortener on Cloudflare Workers (Free Tier)

**Current version: 2.1** — modular TypeScript codebase with OLED Dark/Light themes, Private Vault auth, SVG/PNG QR Studio, cursor-paginated KV listing, destination + expiry updates, branded 404/410 status pages, and PWA Share Target support.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                     │
│        (Free: 100k req/day, global edge routing)         │
├──────────────────────────────────────────────────────────┤
│  KV Namespace URL_KV (Free: 100k reads/day, 1GB total)   │
│  Stores: originalUrl, timestamps, click counters,        │
│  top referrers, device stats, timeline (<=500 clicks)    │
└──────────────────────────────────────────────────────────┘
```

One Worker serves the JSON API, edge redirects, PWA manifest/icon, dashboard UI, and branded status pages.

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
- `typescript` & `@cloudflare/workers-types` — type checking
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
- To rotate later, run `npx wrangler secret put ADMIN_TOKEN` with a new passphrase.

---

## Step 4 — Verify & Deploy

```bash
npm run check
npx wrangler deploy
```

Live endpoints served automatically:
- `GET /` — Dashboard UI (supports `?url=...` and `?text=...` prefill)
- `GET /:slug` — Edge redirect (`302`), `410` (Expired), or `404` (Not Found)
- `GET /manifest.webmanifest` & `GET /icon.svg` — PWA install & mobile Share Target
- `GET /api/health` — Unauthenticated status ping

---

## Step 5 — Test via `curl`

```bash
BASE="https://url-shortener.your-subdomain.workers.dev"
TOKEN="<YOUR_ADMIN_TOKEN>"

# Create a short link expiring in 7 days
curl -X POST "$BASE/api/shorten" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"url": "https://example.com/long-url", "custom": "demo", "expiresIn": "7"}'

# List all links
curl "$BASE/api/list" -H "X-Auth-Token: $TOKEN"

# Inspect analytics + SVG QR
curl "$BASE/api/analytics/demo" -H "X-Auth-Token: $TOKEN"

# Update destination URL and extend/clear expiry
curl -X PUT "$BASE/api/urls/demo" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"url": "https://example.com/updated", "expiresIn": "never"}'

# Delete permanently
curl -X DELETE "$BASE/api/urls/demo" -H "X-Auth-Token: $TOKEN"
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
| KV Reads | 100,000 / day | Dashboard list uses KV metadata fast-path |
| KV Writes | 1,000 / day | Link creation, edits, and per-click analytics updates |
| KV Storage | 1 GB | Millions of link records |

**Expiration behavior:** Expired links stay stored in KV rather than auto-purging, so **Expired** counts, **HTTP 410** notices, click history, and TTL renewals remain available until you explicitly delete them.

---

## Maintenance & Troubleshooting

| Issue | Resolution |
|-------|------------|
| `TypeScript` check fails | Run `npm run check` and inspect `src/*.ts` |
| Wrong KV ID on deploy | Verify `id` in `wrangler.toml` matches `npx wrangler kv namespace list` |
| Locked out of dashboard | Re-run `npx wrangler secret put ADMIN_TOKEN` |
| Stale wrangler account cache | Delete `.wrangler/` and run `npx wrangler whoami` |
| Redirect target blocked | TinyLink intentionally rejects `localhost`, `127.0.0.1`, `[::1]`, and self-links |
