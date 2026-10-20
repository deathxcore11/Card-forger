// Collection observations, not a reconstructed price series. No retention deletion:
// callers may bound a chart window, but saved historical observations survive.
// Match the displayed USD amount, including half-cent values such as 1.005.
// Multiplying a binary float by 100 before Math.round can lose a displayed cent.
const valueCents = new Intl.NumberFormat('en-US', { useGrouping:false, minimumFractionDigits:2, maximumFractionDigits:2 });
export const roundedValueTotal = total => Number.isFinite(total) && total >= 0 ? Number(valueCents.format(total)) || 0 : null;

export function validValueDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function normalizeValueHistory(history) {
  const days = new Map();
  for (const point of Array.isArray(history) ? history : []) {
    if (!point || !validValueDate(point.date) || !Number.isFinite(point.total) || point.total < 0) continue;
    days.set(point.date, { ...point });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function mergeValueHistory(legacy, workspace) {
  // Workspace is authoritative on duplicate dates. Do not infer coverage or currency.
  return normalizeValueHistory([...normalizeValueHistory(legacy), ...normalizeValueHistory(workspace)]);
}
export function recordValueObservation(history, total, copies, coverage = null, now = new Date()) {
  const existing = normalizeValueHistory(history);
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(copies) || copies < 0) return existing;
  const date = now.toISOString().slice(0, 10);
  const point = { date, total: roundedValueTotal(total), copies };
  if (coverage && Number.isInteger(coverage.unpriced) && coverage.unpriced >= 0) {
    Object.assign(point, { unpriced: coverage.unpriced, currency: coverage.currency, basis: coverage.basis });
  }
  return mergeValueHistory(existing, [point]);
}
export function mergeLegacyGameHistories(state, histories) {
  let changed = false;
  for (const game of ['ptcg', 'ygo']) {
    const side = state.tcg?.[game];
    if (!side) continue;
    const merged = mergeValueHistory(histories[game], side.valueHistory);
    if (JSON.stringify(merged) !== JSON.stringify(side.valueHistory || [])) { side.valueHistory = merged; changed = true; }
  }
  return changed;
}
