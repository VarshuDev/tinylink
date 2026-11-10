export interface StatusPageOptions {
  status: 404 | 410;
  codeLabel: string;
  title: string;
  message: string;
}

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
  <title>${opts.title} — TinyLink</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta name="theme-color" id="themeColorMeta" content="#090D16">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
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
  </script>
  <style>
    :root,
    [data-theme="dark"] {
      --bg: #090D16;
      --surface: #111827;
      --border: #2A364F;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --cta: #22C55E;
      --cta-hover: #16A34A;
      --cta-ink: #052E16;
      --ring: #38BDF8;
    }
    [data-theme="light"] {
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --border: #CBD5E1;
      --text: #0F172A;
      --text-muted: #475569;
      --cta: #16A34A;
      --cta-hover: #15803D;
      --cta-ink: #FFFFFF;
      --ring: #0284C7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
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
    .btn:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .btn { transition: none; }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="icon-badge">${iconSvg}</div>
    <div class="code">${opts.codeLabel}</div>
    <h1>${opts.title}</h1>
    <p>${opts.message}</p>
    <a class="btn" href="/">
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="216" y1="128" x2="40" y2="128"/><polyline points="112 56 40 128 112 200"/></svg>
      <span>Return to Dashboard</span>
    </a>
  </main>
</body>
</html>`;
}
