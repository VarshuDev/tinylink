<div align="center">

<img src="docs/hero.svg" alt="TinyLink Animated Hero Banner" width="100%" />

<br/><br/>

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20KV-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](#architecture)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#project-structure)
[![PWA Ready](https://img.shields.io/badge/PWA-Share%20Target-22C55E?style=for-the-badge)](#highlights)
[![License: MIT](https://img.shields.io/badge/License-MIT-0F172A?style=for-the-badge)](LICENSE)

**Self-hosted edge URL shortener, instant SVG/PNG QR generator, and click analytics console running entirely inside one Cloudflare Worker at $0/month.**

[Quick Deploy](#quick-deploy-60-seconds) · [Personal Setup Guide](PERSONAL_SETUP.md) · [Hosting & API Reference](HOSTING_GUIDE.md)

</div>

---

## <img src="docs/icons/architecture.svg" width="22" height="22" align="absmiddle" alt="" /> Architecture

<div align="center">
  <img src="docs/architecture.svg" alt="TinyLink Edge Redirect and Telemetry Flow" width="100%" />
</div>

TinyLink serves both the **JSON API** and **OLED Dark / Crisp Light dashboard** from a single Cloudflare Worker backed by **Workers KV**—zero servers, zero cold-start penalties, and no external database setup.

---

## <img src="docs/icons/highlights.svg" width="22" height="22" align="absmiddle" alt="" /> Highlights

| Category | What You Get |
|----------|--------------|
| **Edge Redirects** | Sub-5ms `302` redirects globally, trailing-slash normalization, branded `404` & `410` pages |
| **Custom Aliases & TTL** | Auto 7-char slugs or custom `2–50` char aliases, reserved-slug protection, reversible `1d`–`1y` / `never` expiry |
| **Live Inspector Analytics** | Total clicks, chronological timeline chart, top referrer hostnames, device split (`desktop` / `mobile` / `tablet`) |
| **QR Code Studio** | Crisp high-contrast SVG QR generated per link with 1-click **SVG** & **512px PNG** downloads |
| **Zero-Friction Capture** | `?url=` / `?text=` query prefill, Android **PWA Share Target**, browser bookmarklet, Chrome `tl` omnibox shortcut, PowerShell helper |
| **Private Vault Auth** | Constant-time `ADMIN_TOKEN` verification protecting all management & write APIs |
| **Developer UX** | OLED Dark & Light theme persistence, keyboard shortcuts (`n`, `/`, `Esc`), cursor-paginated KV listing (`>1,000` keys), CSV backup export |

---

## <img src="docs/icons/deploy.svg" width="22" height="22" align="absmiddle" alt="" /> Quick Deploy (60 Seconds)

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/tinylink.git
cd tinylink
npm install
```

### 2. Create Your KV Namespace

```bash
npx wrangler kv namespace create URL_KV
```

Copy `wrangler.example.toml` to `wrangler.toml` (`wrangler.toml` is gitignored so your personal KV ID stays private) and paste your namespace ID:

```bash
cp wrangler.example.toml wrangler.toml
```

```toml
[[kv_namespaces]]
binding = "URL_KV"
id = "your-kv-namespace-id"
```

### 3. Set Your Admin Token

```bash
npx wrangler secret put ADMIN_TOKEN
```

> Always configure a strong `ADMIN_TOKEN` (16+ random characters) in production. Without it, the dashboard runs in open public-console mode for local testing.

### 4. Type Check & Deploy

```bash
npm run check
npx wrangler deploy
```

Your shortener goes live immediately at `https://url-shortener.<your-subdomain>.workers.dev` (or connect any custom domain like `go.yourdomain.com` for free under **Workers & Pages → Custom Domains**).

---

## <img src="docs/icons/structure.svg" width="22" height="22" align="absmiddle" alt="" /> Project Structure

```
url-shortener/
├── docs/
│   ├── hero.svg              # Animated README banner
│   ├── architecture.svg      # Animated edge redirect & telemetry diagram
│   └── icons/                # Vector section icons (SVG)
├── src/
│   ├── index.ts              # Router, auth guard, KV storage, redirect & API handlers
│   ├── frontend.ts           # Server-rendered OLED Dark/Light console, QR studio & shortcuts modal
│   ├── pages.ts              # Branded 404 (Not Found) & 410 (Expired) pages
│   └── types.d.ts            # QRCode TypeScript declarations
├── wrangler.example.toml     # Safe Worker & KV binding template (copy to wrangler.toml)
├── tsconfig.json             # Strict TypeScript config
├── package.json              # Scripts: dev, deploy, tail, check
├── LICENSE                   # MIT License
├── HOSTING_GUIDE.md          # Complete deployment & curl reference
└── PERSONAL_SETUP.md         # Daily bookmarklet, Chrome 'tl' omnibox, PowerShell & mobile PWA guide
```

---

## <img src="docs/icons/api.svg" width="22" height="22" align="absmiddle" alt="" /> API Reference

Protected routes accept `X-Auth-Token: <token>` or `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/health` | No | Lightweight health & auth status check |
| `POST` | `/api/shorten` | Yes | Create short link (`url`, optional `custom`, `expiresIn`) |
| `GET` | `/api/list` | Yes | Cursor-paginated list of all links (`>1,000` KV keys supported) |
| `GET` | `/api/analytics/:slug` | Yes | Timeline, devices, referrers & SVG QR code |
| `PUT` | `/api/urls/:slug` | Yes | Update destination `url` and/or `expiresIn` TTL |
| `DELETE` | `/api/urls/:slug` | Yes | Permanently delete link and telemetry |
| `GET` | `/:slug` | No | Edge redirect (`302`), expired page (`410`), or missing (`404`) |

<details>
<summary><strong>Expand curl request & response examples</strong></summary>

```bash
BASE="https://url-shortener.your-subdomain.workers.dev"
TOKEN="<YOUR_ADMIN_TOKEN>"

# Create a short link expiring in 30 days
curl -X POST "$BASE/api/shorten" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"url": "https://github.com/cloudflare/workers-sdk", "custom": "workers", "expiresIn": "30"}'

# Update destination or clear expiration ("never")
curl -X PUT "$BASE/api/urls/workers" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{"url": "https://developers.cloudflare.com/workers/", "expiresIn": "never"}'
```

</details>

---

## <img src="docs/icons/security.svg" width="22" height="22" align="absmiddle" alt="" /> Development & Security Checklist

- Run `npm run check` (`tsc --noEmit`) before deploying to catch strict TypeScript errors.
- Keep `wrangler.toml`, `.dev.vars`, and `.wrangler/` out of version control (all excluded via [`.gitignore`](.gitignore)).
- Use [`PERSONAL_SETUP.md`](PERSONAL_SETUP.md) to configure Android PWA Share Sheet, browser bookmarklets, Chrome omnibox search, and Windows PowerShell helpers.

---

## <img src="docs/icons/license.svg" width="22" height="22" align="absmiddle" alt="" /> License

Distributed under the [MIT License](LICENSE).
