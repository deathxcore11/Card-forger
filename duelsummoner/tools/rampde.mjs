import { RAMP, ELEMENTS } from '../src/data/fxramp.js';
const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const lab = h => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, [R, G, B] = rgb(h).map(f), X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, q = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const RES = { gold: 0xe0b765, goldLight: 0xfff0b8, xp: 0x46e0ff, violet: 0xb26bff, danger: 0xff3b30 };
for (const e of ELEMENTS) console.log(e.padEnd(10), RAMP[e].map((c, t) => { const m = Object.entries(RES).map(([n, r]) => [n, dE(c, r)]).sort((a, b) => a[1] - b[1])[0]; return c.toString(16) + ':' + m[0] + ' ' + m[1].toFixed(0); }).join(' | '));
