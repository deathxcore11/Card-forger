// Account access and resource admission are separate from native deck validation.
// The existing verifier must establish a non-anonymous account before this policy.
import { trialPolicy, reserveTrialBudget } from './trial.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW_MS = 86_400_000;
const TEARDOWN_MS = 7000;

export function admissionPolicy(env, now) {
  const mode = env.FORGE_PLAY_ACCESS ?? 'trial';
  if (mode === 'trial') {
    const trial = trialPolicy(env, now);
    return trial && { ...trial, mode };
  }
  if (mode !== 'authenticated' || env.FORGE_PLAY_ENABLED !== 'true') return null;
  const matchMs = Number(env.FORGE_PLAY_MATCH_MS ?? 3_600_000);
  const runtimeBudgetMs = Number(env.FORGE_PLAY_DAILY_RUNTIME_MS ?? 28_800_000);
  const maxReservations = Number(env.FORGE_PLAY_DAILY_RESERVATIONS ?? 16);
  if (!Number.isSafeInteger(now) || now < 0
    || !Number.isSafeInteger(matchMs) || matchMs < 120_000 || matchMs > 7_200_000
    || !Number.isSafeInteger(runtimeBudgetMs) || runtimeBudgetMs < matchMs + TEARDOWN_MS || runtimeBudgetMs > 28_800_000
    || !Number.isSafeInteger(maxReservations) || maxReservations < 1 || maxReservations > 100) return null;
  return { mode, matchMs, runtimeBudgetMs, maxReservations };
}

export function allowsAccount(policy, ownerId) {
  return !!policy && UUID.test(ownerId || '')
    && (policy.mode === 'authenticated' || policy.owners.includes(ownerId));
}

// Called inside the SAME storage transaction as the lease/idempotency receipt.
// Reserve worst-case runtime before start. Config edits do not refund usage; once
// the match's destruction is confirmed, settleAdmissionBudget lowers its entry to
// the runtime actually held. A rolling window avoids a burst at midnight.
export async function reserveAdmissionBudget(txn, allocation, policy, now) {
  if (policy?.mode === 'trial') return reserveTrialBudget(txn, allocation, policy, now);
  if (!allowsAccount(policy, allocation.ownerId)) return { status: 403, error: 'play_not_authorized' };
  const charge = allocation.expiresAt - allocation.createdAt + TEARDOWN_MS;
  if (!Number.isSafeInteger(charge) || charge <= TEARDOWN_MS || charge > policy.matchMs + TEARDOWN_MS) {
    return { status: 503, error: 'play_invalid_runtime_reservation' };
  }
  const saved = await txn.get('play-runtime-budget');
  if (saved && (saved.version !== 1 || !Array.isArray(saved.entries) || saved.entries.length > 100
    || saved.entries.some(e => !Number.isSafeInteger(e.at) || e.at < 0 || e.at > now
      || !Number.isSafeInteger(e.runtimeMs) || e.runtimeMs <= TEARDOWN_MS || e.runtimeMs > 7_207_000
      || (e.matchId !== undefined && !UUID.test(e.matchId))))) {
    return { status: 503, error: 'play_runtime_budget_unavailable' };
  }
  const entries = (saved?.entries ?? []).filter(e => e.at > now - WINDOW_MS);
  const reserved = entries.reduce((sum, e) => sum + e.runtimeMs, 0);
  if (entries.length >= policy.maxReservations || reserved + charge > policy.runtimeBudgetMs) {
    return { status: 429, error: 'play_resource_budget_exhausted' };
  }
  entries.push({ at: now, runtimeMs: charge, matchId: allocation.matchId });
  await txn.put('play-runtime-budget', { version: 1, entries });
  return null;
}

// Called only after the match's destruction proof released its lease. A start that
// failed, or a short match, keeps only the runtime it actually held plus teardown,
// so failed starts cannot exhaust the rolling allowance. Never raises a charge.
export async function settleAdmissionBudget(storage, lease, now) {
  if (!UUID.test(lease?.matchId || '') || !Number.isSafeInteger(lease.createdAt) || !Number.isSafeInteger(now)) return false;
  return storage.transaction(async txn => {
    const saved = await txn.get('play-runtime-budget');
    if (saved?.version !== 1 || !Array.isArray(saved.entries)) return false;
    const entry = saved.entries.find(e => e.matchId === lease.matchId);
    if (!entry) return false;
    const held = Math.max(TEARDOWN_MS + 1, Math.min(entry.runtimeMs, now - lease.createdAt + TEARDOWN_MS));
    if (held === entry.runtimeMs) return false;
    entry.runtimeMs = held;
    await txn.put('play-runtime-budget', saved);
    return true;
  });
}
