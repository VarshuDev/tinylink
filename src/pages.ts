import type { BioPageData, CtaOverlayConfig, PixelConfig, TimelineBucket } from "./types";

export interface StatusPageOptions {
  status: 404 | 410 | 425;
  codeLabel: string;
  title: string;
  message: string;
  startsAt?: string | null;
}

export interface PixelBridgeOptions {
  slug: string;
  targetUrl: string;
  pixels: PixelConfig;
}

export interface CtaOverlayPageOptions {
  slug: string;
  targetUrl: string;
  config: CtaOverlayConfig;
}

export interface DeepLinkBridgeOptions {
  slug: string;
  app: string;
  scheme: string;
  webUrl: string;
}

export interface PasswordPageOptions {
  slug: string;
  label?: string | null;
  error?: string;
}

export interface PreviewMetaOptions {
  shortUrl: string;
  destinationUrl?: string;
  title: string;
  description: string;
  image?: string | null;
}

export interface PublicStatsPageOptions {
  slug: string;
  shortUrl: string;
  originalUrl: string;
  hasPassword: boolean;
  label: string | null;
  tags: string[];
  clicks: number;
  botClicks: number;
  maxClicks: number | null;
  isExpired: boolean;
  isExhausted: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastClicked: string | null;
  clickTimeline: TimelineBucket[];
  devices: Record<string, number>;
  countries: Record<string, number>;
  qrSvg: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const THEME_INIT_JS = `(function() {
  try {
    var saved = localStorage.getItem('tl_theme');
    var theme = 'dark';
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.getElementById('themeColorMeta');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F8FAFC' : '#090D16');

    var cdEl = document.getElementById('countdownDigits');
    if (cdEl && cdEl.getAttribute('data-starts-at')) {
      var targetTime = new Date(cdEl.getAttribute('data-starts-at')).getTime();
      function updateCd() {
        var diff = targetTime - Date.now();
        if (diff <= 0) {
          cdEl.textContent = '00:00:00';
          setTimeout(function() { window.location.reload(); }, 600);
          return;
        }
        var hrs = Math.floor(diff / 3600000);
        var mins = Math.floor((diff % 3600000) / 60000);
        var secs = Math.floor((diff % 60000) / 1000);
        cdEl.textContent = (hrs < 10 ? '0' : '') + hrs + ':' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
      }
      updateCd();
      setInterval(updateCd, 1000);
    }
  } catch (e) {}
})();`;

export const UNLOCK_PAGE_JS = `(function() {
  var btn = document.getElementById('togglePwdBtn');
  var inp = document.getElementById('linkPassword');
  if (btn && inp) {
    btn.addEventListener('click', function() {
      var isPwd = inp.type === 'password';
      inp.type = isPwd ? 'text' : 'password';
      btn.setAttribute('aria-pressed', isPwd ? 'true' : 'false');
      btn.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
    });
  }
})();`;

export const STATUS_PAGE_JS = `(function() {
  var el = document.getElementById('countdownDigits');
  if (!el) return;
  var targetStr = el.getAttribute('data-starts-at');
  if (!targetStr) return;
  var target = new Date(targetStr).getTime();
  if (isNaN(target)) return;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() {
    var now = Date.now();
    var diff = Math.max(0, target - now);
    if (diff <= 0) {
      el.textContent = '00:00:00 - Launching!';
      setTimeout(function() { window.location.reload(); }, 1200);
      return;
    }
    var hours = Math.floor(diff / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    el.textContent = (hours > 0 ? pad(hours) + ':' : '') + pad(mins) + ':' + pad(secs);
    setTimeout(tick, 1000);
  }
  tick();
})();`;

export const BIO_PAGE_JS = `(function() {
  var form = document.getElementById('bioLeadForm');
  var msg = document.getElementById('bioLeadMsg');
  var btn = document.getElementById('bioLeadBtn');
  var inp = form ? form.querySelector('input[name="email"]') : null;
  if (!form || !msg || !btn || !inp) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var email = (inp.value || '').trim();
    if (!email) return;
    btn.disabled = true;
    var origHtml = btn.innerHTML;
    btn.innerHTML = '<span>Subscribing...</span>';
    msg.textContent = '';
    msg.style.color = '';
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.error || 'Failed to subscribe');
        return data;
      });
    }).then(function(data) {
      msg.textContent = data.message || 'Thank you for subscribing!';
      msg.style.color = 'var(--bio-accent)';
      inp.value = '';
    }).catch(function(err) {
      msg.textContent = err.message || 'Subscription failed. Please try again.';
      msg.style.color = '#EF4444';
    }).finally(function() {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    });
  });
})();`;

export const PIXEL_BRIDGE_JS = `(function() {
  try {
    var cfg = document.getElementById('pixelBridgeConfig');
    if (!cfg) return;

    var fb = cfg.getAttribute('data-fb');
    var ga = cfg.getAttribute('data-ga');
    var tt = cfg.getAttribute('data-tt');
    var li = cfg.getAttribute('data-li');
    var tw = cfg.getAttribute('data-tw');
    var target = cfg.getAttribute('data-target');

    // 1. Meta (Facebook) Pixel
    if (fb) {
      (function(f,b,e,v,n,t,s){
        if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s);
      })(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', fb);
      window.fbq('track', 'PageView');
    }

    // 2. Google Analytics 4
    if (ga) {
      var gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga);
      document.head.appendChild(gaScript);
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', ga);
    }

    // 3. TikTok Pixel
    if (tt) {
      (function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r='https://analytics.tiktok.com/i18n/pixel/events.js',o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var c=document.createElement('script');c.type='text/javascript',c.async=!0,c.src=r+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(c,a)};
        ttq.load(tt);
        ttq.page();
      })(window, document, 'ttq');
    }

    // 4. LinkedIn Partner / Insight
    if (li) {
      window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
      window._linkedin_data_partner_ids.push(li);
      (function(l) {
        if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
        window.lintrk.q=[]}
        var s = document.getElementsByTagName('script')[0];
        var b = document.createElement('script');
        b.type = 'text/javascript';b.async = true;
        b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
        s.parentNode.insertBefore(b, s);
      })(window.lintrk);
    }

    // 5. Twitter / X Pixel
    if (tw) {
      (function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
      },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
      a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))})(window,document,'script');
      window.twq('config', tw);
      window.twq('event', 'PageView');
    }

    // If target is specified (Pixel Bridge redirect), auto-forward after brief delay
    if (target) {
      var countdownEl = document.getElementById('pixelCountdown');
      var secondsLeft = 1;
      if (countdownEl) countdownEl.textContent = String(secondsLeft);

      var timer = setInterval(function() {
        secondsLeft--;
        if (countdownEl) countdownEl.textContent = String(secondsLeft);
        if (secondsLeft <= 0) {
          clearInterval(timer);
          window.location.replace(target);
        }
      }, 700);

      var directBtn = document.getElementById('pixelDirectBtn');
      if (directBtn) {
        directBtn.addEventListener('click', function() {
          clearInterval(timer);
        });
      }
    }
  } catch(e) {}
})();`;

export const CTA_OVERLAY_JS = `(function() {
  var cfgEl = document.getElementById('ctaOverlayConfig');
  var bar = document.getElementById('ctaOverlayBar');
  var btn = document.getElementById('ctaCloseBtn');
  if (bar && btn) {
    btn.addEventListener('click', function() {
      bar.classList.add('hidden');
    });
  }
})();`;

const THEME_INIT_SCRIPT = `<script src="/assets/theme.js"></script>`;

const BASE_THEME_CSS = `
  :root,
  [data-theme="dark"] {
    --bg: #090D16;
    --surface: #111827;
    --surface-2: #1E293B;
    --border: #2A364F;
    --border-subtle: rgba(148, 163, 184, 0.14);
    --text: #F8FAFC;
    --text-muted: #94A3B8;
    --cta: #22C55E;
    --cta-hover: #16A34A;
    --cta-ink: #052E16;
    --link: #38BDF8;
    --link-soft: rgba(56, 189, 248, 0.14);
    --danger: #EF4444;
    --danger-soft: rgba(239, 68, 68, 0.14);
    --warning: #F59E0B;
    --warning-soft: rgba(245, 158, 11, 0.14);
    --accent-soft: rgba(34, 197, 94, 0.14);
    --ring: #38BDF8;
  }
  [data-theme="light"] {
    --bg: #F8FAFC;
    --surface: #FFFFFF;
    --surface-2: #F1F5F9;
    --border: #CBD5E1;
    --border-subtle: rgba(15, 23, 42, 0.08);
    --text: #0F172A;
    --text-muted: #475569;
    --cta: #16A34A;
    --cta-hover: #15803D;
    --cta-ink: #FFFFFF;
    --link: #0284C7;
    --link-soft: rgba(2, 132, 199, 0.12);
    --danger: #DC2626;
    --danger-soft: rgba(220, 38, 38, 0.12);
    --warning: #D97706;
    --warning-soft: rgba(217, 119, 6, 0.12);
    --accent-soft: rgba(22, 163, 74, 0.12);
    --ring: #0284C7;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: 'Fira Code', monospace; }
  .tabular { font-variant-numeric: tabular-nums; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
`;

export function renderStatusPage(opts: StatusPageOptions): string {
  const isExpired = opts.status === 410;
  const isEarly = opts.status === 425;
  const accentColor = isExpired ? "#F59E0B" : (isEarly ? "#38BDF8" : "#EF4444");
  const accentBg = isExpired ? "rgba(245, 158, 11, 0.14)" : (isEarly ? "rgba(56, 189, 248, 0.14)" : "rgba(239, 68, 68, 0.14)");
  const iconSvg = isExpired
    ? `<svg width="28" height="28" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="128" r="96"/><polyline points="128 72 128 128 184 128"/></svg>`
    : (isEarly
        ? `<svg width="28" height="28" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="40" y="40" width="176" height="176" rx="8"/><line x1="176" y1="24" x2="176" y2="56"/><line x1="80" y1="24" x2="80" y2="56"/><line x1="40" y1="88" x2="216" y2="88"/><circle cx="128" cy="148" r="32"/><polyline points="128 132 128 148 144 148"/></svg>`
        : `<svg width="28" height="28" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="112" cy="112" r="80"/><line x1="168.57" y1="168.57" x2="224" y2="224"/><line x1="88" y1="112" x2="136" y2="112"/></svg>`);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)} — TinyLink</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta name="theme-color" id="themeColorMeta" content="#090D16">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${THEME_INIT_SCRIPT}
  <style>
    ${BASE_THEME_CSS}
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 460px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 36px 32px;
      text-align: center;
    }
    .icon-badge {
      width: 56px;
      height: 56px;
      margin: 0 auto 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${accentColor};
      background: ${accentBg};
    }
    .code {
      font-family: 'Fira Code', monospace;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${accentColor};
      margin-bottom: 8px;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
    }
    p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.55;
      margin-bottom: 26px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 22px;
      background: var(--cta);
      color: var(--cta-ink);
      font-weight: 600;
      font-size: 0.92rem;
      border-radius: 10px;
      text-decoration: none;
      transition: background-color 150ms ease;
    }
    .btn:hover { background: var(--cta-hover); }
  </style>
