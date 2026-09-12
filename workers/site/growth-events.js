const CLIENT_EVENTS = new Set([
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
  "commercial_contact_view",
]);

const SERVER_EVENTS = new Set([
  "builder_blueprint_created",
  "builder_sandbox_provisioned",
  "builder_test_payment",
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

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function writeGrowthEvent(request, env, event) {
  const output = {
    type: "blueballs_growth_event",
    name: event.name,
    path: cleanString(event.path, 160) || new URL(request.url).pathname,
    session_id: cleanString(event.session_id, 80) || null,
    attribution: cleanProperties(event.attribution),
    properties: cleanProperties(event.properties),
    country: cleanString(request.cf?.country, 8) || null,
    referrer_host: referrerHost(request),
    source_commit: cleanString(env.BLUEBALLS_GIT_SHA, 64) || "development",
  };
  console.log(JSON.stringify(output));
  return output;
}

export function logServerGrowthEvent(request, env, name, properties = {}) {
  if (!SERVER_EVENTS.has(name)) return false;
  writeGrowthEvent(request, env, {
    name,
    path: new URL(request.url).pathname,
    session_id: null,
    attribution: {},
    properties,
  });
  return true;
}

export async function handleGrowthEvent(request, env) {
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    });
  }

  if (!sameOrigin(request)) {
    return Response.json(
      { error: "Cross-origin events are not accepted." },
      { status: 403 },
    );
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
  if (!CLIENT_EVENTS.has(name)) {
    return Response.json({ error: "Unknown event." }, { status: 400 });
  }

  writeGrowthEvent(request, env, {
    name,
    path: body?.path,
    session_id: body?.session_id,
    attribution: body?.attribution,
    properties: body?.properties,
  });

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

export { CLIENT_EVENTS, SERVER_EVENTS };
