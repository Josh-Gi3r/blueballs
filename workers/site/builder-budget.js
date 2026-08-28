import { DurableObject } from "cloudflare:workers";

export const DEFAULT_GLOBAL_DAILY_REQUEST_LIMIT = 300;

export function nextGlobalQuota(
  previous,
  now = new Date(),
  limit = DEFAULT_GLOBAL_DAILY_REQUEST_LIMIT,
) {
  const day = now.toISOString().slice(0, 10);
  const current = previous?.day === day ? previous : { day, used: 0 };
  if (current.used >= limit)
    return { allowed: false, quota: current, remaining: 0 };
  const quota = { day, used: current.used + 1 };
  return { allowed: true, quota, remaining: Math.max(0, limit - quota.used) };
}

/** One deliberately global coordination atom. Builder traffic is already
 * source- and tenant-rate-limited; this object exists only to enforce the
 * account-wide paid-model ceiling exactly across every sandbox tenant. */
export class BuilderBudget extends DurableObject {
  async reserve(nowIso, limit) {
    const previous = await this.ctx.storage.get("quota");
    const result = nextGlobalQuota(previous, new Date(nowIso), limit);
    if (result.allowed) await this.ctx.storage.put("quota", result.quota);
    return result;
  }
}
