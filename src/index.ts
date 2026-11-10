import QRCode from "qrcode";
import { renderDashboardHtml } from "./frontend";
import { renderStatusPage } from "./pages";

// ─── Types ────────────────────────────────────────────────────────────────────

interface URLData {
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
  clicks: number;
  clickTimeline: string[];
  referrers: Record<string, number>;
  devices: Record<string, number>;
  lastClicked: string | null;
}

interface URLMetadata {
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
}

interface AnalyticsResponse {
  slug: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  lastClicked: string | null;
  isExpired: boolean;
  referrers: Record<string, number>;
  devices: Record<string, number>;
  clickTimeline: { label: string; count: number }[];
  qrSvg: string;
}

interface URLListEntry {
  slug: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
}

interface Env {
  URL_KV: KVNamespace;
  ADMIN_TOKEN?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESERVED_SLUGS = new Set([
  "api",
  "health",
  "favicon.ico",
  "robots.txt",
  "manifest.webmanifest",
  "icon.svg",
  "sw.js",
]);

const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#090D16"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#22C55E" stroke-opacity="0.28" stroke-width="8"/>
  <path d="M214 298a72 72 0 0 0 101.82 0l50.91-50.91a72 72 0 0 0-101.82-101.82L239.45 170.7M298 214a72 72 0 0 0-101.82 0l-50.91 50.91a72 72 0 0 0 101.82 101.82l25.46-25.43" fill="none" stroke="#22C55E" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

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

function json<T = unknown>(data: T, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function requireAuth(req: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return true; // no token configured = public access
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  const token =
    req.headers.get("X-Auth-Token") ||
    bearerToken ||
    new URL(req.url).searchParams.get("token");
  if (!token) return false;
  return timingSafeEqual(token, env.ADMIN_TOKEN);
}

function generateSlug(len = 7): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
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

async function generateQR(url: string): Promise<string> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      width: 200,
      margin: 2,
      color: { dark: "#0F172A", light: "#ffffff" },
    });
  } catch {
    return qrcodeFallback(url);
  }
}

