/** Bootstrap the first production tenant/admin credential on a fresh database.
 *
 * The secret must come from deployment secret storage. Once the operator has
 * minted long-lived/scoped credentials through their own IAM process, remove the
 * bootstrap secret from the environment. Existing databases never require it. */
export function ensureProductionBootstrap({
  db,
  hashKey,
  ksuid,
  mode,
  env = process.env,
}) {
  if (mode !== "production") return null;
  if (db.keys.size > 0) return null;

  const secret = env.BANK_BOOTSTRAP_API_KEY;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error(
      "Fresh production banking state requires BANK_BOOTSTRAP_API_KEY (at least 32 characters) supplied through secret storage",
    );
  }

  const tenantId = env.BANK_BOOTSTRAP_TENANT_ID || ksuid("ten");
  const email = env.BANK_BOOTSTRAP_EMAIL || null;
  const keyId = ksuid("key");
  const createdAt = new Date().toISOString();
  const tenant = {
    id: tenantId,
    email,
    mode: "production",
    created_at: createdAt,
  };
  const key = {
    id: keyId,
    tenant_id: tenantId,
    email,
    scope: "production_admin",
    permissions: ["*"],
    created_at: createdAt,
    expires: null,
  };

  db.tenants.set(tenantId, tenant);
  db.keys.set(hashKey(secret), key);
  return { tenant_id: tenantId, key_id: keyId };
}
