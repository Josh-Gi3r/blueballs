/** Bootstrap or explicitly recover a production tenant/admin credential.
 *
 * Fresh state may create the first tenant. Existing state is never mistaken for
 * a fresh installation merely because every API key was revoked: recovery then
 * requires an explicit existing BANK_BOOTSTRAP_TENANT_ID plus a new secret.
 */
export function ensureProductionBootstrap({
  db,
  hashKey,
  ksuid,
  mode,
  env = process.env,
}) {
  if (mode !== "production") return null;

  const requestedTenantId = env.BANK_BOOTSTRAP_TENANT_ID || null;
  const requestedExistingTenant = requestedTenantId
    ? db.tenants.get(requestedTenantId)
    : null;
  const tenantHasKey = requestedTenantId
    ? [...db.keys.values()].some((key) => key.tenant_id === requestedTenantId)
    : false;

  // Normal restart: at least one credential already exists and no explicit
  // credential-recovery tenant was requested.
  if (db.keys.size > 0 && !requestedTenantId) return null;

  // Explicit recovery is idempotent once that tenant has a credential.
  if (requestedTenantId && tenantHasKey) return null;

  const fresh = db.tenants.size === 0 && db.keys.size === 0;
  if (!fresh && !requestedTenantId) {
    throw new Error(
      "Production banking state contains tenant data but no API credentials. Refusing to create a new tenant implicitly; set BANK_BOOTSTRAP_TENANT_ID to the existing tenant and BANK_BOOTSTRAP_API_KEY to a new recovery secret.",
    );
  }
  if (requestedTenantId && !requestedExistingTenant && !fresh) {
    throw new Error(
      `BANK_BOOTSTRAP_TENANT_ID ${requestedTenantId} does not identify an existing production tenant`,
    );
  }

  const secret = env.BANK_BOOTSTRAP_API_KEY;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error(
      `${fresh ? "Fresh" : "Recovery"} production banking state requires BANK_BOOTSTRAP_API_KEY (at least 32 characters) supplied through secret storage`,
    );
  }
  const digest = hashKey(secret);
  const existingSecret = db.keys.get(digest);
  if (existingSecret) {
    if (requestedTenantId && existingSecret.tenant_id === requestedTenantId) return null;
    throw new Error(
      "BANK_BOOTSTRAP_API_KEY is already assigned to a different production credential; use a new recovery secret",
    );
  }

  const tenantId = requestedTenantId || ksuid("ten");
  const createdAt = new Date().toISOString();
  let tenant = requestedExistingTenant;
  if (!tenant) {
    tenant = {
      id: tenantId,
      email: env.BANK_BOOTSTRAP_EMAIL || null,
      mode: "production",
      created_at: createdAt,
    };
    db.tenants.set(tenantId, tenant);
  }

  const keyId = ksuid("key");
  const key = {
    id: keyId,
    tenant_id: tenantId,
    email: env.BANK_BOOTSTRAP_EMAIL ?? tenant.email ?? null,
    scope: "production_admin",
    permissions: ["*"],
    created_at: createdAt,
    expires: null,
  };

  db.keys.set(digest, key);
  return {
    tenant_id: tenantId,
    key_id: keyId,
    recovery: !fresh,
  };
}
