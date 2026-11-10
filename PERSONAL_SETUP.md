# TinyLink — Personal Daily Setup Guide

Once deployed on Cloudflare Workers, replace `https://url-shortener.your-subdomain.workers.dev` below with your own `*.workers.dev` URL or custom domain.

> **Security Tip:** Keep your actual `ADMIN_TOKEN` secret out of shell histories, screenshots, and git commits. Always use placeholders like `<YOUR_ADMIN_TOKEN>` in shared scripts.

---

## 1. Set or Rotate Your Admin Passphrase

Generate a strong passphrase (16+ random characters) and upload it directly as an encrypted Cloudflare Worker secret:

```bash
cd url-shortener
npx wrangler secret put ADMIN_TOKEN
```

Enter your passphrase when prompted, then unlock your dashboard once in the browser to store it in `localStorage`.

---

## 2. In-App Quick Setup Button

Once unlocked, click the **Keyboard / Shortcuts icon** in the top-right header bar to open **Personal Shortcuts** inside TinyLink. It automatically binds to `window.location.origin` with one-click copy buttons and a draggable bookmarklet.

---

## 3. Desktop Workflows (Windows / Chrome / Edge / Firefox)

### Option A: One-Click Browser Bookmarklet
Create a bookmark named **TinyLink** with this URL (or drag the green button from the in-app **Personal Shortcuts** dialog):

```javascript
javascript:void(window.open('https://url-shortener.your-subdomain.workers.dev/?url='+encodeURIComponent(location.href),'_blank'))
```

Clicking it on any webpage opens TinyLink with that page's URL pre-filled and focuses the alias field so you can press **Enter** immediately.

### Option B: Chrome / Edge Address Bar Shortcut (`tl`)
1. Open `chrome://settings/searchEngines` (or `edge://settings/searchEngines`).
2. Click **Add** under **Site search**:
   - **Name:** `TinyLink`
   - **Shortcut:** `tl`
   - **URL with %s:** `https://url-shortener.your-subdomain.workers.dev/?url=%s`
3. In the address bar, type `tl`, press **Tab** or **Space**, paste any long URL, and press **Enter**.

### Option C: Windows PowerShell CLI Helper (`ctl`)
Add this function to your PowerShell profile (`notepad $PROFILE`) to shorten URLs from any terminal and copy the short link to your clipboard:

```powershell
function ctl {
  param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Url,
    [Parameter(Position = 1)][string]$Slug = "",
    [string]$ExpiresIn = "never",
    [string]$BaseUrl = "https://url-shortener.your-subdomain.workers.dev",
    [string]$Token = $env:TINYLINK_TOKEN
  )
  if (-not $Token) {
    $Token = Read-Host "TinyLink ADMIN_TOKEN"
  }
  $payload = @{ url = $Url; expiresIn = $ExpiresIn }
  if ($Slug) { $payload.custom = $Slug }
  $res = Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/shorten" `
    -Headers @{ "X-Auth-Token" = $Token } `
    -ContentType "application/json" `
    -Body ($payload | ConvertTo-Json)
  $res.shortUrl | Set-Clipboard
  Write-Host "Copied -> $($res.shortUrl)" -ForegroundColor Green
  return $res
}
```

Optionally set your token inside `$PROFILE` (`$env:TINYLINK_TOKEN = "<YOUR_ADMIN_TOKEN>"`), then run:

```powershell
ctl https://github.com/cloudflare/workers-sdk workers
```

---

## 4. Phone Workflows (Android & iOS)

### Android (Chrome — Native Share Target)
1. Open your TinyLink URL in **Chrome on Android** and unlock it once.
2. Open the Chrome menu (`⋮`) → **Install app** (or **Add to Home screen**).
3. TinyLink registers `/manifest.webmanifest` as an OS **Share Target**.
4. Whenever you tap **Share** in Chrome, YouTube, Reddit, or X, choose **TinyLink** to pre-fill the URL automatically.

### iPhone / iPad (Safari)
1. Open your TinyLink URL in Safari and unlock it once.
2. Tap **Share → Add to Home Screen**.
3. You can also call `https://url-shortener.your-subdomain.workers.dev/?url=<Shortcut Input>` via Apple Shortcuts' **Open URLs** action on the iOS Share Sheet.

---

## 5. Dashboard Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `n` | Focus **Destination URL** box to create a new link |
| `/` | Focus **Search** input (`slug` or destination filter) |
| `ArrowLeft` / `ArrowRight` | Switch expiration pills (`Never`, `1d`, `7d`, `30d`, `90d`, `1y`) |
| `Esc` | Close Analytics Inspector or Personal Shortcuts modal |

---

## 6. Reserved Paths & Backups

- Reserved routes blocked from custom slugs: `api`, `health`, `favicon.ico`, `robots.txt`, `manifest.webmanifest`, `icon.svg`, `sw.js`.
- Expired links stay stored so they display **HTTP 410 Link Expired** cleanly and can be renewed inside the Inspector modal (`Edit` → `Expiration`).
- Click **CSV** in the dashboard toolbar anytime to download a local backup spreadsheet of all your links and click counts.

---

## 7. Optional Free Custom Domain (e.g., `go.yourdomain.com`)

If you have a domain on Cloudflare DNS:
1. Cloudflare Dashboard → **Workers & Pages** → **`url-shortener`** → **Settings** → **Domains & Routes**.
2. Click **Add** → **Custom Domain** → enter `go.yourdomain.com`.
3. TinyLink automatically adapts its slug prefix, QR codes, bookmarklet generator, and PWA manifest to your custom domain.
