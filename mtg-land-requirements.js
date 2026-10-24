// Commander prerequisites that name a land subtype ("Whenever a Desert you
// control enters", "play Desert lands from your graveyard"). Generic landfall,
// ramp or recursion does not satisfy them: only cards whose printed text puts,
// finds, grants or recycles that subtype count, each with its supporting clause.
// Coverage: nonbasic land subtypes only (Scryfall catalog/land-types, 2026-10-24).
// Creature types use the tribal plan; other subtypes are not modeled here.
import { rulesText, typeText, isLand, cardKey } from './core.js';
import { atLeastOne } from './deckaudit.js';

export const LAND_SUBTYPES = Object.freeze(['Cave','Cloud','Desert','Gate','Lair','Locus','Mine','Planet','Power-Plant','Sphere','Tower','Town',"Urza's"]);
// Declared construction targets, not universal deck rules. Access is the chance
// to see at least one enabler in the first `seen` library cards (opening seven
// plus four draws, no mulligan); tutors, extra draws and sequencing are excluded.
export const LAND_REQUIREMENT_POLICY = Object.freeze({
 seen:11,
 commander:Object.freeze({target:12,minimum:8,accessTarget:.6}),
 constructed:Object.freeze({target:8,minimum:6,accessTarget:.6}),
 // Colorless-only subtype lands still have to leave a castable mana base.
 colorlessShare:.25,
 setupMinimum:2,
});
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const word = s => '\\b'+esc(s)+'s?\\b';
const plural = s => s.endsWith('s')?s:s+'s';
const OPPONENT = /\b(?:an? opponents?|opponents?|each player|target player|defending player|its controller|their controller)\b/i;
function ownText(c) {
 // Ability words ("Mine Vibranium — …") label an ability; they are not subtypes.
 let text = rulesText(c).replace(/\([^)]*\)/g,' ').replace(/^[^.\n—]{1,40} — /gm,'');
 // Rules text often uses the short name: "Cloud" for "Cloud, Ex-SOLDIER".
 for (const name of [c?.name,...(c?.card_faces||[]).map(f=>f.name)].filter(Boolean).flatMap(n=>n.split(' // ')).flatMap(n=>[n,n.split(',')[0].trim()]).filter(Boolean).sort((a,b)=>b.length-a.length))
  text = text.replace(new RegExp(esc(name),'gi'),'this card');
 return text;
}
const clauses = c => ownText(c).split(/[.\n]/).map(s=>s.trim()).filter(Boolean);
const typeLines = c => c?.card_faces?.length ? c.card_faces.map(f=>f.type_line||'') : [typeText(c)];
export function hasLandSubtype(c, subtype) {
 return typeLines(c).some(line=>/\bLand\b/.test(line)&&new RegExp('(?:^|\\s)'+esc(subtype)+'(?:$|\\s)').test(line.split('—')[1]||''));
}

// What the commander itself requires. A trigger on another player's subtype
// entering, or a landwalk keyword, is not a construction requirement.
export function commanderLandRequirements(commander) {
 if (!commander || isLand(commander)) return [];
 const out = [];
 for (const subtype of LAND_SUBTYPES) {
  const s = word(subtype), roles = [];
  for (const clause of clauses(commander)) {
   // Rules text capitalizes subtypes; "town" or "mine" in prose is not one.
   if (!new RegExp(s).test(clause)) continue;
   if (/\ban opponent controls\b|\bopponents? control\b/i.test(clause)) continue;
   const mine = /\byou control\b|\bunder your control\b/i.test(clause);
   if (mine && new RegExp('(?:when|whenever)[^.]*'+s+'[^.]*\\benters?\\b','i').test(clause)) roles.push({kind:'enters',text:clause});
   else if (new RegExp('\\bplay\\b[^.]*'+s+'[^.]*\\bfrom your graveyard\\b|'+s+'(?: lands?| cards?)? (?:(?:are|is) put )?(?:in|into|from) your graveyard','i').test(clause)) roles.push({kind:'graveyard',text:clause});
   else if (mine || new RegExp('\\b(?:for each|number of|if you control|as long as you control)\\b[^.]*'+s,'i').test(clause)) roles.push({kind:'control',text:clause});
  }
  if (roles.length) out.push({subtype,roles,primary:roles.some(r=>r.kind!=='graveyard')?'battlefield':'graveyard',commander:commander.name});
 }
 return out;
}

// Roles a single card plays for one land subtype. Each role keeps its clause.
export function landSubtypeRoles(c, subtype) {
 if (!c?.name) return [];
 const s = word(subtype), out = [], land = isLand(c);
 if (hasLandSubtype(c,subtype)) {
  out.push({kind:'source',text:`${typeLines(c).find(l=>/\bLand\b/.test(l))}`});
  // A subtype land that can leave for your graveyard sets up graveyard replay.
  const self = (c.keywords||[]).includes('Cycling') ? 'Cycling' : clauses(c).find(t=>/\bsacrifice this (?:card|land)\b/i.test(t));
  if (self) out.push({kind:'setup',text:self});
 }
 for (const clause of clauses(c)) {
  if (OPPONENT.test(clause) && !/\bif an opponent controls more lands than you\b/i.test(clause)) continue;
  const named = new RegExp(s).test(clause);
  if (/\blands you control\b[^.]*\bare\b[^.]*/i.test(clause) && named) {out.push({kind:'grant',text:clause});continue;}
  const search = /\bsearch your library for\b/i.test(clause);
  if (search) {
   const specific = named, generic = /\b(?:a|an|up to \w+) land cards?\b/i.test(clause.replace(/\bbasic land cards?\b/gi,''));
   if (specific || generic) out.push({kind:/onto the battlefield/i.test(clause)?'fetch':'tutor',text:clause,generic:!specific,conditional:/\bif\b/i.test(clause)});
   continue;
  }
  if (new RegExp('\\b[Ss]acrifice (?:a|an|another) (?:'+esc(subtype)+'|land)\\b').test(clause)) {out.push({kind:'setup',text:clause});continue;}
  if (!land && named) out.push({kind:'payoff',text:clause});
 }
 return out;
}

