// These are deliberately conservative *resource* caps, not an invoice estimate.
// Paid-plan fees, other Workers, GitHub builds and existing usage are separate.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function trialPolicy(env, now) {
  const owners = String(env.FORGE_TRIAL_OWNER_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
  const expiresAt = Date.parse(env.FORGE_TRIAL_EXPIRES_AT || '');
  const matchMs = Number(env.FORGE_TRIAL_MATCH_MS || 900000);
  const runtimeBudgetMs = Number(env.FORGE_TRIAL_RUNTIME_BUDGET_MS || 3600000);
  const maxReservations = Number(env.FORGE_TRIAL_MAX_RESERVATIONS || 4);
  if (env.FORGE_TRIAL_ENABLED !== 'true' || owners.length < 1 || owners.length > 10 || owners.some(v => !uuid.test(v))
    || !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + 7 * 86400000
    || !Number.isSafeInteger(matchMs) || matchMs < 120000 || matchMs > 7200000
    || !Number.isSafeInteger(runtimeBudgetMs) || runtimeBudgetMs < matchMs || runtimeBudgetMs > 28800000
    || !Number.isSafeInteger(maxReservations) || maxReservations < 1 || maxReservations > 4) return null;
  return { owners, expiresAt, matchMs, runtimeBudgetMs, maxReservations };
}
export async function reserveTrialBudget(txn, allocation, policy, now) {
  if (!policy || now >= policy.expiresAt || !policy.owners.includes(allocation.ownerId)) return { status: 403, error: 'trial_not_authorized' };
  const budget = await txn.get('trial-budget') || { expiresAt: policy.expiresAt, reservedRuntimeMs: 0, reservations: 0 };
  // Changing config never resets counters or silently extends the trial.
  if (budget.expiresAt !== policy.expiresAt) return { status: 503, error: 'trial_configuration_changed' };
  // Include a bounded teardown allowance; this remains resource accounting,
  // never a promise about provider billing precision or other account usage.
  const charge = allocation.expiresAt - allocation.createdAt + 7000;
  if (budget.reservations >= policy.maxReservations || budget.reservedRuntimeMs + charge > policy.runtimeBudgetMs) return { status: 429, error: 'trial_resource_budget_exhausted' };
  budget.reservations++; budget.reservedRuntimeMs += charge;
  await txn.put('trial-budget', budget);
  return null;
}
