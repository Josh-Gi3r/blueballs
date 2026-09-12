#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("workers/site/social-assets/cards.js", "utf8");
const match = source.match(/^export default "([A-Za-z0-9+/=_-]+)";\s*$/s);
if (!match) throw new Error("cards social asset wrapper mismatch");
const encoded = match[1];

console.log({
  length: encoded.length,
  mod4: encoded.length % 4,
  equals: (encoded.match(/=/g) ?? []).length,
  dash: (encoded.match(/-/g) ?? []).length,
  underscore: (encoded.match(/_/g) ?? []).length,
  prefix: encoded.slice(0, 32),
  suffix: encoded.slice(-32),
});

for (const [label, value] of [
  ["raw", encoded],
  ["urlsafe-normalized", encoded.replace(/-/g, "+").replace(/_/g, "/")],
]) {
  let padded = value;
  while (padded.length % 4) padded += "=";
  try {
    console.log(`${label} strict atob bytes`, atob(padded).length);
  } catch (error) {
    console.log(`${label} strict atob FAIL`, error.name, error.message);
  }
  const buffer = Buffer.from(padded, "base64");
  console.log(`${label} lenient buffer`, {
    bytes: buffer.length,
    signature: buffer.subarray(0, 8).toString("hex"),
    tail: buffer.subarray(-24).toString("hex"),
  });
  inspectPng(label, buffer);
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crcTable();
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function inspectPng(label, buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    console.log(`${label} invalid PNG signature`);
    return;
  }
  let offset = 8;
  let index = 0;
  while (offset + 12 <= buffer.length && index < 100) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const next = crcOffset + 4;
    const type = buffer.subarray(typeStart, dataStart).toString("latin1");
    if (next > buffer.length) {
      console.log(`${label} chunk ${index}`, { offset, length, type, next, within: false });
      return;
    }
    const expected = buffer.readUInt32BE(crcOffset);
    const actual = crc32(buffer.subarray(typeStart, crcOffset));
    console.log(`${label} chunk ${index}`, {
      offset,
      length,
      type,
      next,
      crc: expected === actual ? "ok" : "BAD",
      expected: expected.toString(16).padStart(8, "0"),
      actual: actual.toString(16).padStart(8, "0"),
    });
    offset = next;
    index += 1;
    if (type === "IEND") {
      console.log(`${label} IEND`, { offset, bytes: buffer.length, exactEof: offset === buffer.length });
      return;
    }
  }
  console.log(`${label} ended without IEND`, { offset, bytes: buffer.length, chunks: index });
}