const policyFor = libraryCards => libraryCards >= 90 ? LAND_REQUIREMENT_POLICY.commander : LAND_REQUIREMENT_POLICY.constructed;
export function landRequirementTargets(commander, size = 100) {
 return commanderLandRequirements(commander).map(r=>({...r,target:policyFor(size-1).target}));
}

// Final-list gate. Counts are physical library copies; the commander is never
// a draw. A card counts once per role, and once overall toward access.
export function inspectLandRequirements(rows, { commander = '' } = {}) {
 const main = rows.filter(r=>!['side','extra'].includes(r.zone)&&r.card&&r.qty>0),
  lead = main.find(r=>cardKey(r.name||r.card.name)===cardKey(commander))?.card,
  library = main.filter(r=>cardKey(r.name||r.card.name)!==cardKey(commander)),
  N = library.reduce((n,r)=>n+r.qty,0), seen = Math.min(N,LAND_REQUIREMENT_POLICY.seen),
  requirements = commanderLandRequirements(lead), groups = [], issues = [], notes = [];
 for (const req of requirements) {
  const policy = policyFor(N), name = plural(req.subtype), by = kind => library.map(r=>({row:r,roles:landSubtypeRoles(r.card,req.subtype).filter(x=>x.kind===kind)})).filter(x=>x.roles.length);
  const copies = list => list.reduce((n,x)=>n+x.row.qty,0), cards = list => list.map(x=>({name:x.row.name||x.row.card.name,qty:x.row.qty,text:x.roles[0].text,...(x.roles[0].generic?{generic:true}:{}),...(x.roles[0].conditional?{conditional:true}:{})}));
  const sources = by('source'), grants = by('grant'), finders = [...by('fetch'),...by('tutor')].filter(x=>!sources.some(s=>s.row===x.row)), setup = by('setup'), payoffs = by('payoff');
  const sourceCopies = copies(sources), grantCopies = copies(grants), finderCopies = sourceCopies ? copies(finders) : 0;
  const enablers = new Set([...sources,...grants,...(sourceCopies?finders:[])].map(x=>x.row)), enablerCopies = [...enablers].reduce((n,r)=>n+r.qty,0);
  const access = N ? atLeastOne(N,enablerCopies,seen) : 0, landAccess = N ? atLeastOne(N,sourceCopies,seen) : 0;
  const setupCopies = sourceCopies ? copies(setup) : 0;
  const battlefieldOK = enablerCopies >= policy.minimum && (sourceCopies >= Math.ceil(policy.minimum/2) || grantCopies > 0) && access >= policy.accessTarget;
  const recursion = req.roles.some(r=>r.kind==='graveyard'), recursionOK = sourceCopies > 0 && setupCopies >= LAND_REQUIREMENT_POLICY.setupMinimum;
  const status = (req.primary==='battlefield' ? battlefieldOK : battlefieldOK && recursionOK) ? 'supported' : 'insufficient';
  const label = `${req.subtype} plan`;
  groups.push({label,subtype:req.subtype,source:'commander',status,requirements:req.roles,library:N,seen,access,landAccess,
   copies:enablerCopies,sources:{copies:sourceCopies,cards:cards(sources)},grants:{copies:grantCopies,cards:cards(grants)},finders:{copies:finderCopies,cards:sourceCopies?cards(finders):[]},
   setup:{copies:setupCopies,cards:sourceCopies?cards(setup):[]},payoffs:{copies:copies(payoffs),cards:cards(payoffs)},
   recursion:recursion?{status:recursionOK?'supported':'partial'}:null,policy:{...policy,setupMinimum:LAND_REQUIREMENT_POLICY.setupMinimum},
   summary:`${sourceCopies} ${name}, ${finderCopies} ${finderCopies===1?'way':'ways'} to find them${grantCopies?`, ${grantCopies} that make lands ${name}`:''}${recursion?`, ${setupCopies} ${setupCopies===1?'way':'ways'} to put them in your graveyard`:''}. ${Math.round(access*100)}% chance to see at least one in the first ${seen} of ${N} library cards (no mulligan; extra draws and tutors not counted).`});
  if (status !== 'supported') issues.push(`${req.commander} needs ${name}: ${req.roles.map(r=>r.text).join('; ')}. This list has ${sourceCopies} ${name} and ${finderCopies} ways to find them (target at least ${policy.minimum} with ${Math.round(policy.accessTarget*100)}% access${req.primary==='graveyard'?` and ${LAND_REQUIREMENT_POLICY.setupMinimum} ways to put them in your graveyard`:''}). Generic land, landfall and recursion cards do not count.`);
  else if (recursion && !recursionOK) notes.push(`${label}: replaying ${name} from your graveyard has ${setupCopies} way${setupCopies===1?'':'s'} to put one there. That optional route is partial; the ${req.subtype} entering plan is established.`);
 }
 return {status:!requirements.length?'not-applicable':issues.length?'insufficient':'supported',groups,issues,notes,
  method:requirements.length?'Commander land-subtype prerequisites are counted from printed card text: subtype lands, cards that make lands that subtype, and searches that can find one. Generic land, landfall and recursion cards do not satisfy them.':''};
}
