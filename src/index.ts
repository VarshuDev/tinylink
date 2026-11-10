import QRCode from "qrcode";
import { renderDashboardHtml } from "./frontend";
import {
  renderPasswordPage,
  renderPreviewMetaPage,
  renderPublicStatsPage,
  renderStatusPage,
} from "./pages";
import type {
  AnalyticsResponse,
  Env,
  ImportLinkInput,
  TimelineBucket,
  URLData,
  URLListEntry,
  URLMetadata,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const RESERVED_SLUGS = new Set([
  "api",
  "health",
  "favicon.ico",
  "robots.txt",
  "manifest.webmanifest",
  "icon.svg",
  "sw.js",
  "stats",
]);

const MAX_AUTH_FAILURES = 10;
const AUTH_WINDOW_SECONDS = 300;
const MAX_KV_META_BYTES = 980;

const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#090D16"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#22C55E" stroke-opacity="0.28" stroke-width="8"/>
  <path d="M214 298a72 72 0 0 0 101.82 0l50.91-50.91a72 72 0 0 0-101.82-101.82L239.45 170.7M298 214a72 72 0 0 0-101.82 0l-50.91 50.91a72 72 0 0 0 101.82 101.82l25.46-25.43" fill="none" stroke="#22C55E" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SERVICE_WORKER_JS = `const CACHE_NAME = 'tinylink-shell-v1';
const SHELL_ASSETS = ['/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/icon.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  if (req.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
  }
});
`;

function renderManifest(origin: string): string {
  return JSON.stringify(
    {
      name: "TinyLink — Link Console",
      short_name: "TinyLink",
      description: "Personal edge URL shortener, QR code studio, and click analytics.",
      start_url: "/",
      scope: "/",
      id: "/",
      display: "standalone",
      background_color: "#090D16",
      theme_color: "#090D16",
      icons: [
        {
          src: `${origin}/icon.svg`,
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
      share_target: {
        action: "/",
        method: "GET",
        enctype: "application/x-www-form-urlencoded",
        params: {
          title: "title",
          text: "text",
          url: "url",
        },
      },
    },
    null,
    2
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, Authorization",
  };
}

function json<T = unknown>(data: T, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(), ...extraHeaders },
  });
}

