/** Encrypt durable provider payloads at rest.
 *
 * Provider jobs can contain identity, account and card metadata. Production jobs
 * must therefore never persist those payloads as plaintext JSON. The keyring is
 * deployment-owned and supplied through secret storage; ciphertext records carry
 * a key id so operators can rotate keys without making queued work unreadable.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT = "A256GCM";
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
const KEY_ID = /^[A-Za-z0-9._-]{1,64}$/;

function keyBytes(material) {
  if (typeof material !== "string" || !material.trim()) {
    throw new Error("Provider payload encryption key must be a non-empty string");
  }
  const value = material.trim();
  let decoded;
  if (/^[0-9a-fA-F]{64}$/.test(value)) decoded = Buffer.from(value, "hex");
  else {
    try {
      decoded = Buffer.from(value, "base64");
    } catch {
      decoded = null;
    }
  }
  if (!decoded || decoded.length !== 32) {
    throw new Error(
      "Provider payload encryption keys must decode to exactly 32 bytes (64 hex characters or base64)",
    );
  }
  return decoded;
}

function parseKeyring(env = process.env) {
  const configured = env.BANK_PROVIDER_PAYLOAD_KEYS;
  if (configured) {
    let parsed;
    try {
      parsed = JSON.parse(configured);
    } catch {
      throw new Error("BANK_PROVIDER_PAYLOAD_KEYS must be a JSON object of key_id -> key");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("BANK_PROVIDER_PAYLOAD_KEYS must be a JSON object of key_id -> key");
    }
    const keys = new Map();
    for (const [id, material] of Object.entries(parsed)) {
      if (!KEY_ID.test(id)) throw new Error(`Invalid provider payload key id ${id}`);
      keys.set(id, keyBytes(String(material)));
    }
    if (!keys.size) throw new Error("BANK_PROVIDER_PAYLOAD_KEYS must contain at least one key");
    const active = env.BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID;
    if (!active || !keys.has(active)) {
      throw new Error(
        "BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID must name a key in BANK_PROVIDER_PAYLOAD_KEYS",
      );
    }
    return { active, keys };
  }

  if (env.BANK_PROVIDER_PAYLOAD_KEY) {
    const active = env.BANK_PROVIDER_PAYLOAD_ACTIVE_KEY_ID || "default";
    if (!KEY_ID.test(active)) throw new Error(`Invalid provider payload key id ${active}`);
    return {
      active,
      keys: new Map([[active, keyBytes(env.BANK_PROVIDER_PAYLOAD_KEY)]]),
    };
  }

  return null;
}

function productionMode(env = process.env) {
  return (env.BANK_API_MODE ?? "sandbox") === "production";
}

function plaintext(value) {
  const encoded = Buffer.from(JSON.stringify(value ?? {}), "utf8");
  if (encoded.length > MAX_PAYLOAD_BYTES) {
    const error = new Error(
      `Provider payload exceeds the ${MAX_PAYLOAD_BYTES}-byte encrypted outbox limit`,
    );
    error.code = "PROVIDER_PAYLOAD_TOO_LARGE";
    throw error;
  }
  return encoded;
}

/** Seal a JSON-compatible provider payload. Production requires a keyring. */
export function sealProviderPayload(value, env = process.env) {
  const ring = parseKeyring(env);
  if (!ring) {
    if (productionMode(env)) {
      const error = new Error(
        "Production provider operations require BANK_PROVIDER_PAYLOAD_KEY or BANK_PROVIDER_PAYLOAD_KEYS",
      );
      error.code = "PROVIDER_PAYLOAD_ENCRYPTION_UNAVAILABLE";
      throw error;
    }
    return { format: "PLAINTEXT_TEST_ONLY", value };
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, ring.keys.get(ring.active), iv);
  const encoded = plaintext(value);
  const ciphertext = Buffer.concat([cipher.update(encoded), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    format: FORMAT,
    kid: ring.active,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/** Open a payload. Key rotation is supported by retaining old keys in the
 * keyring until no durable jobs reference their key ids. */
export function openProviderPayload(sealed, env = process.env) {
  if (!sealed || typeof sealed !== "object") {
    throw new Error("Provider payload envelope is missing");
  }
  if (sealed.format === "PLAINTEXT_TEST_ONLY") {
    if (productionMode(env)) {
      throw new Error("Production refuses a plaintext provider payload envelope");
    }
    return structuredClone(sealed.value ?? {});
  }
  if (sealed.format !== FORMAT || !KEY_ID.test(String(sealed.kid ?? ""))) {
    throw new Error("Provider payload envelope format is unsupported");
  }
  const ring = parseKeyring(env);
  const key = ring?.keys.get(sealed.kid);
  if (!key) {
    const error = new Error(`Provider payload key ${sealed.kid} is unavailable`);
    error.code = "PROVIDER_PAYLOAD_KEY_UNAVAILABLE";
    throw error;
  }
  const iv = Buffer.from(String(sealed.iv ?? ""), "base64");
  const ciphertext = Buffer.from(String(sealed.ciphertext ?? ""), "base64");
  const tag = Buffer.from(String(sealed.tag ?? ""), "base64");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_PAYLOAD_BYTES + 32) {
    throw new Error("Provider payload envelope is malformed");
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (decoded.length > MAX_PAYLOAD_BYTES) throw new Error("Provider payload is too large");
  const parsed = JSON.parse(decoded.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Provider payload plaintext must be a JSON object");
  }
  return parsed;
}

export function providerPayloadEncryptionReady(env = process.env) {
  return !!parseKeyring(env);
}
