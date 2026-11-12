import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

interface StoredEntry {
  value: string;
  metadata?: unknown;
  expiresAt?: number;
}

class MockKVNamespace {
  public store = new Map<string, StoredEntry>();

  private getValid(key: string): StoredEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.getValid(key);
    return entry ? entry.value : null;
  }

  async put(
    key: string,
    value: string,
    options?: { metadata?: unknown; expirationTtl?: number }
  ): Promise<void> {
    if (options?.metadata !== undefined) {
      const metaBytes = new TextEncoder().encode(JSON.stringify(options.metadata)).length;
      if (metaBytes > 1024) {
        throw new Error(`KV metadata size ${metaBytes} exceeded 1024 byte limit`);
      }
    }
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, metadata: options?.metadata, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string; cursor?: string; limit?: number }) {
    const prefix = options?.prefix || "";
    const keys = Array.from(this.store.keys())
      .filter((k) => {
        if (!k.startsWith(prefix)) return false;
        return this.getValid(k) !== null;
      })
      .sort();

    const startIdx = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const pageSize = options?.limit ?? 5; // Small page size to always exercise cursor pagination
    const slice = keys.slice(startIdx, startIdx + pageSize);
    const nextIdx = startIdx + slice.length;
    const list_complete = nextIdx >= keys.length;

    return {
      keys: slice.map((name) => ({
        name,
        metadata: this.store.get(name)?.metadata,
      })),
      list_complete,
      cursor: list_complete ? "" : String(nextIdx),
    };
  }
}

function makeCtx(): { ctx: ExecutionContext; flush: () => Promise<void> } {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(p: Promise<unknown>) {
      pending.push(p);
    },
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  return {
    ctx,
    flush: async () => {
      await Promise.all(pending.splice(0, pending.length));
    },
  };
}

function makeEnv(overrides?: string | Partial<Env>): Env {
  const base: Env = {
    URL_KV: new MockKVNamespace() as unknown as KVNamespace,
    ADMIN_TOKEN: "test-secret-token",
  };
  if (typeof overrides === "string") {
    return { ...base, ADMIN_TOKEN: overrides };
  }
  if (overrides) {
    return { ...base, ...overrides };
  }
  return base;
}

function makeRequest(
  path: string,
  init: RequestInit & { cf?: { country?: string } } = {}
): Request {
  const req = new Request(`https://tl.example.com${path}`, init);
  if (init.cf) {
    Object.defineProperty(req, "cf", { value: init.cf });
  }
  return req;
}

