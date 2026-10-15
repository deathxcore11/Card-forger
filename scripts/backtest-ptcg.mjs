// Pokémon matchup backtest: do the app's simulated matchup odds predict real tournament matches?
// Limitless online tournaments publish every player's list and every round's result. For each
// decided match where both lists resolve, the app's own pipeline (TCGdex cards → Deck Power →
// matchup profile → simulateMatchup) predicts the first player's chance to win, before looking at
// the result. Scored against a coin flip and against a simple archetype-strength baseline
// (each archetype's win rate in the other tournaments), by Brier score, log loss and calibration.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/backtest-ptcg.mjs <out-dir> [tournaments=30] [minPlayers=64]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OUT = process.argv[2] || "backtest-ptcg", N = Number(process.argv[3] || 30), MIN = Number(process.argv[4] || 64);
const CACHE = path.join(OUT, "cache");
fs.mkdirSync(CACHE, { recursive: true });
// Disk-cached GETs, so reruns (and the app code's own TCGdex calls) don't refetch.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if ((opts.method || "GET") !== "GET") return realFetch(url, opts);
  const f = path.join(CACHE, crypto.createHash("sha1").update(u).digest("hex"));
  if (fs.existsSync(f)) { const { status, body } = JSON.parse(fs.readFileSync(f, "utf8")); return new Response(body, { status }); }
  for (let a = 0; ; a++) {
    try {
      const r = await realFetch(url, { ...opts, headers: { "User-Agent": "CardStashy/3.61 (matchup backtest)", ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
      const body = await r.text();
      if (r.status < 500 && r.status !== 429) fs.writeFileSync(f, JSON.stringify({ status: r.status, body }));
      return new Response(body, { status: r.status });
    } catch (e) { if (a >= 3) throw e; await new Promise((ok) => setTimeout(ok, 1000 * 2 ** a)); }
  }
};
const { ptcgSource, PTCG_FORMATS } = await import("../ptcg.js");
const { cache } = await import("../tcg.js");
const { tcgPower } = await import("../power.js");
const { profileOf, simulateMatchup } = await import("../matchup.js");
const { S, blank } = await import("../store.js");
S.state = blank();
const F = PTCG_FORMATS[0];
const LL = "https://play.limitlesstcg.com/api";
const json = async (u) => (await fetch(u)).json();

const list = (await json(`${LL}/tournaments?game=PTCG&format=STANDARD&limit=300`))
  .filter((t) => t.players >= MIN && Date.parse(t.date) < Date.now() - 2 * 864e5)
  .slice(0, N);
console.error(`${list.length} tournaments with ${MIN}+ players`);

const BASIC_E = /^(Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal) Energy$/;
const cardMemo = new Map();
async function resolve(r) {
  const k = r.name + "|" + r.set + "|" + r.number;
  if (!cardMemo.has(k)) cardMemo.set(k, (async () => {
    let c = null;
    try { c = await ptcgSource.tournamentCard(r); } catch {}
    if (!c && BASIC_E.test(r.name)) try { c = await ptcgSource.byName(r.name.replace(/^Basic /, "")); } catch {}
    if (!c) try { c = await ptcgSource.byName(r.name); } catch {}
    if (c) cache.ptcg[c.id] = c;
    return c;
  })());
  return cardMemo.get(k);
}
const profMemo = new Map();
let n = 0;
async function profile(decklist) {
  const rows = [...(decklist.pokemon || []), ...(decklist.trainer || []), ...(decklist.energy || [])];
  const sig = JSON.stringify(rows.map((r) => [r.name, r.set, r.number, r.count]).sort());
  if (profMemo.has(sig)) return profMemo.get(sig);
  const zones = new Map();
  let unresolved = 0;
  for (const r of rows) {
    const c = await resolve(r);
    if (!c) { unresolved += r.count; continue; }
    zones.set(c.id, { cardId: c.id, name: c.name, qty: (zones.get(c.id)?.qty || 0) + r.count });
  }
  let prof = null;
  if (unresolved <= 2) {
    try {
      const d = { id: "bt" + ++n, name: "t", format: "standard", zones: { main: [...zones.values()], extra: [], side: [] } };
      const p = tcgPower("ptcg", d, F, (id) => cache.ptcg[id] || null);
      prof = profileOf("ptcg", p, [...zones.values()].map((z) => ({ qty: z.qty, c: cache.ptcg[z.cardId] })));
      if (prof) prof.power = p.score;
    } catch {}
  }
  profMemo.set(sig, prof);
  return prof;
}

const matches = [];
for (const [ti, t] of list.entries()) {
  const [standings, pairings] = await Promise.all([json(`${LL}/tournaments/${t.id}/standings`), json(`${LL}/tournaments/${t.id}/pairings`)]);
  const by = new Map(standings.filter((s) => s.decklist).map((s) => [s.player, s]));
  let used = 0;
  for (const m of pairings) {
    const a = by.get(m.player1), b = by.get(m.player2);
    if (!a || !b || !m.winner || m.winner === -1 || m.winner === 0) continue; // byes, draws, unfinished
    const pa = await profile(a.decklist), pb = await profile(b.decklist);
    if (!pa || !pb) continue;
    const sim = simulateMatchup("ptcg", pa, pb, { runs: 600 });
    if (!sim) continue;
    matches.push({ t: t.id, p: sim.win, y: m.winner === m.player1 ? 1 : 0, A: a.deck?.name || "?", B: b.deck?.name || "?", powA: pa.power, powB: pb.power });
    used++;
  }
  console.error(`${ti + 1}/${list.length} ${t.name}: ${used} matches · ${matches.length} total · ${profMemo.size} lists`);
}

// Baseline: archetype strength from the other tournaments (no peeking at the same event).
function archetypeBaseline(m) {
  const w = new Map();
  for (const x of matches) {
    if (x.t === m.t) continue;
    for (const [k, won] of [[x.A, x.y], [x.B, 1 - x.y]]) { const s = w.get(k) || w.set(k, { w: 0, n: 0 }).get(k); s.w += won; s.n++; }
  }
  const rate = (k) => { const s = w.get(k); return s ? (s.w + 5) / (s.n + 10) : 0.5; }; // shrunk toward 50%
  const a = rate(m.A), b = rate(m.B);
  return a / (a + b);
}
const score = (ps) => {
  const brier = ps.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / ps.length;
  const ll = -ps.reduce((s, [p, y]) => s + Math.log(Math.min(0.99, Math.max(0.01, y ? p : 1 - p))), 0) / ps.length;
  const acc = ps.filter(([p]) => p !== 0.5).reduce((s, [p, y]) => s + ((p > 0.5) === (y === 1) ? 1 : 0), 0) / Math.max(1, ps.filter(([p]) => p !== 0.5).length);
  return { brier: +brier.toFixed(4), logLoss: +ll.toFixed(4), favoredWins: +acc.toFixed(3) };
};
const model = matches.map((m) => [m.p, m.y]), coin = matches.map((m) => [0.5, m.y]), arch = matches.map((m) => [archetypeBaseline(m), m.y]);
// Calibration: matches grouped by the predicted chance, against how often that side really won.
const bins = [0, 0.3, 0.4, 0.45, 0.55, 0.6, 0.7, 1.01].slice(0, -1).map((lo, i, a) => {
  const hi = [0.3, 0.4, 0.45, 0.55, 0.6, 0.7, 1.01][i], xs = matches.filter((m) => m.p >= lo && m.p < hi);
  return { range: `${Math.round(lo * 100)}–${Math.round(Math.min(1, hi) * 100)}%`, n: xs.length, predicted: xs.length ? +(xs.reduce((s, m) => s + m.p, 0) / xs.length).toFixed(3) : null, actual: xs.length ? +(xs.reduce((s, m) => s + m.y, 0) / xs.length).toFixed(3) : null };
});
const report = { at: new Date().toISOString(), tournaments: list.length, matches: matches.length, lists: profMemo.size, unresolvedLists: [...profMemo.values()].filter((p) => !p).length, model: score(model), coinFlip: score(coin), archetypeBaseline: score(arch), calibration: bins, spread: { sd: +Math.sqrt(model.reduce((s, [p]) => s + (p - 0.5) ** 2, 0) / model.length).toFixed(3) } };
fs.writeFileSync(path.join(OUT, "backtest-ptcg.json"), JSON.stringify({ ...report, matches: matches.map((m) => [m.t, +m.p.toFixed(4), m.y, m.A, m.B, m.powA, m.powB]) }));
console.log(JSON.stringify(report, null, 1));
