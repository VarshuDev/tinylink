export function renderDashboardHtml(authRequired: boolean): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TinyLink — Link Console &amp; Analytics</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" id="themeColorMeta" content="#090D16">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TinyLink">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>
  (function() {
    try {
      var saved = localStorage.getItem('tl_theme');
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) {}
  })();
</script>
<style>
  :root,
  [data-theme="dark"] {
    --bg: #090D16;
    --surface: #111827;
    --surface-2: #1E293B;
    --surface-3: #273449;
    --border: #2A364F;
    --border-subtle: rgba(148, 163, 184, 0.14);
    --text: #F8FAFC;
    --text-muted: #94A3B8;
    --accent: #22C55E;
    --accent-hover: #16A34A;
    --accent-ink: #052E16;
    --accent-soft: rgba(34, 197, 94, 0.14);
    --accent-glow: rgba(34, 197, 94, 0.25);
    --link: #38BDF8;
    --link-soft: rgba(56, 189, 248, 0.14);
    --danger: #EF4444;
    --danger-hover: #DC2626;
    --danger-soft: rgba(239, 68, 68, 0.14);
    --warning: #F59E0B;
    --warning-soft: rgba(245, 158, 11, 0.14);
    --ring: #38BDF8;
    --scrim: rgba(2, 6, 23, 0.78);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
    --shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.55);
    --color-scheme: dark;
  }

  [data-theme="light"] {
    --bg: #F8FAFC;
    --surface: #FFFFFF;
    --surface-2: #F1F5F9;
    --surface-3: #E2E8F0;
    --border: #CBD5E1;
    --border-subtle: rgba(15, 23, 42, 0.08);
    --text: #0F172A;
    --text-muted: #475569;
    --accent: #16A34A;
    --accent-hover: #15803D;
    --accent-ink: #FFFFFF;
    --accent-soft: rgba(22, 163, 74, 0.12);
    --accent-glow: rgba(22, 163, 74, 0.22);
    --link: #0284C7;
    --link-soft: rgba(2, 132, 199, 0.12);
    --danger: #DC2626;
    --danger-hover: #B91C1C;
    --danger-soft: rgba(220, 38, 38, 0.12);
    --warning: #D97706;
    --warning-soft: rgba(217, 119, 6, 0.12);
    --ring: #0284C7;
    --scrim: rgba(15, 23, 42, 0.62);
    --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06);
    --shadow-lg: 0 20px 45px rgba(15, 23, 42, 0.16);
    --color-scheme: light;
  }

  :root {
    --font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { color-scheme: var(--color-scheme); scroll-padding-top: 76px; }

  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  [hidden] { display: none !important; }

  button, input, select { font-family: inherit; }
  button, a, [role="button"], [role="radio"] { cursor: pointer; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

  .mono { font-family: var(--font-mono); }
  .tabular { font-variant-numeric: tabular-nums; }

  /* ── Top Header ── */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border-subtle);
  }
  .topbar-inner {
    max-width: 1080px;
    margin: 0 auto;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text);
  }
  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--accent-soft);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .brand-name {
    font-family: var(--font-mono);
    font-size: 1.12rem;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .brand-tag {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    white-space: nowrap;
  }
  .brand-tag.secured {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    color: var(--accent);
    background: var(--accent-soft);
  }
  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 40px;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid transparent;
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease;
    white-space: nowrap;
    text-decoration: none;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
  .btn-secondary {
    background: var(--surface-2);
    border-color: var(--border);
    color: var(--text);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: color-mix(in srgb, var(--text-muted) 45%, transparent);
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--border);
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
  }
  .btn-danger {
    background: var(--danger-soft);
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger);
  }
  .btn-danger:hover:not(:disabled) {
    background: var(--danger);
    color: #FFFFFF;
    border-color: var(--danger);
  }
  .btn-danger-solid {
    background: var(--danger);
    color: #FFFFFF;
  }
  .btn-danger-solid:hover:not(:disabled) { background: var(--danger-hover); }
  .btn-sm { min-height: 34px; padding: 0 11px; font-size: 0.8rem; }
  .btn-icon {
    width: 36px;
    height: 36px;
    min-height: 36px;
    padding: 0;
  }

  /* ── Layout Container ── */
  .container {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    padding: 24px 20px 40px;
    flex: 1;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  /* ── Auth Vault ── */
  .vault-wrap {
    max-width: 440px;
    margin: 56px auto 24px;
    padding: 32px 28px;
  }
  .vault-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--link-soft);
    color: var(--link);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
  }
  .vault-title {
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .vault-desc {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 22px;
  }
  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .input-field {
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.92rem;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .input-field::placeholder { color: var(--text-muted); opacity: 0.75; }
  .input-field:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
  }
  .input-field[aria-invalid="true"] {
    border-color: var(--danger);
  }
  .input-with-btn { padding-right: 46px; }
  .input-suffix-btn {
    position: absolute;
    right: 4px;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .input-suffix-btn:hover { color: var(--text); background: var(--surface-3); }

  .alert-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    background: var(--danger-soft);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger);
    font-size: 0.85rem;
    margin-bottom: 14px;
  }
  .alert-box svg { flex-shrink: 0; margin-top: 2px; }

  /* ── Shorten Studio ── */
  .studio { padding: 22px 24px; margin-bottom: 20px; }
  .studio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .studio-title {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .studio-sub {
    font-size: 0.82rem;
    color: var(--text-muted);
  }
  .shorten-primary-row {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
  .shorten-primary-row .input-field { flex: 1; }
  .shorten-primary-row .btn-primary { min-height: 44px; padding: 0 22px; }

  .studio-options-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .slug-group {
    display: flex;
    align-items: center;
    flex: 1;
    width: 100%;
    min-width: 0;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    min-height: 40px;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .slug-group:focus-within {
    border-color: var(--ring);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 22%, transparent);
  }
  .slug-prefix {
    display: block;
    padding: 0 10px 0 12px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 40px;
    color: var(--text-muted);
    background: var(--surface-3);
    border-right: 1px solid var(--border);
    white-space: nowrap;
    max-width: 340px;
    flex-shrink: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slug-input {
    flex: 1;
    width: 0;
    min-width: 90px;
    border: none;
    background: transparent;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 8px 12px;
    outline: none;
  }
  .slug-input::placeholder { color: var(--text-muted); font-family: var(--font-sans); opacity: 0.75; }

  .expiry-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .expiry-label {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 500;
    margin-right: 2px;
  }
  .pill-group {
    display: inline-flex;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 3px;
    gap: 2px;
  }
  .pill-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.76rem;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 6px;
    min-height: 30px;
    transition: background-color 150ms ease, color 150ms ease;
  }
  .pill-btn:hover { color: var(--text); }
  .pill-btn[aria-checked="true"],
  .pill-btn[aria-pressed="true"] {
    background: var(--surface-3);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }

  /* ── Result Banner ── */
  .result-banner {
    margin-top: 16px;
    padding: 16px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    animation: fadeSlideIn 180ms ease;
  }
  .result-qr {
    width: 68px;
    height: 68px;
    border-radius: 8px;
    background: #FFFFFF;
    padding: 5px;
    flex-shrink: 0;
    border: 1px solid var(--border);
  }
  .result-qr svg { width: 100%; height: 100%; display: block; }
  .result-info { flex: 1; min-width: 180px; }
  .result-kicker {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    margin-bottom: 2px;
  }
  .result-url {
    font-family: var(--font-mono);
    font-size: 0.96rem;
    font-weight: 600;
    color: var(--link);
    word-break: break-all;
  }
  .result-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* ── KPI Bento Grid ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kpi-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text-muted);
    font-size: 0.76rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .kpi-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    color: var(--text-muted);
  }
  .kpi-icon.green { background: var(--accent-soft); color: var(--accent); }
  .kpi-icon.sky { background: var(--link-soft); color: var(--link); }
  .kpi-icon.amber { background: var(--warning-soft); color: var(--warning); }
  .kpi-val {
    font-family: var(--font-mono);
    font-size: 1.65rem;
    font-weight: 700;
    line-height: 1.1;
    color: var(--text);
  }

  /* ── Links Command Center ── */
  .command-card { overflow: hidden; }
  .command-toolbar {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .command-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .command-title { font-size: 0.98rem; font-weight: 700; }
  .count-pill {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .toolbar-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
    justify-content: flex-end;
  }
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 190px;
    max-width: 280px;
  }
  .search-icon {
    position: absolute;
    left: 11px;
    color: var(--text-muted);
    pointer-events: none;
    display: flex;
  }
  .search-input {
    width: 100%;
    min-height: 36px;
    padding: 6px 34px 6px 34px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.84rem;
  }
  .search-input:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 20%, transparent);
  }
  .search-kbd {
    position: absolute;
    right: 9px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-muted);
    pointer-events: none;
  }
  .search-clear {
    position: absolute;
    right: 4px;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .search-clear:hover { color: var(--text); background: var(--surface-3); }

  .sort-select {
    min-height: 36px;
    padding: 0 28px 0 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 500;
    appearance: none;
    background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path fill='%2394A3B8' d='M6 8.5L1.5 4h9z'/></svg>");
    background-repeat: no-repeat;
    background-position: right 9px center;
  }

  /* ── Desktop Table ── */
  .table-scroll { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left;
    padding: 11px 16px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  tbody td {
    padding: 13px 16px;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.875rem;
    vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: color-mix(in srgb, var(--surface-2) 60%, transparent); }

  .slug-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--link);
    text-decoration: none;
  }
  .slug-link:hover { text-decoration: underline; }
  .dest-text {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
    font-size: 0.83rem;
  }
  .clicks-num {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text);
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.73rem;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .status-pill.active { background: var(--accent-soft); color: var(--accent); }
  .status-pill.active .status-dot { background: var(--accent); }
  .status-pill.expired { background: var(--danger-soft); color: var(--danger); }
  .status-pill.expired .status-dot { background: var(--danger); }

  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
  }

  /* ── Mobile Card List ── */
  .mobile-list {
    display: flex;
    flex-direction: column;
  }
  .mobile-item {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mobile-item:last-child { border-bottom: none; }
  .mobile-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mobile-dest {
    font-size: 0.84rem;
    color: var(--text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
  }
  .mobile-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .mobile-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 2px;
  }
  .mobile-actions .btn { min-height: 44px; padding: 0 8px; font-size: 0.78rem; }

  /* ── Empty & Skeleton States ── */
  .empty-state {
    padding: 52px 24px;
    text-align: center;
    color: var(--text-muted);
  }
  .empty-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 14px;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .empty-title { color: var(--text); font-weight: 600; font-size: 0.96rem; margin-bottom: 4px; }
  .empty-desc { font-size: 0.85rem; }

  .skeleton-wrap { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .skeleton-row {
    height: 44px;
    border-radius: var(--radius-sm);
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite linear;
  }

  /* ── Inspector Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(5px);
    z-index: 100;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
  }
  .modal-overlay.open { display: flex; animation: fadeIn 150ms ease; }
  .modal-dialog {
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 180ms ease;
  }
  .modal-header {
    padding: 16px 22px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .modal-title {
    font-size: 1.05rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .modal-slug-badge {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 2px 9px;
    border-radius: 6px;
    background: var(--link-soft);
    color: var(--link);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .modal-close {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .modal-close:hover { background: var(--surface-2); color: var(--text); }
  .modal-body { padding: 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

  .modal-url-box {
    padding: 11px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-muted);
    word-break: break-all;
  }

  .modal-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .modal-stat {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
  }
  .modal-stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .modal-stat-val {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 700;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .chart-readout {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--link);
    text-transform: none;
    letter-spacing: 0;
  }

  /* ── SVG Timeline Chart ── */
  .svg-chart-wrap {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 14px 14px 8px;
  }
  .svg-chart { width: 100%; height: auto; display: block; overflow: visible; }
  .chart-bar-rect {
    fill: var(--link);
    transition: fill 120ms ease, opacity 120ms ease;
    cursor: pointer;
  }
  .chart-bar-rect:hover,
  .chart-bar-group:focus .chart-bar-rect {
    fill: var(--accent);
  }
  .chart-bar-group:focus { outline: none; }
  .chart-bar-group:focus .chart-focus-ring { opacity: 1; }
  .chart-focus-ring {
    fill: none;
    stroke: var(--ring);
    stroke-width: 2;
    opacity: 0;
  }

  /* ── QR Studio ── */
  .qr-studio {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px;
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    flex-wrap: wrap;
  }
  .qr-studio-box {
    width: 116px;
    height: 116px;
    border-radius: 8px;
    background: #FFFFFF;
    padding: 6px;
    flex-shrink: 0;
  }
  .qr-studio-box svg { width: 100%; height: 100%; display: block; }
  .qr-studio-meta { flex: 1; min-width: 190px; display: flex; flex-direction: column; gap: 10px; }
  .qr-studio-link {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--link);
    word-break: break-all;
    text-decoration: none;
  }
  .qr-studio-link:hover { text-decoration: underline; }
  .qr-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

  /* ── Breakdown Lists ── */
  .breakdown-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .device-stack-bar {
    display: flex;
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-2);
    margin-bottom: 10px;
  }
  .legend-list, .ref-list { display: flex; flex-direction: column; gap: 8px; }
  .legend-item, .ref-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
    gap: 8px;
  }
  .legend-left { display: flex; align-items: center; gap: 7px; color: var(--text); }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .ref-bar-bg {
    height: 4px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 3px;
  }
  .ref-bar-fill { height: 100%; background: var(--link); border-radius: 999px; }

  /* ── Edit & Safe Delete ── */
  .edit-stack { display: flex; flex-direction: column; gap: 10px; }
  .edit-row { display: flex; gap: 8px; }
  .edit-row .input-field { flex: 1; }
  .tool-card {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tool-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tool-title { font-size: 0.86rem; font-weight: 600; color: var(--text); }
  .tool-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.45; }
  .code-snippet {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 9px 11px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--link);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .danger-zone {
    padding: 14px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .danger-zone-text { font-size: 0.84rem; color: var(--text-muted); }
  .danger-zone-btns { display: flex; gap: 8px; align-items: center; }

  /* ── Toast ── */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(16px);
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    font-size: 0.85rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease, transform 160ms ease;
    z-index: 200;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toast.error { border-color: var(--danger); color: var(--danger); }
  .toast.success { border-color: var(--accent); }

  footer {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 0.76rem;
    border-top: 1px solid var(--border-subtle);
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  @media (max-width: 900px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .breakdown-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 767px) {
    .shorten-primary-row { flex-direction: column; }
    .shorten-primary-row .btn-primary { width: 100%; }
    .studio-options-row { flex-direction: column; align-items: stretch; }
    .slug-prefix { max-width: 140px; }
    .modal-stats-grid { grid-template-columns: 1fr; }
    .toolbar-controls { width: 100%; justify-content: flex-start; }
    .search-box { max-width: none; width: 100%; flex-basis: 100%; }
    .edit-row { flex-direction: column; }
  }

  @media (max-width: 480px) {
    .topbar-inner { padding: 10px 14px; gap: 8px; }
    .brand { gap: 8px; }
    .brand-tag { font-size: 0.64rem; padding: 2px 6px; }
    .container { padding: 16px 14px 32px; }
    .studio { padding: 18px 16px; }
    .mobile-actions { gap: 6px; }
    .mobile-actions .btn { gap: 4px; padding: 0 4px; font-size: 0.74rem; }
  }
  @media (max-width: 420px) {
    .lock-label { display: none; }
    #lockBtn { width: 36px; min-height: 36px; padding: 0; }
  }
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-inner">
    <a href="/" class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M122.34,71.43l29.38-29.37a44,44,0,0,1,62.22,62.22l-41.37,41.38a44,44,0,0,1-62.23,0"/><path d="M133.66,184.57l-29.38,29.37a44,44,0,0,1-62.22-62.22l41.37-41.38a44,44,0,0,1,62.23,0"/></svg>
      </span>
      <span class="brand-name">TinyLink</span>
      <span class="brand-tag ${authRequired ? "secured" : ""}" id="modeBadge">${authRequired ? "Private Vault" : "Public Console"}</span>
    </a>

    <div class="topbar-actions">
      <button type="button" class="btn btn-ghost btn-icon" id="shortcutsBtn" hidden aria-label="Personal shortcuts &amp; quick setup" title="Bookmarklet, Omnibox &amp; Phone Shortcuts">
        <svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="32" y="64" width="192" height="128" rx="12"/><line x1="68" y1="104" x2="76" y2="104"/><line x1="104" y1="104" x2="112" y2="104"/><line x1="140" y1="104" x2="148" y2="104"/><line x1="176" y1="104" x2="188" y2="104"/><line x1="76" y1="148" x2="180" y2="148"/></svg>
      </button>
      <button type="button" class="btn btn-ghost btn-sm" id="lockBtn" hidden aria-label="Lock dashboard">
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="40" y="88" width="176" height="128" rx="8"/><path d="M92,88V52a36,36,0,0,1,72,0V88"/></svg>
        <span class="lock-label">Lock</span>
      </button>
      <button type="button" class="btn btn-ghost btn-icon" id="themeBtn" aria-label="Toggle color theme" aria-pressed="false" title="Toggle Light/Dark theme">
        <span id="themeIcon" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</header>

<main class="container">
  <!-- Auth Vault Screen -->
  <section class="card vault-wrap" id="authVault" hidden aria-labelledby="vaultHeading">
    <div class="vault-icon" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="40" y="88" width="176" height="128" rx="8"/><path d="M92,88V52a36,36,0,0,1,72,0V88"/><circle cx="128" cy="152" r="12"/></svg>
    </div>
    <h1 class="vault-title" id="vaultHeading">Unlock TinyLink Console</h1>
    <p class="vault-desc">This instance is password protected. Enter your admin token to create links and inspect analytics.</p>

    <div class="alert-box" id="authError" role="alert" tabindex="-1" hidden>
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="128" r="96"/><line x1="128" y1="80" x2="128" y2="136"/><circle cx="128" cy="172" r="8" fill="currentColor"/></svg>
      <span id="authErrorText"></span>
    </div>

    <form id="authForm">
      <input type="text" name="username" autocomplete="username" value="tinylink-admin" class="sr-only" tabindex="-1" aria-hidden="true">
      <label for="adminToken" class="sr-only">Admin Token</label>
      <div class="input-wrap" style="margin-bottom:14px;">
        <input
          type="password"
          id="adminToken"
          name="token"
          class="input-field input-with-btn mono"
          placeholder="Enter admin token..."
          autocomplete="current-password"
          aria-describedby="authErrorText"
          required
        >
        <button type="button" class="input-suffix-btn" id="toggleTokenVis" aria-label="Show admin token" aria-pressed="false">
          <span id="eyeIcon" aria-hidden="true"></span>
        </button>
      </div>
      <button type="submit" class="btn btn-primary" id="unlockBtn" style="width:100%;min-height:44px;">
        <span>Unlock Console</span>
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="40" y1="128" x2="216" y2="128"/><polyline points="144 56 216 128 144 200"/></svg>
      </button>
    </form>
  </section>

  <!-- Authenticated Workspace -->
  <div id="appWorkspace" hidden>
    <!-- Shorten Studio -->
    <section class="card studio" aria-labelledby="studioHeading">
      <div class="studio-header">
        <div>
          <h1 class="studio-title" id="studioHeading">Shorten &amp; Configure Link</h1>
          <p class="studio-sub">Create edge-cached redirects with instant QR generation and optional TTL expiration.</p>
        </div>
      </div>

      <div class="alert-box" id="shortenError" role="alert" tabindex="-1" hidden>
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="128" r="96"/><line x1="128" y1="80" x2="128" y2="136"/><circle cx="128" cy="172" r="8" fill="currentColor"/></svg>
        <span id="shortenErrorText"></span>
      </div>

      <form id="shortenForm" novalidate>
        <div class="shorten-primary-row">
          <div class="input-wrap" style="flex:1;">
            <label for="urlInput" class="sr-only">Destination URL</label>
            <input
              type="url"
              id="urlInput"
              name="url"
              class="input-field input-with-btn"
              placeholder="https://example.com/very-long-destination-url..."
              autocomplete="url"
              aria-describedby="shortenErrorText"
              required
            >
            <button type="button" class="input-suffix-btn" id="pasteUrlBtn" title="Paste URL from clipboard" aria-label="Paste URL from clipboard">
              <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="48" y="40" width="160" height="184" rx="12"/><path d="M88,40V28a8,8,0,0,1,8-8h64a8,8,0,0,1,8,8V40"/><line x1="88" y1="112" x2="168" y2="112"/><line x1="88" y1="152" x2="144" y2="152"/></svg>
            </button>
          </div>
          <button type="submit" class="btn btn-primary" id="shortenBtn">
            <span>Shorten Link</span>
            <svg width="16" height="16" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="40" y1="128" x2="216" y2="128"/><polyline points="144 56 216 128 144 200"/></svg>
          </button>
        </div>

        <div class="studio-options-row">
          <div class="slug-group">
            <span class="slug-prefix" id="slugPrefix">/</span>
            <label for="customSlugInput" class="sr-only">Custom alias (optional)</label>
            <input
              type="text"
              id="customSlugInput"
              name="custom"
              class="slug-input"
              placeholder="custom-alias (optional)"
              maxlength="50"
              autocomplete="off"
            >
          </div>

          <div class="expiry-group">
            <span class="expiry-label" id="expiryLabel">Expires:</span>
            <div class="pill-group" role="radiogroup" aria-labelledby="expiryLabel" id="expiryPills">
              <button type="button" class="pill-btn" role="radio" aria-checked="true" data-expiry="never">Never</button>
              <button type="button" class="pill-btn" role="radio" aria-checked="false" data-expiry="1">1d</button>
              <button type="button" class="pill-btn" role="radio" aria-checked="false" data-expiry="7">7d</button>
              <button type="button" class="pill-btn" role="radio" aria-checked="false" data-expiry="30">30d</button>
              <button type="button" class="pill-btn" role="radio" aria-checked="false" data-expiry="90">90d</button>
              <button type="button" class="pill-btn" role="radio" aria-checked="false" data-expiry="365">1y</button>
            </div>
            <input type="hidden" id="expiresValue" name="expiresIn" value="never">
          </div>
        </div>
      </form>

      <!-- Result Banner -->
      <div class="result-banner" id="resultBar" hidden aria-live="polite">
        <div class="result-qr" id="resultQr" aria-label="Generated QR code"></div>
        <div class="result-info">
          <div class="result-kicker" id="resultKicker">Link Ready</div>
          <div class="result-url" id="resultUrl"></div>
        </div>
        <div class="result-actions">
          <button type="button" class="btn btn-primary btn-sm" id="copyBtn">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="40" y="72" width="144" height="144" rx="8"/><path d="M88,72V40a8,8,0,0,1,8-8H216a8,8,0,0,1,8,8V160a8,8,0,0,1-8,8H184"/></svg>
            <span id="copyBtnText">Copy</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="dlQrSvgBtn" title="Download SVG QR">SVG</button>
          <button type="button" class="btn btn-secondary btn-sm" id="dlQrPngBtn" title="Download PNG QR">PNG</button>
          <a class="btn btn-secondary btn-sm" id="tryBtn" href="#" target="_blank" rel="noopener noreferrer">
            <span>Open</span>
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M184,136v72a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8h72"/><polyline points="152 40 216 40 216 104"/><line x1="128" y1="128" x2="216" y2="40"/></svg>
          </a>
        </div>
      </div>
    </section>

    <!-- 4 Bento KPI Cards -->
    <section class="kpi-grid" id="statsRow" hidden aria-label="Link metrics summary">
      <div class="kpi-card">
        <div class="kpi-top">
          <span>Total Links</span>
          <span class="kpi-icon sky" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M122.34,71.43l29.38-29.37a44,44,0,0,1,62.22,62.22l-41.37,41.38a44,44,0,0,1-62.23,0"/><path d="M133.66,184.57l-29.38,29.37a44,44,0,0,1-62.22-62.22l41.37-41.38a44,44,0,0,1,62.23,0"/></svg>
          </span>
        </div>
        <div class="kpi-val tabular" id="statLinks">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span>Active</span>
          <span class="kpi-icon green" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><polyline points="88 136 112 160 168 104"/><circle cx="128" cy="128" r="96"/></svg>
          </span>
        </div>
        <div class="kpi-val tabular" id="statActive">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span>Total Clicks</span>
          <span class="kpi-icon sky" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><polyline points="224 128 192 128 168 48 88 208 64 128 32 128"/></svg>
          </span>
        </div>
        <div class="kpi-val tabular" id="statClicks">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span>Expired</span>
          <span class="kpi-icon amber" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><circle cx="128" cy="128" r="96"/><polyline points="128 72 128 128 176 128"/></svg>
          </span>
        </div>
        <div class="kpi-val tabular" id="statExpired">0</div>
      </div>
    </section>

    <!-- Links Command Center -->
    <section class="card command-card" aria-labelledby="linksHeading">
      <div class="command-toolbar">
        <div class="command-title-group">
          <h2 class="command-title" id="linksHeading">Your Links</h2>
          <span class="count-pill tabular" id="linkCount">0</span>
        </div>

        <div class="toolbar-controls">
          <div class="search-box">
            <span class="search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><circle cx="112" cy="112" r="80"/><line x1="168.57" y1="168.57" x2="224" y2="224"/></svg>
            </span>
            <input type="search" id="searchInput" class="search-input" placeholder="Search slug or URL..." aria-label="Search links">
            <span class="search-kbd" id="searchKbd" aria-hidden="true">/</span>
            <button type="button" class="search-clear" id="clearSearchBtn" hidden aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="200" y1="56" x2="56" y2="200"/><line x1="200" y1="200" x2="56" y2="56"/></svg>
            </button>
          </div>

          <div class="pill-group" role="group" aria-label="Filter links by status" id="statusFilterGroup">
            <button type="button" class="pill-btn" aria-pressed="true" data-filter="all">All</button>
            <button type="button" class="pill-btn" aria-pressed="false" data-filter="active">Active</button>
            <button type="button" class="pill-btn" aria-pressed="false" data-filter="expired">Expired</button>
          </div>

          <select id="sortSelect" class="sort-select" aria-label="Sort links">
            <option value="newest">Newest</option>
            <option value="clicks">Most Clicks</option>
            <option value="oldest">Oldest</option>
          </select>

          <button type="button" class="btn btn-secondary btn-sm" id="exportBtn">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M216,152v56a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V152"/><polyline points="88 112 128 152 168 112"/><line x1="128" y1="40" x2="128" y2="152"/></svg>
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div id="linksContainer"></div>
    </section>
  </div>
</main>

<footer>TinyLink Edge Shortener · Powered by Cloudflare Workers &amp; KV</footer>

<!-- Analytics & Inspector Modal -->
<div class="modal-overlay" id="analyticsModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" hidden>
  <div class="modal-dialog" tabindex="-1">
    <div class="modal-header">
      <h2 class="modal-title" id="modalTitle">
        <span id="modalLabel">Inspector</span>
        <span class="modal-slug-badge" id="modalSlug"></span>
      </h2>
      <button type="button" class="modal-close" id="modalClose" aria-label="Close modal">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="200" y1="56" x2="56" y2="200"/><line x1="200" y1="200" x2="56" y2="56"/></svg>
      </button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
(function() {
  var AUTH_REQUIRED = ${authRequired ? "true" : "false"};

  // ── SVG Icon Library (Phosphor-style, 1.75px stroke) ──
  var ICONS = {
    sun: '<svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><circle cx="128" cy="128" r="56"/><line x1="128" y1="16" x2="128" y2="40"/><line x1="128" y1="216" x2="128" y2="240"/><line x1="48.8" y1="48.8" x2="65.77" y2="65.77"/><line x1="190.23" y1="190.23" x2="207.2" y2="207.2"/><line x1="16" y1="128" x2="40" y2="128"/><line x1="216" y1="128" x2="240" y2="128"/><line x1="48.8" y1="207.2" x2="65.77" y2="190.23"/><line x1="190.23" y1="65.77" x2="207.2" y2="48.8"/></svg>',
    moon: '<svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M216.7,152.6A91.9,91.9,0,0,1,103.4,39.3,92,92,0,1,0,216.7,152.6Z"/></svg>',
    eye: '<svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Z"/><circle cx="128" cy="128" r="32"/></svg>',
    eyeSlash: '<svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><line x1="48" y1="40" x2="208" y2="216"/><path d="M154.91,157.6a32,32,0,0,1-45.3-49.76"/><path d="M74,68.6C33.23,89.24,16,128,16,128s32,72,112,72a117.65,117.65,0,0,0,54-12.6"/><path d="M208.61,169.1C228.14,149.26,240,128,240,128S208,56,128,56a126.17,126.17,0,0,0-20.68,1.68"/></svg>',
    copy: '<svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="40" y="72" width="144" height="144" rx="8"/><path d="M88,72V40a8,8,0,0,1,8-8H216a8,8,0,0,1,8,8V160a8,8,0,0,1-8,8H184"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><polyline points="216 72 104 184 48 128"/></svg>',
    chart: '<svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><line x1="48" y1="208" x2="48" y2="136"/><line x1="104" y1="208" x2="104" y2="88"/><line x1="160" y1="208" x2="160" y2="120"/><line x1="216" y1="208" x2="216" y2="48"/></svg>',
    pencil: '<svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z"/><line x1="136" y1="64" x2="192" y2="120"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><line x1="216" y1="56" x2="40" y2="56"/><line x1="104" y1="104" x2="104" y2="168"/><line x1="152" y1="104" x2="152" y2="168"/><path d="M200,56V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V56"/><path d="M168,56V40a16,16,0,0,0-16-16H104A16,16,0,0,0,88,40V56"/></svg>',
    download: '<svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M216,152v56a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V152"/><polyline points="88 112 128 152 168 112"/><line x1="128" y1="40" x2="128" y2="152"/></svg>',
    link: '<svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M122.34,71.43l29.38-29.37a44,44,0,0,1,62.22,62.22l-41.37,41.38a44,44,0,0,1-62.23,0"/><path d="M133.66,184.57l-29.38,29.37a44,44,0,0,1-62.22-62.22l41.37-41.38a44,44,0,0,1,62.23,0"/></svg>',
    search: '<svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><circle cx="112" cy="112" r="80"/><line x1="168.57" y1="168.57" x2="224" y2="224"/></svg>',
    desktop: '<svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="32" y="48" width="192" height="144" rx="12"/><line x1="96" y1="224" x2="160" y2="224"/><line x1="128" y1="192" x2="128" y2="224"/></svg>',
    mobile: '<svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="64" y="24" width="128" height="208" rx="16"/><line x1="112" y1="56" x2="144" y2="56"/></svg>',
    tablet: '<svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><rect x="48" y="32" width="160" height="192" rx="16"/><line x1="112" y1="192" x2="144" y2="192"/></svg>',
    external: '<svg width="13" height="13" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path d="M184,136v72a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8h72"/><polyline points="152 40 216 40 216 104"/><line x1="128" y1="128" x2="216" y2="40"/></svg>'
  };

  // ── State ──
  var adminToken = '';
  try { adminToken = localStorage.getItem('tl_admin_token') || ''; } catch (e) {}
  var pendingPrefillUrl = '';
  try {
    var sp = new URLSearchParams(window.location.search);
    var rawUrlParam = (sp.get('url') || '').trim();
    var rawTextParam = (sp.get('text') || '').trim();
    var candUrl = '';
    if (rawUrlParam && /^https?:\\/\\//i.test(rawUrlParam)) {
      candUrl = rawUrlParam;
    } else if (rawTextParam) {
      var urlMatch = rawTextParam.match(/https?:\\/\\/[^\\s<>"']+/i);
      if (urlMatch) candUrl = urlMatch[0];
    }
    if (candUrl) {
      try {
        var parsedCand = new URL(candUrl);
        if (parsedCand.protocol === 'http:' || parsedCand.protocol === 'https:') {
          pendingPrefillUrl = parsedCand.href;
        }
      } catch (ex) {}
    }
    if (sp.has('url') || sp.has('text') || sp.has('title')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  } catch (e) {}

  var urls = [];
  var isLoading = false;
  var currentSearch = '';
  var currentFilter = 'all';
  var currentSort = 'newest';
  var latestQrSvg = '';
  var latestSlug = '';
  var lastTriggerEl = null;
  var toastTimer = null;
  var isMobileMq = window.matchMedia('(max-width: 767px)');

  // ── DOM References ──
  var themeBtn = document.getElementById('themeBtn');
  var themeIcon = document.getElementById('themeIcon');
  var themeColorMeta = document.getElementById('themeColorMeta');
  var shortcutsBtn = document.getElementById('shortcutsBtn');
  var lockBtn = document.getElementById('lockBtn');
  var authVault = document.getElementById('authVault');
  var authForm = document.getElementById('authForm');
  var adminTokenInput = document.getElementById('adminToken');
  var toggleTokenVis = document.getElementById('toggleTokenVis');
  var eyeIcon = document.getElementById('eyeIcon');
  var unlockBtn = document.getElementById('unlockBtn');
  var authError = document.getElementById('authError');
  var authErrorText = document.getElementById('authErrorText');

  var appWorkspace = document.getElementById('appWorkspace');
  var shortenForm = document.getElementById('shortenForm');
  var urlInput = document.getElementById('urlInput');
  var pasteUrlBtn = document.getElementById('pasteUrlBtn');
  var customSlugInput = document.getElementById('customSlugInput');
  var slugPrefix = document.getElementById('slugPrefix');
  var expiryPills = document.getElementById('expiryPills');
  var expiresValue = document.getElementById('expiresValue');
  var shortenBtn = document.getElementById('shortenBtn');
  var shortenError = document.getElementById('shortenError');
  var shortenErrorText = document.getElementById('shortenErrorText');

  var resultBar = document.getElementById('resultBar');
  var resultQr = document.getElementById('resultQr');
  var resultKicker = document.getElementById('resultKicker');
  var resultUrl = document.getElementById('resultUrl');
  var copyBtn = document.getElementById('copyBtn');
  var copyBtnText = document.getElementById('copyBtnText');
  var dlQrSvgBtn = document.getElementById('dlQrSvgBtn');
  var dlQrPngBtn = document.getElementById('dlQrPngBtn');
  var tryBtn = document.getElementById('tryBtn');

  var statsRow = document.getElementById('statsRow');
  var statLinks = document.getElementById('statLinks');
  var statActive = document.getElementById('statActive');
  var statClicks = document.getElementById('statClicks');
  var statExpired = document.getElementById('statExpired');
  var linkCount = document.getElementById('linkCount');

  var searchInput = document.getElementById('searchInput');
  var searchKbd = document.getElementById('searchKbd');
  var clearSearchBtn = document.getElementById('clearSearchBtn');
  var statusFilterGroup = document.getElementById('statusFilterGroup');
  var sortSelect = document.getElementById('sortSelect');
  var exportBtn = document.getElementById('exportBtn');
  var linksContainer = document.getElementById('linksContainer');

  var modal = document.getElementById('analyticsModal');
  var modalDialog = modal.querySelector('.modal-dialog');
  var modalLabel = document.getElementById('modalLabel');
  var modalSlug = document.getElementById('modalSlug');
  var modalBody = document.getElementById('modalBody');
  var modalClose = document.getElementById('modalClose');
  var toast = document.getElementById('toast');

  // ── Utilities ──
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      toast.classList.remove('show');
    }, 2400);
  }

  function isLinkExpired(u) {
    if (u && u.expiresAt) {
      return new Date(u.expiresAt) < new Date();
    }
    return !!(u && u.isExpired);
  }

  // ── Theme Switcher ──
  function syncThemeUI() {
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    var isLight = theme === 'light';
    themeIcon.innerHTML = isLight ? ICONS.moon : ICONS.sun;
    themeBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    themeBtn.setAttribute('title', isLight ? 'Switch to Dark theme' : 'Switch to Light theme');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isLight ? '#F8FAFC' : '#090D16');
    }
  }
  syncThemeUI();

  themeBtn.addEventListener('click', function() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('tl_theme', next); } catch (e) {}
    syncThemeUI();
  });

  // ── Auth & Workspace State ──
  slugPrefix.textContent = window.location.host + '/';
  eyeIcon.innerHTML = ICONS.eye;

  toggleTokenVis.addEventListener('click', function() {
    var isPwd = adminTokenInput.type === 'password';
    adminTokenInput.type = isPwd ? 'text' : 'password';
    toggleTokenVis.setAttribute('aria-pressed', isPwd ? 'true' : 'false');
    toggleTokenVis.setAttribute('aria-label', isPwd ? 'Hide admin token' : 'Show admin token');
    eyeIcon.innerHTML = isPwd ? ICONS.eyeSlash : ICONS.eye;
  });

  function showVault(errorMsg) {
    appWorkspace.hidden = true;
    lockBtn.hidden = true;
    shortcutsBtn.hidden = true;
    authVault.hidden = false;
    if (errorMsg) {
      authErrorText.textContent = errorMsg;
      authError.hidden = false;
      adminTokenInput.setAttribute('aria-invalid', 'true');
      adminTokenInput.focus();
    } else {
      authError.hidden = true;
      adminTokenInput.removeAttribute('aria-invalid');
    }
  }

  function applyPendingPrefill() {
    if (!pendingPrefillUrl) return;
    urlInput.value = pendingPrefillUrl;
    pendingPrefillUrl = '';
    setShortenError('');
    setTimeout(function() { customSlugInput.focus(); }, 30);
    showToast('URL pre-filled — press Enter to shorten', 'success');
  }

  function showWorkspace() {
    authVault.hidden = true;
    authError.hidden = true;
    adminTokenInput.removeAttribute('aria-invalid');
    appWorkspace.hidden = false;
    lockBtn.hidden = !AUTH_REQUIRED;
    shortcutsBtn.hidden = false;
    applyPendingPrefill();
  }

  lockBtn.addEventListener('click', function() {
    adminToken = '';
    urls = [];
    try { localStorage.removeItem('tl_admin_token'); } catch (e) {}
    adminTokenInput.value = '';
    resultBar.hidden = true;
    showVault();
    showToast('Dashboard locked');
    adminTokenInput.focus();
  });

  // ── API Fetch Helper ──
  async function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers['X-Auth-Token'] = adminToken;
    var res = await fetch(path, Object.assign({}, opts, { headers: Object.assign(headers, opts.headers || {}) }));
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) {
      var err = new Error(data.error || 'Unauthorized');
      err.status = 401;
      throw err;
    }
    if (!res.ok) {
      var err2 = new Error(data.error || 'Request failed (' + res.status + ')');
      err2.status = res.status;
      throw err2;
    }
    return data;
  }

  // ── Auth Submit ──
  authForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var val = adminTokenInput.value.trim();
    if (!val) {
      showVault('Please enter your admin token.');
      return;
    }
    unlockBtn.disabled = true;
    unlockBtn.querySelector('span').textContent = 'Verifying…';
    adminToken = val;
    try {
      var data = await api('/api/list');
      try { localStorage.setItem('tl_admin_token', adminToken); } catch (e) {}
      urls = data.urls || [];
      showWorkspace();
      renderLinksView();
      showToast('Console unlocked', 'success');
    } catch (err) {
      adminToken = '';
      try { localStorage.removeItem('tl_admin_token'); } catch (e) {}
      showVault(err.status === 401 ? 'Invalid admin token. Please check and try again.' : err.message);
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.querySelector('span').textContent = 'Unlock Console';
    }
  });

  // ── Expiry Segmented Radio Group ──
  function selectExpiryBtn(btn) {
    var buttons = expiryPills.querySelectorAll('[data-expiry]');
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i] === btn;
      buttons[i].setAttribute('aria-checked', active ? 'true' : 'false');
    }
    expiresValue.value = btn.getAttribute('data-expiry');
  }

  expiryPills.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-expiry]');
    if (!btn) return;
    selectExpiryBtn(btn);
  });

  expiryPills.addEventListener('keydown', function(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var buttons = Array.prototype.slice.call(expiryPills.querySelectorAll('[data-expiry]'));
    var idx = buttons.indexOf(document.activeElement);
    if (idx === -1) return;
    e.preventDefault();
    var nextIdx = e.key === 'ArrowRight'
      ? (idx + 1) % buttons.length
      : (idx - 1 + buttons.length) % buttons.length;
    selectExpiryBtn(buttons[nextIdx]);
    buttons[nextIdx].focus();
  });

  // ── Shorten Form ──
  function setShortenError(msg) {
    if (!msg) {
      shortenError.hidden = true;
      urlInput.removeAttribute('aria-invalid');
      return;
    }
    shortenErrorText.textContent = msg;
    shortenError.hidden = false;
    urlInput.setAttribute('aria-invalid', 'true');
    urlInput.focus();
  }

  pasteUrlBtn.addEventListener('click', async function() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      urlInput.focus();
      showToast('Paste URL into the field (Ctrl+V)', '');
      return;
    }
    try {
      var text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        showToast('Clipboard is empty', 'error');
        urlInput.focus();
        return;
      }
      urlInput.value = text;
      setShortenError('');
      if (/^https?:\\/\\//i.test(text)) {
        customSlugInput.focus();
        showToast('Pasted URL from clipboard', 'success');
      } else {
        urlInput.focus();
        showToast('Pasted clipboard text — include https://', '');
      }
    } catch (e) {
      urlInput.focus();
      showToast('Press Ctrl+V (or long-press Paste) to insert URL', '');
    }
  });

  shortenForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    setShortenError('');

    var url = urlInput.value.trim();
    var custom = customSlugInput.value.trim();
    var expiresIn = expiresValue.value;

    if (!url) {
      setShortenError('Enter a destination URL to shorten.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setShortenError('Destination URL must start with http:// or https://');
      return;
    }
    if (custom && !/^[a-zA-Z0-9_-]{2,50}$/.test(custom)) {
      setShortenError('Custom alias must be 2–50 characters using letters, numbers, "_" or "-".');
      return;
    }

    shortenBtn.disabled = true;
    shortenBtn.querySelector('span').textContent = 'Shortening…';

    try {
      var data = await api('/api/shorten', {
        method: 'POST',
        body: JSON.stringify({ url: url, custom: custom, expiresIn: expiresIn })
      });

      latestQrSvg = data.qrSvg || '';
      latestSlug = data.slug || 'tinylink';
      resultQr.innerHTML = latestQrSvg;
      resultKicker.textContent = data.expiresAt ? 'Link Ready · Expires ' + fmtDate(data.expiresAt) : 'Link Ready';
      resultUrl.textContent = data.shortUrl;
      tryBtn.href = data.shortUrl;
      resultBar.hidden = false;
      copyBtnText.textContent = 'Copy';

      shortenForm.reset();
      expiresValue.value = 'never';
      var pills = expiryPills.querySelectorAll('[data-expiry]');
      for (var i = 0; i < pills.length; i++) {
        pills[i].setAttribute('aria-checked', pills[i].getAttribute('data-expiry') === 'never' ? 'true' : 'false');
      }

      showToast('Short link created', 'success');
      await loadLinks();
    } catch (err) {
      if (err.status === 401) {
        showVault('Your session expired. Please re-enter your admin token.');
      } else {
        setShortenError(err.message);
      }
    } finally {
      shortenBtn.disabled = false;
      shortenBtn.querySelector('span').textContent = 'Shorten Link';
    }
  });

  // ── Clipboard & QR Download Helpers ──
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (ex) {}
      document.body.removeChild(ta);
      return ok;
    }
  }

  copyBtn.addEventListener('click', async function() {
    if (!resultUrl.textContent) return;
    await copyText(resultUrl.textContent);
    copyBtnText.textContent = 'Copied!';
    showToast('Copied short link', 'success');
    setTimeout(function() { copyBtnText.textContent = 'Copy'; }, 1800);
  });

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSvg(svgContent, filename) {
    if (!svgContent) return showToast('QR code unavailable', 'error');
    var blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    showToast('Downloaded SVG QR code', 'success');
  }

  function downloadPngFromSvg(svgContent, filename) {
    if (!svgContent) return showToast('QR code unavailable', 'error');
    var svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();
    img.onload = function() {
      var size = 512;
      var pad = 28;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(pngBlob) {
        if (pngBlob) {
          triggerBlobDownload(pngBlob, filename);
          showToast('Downloaded PNG QR code', 'success');
        }
      }, 'image/png');
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      showToast('Failed to export PNG', 'error');
    };
    img.src = url;
  }

  dlQrSvgBtn.addEventListener('click', function() {
    downloadSvg(latestQrSvg, latestSlug + '-qr.svg');
  });
  dlQrPngBtn.addEventListener('click', function() {
    downloadPngFromSvg(latestQrSvg, latestSlug + '-qr.png');
  });

  // ── Load Links ──
  async function loadLinks() {
    isLoading = true;
    if (!urls.length) renderLinksView();
    try {
      var data = await api('/api/list');
      urls = data.urls || [];
      isLoading = false;
      renderLinksView();
    } catch (err) {
      isLoading = false;
      if (err.status === 401) {
        adminToken = '';
        try { localStorage.removeItem('tl_admin_token'); } catch (e) {}
        showVault('Authentication required. Please enter your admin token.');
      } else {
        linksContainer.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-icon">' + ICONS.link + '</div>' +
            '<div class="empty-title">Unable to load links</div>' +
            '<div class="empty-desc">' + escapeHtml(err.message) + '</div>' +
          '</div>';
        showToast('Failed to load links', 'error');
      }
    }
  }

  // ── Render KPI & Links View ──
  function getProcessedLinks() {
    var q = currentSearch.trim().toLowerCase();
    var list = urls.filter(function(u) {
      var expired = isLinkExpired(u);
      if (currentFilter === 'active' && expired) return false;
      if (currentFilter === 'expired' && !expired) return false;
      if (q) {
        return u.slug.toLowerCase().indexOf(q) !== -1 || u.originalUrl.toLowerCase().indexOf(q) !== -1;
      }
      return true;
    });

    list.sort(function(a, b) {
      if (currentSort === 'clicks') return (b.clicks || 0) - (a.clicks || 0);
      if (currentSort === 'oldest') return a.createdAt > b.createdAt ? 1 : -1;
      return b.createdAt > a.createdAt ? 1 : -1;
    });
    return list;
  }

  function renderLinksView() {
    if (isLoading && !urls.length) {
      linksContainer.innerHTML =
        '<div class="skeleton-wrap" aria-busy="true" aria-label="Loading links">' +
          '<div class="skeleton-row"></div>' +
          '<div class="skeleton-row"></div>' +
          '<div class="skeleton-row"></div>' +
        '</div>';
      return;
    }

    var totalClicks = urls.reduce(function(s, u) { return s + (u.clicks || 0); }, 0);
    var activeCount = urls.filter(function(u) { return !isLinkExpired(u); }).length;
    var expiredCount = urls.filter(function(u) { return isLinkExpired(u); }).length;

    statsRow.hidden = urls.length === 0;
    statLinks.textContent = urls.length.toLocaleString();
    statActive.textContent = activeCount.toLocaleString();
    statClicks.textContent = totalClicks.toLocaleString();
    statExpired.textContent = expiredCount.toLocaleString();

    var filtered = getProcessedLinks();
    linkCount.textContent = filtered.length === urls.length
      ? String(urls.length)
      : filtered.length + ' / ' + urls.length;

    if (!urls.length) {
      linksContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">' + ICONS.link + '</div>' +
          '<div class="empty-title">No shortened links yet</div>' +
          '<div class="empty-desc">Paste a URL in the form above to generate your first short link and QR code.</div>' +
        '</div>';
      return;
    }

    if (!filtered.length) {
      linksContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">' + ICONS.search + '</div>' +
          '<div class="empty-title">No matching links</div>' +
          '<div class="empty-desc">Try adjusting your search query or status filter.</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="resetFiltersBtn" style="margin-top:14px;">Reset Filters</button>' +
        '</div>';
      var resetFiltersBtn = document.getElementById('resetFiltersBtn');
      if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
          searchInput.value = '';
          currentSearch = '';
          currentFilter = 'all';
          syncSearchUI();
          var fBtns = statusFilterGroup.querySelectorAll('[data-filter]');
          for (var j = 0; j < fBtns.length; j++) {
            fBtns[j].setAttribute('aria-pressed', fBtns[j].getAttribute('data-filter') === 'all' ? 'true' : 'false');
          }
          renderLinksView();
        });
      }
      return;
    }

    if (isMobileMq.matches) {
      linksContainer.innerHTML = '<div class="mobile-list">' + filtered.map(function(u) {
        var slugEsc = escapeHtml(u.slug);
        var urlEsc = escapeHtml(u.originalUrl);
        var statusHtml = isLinkExpired(u)
          ? '<span class="status-pill expired"><span class="status-dot"></span>Expired</span>'
          : '<span class="status-pill active"><span class="status-dot"></span>Active</span>';

        return '<article class="mobile-item">' +
          '<div class="mobile-item-head">' +
            '<a class="slug-link" href="/' + slugEsc + '" target="_blank" rel="noopener noreferrer">/' + slugEsc + ' ' + ICONS.external + '</a>' +
            statusHtml +
          '</div>' +
          '<div class="mobile-dest" title="' + urlEsc + '">' + urlEsc + '</div>' +
          '<div class="mobile-meta">' +
            '<span class="tabular"><strong>' + (u.clicks || 0).toLocaleString() + '</strong> clicks</span>' +
            '<span>Created ' + fmtDate(u.createdAt) + (u.expiresAt ? ' · Exp ' + fmtDate(u.expiresAt) : '') + '</span>' +
          '</div>' +
          '<div class="mobile-actions">' +
            '<button type="button" class="btn btn-secondary" data-action="copy" data-slug="' + slugEsc + '" aria-label="Copy link /' + slugEsc + '">' + ICONS.copy + '<span>Copy</span></button>' +
            '<button type="button" class="btn btn-secondary" data-action="analytics" data-slug="' + slugEsc + '" aria-label="Analytics for /' + slugEsc + '">' + ICONS.chart + '<span>Stats</span></button>' +
            '<button type="button" class="btn btn-secondary" data-action="edit" data-slug="' + slugEsc + '" aria-label="Edit /' + slugEsc + '">' + ICONS.pencil + '<span>Edit</span></button>' +
            '<button type="button" class="btn btn-danger" data-action="delete" data-slug="' + slugEsc + '" aria-label="Delete /' + slugEsc + '">' + ICONS.trash + '<span>Del</span></button>' +
          '</div>' +
        '</article>';
      }).join('') + '</div>';
      return;
    }

    linksContainer.innerHTML =
      '<div class="table-scroll"><table><thead><tr>' +
        '<th>Short Link</th>' +
        '<th>Destination</th>' +
        '<th>Clicks</th>' +
        '<th>Status</th>' +
        '<th>Created</th>' +
        '<th style="text-align:right;">Actions</th>' +
      '</tr></thead><tbody>' +
      filtered.map(function(u) {
        var slugEsc = escapeHtml(u.slug);
        var urlEsc = escapeHtml(u.originalUrl);
        var statusHtml = isLinkExpired(u)
          ? '<span class="status-pill expired"><span class="status-dot"></span>Expired</span>'
          : '<span class="status-pill active"><span class="status-dot"></span>Active</span>';

        return '<tr>' +
          '<td><a class="slug-link" href="/' + slugEsc + '" target="_blank" rel="noopener noreferrer">/' + slugEsc + ' ' + ICONS.external + '</a></td>' +
          '<td><div class="dest-text" title="' + urlEsc + '">' + urlEsc + '</div></td>' +
          '<td><span class="clicks-num tabular">' + (u.clicks || 0).toLocaleString() + '</span></td>' +
          '<td>' + statusHtml + '</td>' +
          '<td><span class="tabular" style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">' + fmtDate(u.createdAt) + '</span></td>' +
          '<td><div class="row-actions">' +
            '<button type="button" class="btn btn-secondary btn-icon" data-action="copy" data-slug="' + slugEsc + '" title="Copy short URL" aria-label="Copy short URL /' + slugEsc + '">' + ICONS.copy + '</button>' +
            '<button type="button" class="btn btn-secondary btn-icon" data-action="analytics" data-slug="' + slugEsc + '" title="Inspect analytics & QR" aria-label="Inspect analytics for /' + slugEsc + '">' + ICONS.chart + '</button>' +
            '<button type="button" class="btn btn-secondary btn-icon" data-action="edit" data-slug="' + slugEsc + '" title="Edit destination URL" aria-label="Edit destination for /' + slugEsc + '">' + ICONS.pencil + '</button>' +
            '<button type="button" class="btn btn-danger btn-icon" data-action="delete" data-slug="' + slugEsc + '" title="Delete link" aria-label="Delete /' + slugEsc + '">' + ICONS.trash + '</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  // ── Event Delegation for Table & Mobile Actions ──
  linksContainer.addEventListener('click', async function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var slug = btn.getAttribute('data-slug');
    if (!slug) return;

    if (action === 'copy') {
      var full = window.location.origin + '/' + slug;
      await copyText(full);
      var origHtml = btn.innerHTML;
      btn.innerHTML = ICONS.check + (isMobileMq.matches ? '<span>Copied</span>' : '');
      showToast('Copied ' + full, 'success');
      setTimeout(function() { btn.innerHTML = origHtml; }, 1400);
      return;
    }

    if (action === 'analytics' || action === 'edit' || action === 'delete') {
      lastTriggerEl = btn;
      openInspectorModal(slug, action === 'edit' ? 'edit' : (action === 'delete' ? 'delete' : 'view'));
    }
  });

  // ── Search, Filter & Sort Listeners ──
  function syncSearchUI() {
    var hasVal = searchInput.value.length > 0;
    clearSearchBtn.hidden = !hasVal;
    searchKbd.hidden = hasVal || document.activeElement === searchInput;
  }

  searchInput.addEventListener('input', function() {
    currentSearch = searchInput.value;
    syncSearchUI();
    renderLinksView();
  });
  searchInput.addEventListener('focus', syncSearchUI);
  searchInput.addEventListener('blur', syncSearchUI);

  clearSearchBtn.addEventListener('click', function() {
    searchInput.value = '';
    currentSearch = '';
    syncSearchUI();
    renderLinksView();
    searchInput.focus();
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!modal.hidden || !authVault.hidden) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === 'n') {
      e.preventDefault();
      urlInput.focus();
    }
  });

  statusFilterGroup.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    currentFilter = btn.getAttribute('data-filter');
    var btns = statusFilterGroup.querySelectorAll('[data-filter]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', btns[i] === btn ? 'true' : 'false');
    }
    renderLinksView();
  });

  sortSelect.addEventListener('change', function() {
    currentSort = sortSelect.value;
    renderLinksView();
  });

  isMobileMq.addEventListener('change', renderLinksView);

  // ── CSV Export ──
  exportBtn.addEventListener('click', function() {
    if (!urls.length) return showToast('No links to export', 'error');
    var header = ['Slug', 'Original URL', 'Short URL', 'Clicks', 'Created At', 'Expires At', 'Status'];
    var rows = urls.map(function(u) {
      return [
        '"' + u.slug.replace(/"/g, '""') + '"',
        '"' + u.originalUrl.replace(/"/g, '""') + '"',
        '"' + window.location.origin + '/' + u.slug + '"',
        u.clicks || 0,
        '"' + (u.createdAt || '') + '"',
        '"' + (u.expiresAt || '') + '"',
        isLinkExpired(u) ? 'Expired' : 'Active'
      ].join(',');
    });
    var csv = [header.join(',')].concat(rows).join('\\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(blob, 'tinylink-export-' + new Date().toISOString().slice(0, 10) + '.csv');
    showToast('Exported ' + urls.length + ' links to CSV', 'success');
  });

  // ── SVG Timeline Chart Builder ──
  function buildSvgTimeline(timeline) {
    if (!timeline || !timeline.length) {
      return '<div class="svg-chart-wrap" style="text-align:center;color:var(--text-muted);font-size:0.84rem;padding:24px;">No clicks recorded yet.</div>';
    }
    var W = 540, H = 136, padL = 28, padR = 10, padT = 12, padB = 24;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var maxCount = Math.max.apply(null, timeline.map(function(t) { return t.count; }).concat([1]));
    var step = plotW / timeline.length;
    var barW = Math.max(8, Math.min(34, step * 0.65));

    var gridSvg = [0, 0.5, 1].map(function(ratio) {
      var y = padT + plotH - ratio * plotH;
      var val = Math.round(maxCount * ratio);
      return '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="var(--border)" stroke-dasharray="3 3" stroke-width="1"/>' +
        '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="Fira Code, monospace">' + val + '</text>';
    }).join('');

    var barsSvg = timeline.map(function(t, idx) {
      var h = Math.max(4, (t.count / maxCount) * plotH);
      var x = padL + idx * step + (step - barW) / 2;
      var y = padT + plotH - h;
      var labelEsc = escapeHtml(t.label);
      var labelFull = labelEsc + ': ' + t.count + (t.count === 1 ? ' click' : ' clicks');
      return '<g class="chart-bar-group" tabindex="0" role="listitem" aria-label="' + labelFull + '" data-chart-label="' + labelFull + '">' +
        '<rect class="chart-focus-ring" x="' + (x - 2).toFixed(1) + '" y="' + (y - 2).toFixed(1) + '" width="' + (barW + 4).toFixed(1) + '" height="' + (h + 4).toFixed(1) + '" rx="5"/>' +
        '<rect class="chart-bar-rect" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4"/>' +
        '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="Fira Code, monospace">' + labelEsc + '</text>' +
      '</g>';
    }).join('');

    return '<div class="svg-chart-wrap">' +
      '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="list" aria-label="Click timeline bar chart">' +
        gridSvg + barsSvg +
      '</svg>' +
    '</div>';
  }

  // ── Accessible Modal Control ──
  function openModalElement() {
    modal.hidden = false;
    modal.classList.add('open');
    modalClose.focus();
  }

  function closeModalElement() {
    modal.classList.remove('open');
    modal.hidden = true;
    if (lastTriggerEl && typeof lastTriggerEl.focus === 'function') {
      lastTriggerEl.focus();
      lastTriggerEl = null;
    }
  }

  modalClose.addEventListener('click', closeModalElement);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModalElement();
  });
  document.addEventListener('keydown', function(e) {
    if (!modal.hidden && e.key === 'Escape') {
      e.preventDefault();
      closeModalElement();
    }
    if (!modal.hidden && e.key === 'Tab') {
      var focusables = modalDialog.querySelectorAll('button:not([disabled]):not([hidden]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // ── Personal Shortcuts & Tools Modal ──
  function openShortcutsModal() {
    var origin = window.location.origin;
    var bmCode = "javascript:void(window.open('" + origin + "/?url='+encodeURIComponent(location.href),'_blank'))";
    var searchTemplate = origin + '/?url=%s';
    var psCmd = 'Invoke-RestMethod -Method Post -Uri "' + origin + '/api/shorten" -Headers @{"X-Auth-Token"="<YOUR_ADMIN_TOKEN>"} -ContentType "application/json" -Body (@{url="https://example.com"}|ConvertTo-Json)';

    modalLabel.textContent = 'Personal Shortcuts';
    modalSlug.textContent = window.location.host;
    modalSlug.hidden = false;

    modalBody.innerHTML =
      '<div class="tool-card">' +
        '<div class="tool-head">' +
          '<span class="tool-title">1. One-Click Browser Bookmarklet</span>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<a id="bookmarkletDragLink" class="btn btn-primary btn-sm" title="Drag this button to your bookmarks bar">Shorten with TinyLink</a>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="copyBookmarkletBtn">' + ICONS.copy + '<span>Copy Code</span></button>' +
          '</div>' +
        '</div>' +
        '<p class="tool-desc">Drag the green button onto your browser bookmarks bar (or copy the code below as a bookmark URL) to pre-fill any open webpage into TinyLink in one click.</p>' +
        '<div class="code-snippet" id="bmSnippet"></div>' +
      '</div>' +

      '<div class="tool-card">' +
        '<div class="tool-head">' +
          '<span class="tool-title">2. Chrome / Edge Address Bar Shortcut</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="copyOmniboxBtn">' + ICONS.copy + '<span>Copy URL</span></button>' +
        '</div>' +
        '<p class="tool-desc">In Chrome Settings → Search engine → Site search → Add shortcut <strong>tl</strong> with this URL pattern. Type <strong>tl</strong> + Tab and paste any URL in your address bar:</p>' +
        '<div class="code-snippet">' + escapeHtml(searchTemplate) + '</div>' +
      '</div>' +

      '<div class="tool-card">' +
        '<div class="tool-title">3. Android &amp; iOS Share Sheet (PWA)</div>' +
        '<p class="tool-desc">Open this page in Chrome on Android and tap <strong>Install app</strong> (or Add to Home screen). TinyLink registers as a system <strong>Share Target</strong> so you can shorten links straight from YouTube, Reddit, or mobile browsers. On iOS Safari, tap <strong>Share → Add to Home Screen</strong>.</p>' +
      '</div>' +

      '<div class="tool-card">' +
        '<div class="tool-head">' +
          '<span class="tool-title">4. Windows PowerShell Quick Shorten</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="copyPsBtn">' + ICONS.copy + '<span>Copy Command</span></button>' +
        '</div>' +
        '<div class="code-snippet">' + escapeHtml(psCmd) + '</div>' +
      '</div>';

    var bmDrag = document.getElementById('bookmarkletDragLink');
    bmDrag.setAttribute('href', bmCode);
    document.getElementById('bmSnippet').textContent = bmCode;

    bmDrag.addEventListener('click', function(ev) {
      ev.preventDefault();
      copyText(bmCode);
      showToast('Drag to bookmarks bar — code also copied!', 'success');
    });
    document.getElementById('copyBookmarkletBtn').addEventListener('click', async function() {
      await copyText(bmCode);
      showToast('Bookmarklet code copied', 'success');
    });
    document.getElementById('copyOmniboxBtn').addEventListener('click', async function() {
      await copyText(searchTemplate);
      showToast('Omnibox search URL copied', 'success');
    });
    document.getElementById('copyPsBtn').addEventListener('click', async function() {
      await copyText(psCmd);
      showToast('PowerShell command copied', 'success');
    });

    openModalElement();
  }

  shortcutsBtn.addEventListener('click', function() {
    lastTriggerEl = shortcutsBtn;
    openShortcutsModal();
  });

  // ── Open Link Inspector Modal ──
  async function openInspectorModal(slug, mode) {
    modalLabel.textContent = 'Inspector';
    modalSlug.textContent = '/' + slug;
    modalSlug.hidden = false;
    modalBody.innerHTML = '<div class="skeleton-wrap" style="padding:0;"><div class="skeleton-row"></div><div class="skeleton-row" style="height:120px;"></div></div>';
    openModalElement();

    try {
      var data = await api('/api/analytics/' + encodeURIComponent(slug));
      var shortFull = window.location.origin + '/' + slug;
      var slugEsc = escapeHtml(slug);
      var origEsc = escapeHtml(data.originalUrl);

      var topReferrers = Object.entries(data.referrers || {}).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
      var maxRef = topReferrers.length ? topReferrers[0][1] : 1;

      var topDevices = Object.entries(data.devices || {}).sort(function(a, b) { return b[1] - a[1]; });
      var totalDev = topDevices.reduce(function(s, pair) { return s + pair[1]; }, 0) || 1;
      var devColors = { desktop: '#38BDF8', mobile: '#22C55E', tablet: '#F59E0B' };

      var statusBadge = data.isExpired
        ? '<span class="status-pill expired"><span class="status-dot"></span>Expired</span>'
        : '<span class="status-pill active"><span class="status-dot"></span>' + (data.lastClicked ? 'Active' : 'Ready (0 clicks)') + '</span>';

      var refSection = topReferrers.length
        ? '<div class="ref-list">' + topReferrers.map(function(item) {
            var pct = Math.round((item[1] / maxRef) * 100);
            return '<div><div class="ref-item"><span>' + escapeHtml(item[0]) + '</span><span class="mono tabular" style="font-weight:600;">' + item[1] + '</span></div>' +
              '<div class="ref-bar-bg"><div class="ref-bar-fill" style="width:' + pct + '%;"></div></div></div>';
          }).join('') + '</div>'
        : '<p style="font-size:0.83rem;color:var(--text-muted);">No referrer data yet.</p>';

      var devSection = topDevices.length
        ? '<div class="device-stack-bar">' +
            topDevices.map(function(item) {
              var pct = ((item[1] / totalDev) * 100).toFixed(1);
              var col = devColors[item[0]] || '#94A3B8';
              return '<span style="width:' + pct + '%;background:' + col + ';"></span>';
            }).join('') +
          '</div>' +
          '<div class="legend-list">' +
            topDevices.map(function(item) {
              var pct = Math.round((item[1] / totalDev) * 100);
              var col = devColors[item[0]] || '#94A3B8';
              var icon = ICONS[item[0]] || ICONS.desktop;
              return '<div class="legend-item">' +
                '<span class="legend-left"><span class="legend-dot" style="background:' + col + ';"></span>' + icon + '<span>' + escapeHtml(item[0]) + '</span></span>' +
                '<span class="mono tabular" style="color:var(--text-muted);">' + item[1] + ' (' + pct + '%)</span>' +
              '</div>';
            }).join('') +
          '</div>'
        : '<p style="font-size:0.83rem;color:var(--text-muted);">No device data yet.</p>';

      modalBody.innerHTML =
        '<div>' +
          '<div class="section-head"><span>Destination URL</span>' + statusBadge + '</div>' +
          '<div class="modal-url-box">' + origEsc + '</div>' +
        '</div>' +

        '<div class="modal-stats-grid">' +
          '<div class="modal-stat"><div class="modal-stat-label">Total Clicks</div><div class="modal-stat-val tabular" style="color:var(--accent);">' + (data.clicks || 0).toLocaleString() + '</div></div>' +
          '<div class="modal-stat"><div class="modal-stat-label">Last Clicked</div><div class="modal-stat-val tabular" style="font-size:0.88rem;">' + (data.lastClicked ? fmtDate(data.lastClicked) : 'Never') + '</div></div>' +
          '<div class="modal-stat"><div class="modal-stat-label">Expires</div><div class="modal-stat-val tabular" style="font-size:0.88rem;color:' + (data.isExpired ? 'var(--danger)' : 'var(--text)') + ';">' + (data.expiresAt ? fmtDate(data.expiresAt) : 'Never') + '</div></div>' +
        '</div>' +

        '<div>' +
          '<div class="section-head"><span>Click Timeline</span><span class="chart-readout" id="chartReadout">Hover or focus a bar</span></div>' +
          buildSvgTimeline(data.clickTimeline) +
        '</div>' +

        '<div class="breakdown-grid">' +
          '<div><div class="section-head"><span>Devices</span></div>' + devSection + '</div>' +
          '<div><div class="section-head"><span>Top Referrers</span></div>' + refSection + '</div>' +
        '</div>' +

        '<div>' +
          '<div class="section-head"><span>QR Studio</span></div>' +
          '<div class="qr-studio">' +
            '<div class="qr-studio-box">' + (data.qrSvg || '') + '</div>' +
            '<div class="qr-studio-meta">' +
              '<a class="qr-studio-link" href="' + escapeHtml(shortFull) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(shortFull) + '</a>' +
              '<div class="qr-btn-row">' +
                '<button type="button" class="btn btn-secondary btn-sm" id="modalCopyBtn">' + ICONS.copy + '<span>Copy Link</span></button>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="modalDlSvgBtn">' + ICONS.download + '<span>SVG</span></button>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="modalDlPngBtn">' + ICONS.download + '<span>PNG</span></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="section-head"><span>Update Destination &amp; Expiry</span></div>' +
          '<div class="alert-box" id="editError" role="alert" hidden><span id="editErrorText"></span></div>' +
          '<form id="editForm" class="edit-stack" novalidate>' +
            '<div class="edit-row">' +
              '<label for="editUrlInput" class="sr-only">New destination URL</label>' +
              '<input type="url" id="editUrlInput" class="input-field" value="' + origEsc + '" placeholder="https://new-destination.com" required>' +
            '</div>' +
            '<div class="edit-row" style="align-items:center;">' +
              '<label for="editExpirySelect" style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">Expiration:</label>' +
              '<select id="editExpirySelect" class="sort-select" style="flex:1;min-height:40px;">' +
                '<option value="keep">Keep current (' + (data.expiresAt ? fmtDate(data.expiresAt) : 'Never') + ')</option>' +
                '<option value="never">Never expire</option>' +
                '<option value="1">Expire in 1 day</option>' +
                '<option value="7">Expire in 7 days</option>' +
                '<option value="30">Expire in 30 days</option>' +
                '<option value="90">Expire in 90 days</option>' +
                '<option value="365">Expire in 1 year</option>' +
              '</select>' +
              '<button type="submit" class="btn btn-primary" id="saveEditBtn">Save Changes</button>' +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="danger-zone" id="dangerZone">' +
          '<span class="danger-zone-text" id="dangerText">Delete <strong>/' + slugEsc + '</strong> permanently?</span>' +
          '<div class="danger-zone-btns">' +
            '<button type="button" class="btn btn-danger btn-sm" id="initDeleteBtn">' + ICONS.trash + '<span>Delete Link</span></button>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="cancelDeleteBtn" hidden>Cancel</button>' +
            '<button type="button" class="btn btn-danger-solid btn-sm" id="confirmDeleteBtn" hidden>Confirm Delete</button>' +
          '</div>' +
        '</div>';

      // Wire chart focus/hover readout
      var readout = document.getElementById('chartReadout');
      var bars = modalBody.querySelectorAll('.chart-bar-group');
      for (var i = 0; i < bars.length; i++) {
        (function(barEl) {
          var txt = barEl.getAttribute('data-chart-label');
          barEl.addEventListener('mouseenter', function() { if (readout) readout.textContent = txt; });
          barEl.addEventListener('focus', function() { if (readout) readout.textContent = txt; });
        })(bars[i]);
      }

      // Wire QR & Copy buttons
      document.getElementById('modalCopyBtn').addEventListener('click', async function() {
        await copyText(shortFull);
        showToast('Copied ' + shortFull, 'success');
      });
      document.getElementById('modalDlSvgBtn').addEventListener('click', function() {
        downloadSvg(data.qrSvg, slug + '-qr.svg');
      });
      document.getElementById('modalDlPngBtn').addEventListener('click', function() {
        downloadPngFromSvg(data.qrSvg, slug + '-qr.png');
      });

      // Wire Edit form
      var editForm = document.getElementById('editForm');
      var editUrlInput = document.getElementById('editUrlInput');
      var editExpirySelect = document.getElementById('editExpirySelect');
      var saveEditBtn = document.getElementById('saveEditBtn');
      var editError = document.getElementById('editError');
      var editErrorText = document.getElementById('editErrorText');

      editForm.addEventListener('submit', async function(ev) {
        ev.preventDefault();
        editError.hidden = true;
        var nextUrl = editUrlInput.value.trim();
        var nextExpiry = editExpirySelect.value;
        if (!nextUrl || (!nextUrl.startsWith('http://') && !nextUrl.startsWith('https://'))) {
          editErrorText.textContent = 'URL must start with http:// or https://';
          editError.hidden = false;
          return;
        }
        saveEditBtn.disabled = true;
        saveEditBtn.textContent = 'Saving…';
        try {
          await api('/api/urls/' + encodeURIComponent(slug), {
            method: 'PUT',
            body: JSON.stringify({ url: nextUrl, expiresIn: nextExpiry })
          });
          showToast('Link updated', 'success');
          closeModalElement();
          await loadLinks();
        } catch (err) {
          editErrorText.textContent = err.message;
          editError.hidden = false;
        } finally {
          saveEditBtn.disabled = false;
          saveEditBtn.textContent = 'Save Changes';
        }
      });

      // Wire Safe Two-Step Delete
      var initDeleteBtn = document.getElementById('initDeleteBtn');
      var cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
      var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
      var dangerText = document.getElementById('dangerText');

      function enterDeleteConfirm() {
        dangerText.innerHTML = 'Confirm permanent deletion of <strong>/' + slugEsc + '</strong>?';
        initDeleteBtn.hidden = true;
        cancelDeleteBtn.hidden = false;
        confirmDeleteBtn.hidden = false;
        cancelDeleteBtn.focus();
      }
      function exitDeleteConfirm() {
        dangerText.innerHTML = 'Delete <strong>/' + slugEsc + '</strong> permanently?';
        initDeleteBtn.hidden = false;
        cancelDeleteBtn.hidden = true;
        confirmDeleteBtn.hidden = true;
      }

      initDeleteBtn.addEventListener('click', enterDeleteConfirm);
      cancelDeleteBtn.addEventListener('click', exitDeleteConfirm);
      confirmDeleteBtn.addEventListener('click', async function() {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting…';
        try {
          await api('/api/urls/' + encodeURIComponent(slug), { method: 'DELETE' });
          showToast('Link deleted', 'success');
          closeModalElement();
          await loadLinks();
        } catch (err) {
          showToast('Failed to delete: ' + err.message, 'error');
          confirmDeleteBtn.disabled = false;
          confirmDeleteBtn.textContent = 'Confirm Delete';
        }
      });

      if (mode === 'edit') {
        editUrlInput.focus();
      } else if (mode === 'delete') {
        enterDeleteConfirm();
      }
    } catch (err) {
      if (err.status === 401) {
        closeModalElement();
        showVault('Your session expired. Please re-enter your admin token.');
      } else {
        modalBody.innerHTML = '<div class="alert-box" role="alert"><span>' + escapeHtml(err.message) + '</span></div>';
      }
    }
  }

  // ── Bootstrap App ──
  if (!AUTH_REQUIRED || adminToken) {
    showWorkspace();
    loadLinks();
  } else {
    showVault();
  }
})();
</script>
</body>
</html>`;
}
