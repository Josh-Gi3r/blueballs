const ALLOWED_EVENTS = new Set([
  "provider_directory_view",
  "provider_filter",
  "provider_search",
  "provider_shortlist",
  "provider_unshortlist",
  "provider_compare",
  "provider_outbound",
  "provider_claim_start",
  "provider_partnership_start",
  "builder_start",
  "commercial_cta",
]);

const MAX_BODY_BYTES = 4096;
const MAX_PROPERTIES = 12;
const MAX_STRING = 160;

function cleanString(value, max = MAX_STRING) {
  if (typeof value !== "string") return "";
  return value.slice(0, max).replace(/[\u0000-\u001f\u007f]/g, "");
}

function cleanProperties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, MAX_PROPERTIES);
  return Object.fromEntries(
    entries.flatMap(([key, item]) => {
      const safeKey = cleanString(key, 48);
      if (!safeKey) return [];
      if (typeof item === "string") return [[safeKey, cleanString(item)]];
      if (typeof item === "number" && Number.isFinite(item)) return [[safeKey, item]];
      if (typeof item === "boolean" || item === null) return [[safeKey, item]];
      return [];
    }),
  );
}

function referrerHost(request) {
  const referrer = request.headers.get("referer");
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.slice(0, 120);
  } catch {
    return null;
  }
}

export async function handleGrowthEvent(request, env) {
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    });
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "Event payload too large." }, { status: 413 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Event payload too large." }, { status: 413 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid event payload." }, { status: 400 });
  }

  const name = cleanString(body?.name, 64);
  if (!ALLOWED_EVENTS.has(name)) {
    return Response.json({ error: "Unknown event." }, { status: 400 });
  }

  const attribution = cleanProperties(body?.attribution);
  const event = {
    type: "blueballs_growth_event",
    name,
    path: cleanString(body?.path, 160) || "/",
    session_id: cleanString(body?.session_id, 80) || null,
    attribution,
    properties: cleanProperties(body?.properties),
    country: cleanString(request.cf?.country, 8) || null,
    referrer_host: referrerHost(request),
    source_commit: cleanString(env.BLUEBALLS_GIT_SHA, 64) || "development",
  };

  // The Site Worker already has Cloudflare observability enabled. Structured
  // JSON makes these events queryable immediately without introducing user PII,
  // cookies or a third-party analytics dependency. A future Analytics Engine or
  // warehouse sink can consume the same stable event schema.
  console.log(JSON.stringify(event));

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

export { ALLOWED_EVENTS };
