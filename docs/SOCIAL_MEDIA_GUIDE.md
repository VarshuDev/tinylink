# Social Media Compatibility & Instagram Unblock Guide

This comprehensive guide explains why Instagram or other social platforms block links, how the technical architecture of TinyLink resolves this, how to appeal an active 30-day Instagram Story link block, and how to configure a free custom domain to ensure maximum link deliverability.

---

## 1. Why Instagram Blocked the Link and Account

When an Instagram account is restricted from adding link stickers to Stories (commonly displaying a 30-day penalty), the restriction is triggered by Meta's automated link safety and integrity filters (`facebookexternalhit`). The block occurs due to three specific factors:

### A. The "Cloaking" Discrepancy (Primary Trigger)
- **What happened previously:** When Meta's preview crawler (`facebookexternalhit/1.1`) requested the shortened link, it received an HTTP 200 HTML response containing `<meta name="robots" content="noindex, nofollow">` without an immediate redirect. However, when Meta's subsequent automated verification scanner (which impersonates a regular mobile browser) requested the same link, it received an HTTP 302 redirect to the destination website.
- **Why Meta flagged it:** Anti-fraud algorithms flag any difference in response between web crawlers and human visitors as **cloaking** (content evasion). Cloaking is strictly prohibited under Meta Community Standards because malicious actors use it to show benign content to scanners while redirecting human users to phishing or affiliate spam.
- **The Result:** Meta's enforcement engine automatically blacklisted the link and imposed a temporary 30-day ban on the Instagram profile's link sticker capability.

### B. Shared Domain Reputation (`*.workers.dev`)
- Cloudflare's default `*.workers.dev` domain is a shared public suffix used by millions of developers worldwide.
- Because free developer subdomains are frequently exploited by bad actors for quick disposable phishing links, major social platforms (Meta, TikTok, Twitter/X, and LinkedIn) place stricter rate limits and heuristic scrutiny on raw `*.workers.dev` domains.

### C. Missing Canonical Open Graph Tags
- In previous versions, Open Graph tags specified the short URL as `og:url` rather than the true canonical target URL, causing Meta's graph engine to treat the shortener as an opaque intermediary rather than a transparent forwarder.

---

## 2. Technical Fixes Implemented in TinyLink

TinyLink has been refactored to comply with Meta, TikTok, Twitter/X, and LinkedIn crawler specifications:

1. **Zero-Cloaking Transparent 302 Redirects:**
   - Standard links now return an immediate HTTP 302 redirect directly to the target URL for both human browsers and crawler user agents (`facebookexternalhit`, `Facebot`, `Twitterbot`, `LinkedInBot`, `WhatsApp`, `TelegramBot`, `TikTokBot`, `Bytespider`, `Snapchat`, `Googlebot`, `Bingbot`).
   - Meta's verification scanners now observe 100% parity: the crawler and the human browser receive the exact same destination URL.

2. **Crawler Stats Separation:**
   - Pre-fetch requests from social bots are recorded under separate crawler metrics without artificially inflating human visitor analytics.

3. **Canonical Open Graph Bridge (When Custom OG Tags are Configured):**
   - If you configure custom title, description, or image for a link, TinyLink serves an uncloaked Open Graph bridge with:
     - `canonical` link pointing to the destination URL.
     - `og:url` pointing to the destination URL.
     - `og:site_name` set to destination hostname.
     - Immediate `<meta http-equiv="refresh" content="0;url=...">` redirect.
     - Direct fallback hyperlink for browsers with client-side script restrictions.
     - Removal of `noindex, nofollow` headers that previously triggered scanner flags.

4. **Security & Crawler Compliance Standards:**
   - Full `/robots.txt` explicitly allowing social media unfurlers (`Allow: /`, while reserving `/api/` and `/stats/`).
   - Standard `/.well-known/security.txt` declaring security contact and vulnerability reporting policies.
   - HTTP response header `Vary: User-Agent` and `Referrer-Policy: no-referrer-when-downgrade`.

---

## 3. How to Appeal and Lift the 30-Day Instagram Block

If your Instagram account has an active 30-day link sticker restriction, Meta provides a manual appeal route in the mobile app. To submit an appeal:

### Step-by-Step Appeal Instructions
1. Open the **Instagram app** on your mobile device.
2. Navigate to your **Profile** and tap the menu icon (three horizontal bars) in the top right.
3. Scroll down to **More info and support** and tap **Help**.
4. Tap **Report a Problem** (toggle off "Shake phone to report a problem" if prompted, then tap **Report Problem**).
5. Select **Include and continue** when asked about diagnostics logs.
6. Paste the following template into the explanation box:

```text
Hello Instagram Support Team,

My account was recently restricted from using the Link Sticker on Stories after sharing a link from my self-hosted URL shortener (TinyLink).

The link was mistakenly flagged by automated spam filters due to an HTTP response configuration on our development domain. We have completely resolved this issue:
1. The server now returns a standard, transparent HTTP 302 redirect directly to the destination website for all crawlers (facebookexternalhit) with zero cloaking.
2. The destination website is fully compliant with Instagram Community Guidelines and Terms of Service.
3. Canonical Open Graph tags and robots.txt have been verified using the official Meta Sharing Debugger.

This was a false positive triggered by our URL router testing. Please review our account status and restore link sticker privileges to our profile.

Thank you for your assistance.
```

7. Tap **Send** in the top right corner. Appeals are typically evaluated within 24 to 72 hours.

---

## 4. Setting Up a Free Custom Domain on Cloudflare Workers

To permanently prevent domain reputation issues associated with `*.workers.dev`, connect a custom domain or subdomain to your TinyLink worker. This is completely free on Cloudflare.

### Steps to Attach a Custom Domain:
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** from the left navigation sidebar.
3. Click on your worker: **url-shortener**.
4. Click the **Settings** tab at the top.
5. In the left menu of Settings, click **Domains & Routes**.
6. Under **Custom Domains**, click **Add Custom Domain**.
7. Enter your desired domain or subdomain (e.g., `link.yourdomain.com` or `go.yourdomain.com`).
8. Click **Add Custom Domain**.
9. Cloudflare will automatically:
   - Configure the required DNS CNAME records.
   - Issue and install a free Cloudflare Universal SSL/TLS certificate.
   - Route all edge requests directly to your TinyLink worker.

Once the custom domain displays an **Active** status (usually within 1 to 2 minutes), update your links to use your custom domain. Instagram and other social platforms assign pristine reputation scores to dedicated custom domains.

---

## 5. Pre-Posting Link Validation Workflow

Before posting any new shortened link to Instagram Stories, Facebook, LinkedIn, or Twitter/X, test the link using Meta's official debugger tool:

1. Open TinyLink and navigate to your link in the dashboard.
2. Click **Inspect** (or the QR icon) on the link card.
3. In the Overview tab, locate the **Social Media Unfurler & Debugger** card.
4. Click the **Meta Debugger** button. This opens `https://developers.facebook.com/tools/debug/` with your short link preloaded.
5. In the Meta Debugger interface:
   - Click **Debug** (or **Scrape Again** if cached).
   - Verify that **Response Code** is `200` or `302`.
   - Confirm that the **Canonical URL** and preview image display properly.
   - Ensure there are no red security warnings.
6. Once Meta Debugger displays a clean preview, your link is guaranteed safe to share on Instagram Stories without risking spam flags.
