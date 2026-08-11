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

    return env.ASSETS.fetch(request);
  },
};
