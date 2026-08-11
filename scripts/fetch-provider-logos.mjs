import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = new URL("../", import.meta.url);
const sourcePath = new URL("../src/ecosystem/providers.ts", import.meta.url);
const outputDir = new URL("../public/provider-logos/", import.meta.url);
const tempDir = new URL("../.tmp-provider-logos/", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const providers = [...source.matchAll(/listed\(\{ id: "([^"]+)", name: "([^"]+)", url: "([^"]+)"/g)]
  .map(([, id, name, url]) => ({ id, name, url }));

await mkdir(outputDir, { recursive: true });
await mkdir(tempDir, { recursive: true });

const headers = { "user-agent": "Mozilla/5.0 BlueballsProviderDirectory/1.0" };

function attr(tag, name) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]
    || tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"))?.[1];
}

function iconCandidates(html, pageUrl) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => ({ tag, rel: attr(tag, "rel") || "", href: attr(tag, "href") || "", sizes: attr(tag, "sizes") || "" }))
    .filter(({ rel, href }) => /icon/i.test(rel) && href && !href.startsWith("data:"))
    .map((candidate) => {
      let score = 20;
      if (/apple-touch/i.test(candidate.rel)) score += 50;
      if (/\.svg(?:$|\?)/i.test(candidate.href) || /any/i.test(candidate.sizes)) score += 40;
      const size = Number(candidate.sizes.match(/(\d+)x\d+/)?.[1] || 0);
      score += Math.min(size, 512) / 16;
      return { url: new URL(candidate.href.replaceAll("&amp;", "&"), pageUrl).href, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ url }) => url);
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 3_000_000) throw new Error("invalid size");
  return { bytes, type: response.headers.get("content-type") || "", finalUrl: response.url };
}

async function toPng(id, image) {
  const outputPath = join(outputDir.pathname, `${id}.png`);
  const head = image.bytes.subarray(0, 300).toString("utf8").trimStart();
  const svg = image.type.includes("svg") || head.startsWith("<svg") || head.startsWith("<?xml");
  if (image.type.includes("png") && !svg) {
    await writeFile(outputPath, image.bytes);
    return;
  }

  const extension = svg ? ".svg" : extname(new URL(image.finalUrl).pathname) || ".img";
  const inputPath = join(tempDir.pathname, `${id}${extension}`);
  await writeFile(inputPath, image.bytes);
  if (svg) {
    await exec("/usr/bin/qlmanage", ["-t", "-s", "256", "-o", tempDir.pathname, inputPath]);
    await rename(`${inputPath}.png`, outputPath);
  } else {
    await exec("/usr/bin/sips", ["-s", "format", "png", inputPath, "--out", outputPath]);
  }
}

const manifest = {};
for (const provider of providers) {
  const origin = new URL(provider.url).origin;
  let candidates = [];
  try {
    const response = await fetch(provider.url, { headers, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (response.ok) candidates = iconCandidates(await response.text(), response.url);
  } catch {}
  candidates.push(`${origin}/apple-touch-icon.png`, `${origin}/favicon.svg`, `${origin}/favicon.ico`, `${origin}/favicon.png`);

  let saved = false;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const image = await fetchBytes(candidate);
      await toPng(provider.id, image);
      manifest[provider.id] = { name: provider.name, source: image.finalUrl, officialDomain: true };
      saved = true;
      break;
    } catch {}
  }

  if (!saved) {
    const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(provider.url).hostname)}&sz=256`;
    try {
      const image = await fetchBytes(fallback);
      await toPng(provider.id, image);
      manifest[provider.id] = { name: provider.name, source: fallback, officialDomain: false };
      saved = true;
    } catch {}
  }

  process.stdout.write(`${saved ? "✓" : "✗"} ${provider.name}\n`);
}

await writeFile(new URL("index.json", outputDir), `${JSON.stringify(manifest, null, 2)}\n`);
await rm(tempDir, { recursive: true, force: true });
process.stdout.write(`Saved ${Object.keys(manifest).length}/${providers.length} provider logos.\n`);
