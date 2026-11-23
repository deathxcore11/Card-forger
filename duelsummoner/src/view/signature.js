// Signature moments (spectacle spec 3.0 and 4.2): one per element, fired on a SPIKE of kills, never on the steady state. Pure view logic, no THREE: the unit test runs it in node.
// Trigger: one element lands K kills inside 60 ticks, where K = max(25, 2.0 x that element's average kills per second over the last 600 ticks); at most once per 1,200 ticks per element; never while an offer or reveal is
// open; only at screen tier 4 or 5. The 25 and the 2.0 are guesses (spec section 11). Kills are counted from the view's own corpse events, so nothing here reads or changes the sim.
export const SIG = { window: 60, history: 600, minK: 25, factor: 2.0, cooldown: 1200 };
export class Signatures {
  constructor() { this.kills = { fire: [], lightning: [] }; this.last = { fire: -1e9, lightning: -1e9 }; this.active = []; }
  note(el, tick, x, z) { const a = this.kills[el]; if (!a) return; a.push(tick, x, z); while (a.length && tick - a[0] > SIG.history) a.splice(0, 3); }
  // returns { el, x, z } when a signature should fire this tick (centre = mean of the kills inside the window), else null
  check(tick, tierOk, blocked) {
    if (!tierOk || blocked) return null;
    for (const el of ['fire', 'lightning']) {
      const a = this.kills[el]; if (tick - this.last[el] < SIG.cooldown) continue;
      let n = 0, sx = 0, sz = 0; for (let i = 0; i < a.length; i += 3) if (tick - a[i] <= SIG.window) { n++; sx += a[i + 1]; sz += a[i + 2]; }
      const K = Math.max(SIG.minK, SIG.factor * (a.length / 3) / (SIG.history / 60));
      if (n >= K) { this.last[el] = tick; return { el, x: sx / n, z: sz / n }; }
    }
    return null;
  }
}