function err(msg: string, status = 400, extraHeaders: Record<string, string> = {}) {
  return json({ error: msg }, status, extraHeaders);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltHex = bytesToHex(salt);
  const hashHex = await sha256Hex(`${saltHex}:${password}`);
  return `v1:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [, saltHex, expectedHex] = parts;
  if (!saltHex || !expectedHex) return false;
  const computedHex = await sha256Hex(`${saltHex}:${password}`);
  return timingSafeEqual(computedHex, expectedHex);
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

interface AuthResult {
  ok: boolean;
  response?: Response;
}

async function authenticateApiRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<AuthResult> {
  if (!env.ADMIN_TOKEN) return { ok: true };

  const ip = getClientIp(req);
  const rlKey = `rl:${(await sha256Hex(ip)).slice(0, 16)}`;
  let rlRecord: { count: number; resetAt: number } | null = null;
  try {
    const rawRl = await env.URL_KV.get(rlKey);
    if (rawRl) {
      const parsed = JSON.parse(rawRl) as { count?: number; resetAt?: number };
      if (typeof parsed.count === "number" && typeof parsed.resetAt === "number") {
        rlRecord = { count: parsed.count, resetAt: parsed.resetAt };
      }
    }
  } catch {
    rlRecord = null;
  }

  const now = Date.now();
  if (rlRecord && rlRecord.count >= MAX_AUTH_FAILURES && now < rlRecord.resetAt) {
    const retryAfter = Math.max(1, Math.ceil((rlRecord.resetAt - now) / 1000));
    return {
      ok: false,
      response: err(
        "Too many failed authentication attempts. Please try again later.",
        429,
        { "Retry-After": String(retryAfter) }
      ),
    };
  }

  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  const token =
    req.headers.get("X-Auth-Token") ||
    bearerToken ||
    new URL(req.url).searchParams.get("token");

  if (token && timingSafeEqual(token, env.ADMIN_TOKEN)) {
    if (rlRecord) {
      ctx.waitUntil(env.URL_KV.delete(rlKey));
    }
    return { ok: true };
  }

  const activeWindow = rlRecord && now < rlRecord.resetAt;
  const nextCount = activeWindow ? rlRecord!.count + 1 : 1;
  const nextResetAt = activeWindow ? rlRecord!.resetAt : now + AUTH_WINDOW_SECONDS * 1000;
  try {
    await env.URL_KV.put(
      rlKey,
      JSON.stringify({ count: nextCount, resetAt: nextResetAt }),
      { expirationTtl: AUTH_WINDOW_SECONDS }
    );
  } catch {}

  return { ok: false, response: err("Unauthorized", 401) };
}

function generateSlug(len = 7): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

const PREVIEW_BOT_RE =
  /slackbot|discordbot|whatsapp|telegrambot|twitterbot|facebookexternalhit|facebot|linkedinbot|pinterest|skypeuripreview|embedly|quora link preview|applebot|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|petalbot|bytespider|ahrefsbot|semrushbot|mj12bot|gptbot|claudebot|ccbot/i;

function isPreviewBot(ua: string): boolean {
  return PREVIEW_BOT_RE.test(ua);
}

function detectDevice(ua: string): string {
  const low = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(low)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|windows phone/i.test(low))
    return "mobile";
  return "desktop";
}

function parseReferrer(referer: string | null): string {
  if (!referer) return "direct";
  try {
    return new URL(referer).hostname;
  } catch {
    return "direct";
  }
}

function getVisitorCountry(req: Request): string {
  const cf = (req as Request & { cf?: { country?: unknown } }).cf;
  if (cf && typeof cf.country === "string" && cf.country.trim()) {
    return cf.country.trim().toUpperCase();
  }
  return "Unknown";
}

function computeExpiration(days: number | null): string | null {
  if (days === null || days === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function parseExpiryInput(input: string | undefined): number | null {
  if (!input || input === "never") return null;
  const val = parseInt(input, 10);
  if (isNaN(val) || val < 1) return null;
  return val;
}

function decodeSlugParam(rawSlug: string): string | null {
  try {
    const decoded = decodeURIComponent(rawSlug).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function validateDestinationUrl(rawUrl: string | undefined, reqUrl: string): { url?: string; error?: string } {
  const url = rawUrl?.trim();
  if (!url) return { error: "Missing 'url' field" };
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { error: "URL must start with http:// or https://" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: "Invalid URL format" };
  }

  const requestHost = new URL(reqUrl).host.toLowerCase();
  const targetHost = parsedUrl.host.toLowerCase();
  const targetHostname = parsedUrl.hostname.toLowerCase();
  if (
    targetHost === requestHost ||
    targetHostname === "localhost" ||
    targetHostname === "127.0.0.1" ||
    targetHostname === "[::1]" ||
    targetHostname === "::1" ||
    targetHostname === "0.0.0.0" ||
    targetHostname === "[::]"
  ) {
    return { error: "Cannot shorten a link pointing to this shortener or localhost" };
  }

  return { url };
}

function normalizeLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 60);
  return trimmed || null;
}

function normalizeTags(raw: unknown): string[] {
  let items: string[] = [];
  if (Array.isArray(raw)) {
    items = raw.map((x) => (typeof x === "string" ? x : ""));
  } else if (typeof raw === "string") {
    items = raw.split(",");
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = item.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
      if (out.length >= 5) break;
    }
  }
  return out;
}

function parseMaxClicks(raw: unknown): { value: number | null; error?: string } {
  if (raw === undefined || raw === null || raw === "" || raw === 0 || raw === "0" || raw === "unlimited") {
    return { value: null };
  }
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(num) || num < 1 || num > 1_000_000) {
    return { value: null, error: "Max clicks must be a whole number between 1 and 1,000,000" };
  }
  return { value: num };
}

function normalizeOgText(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed || null;
}

function isLinkExpired(data: { expiresAt?: string | null }, now = new Date()): boolean {
  return data.expiresAt ? new Date(data.expiresAt) < now : false;
}

function isLinkExhausted(data: { maxClicks?: number | null; clicks?: number }): boolean {
  return typeof data.maxClicks === "number" && data.maxClicks > 0 && (data.clicks || 0) >= data.maxClicks;
}

function buildMetadataIfFits(data: URLData): URLMetadata | undefined {
  const encoder = new TextEncoder();
  const base: URLMetadata = {
    originalUrl: data.originalUrl,
    clicks: data.clicks || 0,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
  };
  const full: URLMetadata = {
    ...base,
    ...(data.label ? { label: data.label } : {}),
    ...(data.tags && data.tags.length ? { tags: data.tags } : {}),
    ...(data.maxClicks ? { maxClicks: data.maxClicks } : {}),
    ...(data.passwordHash ? { hasPassword: true } : {}),
    ...(data.publicStats ? { publicStats: true } : {}),
    ...(data.botClicks ? { botClicks: data.botClicks } : {}),
  };

  if (encoder.encode(JSON.stringify(full)).length <= MAX_KV_META_BYTES) {
    return full;
  }
  const compact: URLMetadata = {
    ...base,
    ...(data.maxClicks ? { maxClicks: data.maxClicks } : {}),
    ...(data.passwordHash ? { hasPassword: true } : {}),
    ...(data.publicStats ? { publicStats: true } : {}),
  };
  if (encoder.encode(JSON.stringify(compact)).length <= MAX_KV_META_BYTES) {
    return compact;
  }
  if (encoder.encode(JSON.stringify(base)).length <= MAX_KV_META_BYTES) {
    return base;
  }
  return undefined;
}

async function saveUrlRecord(env: Env, slug: string, data: URLData): Promise<void> {
  const metadata = buildMetadataIfFits(data);
  if (metadata) {
    await env.URL_KV.put(key(slug), JSON.stringify(data), { metadata });
  } else {
    await env.URL_KV.put(key(slug), JSON.stringify(data));
  }
}

function trimBucketRecord(rec: Record<string, number>, maxKeys: number): Record<string, number> {
  const keys = Object.keys(rec).sort();
  if (keys.length <= maxKeys) return rec;
  const keep = keys.slice(-maxKeys);
  const next: Record<string, number> = {};
  for (const k of keep) next[k] = rec[k];
  return next;
}

async function generateQR(url: string): Promise<string> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      width: 200,
      margin: 2,
      color: { dark: "#0F172A", light: "#ffffff" },
    });
  } catch {
    return qrcodeFallback();
  }
}

function qrcodeFallback(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#ffffff"/>
    <rect x="10" y="10" width="60" height="60" fill="#0F172A"/>
    <rect x="20" y="20" width="40" height="40" fill="#ffffff"/>
    <rect x="130" y="10" width="60" height="60" fill="#0F172A"/>
    <rect x="140" y="20" width="40" height="40" fill="#ffffff"/>
    <rect x="10" y="130" width="60" height="60" fill="#0F172A"/>
    <rect x="20" y="140" width="40" height="40" fill="#ffffff"/>
    <text x="100" y="185" text-anchor="middle" fill="#475569" font-size="11" font-family="sans-serif">QR Code</text>
  </svg>`;
}

