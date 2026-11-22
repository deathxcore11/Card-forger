// First lessons and "what happened" lines for Lost Memories. Pure functions over engine state, so Node tests
// can call them. Nothing here changes a rule: a lesson only points at a play the engine already allows, and it
// never shows what a meld makes (the Codex rule stands: a result shows only once the player has found it).
import { planChain, forecast } from '../engine/duel.mjs';
import { roleOf } from '../engine/cards.mjs';

export const LESSONS = ['meld', 'fuel', 'single'];
export const learnedAll = () => ({ meld: 1, fuel: 1, single: 1 });

// The lesson this hand can teach, or null. `tips` holds the lessons already learned.
// Returns { kind, cards: [hand indexes in tap order] }.
export function lessonFor(db, duel, tips = {}) {
  const hand = duel.hand[0], atk = i => db.byId.get(hand[i].id).atk;
  const mons = [], fuel = [];
  hand.forEach((c, i) => { if (!c) return; if (db.isMonster(c.id)) mons.push(i); else if (roleOf(db, c.id) === 'fuel') fuel.push(i); });
  if (!mons.length) return null;
  if (duel.mon && !duel.mon[0].some(m => !m)) return null; // every lesson is a play from the hand to an empty zone: with the table full there is none to teach
  const strongest = mons.reduce((a, b) => (atk(b) > atk(a) ? b : a));
  // the best two-monster meld that does not fizzle and beats every single card in the hand
  let best = null;
  for (const i of mons) for (const j of mons) {
    if (i === j) continue;
    const p = planChain(db, [hand[i], hand[j]], null);
    if (p.fizzles || !p.melded || !p.isMonster) continue;
    const a = db.byId.get(p.final.id).atk;
    if (a > atk(strongest) && (!best || a > best.atk)) best = { kind: 'meld', cards: [i, j], atk: a };
  }
  if (!tips.meld) return best ? { kind: 'meld', cards: best.cards } : null;
  if (!tips.fuel && fuel.length) {
    const p = planChain(db, [hand[strongest], hand[fuel[0]]], null);
    if (p.steps.length === 1 && p.steps[0].kind === 'fuel') return { kind: 'fuel', cards: [strongest, fuel[0]] };
  }
  // The third lesson. It used to say that nothing in the hand made more than the strongest monster, after looking only
  // at pairs of monsters; an Equip or fuel in the hand made that false (reported 21 November 2026: Blue-Eyes with Dragon
  // Treasure). Almost every hand holds something that adds, so the lesson now says the true thing it was for: this one
  // card already beats every monster the rival shows, so the rest of the hand can be kept.
  if (!tips.single && enoughAlone(db, duel, hand[strongest].id)) return { kind: 'single', cards: [strongest] };
  return null;
}
// True when the rival has at least one monster, shows them all, and this card played alone in attack would destroy each
// of them in battle and survive it (terrain, Equips on their side and the attribute wheel counted, as the forecast does).
export function enoughAlone(db, duel, id) {
  const theirs = (duel.mon && duel.mon[1] || []).filter(Boolean);
  if (!theirs.length || theirs.some(m => m.veil)) return false;
  return theirs.every(m => { const f = forecast(duel, db, 0, { id, pos: 'a' }, 1, m); return f.killT && !f.killX; });
}

// What the player's own events teach: a real meld, a fuel step. `single` is marked by the page when the player
// plays one card while that lesson is on screen.
export function learnFrom(tips, evs) {
  let changed = false;
  for (const e of evs) if (e.e === 'meld' && e.seat === 0) {
    if ((e.kind === 'printed' || e.kind === 'cross') && !tips.meld) { tips.meld = 1; changed = true; }
    if (e.kind === 'fuel' && !tips.fuel) { tips.fuel = 1; changed = true; }
  }
  return changed;
}