</head>
<body>
  <main class="card">
    <div class="icon-badge">${iconSvg}</div>
    <div class="code">${escapeHtml(opts.codeLabel)}</div>
    <h1>${escapeHtml(opts.title)}</h1>
    <p>${escapeHtml(opts.message)}</p>
    ${opts.startsAt && isEarly ? `
    <div style="margin-bottom:24px;padding:16px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;">
      <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:6px;">Live Countdown to Launch</div>
      <div id="countdownDigits" data-starts-at="${escapeHtml(opts.startsAt)}" style="font-family:'Fira Code',monospace;font-size:1.6rem;font-weight:700;color:var(--accent);letter-spacing:0.05em;">--:--:--</div>
    </div>
    <script src="/assets/status.js"></script>` : ""}
    <a class="btn" href="/">
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="216" y1="128" x2="40" y2="128"/><polyline points="112 56 40 128 112 200"/></svg>
      <span>Return to Dashboard</span>
    </a>
  </main>
</body>
</html>`;
}

export function renderDeepLinkBridgeHtml(opts: DeepLinkBridgeOptions): string {
  const appEsc = escapeHtml(opts.app);
  const schemeEsc = escapeHtml(opts.scheme);
  const webUrlEsc = escapeHtml(opts.webUrl);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="2;url=${webUrlEsc}">
  <title>Opening in ${appEsc}... — TinyLink</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta name="theme-color" id="themeColorMeta" content="#090D16">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${THEME_INIT_SCRIPT}
  <style>
    ${BASE_THEME_CSS}
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 36px 28px;
      text-align: center;
    }
    .app-icon-wrap {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 16px;
      background: var(--accent-soft);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
    }
    .desc {
      font-size: 0.86rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .btn-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 140ms ease;
    }
    .btn-primary {
      background: var(--accent);
      color: var(--accent-ink);
    }
    .btn-secondary {
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text);
    }
    .timer-note {
      font-size: 0.74rem;
      color: var(--text-muted);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="app-icon-wrap">
      <svg width="32" height="32" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="32" y="48" width="192" height="160" rx="16"/><line x1="160" y1="128" x2="96" y2="128"/><polyline points="128 96 160 128 128 160"/></svg>
    </div>
    <h1 class="title">Opening in ${appEsc}...</h1>
    <p class="desc">Launching the ${appEsc} mobile app directly. If the app does not open automatically, tap below to continue.</p>
    <div class="btn-stack">
      <a href="${schemeEsc}" class="btn btn-primary" id="launchAppBtn">Open in ${appEsc} App</a>
      <a href="${webUrlEsc}" class="btn btn-secondary" id="fallbackWebBtn">Continue in Web Browser</a>
    </div>
    <div class="timer-note">Redirecting to web version in 2 seconds...</div>
  </main>
</body>
</html>`;
}