function qrcodeFallback(url: string): string {
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

function aggregateTimeline(timestamps: string[]): { label: string; count: number }[] {
  const now = Date.now();
  const buckets: Record<string, number> = {};

  for (const ts of timestamps) {
    const d = new Date(ts).getTime();
    const diff = now - d;
    let label: string;
    if (diff < 86400000) {
      // today: by hour
      const h = String(new Date(ts).getHours()).padStart(2, "0");
      label = `${h}:00`;
    } else if (diff < 604800000) {
      // this week: by day
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      label = days[new Date(ts).getDay()];
    } else {
      // older: by month
      const m = new Date(ts).toLocaleString("en", { month: "short" });
      label = m;
    }
    buckets[label] = (buckets[label] || 0) + 1;
  }

  return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}

// ─── API Handlers ─────────────────────────────────────────────────────────────

async function handleShorten(req: Request, env: Env) {
  if (!requireAuth(req, env)) return err("Unauthorized", 401);

  let body: { url?: string; custom?: string; expiresIn?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const url = body.url?.trim();
  if (!url) return err("Missing 'url' field");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return err("URL must start with http:// or https://");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return err("Invalid URL format");
  }

  // Prevent self-referencing loops & localhost targets
  const requestHost = new URL(req.url).host.toLowerCase();
  const targetHost = parsedUrl.host.toLowerCase();
  const targetHostname = parsedUrl.hostname.toLowerCase();
  if (
    targetHost === requestHost ||
    targetHostname === "localhost" ||
    targetHostname === "127.0.0.1" ||
    targetHostname === "[::1]" ||
    targetHostname === "::1"
  ) {
    return err("Cannot shorten a link pointing to this shortener or localhost");
  }

  const custom = body.custom?.trim();
  const expiresIn = parseExpiryInput(body.expiresIn);
  const expiresAt = computeExpiration(expiresIn);

  let slug: string;
  if (custom) {
    if (!/^[a-zA-Z0-9_-]+$/.test(custom)) {
      return err("Custom slug may only contain letters, numbers, _, -");
    }
    if (custom.length < 2 || custom.length > 50) {
      return err("Custom slug must be 2-50 characters");
    }
    if (RESERVED_SLUGS.has(custom.toLowerCase())) {
      return err(`Custom slug '${custom}' is reserved`);
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
    lastClicked: null,
  };

  const metadata: URLMetadata = {
    originalUrl: url,
    clicks: 0,
    createdAt: now,
    expiresAt,
  };

  // Persist record in KV without hard-TTL auto-purge so expired links render HTTP 410,
  // remain visible in the Expired filter, preserve analytics, and can be renewed later.
  await env.URL_KV.put(key(slug!), JSON.stringify(data), { metadata });

  const host = new URL(req.url).host;
  const shortUrl = `https://${host}/${slug!}`;
  const qrSvg = await generateQR(shortUrl);

  return json({
    slug: slug!,
    shortUrl,
    originalUrl: url,
    expiresAt,
    qrSvg,
  });
}

async function handleList(env: Env, req: Request) {
  if (!requireAuth(req, env)) return err("Unauthorized", 401);

  const urls: URLListEntry[] = [];
  const now = new Date();
  const legacyGets: Promise<void>[] = [];

  let cursor: string | undefined;
  do {
    const entries = await env.URL_KV.list<URLMetadata>({ prefix: "u:", cursor });

    for (const entry of entries.keys) {
      const slug = entry.name.slice(2);
      const meta = entry.metadata;
      if (meta && meta.originalUrl) {
        urls.push({
          slug,
          originalUrl: meta.originalUrl,
          clicks: meta.clicks || 0,
          createdAt: meta.createdAt || now.toISOString(),
          expiresAt: meta.expiresAt || null,
          isExpired: meta.expiresAt ? new Date(meta.expiresAt) < now : false,
        });
      } else {
        // Fallback for legacy keys without metadata
        legacyGets.push(
          (async () => {
            try {
              const raw = await env.URL_KV.get(entry.name);
              if (raw) {
                const d: URLData = JSON.parse(raw);
                urls.push({
                  slug,
                  originalUrl: d.originalUrl,
                  clicks: d.clicks || 0,
                  createdAt: d.createdAt,
                  expiresAt: d.expiresAt,
                  isExpired: d.expiresAt ? new Date(d.expiresAt) < now : false,
                });
              }
            } catch {}
          })()
        );
      }
    }

    cursor = entries.list_complete ? undefined : entries.cursor;
  } while (cursor);

  if (legacyGets.length > 0) {
    await Promise.all(legacyGets);
  }

  urls.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return json({ urls });
}

async function handleAnalytics(slug: string, env: Env, req: Request) {
  if (!requireAuth(req, env)) return err("Unauthorized", 401);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  const data: URLData = JSON.parse(raw);
  const host = new URL(req.url).host;
  const shortUrl = `https://${host}/${slug}`;
  const isExpired = data.expiresAt ? new Date(data.expiresAt) < new Date() : false;

  const timeline = aggregateTimeline(data.clickTimeline || []);
  const qrSvg = await generateQR(shortUrl);

  return json<AnalyticsResponse>({
    slug,
    originalUrl: data.originalUrl,
    clicks: data.clicks || 0,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    lastClicked: data.lastClicked,
    isExpired,
    referrers: data.referrers || {},
    devices: data.devices || {},
    clickTimeline: timeline,
    qrSvg,
  });
}

async function handleUpdate(slug: string, env: Env, req: Request) {
  if (!requireAuth(req, env)) return err("Unauthorized", 401);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  let body: { url?: string; expiresIn?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const hasUrl = body.url !== undefined;
  const hasExpiry = body.expiresIn !== undefined && body.expiresIn !== "keep";
  if (!hasUrl && !hasExpiry && body.expiresIn !== "keep") {
    return err("Provide 'url' or 'expiresIn' to update");
  }

  const data: URLData = JSON.parse(raw);

  if (hasUrl) {
    const url = body.url?.trim();
    if (!url) return err("Missing 'url' field");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return err("URL must start with http:// or https://");
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return err("Invalid URL format");
    }

    // Prevent self-referencing loops & localhost targets
    const requestHost = new URL(req.url).host.toLowerCase();
    const targetHost = parsedUrl.host.toLowerCase();
    const targetHostname = parsedUrl.hostname.toLowerCase();
    if (
      targetHost === requestHost ||
      targetHostname === "localhost" ||
      targetHostname === "127.0.0.1" ||
      targetHostname === "[::1]" ||
      targetHostname === "::1"
    ) {
      return err("Cannot redirect to this shortener or localhost");
    }
    data.originalUrl = url;
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

  const metadata: URLMetadata = {
    originalUrl: data.originalUrl,
    clicks: data.clicks,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
  };

  await env.URL_KV.put(key(slug), JSON.stringify(data), { metadata });

  return json({
    slug,
    originalUrl: data.originalUrl,
    expiresAt: data.expiresAt,
    message: "Link updated successfully",
  });
}

async function handleDelete(slug: string, env: Env, req: Request) {
  if (!requireAuth(req, env)) return err("Unauthorized", 401);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  await env.URL_KV.delete(key(slug));
  return json({ deleted: slug });
}

async function handleRedirect(
  slug: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext
) {
  const raw = await env.URL_KV.get(key(slug));

  // 404 Not Found Page (custom branded)
  if (!raw) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 · Not Found",
        title: "Link Not Found",
        message: "The short link you followed does not exist, was mistyped, or has been removed.",
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data: URLData = JSON.parse(raw);

  // Check expiry
  if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
    return new Response(
      renderStatusPage({
        status: 410,
        codeLabel: "410 · Expired",
        title: "Link Expired",
        message: "This shortened link has passed its expiration date and is no longer active.",
      }),
      { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Track analytics (fire-and-forget background task)
  const referer = req.headers.get("Referer") ?? null;
  const ua = req.headers.get("User-Agent") ?? "unknown";
  const device = detectDevice(ua);
  const referrer = parseReferrer(referer);

  ctx.waitUntil(
    (async () => {
      data.clicks = (data.clicks || 0) + 1;
      data.lastClicked = new Date().toISOString();
      if (!data.clickTimeline) data.clickTimeline = [];
      data.clickTimeline.push(data.lastClicked);
      if (data.clickTimeline.length > 500) {
        data.clickTimeline = data.clickTimeline.slice(-500);
      }
      if (!data.referrers) data.referrers = {};
      data.referrers[referrer] = (data.referrers[referrer] || 0) + 1;
      if (!data.devices) data.devices = {};
      data.devices[device] = (data.devices[device] || 0) + 1;

      const metadata: URLMetadata = {
        originalUrl: data.originalUrl,
        clicks: data.clicks,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      };

      await env.URL_KV.put(key(slug), JSON.stringify(data), { metadata });
    })()
  );

  return Response.redirect(data.originalUrl, 302);
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

    if (path === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /api/\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // API routes
    if (path === "/api/health" && req.method === "GET") {
      return json({ ok: true, authRequired: !!env.ADMIN_TOKEN, service: "tinylink" });
    }
    if (path === "/api/list" && req.method === "GET") return handleList(env, req);
    if (path === "/api/shorten" && req.method === "POST") return handleShorten(req, env);
    if (path.startsWith("/api/analytics/") && req.method === "GET") {
      const slug = decodeSlugParam(path.slice("/api/analytics/".length));
      if (!slug) return err("Invalid slug", 400);
      return handleAnalytics(slug, env, req);
    }
    if (path.startsWith("/api/urls/") && req.method === "PUT") {
      const slug = decodeSlugParam(path.slice("/api/urls/".length));
      if (!slug) return err("Invalid slug", 400);
      return handleUpdate(slug, env, req);
    }
    if (path.startsWith("/api/urls/") && req.method === "DELETE") {
      const slug = decodeSlugParam(path.slice("/api/urls/".length));
      if (!slug) return err("Invalid slug", 400);
      return handleDelete(slug, env, req);
    }

    // Redirect routes (strip accidental trailing slashes cleanly)
    if (path !== "/" && !path.startsWith("/api/")) {
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
