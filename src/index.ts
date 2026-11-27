import QRCode from "qrcode";
import { DASHBOARD_APP_JS, renderDashboardHtml } from "./frontend";
import {
  BIO_PAGE_JS,
  CTA_OVERLAY_JS,
  DOCS_PAGE_JS,
  PIXEL_BRIDGE_JS,
  STATUS_PAGE_JS,
  THEME_INIT_JS,
  UNLOCK_PAGE_JS,
  escapeHtml,
  renderBioPageHtml,
  renderCtaOverlayHtml,
  renderDeepLinkBridgeHtml,
  renderDocsHtml,
  renderPasswordPage,
  renderPixelBridgeHtml,
  renderPreviewMetaPage,
  renderPublicStatsPage,
  renderStatusPage,
} from "./pages";
import type {
  AiMetadataResponse,
  AiSuggestResponse,
  ApiKeyRecord,
  ApiKeyScope,
  AnalyticsResponse,
  BioLead,
  BioLeadCapture,
  BioLinkItem,
  BioPageData,
  BioPageSummary,
  BioSocials,
  BioTheme,
  BrandedQrOptions,
  ClickStreamEntry,
  CtaOverlayConfig,
  CustomDomainRecord,
  Env,
  GoalConversionRecord,
  ImportLinkInput,
  LinkHealthStatus,
  PixelConfig,
  PublicWebhookConfig,
  SplitRoute,
  TimeRoute,
  TimelineBucket,
  URLData,
  URLListEntry,
  URLMetadata,
  WebhookConfig,
  WebhookDispatchPayload,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const RESERVED_SLUGS = new Set([
  "api",
  "assets",
  "health",
  "favicon.ico",
  "robots.txt",
  ".well-known",
  "manifest.webmanifest",
  "icon.svg",
  "sw.js",
  "stats",
  "bio",
  "p",
]);

export const BIO_HANDLE_RE = /^[a-zA-Z0-9_-]{2,30}$/;
export const RESERVED_BIO_HANDLES = new Set([
  "api",
  "assets",
  "health",
  "stats",
  "bio",
  "p",
  "admin",
  "login",
  "logout",
  "robots.txt",
  "favicon.ico",
  ".well-known",
]);

const SLUG_RE = /^[a-zA-Z0-9_-]{2,50}$/;
const MAX_AUTH_FAILURES = 10;
const AUTH_WINDOW_SECONDS = 300;
const MAX_LINK_PASSWORD_ATTEMPTS = 10;
const LINK_PASSWORD_WINDOW_SECONDS = 300;
const PBKDF2_ITERATIONS = 100_000;
const SESSION_COOKIE_NAME = "tl_session";
const SESSION_TTL_SECONDS = 86_400;
const MAX_KV_META_BYTES = 980;
const MAX_JSON_BODY_BYTES = 131_072;
const MAX_IMPORT_JSON_BYTES = 262_144;
const MAX_FORM_BODY_BYTES = 4096;
const MAX_URL_LENGTH = 4096;
const MAX_WEBHOOK_URL_LENGTH = 1024;
const MAX_UNIQUE_STAT_KEYS = 100;
const WEBHOOK_SETTINGS_KEY = "settings:webhooks";

const HTML_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const HTML_UNLOCK_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const API_CSP = "default-src 'none'; frame-ancestors 'none'";

export const PIXEL_BRIDGE_CSP = [
  "default-src 'self'",
  "script-src 'self' https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com https://snap.licdn.com https://static.ads-twitter.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://www.facebook.com https://www.google-analytics.com https://analytics.google.com https://analytics.tiktok.com https://px.ads.linkedin.com https://analytics.twitter.com",
  "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://www.google-analytics.com https://analytics.google.com https://analytics.tiktok.com https://px.ads.linkedin.com https://analytics.twitter.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const CTA_OVERLAY_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-src * https: http:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#090D16"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#22C55E" stroke-opacity="0.28" stroke-width="8"/>
  <path d="M214 298a72 72 0 0 0 101.82 0l50.91-50.91a72 72 0 0 0-101.82-101.82L239.45 170.7M298 214a72 72 0 0 0-101.82 0l-50.91 50.91a72 72 0 0 0 101.82 101.82l25.46-25.43" fill="none" stroke="#22C55E" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SERVICE_WORKER_JS = `const CACHE_NAME = 'tinylink-shell-v4';
const SHELL_ASSETS = ['/icon.svg', '/manifest.webmanifest', '/assets/theme.js', '/assets/app.js'];

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

  if (url.pathname === '/assets/app.js') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/assets/theme.js'
  ) {
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

function isAuthRequired(env: Env): boolean {
  return Boolean(env.ADMIN_TOKEN) || env.ALLOW_PUBLIC_ADMIN !== "true";
}

function isMisconfigured(env: Env): boolean {
  return !env.ADMIN_TOKEN && env.ALLOW_PUBLIC_ADMIN !== "true";
}

function parseAllowedOrigins(env: Env): Set<string> {
  const set = new Set<string>();
  if (!env.ALLOWED_ORIGINS) return set;
  for (const part of env.ALLOWED_ORIGINS.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "*") continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        set.add(parsed.origin);
      }
    } catch {}
  }
  return set;
}

function resolveAllowedOrigin(req: Request, env: Env): { allowed: boolean; origin: string | null } {
  const origin = req.headers.get("Origin");
  if (!origin) return { allowed: true, origin: null };
  try {
    const parsedOrigin = new URL(origin).origin;
    const reqOrigin = new URL(req.url).origin;
    if (parsedOrigin === reqOrigin || parseAllowedOrigins(env).has(parsedOrigin)) {
      return { allowed: true, origin: parsedOrigin };
    }
  } catch {}
  return { allowed: false, origin };
}

function corsHeadersFor(req: Request, env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: "Origin",
  };
  const resolved = resolveAllowedOrigin(req, env);
  if (resolved.allowed && resolved.origin) {
    headers["Access-Control-Allow-Origin"] = resolved.origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Auth-Token, Authorization";
  }
  return headers;
}

function verifyCsrf(req: Request, env: Env): Response | null {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const originHeader = req.headers.get("Origin");
  if (originHeader) {
    const resolved = resolveAllowedOrigin(req, env);
    if (!resolved.allowed) {
      return err("Cross-origin request blocked by CSRF policy", 403);
    }
  }

  const secFetchSite = req.headers.get("Sec-Fetch-Site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    if (!originHeader || !resolveAllowedOrigin(req, env).allowed) {
      return err("Cross-site request blocked by CSRF policy", 403);
    }
  }

  return null;
}

function json<T = unknown>(data: T, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function err(msg: string, status = 400, extraHeaders: Record<string, string> = {}) {
  return json({ error: msg }, status, extraHeaders);
}

function applySecurityHeaders(res: Response, req: Request, env: Env): Response {
  const url = new URL(req.url);
  const headers = new Headers(res.headers);
  const contentType = (headers.get("Content-Type") || "").toLowerCase();
  const isRedirect = res.status >= 300 && res.status < 400;
  const isApi = url.pathname.startsWith("/api/");

  if ((req as any)._rateLimitHeaders) {
    for (const [k, v] of Object.entries((req as any)._rateLimitHeaders)) {
      if (!headers.has(k)) headers.set(k, v as string);
    }
  }

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (isApi) {
    const cors = corsHeadersFor(req, env);
    for (const [k, v] of Object.entries(cors)) {
      if (!headers.has(k)) headers.set(k, v);
    }
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "no-referrer");
    if (!headers.has("Content-Security-Policy")) {
      headers.set("Content-Security-Policy", API_CSP);
    }
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-store");
    }
  } else if (contentType.includes("text/html")) {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (!headers.has("Content-Security-Policy")) {
      headers.set("Content-Security-Policy", HTML_CSP);
    }
  } else if (isRedirect) {
    if (!headers.has("Referrer-Policy")) {
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    }
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-store");
    }
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function getRequestOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("X-Forwarded-Host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("Host") || url.host;
  const forwardedProto = req.headers.get("X-Forwarded-Proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (url.protocol.replace(":", "") || "https");
  return `${proto}://${host}`;
}

function safeRedirect(targetUrl: string, status: 302 | 303, cacheControl?: string): Response {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return err("Invalid redirect destination", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return err("Blocked unsafe redirect scheme", 400);
  }
  return new Response(null, {
    status,
    headers: {
      Location: parsed.toString(),
      "Cache-Control": cacheControl || "no-store",
      "Vary": "User-Agent",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
  });
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const keyMaterial = new Uint8Array(32);
  crypto.getRandomValues(keyMaterial);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(macA);
  const bytesB = new Uint8Array(macB);
  let diff = a.length ^ b.length;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
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

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const padLen = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function deriveHmacKey(secret: string, purpose: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rootKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const derivedRaw = await crypto.subtle.sign("HMAC", rootKey, enc.encode(`tinylink:kdf:v1:${purpose}`));
  return crypto.subtle.importKey(
    "raw",
    derivedRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function computeIpHash(ip: string, env: Env): Promise<string> {
  const secret = env.IP_HASH_SECRET || env.ADMIN_TOKEN;
  if (secret) {
    const hmacKey = await deriveHmacKey(secret, "ip-privacy-hash");
    const sig = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(ip));
    return bytesToHex(new Uint8Array(sig));
  }
  return sha256Hex(`public-fallback:${ip}`);
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    256
  );
  return `v2:${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(new Uint8Array(derived))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length === 4 && parts[0] === "v2") {
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const expectedHex = parts[3];
    if (!Number.isInteger(iterations) || iterations < 1000 || iterations > PBKDF2_ITERATIONS) {
      return false;
    }
    const salt = hexToBytes(saltHex);
    if (!salt || !expectedHex) return false;
    const baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      baseKey,
      256
    );
    return constantTimeEqual(bytesToHex(new Uint8Array(derived)), expectedHex);
  }

  if (parts.length === 3 && parts[0] === "v1") {
    const [, saltHex, expectedHex] = parts;
    if (!saltHex || !expectedHex) return false;
    const computedHex = await sha256Hex(`${saltHex}:${password}`);
    return constantTimeEqual(computedHex, expectedHex);
  }

  return false;
}

function getClientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP")?.trim() || "unknown";
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("Cookie");
  if (!raw) return {};
  const cookies: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (name) cookies[name] = val;
  }
  return cookies;
}

function buildSessionSetCookieHeader(req: Request, value: string, maxAgeSeconds: number): string {
  const isHttps = new URL(req.url).protocol === "https:";
  const parts = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/api",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

async function mintSessionCookieValue(adminToken: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + SESSION_TTL_SECONDS;
  const payload = `${nowSec}.${expSec}`;
  const hmacKey = await deriveHmacKey(adminToken, "admin-session-cookie");
  const sig = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(payload));
  return `v1.${payload}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

async function verifySessionCookie(req: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_TOKEN) return false;
  const cookies = parseCookies(req);
  const rawCookie = cookies[SESSION_COOKIE_NAME];
  if (!rawCookie) return false;
  const parts = rawCookie.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const iatSec = Number(parts[1]);
  const expSec = Number(parts[2]);
  const sigBytes = base64UrlToBytes(parts[3]);
  if (!Number.isInteger(iatSec) || !Number.isInteger(expSec) || !sigBytes) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > expSec || expSec - iatSec > SESSION_TTL_SECONDS) return false;
  const hmacKey = await deriveHmacKey(env.ADMIN_TOKEN, "admin-session-cookie");
  const payload = `${iatSec}.${expSec}`;
  return crypto.subtle.verify("HMAC", hmacKey, sigBytes, new TextEncoder().encode(payload));
}

async function readRateLimit(
  env: Env,
  rlKey: string
): Promise<{ count: number; resetAt: number } | null> {
  try {
    const raw = await env.URL_KV.get(rlKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { count?: number; resetAt?: number };
    if (typeof parsed.count === "number" && typeof parsed.resetAt === "number") {
      return { count: parsed.count, resetAt: parsed.resetAt };
    }
  } catch {}
  return null;
}

async function recordRateLimitFailure(
  env: Env,
  rlKey: string,
  rlRecord: { count: number; resetAt: number } | null,
  windowSeconds: number
): Promise<void> {
  const now = Date.now();
  const activeWindow = rlRecord && now < rlRecord.resetAt;
  const nextCount = activeWindow ? rlRecord!.count + 1 : 1;
  const nextResetAt = activeWindow ? rlRecord!.resetAt : now + windowSeconds * 1000;
  try {
    await env.URL_KV.put(
      rlKey,
      JSON.stringify({ count: nextCount, resetAt: nextResetAt }),
      { expirationTtl: windowSeconds }
    );
  } catch {}
}

async function extractHeaderAdminToken(req: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_TOKEN) return false;
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const token = req.headers.get("X-Auth-Token") || bearerToken;
  if (!token) return false;
  return constantTimeEqual(token, env.ADMIN_TOKEN);
}

async function readBoundedJson<T = unknown>(
  req: Request,
  maxBytes = MAX_JSON_BODY_BYTES
): Promise<{ data?: T; error?: string; status?: number }> {
  const cl = req.headers.get("Content-Length");
  if (cl !== null) {
    const parsedLen = Number(cl);
    if (Number.isFinite(parsedLen) && parsedLen > maxBytes) {
      return { error: "Request body too large", status: 413 };
    }
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { error: "Unable to read request body", status: 400 };
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { error: "Request body too large", status: 413 };
  }
  if (!text.trim()) {
    return { error: "Invalid JSON body", status: 400 };
  }
  try {
    const data = JSON.parse(text) as T;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "JSON body must be an object", status: 400 };
    }
    return { data };
  } catch {
    return { error: "Invalid JSON body", status: 400 };
  }
}

export async function hashApiKey(token: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token.trim()));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKeyToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `tl_live_${hex}`;
}

export function generateKeyId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `key_${hex}`;
}

interface ApiKeyVerificationResult {
  ok: boolean;
  apiKey?: ApiKeyRecord;
  error?: string;
  status?: number;
  rateLimitHeaders?: Record<string, string>;
}

async function verifyApiKey(
  token: string,
  env: Env,
  ctx: ExecutionContext,
  requiredScope?: ApiKeyScope
): Promise<ApiKeyVerificationResult> {
  if (!token || !token.startsWith("tl_live_")) {
    return { ok: false, error: "Invalid API key format", status: 401 };
  }
  const keyHash = await hashApiKey(token);
  const raw = await env.URL_KV.get(`apikey:${keyHash}`);
  if (!raw) {
    return { ok: false, error: "Invalid or revoked API key", status: 401 };
  }
  let record: ApiKeyRecord;
  try {
    record = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Corrupted API key record", status: 500 };
  }

  // Granular Scope check
  if (requiredScope && (!record.scopes || !record.scopes.includes(requiredScope))) {
    return {
      ok: false,
      error: `Forbidden: API key lacks required scope '${requiredScope}'`,
      status: 403,
    };
  }

  // Tiered Rate Limiting per key (record.rateLimit req/min, default 60)
  const limit = record.rateLimit && record.rateLimit > 0 ? record.rateLimit : 60;
  const currentMinute = Math.floor(Date.now() / 60000);
  const windowKey = `rl:key:${record.id}:${currentMinute}`;
  const currentRaw = await env.URL_KV.get(windowKey);
  const currentCount = currentRaw ? parseInt(currentRaw, 10) : 0;
  const remaining = Math.max(0, limit - currentCount - 1);
  const resetSeconds = 60 - (Math.floor(Date.now() / 1000) % 60);

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetSeconds),
  };

  if (currentCount >= limit) {
    return {
      ok: false,
      error: "Rate limit exceeded for API key",
      status: 429,
      rateLimitHeaders: {
        ...rateLimitHeaders,
        "Retry-After": String(resetSeconds),
      },
    };
  }

  ctx.waitUntil(
    (async () => {
      try {
        await env.URL_KV.put(windowKey, String(currentCount + 1), { expirationTtl: 70 });
        record.lastUsedAt = new Date().toISOString();
        await env.URL_KV.put(`apikey:${keyHash}`, JSON.stringify(record));
      } catch {}
    })()
  );

  return { ok: true, apiKey: record, rateLimitHeaders };
}

interface AuthResult {
  ok: boolean;
  apiKey?: ApiKeyRecord;
  response?: Response;
}

async function authenticateApiRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  requiredScope?: ApiKeyScope
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const apiKeyCandidate = req.headers.get("X-API-Key") || (bearerMatch?.startsWith("tl_live_") ? bearerMatch : null);

  if (apiKeyCandidate) {
    const keyRes = await verifyApiKey(apiKeyCandidate, env, ctx, requiredScope);
    if (keyRes.rateLimitHeaders) {
      (req as any)._rateLimitHeaders = keyRes.rateLimitHeaders;
    }
    if (!keyRes.ok) {
      return {
        ok: false,
        response: err(keyRes.error || "Unauthorized", keyRes.status || 401, keyRes.rateLimitHeaders || {}),
      };
    }
    return { ok: true, apiKey: keyRes.apiKey };
  }

  if (isMisconfigured(env)) {
    return {
      ok: false,
      response: err(
        "Server configuration incomplete: ADMIN_TOKEN secret is not configured.",
        503
      ),
    };
  }

  if (!env.ADMIN_TOKEN) {
    return { ok: true };
  }

  const ip = getClientIp(req);
  const rlKey = `rl:${(await computeIpHash(ip, env)).slice(0, 16)}`;
  const rlRecord = await readRateLimit(env, rlKey);
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

  const headerValid = await extractHeaderAdminToken(req, env);
  const cookieValid = headerValid ? false : await verifySessionCookie(req, env);

  if (headerValid || cookieValid) {
    if (rlRecord) {
      ctx.waitUntil(env.URL_KV.delete(rlKey));
    }
    return { ok: true };
  }

  await recordRateLimitFailure(env, rlKey, rlRecord, AUTH_WINDOW_SECONDS);
  return { ok: false, response: err("Unauthorized", 401) };
}