function key(slug: string) {
  return `u:${slug}`;
}

// ─── Timeline aggregation ─────────────────────────────────────────────────────

export function aggregateTimeline(data: Pick<URLData, "clickTimeline" | "dailyClicks" | "hourlyClicks">): TimelineBucket[] {
  const dailyKeys = Object.keys(data.dailyClicks || {}).sort();
  const hourlyKeys = Object.keys(data.hourlyClicks || {}).sort();

  if (hourlyKeys.length > 0 && dailyKeys.length <= 2) {
    const cutoffMs = Date.now() - 48 * 3600 * 1000;
    const recentHourly = hourlyKeys.filter((k) => {
      const parsed = Date.parse(`${k}:00:00Z`);
      return isNaN(parsed) || parsed >= cutoffMs;
    });
    if (recentHourly.length > 0) {
      return recentHourly.slice(-16).map((k) => ({
        label: `${k.slice(11, 13)}:00`,
        count: data.hourlyClicks![k],
      }));
    }
  }

  if (dailyKeys.length > 0) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return dailyKeys.slice(-30).map((k) => {
      const mIdx = parseInt(k.slice(5, 7), 10) - 1;
      const dayNum = k.slice(8, 10);
      const label = mIdx >= 0 && mIdx < 12 ? `${months[mIdx]} ${dayNum}` : k;
      return { label, count: data.dailyClicks![k] };
    });
  }

  // Fallback for legacy KV items without dailyClicks / hourlyClicks
  const timestamps = data.clickTimeline || [];
  if (!timestamps.length) return [];

  const now = Date.now();
  const ordered: { key: string; label: string; count: number }[] = [];
  const idxMap = new Map<string, number>();

  for (const ts of [...timestamps].sort()) {
    const d = new Date(ts);
    const diff = now - d.getTime();
    let bucketKey: string;
    let label: string;
    if (diff < 86400000) {
      const h = String(d.getUTCHours()).padStart(2, "0");
      bucketKey = `h:${ts.slice(0, 13)}`;
      label = `${h}:00`;
    } else if (diff < 604800000) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      bucketKey = `d:${ts.slice(0, 10)}`;
      label = days[d.getUTCDay()];
    } else {
      bucketKey = `m:${ts.slice(0, 7)}`;
      label = d.toLocaleString("en", { month: "short" });
    }
    const existingIdx = idxMap.get(bucketKey);
    if (existingIdx !== undefined) {
      ordered[existingIdx].count += 1;
    } else {
      idxMap.set(bucketKey, ordered.length);
      ordered.push({ key: bucketKey, label, count: 1 });
    }
  }

  return ordered.map(({ label, count }) => ({ label, count }));
}

