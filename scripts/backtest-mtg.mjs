// Magic matchup backtest on Magic Online challenges. Each challenge page publishes every Top 32
// list, each player's Swiss record, and the Top 8 bracket (who beat whom). For every bracket match,
// the app's own pipeline (Scryfall cards → Deck Power → matchup profile → simulateMatchup)
// predicts the first player's chance to win before looking at the result. Scored against a coin
// flip and against real-results baselines learnt from the other events only: each archetype's
// Swiss record, and archetype head-to-head from other brackets.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/backtest-mtg.mjs <out-dir> [months=2026/10,2026/09,...]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OUT = process.argv[2] || "backtest-mtg";
const MONTHS = (process.argv[3] || "2026/10,2026/09,2026/08,2026/07").split(",");
const FORMATS = { standard: "Standard", pioneer: "Pioneer", modern: "Modern", legacy: "Legacy", pauper: "Pauper", premodern: "Premodern", vintage: "Vintage" };
const CACHE = path.join(OUT, "cache");
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cached(key, make) {
  const f = path.join(CACHE, crypto.createHash("sha1").update(key).digest("hex"));
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const v = await make();
  if (v != null) fs.writeFileSync(f, JSON.stringify(v));
  return v;
}
const getText = (u) => cached(u, async () => {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (CardStashy matchup backtest)" }, signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.text(); } catch {}
    await sleep(1500 * 2 ** a);
  }
  return null;
});

const { parseMtgoEvent, labelArchetypes } = await import("../mtgmeta.js");
const { mtgConstructedPower } = await import("../deckpower.js");
const { profileOf, simulateMatchup, realMatchup, tallyResults } = await import("../matchup.js");
const { setMtgTags } = await import("../mtg-tags.js");
setMtgTags(JSON.parse(fs.readFileSync(new URL("../mtg-tags.json", import.meta.url), "utf8")));
const key = (s) => String(s).toLowerCase();

// 1. Challenge pages.
const slugs = new Set();
for (const m of MONTHS) {
  const html = (await getText("https://www.mtgo.com/decklists/" + m)) || "";
  for (const s of html.match(/decklist\/[a-z]+-challenge-[a-z0-9-]+/g) || []) if (FORMATS[s.slice(9).split("-")[0]]) slugs.add(s.slice(9));
}
console.error(`${slugs.size} challenges`);
const events = [];
for (const s of slugs) {
  const d = parseMtgoEvent((await getText("https://www.mtgo.com/decklist/" + s)) || "");
  if (!d?.decklists?.length || !d.brackets?.length) continue;
  const fmt = FORMATS[s.split("-")[0]];
  const rec = new Map((d.winloss || []).map((w) => [String(w.loginid), { w: Number(w.wins) || 0, l: Number(w.losses) || 0 }]));
  const decks = d.decklists.map((x) => {
    const by = new Map();
    for (const c of x.main_deck || []) { const n = c.card_attributes?.card_name; if (!n) continue; const r = by.get(n) || { name: n, qty: 0, land: /LAND/.test(c.card_attributes?.card_type || "") }; r.qty += Number(c.qty) || 0; by.set(n, r); }
    return { id: String(x.loginid), player: x.player, main: [...by.values()], rec: rec.get(String(x.loginid)) };
  });
  // Magic Online lists the bracket winner first most of the time; order each pair by a hash of the
  // two players instead, so "did the first player win" doesn't leak the result.
  const order = (x, y) => crypto.createHash("sha1").update(s + x.loginid + "|" + y.loginid).digest()[0] & 1;
  const matches = d.brackets.flatMap((b) => b.matches || []).map((m) => m.players).filter((p) => p?.length === 2).map(([a, b]) => (order(a, b) ? [b, a] : [a, b])).map(([a, b]) => ({ a: String(a.loginid), b: String(b.loginid), y: a.winner ? 1 : 0 }));
  events.push({ id: s, fmt, decks, matches });
}
console.error(`${events.length} events with brackets · ${events.reduce((a, e) => a + e.matches.length, 0)} bracket matches`);

// 2. Archetype labels per format, over all of that format's lists (the app's own clustering).
for (const fmt of new Set(events.map((e) => e.fmt))) labelArchetypes(events.filter((e) => e.fmt === fmt).flatMap((e) => e.decks));

