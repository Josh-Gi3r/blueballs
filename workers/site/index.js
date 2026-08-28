import { BANK_OPENAPI_YAML } from "./openapi.generated.js";
import { canonicalRedirectUrl } from "./canonical-url.js";
import {
  crawlerDocument,
  llmsText,
  pageMetadata,
  robotsText,
  sitemapXml,
} from "./crawler-pages.js";
import { getAgentByName } from "agents";
export { NeobankBuilder } from "./neobank-builder.js";
export { BuilderBudget } from "./builder-budget.js";

const sourceKey = (request) =>
  request.headers.get("cf-connecting-ip") || "unknown-source";

async function withinLimit(binding, key) {
  if (!binding?.limit) return true;
  return (await binding.limit({ key })).success;
}

/** Path prefixes served by the FX node rather than the banking API. */
const FX_NODE_PATHS = [
  "/v2/fx/depth",
  "/v2/fx/reference",
  "/v2/fx/orders",
  "/v2/fx/quotes",
  "/v2/fx/routes",
  "/v2/fx/fiat",
];

/** Every path the app actually routes. Anything else that asks for HTML gets a
 *  404, rather than the single-page-application fallback quietly serving the
 *  homepage under someone else's URL: /cards returned HTTP 200 with the home
 *  page and the home page's title, which reads as a real page to a crawler and
 *  to anyone who was sent the link. */
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

const isFxNodePath = (pathname) =>
  FX_NODE_PATHS.some(
    (base) => pathname === base || pathname.startsWith(base + "/"),
  );

function internalRequest(request, headers) {
  const next = new Headers(request.headers);
  next.delete("origin");
  for (const [name, value] of Object.entries(headers)) next.set(name, value);
  return new Request(request, { headers: next });
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

    // Served only over TLS, and say so for a year so a browser never tries
    // plaintext again.
    headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );

    // The API shares this hostname with the marketing site. API responses vary
    // by key and must never become a shared edge object: without an explicit
    // no-store a single "Cache Everything" rule would let one caller be served
    // another caller's response.
    if (url.pathname === "/v2" || url.pathname.startsWith("/v2/")) {
      headers.set("cache-control", "no-store");
      headers.set("vary", "x-api-key, authorization");
    }

    // Keep HTML byte-for-byte under the application's control. Cloudflare's
    // optional script injection is incompatible with the strict CSP above and
    // is unnecessary for the reference site.
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

  // Canonical origin: one hostname, always over TLS. The www redirect used to
  // rewrite only the hostname, so http://www → http:// apex and the request
  // stayed in the clear all the way through.
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

  // Paths the FX node owns. Everything else under /v2/fx/ — price,
  // pricing-model, rfq, lp/*, intents, fills, net, batches, appetite, route —
  // is implemented by the banking API and must reach it.
  //
  // This was previously a blanket `startsWith("/v2/fx/")`, which sent all of
  // them to the FX node. The node implements a different path set, so 20 of
  // the 26 catalogued FX endpoints answered 404 in production while their
  // handlers sat there working.
  if (isFxNodePath(url.pathname) || url.pathname === "/fx-health") {
    const target =
      url.pathname === "/fx-health"
        ? new Request(new URL("/health", url), request)
        : request;
    // The caller's own Authorization is forwarded untouched. The edge used to
    // overwrite it with the operator key on every request, which made the
    // node's authentication unreachable: anonymous callers were authenticated
    // by the edge on the entire FX surface, ops and write routes included.
    // The public demo still works because the reference sandbox and aggregate
    // depth are public in the node by design, not by header injection.
    return env.FX.fetch(internalRequest(target, {}));
  }

  // The banking API's machine-readable contract. It is linked from the
  // developers page and llms.txt, and used to fall through to the SPA
  // fallback and serve the homepage as HTML.
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
        {
          status: 429,
          headers: { "retry-after": "60" },
        },
      );
    }
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey)
      return Response.json(
        { error: "A sandbox key is required." },
        { status: 401 },
      );
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
    const tenantId = principal?.data?.[0]?.tenant_id;
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
        {
          status: 429,
          headers: { "retry-after": "60" },
        },
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
    return env.API.fetch(internalRequest(request, {}));
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
  let html = await assetResponse.text();
  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${metadata.title}</title>`)
    .replace('<div id="root"></div>', crawlerDocument(url.pathname))
    .replace(
      "</head>",
      `<meta name="description" content="${metadata.description}"><link rel="canonical" href="https://blueballs.tech${url.pathname === "/" ? "" : url.pathname}"><link rel="alternate" type="text/plain" href="/llms.txt" title="LLM overview"></head>`,
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