function toListEntry(slug: string, d: Pick<URLData, "originalUrl" | "clicks" | "createdAt" | "expiresAt" | "label" | "tags" | "maxClicks" | "passwordHash" | "ogTitle" | "ogDescription" | "publicStats" | "botClicks">, now: Date): URLListEntry {
  return {
    slug,
    originalUrl: d.originalUrl,
    clicks: d.clicks || 0,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    isExpired: isLinkExpired(d, now),
    maxClicks: d.maxClicks ?? null,
    isExhausted: isLinkExhausted(d),
    hasPassword: !!d.passwordHash,
    label: d.label ?? null,
    tags: d.tags ?? [],
    ogTitle: d.ogTitle ?? null,
    ogDescription: d.ogDescription ?? null,
    publicStats: !!d.publicStats,
    botClicks: d.botClicks ?? 0,
  };
}

async function listAllEntries(env: Env): Promise<URLListEntry[]> {
  const urls: URLListEntry[] = [];
  const now = new Date();
  const fallbackGets: Promise<void>[] = [];

  let cursor: string | undefined;
  do {
    const entries = await env.URL_KV.list<URLMetadata>({ prefix: "u:", cursor });

    for (const entry of entries.keys) {
      const slug = entry.name.slice(2);
      const meta = entry.metadata;
      if (meta && meta.originalUrl) {
        const clicks = meta.clicks || 0;
        const maxClicks = meta.maxClicks ?? null;
        urls.push({
          slug,
          originalUrl: meta.originalUrl,
          clicks,
          createdAt: meta.createdAt || now.toISOString(),
          expiresAt: meta.expiresAt || null,
          isExpired: isLinkExpired(meta, now),
          maxClicks,
          isExhausted: isLinkExhausted({ maxClicks, clicks }),
          hasPassword: !!meta.hasPassword,
          label: meta.label ?? null,
          tags: meta.tags ?? [],
          ogTitle: null,
          ogDescription: null,
          publicStats: !!meta.publicStats,
          botClicks: meta.botClicks ?? 0,
        });
      } else {
        fallbackGets.push(
          (async () => {
            try {
              const raw = await env.URL_KV.get(entry.name);
              if (raw) {
                const d: URLData = JSON.parse(raw);
                urls.push(toListEntry(slug, d, now));
              }
            } catch {}
          })()
        );
      }
    }

    cursor = entries.list_complete ? undefined : entries.cursor;
  } while (cursor);

  if (fallbackGets.length > 0) {
    await Promise.all(fallbackGets);
  }

  urls.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return urls;
}

// ─── API Handlers ─────────────────────────────────────────────────────────────

async function handleShorten(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: {
    url?: string;
    custom?: string;
    expiresIn?: string;
    label?: string;
    tags?: string[] | string;
    maxClicks?: number | string | null;
    password?: string;
    ogTitle?: string;
    ogDescription?: string;
    publicStats?: boolean;
    dedupe?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const validUrl = validateDestinationUrl(body.url, req.url);
  if (validUrl.error || !validUrl.url) {
    return err(validUrl.error || "Invalid URL");
  }
  const url = validUrl.url;

  const custom = body.custom?.trim();
  const maxClicksParsed = parseMaxClicks(body.maxClicks);
  if (maxClicksParsed.error) return err(maxClicksParsed.error);

  const label = normalizeLabel(body.label);
  const tags = normalizeTags(body.tags);
  const ogTitle = normalizeOgText(body.ogTitle, 100);
  const ogDescription = normalizeOgText(body.ogDescription, 220);
  const publicStats = body.publicStats === true;

  let passwordHash: string | null = null;
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length > 128) return err("Link password must be 128 characters or fewer");
    passwordHash = await hashPassword(body.password);
  }

  // Optional duplicate URL detection when dedupe: true (and no custom slug requested)
  if (body.dedupe === true && !custom) {
    const existingList = await listAllEntries(env);
    const match = existingList.find(
      (item) => item.originalUrl === url && !item.isExpired && !item.isExhausted
    );
    if (match) {
      const host = new URL(req.url).host;
      const shortUrl = `https://${host}/${match.slug}`;
      const qrSvg = await generateQR(shortUrl);
      return json({
        slug: match.slug,
        shortUrl,
        originalUrl: match.originalUrl,
        createdAt: match.createdAt,
        expiresAt: match.expiresAt,
        maxClicks: match.maxClicks,
        hasPassword: match.hasPassword,
        label: match.label,
        tags: match.tags,
        ogTitle: match.ogTitle,
        ogDescription: match.ogDescription,
        publicStats: match.publicStats,
        deduplicated: true,
        qrSvg,
      });
    }
  }

  const expiresIn = parseExpiryInput(body.expiresIn);
  const expiresAt = computeExpiration(expiresIn);

  let slug: string;
  if (custom) {
    if (RESERVED_SLUGS.has(custom.toLowerCase())) {
      return err(`Custom slug '${custom}' is reserved`);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(custom)) {
      return err("Custom slug may only contain letters, numbers, _, -");
    }
    if (custom.length < 2 || custom.length > 50) {
      return err("Custom slug must be 2-50 characters");
    }
    const existing = await env.URL_KV.get(key(custom));
    if (existing) {
      return err(`Custom slug '${custom}' is already taken`);
    }
    slug = custom;
  } else {
    let isUnique = false;
    for (let i = 0; i < 10; i++) {
      slug = generateSlug();
      if (RESERVED_SLUGS.has(slug.toLowerCase())) continue;
      const existing = await env.URL_KV.get(key(slug));
      if (!existing) {
        isUnique = true;
        break;
      }
    }
    if (!isUnique) {
      return err("Could not generate a unique slug. Please try again or specify a custom slug.", 500);
    }
  }

  const now = new Date().toISOString();
  const data: URLData = {
    originalUrl: url,
    createdAt: now,
    expiresAt,
    clicks: 0,
    clickTimeline: [],
    referrers: {},
    devices: {},
    countries: {},
    botClicks: 0,
    dailyClicks: {},
    hourlyClicks: {},
    lastClicked: null,
    label,
    tags,
    maxClicks: maxClicksParsed.value,
    passwordHash,
    ogTitle,
    ogDescription,
    publicStats,
  };

  await saveUrlRecord(env, slug!, data);

  const host = new URL(req.url).host;
  const shortUrl = `https://${host}/${slug!}`;
  const qrSvg = await generateQR(shortUrl);

  return json({
    slug: slug!,
    shortUrl,
    originalUrl: url,
    createdAt: now,
    expiresAt,
    maxClicks: data.maxClicks,
    hasPassword: !!passwordHash,
    label,
    tags,
    ogTitle,
    ogDescription,
    publicStats,
    qrSvg,
  });
}

