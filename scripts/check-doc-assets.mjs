import { readFileSync } from "node:fs";

const screenshots = [
  "home-desktop.png",
  "products-desktop.png",
  "fx-desktop.png",
  "cards-desktop.png",
  "ecosystem-desktop.png",
  "developers-desktop.png",
  "home-mobile.png",
  "products-mobile.png",
  "fx-mobile.png",
  "developers-mobile.png",
  "sandbox-desktop.png",
  "sandbox-mobile.png",
];

const readmeImages = [
  "home-hero.png",
  "products.png",
  "fx.png",
  "cards.png",
  "developers.png",
  "sandbox.png",
];

function pngDimensions(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error(`${file} is not a valid PNG`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

for (const name of screenshots) {
  const file = `docs/assets/screenshots/${name}`;
  const { width, height } = pngDimensions(file);
  const mobile = name.endsWith("-mobile.png");
  const minimum = mobile
    ? { width: 370, height: 800 }
    : { width: 1400, height: 880 };
  if (width < minimum.width || height < minimum.height) {
    throw new Error(`${file} has unexpected dimensions: ${width}x${height}`);
  }
}

const readme = readFileSync("README.md", "utf8");
for (const name of readmeImages) {
  const file = `docs/assets/readme/${name}`;
  const { width, height } = pngDimensions(file);
  if (width < 1400 || height < 880) {
    throw new Error(`${file} is too small for the README: ${width}x${height}`);
  }
  if (!readme.includes(file)) throw new Error(`README does not use ${file}`);
}

const manifest = readFileSync("docs/assets/screenshots/README.md", "utf8");
for (const name of screenshots) {
  if (!manifest.includes(name))
    throw new Error(`screenshot list omits ${name}`);
}

console.log(
  `${screenshots.length} product screenshots and ${readmeImages.length} README images are valid`,
);
