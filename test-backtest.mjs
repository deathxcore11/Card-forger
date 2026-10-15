// Pokémon matchup odds against real results: 8,469 Limitless matches from 30 events, frozen. For
// each event, the app's realMatchup learns results only from the other events, then predicts this
// one's matches. It must beat a coin flip and the raw simulation (which was overconfident).
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { realMatchup, tallyResults } from "./matchup.js";

const { matches } = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("./test-fixtures/ptcg-backtest.json.gz", import.meta.url))));
const events = [...new Set(matches.map((m) => m[0]))];
const brier = (ps) => ps.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / ps.length;
const app = [], raw = [], coin = [];
for (const e of events) {
  const R = tallyResults(matches.filter((m) => m[0] !== e).map((m) => [m[3], m[4], m[2]]));
  for (const [, p, y, A, B] of matches.filter((m) => m[0] === e)) {
    app.push([realMatchup(R, A, B, p).win, y]);
    raw.push([p, y]);
    coin.push([0.5, y]);
  }
}
const [a, r, c] = [brier(app), brier(raw), brier(coin)];
assert.ok(matches.length > 8000);
assert.ok(a < c - 0.002, `real-results odds beat a coin flip (Brier ${a.toFixed(4)} vs ${c.toFixed(4)})`);
assert.ok(a < r - 0.03, `and beat the raw simulation by a wide margin (${a.toFixed(4)} vs ${r.toFixed(4)})`);
// Calibration: when the app says 55%+, that side wins more than half the time, and not wildly less than claimed.
const hi = app.filter(([p]) => p >= 0.55), win = hi.reduce((s, [, y]) => s + y, 0) / hi.length, said = hi.reduce((s, [p]) => s + p, 0) / hi.length;
assert.ok(win > 0.5 && Math.abs(win - said) < 0.05, `favoured sides win ${(win * 100).toFixed(1)}% when the app says ${(said * 100).toFixed(1)}%`);
console.log(`PASS: Pokémon matchup odds on ${matches.length} real matches — Brier ${a.toFixed(4)} (coin 0.2500, raw simulation ${r.toFixed(4)}); "55%+" sides win ${(win * 100).toFixed(1)}%.`);

// Magic: 4,045 Magic Online Top 8 matches. The simulated lean had no signal, so the app keeps
// almost none of it (trustedSim). Its shown odds must not do worse than a coin flip.
{
  const { trustedSim } = await import("./matchup.js");
  const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("./test-fixtures/mtg-backtest.json.gz", import.meta.url)))).matches;
  const shown = M.map(([, , p, y]) => [trustedSim("mtg", { win: p, onPlay: p, onDraw: p, reasons: [] }).win, y]);
  const rawB = brier(M.map(([, , p, y]) => [p, y])), shownB = brier(shown);
  assert.ok(M.length > 4000);
  assert.ok(rawB > 0.28, `raw Magic simulation stays documented as overconfident (${rawB.toFixed(4)})`);
  assert.ok(shownB <= 0.2505, `Magic odds shown by the app are no worse than a coin flip (${shownB.toFixed(4)})`);
  console.log(`PASS: Magic matchup odds on ${M.length} real Top 8 matches — shown ${shownB.toFixed(4)} (coin 0.2500, raw simulation ${rawB.toFixed(4)}).`);
}
