// The Thor bottom screen's ride panel (approved mock design/mocks/thor-ride-panel.dc.html). It reads the running game in the top screen ten times a second and only reads:
// Flow and the open combo, the trick chain, which buttons do something this second, each summon's answer and cooldown, the chorus strike meter, the balance needle, the line ahead, the board.
// On foot it shows the run board instead. Tapping the small map opens the full map in the top screen without pausing.
import { ANSWERS } from '../data/answers.js';
import { BOARDS } from '../data/boards.js';
import { MONSTERS, FUSIONS } from '../data/cards.js';
import { railsNear, kickersNear } from '../sim/rails.js';
const $ = id => document.getElementById(id), hex = c => '#' + c.toString(16).padStart(6, '0');
const top = () => { try { const f = window.parent.document.getElementById('top'); return f && f.contentWindow && f.contentWindow.__ds; } catch (e) { return null; } };
const comboValue = c => Math.round(c.pts * Math.max(1, Object.keys(c.names).length));
const ART = { fire: 'linear-gradient(160deg, #ff9a3c, #7a2a14)', lightning: 'linear-gradient(160deg, #d9f4ff, #3a5a7a)' };
const ON = { grind: 'Grind', flip: 'Flip', grab: 'Grab', spin: 'Spin', land: 'Land', air: 'Big air', manual: 'Manual', seal: 'Seal' };
let lastBail = 0, mapOpenAt = 0;
$('map').addEventListener('click', () => { const D = top(); if (D && D.toggleMap) D.toggleMap(true); mapOpenAt = performance.now(); });

