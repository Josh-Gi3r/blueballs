import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SOCIAL_CARD_PATHS,
  socialCardAssetPaths,
  socialCardResponse,
  socialImageForPath,
} from "./social-cards.js";

const EXPECTED = {
  "/": "/social/home.png",
  "/home": "/social/home.png",
  "/products": "/social/home.png",
  "/fx": "/social/fx.png",
  "/cards": "/social/cards.png",
  "/ecosystem": "/social/providers.png",
  "/blueprint": "/social/blueprints.png",
  "/proof": "/social/proof.png",
  "/sandbox": "/social/sandbox.png",
  "/developers": "/social/home.png",
  "/contact": "/social/home.png",
};

const wrapperSource = readFileSync(
  new URL("./social-wrapper.js", import.meta.url),
  "utf8",
);
const wranglerSource = readFileSync(
  new URL("../../wrangler.jsonc", import.meta.url),
  "utf8",
);
const indexHtml = readFileSync(
  new URL("../../index.html", import.meta.url),
  "utf8",
);

function pngDimensions(buffer) {
  const bytes = new Uint8Array(buffer);
  assert.deepEqual(
    [...bytes.slice(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    "social asset must have a PNG signature",
  );
  const view = new DataView(buffer);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

test("every public product route has the intended social card", () => {
  assert.deepEqual(SOCIAL_CARD_PATHS, EXPECTED);
  assert.equal(new Set(Object.values(SOCIAL_CARD_PATHS)).size, 7);
  for (const [route, path] of Object.entries(EXPECTED)) {
    assert.equal(socialImageForPath(route), `https://blueballs.tech${path}`);
  }
  assert.equal(
    socialImageForPath("/not-a-page"),
    "https://blueballs.tech/social/home.png",
  );
});

test(
  "all seven social card endpoints return immutable 1200x630 PNGs",
  async () => {
    const paths = socialCardAssetPaths();
    assert.equal(paths.length, 7);
    assert.equal(new Set(paths).size, 7);

    for (const path of paths) {
      const response = socialCardResponse(path);
      assert.ok(response, `missing social card response for ${path}`);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.match(response.headers.get("cache-control") ?? "", /immutable/);
      assert.deepEqual(pngDimensions(await response.arrayBuffer()), {
        width: 1200,
        height: 630,
      });
    }
  },
);

test(
  "the deployed site entrypoint serves cards and rewrites both OG and X images",
  () => {
    assert.match(
      wranglerSource,
      /"main": "\.\/workers\/site\/social-wrapper\.js"/,
    );
    assert.match(wrapperSource, /socialCardResponse\(url\.pathname\)/);
    assert.match(wrapperSource, /socialImageForPath\(url\.pathname\)/);
    assert.match(wrapperSource, /property="og:image"/);
    assert.match(wrapperSource, /name="twitter:image"/);
    assert.match(wrapperSource, /og:image:width/);
    assert.match(wrapperSource, /content="1200"/);
    assert.match(wrapperSource, /content="630"/);
  },
);

test(
  "the static HTML fallback uses the launch-card contract, not the retired city cover",
  () => {
    assert.match(indexHtml, /https:\/\/blueballs\.tech\/social\/home\.png/);
    assert.match(indexHtml, /property="og:image:width" content="1200"/);
    assert.match(indexHtml, /property="og:image:height" content="630"/);
    assert.doesNotMatch(indexHtml, /blueballs-front-cover-v1\.png/);
  },
);