async function handleAuthLogin(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (isMisconfigured(env)) {
    return err("Server configuration incomplete: ADMIN_TOKEN secret is not configured.", 503);
  }
  if (!env.ADMIN_TOKEN) {
    return json({ ok: true, authenticated: true, authRequired: false });
  }

  const ip = getClientIp(req);
  const rlKey = `rl:${(await computeIpHash(ip, env)).slice(0, 16)}`;
  const rlRecord = await readRateLimit(env, rlKey);
  const now = Date.now();

  if (rlRecord && rlRecord.count >= MAX_AUTH_FAILURES && now < rlRecord.resetAt) {
    const retryAfter = Math.max(1, Math.ceil((rlRecord.resetAt - now) / 1000));
    return err(
      "Too many failed authentication attempts. Please try again later.",
      429,
      { "Retry-After": String(retryAfter) }
    );
  }

  const bodyParsed = await readBoundedJson<{ token?: unknown }>(req, 4096);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }

  const submitted = typeof bodyParsed.data.token === "string" ? bodyParsed.data.token : "";
  if (!submitted || !(await constantTimeEqual(submitted, env.ADMIN_TOKEN))) {
    await recordRateLimitFailure(env, rlKey, rlRecord, AUTH_WINDOW_SECONDS);
    return err("Invalid admin token", 401);
  }

  if (rlRecord) {
    ctx.waitUntil(env.URL_KV.delete(rlKey));
  }

  const cookieVal = await mintSessionCookieValue(env.ADMIN_TOKEN);
  return json(
    { ok: true, authenticated: true, authRequired: true },
    200,
    { "Set-Cookie": buildSessionSetCookieHeader(req, cookieVal, SESSION_TTL_SECONDS) }
  );
}

async function handleAuthLogout(req: Request): Promise<Response> {
  return json(
    { ok: true, authenticated: false },
    200,
    { "Set-Cookie": buildSessionSetCookieHeader(req, "", 0) }
  );
}

async function handleAuthSession(req: Request, env: Env): Promise<Response> {
  if (isMisconfigured(env)) {
    return json(
      {
        authRequired: true,
        authenticated: false,
        configured: false,
        error: "Server configuration incomplete: ADMIN_TOKEN secret is not configured.",
      },
      503
    );
  }
  if (!env.ADMIN_TOKEN) {
    return json({ authRequired: false, authenticated: true, configured: true });
  }
  const headerValid = await extractHeaderAdminToken(req, env);
  const cookieValid = headerValid ? false : await verifySessionCookie(req, env);
  return json({
    authRequired: true,
    authenticated: headerValid || cookieValid,
    configured: true,
  });
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
  /slackbot|discordbot|whatsapp|telegrambot|twitterbot|facebookexternalhit|facebookcatalog|facebot|instagram|linkedinbot|pinterest|skypeuripreview|embedly|quora link preview|applebot|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|petalbot|bytespider|tiktokbot|snapchat|redditbot|ahrefsbot|semrushbot|mj12bot|gptbot|claudebot|ccbot/i;

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

export function detectOsCategory(ua: string): "ios" | "android" | "desktop" {
  const low = ua.toLowerCase();
  if (/iphone|ipad|ipod/i.test(low)) return "ios";
  if (/android/i.test(low)) return "android";
  return "desktop";
}

export function pickSplitVariant(splits: SplitRoute[]): { url: string; index: number } | null {
  if (!splits || splits.length === 0) return null;
  const total = splits.reduce((acc, s) => acc + (s.weight > 0 ? s.weight : 0), 0);
  if (total <= 0) return { url: splits[0].url, index: 0 };
  let rand = Math.random() * total;
  for (let i = 0; i < splits.length; i++) {
    const w = splits[i].weight > 0 ? splits[i].weight : 0;
    if (rand < w) {
      return { url: splits[i].url, index: i };
    }
    rand -= w;
  }
  return { url: splits[splits.length - 1].url, index: splits.length - 1 };
}

export function resolveDestinationUrl(
  data: URLData,
  country: string,
  os: "ios" | "android" | "desktop",
  req?: Request
): { targetUrl: string; reason: "device" | "geo" | "split" | "fallback" | "time" | "default"; splitVariantUrl?: string } {
  // Auto-failover if target destination is marked broken and autoFailover is enabled (or status >= 500) and fallbackUrl is set
  if (
    data.fallbackUrl &&
    ((data.autoFailover && data.healthStatus && !data.healthStatus.ok) ||
      (data.healthStatus && !data.healthStatus.ok && data.healthStatus.status >= 500))
  ) {
    return { targetUrl: data.fallbackUrl, reason: "fallback" };
  }
  // Smart Time-of-Day Routing
  if (data.timeRoutes && data.timeRoutes.length > 0) {
    const timeMatch = evaluateTimeRoute(data.timeRoutes, req);
    if (timeMatch) {
      return { targetUrl: timeMatch, reason: "time" };
    }
  }
  if (data.deviceRoutes && data.deviceRoutes[os]?.trim()) {
    return { targetUrl: data.deviceRoutes[os]!.trim(), reason: "device" };
  }
  const upperCountry = country.toUpperCase();
  if (data.geoRoutes && data.geoRoutes[upperCountry]?.trim()) {
    return { targetUrl: data.geoRoutes[upperCountry]!.trim(), reason: "geo" };
  }
  if (data.splits && data.splits.length > 0) {
    const chosen = pickSplitVariant(data.splits);
    if (chosen) {
      return { targetUrl: chosen.url, reason: "split", splitVariantUrl: chosen.url };
    }
  }
  return { targetUrl: data.originalUrl, reason: "default" };
}

function parseReferrer(referer: string | null): string {
  if (!referer) return "direct";
  try {
    const host = new URL(referer).hostname.trim().toLowerCase().slice(0, 100);
    return host || "direct";
  } catch {
    return "direct";
  }
}

function getVisitorCountry(req: Request): string {
  const cf = (req as Request & { cf?: { country?: unknown } }).cf;
  if (cf && typeof cf.country === "string" && cf.country.trim()) {
    return cf.country.trim().toUpperCase();
  }
  const header = req.headers.get("CF-IPCountry") || req.headers.get("X-Country");
  if (header && header.trim()) {
    return header.trim().toUpperCase();
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

function parseIpv4Uint32(hostname: string): number | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = ((value << 8) | octet) >>> 0;
  }
  return value;
}

function isDisallowedIpv4Uint32(ip: number): boolean {
  const a = (ip >>> 24) & 0xff;
  const b = (ip >>> 16) & 0xff;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
  if (a === 192 && b === 0 && ((ip >>> 8) & 0xff) === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmark)
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  return false;
}

function parseIpv6Hextets(rawHost: string): number[] | null {
  const inner = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
  const zoneIdx = inner.indexOf("%");
  const clean = (zoneIdx >= 0 ? inner.slice(0, zoneIdx) : inner).toLowerCase();
  if (!clean.includes(":")) return null;

  const doubleColonParts = clean.split("::");
  if (doubleColonParts.length > 2) return null;

  const parseSide = (side: string, allowIpv4Tail: boolean): number[] | null => {
    if (!side) return [];
    const tokens = side.split(":");
    const out: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok) return null;
      if (allowIpv4Tail && i === tokens.length - 1 && tok.includes(".")) {
        const v4 = parseIpv4Uint32(tok);
        if (v4 === null) return null;
        out.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(tok)) return null;
        out.push(parseInt(tok, 16));
      }
    }
    return out;
  };

  if (doubleColonParts.length === 1) {
    const full = parseSide(doubleColonParts[0], true);
    return full && full.length === 8 ? full : null;
  }

  const left = parseSide(doubleColonParts[0], false);
  const right = parseSide(doubleColonParts[1], true);
  if (!left || !right) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;
  return [...left, ...new Array(missing).fill(0), ...right];
}

function isDisallowedIpv6(hextets: number[]): boolean {
  const isAllZeroPrefix = (count: number) => hextets.slice(0, count).every((h) => h === 0);

  // ::/128 unspecified and ::1/128 loopback
  if (isAllZeroPrefix(7) && (hextets[7] === 0 || hextets[7] === 1)) return true;

  // ::ffff:0:0/96 IPv4-mapped IPv6
  if (isAllZeroPrefix(5) && hextets[5] === 0xffff) {
    const v4 = ((hextets[6] << 16) | hextets[7]) >>> 0;
    return isDisallowedIpv4Uint32(v4);
  }

  // 64:ff9b::/96 and 64:ff9b:1::/48 NAT64 translation prefixes
  if (hextets[0] === 0x0064 && hextets[1] === 0xff9b && hextets[2] <= 1 && isAllZeroPrefix(6) === false) {
    if (isAllZeroPrefix(4) || (hextets[1] === 0xff9b && hextets[2] === 0 && hextets[3] === 0 && hextets[4] === 0 && hextets[5] === 0)) {
      const v4 = ((hextets[6] << 16) | hextets[7]) >>> 0;
      if (isDisallowedIpv4Uint32(v4)) return true;
    }
  }

  // 100::/64 discard-only
  if (hextets[0] === 0x0100 && hextets[1] === 0 && hextets[2] === 0 && hextets[3] === 0) return true;

  // fc00::/7 Unique Local Address (includes fd00:ec2::254 metadata)
  if ((hextets[0] & 0xfe00) === 0xfc00) return true;

  // fe80::/10 Link-Local
  if ((hextets[0] & 0xffc0) === 0xfe80) return true;

  // ff00::/8 Multicast
  if ((hextets[0] & 0xff00) === 0xff00) return true;

  return false;
}

function validateExternalUrl(
  rawUrl: string | undefined,
  reqUrl: string,
  opts: { requireHttps?: boolean; maxLength?: number } = {}
): { url?: string; error?: string } {
  const maxLength = opts.maxLength ?? MAX_URL_LENGTH;
  const url = rawUrl?.trim();
  if (!url) return { error: "Missing URL" };
  if (url.length > maxLength) {
    return { error: `URL exceeds maximum length of ${maxLength} characters` };
  }
  if (/[\u0000-\u001F\u007F]/.test(url)) {
    return { error: "URL contains invalid control characters" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: "Invalid URL format" };
  }

  if (opts.requireHttps) {
    if (parsedUrl.protocol !== "https:") {
      return { error: "URL must start with https://" };
    }
  } else if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { error: "URL must start with http:// or https://" };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return { error: "URLs must not embed credentials" };
  }

  const requestHost = new URL(reqUrl).host.toLowerCase();
  const targetHost = parsedUrl.host.toLowerCase();
  const targetHostname = parsedUrl.hostname.toLowerCase().replace(/\.+$/, "");
  if (!targetHostname) {
    return { error: "Invalid URL hostname" };
  }
  if (targetHost === requestHost) {
    return { error: "Cannot shorten or route a URL pointing to this shortener host" };
  }
  if (
    targetHostname === "localhost" ||
    targetHostname.endsWith(".localhost") ||
    targetHostname.endsWith(".local") ||
    targetHostname.endsWith(".internal") ||
    targetHostname.endsWith(".arpa")
  ) {
    return { error: "Private, internal, or localhost URLs are not allowed" };
  }

  if (targetHostname.startsWith("[") && targetHostname.endsWith("]")) {
    const hextets = parseIpv6Hextets(targetHostname);
    if (!hextets || isDisallowedIpv6(hextets)) {
      return { error: "Private, loopback, or reserved IPv6 destinations are not allowed" };
    }
    return { url };
  }

  const ipv4 = parseIpv4Uint32(targetHostname);
  if (ipv4 !== null) {
    if (isDisallowedIpv4Uint32(ipv4)) {
      return { error: "Private, loopback, link-local, or reserved IPv4 destinations are not allowed" };
    }
    return { url };
  }

  if (/^(?:\d+|0x[0-9a-f]+)(?:\.(?:\d+|0x[0-9a-f]+)){0,3}$/i.test(targetHostname)) {
    return { error: "Encoded or non-standard numeric IP hosts are not allowed" };
  }

  if (!targetHostname.includes(".")) {
    return { error: "Single-label or unqualified internal hostnames are not allowed" };
  }

  return { url };
}

export function isSuspiciousThreatUrl(targetUrl: string): { threat: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const full = `${host}${pathname}`;

    // 1. Phishing & credential harvesting keywords
    const highRiskPhrases = [
      "login-verify",
      "account-update",
      "secure-banking-auth",
      "paypal-verify",
      "appleid-reset",
      "microsoft-online-login",
      "crypto-airdrop-claim",
      "free-giftcard-generator",
      "banking-confirm",
      "recover-wallet-seed",
      "discord-nitro-free",
      "steam-community-trade-verify",
    ];

    for (const phrase of highRiskPhrases) {
      if (full.includes(phrase)) {
        return { threat: true, reason: `Destination URL flagged as deceptive: contains suspicious phrase '${phrase}'` };
      }
    }

    // 2. Punycode / IDN spoofing check (e.g. xn-- domains mimicking brands)
    if (host.startsWith("xn--") || host.includes(".xn--")) {
      const suspiciousBrands = ["paypal", "apple", "google", "bank", "crypto", "amazon", "microsoft"];
      for (const brand of suspiciousBrands) {
        if (full.includes(brand)) {
          return { threat: true, reason: "Destination URL flagged as potential punycode brand spoofing" };
        }
      }
    }

    // 3. Multi-level subdomains spoofing recognizable brands on disposable domains
    const parts = host.split(".");
    if (parts.length >= 4) {
      const brandSpoofs = ["paypal", "chase", "bankofamerica", "wellsfargo", "coinbase", "binance", "metamask"];
      const prefix = parts.slice(0, parts.length - 2).join(".");
      for (const brand of brandSpoofs) {
        if (prefix.includes(brand)) {
          return { threat: true, reason: `Destination URL flagged as deceptive brand spoofing for '${brand}'` };
        }
      }
    }

    return { threat: false };
  } catch {
    return { threat: false };
  }
}

function validateDestinationUrl(rawUrl: string | undefined, reqUrl: string): { url?: string; error?: string } {
  if (!rawUrl || !rawUrl.trim()) return { error: "Missing 'url' field" };
  const res = validateExternalUrl(rawUrl, reqUrl, { requireHttps: false, maxLength: MAX_URL_LENGTH });
  if (res.error || !res.url) return res;

  const threat = isSuspiciousThreatUrl(res.url);
  if (threat.threat) {
    return { error: threat.reason || "Destination URL flagged as potentially malicious or deceptive" };
  }
  return res;
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

function parseScheduleInput(raw: unknown): { value: string | null; error?: string } {
  if (raw === undefined || raw === null || raw === "") return { value: null };
  if (typeof raw !== "string") return { value: null, error: "Invalid schedule format" };
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return { value: null, error: "Invalid schedule date/time format (use ISO 8601 or YYYY-MM-DDTHH:mm)" };
  }
  return { value: parsed.toISOString() };
}

function parseFallbackUrl(raw: unknown, reqUrl: string): { url: string | null; error?: string } {
  if (raw === undefined || raw === null || raw === "") return { url: null };
  if (typeof raw !== "string" || !raw.trim()) return { url: null };
  const valid = validateDestinationUrl(raw, reqUrl);
  if (valid.error || !valid.url) {
    return { url: null, error: `Fallback URL: ${valid.error || "Invalid URL"}` };
  }
  return { url: valid.url };
}

function normalizeGeoRoutes(
  raw: unknown,
  reqUrl: string
): { routes: Record<string, string>; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { routes: {} };
  }
  const routes: Record<string, string> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 30) {
    return { routes: {}, error: "Geo routes limit is 30 countries" };
  }
  for (const [key, val] of entries) {
    const code = key.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      return { routes: {}, error: `Invalid country code: '${key}' (must be 2-letter ISO code like US, IN, GB)` };
    }
    if (typeof val !== "string" || !val.trim()) continue;
    const valid = validateDestinationUrl(val, reqUrl);
    if (valid.error || !valid.url) {
      return { routes: {}, error: `Geo route [${code}]: ${valid.error || "Invalid URL"}` };
    }
    routes[code] = valid.url;
  }
  return { routes };
}

function normalizeDeviceRoutes(
  raw: unknown,
  reqUrl: string
): { routes: { ios?: string | null; android?: string | null; desktop?: string | null }; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { routes: {} };
  }
  const rec = raw as Record<string, unknown>;
  const routes: { ios?: string | null; android?: string | null; desktop?: string | null } = {};

  for (const deviceKey of ["ios", "android", "desktop"] as const) {
    const val = rec[deviceKey];
    if (typeof val === "string" && val.trim()) {
      const valid = validateDestinationUrl(val, reqUrl);
      if (valid.error || !valid.url) {
        return { routes: {}, error: `Device route [${deviceKey}]: ${valid.error || "Invalid URL"}` };
      }
      routes[deviceKey] = valid.url;
    }
  }
  return { routes };
}

export function normalizeSplitRoutes(
  raw: unknown,
  reqUrl: string
): { splits: SplitRoute[]; error?: string } {
  if (raw === null || raw === undefined) {
    return { splits: [] };
  }
  if (!Array.isArray(raw)) {
    return { splits: [], error: "Split routes must be an array of { url, weight, label? }" };
  }
  if (raw.length === 0) {
    return { splits: [] };
  }
  if (raw.length > 5) {
    return { splits: [], error: "A maximum of 5 split variants is supported" };
  }
  const result: SplitRoute[] = [];
  let totalWeight = 0;
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      return { splits: [], error: `Split variant #${i + 1} must be an object` };
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.url !== "string" || !rec.url.trim()) {
      return { splits: [], error: `Split variant #${i + 1} is missing a destination URL` };
    }
    const valid = validateDestinationUrl(rec.url, reqUrl);
    if (valid.error || !valid.url) {
      return { splits: [], error: `Split variant #${i + 1}: ${valid.error || "Invalid URL"}` };
    }
    const weightNum = Number(rec.weight);
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 100) {
      return { splits: [], error: `Split variant #${i + 1} weight must be between 1% and 100%` };
    }
    const label = typeof rec.label === "string" ? rec.label.trim().slice(0, 40) : null;
    result.push({
      url: valid.url,
      weight: Math.round(weightNum),
      label: label || undefined,
    });
    totalWeight += Math.round(weightNum);
  }
  if (totalWeight !== 100) {
    return { splits: [], error: `Total split weight must equal 100% (currently ${totalWeight}%)` };
  }
  return { splits: result };
}

function normalizeOgText(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed || null;
}

export interface AppDeepLinkTarget {
  app: string;
  scheme: string;
}

export function isMobileUserAgent(ua: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(ua);
}