describe("TinyLink Worker", () => {
  it("serves PWA assets, service worker, robots, and health", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();

    const health = await worker.fetch!(makeRequest("/api/health"), env, ctx);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      ok: true,
      authRequired: true,
      service: "tinylink",
    });

    const sw = await worker.fetch!(makeRequest("/sw.js"), env, ctx);
    expect(sw.status).toBe(200);
    expect(sw.headers.get("Content-Type")).toContain("javascript");
    const swText = await sw.text();
    expect(swText).toContain("tinylink-shell-v2");

    const manifest = await worker.fetch!(makeRequest("/manifest.webmanifest"), env, ctx);
    expect(manifest.status).toBe(200);
    const manifestJson = (await manifest.json()) as { share_target: { enctype: string } };
    expect(manifestJson.share_target.enctype).toBe("application/x-www-form-urlencoded");
  });

  it("enforces reserved slugs, labels/tags, dedupe, and huge UTM URL KV metadata safety", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    for (const slug of ["stats", "sw.js", "api", "assets"]) {
      const bad = await worker.fetch!(
        makeRequest("/api/shorten", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: "https://example.com", custom: slug }),
        }),
        env,
        ctx
      );
      expect(bad.status).toBe(400);
      expect((await bad.json() as { error: string }).error).toContain("reserved");
    }

    const hugeUrl = "https://example.com/path?" + "utm_param=".padEnd(1100, "x");
    const createRes = await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: hugeUrl,
          custom: "campaign1",
          label: "Campaign Link",
          tags: ["Marketing", "Q4", "marketing", "bad tag!"],
        }),
      }),
      env,
      ctx
    );
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as { label: string; tags: string[] };
    expect(created.label).toBe("Campaign Link");
    expect(created.tags).toEqual(["marketing", "q4", "badtag"]);

    // Dedupe option returns existing active slug
    const dedupeRes = await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: hugeUrl, dedupe: true }),
      }),
      env,
      ctx
    );
    const deduped = (await dedupeRes.json()) as { slug: string; deduplicated: boolean };
    expect(deduped.slug).toBe("campaign1");
    expect(deduped.deduplicated).toBe(true);

    // Cursor-paginated list picks up huge-URL fallback entries cleanly
    const listRes = await worker.fetch!(
      makeRequest("/api/list", { headers: { "X-Auth-Token": "test-secret-token" } }),
      env,
      ctx
    );
    const listJson = (await listRes.json()) as { urls: { slug: string; label: string }[] };
    expect(listJson.urls.length).toBe(1);
    expect(listJson.urls[0].slug).toBe("campaign1");
    expect(listJson.urls[0].label).toBe("Campaign Link");
  });

  it("enforces burn-after-read maxClicks and shields against preview bots", async () => {
    const env = makeEnv();
    const { ctx, flush } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.org/secret-invite",
          custom: "once",
          maxClicks: 1,
          ogTitle: "Private Invite",
          ogDescription: "Open once",
        }),
      }),
      env,
      ctx
    );

    // WhatsApp/Slack unfurl bot should get OG preview HTML without burning the link
    const botHit = await worker.fetch!(
      makeRequest("/once", {
        headers: { "User-Agent": "WhatsApp/2.23.20 A" },
      }),
      env,
      ctx
    );
    expect(botHit.status).toBe(200);
    const botHtml = await botHit.text();
    expect(botHtml).toContain("Private Invite");
    await flush();

    // Real user click consumes the 1 allowed click and redirects
    const firstHuman = await worker.fetch!(
      makeRequest("/once", {
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://news.ycombinator.com/item" },
        cf: { country: "IN" },
      }),
      env,
      ctx
    );
    expect(firstHuman.status).toBe(302);
    expect(firstHuman.headers.get("Location")).toBe("https://example.org/secret-invite");

    // Second click gets 410 Click Limit Reached
    const secondHuman = await worker.fetch!(
      makeRequest("/once", { headers: { "User-Agent": "Mozilla/5.0" } }),
      env,
      ctx
    );
    expect(secondHuman.status).toBe(410);
    expect(await secondHuman.text()).toContain("Link Limit Reached");

    const analyticsRes = await worker.fetch!(
      makeRequest("/api/analytics/once", { headers: { "X-Auth-Token": "test-secret-token" } }),
      env,
      ctx
    );
    const analytics = (await analyticsRes.json()) as {
      clicks: number;
      botClicks: number;
      countries: Record<string, number>;
      referrers: Record<string, number>;
      isExhausted: boolean;
    };
    expect(analytics.clicks).toBe(1);
    expect(analytics.botClicks).toBe(1);
    expect(analytics.countries.IN).toBe(1);
    expect(analytics.referrers["news.ycombinator.com"]).toBe(1);
    expect(analytics.isExhausted).toBe(true);
  });

  it("supports password-protected links, unlock form, and public stats masking", async () => {
    const env = makeEnv();
    const { ctx, flush } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://secret.example.com/doc",
          custom: "vault-doc",
          password: "open-sesame",
          publicStats: true,
        }),
      }),
      env,
      ctx
    );

    // GET renders password prompt rather than redirecting
    const gate = await worker.fetch!(makeRequest("/vault-doc"), env, ctx);
    expect(gate.status).toBe(200);
    expect(await gate.text()).toContain("Protected Link");

    // Wrong password returns 401
    const wrong = await worker.fetch!(
      makeRequest("/vault-doc", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "password=nope",
      }),
      env,
      ctx
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toContain("Incorrect password");

    // Right password returns 303 redirect and tracks click
    const right = await worker.fetch!(
      makeRequest("/vault-doc", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "password=open-sesame",
        cf: { country: "US" },
      }),
      env,
      ctx
    );
    expect(right.status).toBe(303);
    expect(right.headers.get("Location")).toBe("https://secret.example.com/doc");
    await flush();

    // Public stats page hides protected destination URL while showing telemetry
    const statsRes = await worker.fetch!(makeRequest("/stats/vault-doc"), env, ctx);
    expect(statsRes.status).toBe(200);
    const statsHtml = await statsRes.text();
    expect(statsHtml).toContain("Protected destination");
    expect(statsHtml).not.toContain("https://secret.example.com/doc");

    // Clear password via PUT unlocks direct 302 redirect
    await worker.fetch!(
      makeRequest("/api/urls/vault-doc", {
        method: "PUT",
        headers,
        body: JSON.stringify({ clearPassword: true }),
      }),
      env,
      ctx
    );
    const direct = await worker.fetch!(makeRequest("/vault-doc"), env, ctx);
    expect(direct.status).toBe(302);
  });

  it("serves external static scripts cleanly with strict non-inline CSP", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.org/script-check",
          custom: "script-doc",
          password: "secret",
          publicStats: true,
        }),
      }),
      env,
      ctx
    );

    const pages = [
      await worker.fetch!(makeRequest("/"), env, ctx),
      await worker.fetch!(makeRequest("/script-doc"), env, ctx),
      await worker.fetch!(makeRequest("/stats/script-doc"), env, ctx),
    ];

    for (const res of pages) {
      expect(res.status).toBe(200);
      const csp = res.headers.get("Content-Security-Policy") || "";
      expect(csp).toMatch(/(?:^|;\s*)script-src 'self'(?:;|$)/);
      const html = await res.text();
      const matches = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
      for (const m of matches) {
        expect(m[1].trim()).toBe("");
      }
    }

    for (const assetPath of ["/assets/theme.js", "/assets/app.js", "/assets/unlock.js"]) {
      const assetRes = await worker.fetch!(makeRequest(assetPath), env, ctx);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get("Content-Type")).toContain("javascript");
      const jsBody = await assetRes.text();
      expect(jsBody.length).toBeGreaterThan(20);
      expect(() => new Function(jsBody)).not.toThrow();
    }
  });

  it("updates link metadata via PUT and gates /stats/:slug by publicStats", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.org/initial",
          custom: "editable",
        }),
      }),
      env,
      ctx
    );

    const privateStats = await worker.fetch!(makeRequest("/stats/editable"), env, ctx);
    expect(privateStats.status).toBe(404);

    const putRes = await worker.fetch!(
      makeRequest("/api/urls/editable", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          url: "https://example.org/updated",
          label: "Updated Note",
          tags: "ops, release",
          maxClicks: 25,
          ogTitle: "Release Notes",
          ogDescription: "v3 changelog",
          publicStats: true,
        }),
      }),
      env,
      ctx
    );
    expect(putRes.status).toBe(200);

    const analyticsRes = await worker.fetch!(
      makeRequest("/api/analytics/editable", { headers }),
      env,
      ctx
    );
    const analytics = (await analyticsRes.json()) as {
      originalUrl: string;
      label: string;
      tags: string[];
      maxClicks: number;
      ogTitle: string;
      ogDescription: string;
      publicStats: boolean;
    };
    expect(analytics.originalUrl).toBe("https://example.org/updated");
    expect(analytics.label).toBe("Updated Note");
    expect(analytics.tags).toEqual(["ops", "release"]);
    expect(analytics.maxClicks).toBe(25);
    expect(analytics.ogTitle).toBe("Release Notes");
    expect(analytics.ogDescription).toBe("v3 changelog");
    expect(analytics.publicStats).toBe(true);

    const publicStats = await worker.fetch!(makeRequest("/stats/editable"), env, ctx);
    expect(publicStats.status).toBe(200);
    expect(await publicStats.text()).toContain("Updated Note");
  });

  it("rate limits repeated failed admin auth attempts with 429", async () => {
    const env = makeEnv("real-secret");
    const { ctx } = makeCtx();

    for (let i = 0; i < 10; i++) {
      const res = await worker.fetch!(
        makeRequest("/api/list", {
          headers: { "X-Auth-Token": "wrong", "CF-Connecting-IP": "203.0.113.99" },
        }),
        env,
        ctx
      );
      expect(res.status).toBe(401);
    }

    // 11th request from same IP hits 429 even if wrong/right before window expires
    const locked = await worker.fetch!(
      makeRequest("/api/list", {
        headers: { "X-Auth-Token": "wrong", "CF-Connecting-IP": "203.0.113.99" },
      }),
      env,
      ctx
    );
    expect(locked.status).toBe(429);
    expect(locked.headers.get("Retry-After")).toBeTruthy();

    // Different IP still authenticates normally
    const ok = await worker.fetch!(
      makeRequest("/api/list", {
        headers: { "X-Auth-Token": "real-secret", "CF-Connecting-IP": "203.0.113.100" },
      }),
      env,
      ctx
    );
    expect(ok.status).toBe(200);
  });

  it("supports JSON import (skip/overwrite) and bulk delete", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    const imp1 = await worker.fetch!(
      makeRequest("/api/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "skip",
          links: [
            { slug: "a1", originalUrl: "https://example.com/1", tags: ["one"], clicks: 4 },
            { slug: "a2", originalUrl: "https://example.com/2" },
            { slug: "api", originalUrl: "https://example.com/bad-slug" },
            { slug: "local", originalUrl: "http://localhost:3000" },
          ],
        }),
      }),
      env,
      ctx
    );
    expect(imp1.status).toBe(200);
    const imp1Json = (await imp1.json()) as { imported: number; skipped: number; errors: string[] };
    expect(imp1Json.imported).toBe(2);
    expect(imp1Json.skipped).toBe(0);
    expect(imp1Json.errors.length).toBe(2);

    // Skip mode skips existing 'a1'
    const imp2 = await worker.fetch!(
      makeRequest("/api/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "skip",
          links: [{ slug: "a1", originalUrl: "https://example.com/new" }],
        }),
      }),
      env,
      ctx
    );
    const imp2Json = (await imp2.json()) as { imported: number; skipped: number };
    expect(imp2Json.imported).toBe(0);
    expect(imp2Json.skipped).toBe(1);

    // Bulk delete removes a1 and a2
    const bulkDel = await worker.fetch!(
      makeRequest("/api/bulk-delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ slugs: ["a1", "a2"] }),
      }),
      env,
      ctx
    );
    expect(bulkDel.status).toBe(200);
    expect((await bulkDel.json()) as { count: number }).toEqual({
      deleted: ["a1", "a2"],
      count: 2,
    });
  });

  it("supports smart routing: geotargeting and device targeting overrides", async () => {
    const env = makeEnv();
    const { ctx, flush } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    const res = await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.com/default",
          custom: "smart-link",
          geoRoutes: {
            IN: "https://example.com/india",
            GB: "https://example.com/uk",
          },
          deviceRoutes: {
            ios: "https://apps.apple.com/app/tinylink",
            android: "https://play.google.com/store/apps/tinylink",
          },
        }),
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);

    // 1. Visitor with iOS user agent -> routed to iOS target
    const iosHit = await worker.fetch!(
      makeRequest("/smart-link", {
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" },
      }),
      env,
      ctx
    );
    expect(iosHit.status).toBe(302);
    expect(iosHit.headers.get("Location")?.replace(/\/$/, "")).toBe("https://apps.apple.com/app/tinylink");

    // 2. Visitor with Android user agent -> routed to Android target
    const androidHit = await worker.fetch!(
      makeRequest("/smart-link", {
        headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7)" },
      }),
      env,
      ctx
    );
    expect(androidHit.status).toBe(302);
    expect(androidHit.headers.get("Location")?.replace(/\/$/, "")).toBe("https://play.google.com/store/apps/tinylink");

    // 3. Desktop visitor from India -> routed to India geo target
    const indiaHit = await worker.fetch!(
      makeRequest("/smart-link", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cf: { country: "IN" },
      }),
      env,
      ctx
    );
    expect(indiaHit.status).toBe(302);
    expect(indiaHit.headers.get("Location")?.replace(/\/$/, "")).toBe("https://example.com/india");

    // 4. Desktop visitor from US -> falls back to default originalUrl
    const usHit = await worker.fetch!(
      makeRequest("/smart-link", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cf: { country: "US" },
      }),
      env,
      ctx
    );
    expect(usHit.status).toBe(302);
    expect(usHit.headers.get("Location")?.replace(/\/$/, "")).toBe("https://example.com/default");

    await flush();
  });

  it("handles activation schedules: pending links render 425 page or redirect to fallbackUrl", async () => {
    const env = makeEnv();
    const { ctx, flush } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    const futureDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // 1. Scheduled link without fallback -> renders HTTP 425 Not Active Yet page
    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.com/secret-launch",
          custom: "future-launch",
          startsAt: futureDate,
        }),
      }),
      env,
      ctx
    );

    const hitPending = await worker.fetch!(makeRequest("/future-launch"), env, ctx);
    expect(hitPending.status).toBe(425);
    const html425 = await hitPending.text();
    expect(html425).toContain("425 · Not Active Yet");
    expect(html425).toContain("scheduled to activate");

    // 2. Scheduled link with fallbackUrl -> redirects to fallbackUrl
    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.com/secret-launch",
          custom: "future-with-fallback",
          startsAt: futureDate,
          fallbackUrl: "https://example.com/coming-soon",
        }),
      }),
      env,
      ctx
    );

    const hitFallback = await worker.fetch!(makeRequest("/future-with-fallback"), env, ctx);
    expect(hitFallback.status).toBe(302);
    expect(hitFallback.headers.get("Location")?.replace(/\/$/, "")).toBe("https://example.com/coming-soon");

    // 3. Updating schedule via PUT /api/urls/:slug
    const updateRes = await worker.fetch!(
      makeRequest("/api/urls/future-launch", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          startsAt: null, // activate immediately
        }),
      }),
      env,
      ctx
    );
    expect(updateRes.status).toBe(200);

    const hitNowActive = await worker.fetch!(makeRequest("/future-launch"), env, ctx);
    expect(hitNowActive.status).toBe(302);
    expect(hitNowActive.headers.get("Location")?.replace(/\/$/, "")).toBe("https://example.com/secret-launch");

    await flush();
  });

  it("manages webhook configurations, tests connectivity, and fires events", async () => {
    const env = makeEnv();
    const { ctx, flush } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    // Initially no webhook configured
    const getInitial = await worker.fetch!(makeRequest("/api/settings/webhooks", { headers }), env, ctx);
    expect(getInitial.status).toBe(200);
    expect((await getInitial.json()) as { config: unknown }).toEqual({ config: null });

    // Save webhook config
    const saveRes = await worker.fetch!(
      makeRequest("/api/settings/webhooks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://webhook.site/test-endpoint",
          secret: "super-secret-hmac-key",
          events: { onClicked: true, onLimitReached: true, onExpired: true },
          enabled: true,
        }),
      }),
      env,
      ctx
    );
    expect(saveRes.status).toBe(200);
    const saveJson = (await saveRes.json()) as {
      ok: boolean;
      config: { url: string; enabled: boolean; hasSecret: boolean; secret?: string };
    };
    expect(saveJson.ok).toBe(true);
    expect(saveJson.config.url).toBe("https://webhook.site/test-endpoint");
    expect(saveJson.config.enabled).toBe(true);
    expect(saveJson.config.hasSecret).toBe(true);
    expect(saveJson.config.secret).toBeUndefined();

    const getMasked = await worker.fetch!(makeRequest("/api/settings/webhooks", { headers }), env, ctx);
    const maskedJson = (await getMasked.json()) as { config: { hasSecret: boolean; secret?: string } };
    expect(maskedJson.config.hasSecret).toBe(true);
    expect(maskedJson.config.secret).toBeUndefined();

    // Preserves secret when omitted, and clears secret when clearSecret is true
    const keepRes = await worker.fetch!(
      makeRequest("/api/settings/webhooks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://webhook.site/test-endpoint",
          events: { onClicked: true, onLimitReached: true, onExpired: true },
          enabled: true,
        }),
      }),
      env,
      ctx
    );
    expect((await keepRes.json() as { config: { hasSecret: boolean } }).config.hasSecret).toBe(true);

    // Mock global fetch to test webhook dispatch
    const originalFetch = globalThis.fetch;
    const dispatchedRequests: { url: string; headers: Record<string, string>; body: string; redirect?: string }[] = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : (input as Request).url;
      if (urlStr.includes("webhook.site") || urlStr.includes("evil-discord.com")) {
        const bodyStr = typeof init?.body === "string" ? init.body : "";
        const hdrObj: Record<string, string> = {};
        if (init?.headers) {
          const h = new Headers(init.headers as HeadersInit);
          h.forEach((v, k) => {
            hdrObj[k] = v;
          });
        }
        dispatchedRequests.push({ url: urlStr, headers: hdrObj, body: bodyStr, redirect: init?.redirect });
        if (urlStr.includes("redirect-trap")) {
          return new Response(null, { status: 302, statusText: "Found" });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, statusText: "OK" });
      }
      return originalFetch(input, init);
    };

    try {
      // Test ping using saved webhook & saved secret
      const pingRes = await worker.fetch!(
        makeRequest("/api/settings/webhooks/test", { method: "POST", headers }),
        env,
        ctx
      );
      expect(pingRes.status).toBe(200);
      const pingJson = (await pingRes.json()) as { ok: boolean; status: number };
      expect(pingJson.ok).toBe(true);
      expect(dispatchedRequests.length).toBe(1);
      expect(dispatchedRequests[0].redirect).toBe("manual");
      expect(dispatchedRequests[0].headers["x-tinylink-event"]).toBe("test.ping");
      expect(dispatchedRequests[0].headers["x-tinylink-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);

      // Ad-hoc test URL must NOT leak the previously stored secret, and spoofed host does not get Discord format
      await worker.fetch!(
        makeRequest("/api/settings/webhooks/test", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: "https://evil-discord.com/api/webhooks/123" }),
        }),
        env,
        ctx
      );
      expect(dispatchedRequests.length).toBe(2);
      expect(dispatchedRequests[1].headers["x-tinylink-event"]).toBe("test.ping");
      expect(dispatchedRequests[1].headers["x-tinylink-signature"]).toBeUndefined();

      // Redirect response from webhook endpoint is rejected
      const redirRes = await worker.fetch!(
        makeRequest("/api/settings/webhooks/test", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: "https://webhook.site/redirect-trap" }),
        }),
        env,
        ctx
      );
      const redirJson = (await redirRes.json()) as { ok: boolean; statusText: string };
      expect(redirJson.ok).toBe(false);
      expect(redirJson.statusText).toBe("Redirect Blocked");

      // Shorten link and click it to trigger link.clicked webhook
      await worker.fetch!(
        makeRequest("/api/shorten", {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: "https://example.com/webhook-tracked",
            custom: "hook-test",
          }),
        }),
        env,
        ctx
      );

      await worker.fetch!(
        makeRequest("/hook-test", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://twitter.com" },
          cf: { country: "DE" },
        }),
        env,
        ctx
      );

      await flush();

      expect(dispatchedRequests.length).toBe(4);
      expect(dispatchedRequests[3].headers["x-tinylink-event"]).toBe("link.clicked");
      const clickedPayload = JSON.parse(dispatchedRequests[3].body);
      expect(clickedPayload.link.slug).toBe("hook-test");
      expect(clickedPayload.visitor.country).toBe("DE");
      expect(clickedPayload.visitor.referrer).toBe("twitter.com");

      // Clear secret explicitly
      const clearRes = await worker.fetch!(
        makeRequest("/api/settings/webhooks", {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: "https://webhook.site/test-endpoint",
            clearSecret: true,
            enabled: true,
          }),
        }),
        env,
        ctx
      );
      expect((await clearRes.json() as { config: { hasSecret: boolean } }).config.hasSecret).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("enforces fail-closed auth, cookie sessions, removes ?token=, and prevents cross-site CSRF", async () => {
    const envUnset = makeEnv({ ADMIN_TOKEN: undefined });
    const { ctx } = makeCtx();

    // Fail closed when ADMIN_TOKEN is unset without ALLOW_PUBLIC_ADMIN=true
    const lockedRes = await worker.fetch!(makeRequest("/api/list"), envUnset, ctx);
    expect(lockedRes.status).toBe(503);

    const sessionUnset = await worker.fetch!(makeRequest("/api/auth/session"), envUnset, ctx);
    expect(sessionUnset.status).toBe(503);

    // Explicit opt-in public admin mode works when enabled
    const envPublic = makeEnv({ ADMIN_TOKEN: undefined, ALLOW_PUBLIC_ADMIN: "true" });
    const publicList = await worker.fetch!(makeRequest("/api/list"), envPublic, ctx);
    expect(publicList.status).toBe(200);

    // Query parameter ?token= is rejected
    const env = makeEnv();
    const qsAuth = await worker.fetch!(makeRequest("/api/list?token=test-secret-token"), env, ctx);
    expect(qsAuth.status).toBe(401);

    // GET /api/auth/session without credentials does not fail-limit or authenticate
    const noSess = await worker.fetch!(makeRequest("/api/auth/session"), env, ctx);
    expect(noSess.status).toBe(200);
    expect(await noSess.json()).toEqual({ authRequired: true, authenticated: false, configured: true });

    // POST /api/auth/login mints HttpOnly SameSite=Strict Secure cookie
    const badLogin = await worker.fetch!(
      makeRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "wrong" }),
      }),
      env,
      ctx
    );
    expect(badLogin.status).toBe(401);

    const goodLogin = await worker.fetch!(
      makeRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://tl.example.com" },
        body: JSON.stringify({ token: "test-secret-token" }),
      }),
      env,
      ctx
    );
    expect(goodLogin.status).toBe(200);
    const setCookie = goodLogin.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain("tl_session=v1.");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api");
    expect(setCookie).toContain("Secure");

    const cookiePair = setCookie.split(";")[0];

    // Cookie grants access to /api/auth/session and protected routes
    const authedSess = await worker.fetch!(
      makeRequest("/api/auth/session", { headers: { Cookie: cookiePair } }),
      env,
      ctx
    );
    expect(await authedSess.json()).toEqual({ authRequired: true, authenticated: true, configured: true });

    const authedList = await worker.fetch!(
      makeRequest("/api/list", { headers: { Cookie: cookiePair } }),
      env,
      ctx
    );
    expect(authedList.status).toBe(200);

    // Tampered signature rejected
    const forgedCookie = cookiePair.slice(0, -2) + (cookiePair.endsWith("AA") ? "BB" : "AA");
    const forgedRes = await worker.fetch!(
      makeRequest("/api/list", { headers: { Cookie: forgedCookie } }),
      env,
      ctx
    );
    expect(forgedRes.status).toBe(401);

    // Cross-origin CSRF blocked even with valid cookie
    const csrfOriginBlock = await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookiePair,
          Origin: "https://evil.example",
        },
        body: JSON.stringify({ url: "https://example.org" }),
      }),
      env,
      ctx
    );
    expect(csrfOriginBlock.status).toBe(403);

    const csrfFetchSiteBlock = await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookiePair,
          "Sec-Fetch-Site": "cross-site",
        },
        body: JSON.stringify({ url: "https://example.org" }),
      }),
      env,
      ctx
    );
    expect(csrfFetchSiteBlock.status).toBe(403);

    // CORS omits wildcard and rejects unknown Origin preflights
    const healthRes = await worker.fetch!(makeRequest("/api/health"), env, ctx);
    expect(healthRes.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const evilOptions = await worker.fetch!(
      makeRequest("/api/shorten", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }),
      env,
      ctx
    );
    expect(evilOptions.status).toBe(403);
    expect(evilOptions.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const sameOptions = await worker.fetch!(
      makeRequest("/api/shorten", { method: "OPTIONS", headers: { Origin: "https://tl.example.com" } }),
      env,
      ctx
    );
    expect(sameOptions.status).toBe(204);
    expect(sameOptions.headers.get("Access-Control-Allow-Origin")).toBe("https://tl.example.com");

    // Forged X-Forwarded-For does not bypass CF-Connecting-IP rate-limit bucket
    for (let i = 0; i < 10; i++) {
      await worker.fetch!(
        makeRequest("/api/list", {
          headers: { "CF-Connecting-IP": "198.51.100.77", "X-Forwarded-For": `10.0.0.${i}`, "X-Auth-Token": "bad" },
        }),
        env,
        ctx
      );
    }
    const blockedIp = await worker.fetch!(
      makeRequest("/api/list", {
        headers: { "CF-Connecting-IP": "198.51.100.77", "X-Forwarded-For": "203.0.113.99", "X-Auth-Token": "bad" },
      }),
      env,
      ctx
    );
    expect(blockedIp.status).toBe(429);

    // Logout expires session cookie
    const logoutRes = await worker.fetch!(
      makeRequest("/api/auth/logout", { method: "POST", headers: { Cookie: cookiePair } }),
      env,
      ctx
    );
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("blocks SSRF targets, credentials in URLs, private IPs, oversized bodies, and invalid slugs", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    const badUrls = [
      "http://127.0.0.1/admin",
      "http://localhost:8787/",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.1/internal",
      "http://172.16.0.10/db",
      "http://192.168.1.1/router",
      "http://100.64.0.1/cgnat",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://[fd00:ec2::254]/latest/meta-data/",
      "http://0x7f000001/",
      "http://2130706433/",
      "http://metadata/",
      "https://user:pass@example.com/",
      "https://tl.example.com/self-loop",
      "javascript:alert(1)",
      `https://example.com/${"a".repeat(4100)}`,
    ];

    for (const badUrl of badUrls) {
      const res = await worker.fetch!(
        makeRequest("/api/shorten", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: badUrl }),
        }),
        env,
        ctx
      );
      expect(res.status, `Expected 400 for URL: ${badUrl}`).toBe(400);
    }

    // Also validate webhook URLs block insecure HTTP and metadata endpoints
    for (const badWebhook of ["http://webhook.site/plain", "https://169.254.169.254/hook", "https://[::1]/hook"]) {
      const res = await worker.fetch!(
        makeRequest("/api/settings/webhooks", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: badWebhook, enabled: true }),
        }),
        env,
        ctx
      );
      expect(res.status, `Expected 400 for webhook: ${badWebhook}`).toBe(400);
    }

    // Body size limit returns 413
    const hugeRes = await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "https://example.org", label: "x".repeat(140_000) }),
      }),
      env,
      ctx
    );
    expect(hugeRes.status).toBe(413);

    // Invalid slugs rejected cleanly before KV lookup
    const badDelete = await worker.fetch!(
      makeRequest("/api/urls/settings:webhooks", { method: "DELETE", headers }),
      env,
      ctx
    );
    expect(badDelete.status).toBe(400);
  });

  it("uses PBKDF2 v2 hashing, upgrades legacy v1 hashes, rate limits unlock attempts, and bounds analytics keys", async () => {
    const env = makeEnv();
    const { ctx, flush } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    // 1. Newly created password link uses v2:100000: PBKDF2 hash
    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "https://example.org/v2-doc", custom: "v2-lock", password: "correct-horse" }),
      }),
      env,
      ctx
    );
    const storedV2 = JSON.parse((await env.URL_KV.get("u:v2-lock")) || "{}") as { passwordHash: string };
    expect(storedV2.passwordHash).toMatch(/^v2:100000:[0-9a-f]{32}:[0-9a-f]{64}$/);

    // 2. Repeated wrong passwords lock out with 429 on attempt 11
    for (let i = 0; i < 10; i++) {
      const fail = await worker.fetch!(
        makeRequest("/v2-lock", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "CF-Connecting-IP": "198.51.100.44",
          },
          body: "password=wrong",
        }),
        env,
        ctx
      );
      expect(fail.status).toBe(401);
    }

    const lockedOut = await worker.fetch!(
      makeRequest("/v2-lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "CF-Connecting-IP": "198.51.100.44",
        },
        body: "password=correct-horse",
      }),
      env,
      ctx
    );
    expect(lockedOut.status).toBe(429);

    // 3. Seed legacy v1 hash and verify backward-compat unlock + opportunistic upgrade to v2
    const salt = "0123456789abcdef0123456789abcdef";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:legacy-pass`));
    const hexDigest = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await env.URL_KV.put(
      "u:legacy-v1",
      JSON.stringify({
        originalUrl: "https://example.org/legacy",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        clicks: 0,
        clickTimeline: [],
        referrers: {},
        devices: {},
        countries: {},
        passwordHash: `v1:${salt}:${hexDigest}`,
      })
    );

    const legacyUnlock = await worker.fetch!(
      makeRequest("/legacy-v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "CF-Connecting-IP": "198.51.100.45",
        },
        body: "password=legacy-pass",
      }),
      env,
      ctx
    );
    await flush();
    expect(legacyUnlock.status).toBe(303);
    const upgraded = JSON.parse((await env.URL_KV.get("u:legacy-v1")) || "{}") as { passwordHash: string };
    expect(upgraded.passwordHash).toMatch(/^v2:100000:/);

    // 4. Analytics cardinality cap keeps distinct referrers <= 100 while preserving total click count
    await worker.fetch!(
      makeRequest("/api/shorten", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "https://example.org/many-refs", custom: "capped-refs" }),
      }),
      env,
      ctx
    );
    for (let i = 0; i < 110; i++) {
      await worker.fetch!(
        makeRequest("/capped-refs", {
          headers: { Referer: `https://ref${i}.example.com/page` },
        }),
        env,
        ctx
      );
    }
    await flush();

    const cappedAnalytics = await worker.fetch!(makeRequest("/api/analytics/capped-refs", { headers }), env, ctx);
    const cappedJson = (await cappedAnalytics.json()) as {
      clicks: number;
      referrers: Record<string, number>;
    };
    expect(cappedJson.clicks).toBe(110);
    expect(Object.keys(cappedJson.referrers).length).toBeLessThanOrEqual(100);
    expect(cappedJson.referrers.other).toBeGreaterThan(0);
  });
});
