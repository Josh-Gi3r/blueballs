import { BANK_OPENAPI_YAML } from "./openapi.generated.js";
import { canonicalRedirectUrl } from "./canonical-url.js";
import {
  crawlerDocument,
  llmsText,
  pageMetadata,
  robotsText,
  sitemapXml,
} from "./crawler-pages.js";
import {
  handleGrowthEvent,
  logServerGrowthEvent,
} from "./growth-events.js";
import { runtimeForPath } from "../../spec/runtime-ownership.mjs";
import { getAgentByName } from "agents";
export { NeobankBuilder } from "./neobank-builder.js";
export { BuilderBudget } from "./builder-budget.js";

const SOCIAL_IMAGE =
  "https://blueballs.tech/city/front-cover/blueballs-front-cover-v1.png";
const sourceKey = (request) =>
  request.headers.get("cf-connecting-ip") || "unknown-source";
const escapeAttribute = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

async function withinLimit(binding, key) {
  if (!binding?.limit) return true;
  return (await binding.limit({ key })).success;
}

/** Every path the app actually routes. Anything else that asks for HTML gets a
 * 404 rather than the SPA fallback quietly serving the homepage under an
 * unrelated URL. */
const KNOWN_PAGES = new Set([
  "/",
  "/home",
  "/products",
  "/fx",
  "/cards",
  "/ecosystem",
  "/sandbox",
  "/developers",
  "/contact",
]);

function internalRequest(request, headers) {
  const next = new Headers(request.headers);
  next.delete("origin");
  for (const [name, value] of Object.entries(headers)) next.set(name, value);
  return new Request(request, { headers: next });
}

function builderGrowthEvent(request, pathname) {
  if (request.method !== "POST") return null;
  if (pathname === "/v2/builder/projects") return "builder_blueprint_created";
  if (/^\/v2\/builder\/projects\/[^/]+\/provision$/.test(pathname))
    return "builder_sandbox_provisioned";
  if (/^\/v2\/builder\/projects\/[^/]+\/test-payments$/.test(pathname))
    return "builder_test_payment";
  return null;
}