async function handleList(env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const urls = await listAllEntries(env);
  return json({ urls });
}

async function handleAnalytics(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  const data: URLData = JSON.parse(raw);
  const host = new URL(req.url).host;
  const shortUrl = `https://${host}/${slug}`;
  const expired = isLinkExpired(data);
  const exhausted = isLinkExhausted(data);

  const timeline = aggregateTimeline(data);
  const qrSvg = await generateQR(shortUrl);

  return json<AnalyticsResponse>({
    slug,
    originalUrl: data.originalUrl,
    clicks: data.clicks || 0,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    lastClicked: data.lastClicked,
    isExpired: expired,
    maxClicks: data.maxClicks ?? null,
    isExhausted: exhausted,
    hasPassword: !!data.passwordHash,
    label: data.label ?? null,
    tags: data.tags ?? [],
    referrers: data.referrers || {},
    devices: data.devices || {},
    countries: data.countries || {},
    botClicks: data.botClicks || 0,
    clickTimeline: timeline,
    ogTitle: data.ogTitle ?? null,
    ogDescription: data.ogDescription ?? null,
    publicStats: !!data.publicStats,
    qrSvg,
  });
}

async function handleUpdate(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  let body: {
    url?: string;
    expiresIn?: string;
    label?: string | null;
    tags?: string[] | string;
    maxClicks?: number | string | null;
    password?: string | null;
    clearPassword?: boolean;
    ogTitle?: string | null;
    ogDescription?: string | null;
    publicStats?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const hasUrl = body.url !== undefined;
  const hasExpiry = body.expiresIn !== undefined && body.expiresIn !== "keep";
  const hasLabel = body.label !== undefined;
  const hasTags = body.tags !== undefined;
  const hasMaxClicks = body.maxClicks !== undefined;
  const hasPasswordChange = body.password !== undefined || body.clearPassword === true;
  const hasOgTitle = body.ogTitle !== undefined;
  const hasOgDesc = body.ogDescription !== undefined;
  const hasPublicStats = body.publicStats !== undefined;

  if (
    !hasUrl &&
    !hasExpiry &&
    body.expiresIn !== "keep" &&
    !hasLabel &&
    !hasTags &&
    !hasMaxClicks &&
    !hasPasswordChange &&
    !hasOgTitle &&
    !hasOgDesc &&
    !hasPublicStats
  ) {
    return err("Provide at least one field to update");
  }

  const data: URLData = JSON.parse(raw);

  if (hasUrl) {
    const validUrl = validateDestinationUrl(body.url, req.url);
    if (validUrl.error || !validUrl.url) {
      return err(validUrl.error || "Invalid URL");
    }
    data.originalUrl = validUrl.url;
  }

  if (hasExpiry) {
    const expStr = String(body.expiresIn).trim();
    if (expStr === "never") {
      data.expiresAt = null;
    } else {
      const days = parseInt(expStr, 10);
      if (isNaN(days) || days < 1) {
        return err("Invalid 'expiresIn' value");
      }
      data.expiresAt = computeExpiration(days);
    }
  }

  if (hasLabel) {
    data.label = normalizeLabel(body.label);
  }
  if (hasTags) {
    data.tags = normalizeTags(body.tags);
  }
  if (hasMaxClicks) {
    const parsedMax = parseMaxClicks(body.maxClicks);
    if (parsedMax.error) return err(parsedMax.error);
    data.maxClicks = parsedMax.value;
  }
  if (body.clearPassword === true || body.password === null || body.password === "") {
    data.passwordHash = null;
  } else if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length > 128) return err("Link password must be 128 characters or fewer");
    data.passwordHash = await hashPassword(body.password);
  }
  if (hasOgTitle) {
    data.ogTitle = normalizeOgText(body.ogTitle, 100);
  }
  if (hasOgDesc) {
    data.ogDescription = normalizeOgText(body.ogDescription, 220);
  }
  if (hasPublicStats) {
    data.publicStats = body.publicStats === true;
  }

  await saveUrlRecord(env, slug, data);

  return json({
    slug,
    originalUrl: data.originalUrl,
    expiresAt: data.expiresAt,
    maxClicks: data.maxClicks ?? null,
    hasPassword: !!data.passwordHash,
    label: data.label ?? null,
    tags: data.tags ?? [],
    ogTitle: data.ogTitle ?? null,
    ogDescription: data.ogDescription ?? null,
    publicStats: !!data.publicStats,
    message: "Link updated successfully",
  });
}