function tick() {
  const D = top(), g = D && D.game; if (!g || !g.p) return;
  const r = g.p.ride, riding = !!(r && r.on); document.body.classList.toggle('foot', !riding); if (!riding) return;
  const F = g.rflow || { step: 1 }, air = !g.p.grounded && !r.grind;
  // Flow, combo, chain
  $('flow').textContent = 'x' + F.step; [...$('segs').children].forEach((s, i) => s.classList.toggle('on', i < F.step));
  const v = r.combo ? comboValue(r.combo) : 0; $('combo').textContent = v ? '+' + v.toLocaleString('en-US') : '0';
  const list = (r.combo && r.combo.list) || []; $('chips').innerHTML = list.slice(-5).map((n, i, a) => (i ? '<span class="plus">+</span>' : '') + '<span class="chip' + (i === a.length - 1 ? ' new' : '') + '">' + n + '</span>').join('');
  $('chainHint').textContent = r.grind ? 'Hop off the rail to keep the chain going' : r.manual ? 'Hold the manual, ollie out' : air ? 'Land it to bank and slam' : list.length ? 'Land it to bank and slam' : 'Ollie to start a chain';
  if (r.bailT > 0 && performance.now() - lastBail > 800) lastBail = performance.now(); $('flowBox').classList.toggle('bail', performance.now() - lastBail < 500);       // the only red: a bail flash
  // buttons: the row glows when it does something this second (the classic pad layout)
  const railNear = air && railsNear(g, g.p.x, g.p.z, 3).length > 0, moves = [
    ['A', 'Ollie', 'Hold, let go to pop', g.p.grounded && !r.manual],
    ['Y', 'Grind', railNear ? 'Rail in reach: press now' : 'Near a rail, ledge or edge', railNear || !!r.grind],
    ['X', 'Flip', 'In the air, with a direction', air && !(r.flipT > 0)],
    ['B', 'Grab', 'In the air, hold with a direction', air],
    ['L1 R1', 'Spin', 'Hold in the air', air],
    ['Up Dn', 'Manual', 'Up then down quickly as you land', (air && g.p.vy < 0) || (g.p.grounded && list.length > 0)]
  ];
  $('moves').innerHTML = moves.map(([k, n, h, hot]) => '<div class="mv' + (hot ? ' hot' : '') + '"><span class="k">' + k + '</span><div><div class="n">' + n + '</div><div class="h">' + h + '</div></div></div>').join('');
  // summons and their answers
  const cd = g.ansCd || {}; $('summons').innerHTML = (g.field.monsters || []).filter(Boolean).map(m => { const Dd = MONSTERS[m.id] || FUSIONS[m.id], A = ANSWERS[m.id] || [], a = A[0], el = (Dd.elements || [])[0] || 'fire';
    const left = a ? Math.max(0, (cd[m.id + 0] || 0) - g.t) : 0, ready = left <= 0.05;
    return '<div class="sm"><div class="art" style="background:' + (ART[el] || ART.fire) + '"></div><div><div class="n">' + Dd.name + '</div><div class="h">Answers <b>' + A.map(q => ON[q.on]).join(' and ') + '</b>' + (a ? ': ' + a.text.replace(/^[^:]*:\s*/, '') : '') + '</div></div><span class="st' + (ready ? ' ready' : '') + '">' + (ready ? 'READY' : left.toFixed(1) + ' s') + '</span></div>'; }).join('');
  // chorus strike: a banked combo of 600 or more, at most every 6 s
  const wait = Math.max(0, (r.volleyT || -9) + 6 - g.t), frac = Math.min(1, v / 600); $('chorusFill').style.width = Math.round((wait > 0 ? 0 : frac) * 100) + '%';
  $('chorusTxt').textContent = wait > 0 ? 'Recharging, ' + wait.toFixed(1) + ' s' : frac >= 1 ? 'Ready: land it and every summon fires.' : 'Build a combo of 600 and land it';
  // balance needle on a grind or a manual
  const bal = r.grind || r.manual ? Math.max(-1, Math.min(1, r.bal || 0)) : 0; $('bal').classList.toggle('off', !(r.grind || r.manual)); $('needle').style.left = (50 + bal * 45) + '%';
  $('balLab').textContent = r.grind ? 'GRIND BALANCE' : r.manual ? 'MANUAL BALANCE' : 'BALANCE'; $('balTxt').textContent = r.grind ? 'Steer to hold the needle in the middle' : r.manual ? 'Stick up or down to hold it' : 'Shows on a grind or a manual';
  // the line ahead: kickers, rails and ledges within 80 m in front, drawn from above with the card at the bottom
  const hx = Math.sin(r.heading), hz = Math.cos(r.heading), px = g.p.x, pz = g.p.z, pts = [], toMap = (x, z) => { const dx = x - px, dz = z - pz, f = dx * hx + dz * hz, s = dx * hz - dz * hx; return f > 2 && f < 80 && Math.abs(s) < 30 ? [150 + s * 4.6, 100 - f * 1.15, f] : null; };
  for (const k of kickersNear(g, px + hx * 40, pz + hz * 40, 45)) { const q = toMap(k[0], k[2]); if (q) pts.push(['k', q]); }
  for (const s of railsNear(g, px + hx * 40, pz + hz * 40, 45)) { const a = toMap(s[0], s[2]), b = toMap(s[3], s[5]); if (a && b) pts.push(['r', a, b, s[6] || 'beam']); }
  pts.sort((a, b) => a[1][2] - b[1][2]); const near = pts[0];
  $('map').innerHTML = '<rect x="0" y="0" width="300" height="110" rx="12" fill="#1a1520"></rect><path d="M150 104 L150 6" stroke="#5a4c3a" stroke-width="12" stroke-linecap="round"></path><path d="M150 104 L150 6" stroke="#e0b765" stroke-width="2" stroke-dasharray="6 6"></path>' +
    pts.slice(0, 14).map(p => p[0] === 'k' ? '<rect x="' + (p[1][0] - 7).toFixed(0) + '" y="' + (p[1][1] - 5).toFixed(0) + '" width="14" height="10" rx="2" fill="#e0b765"></rect>' : '<line x1="' + p[1][0].toFixed(0) + '" y1="' + p[1][1].toFixed(0) + '" x2="' + p[2][0].toFixed(0) + '" y2="' + p[2][1].toFixed(0) + '" stroke="#e0b765" stroke-width="4" stroke-linecap="round"></line>').join('') + '<polygon points="144,104 156,104 150,94" fill="#fff4dc"></polygon>';
  $('mapTxt').textContent = near ? (near[0] === 'k' ? 'Kicker' : near[3] === 'ledge' ? 'Ledge' : near[3] === 'pole' ? 'Pole' : 'Rail') + ' in ' + Math.round(near[1][2]) + ' m' + (pts.length > 1 ? ', ' + (pts.length - 1) + ' more ahead' : '') : 'Open ground ahead';
  // the board
  const B = BOARDS[(g.opts && g.opts.board) || 'plain-back'] || BOARDS['plain-back']; $('boardName').textContent = B.name; $('boardLean').textContent = B.text;
  $('boardCard').style.background = 'radial-gradient(circle at 50% 45%, #fff0c4 0 14px, ' + hex(B.edge) + ' 15px 18px, ' + hex(B.face) + ' 19px 100%)'; $('boardCard').style.borderColor = hex(B.edge);
}
setInterval(tick, 100);