export default {
  async fetch(request, env) {
    const response = await handleRequest(request, env);
    const url = new URL(request.url);
    const headers = new Headers(response.headers);

    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    headers.set("x-frame-options", "SAMEORIGIN");
    headers.set(
      "x-blueballs-source-commit",
      env.BLUEBALLS_GIT_SHA || "development",
    );
    headers.set(
      "content-security-policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    );
    headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );

    if (url.pathname === "/v2" || url.pathname.startsWith("/v2/")) {
      headers.set("cache-control", "no-store");
      headers.set("vary", "x-api-key, authorization");
    }

    if (headers.get("content-type")?.includes("text/html")) {
      const cacheControl = headers.get("cache-control");
      headers.set(
        "cache-control",
        cacheControl ? `${cacheControl}, no-transform` : "no-transform",
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  const canonicalTarget = canonicalRedirectUrl(
    url,
    request.headers.get("host"),
    env.LOCAL_DEV === "true",
  );
  if (canonicalTarget) return Response.redirect(canonicalTarget, 301);

  if (url.pathname === "/robots.txt") {
    return new Response(robotsText(), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  if (url.pathname === "/sitemap.xml") {
    return new Response(sitemapXml(), {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  if (url.pathname === "/llms.txt" || url.pathname === "/llms-full.txt") {
    return new Response(llmsText(url.pathname === "/llms-full.txt"), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  if (url.pathname === "/bulletin") {
    return Response.redirect(new URL("/developers", url).toString(), 301);
  }

  if (url.pathname === "/api/events") {
    return handleGrowthEvent(request, env);
  }

  // Runtime ownership is defined once in spec/runtime-ownership.mjs. The edge
  // imports it directly instead of maintaining a second handwritten FX list.
  if (runtimeForPath(url.pathname) === "fx") {
    const target =
      url.pathname === "/fx-health"
        ? new Request(new URL("/health", url), request)
        : request;
    // Forward the caller's Authorization/x-api-key untouched. The edge must
    // never silently authenticate a caller with an operator credential.
    return env.FX.fetch(internalRequest(target, {}));
  }

  if (url.pathname === "/openapi.yaml") {
    return new Response(BANK_OPENAPI_YAML, {
      headers: {
        "content-type": "application/yaml; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  if (url.pathname === "/openapi.fx.yaml") {
    return env.FX.fetch(
      internalRequest(new Request(new URL("/openapi.yaml", url), request), {}),
    );
  }

  if (url.pathname === "/v2/builder-agent/chat") {
    if (env.BUILDER_AGENT_ENABLED === "false") {
      return Response.json(
        { error: "The Builder Agent is paused by the operator." },
        { status: 503 },
      );
    }
    if (
      !(await withinLimit(env.BUILDER_SOURCE_RATE_LIMITER, sourceKey(request)))
    ) {
      return Response.json(
        { error: "Too many Builder Agent requests from this source." },
        { status: 429, headers: { "retry-after": "60" } },
      );
    }
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey)
      return Response.json(
        { error: "A sandbox key is required." },
        { status: 401 },
      );

    // Authenticate the exact credential. The response's `current` object
    // identifies the key that authenticated this request; never infer tenancy
    // from an arbitrary row in the key list.
    const accessCheck = await env.API.fetch(
      internalRequest(
        new Request(new URL("/v2/keys", url), {
          method: "GET",
          headers: request.headers,
        }),
        {},
      ),
    );
    if (!accessCheck.ok)
      return new Response(accessCheck.body, {
        status: accessCheck.status,
        headers: accessCheck.headers,
      });
    const principal = await accessCheck.json();
    const tenantId = principal?.current?.tenant_id;
    if (!tenantId)
      return Response.json(
        { error: "The sandbox key has no active tenant." },
        { status: 401 },
      );
    if (!(await withinLimit(env.BUILDER_TENANT_RATE_LIMITER, tenantId))) {
      return Response.json(
        {
          error: "This sandbox is sending Builder Agent requests too quickly.",
        },
        { status: 429, headers: { "retry-after": "60" } },
      );
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(tenantId),
    );
    const instance = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
    const agent = await getAgentByName(env.NeobankBuilder, instance);
    return agent.fetch(request);
  }

  if (url.pathname === "/v2" || url.pathname.startsWith("/v2/")) {
    const response = await env.API.fetch(internalRequest(request, {}));
    const growthEvent = builderGrowthEvent(request, url.pathname);
    if (response.ok && growthEvent) {
      logServerGrowthEvent(request, env, growthEvent, {
        response_status: response.status,
      });
    }
    return response;
  }

  if (url.pathname === "/api/health") {
    const [bank, fx] = await Promise.all([
      env.API.fetch(new Request(new URL("/v2", url))),
      env.FX.fetch(internalRequest(new Request(new URL("/health", url)), {})),
    ]);
    const bankBody = bank.ok
      ? await bank
          .clone()
          .json()
          .catch(() => ({}))
      : {};
    const fxBody = fx.ok
      ? await fx
          .clone()
          .json()
          .catch(() => ({}))
      : {};
    const sourceCommit = env.BLUEBALLS_GIT_SHA || "development";
    const commits = [
      sourceCommit,
      bankBody.source_commit,
      fxBody.source_commit,
    ].filter(Boolean);
    return Response.json(
      {
        status: bank.ok && fx.ok ? "ok" : "degraded",
        site: "blueballs",
        source_commit: sourceCommit,
        deployment_consistent:
          commits.length === 3 && new Set(commits).size === 1,
        banking_api: bank.status,
        banking_source_commit: bankBody.source_commit ?? null,
        fx_api: fx.status,
        fx_source_commit: fxBody.source_commit ?? null,
      },
      { status: bank.ok && fx.ok ? 200 : 503 },
    );
  }

  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") || request.method === "HEAD")
    return assetResponse;

  const known = KNOWN_PAGES.has(url.pathname);
  const metadata = pageMetadata(url.pathname);
  const canonical = `https://blueballs.tech${url.pathname === "/" ? "" : url.pathname}`;
  const title = escapeAttribute(metadata.title);
  const description = escapeAttribute(metadata.description);
  const canonicalAttribute = escapeAttribute(canonical);
  let html = await assetResponse.text();
  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"[^>]*>/i,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      /<meta\s+property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta\s+property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(
      /<meta\s+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${canonicalAttribute}" />`,
    )
    .replace(
      /<meta\s+property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${SOCIAL_IMAGE}" />`,
    )
    .replace(
      /<meta\s+property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${title}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${title}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${description}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${SOCIAL_IMAGE}" />`,
    )
    .replace('<div id="root"></div>', crawlerDocument(url.pathname))
    .replace(
      "</head>",
      `<link rel="canonical" href="${canonicalAttribute}"><link rel="alternate" type="text/plain" href="/llms.txt" title="LLM overview"></head>`,
    );

  const headers = new Headers(assetResponse.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(html, {
    status: known ? assetResponse.status : 404,
    headers,
  });
}
