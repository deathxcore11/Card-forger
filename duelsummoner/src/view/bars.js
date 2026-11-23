// The XP and LP bars, driven in JS every frame (no CSS transitions) so the timing is exact and reduce motion can switch it off. Each bar is a fixed-size element filled with transform: scaleX, never width.
// XP: a pale ghost snaps to the new value on the collect frame, the fill follows with expo(110 ms) (about 84% of the gain at 200 ms, settled by 600 ms), a glint on the leading edge fades over 300 ms,
// and when the bar resets for a new level the fill and ghost snap and the level readout punches. LP: damage drops the fill at once and leaves a red ghost that drains after 250 ms over 400 ms;
// a heal fills a rose segment from the old value to the new over 300 ms. Counters punch at most once per 500 ms. View only.
const $ = id => document.getElementById(id), clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const inOutQuad = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function layer(bar, cls, color, op) { const e = document.createElement('i'); e.className = cls; e.style.background = color; if (op !== undefined) e.style.opacity = op; bar.insertBefore(e, bar.firstElementChild); return e; }
export class Bars {
  constructor() {
    this.ok = false; this.lv = null; this.xp = { shown: 0, target: 0, ghost: 0, glint: 0, w: -1, gw: -1 }; this.hp = { shown: 0, target: 0, ghost: 0, hold: 0, from: 0, rose: -1, roseT: 0, roseFrom: 0, w: -1, gw: -1, rw: -1 };
    this.punchT = { hpnum: -9, xpnum: -9, coins: -9 }; this.log = [];
  }
  _build() {
    const xb = $('xpbar'), hb = $('hpbar'); if (!xb || !hb || !xb.firstElementChild) return false;
    this.xFill = xb.querySelector('i:not(.gh):not(.rs)'); this.xGhost = layer(xb, 'gh', '#e6dcff', 0.7);
    this.xGlint = document.createElement('b'); this.xGlint.className = 'gl'; xb.appendChild(this.xGlint);
    this.hFill = hb.querySelector('i:not(.gh):not(.rs)'); this.hGhost = layer(hb, 'gh', '#ff9a86', 0.9); this.hRose = layer(hb, 'rs', '#ff6f91', 1);
    for (const e of [this.xFill, this.xGhost, this.hFill, this.hGhost, this.hRose]) { e.style.width = '100%'; e.style.transformOrigin = 'left'; e.style.transform = 'scaleX(0)'; }
    this.ok = true; return true;
  }
  reset() { this.lv = null; }
  punch(id, now) { if (now - this.punchT[id] < 500) return; this.punchT[id] = now; const e = $(id); if (!e) return; e.classList.remove('punch'); void e.offsetWidth; e.classList.add('punch'); }
  tick(dt, g, rm, now) {
    if (!this.ok && !this._build()) return;
    const xf = g.xpNeed > 0 ? clamp01(g.xpCur / g.xpNeed) : 0, hf = g.p.maxHp > 0 ? clamp01(g.p.hp / g.p.maxHp) : 0, X = this.xp, H = this.hp;
    if (this.lv === null || g.t < 0.3) { this.lv = g.level; X.shown = X.target = X.ghost = xf; H.shown = H.target = H.ghost = hf; H.rose = -1; }
    // ---- XP
    if (g.level !== this.lv) { this.lv = g.level; X.shown = X.ghost = X.target = xf; X.glint = 0; this.punch('xpnum', now); }
    else if (xf > X.target + 1e-4) { X.ghost = xf; X.glint = 1; this.log.push(['xp', now, xf]); }
    else if (xf < X.target - 1e-4) { X.shown = X.ghost = xf; }
    X.target = xf;
    if (rm) { X.shown = X.target; X.glint = 0; } else { X.shown += (X.target - X.shown) * (1 - Math.exp(-dt / 0.11)); if (Math.abs(X.target - X.shown) < 0.0005) X.shown = X.target; X.glint = Math.max(0, X.glint - dt / 0.3); }
    // ---- LP
    if (hf < H.target - 1e-4) { H.ghost = Math.max(H.ghost, H.shown, H.target); H.shown = hf; H.hold = 0.25; H.rose = -1; H.drain = -1; this.punch('hpnum', now); }
    else if (hf > H.target + 1e-4) { if (H.rose < 0) { H.roseFrom = H.shown; } H.rose = hf; H.roseT = rm ? 1 : 0; this.punch('hpnum', now); }
    H.target = hf;
    if (H.hold > 0) { H.hold -= dt; if (H.hold <= 0) { H.drain = 0; H.drainFrom = H.ghost; } }
    else if (H.drain !== undefined && H.drain >= 0) { H.drain += dt / 0.4; if (H.drain >= 1) { H.ghost = H.shown; H.drain = -1; } else H.ghost = H.drainFrom + (H.shown - H.drainFrom) * inOutQuad(H.drain); }
    if (rm && H.hold > 0) { H.ghost = H.shown; H.hold = 0; }
    if (H.rose >= 0) { H.roseT = Math.min(1, H.roseT + dt / 0.3); if (H.roseT >= 1) { H.shown = H.rose; H.rose = -1; H.ghost = Math.min(H.ghost, H.shown); } }
    if (H.ghost < H.shown) H.ghost = H.shown;
    // ---- write only when a layer moves by half a pixel or more (the bar is about 360 px wide)
    const wr = (el, v, key, o) => { if (Math.abs(v - o[key]) > 0.0014 || (v === 0 && o[key] !== 0) || (v === 1 && o[key] !== 1)) { o[key] = v; el.style.transform = 'scaleX(' + v.toFixed(4) + ')'; } };
    wr(this.xFill, X.shown, 'w', X); wr(this.xGhost, X.ghost, 'gw', X);
    wr(this.hFill, H.shown, 'w', H); wr(this.hGhost, H.ghost, 'gw', H);
    const rv = H.rose >= 0 ? H.roseFrom + (H.rose - H.roseFrom) * H.roseT : 0; wr(this.hRose, rv, 'rw', H);
    this.xGlint.style.opacity = X.glint; this.xGlint.style.left = (X.shown * 100) + '%';
  }
}