export function lessonText(kind, names) {
  if (kind === 'meld') return ['First lesson: melding', `Tap ${names[0]}, then ${names[1]}, then Play. Two monsters become one, and these two make something stronger than either. What it is, you find out by doing it.`];
  if (kind === 'fuel') return ['Second lesson: fuel', `${names[1]} does nothing on its own, but melded onto a monster it adds +300 ATK and DEF. Tap ${names[0]}, then ${names[1]}, then Play.`];
  return ['Third lesson: one card can be enough', `${names[0]} alone already beats every monster the rival has on the table. Play it alone and keep the rest: your hand refills up to two cards a turn, and the cards you keep can make a bigger meld when you need one.`];
}

// ---- what happened in a lost duel ----
// The page keeps a note of what it showed during the duel. A note begun part-way (a page reload) is `partial`
// and the lines that compare whole-duel numbers are left out.
export const newNote = partial => ({ partial: !!partial, myBest: 0, rivalBest: 0, melds: 0, fizzles: 0, singles: 0, directHits: 0, lost: 0 });
export function noteFrames(note, frames) {
  for (const f of frames) {
    for (const m of f.view.mon[0]) if (m && m.ea > note.myBest) note.myBest = m.ea;
    for (const m of f.view.mon[1]) if (m && !m.veil && m.ea > note.rivalBest) note.rivalBest = m.ea;
    for (const e of f.evs) {
      if (e.e === 'meld' && e.seat === 0) { if (e.kind === 'fizzle') note.fizzles++; else if (e.kind === 'printed' || e.kind === 'cross') note.melds++; }
      if (e.e === 'summon' && e.seat === 0 && !e.melded) note.singles++;
      if (e.e === 'battle' && e.direct && e.atkSeat === 1) note.directHits++;
      if (e.e === 'lp' && e.seat === 0 && e.d < 0) note.lost += -e.d;
    }
  }
  return note;
}
const LAW_ANSWER = {
  scorched: 'The duel is fought on his ground. A Field Spell of your own replaces it for a while, and his monsters lose what it gives them.',
  stonewall: 'Her monsters win ties. Attack only when your number is higher, not equal.',
  bloodprice: 'Each monster of yours he destroys in battle heals him. Do not leave weak monsters where he can reach them.',
  mist: 'His monsters arrive veiled. Attack a veiled monster with your strongest, never with a weak one.',
  tyranny: 'Your hand is smaller here, so a long meld empties it. Shorter melds keep cards coming.',
  end: 'His ace arrives on a set turn. Count his turns: win before it, or keep a card that removes a monster.',
  alone: 'A monster in defense does not keep your Life Points safe here: what it loses, you lose. Meet its one monster with a stronger one, or remove it.',
};
export const lawAnswer = law => LAW_ANSWER[law] || '';
// Up to three short lines. `sum` is the duel summary (reason, turns), `rival` has name, tier and law.
export function whyLost(note, sum, rival = {}) {
  const out = [];
  if (sum && sum.reason === 'deckout') out.push('Your deck ran out: you could not draw at the start of your turn.');
  if (note && !note.partial) {
    if (note.rivalBest >= note.myBest + 300 && note.rivalBest) out.push(`Their strongest monster stood at ${note.rivalBest} ATK. Yours reached ${note.myBest}. A longer meld, an Equip or your own Field Spell closes that gap.`);
    if (!note.melds) out.push('You did not meld this duel. Single monsters rarely hold against a rival that melds.');
    else if (note.fizzles >= 2) out.push(`${note.fizzles} of your melds fizzled and cost you a card each. A meld you have found before shows its result before you play it.`);
    if (note.directHits >= 2) out.push(`${note.directHits} attacks reached you directly. A rival cannot attack you directly while you have a monster on the table, and one in defense protects your Life Points.`);
  }
  if (rival.law && LAW_ANSWER[rival.law]) out.push(LAW_ANSWER[rival.law]);
  return out.slice(0, 3);
}