export function detectAppDeepLink(urlStr: string): AppDeepLinkTarget | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // YouTube
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let videoId: string | null = null;
      if (host.includes("youtu.be")) {
        videoId = path.slice(1).split("/")[0] || null;
      } else if (path.startsWith("/watch")) {
        videoId = u.searchParams.get("v");
      } else if (path.startsWith("/shorts/")) {
        videoId = path.replace("/shorts/", "").split("/")[0] || null;
      }
      if (videoId) {
        return { app: "YouTube", scheme: `vnd.youtube:${videoId}` };
      }
      return { app: "YouTube", scheme: `vnd.youtube://${host}${path}${u.search}` };
    }

    // Spotify
    if (host.includes("spotify.com")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2 && ["track", "album", "playlist", "artist", "show", "episode"].includes(parts[0])) {
        return { app: "Spotify", scheme: `spotify:${parts[0]}:${parts[1]}` };
      }
      return { app: "Spotify", scheme: `spotify://${host}${path}` };
    }

    // Twitter / X
    if (host.includes("twitter.com") || host.includes("x.com")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 3 && parts[1] === "status") {
        return { app: "X / Twitter", scheme: `twitter://status?id=${parts[2]}` };
      }
      if (parts.length === 1 && !["home", "explore", "notifications", "messages"].includes(parts[0])) {
        return { app: "X / Twitter", scheme: `twitter://user?screen_name=${parts[0]}` };
      }
      return { app: "X / Twitter", scheme: `twitter://timeline` };
    }

    // Instagram
    if (host.includes("instagram.com")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2 && (parts[0] === "p" || parts[0] === "reel")) {
        return { app: "Instagram", scheme: `instagram://media?id=${parts[1]}` };
      }
      if (parts.length === 1 && !["explore", "reels", "direct", "accounts"].includes(parts[0])) {
        return { app: "Instagram", scheme: `instagram://user?username=${parts[0]}` };
      }
      return { app: "Instagram", scheme: `instagram://app` };
    }

    // TikTok
    if (host.includes("tiktok.com")) {
      const parts = path.split("/").filter(Boolean);
      const videoIdx = parts.indexOf("video");
      if (videoIdx !== -1 && parts[videoIdx + 1]) {
        return { app: "TikTok", scheme: `snssdk1233://aweme/detail/${parts[videoIdx + 1]}` };
      }
      return { app: "TikTok", scheme: `tiktok://app` };
    }

    // Telegram
    if (host.includes("t.me") || host.includes("telegram.me")) {
      const domain = path.slice(1).split("/")[0];
      if (domain) {
        return { app: "Telegram", scheme: `tg://resolve?domain=${domain}` };
      }
    }
  } catch {}
  return null;
}

export function normalizeCampaign(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 48);
  return clean || null;
}

export function normalizeExpiredAction(
  rawAction: unknown,
  rawUrl: unknown,
  reqUrl: string
): { expiredAction: "message" | "redirect" | null; expiredUrl: string | null; error?: string } {
  if (rawAction === undefined && rawUrl === undefined) {
    return { expiredAction: null, expiredUrl: null };
  }
  const actionStr = typeof rawAction === "string" ? rawAction.trim().toLowerCase() : "";
  if (actionStr === "redirect") {
    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return { expiredAction: null, expiredUrl: null, error: "Expired action 'redirect' requires an 'expiredUrl' destination" };
    }
    const valid = validateDestinationUrl(rawUrl, reqUrl);
    if (valid.error || !valid.url) {
      return { expiredAction: null, expiredUrl: null, error: `Expired URL: ${valid.error || "Invalid URL"}` };
    }
    return { expiredAction: "redirect", expiredUrl: valid.url };
  }
  if (actionStr === "message") {
    return { expiredAction: "message", expiredUrl: null };
  }
  if (rawAction === null || rawAction === "") {
    return { expiredAction: null, expiredUrl: null };
  }
  return { expiredAction: null, expiredUrl: null, error: "Expired action must be either 'message' or 'redirect'" };
}

export function hasAnyPixel(pixels?: PixelConfig | null): boolean {
  if (!pixels) return false;
  return !!(
    (pixels.facebookPixelId && pixels.facebookPixelId.trim()) ||
    (pixels.googleAnalyticsId && pixels.googleAnalyticsId.trim()) ||
    (pixels.tiktokPixelId && pixels.tiktokPixelId.trim()) ||
    (pixels.linkedinPartnerId && pixels.linkedinPartnerId.trim()) ||
    (pixels.twitterPixelId && pixels.twitterPixelId.trim())
  );
}

export function normalizePixelConfig(raw: unknown): PixelConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const clean = (val: unknown): string | null => {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!trimmed || trimmed.length > 64) return null;
    if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return null;
    return trimmed;
  };

  const fb = clean(obj.facebookPixelId ?? obj.meta ?? obj.facebook);
  const ga = clean(obj.googleAnalyticsId ?? obj.googleAnalytics ?? obj.google ?? obj.ga4);
  const tt = clean(obj.tiktokPixelId ?? obj.tiktok);
  const li = clean(obj.linkedinPartnerId ?? obj.linkedin);
  const tw = clean(obj.twitterPixelId ?? obj.twitter);

  if (!fb && !ga && !tt && !li && !tw) return null;

  return {
    ...(fb ? { facebookPixelId: fb, meta: fb } : {}),
    ...(ga ? { googleAnalyticsId: ga, google: ga } : {}),
    ...(tt ? { tiktokPixelId: tt, tiktok: tt } : {}),
    ...(li ? { linkedinPartnerId: li, linkedin: li } : {}),
    ...(tw ? { twitterPixelId: tw, twitter: tw } : {}),
  };
}

export function normalizeTimeRoutes(
  raw: unknown,
  baseOrigin: string
): { routes?: TimeRoute[]; error?: string } {
  if (!raw) return { routes: [] };
  if (!Array.isArray(raw)) return { error: "Time routes must be an array" };
  if (raw.length > 20) return { error: "Maximum 20 time routes allowed" };

  const routes: TimeRoute[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || typeof r !== "object") return { error: `Time route at index ${i} is invalid` };
    const obj = r as Record<string, unknown>;
    if (typeof obj.url !== "string" || !obj.url.trim()) {
      return { error: `Time route at index ${i} must specify a valid destination URL` };
    }
    const valid = validateDestinationUrl(obj.url.trim(), baseOrigin);
    if (valid.error || !valid.url) {
      return { error: `Time route at index ${i} URL error: ${valid.error || "invalid format"}` };
    }
    const startHour = Number(obj.startHour);
    const endHour = Number(obj.endHour);
    if (isNaN(startHour) || startHour < 0 || startHour > 23) {
      return { error: `Time route at index ${i} startHour must be between 0 and 23` };
    }
    if (isNaN(endHour) || endHour < 0 || endHour > 24) {
      return { error: `Time route at index ${i} endHour must be between 0 and 24` };
    }
    let days: number[] | undefined;
    if (Array.isArray(obj.days)) {
      days = obj.days
        .map((d) => Number(d))
        .filter((d) => !isNaN(d) && d >= 0 && d <= 6);
    }
    const tz = typeof obj.timezone === "string" && obj.timezone.trim() ? obj.timezone.trim().slice(0, 50) : undefined;
    const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim().slice(0, 40) : null;

    routes.push({
      url: valid.url,
      startHour,
      endHour,
      ...(days && days.length ? { days } : {}),
      ...(tz ? { timezone: tz } : {}),
      label,
    });
  }
  return { routes };
}

