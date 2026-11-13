import QRCode from "qrcode";
import { DASHBOARD_APP_JS, renderDashboardHtml } from "./frontend";
import {
  THEME_INIT_JS,
  UNLOCK_PAGE_JS,
  renderPasswordPage,
  renderPreviewMetaPage,
  renderPublicStatsPage,
  renderStatusPage,
} from "./pages";
import type {
  AnalyticsResponse,
  Env,
  ImportLinkInput,
  PublicWebhookConfig,
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

const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#090D16"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#22C55E" stroke-opacity="0.28" stroke-width="8"/>
  <path d="M214 298a72 72 0 0 0 101.82 0l50.91-50.91a72 72 0 0 0-101.82-101.82L239.45 170.7M298 214a72 72 0 0 0-101.82 0l-50.91 50.91a72 72 0 0 0 101.82 101.82l25.46-25.43" fill="none" stroke="#22C55E" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SERVICE_WORKER_JS = `const CACHE_NAME = 'tinylink-shell-v3';
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

  if (
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/assets/theme.js' ||
    url.pathname === '/assets/app.js'
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

interface AuthResult {
  ok: boolean;
  response?: Response;
}

async function authenticateApiRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<AuthResult> {
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

export function resolveDestinationUrl(
  data: URLData,
  country: string,
  os: "ios" | "android" | "desktop"
): { targetUrl: string; reason: "device" | "geo" | "default" } {
  if (data.deviceRoutes && data.deviceRoutes[os]?.trim()) {
    return { targetUrl: data.deviceRoutes[os]!.trim(), reason: "device" };
  }
  const upperCountry = country.toUpperCase();
  if (data.geoRoutes && data.geoRoutes[upperCountry]?.trim()) {
    return { targetUrl: data.geoRoutes[upperCountry]!.trim(), reason: "geo" };
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

function validateDestinationUrl(rawUrl: string | undefined, reqUrl: string): { url?: string; error?: string } {
  if (!rawUrl || !rawUrl.trim()) return { error: "Missing 'url' field" };
  return validateExternalUrl(rawUrl, reqUrl, { requireHttps: false, maxLength: MAX_URL_LENGTH });
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

function normalizeOgText(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed || null;
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
        : "Webhook Ping Test";

    const color =
      payload.event === "link.limit_reached"
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
  event: "link.clicked" | "link.limit_reached" | "link.expired",
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
    startsAt?: string | null;
    fallbackUrl?: string | null;
    geoRoutes?: Record<string, string>;
    deviceRoutes?: { ios?: string | null; android?: string | null; desktop?: string | null };
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
        startsAt: match.startsAt,
        fallbackUrl: match.fallbackUrl,
        isPending: match.isPending,
        geoRoutes: match.geoRoutes,
        deviceRoutes: match.deviceRoutes,
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
    startsAt: data.startsAt ?? null,
    fallbackUrl: data.fallbackUrl ?? null,
    isPending: isLinkPending(data),
    geoRoutes: data.geoRoutes ?? {},
    deviceRoutes: data.deviceRoutes ?? {},
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
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

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
    startsAt: data.startsAt ?? null,
    fallbackUrl: data.fallbackUrl ?? null,
    isPending: isLinkPending(data),
    geoRoutes: data.geoRoutes ?? {},
    deviceRoutes: data.deviceRoutes ?? {},
    qrSvg,
  });
}

async function handleUpdate(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

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
    startsAt?: string | null;
    fallbackUrl?: string | null;
    geoRoutes?: Record<string, string> | null;
    deviceRoutes?: { ios?: string | null; android?: string | null; desktop?: string | null } | null;
  };
  const bodyParsed = await readBoundedJson<typeof body>(req);
  if (bodyParsed.error || !bodyParsed.data) {
    return err(bodyParsed.error || "Invalid JSON body", bodyParsed.status || 400);
  }
  body = bodyParsed.data;

  const hasUrl = body.url !== undefined;
  const hasExpiry = body.expiresIn !== undefined && body.expiresIn !== "keep";
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
    !hasDeviceRoutes
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
    message: "Link updated successfully",
  });
}

async function handleDelete(slug: string, env: Env, req: Request, ctx: ExecutionContext) {
  const auth = await authenticateApiRequest(req, env, ctx);
  if (!auth.ok) return auth.response!;
  if (!SLUG_RE.test(slug)) return err("Invalid slug", 400);

  const raw = await env.URL_KV.get(key(slug));
  if (!raw) return err("URL not found", 404);

  await env.URL_KV.delete(key(slug));
  return json({ deleted: slug });
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
  ctx: ExecutionContext
) {
  if (!SLUG_RE.test(slug)) {
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
      }),
      { status: 425, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  if (isLinkExpired(data)) {
    dispatchWebhookEvent(env, ctx, "link.expired", slug, data, req, data.originalUrl);
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
  const reqUrl = new URL(req.url);
  const shortUrl = `${reqUrl.origin}/${slug}`;
  const country = getVisitorCountry(req);
  const os = detectOsCategory(ua);
  const { targetUrl } = resolveDestinationUrl(data, country, os);

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

    applyHumanHit(data, req);
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
  applyHumanHit(data, req);
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
} as ExportedHandler<Env>;

async function handleRoute(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

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
  if (path === "/api/auth/session" && req.method === "GET") return handleAuthSession(req, env);
  if (path === "/api/auth/login" && req.method === "POST") return handleAuthLogin(req, env, ctx);
  if (path === "/api/auth/logout" && req.method === "POST") return handleAuthLogout(req);
  if (path === "/api/settings/webhooks" && req.method === "GET") return handleGetWebhookSettings(req, env, ctx);
  if (path === "/api/settings/webhooks" && req.method === "POST") return handleSaveWebhookSettings(req, env, ctx);
  if (path === "/api/settings/webhooks/test" && req.method === "POST") return handleTestWebhook(req, env, ctx);
  if (path === "/api/list" && req.method === "GET") return handleList(env, req, ctx);
  if (path === "/api/shorten" && req.method === "POST") return handleShorten(req, env, ctx);
  if (path === "/api/bulk-delete" && req.method === "POST") return handleBulkDelete(req, env, ctx);
  if (path === "/api/import" && req.method === "POST") return handleImport(req, env, ctx);
  if (path.startsWith("/api/analytics/") && req.method === "GET") {
    const slug = decodeSlugParam(path.slice("/api/analytics/".length));
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

  // Opt-in public read-only stats route
  if (path.startsWith("/stats/") && req.method === "GET") {
    const cleanRaw = path.slice("/stats/".length).replace(/\/+$/, "");
    const slug = decodeSlugParam(cleanRaw);
    if (!slug || !SLUG_RE.test(slug)) return err("Invalid slug", 400);
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
}
