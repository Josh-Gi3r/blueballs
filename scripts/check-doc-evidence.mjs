import { readFileSync, statSync } from "node:fs";

const handbook = [
  "VISION.md",
  "ARCHITECTURE.md",
  "OPERATIONS.md",
  "TESTING.md",
  "KNOWN-LIMITATIONS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "GOVERNANCE.md",
  "CODE_OF_CONDUCT.md",
  "RELEASE.md",
];

const captures = [
  "docs/assets/screenshots/home-desktop.png",
  "docs/assets/screenshots/products-desktop.png",
  "docs/assets/screenshots/fx-desktop.png",
  "docs/assets/screenshots/cards-desktop.png",
  "docs/assets/screenshots/ecosystem-desktop.png",
  "docs/assets/screenshots/developers-desktop.png",
  "docs/assets/screenshots/home-mobile.png",
  "docs/assets/screenshots/products-mobile.png",
  "docs/assets/screenshots/fx-mobile.png",
  "docs/assets/screenshots/developers-mobile.png",
  "docs/assets/screenshots/sandbox-desktop.png",
  "docs/assets/screenshots/sandbox-mobile.png",
];

const readmeCrops = [
  "docs/assets/readme/home-hero.png",
  "docs/assets/readme/products.png",
  "docs/assets/readme/fx.png",
  "docs/assets/readme/cards.png",
  "docs/assets/readme/developers.png",
  "docs/assets/readme/sandbox.png",
];

for (const capture of captures) {
  const { size } = statSync(capture);
  const minimumSize = capture.endsWith("sandbox-mobile.png") ? 30_000 : 50_000;
  if (size < minimumSize) {
    throw new Error(`${capture} is missing or too small to be a real capture`);
  }
}

for (const crop of readmeCrops) {
  const { size } = statSync(crop);
  if (size < 50_000) throw new Error(`${crop} is missing or too small to be a readable product crop`);
}
const systemMap = readFileSync("docs/assets/blueballs-system-map.svg", "utf8");
if (!systemMap.includes("Blueballs open-source neobank system map") || !systemMap.includes("180 operations")) {
  throw new Error("system map is missing its accessible title or API contract count");
}
const readme = readFileSync("README.md", "utf8");
for (const asset of ["docs/assets/blueballs-system-map.svg", ...readmeCrops]) {
  if (!readme.includes(asset)) throw new Error(`README does not render ${asset}`);
}
for (const capture of captures) {
  if (readme.includes(`](${capture})`) || readme.includes(`src="${capture}"`)) {
    throw new Error(`README must link to, not render, full-page QA capture ${capture}`);
  }
}
for (const document of handbook) {
  const contents = readFileSync(document, "utf8");
  if (contents.length < 500) throw new Error(`${document} is missing or too thin for the public handbook`);
  if (!readme.includes(`(${document})`)) throw new Error(`README documentation map omits ${document}`);
}
const sandboxGuide = readFileSync("SANDBOX.md", "utf8");
if (sandboxGuide.length < 2000 || !readme.includes("(SANDBOX.md)")) {
  throw new Error("SANDBOX.md is missing, too thin, or absent from the README documentation map");
}
const manifest = readFileSync("docs/assets/screenshots/README.md", "utf8");
for (const capture of captures) {
  if (!manifest.includes(capture.split("/").at(-1))) throw new Error(`capture manifest omits ${capture}`);
}

const cropManifest = readFileSync("docs/assets/readme/README.md", "utf8");
for (const crop of readmeCrops) {
  if (!cropManifest.includes(crop.split("/").at(-1))) throw new Error(`README crop manifest omits ${crop}`);
}

console.log(`documentation evidence: ${captures.length} QA captures + ${readmeCrops.length} readable README crops + 1 system map + ${handbook.length} handbook documents`);