export function normalizeCtaOverlay(
  raw: unknown,
  baseOrigin: string
): { config?: CtaOverlayConfig | null; error?: string } {
  if (!raw) return { config: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { error: "CTA overlay configuration must be an object" };
  const obj = raw as Record<string, unknown>;
  if (!obj.enabled) return { config: null };

  const bannerText = typeof obj.bannerText === "string" ? obj.bannerText.trim().slice(0, 150) : (typeof obj.message === "string" ? obj.message.trim().slice(0, 150) : "");
  const buttonText = typeof obj.buttonText === "string" ? obj.buttonText.trim().slice(0, 40) : "";
  const buttonUrlRaw = typeof obj.buttonUrl === "string" ? obj.buttonUrl.trim() : "";

  if (!bannerText) return { error: "CTA overlay requires bannerText (up to 150 characters)" };
  if (!buttonText) return { error: "CTA overlay requires buttonText (up to 40 characters)" };
  if (!buttonUrlRaw) return { error: "CTA overlay requires buttonUrl" };

  const validBtn = validateDestinationUrl(buttonUrlRaw, baseOrigin);
  if (validBtn.error || !validBtn.url) {
    return { error: `CTA overlay button URL error: ${validBtn.error || "invalid format"}` };
  }

  let avatarUrl: string | null = null;
  if (typeof obj.avatarUrl === "string" && obj.avatarUrl.trim()) {
    const validAv = validateDestinationUrl(obj.avatarUrl.trim(), baseOrigin);
    if (!validAv.error && validAv.url) {
      avatarUrl = validAv.url;
    }
  }

  const theme = obj.theme === "light" || obj.theme === "accent" ? obj.theme : "dark";
  const position = obj.position === "top" ? "top" : "bottom";

  return {
    config: {
      enabled: true,
      bannerText,
      buttonText,
      buttonUrl: validBtn.url,
      avatarUrl,
      theme,
      position,
    },
  };
}

export function evaluateTimeRoute(routes: TimeRoute[] | undefined, req?: Request): string | null {
  if (!routes || !routes.length) return null;

  const cfTimezone = req ? ((req as any).cf?.timezone as string | undefined) : undefined;

  for (const route of routes) {
    if (!route.url) continue;
    const tz = route.timezone || cfTimezone || "UTC";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        hour: "numeric",
        weekday: "short",
      });
      const parts = formatter.formatToParts(new Date());
      let hour = 0;
      let weekdayStr = "Sun";
      for (const p of parts) {
        if (p.type === "hour") hour = parseInt(p.value, 10);
        if (p.type === "weekday") weekdayStr = p.value;
      }
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const currentDay = dayMap[weekdayStr] ?? new Date().getDay();

      if (Array.isArray(route.days) && route.days.length > 0) {
        if (!route.days.includes(currentDay)) continue;
      }

      const start = Number(route.startHour) || 0;
      const end = Number(route.endHour) || 24;

      if (start <= end) {
        if (hour >= start && hour < end) {
          return route.url;
        }
      } else {
        if (hour >= start || hour < end) {
          return route.url;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function normalizeBioLeadCapture(raw: unknown): BioLeadCapture | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const enabled = rec.enabled === true;
  return {
    enabled,
    title: typeof rec.title === "string" ? rec.title.trim().slice(0, 80) : undefined,
    description: typeof rec.description === "string" ? rec.description.trim().slice(0, 200) : undefined,
    buttonText: typeof rec.buttonText === "string" ? rec.buttonText.trim().slice(0, 40) : undefined,
    successMessage: typeof rec.successMessage === "string" ? rec.successMessage.trim().slice(0, 150) : undefined,
  };
}

function isLinkExpired(data: { expiresAt?: string | null }, now = new Date()): boolean {
  return data.expiresAt ? new Date(data.expiresAt) < now : false;
}

function isLinkPending(data: { startsAt?: string | null }, now = new Date()): boolean {
  if (!data.startsAt) return false;
  const d = new Date(data.startsAt);
  return !isNaN(d.getTime()) && d > now;
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
    ...(data.startsAt ? { startsAt: data.startsAt } : {}),
    ...(data.deepLink ? { deepLink: true } : {}),
    ...(data.campaign ? { campaign: data.campaign } : {}),
    ...(data.expiredAction ? { expiredAction: data.expiredAction } : {}),
    ...(data.expiredUrl ? { expiredUrl: data.expiredUrl } : {}),
    ...(data.pixels && hasAnyPixel(data.pixels) ? { hasPixels: true } : {}),
    ...(data.pixelBridge ? { pixelBridge: true } : {}),
    ...(data.autoFailover ? { autoFailover: true } : {}),
    ...(data.timeRoutes && data.timeRoutes.length ? { hasTimeRoutes: true } : {}),
    ...(data.ctaOverlay?.enabled ? { hasCtaOverlay: true } : {}),
  };

  if (encoder.encode(JSON.stringify(full)).length <= MAX_KV_META_BYTES) {
    return full;
  }
  const compact: URLMetadata = {
    ...base,
    ...(data.maxClicks ? { maxClicks: data.maxClicks } : {}),
    ...(data.passwordHash ? { hasPassword: true } : {}),
    ...(data.publicStats ? { publicStats: true } : {}),
    ...(data.startsAt ? { startsAt: data.startsAt } : {}),
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

export function generateBrandedQrSvg(url: string, opts: BrandedQrOptions = {}): string {
  try {
    const hasLogo = Boolean(opts.logo && opts.logo !== "none");
    const requestedEc = opts.errorCorrectionLevel || "M";
    const ec: "L" | "M" | "Q" | "H" = hasLogo
      ? (requestedEc === "L" ? "M" : requestedEc)
      : requestedEc;

    const qr = QRCode.create(url, { errorCorrectionLevel: ec });
    const size = qr.modules.size;
    const margin = opts.margin ?? 3;
    const total = size + margin * 2;
    const width = opts.width || 512;
    const cornerStyle = opts.cornerStyle || "square";
    const colorDark = opts.colorDark || "#0F172A";
    const colorLight = opts.colorLight || "#FFFFFF";
    const useGrad = Boolean(opts.useGradient && opts.gradientStart && opts.gradientEnd);
    const fill = useGrad ? "url(#qrGrad)" : colorDark;

    let defs = "";
    if (useGrad) {
      defs = `<defs><linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${escapeHtml(opts.gradientStart!)}"/><stop offset="100%" stop-color="${escapeHtml(opts.gradientEnd!)}"/></linearGradient></defs>`;
    }

    const logoModules = hasLogo ? Math.max(5, Math.floor(size * 0.22) | 1) : 0;
    const centerMod = Math.floor(size / 2);
    const halfLogo = Math.floor(logoModules / 2);

    const isFinder = (r: number, c: number) => {
      return (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
    };

    const inLogoArea = (r: number, c: number) => {
      if (!hasLogo) return false;
      return (
        r >= centerMod - halfLogo &&
        r <= centerMod + halfLogo &&
        c >= centerMod - halfLogo &&
        c <= centerMod + halfLogo
      );
    };

    const paths: string[] = [];

    // Stylized Finder patterns
    const finders = [
      { r: 0, c: 0 },
      { r: 0, c: size - 7 },
      { r: size - 7, c: 0 },
    ];

    finders.forEach((f) => {
      const fx = f.c + margin;
      const fy = f.r + margin;
      const rxOuter = cornerStyle === "dots" ? 2.2 : cornerStyle === "rounded" ? 1.2 : 0;
      const rxInner = cornerStyle === "dots" ? 1.2 : cornerStyle === "rounded" ? 0.6 : 0;

      // Outer 7x7
      paths.push(`<rect x="${fx}" y="${fy}" width="7" height="7" rx="${rxOuter}" fill="${fill}"/>`);
      // Inner background 5x5
      paths.push(
        `<rect x="${fx + 1}" y="${fy + 1}" width="5" height="5" rx="${rxOuter * 0.7}" fill="${colorLight === "transparent" ? "#FFFFFF" : colorLight}"/>`
      );
      // Inner dot 3x3
      paths.push(`<rect x="${fx + 2}" y="${fy + 2}" width="3" height="3" rx="${rxInner}" fill="${fill}"/>`);
    });

    // Data modules
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isFinder(r, c) || inLogoArea(r, c)) continue;
        if (qr.modules.get(r, c)) {
          const mx = c + margin;
          const my = r + margin;
          if (cornerStyle === "dots") {
            paths.push(`<circle cx="${mx + 0.5}" cy="${my + 0.5}" r="0.42" fill="${fill}"/>`);
          } else if (cornerStyle === "rounded") {
            paths.push(`<rect x="${mx + 0.06}" y="${my + 0.06}" width="0.88" height="0.88" rx="0.28" fill="${fill}"/>`);
          } else {
            paths.push(`<rect x="${mx}" y="${my}" width="1" height="1" fill="${fill}"/>`);
          }
        }
      }
    }

    let logoSvg = "";
    if (hasLogo) {
      const badgeX = centerMod - halfLogo + margin - 0.2;
      const badgeY = centerMod - halfLogo + margin - 0.2;
      const badgeW = logoModules + 0.4;
      const badgeRx = cornerStyle === "dots" ? badgeW / 2 : cornerStyle === "rounded" ? 1.4 : 0.6;
      const badgeBg = colorLight === "transparent" ? "#FFFFFF" : colorLight;

      logoSvg += `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeW}" rx="${badgeRx}" fill="${badgeBg}" stroke="${colorDark}" stroke-width="0.2" stroke-opacity="0.15"/>`;

      const iconX = badgeX + badgeW * 0.18;
      const iconY = badgeY + badgeW * 0.18;
      const iconW = badgeW * 0.64;
      const stroke = colorDark;
      const fillBg = badgeBg;

      if (opts.logo === "globe") {
        logoSvg += `<g transform="translate(${iconX},${iconY}) scale(${iconW / 24})"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></g>`;
      } else if (opts.logo === "instagram") {
        logoSvg += `<g transform="translate(${iconX},${iconY}) scale(${iconW / 24})"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="${stroke}" stroke="none"/></svg></g>`;
      } else if (opts.logo === "youtube") {
        logoSvg += `<g transform="translate(${iconX},${iconY}) scale(${iconW / 24})"><svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="4" fill="${stroke}"/><polygon points="10,8 16,12 10,16" fill="${fillBg}"/></svg></g>`;
      } else if (opts.logo === "twitter") {
        logoSvg += `<g transform="translate(${iconX},${iconY}) scale(${iconW / 24})"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="${stroke}"/></svg></g>`;
      } else if (opts.logo === "github") {
        logoSvg += `<g transform="translate(${iconX},${iconY}) scale(${iconW / 24})"><svg width="24" height="24" viewBox="0 0 24 24" fill="${stroke}"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg></g>`;
      } else if (opts.logo === "linkedin") {
        logoSvg += `<g transform="translate(${iconX},${iconY}) scale(${iconW / 24})"><svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="${stroke}"/><path d="M6 9h3v9H6zM7.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11 9h2.8v1.3h.04c.4-.7 1.4-1.5 2.9-1.5 3.1 0 3.7 2 3.7 4.7V18h-3v-4.1c0-1 0-2.3-1.4-2.3-1.4 0-1.6 1.1-1.6 2.2V18h-3z" fill="${fillBg}"/></svg></g>`;
      } else if (opts.logo === "custom" && opts.customLogoUrl) {
        logoSvg += `<image href="${escapeHtml(opts.customLogoUrl)}" x="${iconX}" y="${iconY}" width="${iconW}" height="${iconW}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }

    const bgRect = colorLight === "transparent" ? "" : `<rect width="${total}" height="${total}" fill="${colorLight}"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${width}" height="${width}">${defs}${bgRect}${paths.join("")}${logoSvg}</svg>`;
  } catch {
    return qrcodeFallback();
  }
}

async function generateQR(url: string, opts?: BrandedQrOptions): Promise<string> {
  return generateBrandedQrSvg(url, opts);
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

function toListEntry(
  slug: string,
  d: Pick<
    URLData,
    | "originalUrl"
    | "clicks"
    | "createdAt"
    | "expiresAt"
    | "label"
    | "tags"
    | "maxClicks"
    | "passwordHash"
    | "ogTitle"
    | "ogDescription"
    | "publicStats"
    | "botClicks"
    | "startsAt"
    | "fallbackUrl"
    | "geoRoutes"
    | "deviceRoutes"
    | "splits"
    | "healthStatus"
  >,
  now: Date
): URLListEntry {
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
    startsAt: d.startsAt ?? null,
    fallbackUrl: d.fallbackUrl ?? null,
    isPending: isLinkPending(d, now),
    geoRoutes: d.geoRoutes || {},
    deviceRoutes: d.deviceRoutes || {},
    splits: d.splits || [],
    healthStatus: d.healthStatus ?? null,
    deepLink: !!(d as any).deepLink,
    campaign: (d as any).campaign ?? null,
    expiredAction: (d as any).expiredAction ?? null,
    expiredUrl: (d as any).expiredUrl ?? null,
    pixels: (d as any).pixels ?? null,
    pixelBridge: !!(d as any).pixelBridge,
    autoFailover: !!(d as any).autoFailover,
    timeRoutes: (d as any).timeRoutes ?? [],
    ctaOverlay: (d as any).ctaOverlay ?? null,
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
        const startsAt = meta.startsAt || null;
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
          startsAt,
          fallbackUrl: null,
          isPending: isLinkPending({ startsAt }, now),
          geoRoutes: {},
          deviceRoutes: {},
          splits: [],
          healthStatus: null,
          deepLink: !!meta.deepLink,
          campaign: meta.campaign ?? null,
          expiredAction: meta.expiredAction ?? null,
          expiredUrl: meta.expiredUrl ?? null,
          pixels: null,
          pixelBridge: !!meta.pixelBridge,
          autoFailover: !!meta.autoFailover,
          timeRoutes: [],
          ctaOverlay: null,
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

// ─── Outgoing Webhook Event Stream ────────────────────────────────────────────

async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

async function getWebhookConfig(env: Env): Promise<WebhookConfig | null> {
  try {
    const raw = await env.URL_KV.get(WEBHOOK_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WebhookConfig;
  } catch {
    return null;
  }
}

function sanitizeWebhookConfig(config: WebhookConfig | null): PublicWebhookConfig | null {
  if (!config) return null;
  return {
    url: config.url,
    hasSecret: Boolean(config.secret && config.secret.trim()),
    events: config.events,
    enabled: config.enabled,
    updatedAt: config.updatedAt,
  };
}

function sanitizeDiscordText(input: string): string {
  return input.replace(/@(everyone|here)/gi, "@\u200b$1");
}

async function sendWebhookPost(
  url: string,
  secret: string | null | undefined,
  payload: WebhookDispatchPayload
): Promise<{ ok: boolean; status: number; statusText: string; error?: string }> {
  let parsedWebhookUrl: URL;
  try {
    parsedWebhookUrl = new URL(url);
  } catch {
    return { ok: false, status: 400, statusText: "Invalid URL", error: "Invalid webhook URL" };
  }

  const webhookHost = parsedWebhookUrl.hostname.toLowerCase();
  const isDiscord =
    (webhookHost === "discord.com" || webhookHost === "discordapp.com") &&
    parsedWebhookUrl.pathname.startsWith("/api/webhooks/");
  const isSlack =
    webhookHost === "hooks.slack.com" &&
    parsedWebhookUrl.pathname.startsWith("/services/");

  let bodyString: string;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "TinyLink-Webhooks/1.0",
  };

  if (isDiscord) {
    const eventTitle =
      payload.event === "link.clicked"
        ? "Link Clicked"
        : payload.event === "link.limit_reached"
        ? "Click Limit Reached"
        : payload.event === "link.expired"
        ? "Link Expired"
        : payload.event === "link.down"
        ? "Link Destination DOWN (Failover Triggered)"
        : payload.event === "link.recovered"
        ? "Link Destination RECOVERED"
        : "Webhook Ping Test";

    const color =
      payload.event === "link.down"
        ? 0xef4444
        : payload.event === "link.recovered"
        ? 0x22c55e
        : payload.event === "link.limit_reached"
        ? 0xf59e0b
        : payload.event === "link.expired"
        ? 0xef4444
        : 0x22c55e;

    const safeSlug = sanitizeDiscordText(payload.link.slug);
    const safeLabel = payload.link.label ? sanitizeDiscordText(payload.link.label) : null;
    const safeTarget = sanitizeDiscordText(payload.link.targetUrl || payload.link.originalUrl);
    const safeRef = sanitizeDiscordText(payload.visitor.referrer || "direct");

    const discordBody = {
      allowed_mentions: { parse: [] as string[] },
      embeds: [
        {
          title: `TinyLink: ${eventTitle}`,
          color,
          description: safeLabel
            ? `**${safeLabel}** (\`/${safeSlug}\`)`
            : `Slug: \`/${safeSlug}\``,
          fields: [
            { name: "Target URL", value: safeTarget, inline: false },
            {
              name: "Visitor",
              value: `${payload.visitor.country} · ${payload.visitor.device}`,
              inline: true,
            },
            {
              name: "Clicks",
              value: payload.link.maxClicks
                ? `${payload.link.clicks} / ${payload.link.maxClicks}`
                : `${payload.link.clicks}`,
              inline: true,
            },
            {
              name: "Referrer",
              value: safeRef,
              inline: true,
            },
          ],
          timestamp: payload.timestamp,
          footer: { text: "TinyLink Smart Traffic & Automation" },
        },
      ],
    };
    bodyString = JSON.stringify(discordBody);
  } else if (isSlack) {
    const eventTitle =
      payload.event === "link.clicked"
        ? "Link Clicked"
        : payload.event === "link.limit_reached"
        ? "Click Limit Reached"
        : payload.event === "link.expired"
        ? "Link Expired"
        : payload.event === "link.down"
        ? "Link Destination DOWN (Failover Triggered)"
        : payload.event === "link.recovered"
        ? "Link Destination RECOVERED"
        : "Webhook Ping Test";

    const slackBody = {
      text: `TinyLink Event: ${eventTitle} (/${payload.link.slug})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `TinyLink: ${eventTitle}`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Slug:*\n\`/${payload.link.slug}\`` },
            {
              type: "mrkdwn",
              text: `*Clicks:*\n${payload.link.clicks}${
                payload.link.maxClicks ? ` / ${payload.link.maxClicks}` : ""
              }`,
            },
            { type: "mrkdwn", text: `*Visitor Country:*\n${payload.visitor.country}` },
            { type: "mrkdwn", text: `*Device / OS:*\n${payload.visitor.device}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Target URL:*\n${payload.link.targetUrl || payload.link.originalUrl}`,
          },
        },
      ],
    };
    bodyString = JSON.stringify(slackBody);
  } else {
    bodyString = JSON.stringify(payload);
    headers["X-TinyLink-Event"] = payload.event;
    if (secret && secret.trim()) {
      const sig = await computeHmacSha256(secret.trim(), bodyString);
      headers["X-TinyLink-Signature"] = `sha256=${sig}`;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: bodyString,
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.status >= 300 && res.status < 400) {
      return {
        ok: false,
        status: res.status,
        statusText: "Redirect Blocked",
        error: "Webhook endpoint attempted an HTTP redirect, which is blocked for security.",
      };
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, statusText: "Fetch Error", error: errMsg };
  }
}

function dispatchWebhookEvent(
  env: Env,
  ctx: ExecutionContext,
  event: "link.clicked" | "link.limit_reached" | "link.expired" | "link.down" | "link.recovered",
  slug: string,
  data: URLData,
  req: Request,
  targetUrl: string
) {
  ctx.waitUntil(
    (async () => {
      try {
        const config = await getWebhookConfig(env);
        if (!config || !config.enabled || !config.url) return;

        const checkedUrl = validateExternalUrl(config.url, req.url, {
          requireHttps: true,
          maxLength: MAX_WEBHOOK_URL_LENGTH,
        });
        if (checkedUrl.error || !checkedUrl.url) return;

        if (event === "link.clicked" && config.events?.onClicked === false) return;
        if (event === "link.limit_reached" && !config.events?.onLimitReached) return;
        if (event === "link.expired" && !config.events?.onExpired) return;
        if (event === "link.down" && config.events?.onDown === false) return;
        if (event === "link.recovered" && config.events?.onRecovered === false) return;

        const ip = getClientIp(req);
        const ipHash = (await computeIpHash(ip, env)).slice(0, 12);
        const ua = req.headers.get("User-Agent") || "unknown";
        const country = getVisitorCountry(req);
        const device = `${detectDevice(ua)} (${detectOsCategory(ua)})`;
        const referrer = parseReferrer(req.headers.get("Referer"));

        const payload: WebhookDispatchPayload = {
          event,
          timestamp: new Date().toISOString(),
          link: {
            slug,
            originalUrl: data.originalUrl,
            targetUrl,
            clicks: data.clicks || 0,
            maxClicks: data.maxClicks ?? null,
            label: data.label ?? null,
            tags: data.tags ?? [],
          },
          visitor: {
            country,
            device,
            referrer,
            ipHash,
            userAgent: ua.slice(0, 200),
          },
        };

        await sendWebhookPost(checkedUrl.url, config.secret, payload);
      } catch {}
    })()
  );
}

// ─── API Handlers ─────────────────────────────────────────────────────────────

async function handleShorten(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx, "write:links");
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
    startsAt?: string | null;
    fallbackUrl?: string | null;
    geoRoutes?: Record<string, string>;
    deviceRoutes?: { ios?: string | null; android?: string | null; desktop?: string | null };
    splits?: unknown;
    deepLink?: boolean;
    campaign?: string | null;
    expiredAction?: ("message" | "redirect") | null;
    expiredUrl?: string | null;
    pixels?: unknown;
    pixelBridge?: boolean;
    autoFailover?: boolean;
    timeRoutes?: unknown;
    ctaOverlay?: unknown;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  const validUrl = validateDestinationUrl(body.url, req.url);
  if (validUrl.error || !validUrl.url) {
    return err(validUrl.error || "Invalid URL");
  }
  const url = validUrl.url;

  const custom = body.custom?.trim();
  const maxClicksParsed = parseMaxClicks(body.maxClicks);
  if (maxClicksParsed.error) return err(maxClicksParsed.error);

  const startsAtParsed = parseScheduleInput(body.startsAt);
  if (startsAtParsed.error) return err(startsAtParsed.error);

  const fallbackUrlParsed = parseFallbackUrl(body.fallbackUrl, req.url);
  if (fallbackUrlParsed.error) return err(fallbackUrlParsed.error);

  const geoRoutesParsed = normalizeGeoRoutes(body.geoRoutes, req.url);
  if (geoRoutesParsed.error) return err(geoRoutesParsed.error);

  const deviceRoutesParsed = normalizeDeviceRoutes(body.deviceRoutes, req.url);
  if (deviceRoutesParsed.error) return err(deviceRoutesParsed.error);

  const splitsParsed = normalizeSplitRoutes(body.splits, req.url);
  if (splitsParsed.error) return err(splitsParsed.error);

  const label = normalizeLabel(body.label);
  const tags = normalizeTags(body.tags);
  const ogTitle = normalizeOgText(body.ogTitle, 100);
  const ogDescription = normalizeOgText(body.ogDescription, 220);
  const publicStats = body.publicStats === true;
  const deepLink = body.deepLink === true;
  const campaign = normalizeCampaign(body.campaign);
  const expiredParsed = normalizeExpiredAction(body.expiredAction, body.expiredUrl, req.url);
  if (expiredParsed.error) return err(expiredParsed.error);

  const pixels = normalizePixelConfig(body.pixels);
  const pixelBridge = body.pixelBridge === true;
  const autoFailover = body.autoFailover === true;
  const timeRoutesParsed = normalizeTimeRoutes(body.timeRoutes, req.url);
  if (timeRoutesParsed.error) return err(timeRoutesParsed.error);
  const ctaOverlayParsed = normalizeCtaOverlay(body.ctaOverlay, req.url);
  if (ctaOverlayParsed.error) return err(ctaOverlayParsed.error);

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
      const origin = getRequestOrigin(req);
      const shortUrl = `${origin}/${match.slug}`;
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
        startsAt: match.startsAt,
        fallbackUrl: match.fallbackUrl,
        isPending: match.isPending,
        geoRoutes: match.geoRoutes,
        deviceRoutes: match.deviceRoutes,
        splits: match.splits ?? [],
        healthStatus: match.healthStatus ?? null,
        deepLink: !!match.deepLink,
        campaign: match.campaign ?? null,
        expiredAction: match.expiredAction ?? null,
        expiredUrl: match.expiredUrl ?? null,
        pixels: match.pixels ?? null,
        pixelBridge: !!match.pixelBridge,
        autoFailover: !!match.autoFailover,
        timeRoutes: match.timeRoutes ?? [],
        ctaOverlay: match.ctaOverlay ?? null,
        deduplicated: true,
        qrSvg,
      });
    }
  }

  const expiresIn = parseExpiryInput(body.expiresIn);
  const expiresAt = computeExpiration(expiresIn);
  if (startsAtParsed.value && expiresAt && new Date(startsAtParsed.value) >= new Date(expiresAt)) {
    return err("Activation start time must be before link expiration time");
  }

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
    startsAt: startsAtParsed.value,
    fallbackUrl: fallbackUrlParsed.url,
    geoRoutes: geoRoutesParsed.routes,
    deviceRoutes: deviceRoutesParsed.routes,
    splits: splitsParsed.splits,
    deepLink,
    campaign,
    expiredAction: expiredParsed.expiredAction,
    expiredUrl: expiredParsed.expiredUrl,
    pixels,
    pixelBridge,
    autoFailover,
    timeRoutes: timeRoutesParsed.routes,
    ctaOverlay: ctaOverlayParsed.config,
  };

  await saveUrlRecord(env, slug!, data);

  const origin = getRequestOrigin(req);
  const shortUrl = `${origin}/${slug!}`;
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
    startsAt: data.startsAt ?? null,
    fallbackUrl: data.fallbackUrl ?? null,
    isPending: isLinkPending(data),
    geoRoutes: data.geoRoutes ?? {},
    deviceRoutes: data.deviceRoutes ?? {},
    splits: data.splits ?? [],
    healthStatus: null,
    deepLink: !!data.deepLink,
    campaign: data.campaign ?? null,
    expiredAction: data.expiredAction ?? null,
    expiredUrl: data.expiredUrl ?? null,
    pixels: data.pixels ?? null,
    pixelBridge: !!data.pixelBridge,
    autoFailover: !!data.autoFailover,
    timeRoutes: data.timeRoutes ?? [],
    ctaOverlay: data.ctaOverlay ?? null,
    qrSvg,
  });
}

async function handleList(env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx, "read:links");
  if (!auth.ok) return auth.response!;

  const urls = await listAllEntries(env);
  return json({ urls });
}

async function handleAnalytics(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx, "read:analytics");
  if (!auth.ok) return auth.response!;
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  const data: URLData = JSON.parse(raw);
  const origin = getRequestOrigin(req);
  const shortUrl = `${origin}/${slug}`;
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
    startsAt: data.startsAt ?? null,
    fallbackUrl: data.fallbackUrl ?? null,
    isPending: isLinkPending(data),
    geoRoutes: data.geoRoutes ?? {},
    deviceRoutes: data.deviceRoutes ?? {},
    splits: data.splits ?? [],
    splitClicks: data.splitClicks ?? {},
    healthStatus: data.healthStatus ?? null,
    deepLink: !!data.deepLink,
    campaign: data.campaign ?? null,
    expiredAction: data.expiredAction ?? null,
    expiredUrl: data.expiredUrl ?? null,
    goals: data.goals || {},
    qrSvg,
  });
}