export function renderPixelBridgeHtml(opts: PixelBridgeOptions): string {
  const targetUrlEsc = escapeHtml(opts.targetUrl);
  let domain = "";
  try {
    domain = new URL(opts.targetUrl).hostname;
  } catch {
    domain = opts.targetUrl;
  }
  const domainEsc = escapeHtml(domain);

  const fbAttr = opts.pixels.facebookPixelId ? ` data-fb="${escapeHtml(opts.pixels.facebookPixelId)}"` : "";
  const gaAttr = opts.pixels.googleAnalyticsId ? ` data-ga="${escapeHtml(opts.pixels.googleAnalyticsId)}"` : "";
  const ttAttr = opts.pixels.tiktokPixelId ? ` data-tt="${escapeHtml(opts.pixels.tiktokPixelId)}"` : "";
  const liAttr = opts.pixels.linkedinPartnerId ? ` data-li="${escapeHtml(opts.pixels.linkedinPartnerId)}"` : "";
  const twAttr = opts.pixels.twitterPixelId ? ` data-tw="${escapeHtml(opts.pixels.twitterPixelId)}"` : "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connecting to ${domainEsc} — TinyLink</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta name="theme-color" id="themeColorMeta" content="#090D16">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="refresh" content="2;url=${targetUrlEsc}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${THEME_INIT_SCRIPT}
  <style>
    ${BASE_THEME_CSS}
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .bridge-card {
      width: 100%;
      max-width: 440px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 28px;
      text-align: center;
      box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.4);
    }
    .bridge-spinner-wrap {
      width: 52px;
      height: 52px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .bridge-spinner-ring {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 3px solid var(--border);
      border-top-color: var(--cta);
      animation: bridgeSpin 0.9s linear infinite;
    }
    @keyframes bridgeSpin {
      to { transform: rotate(360deg); }
    }
    .bridge-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 8px;
      letter-spacing: -0.01em;
    }
    .bridge-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .bridge-target-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      padding: 6px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      font-family: 'Fira Code', monospace;
      font-size: 0.82rem;
      color: var(--link);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 24px;
    }
    .bridge-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 44px;
      padding: 0 20px;
      background: var(--cta);
      color: var(--cta-ink);
      border: none;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
      touch-action: manipulation;
    }
    .bridge-btn:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .bridge-note {
      font-size: 0.74rem;
      color: var(--text-muted);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <main class="bridge-card">
    <div class="bridge-spinner-wrap" aria-hidden="true">
      <div class="bridge-spinner-ring"></div>
    </div>
    <h1 class="bridge-title">Connecting You Securely</h1>
    <p class="bridge-desc">Routing you to the destination. Tracking pixels are recording your visit before redirecting.</p>
    <div class="bridge-target-pill" title="${targetUrlEsc}">
      <svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="128" r="96"/><line x1="32" y1="128" x2="224" y2="128"/><ellipse cx="128" cy="128" rx="40" ry="96"/></svg>
      <span>${domainEsc}</span>
    </div>
    <a href="${targetUrlEsc}" class="bridge-btn" id="pixelDirectBtn">Proceed to Destination Now</a>
    <div class="bridge-note">Auto-forwarding in <span id="pixelCountdown">1</span>s...</div>
  </main>
  <div id="pixelBridgeConfig" data-target="${targetUrlEsc}"${fbAttr}${gaAttr}${ttAttr}${liAttr}${twAttr} style="display:none;" aria-hidden="true"></div>
  <script src="/assets/pixel-bridge.js" defer></script>
</body>
</html>`;
}

export function renderCtaOverlayHtml(opts: CtaOverlayPageOptions): string {
  const targetUrlEsc = escapeHtml(opts.targetUrl);
  const bannerTextEsc = escapeHtml(opts.config.bannerText);
  const buttonTextEsc = escapeHtml(opts.config.buttonText);
  const buttonUrlEsc = escapeHtml(opts.config.buttonUrl);
  const avatarHtml = opts.config.avatarUrl
    ? `<img src="${escapeHtml(opts.config.avatarUrl)}" alt="Avatar" class="cta-avatar" />`
    : `<div class="cta-avatar-fallback">TL</div>`;
  const positionClass = opts.config.position === "top" ? "cta-pos-top" : "cta-pos-bottom";
  const themeClass = `cta-theme-${opts.config.theme || "dark"}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>TinyLink Frame</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090D16;
    }
    .cta-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .cta-bar {
      position: fixed;
      left: 16px;
      right: 16px;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 12px 18px;
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
    }
    .cta-pos-bottom { bottom: 16px; }
    .cta-pos-top { top: 16px; }
    .cta-bar.hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px);
    }
    .cta-pos-top.cta-bar.hidden {
      transform: translateY(-20px);
    }
    .cta-theme-dark {
      background: rgba(17, 24, 39, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #F8FAFC;
    }
    .cta-theme-light {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #E2E8F0;
      color: #0F172A;
    }
    .cta-theme-accent {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid #22C55E;
      color: #F0FDF4;
    }
    .cta-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .cta-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid var(--border, #22C55E);
    }
    .cta-avatar-fallback {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #22C55E;
      color: #052E16;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cta-text {
      font-size: 0.88rem;
      font-weight: 500;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .cta-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 18px;
      background: #22C55E;
      color: #052E16;
      border: none;
      border-radius: 9px;
      font-size: 0.86rem;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      transition: opacity 0.15s ease, transform 0.15s ease;
      touch-action: manipulation;
    }
    .cta-btn:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .cta-close-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(148, 163, 184, 0.16);
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s ease;
      touch-action: manipulation;
    }
    .cta-close-btn:hover {
      background: rgba(148, 163, 184, 0.28);
    }
    .cta-direct-link {
      font-size: 0.72rem;
      color: #94A3B8;
      text-decoration: underline;
      margin-left: 4px;
      white-space: nowrap;
    }
    @media (max-width: 540px) {
      .cta-bar {
        left: 8px;
        right: 8px;
        padding: 10px 14px;
      }
      .cta-avatar, .cta-avatar-fallback {
        width: 34px;
        height: 34px;
      }
      .cta-text { font-size: 0.8rem; }
      .cta-btn { min-height: 36px; padding: 0 12px; font-size: 0.8rem; }
    }
  </style>
</head>
<body>
  <iframe src="${targetUrlEsc}" class="cta-iframe" title="Content Frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  <script id="ctaOverlayConfig" type="application/json">${JSON.stringify(opts.config)}</script>
  <aside class="cta-bar ${positionClass} ${themeClass}" id="ctaOverlayBar" role="complementary" aria-label="Call to Action Banner">
    <div class="cta-left">
      ${avatarHtml}
      <div class="cta-text">
        <span>${bannerTextEsc}</span>
        <a href="${targetUrlEsc}" class="cta-direct-link" target="_top">Open site directly</a>
      </div>
    </div>
    <div class="cta-actions">
      <a href="${buttonUrlEsc}" target="_blank" rel="noopener noreferrer" class="cta-btn">${buttonTextEsc}</a>
      <button type="button" class="cta-close-btn" id="ctaCloseBtn" aria-label="Dismiss banner">
        <svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="200" y1="56" x2="56" y2="200"/><line x1="200" y1="200" x2="56" y2="56"/></svg>
      </button>
    </div>
  </aside>
  <script src="/assets/cta-overlay.js"></script>
</body>
</html>`;
}

export function renderPasswordPage(opts: PasswordPageOptions): string {
  const slugEsc = escapeHtml(opts.slug);
  const labelHtml = opts.label
    ? `<div class="note-pill">${escapeHtml(opts.label)}</div>`
    : "";
  const errorHtml = opts.error
    ? `<div class="alert-box" role="alert">
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="128" r="96"/><line x1="128" y1="80" x2="128" y2="136"/><circle cx="128" cy="172" r="8" fill="currentColor"/></svg>
        <span>${escapeHtml(opts.error)}</span>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unlock /${slugEsc} — TinyLink</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta name="theme-color" id="themeColorMeta" content="#090D16">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${THEME_INIT_SCRIPT}
  <style>
    ${BASE_THEME_CSS}
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 28px;
    }
    .icon-badge {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--link-soft);
      color: var(--link);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .slug-badge {
      display: inline-block;
      font-family: 'Fira Code', monospace;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 6px;
      background: var(--link-soft);
      color: var(--link);
      margin-bottom: 10px;
    }
    .note-pill {
      font-size: 0.84rem;
      color: var(--text);
      font-weight: 600;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }
    .desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
    .alert-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 11px 14px;
      border-radius: 8px;
      background: var(--danger-soft);
      border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
      color: var(--danger);
      font-size: 0.85rem;
      margin-bottom: 14px;
    }
    .alert-box svg { flex-shrink: 0; margin-top: 2px; }
    .input-wrap { position: relative; display: flex; align-items: center; margin-bottom: 14px; }
    .input-field {
      width: 100%;
      min-height: 44px;
      padding: 10px 44px 10px 14px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: 'Fira Code', monospace;
      font-size: 0.92rem;
    }
    .input-field:focus {
      outline: none;
      border-color: var(--ring);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
    }
    .toggle-btn {
      position: absolute;
      right: 4px;
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .toggle-btn:hover { color: var(--text); }
    .btn {
      width: 100%;
      min-height: 44px;
      border: none;
      border-radius: 8px;
      background: var(--cta);
      color: var(--cta-ink);
      font-family: inherit;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background-color 150ms ease;
    }
    .btn:hover { background: var(--cta-hover); }
  </style>
</head>
<body>
  <main class="card">
    <div class="icon-badge" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="40" y="88" width="176" height="128" rx="8"/><path d="M92,88V52a36,36,0,0,1,72,0V88"/><circle cx="128" cy="152" r="12"/></svg>
    </div>
    <span class="slug-badge">/${slugEsc}</span>
    ${labelHtml}
    <h1>Protected Link</h1>
    <p class="desc">Enter the link password to continue to the destination.</p>
    ${errorHtml}
    <form method="POST" action="/${encodeURIComponent(opts.slug)}">
      <div class="input-wrap">
        <label for="linkPassword" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">Link password</label>
        <input type="password" id="linkPassword" name="password" class="input-field" placeholder="Enter password..." required autofocus autocomplete="off">
        <button type="button" class="toggle-btn" id="togglePwdBtn" aria-label="Show password" aria-pressed="false">
          <svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Z"/><circle cx="128" cy="128" r="32"/></svg>
        </button>
      </div>
      <button type="submit" class="btn">
        <span>Continue to Destination</span>
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="40" y1="128" x2="216" y2="128"/><polyline points="144 56 216 128 144 200"/></svg>
      </button>
    </form>
  </main>
  <script src="/assets/unlock.js" defer></script>
</body>
</html>`;
}

export function renderPreviewMetaPage(opts: PreviewMetaOptions): string {
  const titleEsc = escapeHtml(opts.title);
  const descEsc = escapeHtml(opts.description);
  const targetUrl = opts.destinationUrl || opts.shortUrl;
  const targetUrlEsc = escapeHtml(targetUrl);
  const isDirect = targetUrl !== opts.shortUrl;

  const refreshMeta = isDirect
    ? `<meta http-equiv="refresh" content="0;url=${targetUrlEsc}">`
    : "";
  const canonicalLink = isDirect
    ? `<link rel="canonical" href="${targetUrlEsc}">`
    : "";
  const imgMeta = opts.image
    ? `<meta property="og:image" content="${escapeHtml(opts.image)}">\n  <meta name="twitter:image" content="${escapeHtml(opts.image)}">`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleEsc}</title>
  <meta name="description" content="${descEsc}">
  ${canonicalLink}
  <meta property="og:site_name" content="TinyLink">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${titleEsc}">
  <meta property="og:description" content="${descEsc}">
  <meta property="og:url" content="${targetUrlEsc}">
  ${imgMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${titleEsc}">
  <meta name="twitter:description" content="${descEsc}">
  ${refreshMeta}
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090D16;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #111827;
      border: 1px solid #2A364F;
      border-radius: 14px;
      padding: 32px 28px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: #F8FAFC; line-height: 1.3; }
    p { font-size: 0.9rem; color: #94A3B8; margin-bottom: 22px; line-height: 1.5; word-break: break-word; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      background: #22C55E;
      color: #052E16;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.88rem;
      transition: background-color 150ms ease;
    }
    .btn:hover { background: #16A34A; }
    .sub { font-size: 0.74rem; color: #64748B; margin-top: 16px; margin-bottom: 0; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${titleEsc}</h1>
    <p>${descEsc}</p>
    <a class="btn" href="${targetUrlEsc}">Continue to destination &rarr;</a>
    <p class="sub">Shared via TinyLink</p>
  </main>
</body>
</html>`;
}

