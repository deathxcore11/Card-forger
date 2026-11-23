// The chest reveal. A chest never shows its rarity from outside: you find out when you open it. The sim has already rolled the tier (seeded loot stream) and paused for the offer;
// this plays the build-up on top of it, about 1.6 to 2.4 s: the lid rattles, light leaks through the seams and steps up white, blue, violet, gold with a rising tone on each step,
// then stops on the rolled tier. Rare stops early, epic gets one extra beat, legendary freezes, bursts gold and lights the screen edge. About one opening in six flickers to the next tier and falls back.
// A second press skips it once you have seen one. Reduce motion shortens it and drops the shake. View only: nothing here can change what the chest gave.
const COLS = ['#f4f4f4', '#5b9bd5', '#a974e0', '#ffcf4a'], STEP = { rare: 1, epic: 2, legendary: 3 };
let ctx = null;
export function tone(f, dur, vol, type, glide) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type || 'triangle'; o.frequency.setValueAtTime(f, ctx.currentTime); if (glide) o.frequency.exponentialRampToValueAtTime(glide, ctx.currentTime + dur);
    gn.gain.setValueAtTime(vol, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur); o.connect(gn); gn.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  } catch (e) { /* no audio: the reveal still plays */ }
}
let seen = false; try { seen = localStorage.getItem('ds_reveal_seen') === '1'; } catch (e) { /* storage blocked */ }

// tier: 'rare' | 'epic' | 'legendary' (anything lower plays as rare). opts.rm: reduce motion. onDone runs once, when the sequence ends or is skipped.
export function playReveal(tier, opts, onDone) {
  opts = opts || {}; const rm = !!opts.rm, stop = STEP[tier] || 1, near = !opts.noNearMiss && stop < 3 && (opts.nearMiss !== undefined ? opts.nearMiss : Math.random() < 1 / 6);
  const el = document.createElement('div'); el.id = 'reveal'; el.className = 'reveal';
  el.innerHTML = '<div class="rvEdge"></div><div class="rvChest"><div class="rvLid"></div><div class="rvBody"></div><div class="rvSeam"></div></div><div class="rvTxt"></div>';
  document.body.appendChild(el); const seam = el.querySelector('.rvSeam'), edge = el.querySelector('.rvEdge'), chest = el.querySelector('.rvChest'), txt = el.querySelector('.rvTxt');
  let done = false, timers = [], t0 = 0; const at = (ms, fn) => timers.push(setTimeout(fn, ms * (rm ? 0.45 : 1)));
  const light = i => { const c = COLS[i]; seam.style.background = c; seam.style.boxShadow = '0 0 ' + (24 + i * 22) + 'px ' + (6 + i * 7) + 'px ' + c; seam.style.opacity = 1; chest.dataset.tier = i; tone(330 * Math.pow(1.26, i * 2), 0.28, 0.12 + i * 0.03); };
  const finish = () => { if (done) return; done = true; timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey, true); el.removeEventListener('pointerdown', onPress); try { localStorage.setItem('ds_reveal_seen', '1'); seen = true; } catch (e) { /* ok */ } el.classList.add('out'); setTimeout(() => el.remove(), 160); onDone && onDone(tier); };
  const onPress = e => { e.preventDefault(); if (seen) finish(); }, onKey = e => { e.stopPropagation(); e.preventDefault(); if (seen && !e.repeat) finish(); };
  el.addEventListener('pointerdown', onPress); document.addEventListener('keydown', onKey, true);
  if (!rm) chest.classList.add('rattle');
  // the build-up: white at 0.45 s, then a step every 0.35 s up to the rolled tier
  at(450, () => light(0));
  const steps = [450]; for (let i = 1; i <= stop; i++) { const ms = 450 + i * 350; steps.push(ms); at(ms, () => light(i)); }
  let end = steps[steps.length - 1];
  if (near) { at(end + 300, () => light(stop + 1)); at(end + 560, () => { light(stop); }); end += 700; }
  if (tier === 'epic') end += 350;                                                  // epic: one extra beat
  if (tier === 'legendary') {
    at(end + 40, () => { chest.classList.remove('rattle'); chest.classList.add('freeze'); tone(110, 0.9, 0.22, 'sawtooth', 55); });        // a short freeze, then the burst
    at(end + 300, () => { chest.classList.remove('freeze'); el.classList.add('burst'); edge.style.opacity = 1; tone(660, 0.6, 0.18, 'triangle', 1320); txt.textContent = 'LEGENDARY'; txt.style.color = COLS[3]; });
    end += 900;
  } else { at(end + 80, () => { chest.classList.remove('rattle'); txt.textContent = tier === 'epic' ? 'EPIC' : 'RARE'; txt.style.color = COLS[stop]; }); end += tier === 'rare' ? 800 : 420; }
  at(end, finish);
  t0 = performance.now(); return { skip: finish, total: end * (rm ? 0.45 : 1), el };
}