async function handleUpdate(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx, "write:links");
  if (!auth.ok) return auth.response!;
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  let body: {
    url?: string;
    expiresIn?: string;
    expiresAt?: string | null;
    label?: string | null;
    tags?: string[] | string;
    maxClicks?: number | string | null;
    password?: string | null;
    clearPassword?: boolean;
    ogTitle?: string | null;
    ogDescription?: string | null;
    publicStats?: boolean;
    startsAt?: string | null;
    fallbackUrl?: string | null;
    geoRoutes?: Record<string, string> | null;
    deviceRoutes?: { ios?: string | null; android?: string | null; desktop?: string | null } | null;
    splits?: unknown;
    deepLink?: boolean;
    campaign?: string | null;
    expiredAction?: ("message" | "redirect") | null;
    expiredUrl?: string | null;
    pixels?: unknown;
    pixelBridge?: boolean;
    autoFailover?: boolean;
    timeRoutes?: unknown;
    ctaOverlay?: unknown;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  const hasUrl = body.url !== undefined;
  const hasExpiry = (body.expiresIn !== undefined && body.expiresIn !== "keep") || body.expiresAt !== undefined;
  const hasLabel = body.label !== undefined;
  const hasTags = body.tags !== undefined;
  const hasMaxClicks = body.maxClicks !== undefined;
  const hasPasswordChange = body.password !== undefined || body.clearPassword === true;
  const hasOgTitle = body.ogTitle !== undefined;
  const hasOgDesc = body.ogDescription !== undefined;
  const hasPublicStats = body.publicStats !== undefined;
  const hasStartsAt = body.startsAt !== undefined;
  const hasFallbackUrl = body.fallbackUrl !== undefined;
  const hasGeoRoutes = body.geoRoutes !== undefined;
  const hasDeviceRoutes = body.deviceRoutes !== undefined;
  const hasSplits = body.splits !== undefined;
  const hasDeepLink = body.deepLink !== undefined;
  const hasCampaign = body.campaign !== undefined;
  const hasExpiredAction = body.expiredAction !== undefined || body.expiredUrl !== undefined;
  const hasPixels = body.pixels !== undefined;
  const hasPixelBridge = body.pixelBridge !== undefined;
  const hasAutoFailover = body.autoFailover !== undefined;
  const hasTimeRoutes = body.timeRoutes !== undefined;
  const hasCtaOverlay = body.ctaOverlay !== undefined;

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
    !hasPublicStats &&
    !hasStartsAt &&
    !hasFallbackUrl &&
    !hasGeoRoutes &&
    !hasDeviceRoutes &&
    !hasSplits &&
    !hasDeepLink &&
    !hasCampaign &&
    !hasExpiredAction &&
    !hasPixels &&
    !hasPixelBridge &&
    !hasAutoFailover &&
    !hasTimeRoutes &&
    !hasCtaOverlay
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
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null || body.expiresAt === "") {
        data.expiresAt = null;
      } else {
        const d = new Date(body.expiresAt);
        if (isNaN(d.getTime())) {
          return err("Invalid 'expiresAt' timestamp");
        }
        data.expiresAt = d.toISOString();
      }
    } else {
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

  if (hasStartsAt) {
    if (body.startsAt === null || body.startsAt === "") {
      data.startsAt = null;
    } else {
      const parsed = parseScheduleInput(body.startsAt);
      if (parsed.error) return err(parsed.error);
      data.startsAt = parsed.value;
    }
  }

  if (hasFallbackUrl) {
    if (body.fallbackUrl === null || body.fallbackUrl === "") {
      data.fallbackUrl = null;
    } else {
      const parsed = parseFallbackUrl(body.fallbackUrl, req.url);
      if (parsed.error) return err(parsed.error);
      data.fallbackUrl = parsed.url;
    }
  }

  if (hasGeoRoutes) {
    if (body.geoRoutes === null) {
      data.geoRoutes = {};
    } else {
      const parsed = normalizeGeoRoutes(body.geoRoutes, req.url);
      if (parsed.error) return err(parsed.error);
      data.geoRoutes = parsed.routes;
    }
  }

  if (hasDeviceRoutes) {
    if (body.deviceRoutes === null) {
      data.deviceRoutes = {};
    } else {
      const parsed = normalizeDeviceRoutes(body.deviceRoutes, req.url);
      if (parsed.error) return err(parsed.error);
      data.deviceRoutes = parsed.routes;
    }
  }

  if (hasSplits) {
    if (body.splits === null || (Array.isArray(body.splits) && body.splits.length === 0)) {
      data.splits = [];
    } else {
      const parsed = normalizeSplitRoutes(body.splits, req.url);
      if (parsed.error) return err(parsed.error);
      data.splits = parsed.splits;
    }
  }

  if (hasDeepLink) {
    data.deepLink = body.deepLink === true;
  }

  if (hasCampaign) {
    data.campaign = normalizeCampaign(body.campaign);
  }

  if (hasExpiredAction) {
    const nextAction = body.expiredAction !== undefined ? body.expiredAction : data.expiredAction;
    const nextUrl = body.expiredUrl !== undefined ? body.expiredUrl : data.expiredUrl;
    const expParsed = normalizeExpiredAction(nextAction, nextUrl, req.url);
    if (expParsed.error) return err(expParsed.error);
    data.expiredAction = expParsed.expiredAction;
    data.expiredUrl = expParsed.expiredUrl;
  }

  if (hasPixels) {
    data.pixels = normalizePixelConfig(body.pixels);
  }

  if (hasPixelBridge) {
    data.pixelBridge = body.pixelBridge === true;
  }

  if (hasAutoFailover) {
    data.autoFailover = body.autoFailover === true;
  }

  if (hasTimeRoutes) {
    if (body.timeRoutes === null || (Array.isArray(body.timeRoutes) && body.timeRoutes.length === 0)) {
      data.timeRoutes = [];
    } else {
      const parsed = normalizeTimeRoutes(body.timeRoutes, req.url);
      if (parsed.error) return err(parsed.error);
      data.timeRoutes = parsed.routes;
    }
  }

  if (hasCtaOverlay) {
    if (body.ctaOverlay === null) {
      data.ctaOverlay = null;
    } else {
      const parsed = normalizeCtaOverlay(body.ctaOverlay, req.url);
      if (parsed.error) return err(parsed.error);
      data.ctaOverlay = parsed.config ?? null;
    }
  }

  if (data.startsAt && data.expiresAt && new Date(data.startsAt) >= new Date(data.expiresAt)) {
    return err("Activation start time must be before link expiration time");
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
    startsAt: data.startsAt ?? null,
    fallbackUrl: data.fallbackUrl ?? null,
    isPending: isLinkPending(data),
    geoRoutes: data.geoRoutes ?? {},
    deviceRoutes: data.deviceRoutes ?? {},
    splits: data.splits ?? [],
    healthStatus: data.healthStatus ?? null,
    deepLink: !!data.deepLink,
    campaign: data.campaign ?? null,
    expiredAction: data.expiredAction ?? null,
    expiredUrl: data.expiredUrl ?? null,
    pixels: data.pixels ?? null,
    pixelBridge: !!data.pixelBridge,
    autoFailover: !!data.autoFailover,
    timeRoutes: data.timeRoutes ?? [],
    ctaOverlay: data.ctaOverlay ?? null,
    message: "Link updated successfully",
  });
}

async function handleDelete(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx, "delete:links");
  if (!auth.ok) return auth.response!;
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  await env.URL_KV.delete(key(slug));
  return json({ deleted: slug });
}

export async function checkDestinationHealth(targetUrl: string): Promise<LinkHealthStatus> {
  const start = Date.now();
  let status = 0;
  let statusText = "Network Error";
  let ok = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "TinyLink-Sentinel/4.0" },
      });
      if (res.status === 405) {
        res = await fetch(targetUrl, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "TinyLink-Sentinel/4.0" },
        });
      }
    } catch (e: unknown) {
      const errObj = e as { name?: string; message?: string };
      if (errObj?.name === "AbortError") {
        statusText = "Timeout (4s)";
        throw e;
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
    status = res.status;
    statusText = res.statusText || (status >= 200 && status < 300 ? "OK" : status >= 300 && status < 400 ? "Redirect" : `HTTP ${status}`);
    ok = status >= 200 && status < 400;
  } catch (errCatch: unknown) {
    if (statusText !== "Timeout (4s)") {
      const msg = errCatch instanceof Error ? errCatch.message : String(errCatch);
      statusText = msg ? msg.slice(0, 50) : "Connection Failed";
    }
  }

  const latencyMs = Math.max(1, Date.now() - start);
  return {
    ok,
    status,
    statusText,
    latencyMs,
    checkedAt: new Date().toISOString(),
  };
}

export async function runSentinelScan(
  env: Env,
  ctx?: ExecutionContext
): Promise<{
  scanned: number;
  healthy: number;
  broken: number;
  recovered: number;
  failovers: number;
  results: Array<{ slug: string; status: number; ok: boolean; latencyMs: number }>;
}> {
  const list = await listAllEntries(env);
  const activeLinks = list.filter((l) => !l.isExpired && !l.isExhausted).slice(0, 50);

  let healthy = 0;
  let broken = 0;
  let recovered = 0;
  let failovers = 0;
  const results: Array<{ slug: string; status: number; ok: boolean; latencyMs: number }> = [];

  for (const item of activeLinks) {
    try {
      const raw = await env.URL_KV.get(key(item.slug));
      if (!raw) continue;
      const data: URLData = JSON.parse(raw);

      const oldHealthOk = data.healthStatus ? data.healthStatus.ok : true;
      const newHealth = await checkDestinationHealth(data.originalUrl);
      data.healthStatus = newHealth;

      if (newHealth.ok) {
        healthy++;
        if (!oldHealthOk) {
          recovered++;
          if (ctx) {
            dispatchWebhookEvent(
              env,
              ctx,
              "link.recovered",
              item.slug,
              data,
              new Request(`https://tinylink.internal/${item.slug}`),
              data.originalUrl
            );
          }
        }
      } else {
        broken++;
        if (data.autoFailover && data.fallbackUrl) {
          failovers++;
        }
        if (oldHealthOk && ctx) {
          dispatchWebhookEvent(
            env,
            ctx,
            "link.down",
            item.slug,
            data,
            new Request(`https://tinylink.internal/${item.slug}`),
            data.originalUrl
          );
        }
      }

      await saveUrlRecord(env, item.slug, data);
      results.push({
        slug: item.slug,
        status: newHealth.status,
        ok: newHealth.ok,
        latencyMs: newHealth.latencyMs,
      });
    } catch {}
  }

  return {
    scanned: results.length,
    healthy,
    broken,
    recovered,
    failovers,
    results,
  };
}

async function handleCheckHealth(slug: string, env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  const data: URLData = JSON.parse(raw);
  const targetUrl = data.originalUrl;
  const valid = validateDestinationUrl(targetUrl, req.url);
  if (valid.error || !valid.url) {
    return err("Target URL failed security verification", 400);
  }

  const healthStatus = await checkDestinationHealth(targetUrl);
  data.healthStatus = healthStatus;
  await saveUrlRecord(env, slug, data);

  return json({
    slug,
    health: healthStatus,
  });
}

async function handleSentinelScan(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const summary = await runSentinelScan(env, ctx);
  return json(summary);
}

async function handleGenerateQr(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  try {
    const body = (await req.json()) as BrandedQrOptions & { url?: string; slug?: string };
    let targetUrl = body.url;
    if (!targetUrl && body.slug) {
      const raw = await env.URL_KV.get(key(body.slug));
      if (raw) {
        targetUrl = (JSON.parse(raw) as URLData).originalUrl;
      }
    }
    if (!targetUrl) {
      return err("Missing url or valid slug", 400);
    }
    const svg = generateBrandedQrSvg(targetUrl, body);
    return json({
      svg,
      url: targetUrl,
      slug: body.slug || null,
    });
  } catch (e: any) {
    return err(e.message || "Failed to generate QR code", 500);
  }
}

async function handleGetQr(slug: string, req: Request, env: Env): Promise<Response> {
  const raw = await env.URL_KV.get(key(slug));
  if (!raw) {
    return err("Short link not found", 404);
  }
  const data = JSON.parse(raw) as URLData;
  const reqUrl = new URL(req.url);
  const targetUrl = `${reqUrl.origin}/${slug}`;
  const searchParams = reqUrl.searchParams;

  const qrOpts: BrandedQrOptions = {
    errorCorrectionLevel: (searchParams.get("ec") as any) || "M",
    colorDark: searchParams.get("dark") || "#0F172A",
    colorLight: searchParams.get("light") || "#FFFFFF",
    gradientStart: searchParams.get("gradStart") || undefined,
    gradientEnd: searchParams.get("gradEnd") || undefined,
    useGradient: searchParams.has("gradStart") && searchParams.has("gradEnd"),
    cornerStyle: (searchParams.get("corner") as any) || "square",
    logo: (searchParams.get("logo") as any) || "none",
    customLogoUrl: searchParams.get("customLogo") || undefined,
    width: parseInt(searchParams.get("width") || "512", 10) || 512,
  };

  const svg = generateBrandedQrSvg(targetUrl, qrOpts);
  if (searchParams.get("format") === "svg" || searchParams.get("download") === "1") {
    const headers: Record<string, string> = {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    };
    if (searchParams.get("download") === "1") {
      headers["Content-Disposition"] = `attachment; filename="qr-${slug}.svg"`;
    }
    return new Response(svg, { status: 200, headers });
  }

  return json({
    svg,
    slug,
    shortUrl: targetUrl,
    originalUrl: data.originalUrl,
  });
}

export async function generateAiSuggestions(
  urlStr: string,
  title?: string,
  _env?: Env
): Promise<AiSuggestResponse> {
  const url = new URL(urlStr);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const domainBase = host.split(".")[0];
  const pathParts = url.pathname
    .split("/")
    .filter(Boolean)
    .map((p) => p.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
    .filter((p) => p.length >= 2 && p.length <= 25);

  const words: string[] = [];
  if (title) {
    const titleWords = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "this", "that", "from"].includes(w));
    words.push(...titleWords.slice(0, 5));
  }

  const candidates: string[] = [];
  if (pathParts.length > 0) {
    const lastPart = pathParts[pathParts.length - 1];
    candidates.push(lastPart);
    if (pathParts.length >= 2) {
      candidates.push(`${pathParts[0]}-${lastPart}`.slice(0, 30));
    }
    candidates.push(`${domainBase}-${lastPart}`.slice(0, 30));
  }
  if (words.length > 0) {
    candidates.push(words.slice(0, 2).join("-"));
    candidates.push(`${words[0]}-${domainBase}`.slice(0, 30));
  }
  candidates.push(`${domainBase}-link`);
  candidates.push(`${domainBase}-go`);

  const cleanSlugs: string[] = [];
  for (const c of candidates) {
    const clean = c.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (clean.length >= 3 && clean.length <= 32 && !RESERVED_SLUGS.has(clean) && !cleanSlugs.includes(clean)) {
      cleanSlugs.push(clean);
    }
  }

  const tagsSet = new Set<string>();
  if (domainBase && domainBase.length >= 3) tagsSet.add(domainBase);
  for (const p of pathParts.slice(0, 3)) {
    if (p.length >= 3) tagsSet.add(p);
  }
  for (const w of words.slice(0, 3)) {
    if (w.length >= 3) tagsSet.add(w);
  }

  return {
    slugs: cleanSlugs.slice(0, 5),
    tags: Array.from(tagsSet).slice(0, 6),
    title: title || `${domainBase.toUpperCase()} Resource`,
  };
}

async function handleAiSuggest(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const bodyParsed = await readBoundedJson<{ url?: string; title?: string }>(req);
  if (bodyParsed.error || !bodyParsed.data || !bodyParsed.data.url) {
    return err("Missing 'url' parameter", 400);
  }

  const valid = validateDestinationUrl(bodyParsed.data.url, req.url);
  if (valid.error || !valid.url) {
    return err(valid.error || "Invalid destination URL", 400);
  }

  const result = await generateAiSuggestions(valid.url, bodyParsed.data.title, env);

  const availableSlugs: string[] = [];
  for (const slug of result.slugs) {
    const existing = await env.URL_KV.get(key(slug));
    if (!existing) {
      availableSlugs.push(slug);
    } else {
      const alt = `${slug}-${Math.floor(10 + Math.random() * 89)}`;
      availableSlugs.push(alt);
    }
  }

  return json({
    ok: true,
    slugs: availableSlugs,
    tags: result.tags,
    title: result.title,
  });
}

async function handleAiMetadata(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const bodyParsed = await readBoundedJson<{ url?: string }>(req);
  if (bodyParsed.error || !bodyParsed.data || !bodyParsed.data.url) {
    return err("Missing 'url' parameter", 400);
  }

  const valid = validateDestinationUrl(bodyParsed.data.url, req.url);
  if (valid.error || !valid.url) {
    return err(valid.error || "Invalid destination URL", 400);
  }

  let ogTitle = "";
  let ogDescription = "";
  let siteName = "";
  const tags: string[] = [];

  const parsedUrl = new URL(valid.url);
  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  siteName = host.split(".")[0];
  tags.push(siteName);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const resp = await fetch(valid.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TinyLink-Bot/1.0 (+https://tinylink.dev/bot)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const text = await resp.text();
      const snippet = text.slice(0, 65536);

      const titleMatch =
        snippet.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
        snippet.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
        snippet.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        ogTitle = escapeHtml(titleMatch[1].trim()).slice(0, 100);
      }

      const descMatch =
        snippet.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
        snippet.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
        snippet.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
        snippet.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
      if (descMatch && descMatch[1]) {
        ogDescription = escapeHtml(descMatch[1].trim()).slice(0, 200);
      }

      const kwMatch = snippet.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
      if (kwMatch && kwMatch[1]) {
        const extracted = kwMatch[1]
          .split(",")
          .map((k) => k.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""))
          .filter((k) => k.length >= 2)
          .slice(0, 5);
        tags.push(...extracted);
      }
    }
  } catch {}

  if (!ogTitle) {
    const pathSlug = parsedUrl.pathname.split("/").filter(Boolean).pop() || siteName;
    ogTitle = pathSlug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .slice(0, 90);
  }
  if (!ogDescription) {
    ogDescription = `Direct short link to ${siteName.toUpperCase()} destination via TinyLink.`;
  }

  const cleanTags = Array.from(new Set(tags)).filter(Boolean).slice(0, 6);

  return json({
    ok: true,
    ogTitle,
    ogDescription,
    tags: cleanTags,
    siteName,
  });
}

const RECENT_CLICKS_KEY = "recent:clicks";
const MAX_RECENT_CLICKS = 50;

export async function recordClickStream(
  env: Env,
  entry: ClickStreamEntry,
  ctx?: ExecutionContext
): Promise<void> {
  const task = (async () => {
    try {
      const raw = await env.URL_KV.get(RECENT_CLICKS_KEY);
      const list: ClickStreamEntry[] = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      if (list.length > MAX_RECENT_CLICKS) list.length = MAX_RECENT_CLICKS;
      await env.URL_KV.put(RECENT_CLICKS_KEY, JSON.stringify(list));
    } catch {}
  })();
  if (ctx) ctx.waitUntil(task);
  else await task;
}

async function handleStreamClicks(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx, "read:analytics");
  if (!auth.ok) return auth.response!;

  const url = new URL(req.url);
  const filterSlug = url.searchParams.get("slug")?.trim().toLowerCase();

  const raw = await env.URL_KV.get(RECENT_CLICKS_KEY);
  let list: ClickStreamEntry[] = raw ? JSON.parse(raw) : [];
  if (filterSlug) {
    list = list.filter((item) => item.slug.toLowerCase() === filterSlug);
  }

  return json({
    ok: true,
    count: list.length,
    clicks: list,
  });
}

