import siteWorker, {
  BuilderBudget,
  NeobankBuilder,
} from "./index.js";
import { socialCardResponse, socialImageForPath } from "./social-cards.js";

export { BuilderBudget, NeobankBuilder };

function replaceSocialMetadata(html, socialImage) {
  let next = html
    .replace(
      /<meta\s+property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${socialImage}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${socialImage}" />`,
    );

  if (!/<meta\s+property="og:image:width"/i.test(next)) {
    next = next.replace(
      "</head>",
      '<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /></head>',
    );
  }

  return next;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const card = socialCardResponse(url.pathname);
    if (card) return card;

    const response = await siteWorker.fetch(request, env, ctx);
    if (request.method === "HEAD") return response;
    if (!response.headers.get("content-type")?.includes("text/html")) {
      return response;
    }

    const html = replaceSocialMetadata(
      await response.text(),
      socialImageForPath(url.pathname),
    );
    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.delete("etag");
    headers.set("content-type", "text/html; charset=utf-8");

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export { replaceSocialMetadata };
