import homeCard from "./social-assets/home.js";
import fxCard from "./social-assets/fx.js";
import cardsCard from "./social-assets/cards.js";
import providersCard from "./social-assets/providers.js";
import blueprintsCard from "./social-assets/blueprints.js";
import sandboxCard from "./social-assets/sandbox.js";
import proofCard from "./social-assets/proof.js";

const SITE = "https://blueballs.tech";

export const SOCIAL_CARD_PATHS = Object.freeze({
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
});

const SOCIAL_CARD_ASSETS = Object.freeze({
  "/social/home.png": homeCard,
  "/social/fx.png": fxCard,
  "/social/cards.png": cardsCard,
  "/social/providers.png": providersCard,
  "/social/blueprints.png": blueprintsCard,
  "/social/sandbox.png": sandboxCard,
  "/social/proof.png": proofCard,
});

function decodeBase64(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function socialImageForPath(pathname) {
  const assetPath = SOCIAL_CARD_PATHS[pathname] ?? SOCIAL_CARD_PATHS["/"];
  return `${SITE}${assetPath}`;
}

export function socialCardResponse(pathname) {
  const encoded = SOCIAL_CARD_ASSETS[pathname];
  if (!encoded) return null;

  return new Response(decodeBase64(encoded), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

export function socialCardAssetPaths() {
  return Object.keys(SOCIAL_CARD_ASSETS);
}
