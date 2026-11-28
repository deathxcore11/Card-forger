// The feel sliders (?debug): every number in src/data/feel.js on a slider, applied live (applyFeel), with a button that copies the table as text.
// In the ride gym (?gym=1) a control card sits under the health and XP box.
import { FEEL, applyFeel } from '../data/feel.js';
export function feelPanel() {
  const q = location.search;
  if (/[?&]gym=1/.test(q)) { const c = document.createElement('div'); c.id = 'gymCard'; c.textContent = 'Ride Gym  ·  WASD steer  ·  Space ollie  ·  Shift boost  ·  J flip  ·  K grab  ·  L grind  ·  Q/E spin  ·  Ctrl manual  ·  X special'; Object.assign(c.style, { position: 'fixed', left: '16px', top: '156px', zIndex: 35, maxWidth: '420px', padding: '6px 12px', borderRadius: '10px', background: 'rgba(24,20,30,0.62)', border: '1px solid rgba(224,183,101,0.45)', color: '#f3e6c8', font: '600 12px Inter, system-ui, sans-serif', letterSpacing: '0.02em', backdropFilter: 'blur(8px)', lineHeight: '1.5', pointerEvents: 'none' }); document.body.appendChild(c); }       // under the health and XP box, clear of the summon bar
  if (!/[?&]debug/.test(q)) return;
  const box = document.createElement('div'); box.id = 'feelPanel';
  Object.assign(box.style, { position: 'fixed', right: '8px', top: '200px', zIndex: 60, width: '270px', maxHeight: '70vh', overflow: 'auto', padding: '8px', borderRadius: '8px', background: '#120d16ee', border: '1px solid #c9a24a99', color: '#f3e6c8', font: '11px "Courier New", monospace', display: 'none' });
  const tog = document.createElement('button'); tog.textContent = 'FEEL'; Object.assign(tog.style, { position: 'fixed', right: '8px', top: '170px', zIndex: 61, font: '11px monospace' });
  tog.onclick = () => { box.style.display = box.style.display === 'none' ? 'block' : 'none'; };
  let html = '';
  for (const grp of Object.keys(FEEL)) { html += '<div style="color:#e0b765;margin:6px 0 2px">' + grp + '</div>';
    for (const k of Object.keys(FEEL[grp])) { const v = FEEL[grp][k], max = v > 0 ? +(v * 3).toPrecision(3) : 1, step = +(max / 300).toPrecision(2);
      html += '<label style="display:flex;gap:4px;align-items:center"><span style="width:96px">' + k + '</span><input type="range" min="0" max="' + max + '" step="' + step + '" value="' + v + '" data-g="' + grp + '" data-k="' + k + '" style="width:110px"><b data-v="' + grp + '.' + k + '">' + v + '</b></label>'; } }
  html += '<button id="feelCopy" style="margin-top:6px">copy table</button>';
  box.innerHTML = html; document.body.appendChild(box); document.body.appendChild(tog);
  box.addEventListener('input', e => { const el = e.target; if (!el.dataset.g) return; const v = +el.value; FEEL[el.dataset.g][el.dataset.k] = v; box.querySelector('[data-v="' + el.dataset.g + '.' + el.dataset.k + '"]').textContent = v; applyFeel(); });
  box.querySelector('#feelCopy').onclick = () => { try { navigator.clipboard.writeText(JSON.stringify(FEEL, null, 1)); } catch (e) { /* the table is also in the console */ } console.log(JSON.stringify(FEEL, null, 1)); };
}
