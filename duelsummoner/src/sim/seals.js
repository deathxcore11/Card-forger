// Oath seals (see data/seals.js): feats done in a normal run (a full run with no Oath sworn) crack a seal. All of it is bookkeeping on g.sealT; nothing here changes how the run plays.
// A crack emits 'sealcrack' with the Oath id (the view shows "A seal cracks..."), and the id is listed in the run report so the results screen and the save can unseal it.
import { SEAL_LIMITS as L } from '../data/seals.js';

export function sealInit(g) { g.sealT = { cracked: [], summonKills: 0, handKills: 0, stage: { dashes: 0, spent: 0, mapOpened: false, lastHitSc: -1 } }; }
export function sealStageStart(g) { if (g.sealT) g.sealT.stage = { dashes: 0, spent: 0, mapOpened: false, lastHitSc: -1 }; }
export function sealHit(g) { if (g.sealT) g.sealT.stage.lastHitSc = g.sc || 0; }
export function sealDash(g) { if (g.sealT) g.sealT.stage.dashes++; }
export function sealSpend(g, coins) { if (g.sealT && coins > 0) g.sealT.stage.spent += coins; }
export function sealMapOpened(g) { if (g.sealT) g.sealT.stage.mapOpened = true; }
const normal = g => g.mode === 'run' && !g.oathList.length;       // a normal run: a full run with no Oath sworn
function crack(g, id) { const T = g.sealT; if (!T || !normal(g) || T.cracked.includes(id)) return; T.cracked.push(id); g.event('sealcrack', id); }

// a kill: cls is the damage source class from the ledger (0 summon or fusion, 1 your card throws; traps, spells and items count for neither side)
export function sealKill(g, cls) {
  const T = g.sealT; if (!T || !normal(g)) return; if (cls === 0) T.summonKills++; else if (cls === 1) T.handKills++;
  if (T.summonKills >= L.peaceSummonKills && T.handKills < L.peaceHandKills) crack(g, 'peace');
}
// the stage boss has fallen (the stage is cleared): last = it was the final stage
export function sealGateCleared(g, last) {
  const T = g.sealT; if (!T || !normal(g)) return; const S = T.stage, sc = g.sc || 0;
  if (sc - Math.max(0, S.lastHitSc) >= L.glassSeconds && sc >= L.glassSeconds) crack(g, 'glass');       // no damage for the last 3 minutes before the clear
  if (g.gateOpenedAt >= 0 && g.gateOpenedAt < L.hastySeconds) crack(g, 'hasty');
  const m0 = g.field && g.field.monsters && g.field.monsters[0]; if (m0 && m0.level === 1) crack(g, 'small');
  if (S.dashes === 0) crack(g, 'still');
  if (!S.mapOpened) crack(g, 'blind');
  if (S.spent === 0) crack(g, 'pauper');
  if (last && g.stagesCleared >= 3 && g.t < L.swiftSeconds) crack(g, 'swift');
}