// 3. Scryfall card data for every name.
const names = [...new Set(events.flatMap((e) => e.decks.flatMap((d) => d.main.map((r) => r.name))))];
const catalog = {};
for (let i = 0; i < names.length; i += 75) {
  const chunk = names.slice(i, i + 75);
  const data = await cached("scryfall:" + chunk.join("|"), async () => {
    for (let a = 0; a < 4; a++) {
      try {
        const r = await fetch("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "CardStashy/3.62 (backtest)" }, body: JSON.stringify({ identifiers: chunk.map((n) => ({ name: n.split(" // ")[0] })) }) });
        if (r.ok) { await sleep(120); return (await r.json()).data; }
      } catch {}
      await sleep(1000 * 2 ** a);
    }
    return null;
  });
  for (const c of data || []) { catalog[key(c.name)] = c; catalog[key(c.name.split(" // ")[0])] ||= c; }
}
for (const n of names) catalog[key(n)] ||= catalog[key(n.split(" // ")[0])];
console.error(`${Object.keys(catalog).length} cards`);

// 4. Predict every bracket match.
const profMemo = new Map();
const profile = (d) => {
  if (!profMemo.has(d)) {
    const cards = d.main.map((r) => ({ name: r.name, qty: r.qty }));
    let p = null;
    try { p = profileOf("mtg", mtgConstructedPower({ format: "x", cards }, catalog, key, 60), cards.map((r) => ({ qty: r.qty, c: catalog[key(r.name)] })).filter((r) => r.c)); } catch {}
    profMemo.set(d, p);
  }
  return profMemo.get(d);
};
const rows = [];
for (const e of events) {
  const by = new Map(e.decks.map((d) => [d.id, d]));
  for (const m of e.matches) {
    const A = by.get(m.a), B = by.get(m.b);
    if (!A || !B) continue;
    const pa = profile(A), pb = profile(B);
    if (!pa || !pb) continue;
    rows.push({ e: e.id, fmt: e.fmt, p: simulateMatchup("mtg", pa, pb, { runs: 600 }).win, y: m.y, A: A.archetype, B: B.archetype });
  }
}
// 5. Real-results baselines from the other events only.
const brier = (ps) => ps.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / ps.length;
const out = { sim: [], coin: [], arch: [], h2h: [], blend: [] };
for (const e of events) {
  const others = events.filter((x) => x.id !== e.id && x.fmt === e.fmt);
  // Swiss records as archetype strength: each list's wins and losses against the field.
  const games = [];
  for (const o of others) {
    for (const d of o.decks) if (d.rec) { for (let i = 0; i < d.rec.w; i++) games.push([d.archetype, "__field", 1]); for (let i = 0; i < d.rec.l; i++) games.push([d.archetype, "__field", 0]); }
    const by = new Map(o.decks.map((d) => [d.id, d]));
    for (const m of o.matches) { const A = by.get(m.a), B = by.get(m.b); if (A && B) games.push([A.archetype, B.archetype, m.y]); }
  }
  const R = tallyResults(games);
  for (const r of rows.filter((x) => x.e === e.id)) {
    out.sim.push([r.p, r.y]); out.coin.push([0.5, r.y]);
    const real = realMatchup(R, r.A, r.B, 0.5);
    out.arch.push([real.base ?? 0.5, r.y]); out.h2h.push([real.win, r.y]);
    out.blend.push([realMatchup(R, r.A, r.B, r.p).win, r.y]);
  }
}
const bins = [0, 0.3, 0.4, 0.45, 0.55, 0.6, 0.7].map((lo, i, a) => { const hi = a[i + 1] ?? 1.01, xs = rows.filter((r) => r.p >= lo && r.p < hi); return { range: `${Math.round(lo * 100)}–${Math.round(Math.min(1, hi) * 100)}%`, n: xs.length, predicted: xs.length ? +(xs.reduce((s, r) => s + r.p, 0) / xs.length).toFixed(3) : null, actual: xs.length ? +(xs.reduce((s, r) => s + r.y, 0) / xs.length).toFixed(3) : null }; });
const report = { at: new Date().toISOString(), events: events.length, matches: rows.length, byFormat: Object.fromEntries([...new Set(rows.map((r) => r.fmt))].map((f) => [f, rows.filter((r) => r.fmt === f).length])), brier: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, +brier(v).toFixed(4)])), calibration: bins };
fs.writeFileSync(path.join(OUT, "backtest-mtg.json"), JSON.stringify({ ...report, rows: rows.map((r) => [r.e, r.fmt, +r.p.toFixed(4), r.y, r.A, r.B]) }));
console.log(JSON.stringify(report, null, 1));
