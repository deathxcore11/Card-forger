import {isCheckedComboEvidence} from './commander-combos.js';
import { GAME_CHANGER_SNAPSHOT } from './game-changers.js';

export const BRACKET_NAMES=Object.freeze({1:'Exhibition',2:'Core',3:'Upgraded',4:'Optimized',5:'cEDH'});
export const EVIDENCE_VERSION='commander-evidence-v1';
const key=s=>String(s||'').normalize('NFKC').split(' // ')[0].trim().toLowerCase();
const text=c=>[c?.oracle_text,...(c?.card_faces||[]).map(f=>f.oracle_text)].filter(Boolean).join('\n').replace(/[’]/g,"'");
const names=new Set(GAME_CHANGER_SNAPSHOT.cards.map(c=>key(c.name)));
const ids=new Set(GAME_CHANGER_SNAPSHOT.cards.map(c=>c.oracleId));
export function cardBracketEvidence(card){
 const known=!!card?.name,oracleId=card?.oracle_id||null;
 // Membership is card identity, not a printing property. An undated cached
 // per-printing boolean cannot silently override this dated identity snapshot.
 const gameChanger=known?(oracleId?ids.has(oracleId):names.has(key(card.name))):null;
 const rules=text(card),covered=!!(known&&((!!card.type_line&&typeof card.oracle_text==='string')||card.card_faces?.some(f=>!!f.type_line&&typeof f.oracle_text==='string')));
 const extraTurn=/\btakes? (?:an?|one|two|three|four|\d+) extra turns?\b/i.test(rules);
 const landDenial=/(?:destroy|exile) all (?:nonbasic |basic |snow |nonsnow )?lands\b|return all (?:nonbasic |basic )?lands to their owners|\bsacrifices? (?:all|each) [^.]*\blands?\b|\blands? (?:don't|do not) untap|\b(?:lands|permanents) [^.]*don't untap during/i.test(rules);
 return {version:EVIDENCE_VERSION,oracleId,name:card?.name||'',status:covered?'partial':'incomplete',gameChanger,
  extraTurn:covered?extraTurn:null,massLandDenial:covered?landDenial:null,
  source:GAME_CHANGER_SNAPSHOT.source,listDate:GAME_CHANGER_SNAPSHOT.listDate,guidanceDate:GAME_CHANGER_SNAPSHOT.guidanceDate,
  membershipVersion:GAME_CHANGER_SNAPSHOT.version,coverage:{membership:known?'snapshot':'unknown',effects:covered?'text-patterns':'unknown',combos:'not-checked'}};
}
export function cardBracketBadges(card){
 const e=cardBracketEvidence(card),badges=[];
 if(e.gameChanger)badges.push({kind:'game-changer',label:'Game Changer',detail:`Commander list · ${e.listDate}`,source:e.source});
 if(e.extraTurn)badges.push({kind:'extra-turn',label:'Extra turn',detail:'Card-text signal; repeatable chains need a deck check.'});
 if(e.massLandDenial)badges.push({kind:'land-denial',label:'Mass land denial',detail:'Card-text signal; check conditions and the intended table.'});
 return badges;
}
export function normalizeCommanderTarget(value){
 if(value===undefined||value===null||value===''||value==='any')return null;
 const n=Number(value);if(!Number.isInteger(n)||n<1||n>5)throw Error('Choose a Commander bracket from 1 to 5, or Any.');return n;
}
export function commanderDeckRows(deck={}){
 const out=new Map();
 for(const r of deck.cards||[]){if(!r?.name||!(Number(r.qty)>0))continue;const k=key(r.name),old=out.get(k);out.set(k,{name:r.name,qty:(old?.qty||0)+Number(r.qty)});}
 for(const c of [...(deck.commanders||[]),...(deck.commander?[deck.commander]:[])]){const name=typeof c==='string'?c:c?.name;if(name&&!out.has(key(name)))out.set(key(name),{name,qty:1});}
 return [...out.values()];
}
export function assessCommanderBracket(deck,catalog={},options={}){
 const found={gameChangers:[],tutors:[],extraTurns:[],landDenial:[],fastMana:[],combos:[]},rows=commanderDeckRows(deck),reasons=[],uncertainties=[];
 const indexed=new Map(Object.values(catalog).filter(Boolean).map(c=>[key(c.name),c]));
 let unknown=0;
 for(const row of rows){const c=catalog[key(row.name)]||indexed.get(key(row.name));const e=cardBracketEvidence(c);
  if(!c||e.status==='incomplete'){unknown+=row.qty;}
  if(e.gameChanger)found.gameChangers.push(c.name);
  if(e.extraTurn)found.extraTurns.push(c.name);
  if(e.massLandDenial)found.landDenial.push(c.name);
 }
 let restrictionFloor=1;
 if(found.extraTurns.length){restrictionFloor=2;reasons.push('Extra-turn card-text signal; chains require review');}
 if(found.gameChangers.length){restrictionFloor=found.gameChangers.length>3?4:3;reasons.push(`${found.gameChangers.length} Game Changer${found.gameChangers.length===1?'':'s'}`);}
 if(found.landDenial.length){restrictionFloor=4;reasons.push('Mass land denial detected');}
 const combos=options.combos;
 if(isCheckedComboEvidence(combos,deck)){
  found.combos=combos.included||[];
  for(const combo of found.combos){if(combo.extraTurn||combo.massLandDenial){restrictionFloor=4;reasons.push(combo.extraTurn?'Repeatable extra-turn combination reported':'Mass land denial combination reported');}}
  if(found.combos.some(c=>['R','S'].includes(c.bracketTag)))uncertainties.push('A high-impact combination needs timing and prerequisite review before assigning table fit.');
 }else uncertainties.push('Known combination lookup has not completed. No detection is not proof of absence.');
 if(unknown)uncertainties.push(`${unknown} card copies have incomplete card data.`);
 uncertainties.push('Card-text signals and a membership list do not establish intent, execution speed or cEDH suitability.');
 const target=normalizeCommanderTarget(options.targetBracket??deck.targetBracket),conflict=target!==null&&target<restrictionFloor;
 if(conflict)reasons.push(`Detected restrictions exclude the requested Bracket ${target}.`);
 const bracket=restrictionFloor>=3?restrictionFloor:null;
 return {version:EVIDENCE_VERSION,bracket,restrictionFloor,name:bracket?BRACKET_NAMES[bracket]:'Needs review',targetBracket:target,
  status:unknown?'incomplete':'provisional',confidence:'limited',targetStatus:target===null?'not-requested':conflict?'conflict':'unverified',
  reasons:[...new Set(reasons)],lower:[],found,unknown,uncertainties,
  text:bracket?'Detected restrictions establish a minimum, not the deck’s full table fit.':'Table fit needs intent and engine review; no bracket is inferred from a low Power score.',
  guidanceDate:GAME_CHANGER_SNAPSHOT.guidanceDate,listDate:GAME_CHANGER_SNAPSHOT.listDate,membershipVersion:GAME_CHANGER_SNAPSHOT.version};
}
