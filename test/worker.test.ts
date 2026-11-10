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

function makeEnv(adminToken = "test-secret-token"): Env {
  return {
    URL_KV: new MockKVNamespace() as unknown as KVNamespace,
    ADMIN_TOKEN: adminToken,
  };
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
    expect(swText).toContain("tinylink-shell-v1");

    const manifest = await worker.fetch!(makeRequest("/manifest.webmanifest"), env, ctx);
    expect(manifest.status).toBe(200);
    const manifestJson = (await manifest.json()) as { share_target: { enctype: string } };
    expect(manifestJson.share_target.enctype).toBe("application/x-www-form-urlencoded");
  });

  it("enforces reserved slugs, labels/tags, dedupe, and huge UTM URL KV metadata safety", async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();
    const headers = { "Content-Type": "application/json", "X-Auth-Token": "test-secret-token" };

    for (const slug of ["stats", "sw.js", "api"]) {
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

  it("compiles all rendered inline HTML scripts without JS syntax errors", async () => {
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
      const html = await res.text();
      const matches = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        const scriptBody = m[1];
        expect(() => new Function(scriptBody)).not.toThrow();
      }
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
    const saveJson = (await saveRes.json()) as { ok: boolean; config: { url: string; enabled: boolean } };
    expect(saveJson.ok).toBe(true);
    expect(saveJson.config.url).toBe("https://webhook.site/test-endpoint");
    expect(saveJson.config.enabled).toBe(true);

    // Mock global fetch to test webhook dispatch
    const originalFetch = globalThis.fetch;
    const dispatchedRequests: { url: string; headers: Record<string, string>; body: string }[] = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : (input as Request).url;
      if (urlStr.includes("webhook.site")) {
        const bodyStr = typeof init?.body === "string" ? init.body : "";
        const hdrObj: Record<string, string> = {};
        if (init?.headers) {
          const h = new Headers(init.headers as HeadersInit);
          h.forEach((v, k) => {
            hdrObj[k] = v;
          });
        }
        dispatchedRequests.push({ url: urlStr, headers: hdrObj, body: bodyStr });
        return new Response(JSON.stringify({ ok: true }), { status: 200, statusText: "OK" });
      }
      return originalFetch(input, init);
    };

    try {
      // Test ping
      const pingRes = await worker.fetch!(
        makeRequest("/api/settings/webhooks/test", { method: "POST", headers }),
        env,
        ctx
      );
      expect(pingRes.status).toBe(200);
      const pingJson = (await pingRes.json()) as { ok: boolean; status: number };
      expect(pingJson.ok).toBe(true);
      expect(dispatchedRequests.length).toBe(1);
      expect(dispatchedRequests[0].headers["x-tinylink-event"]).toBe("test.ping");
      expect(dispatchedRequests[0].headers["x-tinylink-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);

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

      expect(dispatchedRequests.length).toBe(2);
      expect(dispatchedRequests[1].headers["x-tinylink-event"]).toBe("link.clicked");
      const clickedPayload = JSON.parse(dispatchedRequests[1].body);
      expect(clickedPayload.link.slug).toBe("hook-test");
      expect(clickedPayload.visitor.country).toBe("DE");
      expect(clickedPayload.visitor.referrer).toBe("twitter.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
