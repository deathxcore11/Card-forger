// The day's log-in reward as a full-screen pop-up, the website's copy of the app's LoginReward.kt (Console look, owner's pick
// of 14 Nov 2026). The server stamps and pays the day on the login call (fresh only on the first visit of the day); Claim lifts
// the rewards toward the purse and closes. Shape: {day, stamp 1..7, month, reward, monthReward}. No descriptions.
import {coinIcon, sealIcon, packIcon, econDefs} from './play-econ-ui.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('en-US');
const SEAL = {c: 'common', u: 'uncommon', r: 'rare', m: 'mythic'};

/** A reward as pieces: [{kind, key, count, label}], coins first, then seals, then packs. */
export function rewardPieces(r) {
  const out = [];
  if (!r) return out;
  if (r.coins > 0) out.push({kind: 'coin', key: 'coin', count: r.coins, label: 'coins'});
  for (const [k, v] of Object.entries(r.seals || {})) if (v > 0) out.push({kind: 'seal', key: 'seal:' + k, seal: k, count: v, label: SEAL[k] || k});
  if (r.packs > 0) out.push({kind: 'pack', key: 'pack', count: r.packs, label: r.packs === 1 ? 'pack' : 'packs'});
  return out;
}

/** The day's pieces and the month's bonus as one list: 2 packs and 3 packs are one medal of 5 packs. */
export function mergedPieces(...lists) {
  const by = new Map();
  for (const p of lists.flat()) { const had = by.get(p.key); by.set(p.key, had ? {...had, count: had.count + p.count} : {...p}); }
  return [...by.values()].map(p => p.kind === 'coin' ? {...p, label: p.count === 1 ? 'coin' : 'coins'} : p.kind === 'pack' ? {...p, label: p.count === 1 ? 'pack' : 'packs'} : p);
}

/** "Monthly bonus included: 3 of the 5 packs." The month's part is named, never a medal of its own. */
export function bonusLine(month, all) {
  if (!month.length) return '';
  return 'Monthly bonus included: ' + mergedPieces(month).map(m => {
    const whole = all.find(a => a.key === m.key);
    return whole && whole.count > m.count ? `${n(m.count)} of the ${n(whole.count)} ${whole.label}` : `${n(m.count)} ${m.label}`;
  }).join(', ') + '.';
}

/** How many medals share a row: as even as they can be, four at most (five are three over two, never four over one). */
export function medalRows(count, most = 4) {
  const c = Math.max(1, count), lines = Math.ceil(c / most);
  return Math.ceil(c / lines);
}

const icon = p => p.kind === 'coin' ? coinIcon() : p.kind === 'seal' ? sealIcon(p.seal) : packIcon;

/** The pop-up's markup. */
export function dailyLoginMarkup(login) {
  const stamp = Math.max(1, Math.min(7, Number(login?.stamp) || 1));
  const month = rewardPieces(login?.monthReward);
  const all = mergedPieces(rewardPieces(login?.reward), month);
  const bonus = bonusLine(month, all);
  const per = medalRows(all.length);
  const medals = all.map((p, i) => `<li class="dl-medal" style="--i:${i}"><span class="dl-coin">${icon(p)}</span><b>${n(p.count)}</b><small>${esc(p.label)}</small></li>`).join('');
  const track = Array.from({length: 7}, (_, i) => `${i ? `<i class="dl-link${i < stamp ? ' on' : ''}"></i>` : ''}<span class="dl-dot${i < stamp ? ' on' : ''}${i === stamp - 1 ? ' now' : ''}">${i + 1}</span>`).join('');
  const said = 'Today: ' + all.map(p => `${n(p.count)} ${p.label}`).join(', ') + '.';
  return `<div class="dl-veil" role="dialog" aria-modal="true" aria-labelledby="dlDay" aria-describedby="dlSaid">${econDefs}<div class="dl-rays" aria-hidden="true"></div>
<div class="dl-sheet"><div class="dl-head"><small class="dl-kicker">Daily log-in</small><h2 id="dlDay" class="dl-day">Day ${stamp}</h2><small class="dl-sub">${stamp >= 7 ? 'The week is complete' : 'Welcome back'}</small></div>
<ul class="dl-medals" style="--per:${per}" aria-label="${esc(said)}">${medals}</ul><p id="dlSaid" class="dl-sr">${esc(said)}</p>
<div class="dl-track" role="img" aria-label="Day ${stamp} of 7">${track}</div>
${bonus ? `<p class="dl-bonus">${esc(bonus)}</p>` : ''}<button type="button" class="btn primary dl-claim">Claim</button></div></div>`;
}

/** Show the pop-up once; resolves when it has closed. Esc, Back and Claim all claim (the day is already paid). */
export function showDailyLogin(login, {doc = globalThis.document, sound = null} = {}) {
  if (!doc?.body || !login) return Promise.resolve(false);
  doc.querySelector('.dl-host')?.remove();
  const host = doc.createElement('div');
  host.className = 'dl-host';
  host.innerHTML = dailyLoginMarkup(login);
  doc.body.append(host);
  const before = doc.activeElement;
  const btn = host.querySelector('.dl-claim');
  const still = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return new Promise(done => {
    let leaving = false;
    const close = () => { doc.removeEventListener('keydown', key, true); host.remove(); try { before?.focus?.(); } catch {} done(true); };
    const claim = () => {
      if (leaving) return; leaving = true;
      btn.disabled = true;
      try { sound?.('reward-claim'); } catch {}
      if (still) return close();
      host.classList.add('dl-lift');
      setTimeout(() => { host.classList.add('dl-out'); setTimeout(close, 180); }, 520);
    };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); claim(); }
      else if (e.key === 'Tab') { e.preventDefault(); btn.focus(); }
    };
    doc.addEventListener('keydown', key, true);
    btn.addEventListener('click', claim);
    requestAnimationFrame?.(() => host.classList.add('dl-in'));
    btn.focus({preventScroll: true});
  });
}
