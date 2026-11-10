import type { TimelineBucket } from "./types";

export interface StatusPageOptions {
  status: 404 | 410;
  codeLabel: string;
  title: string;
  message: string;
}

export interface PasswordPageOptions {
  slug: string;
  label?: string | null;
  error?: string;
}

export interface PreviewMetaOptions {
  shortUrl: string;
  title: string;
  description: string;
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

const THEME_INIT_SCRIPT = `<script>
  (function() {
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
    } catch (e) {}
  })();
</script>`;

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
  const accentColor = isExpired ? "#F59E0B" : "#EF4444";
  const accentBg = isExpired ? "rgba(245, 158, 11, 0.14)" : "rgba(239, 68, 68, 0.14)";
  const iconSvg = isExpired
    ? `<svg width="28" height="28" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="128" r="96"/><polyline points="128 72 128 128 184 128"/></svg>`
    : `<svg width="28" height="28" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="112" cy="112" r="80"/><line x1="168.57" y1="168.57" x2="224" y2="224"/><line x1="88" y1="112" x2="136" y2="112"/></svg>`;

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
    <a class="btn" href="/">
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="216" y1="128" x2="40" y2="128"/><polyline points="112 56 40 128 112 200"/></svg>
      <span>Return to Dashboard</span>
    </a>
  </main>
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
  <script>
    (function() {
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
    })();
  </script>
</body>
</html>`;
}

export function renderPreviewMetaPage(opts: PreviewMetaOptions): string {
  const titleEsc = escapeHtml(opts.title);
  const descEsc = escapeHtml(opts.description);
  const urlEsc = escapeHtml(opts.shortUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <title>${titleEsc}</title>
  <meta name="description" content="${descEsc}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${titleEsc}">
  <meta property="og:description" content="${descEsc}">
  <meta property="og:url" content="${urlEsc}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${titleEsc}">
  <meta name="twitter:description" content="${descEsc}">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
</head>
<body>
  <main style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:24px;">
    <h1>${titleEsc}</h1>
    <p>${descEsc}</p>
    <p><a href="${urlEsc}">${urlEsc}</a></p>
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
    .brand { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); font-family: 'Fira Code', monospace; font-weight: 700; font-size: 1rem; }
    .badge { font-size: 0.72rem; font-weight: 600; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-muted); }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .hero-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .slug-title { font-family: 'Fira Code', monospace; font-size: 1.2rem; font-weight: 700; color: var(--link); text-decoration: none; }
    .slug-title:hover { text-decoration: underline; }
    .pill-ok { background: var(--accent-soft); color: var(--cta); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .pill-danger { background: var(--danger-soft); color: var(--danger); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .dest-box { padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; font-family: 'Fira Code', monospace; font-size: 0.8rem; color: var(--text-muted); word-break: break-all; }
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
    .qr-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .qr-box { width: 96px; height: 96px; background: #FFF; padding: 6px; border-radius: 8px; flex-shrink: 0; }
    .qr-box svg { width: 100%; height: 100%; display: block; }
    @media (max-width: 720px) {
      .kpis { grid-template-columns: repeat(2, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="head">
      <a href="/" class="brand">TinyLink</a>
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
