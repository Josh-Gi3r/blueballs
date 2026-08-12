import {
  crawlerDocument,
  llmsText,
  pageMetadata,
  robotsText,
  sitemapXml,
} from "./crawler-pages.js";

function internalRequest(request, headers) {
  const next = new Headers(request.headers);
  next.delete("origin");
  for (const [name, value] of Object.entries(headers)) next.set(name, value);
  return new Request(request, { headers: next });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.blueballs.tech") {
      url.hostname = "blueballs.tech";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/robots.txt") {
      return new Response(robotsText(), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

    if (url.pathname === "/sitemap.xml") {
      return new Response(sitemapXml(), {
        headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

    if (url.pathname === "/llms.txt" || url.pathname === "/llms-full.txt") {
      return new Response(llmsText(url.pathname === "/llms-full.txt"), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

    if (url.pathname.startsWith("/v2/fx/") || url.pathname === "/fx-health") {
      const target = url.pathname === "/fx-health"
        ? new Request(new URL("/health", url), request)
        : request;
      return env.FX.fetch(internalRequest(target, {
        authorization: `Bearer ${env.FX_API_KEY}`,
      }));
    }

    if (url.pathname === "/openapi.fx.yaml") {
      return env.FX.fetch(internalRequest(new Request(new URL("/openapi.yaml", url), request), {
        authorization: `Bearer ${env.FX_API_KEY}`,
      }));
    }

    if (url.pathname === "/v2" || url.pathname.startsWith("/v2/")) {
      return env.API.fetch(internalRequest(request, {}));
    }

    if (url.pathname === "/api/health") {
      const [bank, fx] = await Promise.all([
        env.API.fetch(new Request(new URL("/v2", url))),
        env.FX.fetch(internalRequest(new Request(new URL("/health", url)), {
          authorization: `Bearer ${env.FX_API_KEY}`,
        })),
      ]);
      return Response.json({
        status: bank.ok && fx.ok ? "ok" : "degraded",
        site: "blueballs",
        banking_api: bank.status,
        fx_api: fx.status,
      }, { status: bank.ok && fx.ok ? 200 : 503 });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") || request.method === "HEAD") return assetResponse;

    const metadata = pageMetadata(url.pathname);
    let html = await assetResponse.text();
    html = html
      .replace(/<title>.*?<\/title>/s, `<title>${metadata.title}</title>`)
      .replace("<div id=\"root\"></div>", crawlerDocument(url.pathname))
      .replace("</head>", `<meta name="description" content="${metadata.description}"><link rel="canonical" href="https://blueballs.tech${url.pathname === "/" ? "" : url.pathname}"><link rel="alternate" type="text/plain" href="/llms.txt" title="LLM overview"></head>`);

    const headers = new Headers(assetResponse.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.delete("etag");
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: assetResponse.status, headers });
  },
};