async function handleTrackGoal(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let body: { slug?: string; goal?: string };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", 400);
  }
  body = bodyParsed.data;

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const goal = typeof body.goal === "string" ? body.goal.trim().toLowerCase().slice(0, 32) : "";

  if (!slug || !SLUG_RE.test(slug)) {
    return err("Invalid or missing 'slug'", 400);
  }
  if (!goal || !/^[a-z0-9_-]{2,32}$/.test(goal)) {
    return err("Invalid 'goal' name: must be 2-32 lowercase alphanumeric, '-', or '_'", 400);
  }

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) {
    return err("Short link not found", 404);
  }

  const data = JSON.parse(raw) as URLData;
  if (!data.goals) {
    data.goals = {};
  }
  data.goals[goal] = (data.goals[goal] || 0) + 1;

  await saveUrlRecord(env, slug, data);

  const totalClicks = data.clicks || 0;
  const count = data.goals[goal];
  const conversionRate = totalClicks > 0 ? Number(((count / totalClicks) * 100).toFixed(2)) : 0;

  return json({
    ok: true,
    slug,
    goal,
    count,
    totalClicks,
    conversionRate: `${conversionRate}%`,
  });
}

async function handleExportAnalytics(
  slug: string,
  env: Env,
  req: Request,
  ctx: ExecutionContext
): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx, "read:analytics");
  if (!auth.ok) return auth.response!;

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("Short link not found", 404);

  const data = JSON.parse(raw) as URLData;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  const totalClicks = data.clicks || 0;
  const topCountry = Object.entries(data.countries || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
  const topDevice = Object.entries(data.devices || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
  const topReferrer = Object.entries(data.referrers || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "Direct";
  const goalsTotal = Object.values(data.goals || {}).reduce((sum, c) => sum + c, 0);

  if (format === "json") {
    return new Response(
      JSON.stringify(
        {
          slug,
          originalUrl: data.originalUrl,
          createdAt: data.createdAt,
          totalClicks,
          topCountry,
          topDevice,
          topReferrer,
          goals: data.goals || {},
          countries: data.countries || {},
          devices: data.devices || {},
          referrers: data.referrers || {},
          dailyClicks: data.dailyClicks || {},
          hourlyClicks: data.hourlyClicks || {},
        },
        null,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="tinylink-analytics-${slug}.json"`,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const rows: string[] = [
    "Metric,Value",
    `Slug,"${slug}"`,
    `Destination,"${data.originalUrl.replace(/"/g, '""')}"`,
    `Created At,"${data.createdAt}"`,
    `Total Clicks,${totalClicks}`,
    `Top Country,"${topCountry}"`,
    `Top Device,"${topDevice}"`,
    `Top Referrer,"${topReferrer}"`,
    `Total Goal Conversions,${goalsTotal}`,
    "",
    "Goal Name,Conversions,Conversion Rate",
  ];

  if (data.goals && Object.keys(data.goals).length > 0) {
    for (const [g, count] of Object.entries(data.goals)) {
      const rate = totalClicks > 0 ? ((count / totalClicks) * 100).toFixed(2) + "%" : "0%";
      rows.push(`"${g}",${count},${rate}`);
    }
  } else {
    rows.push("None,0,0%");
  }

  rows.push("");
  rows.push("Country,Clicks");
  for (const [c, count] of Object.entries(data.countries || {})) {
    rows.push(`"${c}",${count}`);
  }

  rows.push("");
  rows.push("Device,Clicks");
  for (const [d, count] of Object.entries(data.devices || {})) {
    rows.push(`"${d}",${count}`);
  }

  rows.push("");
  rows.push("Referrer,Clicks");
  for (const [r, count] of Object.entries(data.referrers || {})) {
    rows.push(`"${r}",${count}`);
  }

  const csvBody = rows.join("\r\n");
  return new Response(csvBody, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tinylink-analytics-${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

async function handleBulkDelete(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: { slugs?: unknown };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

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
        .filter((s) => SLUG_RE.test(s) && !RESERVED_SLUGS.has(s.toLowerCase()))
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
  const bodyParsed = await readBoundedJson<typeof body>(req, MAX_IMPORT_JSON_BYTES);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

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

    let startsAt: string | null = null;
    if (typeof item.startsAt === "string" && item.startsAt.trim()) {
      const parsed = parseScheduleInput(item.startsAt);
      if (!parsed.error && parsed.value) startsAt = parsed.value;
    }
    let fallbackUrl: string | null = null;
    if (item.fallbackUrl) {
      const parsed = parseFallbackUrl(item.fallbackUrl, req.url);
      if (!parsed.error && parsed.url) fallbackUrl = parsed.url;
    }
    const geoRoutes = normalizeGeoRoutes(item.geoRoutes, req.url).routes;
    const deviceRoutes = normalizeDeviceRoutes(item.deviceRoutes, req.url).routes;
    const splits = normalizeSplitRoutes(item.splits, req.url).splits;

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
      startsAt,
      fallbackUrl,
      geoRoutes,
      deviceRoutes,
      splits,
      healthStatus: item.healthStatus ?? null,
    };

    await saveUrlRecord(env, slug, record);
    importedLinks.push(toListEntry(slug, record, now));
    imported++;
  }

  return json({ imported, skipped, errors, importedLinks });
}

// ─── Redirect, Unlock, & Public Stats Handlers ────────────────────────────────

function trimTopRecord(rec: Record<string, number>, maxKeys: number): Record<string, number> {
  const entries = Object.entries(rec);
  if (entries.length <= maxKeys) return rec;
  let otherTotal = rec.other || 0;
  const nonOther = entries
    .filter(([k]) => k !== "other")
    .sort((a, b) => b[1] - a[1]);
  const keepLimit = Math.max(1, maxKeys - 1);
  const kept = nonOther.slice(0, keepLimit);
  for (let i = keepLimit; i < nonOther.length; i++) {
    otherTotal += nonOther[i][1];
  }
  const out: Record<string, number> = {};
  for (const [k, v] of kept) {
    out[k] = v;
  }
  if (otherTotal > 0) {
    out.other = otherTotal;
  }
  return out;
}

function applyHumanHit(data: URLData, req: Request, splitVariantUrl?: string) {
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
  data.referrers = trimTopRecord(data.referrers, MAX_UNIQUE_STAT_KEYS);

  if (!data.devices) data.devices = {};
  data.devices[device] = (data.devices[device] || 0) + 1;

  if (!data.countries) data.countries = {};
  data.countries[country] = (data.countries[country] || 0) + 1;
  data.countries = trimTopRecord(data.countries, MAX_UNIQUE_STAT_KEYS);

  const dailyKey = nowIso.slice(0, 10);
  if (!data.dailyClicks) data.dailyClicks = {};
  data.dailyClicks[dailyKey] = (data.dailyClicks[dailyKey] || 0) + 1;
  data.dailyClicks = trimBucketRecord(data.dailyClicks, 60);

  const hourlyKey = nowIso.slice(0, 13);
  if (!data.hourlyClicks) data.hourlyClicks = {};
  data.hourlyClicks[hourlyKey] = (data.hourlyClicks[hourlyKey] || 0) + 1;
  data.hourlyClicks = trimBucketRecord(data.hourlyClicks, 48);

  if (splitVariantUrl) {
    if (!data.splitClicks) data.splitClicks = {};
    data.splitClicks[splitVariantUrl] = (data.splitClicks[splitVariantUrl] || 0) + 1;
  }
}

async function readSubmittedPassword(req: Request): Promise<string> {
  const cl = req.headers.get("Content-Length");
  if (cl !== null) {
    const len = Number(cl);
    if (Number.isFinite(len) && len > MAX_FORM_BODY_BYTES) {
      return "";
    }
  }
  const contentType = (req.headers.get("Content-Type") || "").toLowerCase();
  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const val = formData.get("password");
      return typeof val === "string" ? val.slice(0, 128) : "";
    }
    const rawText = await req.text();
    if (new TextEncoder().encode(rawText).byteLength > MAX_FORM_BODY_BYTES) {
      return "";
    }
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(rawText) as { password?: unknown };
      return typeof parsed.password === "string" ? parsed.password.slice(0, 128) : "";
    }
    const params = new URLSearchParams(rawText);
    const val = params.get("password");
    return typeof val === "string" ? val.slice(0, 128) : "";
  } catch {
    return "";
  }
}

