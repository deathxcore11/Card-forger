// Conservative full-text coverage for known nonclosing lists. This is not an
// alternate-win detector: anything outside these small primitives stays unknown.
// Only used after the strategic model finds no supported conversion route.
import {typeText} from './core.js';
const normalize=s=>String(s||'').toLowerCase().replace(/’/g,"'").replace(/\s+/g,' ').trim();
function withoutReminder(text){
 let depth=0,out='';for(const ch of text){if(ch==='('){depth++;continue;}if(ch===')'){if(!depth)return null;depth--;continue;}if(!depth)out+=ch;}
 return depth?null:out;
}
const keyword='(?:haste|shroud|hexproof|vigilance|first strike|double strike|flying|menace|trample|lifelink|reach|indestructible)';
const directEquipment=new RegExp(`^equipped creature (?:has ${keyword}(?:,? (?:and )?${keyword})*|gets [+-]\\d+/[+-]\\d+)(?:\\.)?$`);
const manaOnly=/^\{t\}: add (?:\{[wubrgc]\}(?: or \{[wubrgc]\})*|one mana of any color(?: in your commander's color identity| that a land an opponent controls could produce)?|\{[wubrgc]\}\{[wubrgc]\})\.?$/;
const landSearch=/^search your library for (?:up to (?:two|2) basic land cards|a basic land card|a (?:plains|island|swamp|mountain|forest)(?:(?:,|,? or) (?:plains|island|swamp|mountain|forest))* card), (?:reveal (?:it|those cards), )?put (?:it|that card|one) onto the battlefield tapped(?: and the other into your hand)?, then shuffle\.?$/;
export function nonClosingCardCoverage(c,{hasCarrier=false}={}){
 const original=c?.oracle_text;
 if(!c?.name||typeof original!=='string'||!c.type_line||c.card_faces?.length)return {status:'unmapped',reason:'Complete single-face rules text is required.'};
 const stripped=withoutReminder(original);if(stripped===null)return {status:'unmapped',reason:'Rules/reminder boundary is unresolved.'};
 const text=normalize(stripped).replaceAll(normalize(c.name),'~'),type=typeText(c),lines=stripped.split('\n').map(normalize).filter(Boolean).map(s=>s.replaceAll(normalize(c.name),'~'));
 if(/\bBasic Land\b/.test(type)&&(!text||lines.every(l=>manaOnly.test(l))))return {status:'nonclosing',kind:'Basic mana',evidence:original};
 if(/\bCreature\b|\bPlaneswalker\b|\bBattle\b/.test(type))return {status:'unmapped',reason:'Creature, loyalty and battle output require a route-specific assessment.'};
 if(!text)return {status:'nonclosing',kind:'No printed function',evidence:original};
 if(/\bEquipment\b/.test(type)&&!hasCarrier&&lines.every(l=>directEquipment.test(l)||/^equip \{\d+\}\.?$/.test(l)))return {status:'nonclosing',kind:'Equipment without a carrier',evidence:original};
 if(lines.every(l=>manaOnly.test(l)))return {status:'nonclosing',kind:'Mana only',evidence:original};
 if(landSearch.test(text))return {status:'nonclosing',kind:'Land-only search',evidence:original};
 if(/^counter target (?:(?:noncreature|creature) )?spell\.?$/.test(text))return {status:'nonclosing',kind:'Countermagic only',evidence:original};
 if(/^(?:destroy|exile) (?:target creature|all creatures)\.?$/.test(text)||/^exile target creature\. its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle\.?$/.test(text))return {status:'nonclosing',kind:'Creature-only removal',evidence:original};
 if(/^(?:this spell costs \{\d+\} less to cast for each creature on the battlefield\. )?~ deals \d+ damage to (?:each|target) creature\.?$/.test(text))return {status:'nonclosing',kind:'Creature-only damage',evidence:original};
 if(/^draw (?:a|one|two|three|\d+) cards?\.?$/.test(text))return {status:'nonclosing',kind:'Own card draw only',evidence:original};
 return {status:'unmapped',reason:'At least one complete rules clause is outside the conservative nonclosing primitives.',evidence:original};
}
export function nonClosingDeckCoverage(rows){
 const hasCarrier=rows.some(r=>/\bCreature\b/.test(typeText(r.c))),evidence=rows.map(r=>({name:r.c?.name||r.name,qty:r.qty,...nonClosingCardCoverage(r.c,{hasCarrier})})),unresolved=evidence.filter(e=>e.status!=='nonclosing');
 return {version:'mtg-nonclosing-v1',status:rows.length&&!unresolved.length?'covered-nonclosing':'unmapped',label:'No closing plan found',evidence,unresolved,reason:'Every complete rules clause is covered by a conservative nonclosing primitive and no supported conversion route was found. This describes the listed cards, not a proof of zero wins against every opponent.'};
}

// A narrow coverage detector, not an Aura power calculation. A single optional
// Aura or generic enchantment density is insufficient: positive creature Auras,
// actual compatible bodies and explicit unmodeled scaling/entry output must
// form the majority of nonland copies together. Ordinary route diagnostics stay.
export function centralAuraCoverage(rows){
 const spells=rows.filter(r=>! /\bLand\b/.test(typeText(r.c))),text=r=>normalize(r.c?.oracle_text).replace(/["“][^"”]*["”]/g,''),qty=rs=>rs.reduce((n,r)=>n+r.qty,0);
 const carriers=spells.filter(r=>/\bCreature\b/.test(typeText(r.c))&&!/\bdefender\b|this creature can't attack|this creature cannot attack/.test(text(r)));
 const canHost=(carrier,aura)=>{
  const raw=String(carrier.c?.oracle_text||'').toLowerCase(),lines=raw.split('\n').map(normalize),protection=lines.filter(l=>/(?:^|, )protection from |^this creature has protection from /.test(l)&&! /\bif\b|as long as|whenever/.test(l)).join(' ');
  if(/(?:^|[,\n])\s*shroud(?:[,\n.]|$)/.test(raw)||/protection from (?:everything|all colors)|from enchantments/.test(protection))return false;
  if(/from artifacts/.test(protection)&&/Artifact/.test(typeText(aura.c)))return false;
  const names={W:'white',U:'blue',B:'black',R:'red',G:'green'};
  return !(aura.c.colors||aura.c.color_identity||[]).some(c=>new RegExp('\\b'+names[c]+'\\b').test(protection));
 };
 const auras=spells.filter(r=>/\bAura\b/.test(typeText(r.c))&&/(?:^|\n)enchant creature(?: you control)?(?:\n|$)/i.test(r.c?.oracle_text||'')&&/enchanted creature (?:gets \+\d+\/\+?\d+|has (?:flying|first strike|double strike|lifelink|trample|menace|vigilance|hexproof|ward))/.test(text(r))&&carriers.some(c=>canHost(c,r)));
 const scaling=auras.filter(r=>/enchanted creature gets [^.]*for each enchantment you control/.test(text(r)));
 const entry=spells.filter(r=>/whenever an enchantment you control enters[^.]*put (?:a|one|\d+) \+1\/\+1 counter on (?:target creature|this creature|[a-z ,'’-]+)/.test(text(r))&&!/counter on [^.]*opponent controls/.test(text(r)));
 const roles=spells.filter(r=>/create [^.]*role token attached to target creature you control/.test(text(r)));
 const packageRows=[...new Map([...auras,...scaling,...entry,...roles].map(r=>[r.c.name.toLowerCase(),r])).values()],primaryCopies=qty(packageRows),eligibleCopies=qty(spells);
 if(auras.length<2||!carriers.length||!(scaling.length||entry.length)||primaryCopies<=eligibleCopies/2||qty(auras)<primaryCopies-qty(auras))return null;
 return {status:'unsupported',label:'Important Aura / enchantment conversion not assessed',primaryCopies,eligibleCopies,auraCopies:qty(auras),carrierCopies:qty(carriers),payoffCopies:qty([...new Set([...scaling,...entry])]),evidence:packageRows.map(r=>({name:r.c.name,kind:scaling.includes(r)?'enchantment-count scaling':entry.includes(r)?'enchantment-entry counter output':roles.includes(r)?'paid Role provider':'positive creature Aura',text:r.c.oracle_text})),missingCapabilities:['Aura attachment, casting colors and legal carrier state','Enchantment-count scaling, entry counters and Role output','Layered combat grants, timing and loss of attached pieces'],reason:'A majority of nonland copies participate in an explicit Aura/scaling package, with positive Auras at least half of that package; its conversion and deployment are not modeled. Printed-body routes remain partial diagnostics, not a complete rating of this plan.'};
}