async function handleDelete(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  await env.URL_KV.delete(key(slug));
  return json({ deleted: slug });
}

async function handleBulkDelete(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: { slugs?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  if (!Array.isArray(body.slugs) || body.slugs.length === 0) {
    return err("Provide a non-empty 'slugs' array");
  }
  if (body.slugs.length > 45) {
    return err("Bulk delete is limited to 45 slugs per request");
  }

  const uniqueSlugs = Array.from(
    new Set(
      body.slugs
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
    )
  );
  if (!uniqueSlugs.length) return err("No valid slugs provided");

  await Promise.all(uniqueSlugs.map((slug) => env.URL_KV.delete(key(slug))));
  return json({ deleted: uniqueSlugs, count: uniqueSlugs.length });
}

async function handleImport(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: { links?: unknown; mode?: "skip" | "overwrite" };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  if (!Array.isArray(body.links) || body.links.length === 0) {
    return err("Provide a non-empty 'links' array");
  }
  if (body.links.length > 20) {
    return err("Import batch is limited to 20 links per request");
  }

  const mode = body.mode === "overwrite" ? "overwrite" : "skip";
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const importedLinks: URLListEntry[] = [];
  const now = new Date();

  for (let i = 0; i < body.links.length; i++) {
    const item = body.links[i] as ImportLinkInput;
    const rawUrl = item?.originalUrl || item?.url;
    const validUrl = validateDestinationUrl(rawUrl, req.url);
    if (validUrl.error || !validUrl.url) {
      errors.push(`Item ${i + 1}: ${validUrl.error || "Invalid URL"}`);
      continue;
    }

    let slug = typeof item.slug === "string" ? item.slug.trim() : "";
    if (slug) {
      if (!/^[a-zA-Z0-9_-]{2,50}$/.test(slug) || RESERVED_SLUGS.has(slug.toLowerCase())) {
        errors.push(`Item ${i + 1} (${slug}): Invalid or reserved slug`);
        continue;
      }
      if (mode === "skip") {
        const existing = await env.URL_KV.get(key(slug));
        if (existing) {
          skipped++;
          continue;
        }
      }
    } else {
      slug = generateSlug();
    }

    let expiresAt: string | null = null;
    if (typeof item.expiresAt === "string" && item.expiresAt.trim()) {
      const parsedDate = new Date(item.expiresAt);
      if (!isNaN(parsedDate.getTime())) {
        expiresAt = parsedDate.toISOString();
      }
    } else if (typeof item.expiresIn === "string") {
      expiresAt = computeExpiration(parseExpiryInput(item.expiresIn));
    }

    const maxClicksParsed = parseMaxClicks(item.maxClicks);
    const clicks =
      typeof item.clicks === "number" && Number.isInteger(item.clicks) && item.clicks >= 0
        ? item.clicks
        : 0;

    const record: URLData = {
      originalUrl: validUrl.url,
      createdAt: new Date().toISOString(),
      expiresAt,
      clicks,
      clickTimeline: [],
      referrers: {},
      devices: {},
      countries: {},
      botClicks: 0,
      dailyClicks: {},
      hourlyClicks: {},
      lastClicked: null,
      label: normalizeLabel(item.label),
      tags: normalizeTags(item.tags),
      maxClicks: maxClicksParsed.error ? null : maxClicksParsed.value,
      passwordHash: null,
      ogTitle: normalizeOgText(item.ogTitle, 100),
      ogDescription: normalizeOgText(item.ogDescription, 220),
      publicStats: item.publicStats === true,
    };

    await saveUrlRecord(env, slug, record);
    importedLinks.push(toListEntry(slug, record, now));
    imported++;
  }

  return json({ imported, skipped, errors, importedLinks });
}

// ─── Redirect, Unlock, & Public Stats Handlers ────────────────────────────────

function applyHumanHit(data: URLData, req: Request) {
  const now = new Date();
  const nowIso = now.toISOString();
  const referer = req.headers.get("Referer") ?? null;
  const ua = req.headers.get("User-Agent") ?? "unknown";
  const device = detectDevice(ua);
  const referrer = parseReferrer(referer);
  const country = getVisitorCountry(req);

  data.clicks = (data.clicks || 0) + 1;
  data.lastClicked = nowIso;

  if (!data.clickTimeline) data.clickTimeline = [];
  data.clickTimeline.push(nowIso);
  if (data.clickTimeline.length > 500) {
    data.clickTimeline = data.clickTimeline.slice(-500);
  }

  if (!data.referrers) data.referrers = {};
  data.referrers[referrer] = (data.referrers[referrer] || 0) + 1;

  if (!data.devices) data.devices = {};
  data.devices[device] = (data.devices[device] || 0) + 1;

  if (!data.countries) data.countries = {};
  data.countries[country] = (data.countries[country] || 0) + 1;

  const dailyKey = nowIso.slice(0, 10);
  if (!data.dailyClicks) data.dailyClicks = {};
  data.dailyClicks[dailyKey] = (data.dailyClicks[dailyKey] || 0) + 1;
  data.dailyClicks = trimBucketRecord(data.dailyClicks, 60);

  const hourlyKey = nowIso.slice(0, 13);
  if (!data.hourlyClicks) data.hourlyClicks = {};
  data.hourlyClicks[hourlyKey] = (data.hourlyClicks[hourlyKey] || 0) + 1;
  data.hourlyClicks = trimBucketRecord(data.hourlyClicks, 48);
}

async function handleRedirect(
  slug: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext
) {
  const raw = await env.URL_KV.get(key(slug));

  if (!raw) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 · Not Found",
        title: "Link Not Found",
        message: "The short link you followed does not exist, was mistyped, or has been removed.",
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  const data: URLData = JSON.parse(raw);

  if (isLinkExpired(data)) {
    return new Response(
      renderStatusPage({
        status: 410,
        codeLabel: "410 · Expired",
        title: "Link Expired",
        message: "This shortened link has passed its expiration date and is no longer active.",
      }),
      { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  if (isLinkExhausted(data)) {
    return new Response(
      renderStatusPage({
        status: 410,
        codeLabel: "410 · Click Limit Reached",
        title: "Link Limit Reached",
        message: "This short link has reached its maximum click limit and is no longer active.",
      }),
      { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  const ua = req.headers.get("User-Agent") ?? "";
  const reqUrl = new URL(req.url);
  const shortUrl = `https://${reqUrl.host}/${slug}`;

  // Handle POST unlock submission for password-protected links
  if (req.method === "POST") {
    if (!data.passwordHash) {
      return err("Method not allowed", 405);
    }

    let submitted = "";
    const contentType = req.headers.get("Content-Type") || "";
    try {
      if (contentType.includes("application/json")) {
        const parsed = (await req.json()) as { password?: string };
        submitted = typeof parsed.password === "string" ? parsed.password : "";
      } else {
        const formData = await req.formData();
        const val = formData.get("password");
        submitted = typeof val === "string" ? val : "";
      }
    } catch {
      submitted = "";
    }

    const valid = submitted ? await verifyPassword(submitted, data.passwordHash) : false;
    if (!valid) {
      return new Response(
        renderPasswordPage({
          slug,
          label: data.label,
          error: "Incorrect password. Please try again.",
        }),
        { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
      );
    }

    applyHumanHit(data, req);
    if (data.maxClicks) {
      await saveUrlRecord(env, slug, data);
    } else {
      ctx.waitUntil(saveUrlRecord(env, slug, data));
    }
    return Response.redirect(data.originalUrl, 303);
  }

  // Handle social preview bots / unfurlers cleanly without inflating human click stats or burning single-use links
  if (isPreviewBot(ua)) {
    data.botClicks = (data.botClicks || 0) + 1;
    if (data.maxClicks) {
      await saveUrlRecord(env, slug, data);
    } else {
      ctx.waitUntil(saveUrlRecord(env, slug, data));
    }

    if (data.ogTitle || data.ogDescription || data.passwordHash || data.maxClicks) {
      return new Response(
        renderPreviewMetaPage({
          shortUrl,
          title: data.ogTitle || data.label || `TinyLink — /${slug}`,
          description:
            data.ogDescription ||
            (data.passwordHash
              ? "Password-protected link shared via TinyLink."
              : "Shortened link powered by TinyLink."),
        }),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
      );
    }

    return Response.redirect(data.originalUrl, 302);
  }

  // Password gate on GET when link is password protected
  if (data.passwordHash) {
    return new Response(
      renderPasswordPage({ slug, label: data.label }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  // Track human analytics
  applyHumanHit(data, req);
  if (data.maxClicks) {
    await saveUrlRecord(env, slug, data);
  } else {
    ctx.waitUntil(saveUrlRecord(env, slug, data));
  }

  return Response.redirect(data.originalUrl, 302);
}

async function handlePublicStats(slug: string, req: Request, env: Env): Promise<Response> {
  const raw = await env.URL_KV.get(key(slug));
  if (!raw) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 · Not Found",
        title: "Stats Not Found",
        message: "No public statistics exist for this short link.",
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data: URLData = JSON.parse(raw);
  if (!data.publicStats) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 · Not Found",
        title: "Stats Not Found",
        message: "Public analytics are disabled for this short link.",
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const host = new URL(req.url).host;
  const shortUrl = `https://${host}/${slug}`;
  const timeline = aggregateTimeline(data);
  const qrSvg = await generateQR(shortUrl);

  return new Response(
    renderPublicStatsPage({
      slug,
      shortUrl,
      originalUrl: data.originalUrl,
      hasPassword: !!data.passwordHash,
      label: data.label ?? null,
      tags: data.tags ?? [],
      clicks: data.clicks || 0,
      botClicks: data.botClicks || 0,
      maxClicks: data.maxClicks ?? null,
      isExpired: isLinkExpired(data),
      isExhausted: isLinkExhausted(data),
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      lastClicked: data.lastClicked,
      clickTimeline: timeline,
      devices: data.devices || {},
      countries: data.countries || {},
      qrSvg,
    }),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } }
  );
}

// ─── Frontend HTML ────────────────────────────────────────────────────────────

function frontend(env: Env) {
  return new Response(renderDashboardHtml(!!env.ADMIN_TOKEN), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

// ─── Route Dispatcher ─────────────────────────────────────────────────────────

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(), status: 204 });
    }

    if (path === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (path === "/icon.svg" && req.method === "GET") {
      return new Response(APP_ICON_SVG, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    if (path === "/manifest.webmanifest" && req.method === "GET") {
      return new Response(renderManifest(url.origin), {
        headers: {
          "Content-Type": "application/manifest+json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (path === "/sw.js" && req.method === "GET") {
      return new Response(SERVICE_WORKER_JS, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (path === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /api/\nDisallow: /stats/\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // API routes
    if (path === "/api/health" && req.method === "GET") {
      return json({ ok: true, authRequired: !!env.ADMIN_TOKEN, service: "tinylink" });
    }
    if (path === "/api/list" && req.method === "GET") return handleList(env, req, ctx);
    if (path === "/api/shorten" && req.method === "POST") return handleShorten(req, env, ctx);
    if (path === "/api/bulk-delete" && req.method === "POST") return handleBulkDelete(req, env, ctx);
    if (path === "/api/import" && req.method === "POST") return handleImport(req, env, ctx);
    if (path.startsWith("/api/analytics/") && req.method === "GET") {
      const slug = decodeSlugParam(path.slice("/api/analytics/".length));
      if (!slug) return err("Invalid slug", 400);
      return handleAnalytics(slug, env, req, ctx);
    }
    if (path.startsWith("/api/urls/") && req.method === "PUT") {
      const slug = decodeSlugParam(path.slice("/api/urls/".length));
      if (!slug) return err("Invalid slug", 400);
      return handleUpdate(slug, env, req, ctx);
    }
    if (path.startsWith("/api/urls/") && req.method === "DELETE") {
      const slug = decodeSlugParam(path.slice("/api/urls/".length));
      if (!slug) return err("Invalid slug", 400);
      return handleDelete(slug, env, req, ctx);
    }

    // Opt-in public read-only stats route
    if (path.startsWith("/stats/") && req.method === "GET") {
      const cleanRaw = path.slice("/stats/".length).replace(/\/+$/, "");
      const slug = decodeSlugParam(cleanRaw);
      if (!slug) return err("Invalid slug", 400);
      return handlePublicStats(slug, req, env);
    }

    // Redirect & unlock routes (strip accidental trailing slashes cleanly)
    if (path !== "/" && !path.startsWith("/api/") && (req.method === "GET" || req.method === "POST")) {
      const cleanRaw = path.slice(1).replace(/\/+$/, "");
      const slug = decodeSlugParam(cleanRaw);
      if (slug) {
        return handleRedirect(slug, req, env, ctx);
      }
    }

    // Frontend Dashboard
    return frontend(env);
  },
} as ExportedHandler<Env>;