async function handleRedirect(
  slug: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  customDomain?: CustomDomainRecord | null
) {
  if (!SLUG_RE.test(slug)) {
    if (customDomain?.custom404Html) {
      return new Response(customDomain.custom404Html, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Custom-Domain": customDomain.domain },
      });
    }
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

  const raw = await env.URL_KV.get(key(slug));

  if (!raw) {
    if (customDomain?.custom404Html) {
      return new Response(customDomain.custom404Html, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Custom-Domain": customDomain.domain },
      });
    }
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

  if (isLinkPending(data)) {
    if (data.fallbackUrl) {
      return safeRedirect(data.fallbackUrl, 302);
    }
    return new Response(
      renderStatusPage({
        status: 425,
        codeLabel: "425 · Not Active Yet",
        title: "Link Not Active Yet",
        message: "This shortened link is scheduled to activate at a future time. Please check back later.",
        startsAt: data.startsAt,
      }),
      { status: 425, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  if (isLinkExpired(data)) {
    dispatchWebhookEvent(env, ctx, "link.expired", slug, data, req, data.originalUrl);
    if (data.expiredAction === "redirect" && data.expiredUrl) {
      return safeRedirect(data.expiredUrl, 302);
    }
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
    dispatchWebhookEvent(env, ctx, "link.limit_reached", slug, data, req, data.originalUrl);
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
  const origin = getRequestOrigin(req);
  const shortUrl = `${origin}/${slug}`;
  const country = getVisitorCountry(req);
  const os = detectOsCategory(ua);
  const { targetUrl, splitVariantUrl } = resolveDestinationUrl(data, country, os, req);

  // Handle POST unlock submission for password-protected links
  if (req.method === "POST") {
    if (!data.passwordHash) {
      return err("Method not allowed", 405);
    }

    const ip = getClientIp(req);
    const pwdRlKey = `rlpwd:${slug}:${(await computeIpHash(ip, env)).slice(0, 16)}`;
    const pwdRlRecord = await readRateLimit(env, pwdRlKey);
    const now = Date.now();
    if (pwdRlRecord && pwdRlRecord.count >= MAX_LINK_PASSWORD_ATTEMPTS && now < pwdRlRecord.resetAt) {
      const retryAfter = Math.max(1, Math.ceil((pwdRlRecord.resetAt - now) / 1000));
      return new Response(
        renderPasswordPage({
          slug,
          label: data.label,
          error: "Too many incorrect password attempts. Please wait a few minutes and try again.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": HTML_UNLOCK_CSP,
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    const submitted = await readSubmittedPassword(req);
    const valid = submitted ? await verifyPassword(submitted, data.passwordHash) : false;
    if (!valid) {
      await recordRateLimitFailure(env, pwdRlKey, pwdRlRecord, LINK_PASSWORD_WINDOW_SECONDS);
      return new Response(
        renderPasswordPage({
          slug,
          label: data.label,
          error: "Incorrect password. Please try again.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": HTML_UNLOCK_CSP,
          },
        }
      );
    }

    if (pwdRlRecord) {
      ctx.waitUntil(env.URL_KV.delete(pwdRlKey));
    }
    if (data.passwordHash.startsWith("v1:")) {
      data.passwordHash = await hashPassword(submitted);
    }

    applyHumanHit(data, req, splitVariantUrl);
    recordClickStream(
      env,
      {
        slug,
        timestamp: new Date().toISOString(),
        country: getVisitorCountry(req),
        device: detectDevice(req.headers.get("User-Agent") ?? ""),
        referrer: parseReferrer(req.headers.get("Referer")),
        destination: targetUrl,
      },
      ctx
    );
    const hitLimitNow = !!(data.maxClicks && data.clicks >= data.maxClicks);
    if (data.maxClicks) {
      await saveUrlRecord(env, slug, data);
    } else {
      ctx.waitUntil(saveUrlRecord(env, slug, data));
    }
    dispatchWebhookEvent(env, ctx, "link.clicked", slug, data, req, targetUrl);
    if (hitLimitNow) {
      dispatchWebhookEvent(env, ctx, "link.limit_reached", slug, data, req, targetUrl);
    }
    if (data.deepLink && isMobileUserAgent(ua)) {
      const deepTarget = detectAppDeepLink(targetUrl);
      if (deepTarget) {
        return new Response(
          renderDeepLinkBridgeHtml({
            slug,
            app: deepTarget.app,
            scheme: deepTarget.scheme,
            webUrl: targetUrl,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "Content-Security-Policy": HTML_UNLOCK_CSP,
            },
          }
        );
      }
    }
    if (data.ctaOverlay?.enabled) {
      return new Response(
        renderCtaOverlayHtml({
          slug,
          targetUrl,
          config: data.ctaOverlay,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": CTA_OVERLAY_CSP,
          },
        }
      );
    }
    if (data.pixelBridge && data.pixels && hasAnyPixel(data.pixels)) {
      return new Response(
        renderPixelBridgeHtml({
          slug,
          targetUrl,
          pixels: data.pixels,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": PIXEL_BRIDGE_CSP,
          },
        }
      );
    }
    return safeRedirect(targetUrl, 303);
  }

  // Handle social preview bots / unfurlers cleanly without inflating human click stats or burning single-use links
  if (isPreviewBot(ua)) {
    data.botClicks = (data.botClicks || 0) + 1;
    if (data.maxClicks) {
      await saveUrlRecord(env, slug, data);
    } else {
      ctx.waitUntil(saveUrlRecord(env, slug, data));
    }

    if (data.ogTitle || data.ogDescription || data.passwordHash) {
      return new Response(
        renderPreviewMetaPage({
          shortUrl,
          destinationUrl: data.passwordHash ? shortUrl : targetUrl,
          title:
            data.ogTitle ||
            data.label ||
            (data.passwordHash
              ? "Password-Protected Link — TinyLink"
              : `TinyLink — /${slug}`),
          description:
            data.ogDescription ||
            (data.passwordHash
              ? "Password-protected link shared via TinyLink."
              : "Shortened link powered by TinyLink."),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Vary": "User-Agent",
            "Referrer-Policy": "no-referrer-when-downgrade",
          },
        }
      );
    }

    return safeRedirect(targetUrl, 302, "private, max-age=90");
  }

  // Password gate on GET when link is password protected
  if (data.passwordHash) {
    return new Response(
      renderPasswordPage({ slug, label: data.label }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": HTML_UNLOCK_CSP,
        },
      }
    );
  }

  // Track human analytics
  applyHumanHit(data, req, splitVariantUrl);
  recordClickStream(
    env,
    {
      slug,
      timestamp: new Date().toISOString(),
      country: getVisitorCountry(req),
      device: detectDevice(req.headers.get("User-Agent") ?? ""),
      referrer: parseReferrer(req.headers.get("Referer")),
      destination: targetUrl,
    },
    ctx
  );
  const hitLimitNow = !!(data.maxClicks && data.clicks >= data.maxClicks);
  if (data.maxClicks) {
    await saveUrlRecord(env, slug, data);
  } else {
    ctx.waitUntil(saveUrlRecord(env, slug, data));
  }
  dispatchWebhookEvent(env, ctx, "link.clicked", slug, data, req, targetUrl);
  if (hitLimitNow) {
    dispatchWebhookEvent(env, ctx, "link.limit_reached", slug, data, req, targetUrl);
  }

  if (data.deepLink && isMobileUserAgent(ua)) {
    const deepTarget = detectAppDeepLink(targetUrl);
    if (deepTarget) {
      return new Response(
        renderDeepLinkBridgeHtml({
          slug,
          app: deepTarget.app,
          scheme: deepTarget.scheme,
          webUrl: targetUrl,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": HTML_UNLOCK_CSP,
          },
        }
      );
    }
  }

  if (data.ctaOverlay?.enabled) {
    return new Response(
      renderCtaOverlayHtml({
        slug,
        targetUrl,
        config: data.ctaOverlay,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": CTA_OVERLAY_CSP,
        },
      }
    );
  }

  if (data.pixelBridge && data.pixels && hasAnyPixel(data.pixels)) {
    return new Response(
      renderPixelBridgeHtml({
        slug,
        targetUrl,
        pixels: data.pixels,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": PIXEL_BRIDGE_CSP,
        },
      }
    );
  }

  return safeRedirect(targetUrl, 302);
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
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
  );
}

// ─── Webhook Settings Handlers ────────────────────────────────────────────────

async function handleGetWebhookSettings(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;
  const config = await getWebhookConfig(env);
  return json({ config: sanitizeWebhookConfig(config) });
}

async function handleSaveWebhookSettings(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: Partial<WebhookConfig> & { clearSecret?: boolean };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  const enabled = body.enabled !== false;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (enabled && !url) {
    return err("Webhook URL is required when enabled");
  }
  if (url) {
    const urlCheck = validateExternalUrl(url, req.url, {
      requireHttps: true,
      maxLength: MAX_WEBHOOK_URL_LENGTH,
    });
    if (urlCheck.error || !urlCheck.url) {
      return err(`Webhook URL invalid: ${urlCheck.error || "blocked destination"}`);
    }
  }

  const existing = await getWebhookConfig(env);
  let secret: string | null;
  if (body.clearSecret === true || body.secret === null) {
    secret = null;
  } else if (typeof body.secret === "string" && body.secret.trim()) {
    const trimmed = body.secret.trim();
    if (trimmed.length > 512) {
      return err("Webhook signing secret must be 512 characters or fewer");
    }
    secret = trimmed;
  } else {
    secret = existing?.secret ?? null;
  }

  const events = {
    onClicked: body.events?.onClicked ?? true,
    onLimitReached: body.events?.onLimitReached ?? true,
    onExpired: body.events?.onExpired ?? true,
  };

  const config: WebhookConfig = {
    url,
    secret,
    events,
    enabled,
    updatedAt: new Date().toISOString(),
  };

  await env.URL_KV.put(WEBHOOK_SETTINGS_KEY, JSON.stringify(config));
  return json({ ok: true, config: sanitizeWebhookConfig(config) });
}

async function handleTestWebhook(req: Request, env: Env, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const bodyParsed = await readBoundedJson<{ url?: string; secret?: string }>(req, 8192);
  const body = bodyParsed.data || {};

  const providedUrl = typeof body.url === "string" ? body.url.trim() : "";
  let targetUrl = providedUrl;
  let targetSecret = typeof body.secret === "string" ? body.secret.trim() : null;
  if (targetSecret && targetSecret.length > 512) {
    return err("Webhook signing secret must be 512 characters or fewer");
  }

  const savedConfig = await getWebhookConfig(env);
  if (!targetUrl) {
    if (!savedConfig || !savedConfig.url) {
      return err("No webhook URL configured or provided to test");
    }
    targetUrl = savedConfig.url;
    if (targetSecret === null && savedConfig.secret) {
      targetSecret = savedConfig.secret;
    }
  } else if (targetSecret === null && savedConfig?.url === targetUrl && savedConfig.secret) {
    targetSecret = savedConfig.secret;
  }

  const checked = validateExternalUrl(targetUrl, req.url, {
    requireHttps: true,
    maxLength: MAX_WEBHOOK_URL_LENGTH,
  });
  if (checked.error || !checked.url) {
    return err(`Webhook URL invalid: ${checked.error || "blocked destination"}`);
  }

  const testPayload: WebhookDispatchPayload = {
    event: "test.ping",
    timestamp: new Date().toISOString(),
    link: {
      slug: "test-ping",
      originalUrl: "https://example.com/test",
      targetUrl: "https://example.com/test",
      clicks: 42,
      maxClicks: 100,
      label: "Test Webhook Ping",
      tags: ["test", "webhook"],
    },
    visitor: {
      country: "US",
      device: "desktop (ios)",
      referrer: "https://github.com/VarshuDev/tinylink",
      ipHash: "a1b2c3d4e5f6",
      userAgent: "TinyLink/3.2 Webhook Engine",
    },
  };

  const res = await sendWebhookPost(checked.url, targetSecret, testPayload);
  return json(res);
}

// ─── Scoped API Keys Handlers (US-013) ─────────────────────────────────────────

async function handleCreateApiKey(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: {
    name?: string;
    scopes?: ApiKeyScope[];
    rateLimit?: number;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return err("Key name is required", 400);
  }
  if (body.name.trim().length > 100) {
    return err("Key name must not exceed 100 characters", 400);
  }

  const allowedScopes: ApiKeyScope[] = ["read:links", "write:links", "delete:links", "read:analytics"];
  let finalScopes: ApiKeyScope[] = ["read:links", "write:links"];
  if (Array.isArray(body.scopes)) {
    for (const s of body.scopes) {
      if (!allowedScopes.includes(s)) {
        return err(`Invalid scope: '${s}'. Allowed scopes: ${allowedScopes.join(", ")}`, 400);
      }
    }
    finalScopes = Array.from(new Set(body.scopes));
  }

  let finalRateLimit = 100;
  if (typeof body.rateLimit === "number" && Number.isFinite(body.rateLimit)) {
    if (body.rateLimit < 1 || body.rateLimit > 10000) {
      return err("rateLimit must be between 1 and 10000 requests per minute", 400);
    }
    finalRateLimit = Math.floor(body.rateLimit);
  }

  const rawToken = generateApiKeyToken();
  const id = generateKeyId();
  const keyHash = await hashApiKey(rawToken);
  const keyPrefix = `${rawToken.slice(0, 14)}...`;

  const record: ApiKeyRecord = {
    id,
    name: body.name.trim(),
    keyPrefix,
    keyHash,
    scopes: finalScopes,
    rateLimit: finalRateLimit,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  await env.URL_KV.put(`apikey:${keyHash}`, JSON.stringify(record));

  // Update index
  const indexRaw = await env.URL_KV.get("apikeys:index");
  const keysIndex: ApiKeyRecord[] = indexRaw ? JSON.parse(indexRaw) : [];
  keysIndex.unshift(record);
  await env.URL_KV.put("apikeys:index", JSON.stringify(keysIndex));

  return json({ ok: true, key: record, token: rawToken }, 201);
}

async function handleListApiKeys(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const indexRaw = await env.URL_KV.get("apikeys:index");
  const keys: ApiKeyRecord[] = indexRaw ? JSON.parse(indexRaw) : [];
  return json({ ok: true, keys });
}

async function handleDeleteApiKey(id: string, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const indexRaw = await env.URL_KV.get("apikeys:index");
  const keysIndex: ApiKeyRecord[] = indexRaw ? JSON.parse(indexRaw) : [];
  const existing = keysIndex.find((k) => k.id === id);
  if (!existing) {
    return err("API key not found", 404);
  }

  await env.URL_KV.delete(`apikey:${existing.keyHash}`);
  const filtered = keysIndex.filter((k) => k.id !== id);
  await env.URL_KV.put("apikeys:index", JSON.stringify(filtered));

  return json({ ok: true, deleted: id });
}

// ─── Custom Domain Multi-Tenancy Handlers (US-014) ───────────────────────────

const DOMAIN_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

async function handleListDomains(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const indexRaw = await env.URL_KV.get("domains:index");
  const domainNames: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  const domains: CustomDomainRecord[] = [];

  for (const name of domainNames) {
    const raw = await env.URL_KV.get(`domain:${name}`);
    if (raw) {
      try {
        domains.push(JSON.parse(raw));
      } catch {}
    }
  }

  return json({ ok: true, domains });
}

async function handleCreateDomain(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: {
    domain?: string;
    rootRedirect?: string | null;
    custom404Html?: string | null;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  if (!body.domain || typeof body.domain !== "string") {
    return err("Domain is required", 400);
  }

  const cleanDomain = body.domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim();
  if (!DOMAIN_NAME_RE.test(cleanDomain) || cleanDomain.length > 253) {
    return err("Invalid domain format. Example: tinylink.devs.li or go.mybrand.com", 400);
  }

  let rootRedirect: string | null = null;
  if (body.rootRedirect && typeof body.rootRedirect === "string" && body.rootRedirect.trim()) {
    try {
      const parsedUrl = new URL(body.rootRedirect.trim());
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return err("rootRedirect must use http or https protocol", 400);
      }
      rootRedirect = parsedUrl.toString();
    } catch {
      return err("Invalid rootRedirect URL", 400);
    }
  }

  const record: CustomDomainRecord = {
    domain: cleanDomain,
    rootRedirect,
    custom404Html: typeof body.custom404Html === "string" ? body.custom404Html : null,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await env.URL_KV.put(`domain:${cleanDomain}`, JSON.stringify(record));

  // Add to index
  const indexRaw = await env.URL_KV.get("domains:index");
  const domainNames: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (!domainNames.includes(cleanDomain)) {
    domainNames.push(cleanDomain);
    await env.URL_KV.put("domains:index", JSON.stringify(domainNames));
  }

  return json({ ok: true, domain: record }, 201);
}

async function handleDeleteDomain(domain: string, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim();
  await env.URL_KV.delete(`domain:${cleanDomain}`);

  const indexRaw = await env.URL_KV.get("domains:index");
  const domainNames: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  const filtered = domainNames.filter((d) => d !== cleanDomain);
  await env.URL_KV.put("domains:index", JSON.stringify(filtered));

  return json({ ok: true, deleted: cleanDomain });
}

// ─── Bio Page Helpers & Handlers ──────────────────────────────────────────────

export function bioKey(handle: string): string {
  return "bio:" + handle.toLowerCase();
}

export function validateBioHandle(handle: string): { valid: boolean; error?: string } {
  if (!handle || typeof handle !== "string") return { valid: false, error: "Handle is required" };
  const h = handle.trim().toLowerCase();
  if (!BIO_HANDLE_RE.test(h)) {
    return { valid: false, error: "Bio handle must be 2-30 characters (letters, numbers, underscores, dashes)" };
  }
  if (RESERVED_BIO_HANDLES.has(h) || RESERVED_SLUGS.has(h)) {
    return { valid: false, error: `Handle '${h}' is reserved` };
  }
  return { valid: true };
}

export function normalizeBioLinks(linksRaw: unknown, baseOriginUrl: string): { links: BioLinkItem[]; error?: string } {
  if (!linksRaw) return { links: [] };
  if (!Array.isArray(linksRaw)) return { links: [], error: "Links must be an array" };
  if (linksRaw.length > 25) return { links: [], error: "Maximum 25 links allowed per bio page" };

  const allowedIcons = new Set(["globe", "github", "twitter", "instagram", "youtube", "linkedin", "email", "discord", "music"]);
  const links: BioLinkItem[] = [];

  for (let i = 0; i < linksRaw.length; i++) {
    const item = linksRaw[i];
    if (!item || typeof item !== "object") continue;
    const rawObj = item as Record<string, unknown>;
    const title = typeof rawObj.title === "string" ? rawObj.title.trim().slice(0, 100) : "";
    const urlStr = typeof rawObj.url === "string" ? rawObj.url.trim() : "";
    if (!title || !urlStr) continue;

    const validUrl = validateDestinationUrl(urlStr, baseOriginUrl);
    if (validUrl.error || !validUrl.url) {
      return { links: [], error: `Link #${i + 1} (${title}): ${validUrl.error || "Invalid destination URL"}` };
    }

    const id = typeof rawObj.id === "string" && rawObj.id.trim()
      ? rawObj.id.trim().slice(0, 36)
      : `lnk_${Math.random().toString(36).slice(2, 10)}`;
    const icon = typeof rawObj.icon === "string" && allowedIcons.has(rawObj.icon.toLowerCase())
      ? rawObj.icon.toLowerCase()
      : "globe";
    const highlight = !!rawObj.highlight;
    const clicks = typeof rawObj.clicks === "number" && rawObj.clicks >= 0 ? Math.floor(rawObj.clicks) : 0;

    links.push({ id, title, url: validUrl.url, icon, highlight, clicks });
  }

  return { links };
}

export function normalizeBioSocials(socialsRaw: unknown): BioSocials {
  if (!socialsRaw || typeof socialsRaw !== "object" || Array.isArray(socialsRaw)) return {};
  const raw = socialsRaw as Record<string, unknown>;
  const clean: BioSocials = {};
  const fields: (keyof BioSocials)[] = ["instagram", "twitter", "github", "youtube", "linkedin", "email", "discord", "website"];
  for (const f of fields) {
    if (typeof raw[f] === "string") {
      const v = (raw[f] as string).trim().slice(0, 100);
      if (v) clean[f] = v;
    }
  }
  return clean;
}

export function normalizeBioTheme(themeRaw: unknown): BioTheme {
  const validThemes: Set<BioTheme> = new Set(["midnight", "paper", "emerald", "sunset", "glass"]);
  if (typeof themeRaw === "string" && validThemes.has(themeRaw as BioTheme)) {
    return themeRaw as BioTheme;
  }
  return "midnight";
}

async function handlePublicBioPage(handle: string, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const raw = await env.URL_KV.get(bioKey(handle));
  if (!raw) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 Not Found",
        title: "Bio Page Not Found",
        message: `The bio page @${escapeHtml(handle)} does not exist or has been removed.`,
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data: BioPageData = JSON.parse(raw);
  data.views = (data.views || 0) + 1;
  ctx.waitUntil(env.URL_KV.put(bioKey(handle), JSON.stringify(data)));

  const origin = getRequestOrigin(req);
  const html = renderBioPageHtml(data, origin);
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=30, s-maxage=60",
  };
  if (data.pixels && hasAnyPixel(data.pixels)) {
    headers["Content-Security-Policy"] = PIXEL_BRIDGE_CSP;
  }
  return new Response(html, {
    status: 200,
    headers,
  });
}

async function handleBioLinkRedirect(handle: string, linkId: string, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const raw = await env.URL_KV.get(bioKey(handle));
  if (!raw) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 Not Found",
        title: "Bio Page Not Found",
        message: `The bio profile @${escapeHtml(handle)} was not found.`,
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data: BioPageData = JSON.parse(raw);
  const link = (data.links || []).find((l) => l.id === linkId);
  if (!link || !link.url) {
    return new Response(
      renderStatusPage({
        status: 404,
        codeLabel: "404 Not Found",
        title: "Link Not Found",
        message: "The requested link button is no longer available on this bio page.",
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  link.clicks = (link.clicks || 0) + 1;
  ctx.waitUntil(env.URL_KV.put(bioKey(handle), JSON.stringify(data)));

  return new Response(null, {
    status: 302,
    headers: {
      Location: link.url,
      "Referrer-Policy": "no-referrer-when-downgrade",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function handleBioList(env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const listResult = await env.URL_KV.list({ prefix: "bio:" });
  const summaries: BioPageSummary[] = [];

  for (const k of listResult.keys) {
    const raw = await env.URL_KV.get(k.name);
    if (!raw) continue;
    try {
      const page: BioPageData = JSON.parse(raw);
      const totalClicks = (page.links || []).reduce((acc, l) => acc + (l.clicks || 0), 0);
      const leadsRaw = await env.URL_KV.get(`b:leads:${page.handle.toLowerCase()}`);
      const subscribersCount = leadsRaw ? JSON.parse(leadsRaw).length : 0;
      summaries.push({
        handle: page.handle,
        title: page.title,
        avatarUrl: page.avatarUrl || null,
        verified: !!page.verified,
        theme: page.theme || "midnight",
        linksCount: (page.links || []).length,
        views: page.views || 0,
        totalClicks,
        subscribersCount,
        updatedAt: page.updatedAt || page.createdAt,
      });
    } catch {}
  }

  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return json({ ok: true, pages: summaries, profiles: summaries });
}

async function handleBioGet(handle: string, env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const raw = await env.URL_KV.get(bioKey(handle));
  if (!raw) return err("Bio page not found", 404);

  const page: BioPageData = JSON.parse(raw);
  return json({ ok: true, page, profile: page });
}

async function handleBioCreate(env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: {
    handle?: string;
    title?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    verified?: boolean;
    theme?: BioTheme;
    customAccentColor?: string | null;
    links?: unknown;
    socials?: unknown;
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogImage?: string | null;
    leadCapture?: unknown;
    pixels?: unknown;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  const validHandle = validateBioHandle(body.handle || "");
  if (!validHandle.valid) return err(validHandle.error || "Invalid handle", 400);

  const cleanHandle = (body.handle || "").trim().toLowerCase();
  const existing = await env.URL_KV.get(bioKey(cleanHandle));
  if (existing) return err(`Bio handle '@${cleanHandle}' already exists`, 409);

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 60) : "";
  if (!title) return err("Profile title is required (up to 60 characters)", 400);

  let avatarUrl: string | null = null;
  if (typeof body.avatarUrl === "string" && body.avatarUrl.trim()) {
    const validAvatar = validateDestinationUrl(body.avatarUrl.trim(), req.url);
    if (validAvatar.error || !validAvatar.url) {
      return err(`Avatar URL invalid: ${validAvatar.error || "unreachable or invalid format"}`);
    }
    avatarUrl = validAvatar.url;
  }

  const normalizedLinks = normalizeBioLinks(body.links, req.url);
  if (normalizedLinks.error) return err(normalizedLinks.error, 400);

  const socials = normalizeBioSocials(body.socials);
  const theme = normalizeBioTheme(body.theme);

  let customAccentColor: string | null = null;
  if (typeof body.customAccentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.customAccentColor.trim())) {
    customAccentColor = body.customAccentColor.trim();
  }

  const now = new Date().toISOString();
  const bioPage: BioPageData = {
    handle: cleanHandle,
    title,
    bio: typeof body.bio === "string" ? body.bio.trim().slice(0, 250) : null,
    avatarUrl,
    verified: !!body.verified,
    theme,
    customAccentColor,
    links: normalizedLinks.links,
    socials,
    ogTitle: typeof body.ogTitle === "string" ? body.ogTitle.trim().slice(0, 100) : null,
    ogDescription: typeof body.ogDescription === "string" ? body.ogDescription.trim().slice(0, 220) : null,
    ogImage: typeof body.ogImage === "string" ? body.ogImage.trim() : null,
    leadCapture: normalizeBioLeadCapture(body.leadCapture),
    pixels: normalizePixelConfig(body.pixels),
    views: 0,
    createdAt: now,
    updatedAt: now,
  };

  await env.URL_KV.put(bioKey(cleanHandle), JSON.stringify(bioPage));
  return json({ ok: true, page: bioPage, profile: bioPage }, 201);
}

async function handleBioUpdate(handle: string, env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const cleanHandle = handle.trim().toLowerCase();
  const raw = await env.URL_KV.get(bioKey(cleanHandle));
  if (!raw) return err("Bio page not found", 404);

  const existingPage: BioPageData = JSON.parse(raw);

  let body: {
    title?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    verified?: boolean;
    theme?: BioTheme;
    customAccentColor?: string | null;
    links?: unknown;
    socials?: unknown;
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogImage?: string | null;
    leadCapture?: unknown;
    pixels?: unknown;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim().slice(0, 60) : "";
    if (!t) return err("Profile title cannot be empty", 400);
    existingPage.title = t;
  }

  if (body.bio !== undefined) {
    existingPage.bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 250) : null;
  }

  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      existingPage.avatarUrl = null;
    } else if (typeof body.avatarUrl === "string") {
      const validAvatar = validateDestinationUrl(body.avatarUrl.trim(), req.url);
      if (validAvatar.error || !validAvatar.url) {
        return err(`Avatar URL invalid: ${validAvatar.error || "unreachable or invalid format"}`);
      }
      existingPage.avatarUrl = validAvatar.url;
    }
  }

  if (body.verified !== undefined) {
    existingPage.verified = !!body.verified;
  }

  if (body.theme !== undefined) {
    existingPage.theme = normalizeBioTheme(body.theme);
  }

  if (body.customAccentColor !== undefined) {
    if (body.customAccentColor === null || body.customAccentColor === "") {
      existingPage.customAccentColor = null;
    } else if (typeof body.customAccentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.customAccentColor.trim())) {
      existingPage.customAccentColor = body.customAccentColor.trim();
    }
  }

  if (body.links !== undefined) {
    const normalizedLinks = normalizeBioLinks(body.links, req.url);
    if (normalizedLinks.error) return err(normalizedLinks.error, 400);

    const oldClicksMap = new Map((existingPage.links || []).map((l) => [l.id, l.clicks || 0]));
    for (const newL of normalizedLinks.links) {
      if (oldClicksMap.has(newL.id)) {
        newL.clicks = oldClicksMap.get(newL.id)!;
      }
    }
    existingPage.links = normalizedLinks.links;
  }

  if (body.socials !== undefined) {
    existingPage.socials = normalizeBioSocials(body.socials);
  }

  if (body.ogTitle !== undefined) {
    existingPage.ogTitle = typeof body.ogTitle === "string" ? body.ogTitle.trim().slice(0, 100) : null;
  }
  if (body.ogDescription !== undefined) {
    existingPage.ogDescription = typeof body.ogDescription === "string" ? body.ogDescription.trim().slice(0, 220) : null;
  }
  if (body.ogImage !== undefined) {
    existingPage.ogImage = typeof body.ogImage === "string" ? body.ogImage.trim() : null;
  }
  if (body.leadCapture !== undefined) {
    existingPage.leadCapture = normalizeBioLeadCapture(body.leadCapture);
  }
  if (body.pixels !== undefined) {
    existingPage.pixels = normalizePixelConfig(body.pixels);
  }

  existingPage.updatedAt = new Date().toISOString();
  await env.URL_KV.put(bioKey(cleanHandle), JSON.stringify(existingPage));
  return json({ ok: true, page: existingPage, profile: existingPage });
}

async function handleBioDelete(handle: string, env: Env, req: Request, ctx: ExecutionContext): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const cleanHandle = handle.trim().toLowerCase();
  const existing = await env.URL_KV.get(bioKey(cleanHandle));
  if (!existing) return err("Bio page not found", 404);

  await env.URL_KV.delete(bioKey(cleanHandle));
  return json({ ok: true, deleted: cleanHandle });
}

async function handleBioSubscribe(
  handle: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const cleanHandle = handle.trim().toLowerCase();
  const raw = await env.URL_KV.get(bioKey(cleanHandle));
  if (!raw) {
    return err("Bio page not found", 404);
  }
  const data: BioPageData = JSON.parse(raw);
  if (!data.leadCapture || !data.leadCapture.enabled) {
    return err("Lead capture is not enabled for this bio page", 400);
  }

  // Rate limiting by IP
  const ip = getClientIp(req);
  const ipHash = await computeIpHash(ip, env);
  const rlKey = `rlbio:sub:${cleanHandle}:${ipHash.slice(0, 16)}`;
  const rlRecord = await readRateLimit(env, rlKey);
  const now = Date.now();
  if (rlRecord && rlRecord.count >= 5 && now < rlRecord.resetAt) {
    return err("Too many subscription requests. Please try again later.", 429);
  }

  let email: string = "";
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const bodyParsed = await readBoundedJson<{ email?: string }>(req);
    if (bodyParsed.data && typeof bodyParsed.data.email === "string") {
      email = bodyParsed.data.email.trim();
    }
  } else {
    const text = await req.text();
    const params = new URLSearchParams(text);
    email = (params.get("email") || "").trim();
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return err("Please provide a valid email address", 400);
  }

  await recordRateLimitFailure(env, rlKey, rlRecord, 600);

  const leadsKey = `b:leads:${cleanHandle}`;
  const existingRaw = await env.URL_KV.get(leadsKey);
  const leads: BioLead[] = existingRaw ? JSON.parse(existingRaw) : [];

  const lowerEmail = email.toLowerCase();
  const existingIdx = leads.findIndex((l) => l.email.toLowerCase() === lowerEmail);
  const subDate = new Date().toISOString();
  if (existingIdx === -1) {
    leads.unshift({ email: lowerEmail, subscribedAt: subDate, ipHash: ipHash.slice(0, 16) });
    if (leads.length > 5000) leads.length = 5000;
    await env.URL_KV.put(leadsKey, JSON.stringify(leads));
  }

  const successMsg = data.leadCapture.successMessage || "Thank you for subscribing!";

  if (!contentType.includes("application/json")) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/bio/${encodeURIComponent(cleanHandle)}?subscribed=1`,
      },
    });
  }

  return json({
    ok: true,
    message: successMsg,
    count: leads.length,
  });
}

async function handleBioSubscribers(
  handle: string,
  env: Env,
  req: Request,
  ctx: ExecutionContext
): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  const cleanHandle = handle.trim().toLowerCase();
  const leadsKey = `b:leads:${cleanHandle}`;
  const raw = await env.URL_KV.get(leadsKey);
  const leads: BioLead[] = raw ? JSON.parse(raw) : [];

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv" || url.pathname.endsWith(".csv")) {
    let csv = "Email,Subscribed At\r\n";
    for (const lead of leads) {
      csv += `"${lead.email.replace(/"/g, '""')}","${lead.subscribedAt}"\r\n`;
    }
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${cleanHandle}-subscribers.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return json({
    ok: true,
    handle: cleanHandle,
    count: leads.length,
    subscribers: leads,
  });
}

async function handleCreateCampaign(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;

  let body: {
    name?: string;
    url?: string;
    channels?: string[];
    expiresIn?: string;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return err("Campaign name is required");
  }
  const campaign = normalizeCampaign(body.name);
  if (!campaign) {
    return err("Invalid campaign name");
  }

  const validUrl = validateDestinationUrl(body.url, req.url);
  if (validUrl.error || !validUrl.url) {
    return err(validUrl.error || "Invalid destination URL");
  }

  const defaultChannels = ["instagram", "youtube", "twitter", "linkedin", "tiktok"];
  const channels = Array.isArray(body.channels) && body.channels.length > 0
    ? body.channels.map((c) => String(c).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")).filter(Boolean).slice(0, 8)
    : defaultChannels;

  if (channels.length === 0) {
    return err("At least one valid channel is required");
  }

  const expiresIn = parseExpiryInput(body.expiresIn);
  const expiresAt = computeExpiration(expiresIn);
  const origin = getRequestOrigin(req);
  const now = new Date().toISOString();

  const createdLinks: Array<{
    channel: string;
    slug: string;
    shortUrl: string;
    targetUrl: string;
  }> = [];

  for (const channel of channels) {
    const target = new URL(validUrl.url);
    target.searchParams.set("utm_source", channel);
    target.searchParams.set("utm_medium", "social");
    target.searchParams.set("utm_campaign", campaign);
    const finalDestUrl = target.toString();

    let slug: string = "";
    for (let i = 0; i < 10; i++) {
      const candidate = generateSlug();
      if (RESERVED_SLUGS.has(candidate.toLowerCase())) continue;
      const existing = await env.URL_KV.get(key(candidate));
      if (!existing) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      return err("Failed to allocate unique slug for channel: " + channel, 500);
    }

    const data: URLData = {
      originalUrl: finalDestUrl,
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
      label: `${body.name.trim()} (${channel})`,
      tags: [campaign, channel],
      campaign,
      maxClicks: null,
      passwordHash: null,
      ogTitle: null,
      ogDescription: null,
      publicStats: true,
      deepLink: true,
    };

    await saveUrlRecord(env, slug, data);

    createdLinks.push({
      channel,
      slug,
      shortUrl: `${origin}/${slug}`,
      targetUrl: finalDestUrl,
    });
  }

  return json(
    {
      ok: true,
      campaign,
      name: body.name.trim(),
      count: createdLinks.length,
      links: createdLinks,
    },
    201
  );
}

// ─── Frontend HTML ────────────────────────────────────────────────────────────

function frontend(env: Env) {
  return new Response(renderDashboardHtml(isAuthRequired(env)), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
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
    const res = await handleRoute(req, env, ctx);
    return applySecurityHeaders(res, req, env);
  },
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    await runSentinelScan(env, ctx);
  },
} as ExportedHandler<Env>;

async function handleRoute(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const hostHeader = (req.headers.get("X-Forwarded-Host") || req.headers.get("Host") || "")
    .split(":")[0]
    .toLowerCase()
    .trim();

  let customDomain: CustomDomainRecord | null = null;
  if (hostHeader) {
    const rawDomain = await env.URL_KV.get(`domain:${hostHeader}`);
    if (rawDomain) {
      try {
        customDomain = JSON.parse(rawDomain);
      } catch {}
    }
  }

  if (customDomain && (path === "/" || path === "") && customDomain.rootRedirect) {
    return Response.redirect(customDomain.rootRedirect, 302);
  }

  if (req.method === "OPTIONS") {
    const originCheck = resolveAllowedOrigin(req, env);
    if (!originCheck.allowed) {
      return err("Origin not allowed", 403);
    }
    return new Response(null, { headers: corsHeadersFor(req, env), status: 204 });
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

  if (path === "/assets/theme.js" && req.method === "GET") {
    return new Response(THEME_INIT_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/assets/app.js" && req.method === "GET") {
    return new Response(DASHBOARD_APP_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }

  if (path === "/assets/docs.js" && req.method === "GET") {
    return new Response(DOCS_PAGE_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/assets/unlock.js" && req.method === "GET") {
    return new Response(UNLOCK_PAGE_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/assets/bio.js" && req.method === "GET") {
    return new Response(BIO_PAGE_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/assets/status.js" && req.method === "GET") {
    return new Response(STATUS_PAGE_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/assets/pixel-bridge.js" && req.method === "GET") {
    return new Response(PIXEL_BRIDGE_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/assets/cta-overlay.js" && req.method === "GET") {
    return new Response(CTA_OVERLAY_JS, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/robots.txt") {
    const robotsTxt = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /stats/",
      "",
      "# Social media preview crawlers",
      "User-agent: facebookexternalhit",
      "Allow: /",
      "User-agent: Facebot",
      "Allow: /",
      "User-agent: Twitterbot",
      "Allow: /",
      "User-agent: LinkedInBot",
      "Allow: /",
      "User-agent: WhatsApp",
      "Allow: /",
      "User-agent: TelegramBot",
      "Allow: /",
      "User-agent: TikTokBot",
      "Allow: /",
      "User-agent: ByteSpider",
      "Allow: /",
      "User-agent: Pinterestbot",
      "Allow: /",
      "User-agent: Applebot",
      "Allow: /",
      "",
    ].join("\n");
    return new Response(robotsTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  if (path === "/.well-known/security.txt") {
    const secTxt = [
      "Contact: mailto:security@tinylink.dev",
      "Expires: 2027-12-31T23:59:59.000Z",
      "Preferred-Languages: en",
      "Canonical: /.well-known/security.txt",
      "Policy: https://github.com/VarshuDev/tinylink",
      "",
    ].join("\n");
    return new Response(secTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // API routes
  if (path.startsWith("/api/")) {
    const csrfError = verifyCsrf(req, env);
    if (csrfError) return csrfError;
  }

  if (path === "/api/health" && req.method === "GET") {
    return json({ ok: true, authRequired: isAuthRequired(env), service: "tinylink" });
  }
  if (path === "/api/docs" && req.method === "GET") {
    return new Response(renderDocsHtml(getRequestOrigin(req)), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": HTML_CSP,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  if (path === "/api/auth/session" && req.method === "GET") return handleAuthSession(req, env);
  if (path === "/api/auth/login" && req.method === "POST") return handleAuthLogin(req, env, ctx);
  if (path === "/api/auth/logout" && req.method === "POST") return handleAuthLogout(req);
  if (path === "/api/keys" && req.method === "GET") return handleListApiKeys(req, env, ctx);
  if (path === "/api/keys" && req.method === "POST") return handleCreateApiKey(req, env, ctx);
  if (path.startsWith("/api/keys/") && req.method === "DELETE") {
    const id = path.slice("/api/keys/".length);
    if (!id) return err("Invalid key ID", 400);
    return handleDeleteApiKey(id, req, env, ctx);
  }
  if (path === "/api/domains" && req.method === "GET") return handleListDomains(req, env, ctx);
  if (path === "/api/domains" && req.method === "POST") return handleCreateDomain(req, env, ctx);
  if (path.startsWith("/api/domains/") && req.method === "DELETE") {
    const domain = path.slice("/api/domains/".length);
    if (!domain) return err("Invalid domain", 400);
    return handleDeleteDomain(domain, req, env, ctx);
  }
  if (path === "/api/settings/webhooks" && req.method === "GET") return handleGetWebhookSettings(req, env, ctx);
  if (path === "/api/settings/webhooks" && req.method === "POST") return handleSaveWebhookSettings(req, env, ctx);
  if (path === "/api/settings/webhooks/test" && req.method === "POST") return handleTestWebhook(req, env, ctx);
  if (path === "/api/list" && req.method === "GET") return handleList(env, req, ctx);
  if (path === "/api/ai/suggest" && req.method === "POST") return handleAiSuggest(req, env, ctx);
  if (path === "/api/ai/metadata" && req.method === "POST") return handleAiMetadata(req, env, ctx);
  if (path === "/api/shorten" && req.method === "POST") return handleShorten(req, env, ctx);
  if (path === "/api/campaigns" && req.method === "POST") return handleCreateCampaign(req, env, ctx);
  if (path === "/api/sentinel/scan" && req.method === "POST") return handleSentinelScan(req, env, ctx);
  if (path === "/api/bulk-delete" && req.method === "POST") return handleBulkDelete(req, env, ctx);
  if (path === "/api/import" && req.method === "POST") return handleImport(req, env, ctx);
  if (path === "/api/qr" && req.method === "POST") return handleGenerateQr(req, env, ctx);
  if (path.startsWith("/api/qr/") && req.method === "GET") {
    const slug = decodeSlugParam(path.slice("/api/qr/".length));
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
    return handleGetQr(slug, req, env);
  }
  if (path === "/api/stream/clicks" && req.method === "GET") return handleStreamClicks(req, env, ctx);
  if (path === "/api/goals/track" && req.method === "POST") return handleTrackGoal(req, env, ctx);
  if (path.startsWith("/api/analytics/") && req.method === "GET") {
    const rest = path.slice("/api/analytics/".length);
    if (rest.endsWith("/export")) {
      const slug = decodeSlugParam(rest.slice(0, -"/export".length));
      if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
      return handleExportAnalytics(slug, env, req, ctx);
    }
    const slug = decodeSlugParam(rest);
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
    return handleAnalytics(slug, env, req, ctx);
  }
  if (path.startsWith("/api/urls/") && req.method === "PUT") {
    const slug = decodeSlugParam(path.slice("/api/urls/".length));
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
    return handleUpdate(slug, env, req, ctx);
  }
  if (path.startsWith("/api/urls/") && req.method === "DELETE") {
    const slug = decodeSlugParam(path.slice("/api/urls/".length));
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
    return handleDelete(slug, env, req, ctx);
  }
  if (
    (path.startsWith("/api/links/") || path.startsWith("/api/urls/")) &&
    path.endsWith("/health") &&
    req.method === "POST"
  ) {
    const prefix = path.startsWith("/api/links/") ? "/api/links/" : "/api/urls/";
    const rawSlug = path.slice(prefix.length, -"/health".length);
    const slug = decodeSlugParam(rawSlug);
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
    return handleCheckHealth(slug, env, req, ctx);
  }

  // Bio API endpoints
  if (path === "/api/bio" && req.method === "GET") return handleBioList(env, req, ctx);
  if (path === "/api/bio" && req.method === "POST") return handleBioCreate(env, req, ctx);
  if (path.startsWith("/api/bio/") && path.includes("/subscribers") && req.method === "GET") {
    const subPath = path.slice("/api/bio/".length);
    const slashIdx = subPath.indexOf("/");
    const rawHandle = slashIdx === -1 ? subPath.replace(/\.csv$/, "") : subPath.slice(0, slashIdx);
    const handle = decodeSlugParam(rawHandle);
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handleBioSubscribers(handle, env, req, ctx);
  }
  if (path.startsWith("/api/bio/") && req.method === "GET") {
    const handle = decodeSlugParam(path.slice("/api/bio/".length));
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handleBioGet(handle, env, req, ctx);
  }
  if (path.startsWith("/api/bio/") && req.method === "PUT") {
    const handle = decodeSlugParam(path.slice("/api/bio/".length));
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handleBioUpdate(handle, env, req, ctx);
  }
  if (path.startsWith("/api/bio/") && req.method === "DELETE") {
    const handle = decodeSlugParam(path.slice("/api/bio/".length));
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handleBioDelete(handle, env, req, ctx);
  }

  // Public Bio subscribe endpoint: /bio/:handle/subscribe or /p/:handle/subscribe
  const bioSubMatch = path.match(/^\/(?:bio|p)\/([a-zA-Z0-9_-]+)\/subscribe$/);
  if (bioSubMatch && req.method === "POST") {
    const handle = decodeSlugParam(bioSubMatch[1]);
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handleBioSubscribe(handle, req, env, ctx);
  }

  // Public Bio click redirect: /bio/:handle/c/:linkId or /p/:handle/c/:linkId
  const bioClickMatch = path.match(/^\/(?:bio|p)\/([a-zA-Z0-9_-]+)\/c\/([^/]+)$/);
  if (bioClickMatch && req.method === "GET") {
    const handle = decodeSlugParam(bioClickMatch[1]);
    const linkId = decodeURIComponent(bioClickMatch[2]);
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handleBioLinkRedirect(handle, linkId, req, env, ctx);
  }

  // Public Bio profile page: /bio/:handle or /p/:handle
  const bioPageMatch = path.match(/^\/(?:bio|p)\/([a-zA-Z0-9_-]+)\/?$/);
  if (bioPageMatch && req.method === "GET") {
    const handle = decodeSlugParam(bioPageMatch[1]);
    if (!handle || !BIO_HANDLE_RE.test(handle)) return err("Invalid bio handle", 400);
    return handlePublicBioPage(handle, req, env, ctx);
  }

  // Opt-in public read-only stats route
  if (path.startsWith("/stats/") && req.method === "GET") {
    const cleanRaw = path.slice("/stats/".length).replace(/\/+$/, "");
    const slug = decodeSlugParam(cleanRaw);
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
    return handlePublicStats(slug, req, env);
  }

  // Redirect & unlock routes (strip accidental trailing slashes cleanly)
  if (path !== "/" && !path.startsWith("/api/") && (req.method === "GET" || req.method === "POST")) {
    let cleanRaw = path.slice(1).replace(/\/+$/, "");
    if (cleanRaw.endsWith("/unlock")) {
      cleanRaw = cleanRaw.slice(0, -"/unlock".length);
    }
    const slug = decodeSlugParam(cleanRaw);
    if (slug) {
      return handleRedirect(slug, req, env, ctx, customDomain);
    }
    if (customDomain?.custom404Html) {
      return new Response(customDomain.custom404Html, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Custom-Domain": customDomain.domain },
      });
    }
  }

  // Frontend Dashboard
  if (customDomain && customDomain.custom404Html && path !== "/") {
    return new Response(customDomain.custom404Html, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Custom-Domain": customDomain.domain },
    });
  }
  return frontend(env);
}