function fmtDateUtc(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildPublicTimelineSvg(timeline: TimelineBucket[]): string {
  if (!timeline || !timeline.length) {
    return `<div class="chart-empty">No clicks recorded yet.</div>`;
  }
  const W = 540, H = 136, padL = 28, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxCount = Math.max(1, ...timeline.map((t) => t.count));
  const step = plotW / timeline.length;
  const barW = Math.max(8, Math.min(34, step * 0.65));

  const grid = [0, 0.5, 1]
    .map((ratio) => {
      const y = (padT + plotH - ratio * plotH).toFixed(1);
      const val = Math.round(maxCount * ratio);
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 3" stroke-width="1"/><text x="${padL - 6}" y="${(Number(y) + 3).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="Fira Code, monospace">${val}</text>`;
    })
    .join("");

  const bars = timeline
    .map((t, idx) => {
      const h = Math.max(4, (t.count / maxCount) * plotH);
      const x = (padL + idx * step + (step - barW) / 2).toFixed(1);
      const y = (padT + plotH - h).toFixed(1);
      const lbl = escapeHtml(t.label);
      return `<g><rect x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="var(--link)"/><text x="${(Number(x) + barW / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="Fira Code, monospace">${lbl}</text></g>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;" role="img" aria-label="Click timeline">${grid}${bars}</svg>`;
}

function buildBreakdownList(record: Record<string, number>, emptyMsg: string): string {
  const items = Object.entries(record || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!items.length) return `<p class="muted-sm">${escapeHtml(emptyMsg)}</p>`;
  const maxVal = items[0][1] || 1;
  return `<div class="bar-list">${items
    .map(([name, count]) => {
      const pct = Math.round((count / maxVal) * 100);
      return `<div><div class="bar-row"><span>${escapeHtml(name)}</span><span class="mono tabular">${count.toLocaleString()}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
    })
    .join("")}</div>`;
}

export function renderPublicStatsPage(opts: PublicStatsPageOptions): string {
  const slugEsc = escapeHtml(opts.slug);
  const shortEsc = escapeHtml(opts.shortUrl);
  const destDisplay = opts.hasPassword
    ? "Protected destination (password required)"
    : escapeHtml(opts.originalUrl);

  const statusText = opts.isExhausted ? "Exhausted" : opts.isExpired ? "Expired" : "Active";
  const statusClass = opts.isExhausted || opts.isExpired ? "pill-danger" : "pill-ok";
  const tagsHtml = opts.tags.length
    ? `<div class="tag-row">${opts.tags.map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join("")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stats /${slugEsc} — TinyLink</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta name="theme-color" id="themeColorMeta" content="#090D16">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${THEME_INIT_SCRIPT}
  <style>
    ${BASE_THEME_CSS}
    .wrap { max-width: 780px; margin: 0 auto; padding: 28px 18px 48px; display: flex; flex-direction: column; gap: 16px; }
    .head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .brand { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; color: var(--text); font-family: 'Fira Code', monospace; font-weight: 700; font-size: 1rem; }
    .brand-mark { width: 28px; height: 28px; border-radius: 7px; background: var(--accent-soft); border: 1px solid rgba(34, 197, 94, 0.3); display: inline-flex; align-items: center; justify-content: center; color: var(--cta); }
    .badge { font-size: 0.72rem; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 18px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03); }
    .hero-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .slug-title { font-family: 'Fira Code', monospace; font-size: 1.25rem; font-weight: 700; color: var(--link); text-decoration: none; }
    .slug-title:hover { text-decoration: underline; }
    .pill-ok { background: var(--accent-soft); color: var(--cta); padding: 4px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .pill-danger { background: var(--danger-soft); color: var(--danger); padding: 4px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .dest-box { padding: 11px 13px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; font-family: 'Fira Code', monospace; font-size: 0.8rem; color: var(--text-muted); word-break: break-all; }
    .tag-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag-chip { font-family: 'Fira Code', monospace; font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; background: var(--link-soft); color: var(--link); }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .kpi { background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 12px 14px; }
    .kpi-lbl { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 4px; }
    .kpi-val { font-family: 'Fira Code', monospace; font-size: 1.1rem; font-weight: 700; }
    .chart-box { background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; }
    .chart-empty { text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 18px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sec-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; }
    .bar-list { display: flex; flex-direction: column; gap: 8px; }
    .bar-row { display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 3px; }
    .bar-track { height: 4px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
    .bar-fill { height: 100%; background: var(--link); border-radius: 999px; }
    .muted-sm { font-size: 0.82rem; color: var(--text-muted); }
    .qr-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid var(--border-subtle); }
    .qr-box { width: 96px; height: 96px; background: #FFF; padding: 6px; border-radius: 8px; flex-shrink: 0; border: 1px solid var(--border); }
    .qr-box svg { width: 100%; height: 100%; display: block; }
    @media (max-width: 720px) {
      .wrap { padding: 18px 14px 36px; }
      .card { padding: 16px; }
      .kpis { grid-template-columns: repeat(2, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="head">
      <a href="/" class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M122.34,71.43l29.38-29.37a44,44,0,0,1,62.22,62.22l-41.37,41.38a44,44,0,0,1-62.23,0"/><path d="M133.66,184.57l-29.38,29.37a44,44,0,0,1-62.22-62.22l41.37-41.38a44,44,0,0,1,62.23,0"/></svg>
        </span>
        <span>TinyLink</span>
      </a>
      <span class="badge">Public Link Telemetry (Read-Only)</span>
    </header>
    <main class="card">
      <div class="hero-row">
        <div>
          <a href="/${slugEsc}" class="slug-title">/${slugEsc}</a>
          ${opts.label ? `<div style="font-weight:600;margin-top:4px;">${escapeHtml(opts.label)}</div>` : ""}
        </div>
        <span class="${statusClass}">${statusText}</span>
      </div>
      ${tagsHtml}
      <div class="dest-box">${destDisplay}</div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-lbl">Human Clicks</div><div class="kpi-val tabular" style="color:var(--cta)">${opts.clicks.toLocaleString()}${opts.maxClicks ? ` / ${opts.maxClicks}` : ""}</div></div>
        <div class="kpi"><div class="kpi-lbl">Bots Filtered</div><div class="kpi-val tabular">${opts.botClicks.toLocaleString()}</div></div>
        <div class="kpi"><div class="kpi-lbl">Created</div><div class="kpi-val" style="font-size:0.86rem;">${fmtDateUtc(opts.createdAt)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Expires</div><div class="kpi-val" style="font-size:0.86rem;">${fmtDateUtc(opts.expiresAt)}</div></div>
      </div>
      <div>
        <div class="sec-title">Click Timeline</div>
        <div class="chart-box">${buildPublicTimelineSvg(opts.clickTimeline)}</div>
      </div>
      <div class="grid-2">
        <div><div class="sec-title">Devices</div>${buildBreakdownList(opts.devices, "No device data yet.")}</div>
        <div><div class="sec-title">Top Countries</div>${buildBreakdownList(opts.countries, "No country data yet.")}</div>
      </div>
      <div class="qr-row">
        <div class="qr-box">${opts.qrSvg}</div>
        <div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Shareable Short URL</div>
          <div class="mono" style="font-size:0.85rem;color:var(--link);word-break:break-all;">${shortEsc}</div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;
}

// ── Link-in-Bio & Social Profile Page Renderer ──

const BIO_ICONS: Record<string, string> = {
  globe: '<svg width="18" height="18" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="128" cy="128" r="96"/><line x1="32" y1="128" x2="224" y2="128"/><ellipse cx="128" cy="128" rx="40" ry="96"/></svg>',
  github: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
  twitter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  instagram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  youtube: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  linkedin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
  email: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  discord: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
  music: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  arrowRight: '<svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><polyline points="96 48 176 128 96 208"/></svg>',
  verified: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
};

export function renderBioPageHtml(data: BioPageData, origin: string): string {
  const handleEsc = escapeHtml(data.handle);
  const titleEsc = escapeHtml(data.title);
  const bioEsc = data.bio ? escapeHtml(data.bio) : "";
  const canonicalUrl = `${origin}/bio/${handleEsc}`;

  const ogTitle = escapeHtml(data.ogTitle || `${data.title} (@${data.handle})`);
  const ogDescription = escapeHtml(data.ogDescription || data.bio || `Explore links and social profiles for ${data.title}`);
  const ogImage = data.ogImage ? escapeHtml(data.ogImage) : (data.avatarUrl ? escapeHtml(data.avatarUrl) : "");

  // Avatar markup
  let avatarHtml = "";
  if (data.avatarUrl) {
    avatarHtml = `<img src="${escapeHtml(data.avatarUrl)}" alt="${titleEsc}" class="bio-avatar-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="bio-avatar-fallback" style="display:none;">${titleEsc.charAt(0).toUpperCase()}</div>`;
  } else {
    avatarHtml = `<div class="bio-avatar-fallback">${titleEsc.charAt(0).toUpperCase()}</div>`;
  }

  // Social Links markup
  const socials = data.socials || {};
  const socialItems: string[] = [];
  if (socials.instagram) {
    const u = socials.instagram.startsWith("http") ? socials.instagram : `https://instagram.com/${socials.instagram.replace(/^@/, "")}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="Instagram">${BIO_ICONS.instagram}</a>`);
  }
  if (socials.twitter) {
    const u = socials.twitter.startsWith("http") ? socials.twitter : `https://x.com/${socials.twitter.replace(/^@/, "")}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="X / Twitter">${BIO_ICONS.twitter}</a>`);
  }
  if (socials.github) {
    const u = socials.github.startsWith("http") ? socials.github : `https://github.com/${socials.github.replace(/^@/, "")}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="GitHub">${BIO_ICONS.github}</a>`);
  }
  if (socials.youtube) {
    const u = socials.youtube.startsWith("http") ? socials.youtube : `https://youtube.com/${socials.youtube.startsWith("@") ? socials.youtube : "@" + socials.youtube}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="YouTube">${BIO_ICONS.youtube}</a>`);
  }
  if (socials.linkedin) {
    const u = socials.linkedin.startsWith("http") ? socials.linkedin : `https://linkedin.com/in/${socials.linkedin}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="LinkedIn">${BIO_ICONS.linkedin}</a>`);
  }
  if (socials.email) {
    const u = socials.email.startsWith("mailto:") ? socials.email : `mailto:${socials.email}`;
    socialItems.push(`<a href="${escapeHtml(u)}" class="bio-social-pill" title="Email">${BIO_ICONS.email}</a>`);
  }
  if (socials.discord) {
    const u = socials.discord.startsWith("http") ? socials.discord : `https://discord.gg/${socials.discord}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="Discord">${BIO_ICONS.discord}</a>`);
  }
  if (socials.website) {
    const u = socials.website.startsWith("http") ? socials.website : `https://${socials.website}`;
    socialItems.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="bio-social-pill" title="Website">${BIO_ICONS.globe}</a>`);
  }
  const socialsHtml = socialItems.length
    ? `<div class="bio-socials-row">${socialItems.join("")}</div>`
    : "";

  // Link Buttons markup
  const links = data.links || [];
  const linksHtml = links.length
    ? links.map((link) => {
        const clickUrl = `${origin}/bio/${handleEsc}/c/${encodeURIComponent(link.id)}`;
        const iconKey = (link.icon && BIO_ICONS[link.icon]) ? link.icon : "globe";
        const iconSvg = BIO_ICONS[iconKey] || BIO_ICONS.globe;
        const highlightClass = link.highlight ? " bio-link-btn-highlight" : "";
        return `<a href="${escapeHtml(clickUrl)}" target="_blank" rel="noopener noreferrer" class="bio-link-btn${highlightClass}" data-link-id="${escapeHtml(link.id)}">` +
          `<span class="bio-link-icon">${iconSvg}</span>` +
          `<span class="bio-link-title">${escapeHtml(link.title)}</span>` +
          `<span class="bio-link-arrow">${BIO_ICONS.arrowRight}</span>` +
        `</a>`;
      }).join("")
    : `<div class="bio-empty-note">No links added yet.</div>`;

  const theme = data.theme || "midnight";
  const customAccentCss = data.customAccentColor
    ? `:root { --bio-accent: ${escapeHtml(data.customAccentColor)} !important; }`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${titleEsc} (@${handleEsc})</title>
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="description" content="${ogDescription}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="TinyLink Bio">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ""}
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  ${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ""}
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 40px 16px 60px;
      background: var(--bio-bg);
      color: var(--bio-text);
      transition: background 0.2s ease, color 0.2s ease;
    }
    ${customAccentCss}

    /* Themes */
    body[data-theme="midnight"] {
      --bio-bg: #090D16;
      --bio-card-bg: #111827;
      --bio-card-hover: #1A2234;
      --bio-border: rgba(148, 163, 184, 0.16);
      --bio-text: #F8FAFC;
      --bio-muted: #94A3B8;
      --bio-accent: #38BDF8;
      --bio-accent-rgb: 56, 189, 248;
    }
    body[data-theme="paper"] {
      --bio-bg: #F8FAFC;
      --bio-card-bg: #FFFFFF;
      --bio-card-hover: #F1F5F9;
      --bio-border: #E2E8F0;
      --bio-text: #0F172A;
      --bio-muted: #64748B;
      --bio-accent: #2563EB;
      --bio-accent-rgb: 37, 99, 235;
    }
    body[data-theme="emerald"] {
      --bio-bg: #030A06;
      --bio-card-bg: #091910;
      --bio-card-hover: #0E2519;
      --bio-border: rgba(34, 197, 94, 0.28);
      --bio-text: #F0FDF4;
      --bio-muted: #86EFAC;
      --bio-accent: #22C55E;
      --bio-accent-rgb: 34, 197, 94;
    }
    body[data-theme="sunset"] {
      --bio-bg: #0F0914;
      --bio-card-bg: #1D1225;
      --bio-card-hover: #2B1B36;
      --bio-border: rgba(244, 63, 94, 0.26);
      --bio-text: #FFF1F2;
      --bio-muted: #FDA4AF;
      --bio-accent: #FB7185;
      --bio-accent-rgb: 251, 113, 133;
    }
    body[data-theme="glass"] {
      --bio-bg: radial-gradient(circle at 50% 20%, #1E1B4B 0%, #0F172A 70%, #020617 100%);
      --bio-card-bg: rgba(255, 255, 255, 0.07);
      --bio-card-hover: rgba(255, 255, 255, 0.14);
      --bio-border: rgba(255, 255, 255, 0.18);
      --bio-text: #FFFFFF;
      --bio-muted: rgba(255, 255, 255, 0.72);
      --bio-accent: #C084FC;
      --bio-accent-rgb: 192, 132, 252;
    }

    .bio-container {
      width: 100%;
      max-width: 580px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .bio-avatar-wrap {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      margin-bottom: 16px;
      position: relative;
      padding: 3px;
      background: linear-gradient(135deg, var(--bio-accent), var(--bio-border));
      box-shadow: 0 8px 24px -4px rgba(0,0,0,0.3);
    }
    .bio-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      background: var(--bio-card-bg);
    }
    .bio-avatar-fallback {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--bio-card-bg);
      color: var(--bio-accent);
      font-size: 2.2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .bio-name-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .bio-title {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--bio-text);
      word-break: break-word;
    }
    .bio-verified {
      display: inline-flex;
      align-items: center;
      color: var(--bio-accent);
    }
    .bio-handle {
      font-size: 0.88rem;
      color: var(--bio-muted);
      margin-bottom: 12px;
      font-weight: 500;
    }
    .bio-desc {
      font-size: 0.94rem;
      line-height: 1.5;
      color: var(--bio-muted);
      max-width: 440px;
      margin-bottom: 20px;
      word-wrap: break-word;
    }
    .bio-socials-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 28px;
    }
    .bio-social-pill {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bio-card-bg);
      border: 1px solid var(--bio-border);
      color: var(--bio-text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .bio-social-pill:hover, .bio-social-pill:focus-visible {
      transform: translateY(-2px);
      background: var(--bio-card-hover);
      border-color: var(--bio-accent);
      color: var(--bio-accent);
      outline: none;
    }
    .bio-links-stack {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 40px;
    }
    .bio-link-btn {
      width: 100%;
      min-height: 54px;
      padding: 12px 18px;
      border-radius: 14px;
      background: var(--bio-card-bg);
      border: 1px solid var(--bio-border);
      color: var(--bio-text);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 0.96rem;
      font-weight: 600;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
      backdrop-filter: blur(8px);
    }
    .bio-link-btn:hover, .bio-link-btn:focus-visible {
      transform: translateY(-2px) scale(1.01);
      background: var(--bio-card-hover);
      border-color: var(--bio-accent);
      outline: none;
      box-shadow: 0 10px 24px -6px rgba(0,0,0,0.25);
    }
    .bio-link-btn-highlight {
      border-color: var(--bio-accent);
      animation: bioPulse 2.4s infinite ease-in-out;
    }
    @keyframes bioPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bio-accent-rgb), 0.35); }
      50% { box-shadow: 0 0 18px 3px rgba(var(--bio-accent-rgb), 0.35); }
    }
    .bio-link-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--bio-accent);
      flex-shrink: 0;
    }
    .bio-link-title {
      flex: 1;
      text-align: left;
      word-break: break-word;
    }
    .bio-link-arrow {
      display: inline-flex;
      align-items: center;
      color: var(--bio-muted);
      opacity: 0.7;
      transition: transform 0.15s ease, opacity 0.15s ease;
      flex-shrink: 0;
    }
    .bio-link-btn:hover .bio-link-arrow, .bio-link-btn:focus-visible .bio-link-arrow {
      transform: translateX(3px);
      opacity: 1;
      color: var(--bio-accent);
    }
    .bio-empty-note {
      padding: 28px 16px;
      font-size: 0.9rem;
      color: var(--bio-muted);
      border: 1px dashed var(--bio-border);
      border-radius: 12px;
      width: 100%;
    }
    .bio-lead-card {
      width: 100%;
      background: var(--bio-card-bg);
      border: 1px solid var(--bio-border);
      border-radius: 16px;
      padding: 22px 20px;
      margin-bottom: 24px;
      text-align: left;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px -2px rgba(0,0,0,0.2);
    }
    .bio-lead-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .bio-lead-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(var(--bio-accent-rgb), 0.12);
      color: var(--bio-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .bio-lead-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--bio-text);
      letter-spacing: -0.01em;
    }
    .bio-lead-desc {
      font-size: 0.86rem;
      color: var(--bio-muted);
      line-height: 1.5;
      margin-bottom: 14px;
    }
    .bio-lead-input-wrap {
      display: flex;
      gap: 8px;
    }
    @media (max-width: 480px) {
      .bio-lead-input-wrap { flex-direction: column; }
    }
    .bio-lead-input {
      flex: 1;
      min-height: 44px;
      padding: 0 14px;
      background: rgba(0,0,0,0.2);
      border: 1px solid var(--bio-border);
      border-radius: 10px;
      color: var(--bio-text);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .bio-lead-input:focus {
      border-color: var(--bio-accent);
    }
    .bio-lead-btn {
      min-height: 44px;
      padding: 0 20px;
      background: var(--bio-accent);
      color: #090D16;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.88rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.15s ease;
      touch-action: manipulation;
    }
    .bio-lead-btn:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .bio-lead-msg {
      font-size: 0.82rem;
      margin-top: 10px;
      min-height: 18px;
    }
    .bio-footer {
      margin-top: auto;
      font-size: 0.76rem;
      color: var(--bio-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bio-footer a {
      color: var(--bio-muted);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.15s ease;
    }
    .bio-footer a:hover {
      color: var(--bio-text);
      text-decoration: underline;
    }
  </style>
</head>
<body data-theme="${escapeHtml(theme)}">
  <main class="bio-container">
    <div class="bio-avatar-wrap">
      ${avatarHtml}
    </div>
    <div class="bio-name-row">
      <h1 class="bio-title">${titleEsc}</h1>
      <span class="bio-verified" title="Verified Profile">${BIO_ICONS.verified}</span>
    </div>
    <div class="bio-handle">@${handleEsc}</div>
    ${bioEsc ? `<p class="bio-desc">${bioEsc}</p>` : ""}
    ${socialsHtml}
    ${data.leadCapture?.enabled ? `
    <section class="bio-lead-card" id="bioLeadSection" aria-labelledby="bioLeadTitle">
      <div class="bio-lead-header">
        <div class="bio-lead-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="32" y="48" width="192" height="160" rx="16"/><polyline points="224 56 128 144 32 56"/></svg>
        </div>
        <h2 class="bio-lead-title" id="bioLeadTitle">${escapeHtml(data.leadCapture.title || "Join the Newsletter")}</h2>
      </div>
      <p class="bio-lead-desc">${escapeHtml(data.leadCapture.description || "Get updates and exclusive content delivered directly to your inbox.")}</p>
      <form class="bio-lead-form" method="POST" action="/bio/${handleEsc}/subscribe" id="bioLeadForm">
        <div class="bio-lead-input-wrap">
          <input type="email" name="email" class="bio-lead-input" placeholder="Enter your email address" required autocomplete="email" aria-label="Email address" />
          <button type="submit" class="bio-lead-btn" id="bioLeadBtn">
            <span>${escapeHtml(data.leadCapture.buttonText || "Subscribe")}</span>
          </button>
        </div>
        <div class="bio-lead-msg" id="bioLeadMsg" role="status" aria-live="polite"></div>
      </form>
    </section>` : ""}
    <div class="bio-links-stack">
      ${linksHtml}
    </div>
    <footer class="bio-footer">
      <span>Powered by</span>
      <a href="${origin}/" target="_blank" rel="noopener noreferrer">TinyLink</a>
    </footer>
  </main>
  <script src="/assets/bio.js"></script>
  ${data.pixels ? `
  <div id="pixelBridgeConfig"${data.pixels.facebookPixelId ? ` data-fb="${escapeHtml(data.pixels.facebookPixelId)}"` : ""}${data.pixels.googleAnalyticsId ? ` data-ga="${escapeHtml(data.pixels.googleAnalyticsId)}"` : ""}${data.pixels.tiktokPixelId ? ` data-tt="${escapeHtml(data.pixels.tiktokPixelId)}"` : ""}${data.pixels.linkedinPartnerId ? ` data-li="${escapeHtml(data.pixels.linkedinPartnerId)}"` : ""}${data.pixels.twitterPixelId ? ` data-tw="${escapeHtml(data.pixels.twitterPixelId)}"` : ""} style="display:none;" aria-hidden="true"></div>
  <script src="/assets/pixel-bridge.js" defer></script>` : ""}
</body>
</html>`;
}

// ── OpenAPI Documentation & Interactive Playground ──

export const DOCS_PAGE_JS = `(function() {
  'use strict';

  var tokenInput = document.getElementById('docsToken');
  var endpointSelect = document.getElementById('docsEndpoint');
  var methodEl = document.getElementById('docsMethod');
  var pathEl = document.getElementById('docsPath');
  var paramInput = document.getElementById('docsParam');
  var paramGroup = document.getElementById('docsParamGroup');
  var bodyInput = document.getElementById('docsBody');
  var bodyGroup = document.getElementById('docsBodyGroup');
  var sendBtn = document.getElementById('docsSendBtn');
  var resetBtn = document.getElementById('docsResetBtn');
  var statusBadge = document.getElementById('docsStatusBadge');
  var latencyBadge = document.getElementById('docsLatencyBadge');
  var headersEl = document.getElementById('docsHeaders');
  var responseEl = document.getElementById('docsResponse');
  var copyResponseBtn = document.getElementById('docsCopyBtn');

  var ENDPOINTS = {
    'shorten': { method: 'POST', path: '/api/shorten', hasParam: false, hasBody: true, defaultBody: '{\\n  "url": "https://example.com/target",\\n  "custom": "test-slug",\\n  "tags": ["prod", "demo"]\\n}' },
    'list': { method: 'GET', path: '/api/list', hasParam: false, hasBody: false },
    'analytics': { method: 'GET', path: '/api/analytics/:slug', hasParam: true, paramPlaceholder: 'Slug (e.g. test-slug)', defaultParam: 'test-slug', hasBody: false },
    'export_csv': { method: 'GET', path: '/api/analytics/:slug/export?format=csv', hasParam: true, paramPlaceholder: 'Slug (e.g. test-slug)', defaultParam: 'test-slug', hasBody: false },
    'stream_clicks': { method: 'GET', path: '/api/stream/clicks', hasParam: false, hasBody: false },
    'goals_track': { method: 'POST', path: '/api/goals/track', hasParam: false, hasBody: true, defaultBody: '{\\n  "slug": "test-slug",\\n  "goal": "purchase"\\n}' },
    'ai_suggest': { method: 'POST', path: '/api/ai/suggest', hasParam: false, hasBody: true, defaultBody: '{\\n  "url": "https://stripe.com/docs",\\n  "title": "Stripe API Reference"\\n}' },
    'ai_metadata': { method: 'POST', path: '/api/ai/metadata', hasParam: false, hasBody: true, defaultBody: '{\\n  "url": "https://github.com"\\n}' },
    'keys_list': { method: 'GET', path: '/api/keys', hasParam: false, hasBody: false },
    'keys_create': { method: 'POST', path: '/api/keys', hasParam: false, hasBody: true, defaultBody: '{\\n  "name": "Production Service Key",\\n  "scopes": ["read:links", "write:links", "read:analytics"],\\n  "rateLimit": 120\\n}' },
    'keys_delete': { method: 'DELETE', path: '/api/keys/:id', hasParam: true, paramPlaceholder: 'Key ID (e.g. key_123456)', defaultParam: 'key_id_here', hasBody: false },
    'domains_list': { method: 'GET', path: '/api/domains', hasParam: false, hasBody: false },
    'domains_create': { method: 'POST', path: '/api/domains', hasParam: false, hasBody: true, defaultBody: '{\\n  "domain": "tinylink.devs.li",\\n  "rootRedirect": "https://github.com/VarshuDev/tinylink"\\n}' },
    'domains_delete': { method: 'DELETE', path: '/api/domains/:domain', hasParam: true, paramPlaceholder: 'Domain name (e.g. tinylink.devs.li)', defaultParam: 'tinylink.devs.li', hasBody: false }
  };

  function updateForm() {
    var key = endpointSelect.value;
    var ep = ENDPOINTS[key];
    if (!ep) return;

    methodEl.textContent = ep.method;
    methodEl.className = 'http-badge http-' + ep.method.toLowerCase();
    pathEl.textContent = ep.path;

    if (ep.hasParam) {
      paramGroup.hidden = false;
      paramInput.placeholder = ep.paramPlaceholder || 'Parameter';
      paramInput.value = ep.defaultParam || '';
    } else {
      paramGroup.hidden = true;
    }

    if (ep.hasBody) {
      bodyGroup.hidden = false;
      bodyInput.value = ep.defaultBody || '{}';
    } else {
      bodyGroup.hidden = true;
    }
  }

  endpointSelect.addEventListener('change', updateForm);
  updateForm();

  sendBtn.addEventListener('click', async function() {
    var key = endpointSelect.value;
    var ep = ENDPOINTS[key];
    if (!ep) return;

    var actualPath = ep.path;
    if (ep.hasParam) {
      var val = (paramInput.value || '').trim();
      actualPath = actualPath.replace(/:[a-zA-Z0-9_]+/, encodeURIComponent(val));
    }

    var token = (tokenInput.value || '').trim();
    var headers = {};
    if (token) {
      if (token.startsWith('tl_live_')) {
        headers['X-API-Key'] = token;
      } else {
        headers['X-Auth-Token'] = token;
      }
    }

    var fetchOpts = {
      method: ep.method,
      headers: headers
    };

    if (ep.hasBody) {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = bodyInput.value;
    }

    statusBadge.textContent = 'Sending...';
    statusBadge.className = 'status-badge status-loading';
    statusBadge.hidden = false;
    latencyBadge.hidden = true;
    headersEl.textContent = '';
    responseEl.textContent = '';

    var t0 = performance.now();
    try {
      var res = await fetch(actualPath, fetchOpts);
      var t1 = performance.now();
      var latency = Math.round(t1 - t0);

      statusBadge.textContent = res.status + ' ' + res.statusText;
      statusBadge.className = 'status-badge ' + (res.ok ? 'status-ok' : (res.status >= 500 ? 'status-err' : 'status-warn'));
      latencyBadge.textContent = latency + 'ms';
      latencyBadge.hidden = false;

      var headerLines = [];
      res.headers.forEach(function(val, name) {
        if (name.toLowerCase().startsWith('x-ratelimit') || name.toLowerCase().startsWith('content-type') || name.toLowerCase().startsWith('x-custom-domain')) {
          headerLines.push(name + ': ' + val);
        }
      });
      headersEl.textContent = headerLines.length ? headerLines.join('\\n') : '(Standard security headers returned)';

      var text = await res.text();
      try {
        var parsed = JSON.parse(text);
        responseEl.textContent = JSON.stringify(parsed, null, 2);
      } catch (e) {
        responseEl.textContent = text;
      }
    } catch (err) {
      statusBadge.textContent = 'Network Error';
      statusBadge.className = 'status-badge status-err';
      responseEl.textContent = String(err);
    }
  });

  resetBtn.addEventListener('click', function() {
    updateForm();
    statusBadge.hidden = true;
    latencyBadge.hidden = true;
    headersEl.textContent = '';
    responseEl.textContent = '';
  });

  copyResponseBtn.addEventListener('click', function() {
    var text = responseEl.textContent || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    var oldText = copyResponseBtn.textContent;
    copyResponseBtn.textContent = 'Copied!';
    setTimeout(function() { copyResponseBtn.textContent = oldText; }, 1800);
  });
})();
`;

export function renderDocsHtml(origin: string): string {
  const originEsc = escapeHtml(origin);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TinyLink OpenAPI Documentation &amp; Developer Console</title>
  <meta name="description" content="Official API reference, OpenAPI specifications, and interactive testing playground for the TinyLink Edge URL Shortener.">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <script src="/assets/theme.js"></script>
  <style>
    :root {
      --bg: #090D16;
      --bg-card: #111827;
      --bg-hover: #1F2937;
      --border: rgba(148, 163, 184, 0.16);
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --link: #38BDF8;
      --accent: #22C55E;
      --warning: #F59E0B;
      --danger: #EF4444;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    [data-theme="light"] {
      --bg: #F8FAFC;
      --bg-card: #FFFFFF;
      --bg-hover: #F1F5F9;
      --border: rgba(100, 116, 139, 0.18);
      --text: #0F172A;
      --text-muted: #64748B;
      --link: #0284C7;
      --accent: #16A34A;
      --warning: #D97706;
      --danger: #DC2626;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding-bottom: 60px;
    }
    .header {
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .logo-badge {
      background: rgba(34, 197, 94, 0.14);
      color: var(--accent);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .header h1 { font-size: 1.15rem; font-weight: 700; }
    .header-links a { color: var(--link); text-decoration: none; font-size: 0.85rem; font-weight: 600; margin-left: 16px; }
    .header-links a:hover { text-decoration: underline; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
    .hero-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .hero-box h2 { font-size: 1.3rem; margin-bottom: 8px; }
    .hero-box p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px; }
    .auth-banner {
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 8px;
      padding: 14px;
      font-size: 0.85rem;
    }
    .auth-banner strong { color: var(--link); }
    .auth-banner code { font-family: var(--font-mono); background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px; }
    .playground-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .playground-card h3 { font-size: 1.15rem; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
    @media (max-width: 768px) { .field-row { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
    .input, .select, .textarea {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 0.88rem;
      padding: 9px 12px;
      border-radius: 6px;
      font-family: inherit;
    }
    .textarea { font-family: var(--font-mono); resize: vertical; min-height: 90px; }
    .input:focus, .select:focus, .textarea:focus { outline: 2px solid var(--link); border-color: transparent; }
    .http-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: var(--font-mono);
    }
    .http-get { background: rgba(34, 197, 94, 0.18); color: var(--accent); }
    .http-post { background: rgba(56, 189, 248, 0.18); color: var(--link); }
    .http-delete { background: rgba(239, 68, 68, 0.18); color: var(--danger); }
    .btn-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .btn {
      padding: 9px 18px;
      font-size: 0.88rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .btn-primary { background: var(--link); color: #000; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
    .btn-ghost:hover { background: var(--bg-hover); }
    .response-pane {
      margin-top: 20px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .response-header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .status-badge {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
    }
    .status-ok { background: rgba(34, 197, 94, 0.18); color: var(--accent); }
    .status-warn { background: rgba(245, 158, 11, 0.18); color: var(--warning); }
    .status-err { background: rgba(239, 68, 68, 0.18); color: var(--danger); }
    .status-loading { background: rgba(56, 189, 248, 0.18); color: var(--link); }
    .code-box {
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      overflow-x: auto;
      white-space: pre-wrap;
      max-height: 400px;
      line-height: 1.45;
    }
    .section-title { font-size: 1.2rem; font-weight: 700; margin: 32px 0 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    .spec-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 14px;
    }
    .spec-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
    .spec-path { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 600; }
    .spec-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px; }
    .scope-tag { font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; background: rgba(148, 163, 184, 0.14); color: var(--text-muted); font-family: var(--font-mono); }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-left">
      <span class="logo-badge">OpenAPI 3.1</span>
      <h1>TinyLink Developer Platform &amp; API Reference</h1>
    </div>
    <div class="header-links">
      <a href="${originEsc}/">Console Dashboard</a>
      <a href="https://github.com/VarshuDev/tinylink" target="_blank" rel="noopener noreferrer">GitHub Repo</a>
    </div>
  </header>

  <main class="container">
    <div class="hero-box">
      <h2>Edge-Accelerated URL Intelligence API</h2>
      <p>Direct programmatic access to TinyLink's link creation, AI suggestions, real-time analytics stream, conversion goals, scoped API tokens, and custom domain multi-tenancy.</p>
      <div class="auth-banner">
        <strong>Authentication:</strong> Pass your scoped API token via <code>X-API-Key: tl_live_...</code> or <code>Authorization: Bearer tl_live_...</code>. Admin master tokens pass via <code>X-Auth-Token: ...</code>.<br>
        <strong>Rate Limits:</strong> Managed via <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and <code>X-RateLimit-Reset</code> response headers.
      </div>
    </div>

    <section class="playground-card" aria-labelledby="playgroundTitle">
      <h3 id="playgroundTitle">Interactive API Playground</h3>
      <div class="field-row">
        <div class="field">
          <label for="docsToken">API Key or Admin Token</label>
          <input type="password" id="docsToken" class="input" placeholder="tl_live_... or master admin token">
        </div>
        <div class="field">
          <label for="docsEndpoint">Select Target Endpoint</label>
          <select id="docsEndpoint" class="select">
            <option value="shorten">POST /api/shorten - Create Short Link</option>
            <option value="list">GET /api/list - List All Links</option>
            <option value="analytics">GET /api/analytics/:slug - Detailed Link Analytics</option>
            <option value="export_csv">GET /api/analytics/:slug/export - Export CSV Report</option>
            <option value="stream_clicks">GET /api/stream/clicks - Real-Time Click Stream</option>
            <option value="goals_track">POST /api/goals/track - Record Conversion Goal</option>
            <option value="ai_suggest">POST /api/ai/suggest - AI Slug &amp; Tag Suggestions</option>
            <option value="ai_metadata">POST /api/ai/metadata - AI Social Metadata Scraper</option>
            <option value="keys_list">GET /api/keys - List Scoped API Keys</option>
            <option value="keys_create">POST /api/keys - Generate New Scoped API Key</option>
            <option value="keys_delete">DELETE /api/keys/:id - Revoke API Key</option>
            <option value="domains_list">GET /api/domains - List Custom Domains</option>
            <option value="domains_create">POST /api/domains - Register Custom Domain</option>
            <option value="domains_delete">DELETE /api/domains/:domain - Delete Custom Domain</option>
          </select>
        </div>
      </div>

      <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;">
        <span id="docsMethod" class="http-badge http-post">POST</span>
        <code id="docsPath" style="font-family:var(--font-mono);font-size:0.9rem;">/api/shorten</code>
      </div>

      <div class="field" id="docsParamGroup" hidden style="margin-bottom:14px;">
        <label for="docsParam">Route Parameter</label>
        <input type="text" id="docsParam" class="input" placeholder="Parameter value">
      </div>

      <div class="field" id="docsBodyGroup" style="margin-bottom:14px;">
        <label for="docsBody">Request Payload (JSON)</label>
        <textarea id="docsBody" class="textarea" rows="4"></textarea>
      </div>

      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="docsSendBtn">Send Request</button>
        <button type="button" class="btn btn-ghost" id="docsResetBtn">Reset</button>
      </div>

      <div class="response-pane">
        <div class="response-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:0.8rem;font-weight:700;color:var(--text-muted);">Response</span>
            <span class="status-badge status-ok" id="docsStatusBadge" hidden>200 OK</span>
            <span style="font-size:0.75rem;color:var(--text-muted);" id="docsLatencyBadge" hidden>0ms</span>
          </div>
          <button type="button" class="btn btn-ghost" id="docsCopyBtn" style="padding:4px 10px;font-size:0.75rem;">Copy Response</button>
        </div>
        <div class="code-box" style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:0.75rem;" id="docsHeaders"></div>
        <div class="code-box" id="docsResponse">// Click Send Request above to inspect live API output</div>
      </div>
    </section>

    <h2 class="section-title">OpenAPI 3.1 Endpoint Reference</h2>

    <div class="spec-card">
      <div class="spec-top">
        <span class="http-badge http-post">POST</span>
        <span class="spec-path">/api/shorten</span>
        <span class="scope-tag">Scope: write:links</span>
      </div>
      <p class="spec-desc">Creates an edge short link with support for custom slug, expiration, click quotas, password hashing, and A/B split testing.</p>
    </div>

    <div class="spec-card">
      <div class="spec-top">
        <span class="http-badge http-get">GET</span>
        <span class="spec-path">/api/list</span>
        <span class="scope-tag">Scope: read:links</span>
      </div>
      <p class="spec-desc">Returns a list of all active links with aggregated analytics, labels, and tags.</p>
    </div>

    <div class="spec-card">
      <div class="spec-top">
        <span class="http-badge http-get">GET</span>
        <span class="spec-path">/api/analytics/{slug}</span>
        <span class="scope-tag">Scope: read:analytics</span>
      </div>
      <p class="spec-desc">Retrieves detailed analytics including geographic distribution, devices, referrers, hourly traffic, and conversion goals.</p>
    </div>

    <div class="spec-card">
      <div class="spec-top">
        <span class="http-badge http-get">GET</span>
        <span class="spec-path">/api/stream/clicks</span>
        <span class="scope-tag">Scope: read:analytics</span>
      </div>
      <p class="spec-desc">Streams live click telemetry with country, device, referrer, and timestamp.</p>
    </div>

    <div class="spec-card">
      <div class="spec-top">
        <span class="http-badge http-post">POST</span>
        <span class="spec-path">/api/keys</span>
        <span class="scope-tag">Admin Auth Required</span>
      </div>
      <p class="spec-desc">Provisions a scoped API key (format: tl_live_...) with granular permissions and per-key rate limits.</p>
    </div>

    <div class="spec-card">
      <div class="spec-top">
        <span class="http-badge http-post">POST</span>
        <span class="spec-path">/api/domains</span>
        <span class="scope-tag">Admin Auth Required</span>
      </div>
      <p class="spec-desc">Registers a custom branded domain with custom root redirect and branded 404 handler.</p>
    </div>
  </main>

  <script src="/assets/docs.js"></script>
</body>
</html>`;
}

