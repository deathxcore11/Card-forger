// A small reviewed catalogue of repeatable mana arrangements, not a Magic rules
// simulator. The app must resolve these exact cards and run its normal legality,
// identity, price, ownership and creature-type checks before selecting a package.
// A verified entry proves the listed conditional sequence, not battlefield setup,
// access, a winning outlet, an uninterrupted game, or every possible interaction.
const key=s=>String(s||'').normalize('NFKC').trim().toLowerCase();
const text=c=>String(c?.oracle_text||c?.card_faces?.[0]?.oracle_text||'').replace(/[’]/g,"'").toLowerCase();
const lines=c=>text(c).split('\n').map(s=>s.trim());
const type=c=>String(c?.type_line||c?.card_faces?.[0]?.type_line||'');
const hasLine=(c,re)=>lines(c).some(s=>re.test(s));
const artifact=c=>/\bArtifact\b/.test(type(c))&&!/\bCreature\b/.test(type(c));
const creature=c=>/\bCreature\b/.test(type(c));
const limited=c=>/\b(?:activate only|only once|only (?:as|if|during)|sacrifice|discard|exile|additional cost|can'?t be untapped)\b/.test(text(c));
const COLORS={white:'W',blue:'U',black:'B',red:'R',green:'G',colorless:'C',colourless:'C'};
const RULES={title:'Magic Comprehensive Rules',url:'https://magic.wizards.com/en/rules'};
const SOURCES={
 basalt:{title:'Basalt Monolith rules-text correction',url:'https://magic.wizards.com/en/news/feature/power-level-errata-b-gone-2006-07-14'},
 monument:{title:'Zendikar Rising release notes: Forsaken Monument',url:'https://magic.wizards.com/en/news/feature/zendikar-rising-release-notes-2020-09-10'},
 rings:{title:'Commander Legends release notes: Rings of Brighthearth',url:'https://magic.wizards.com/en/news/feature/commander-legends-release-notes-2020-11-06'},
 druid:{title:'Lorwyn Eclipsed release notes: Devoted Druid',url:'https://magic.wizards.com/en/news/feature/lorwyn-eclipsed-release-notes'},
 vizier:{title:'Wizards combo explanation: Devoted Druid and Vizier',url:'https://magic.wizards.com/en/news/feature/philosophy-combo-2017-08-04'}
};
const signatures={
 'basalt monolith':c=>artifact(c)&&hasLine(c,/^\{t\}: add \{c\}\{c\}\{c\}\.$/)&&hasLine(c,/^\{3\}: untap (?:basalt monolith|this artifact)\.$/),
 'forsaken monument':c=>artifact(c)&&hasLine(c,/^whenever you tap a permanent for \{c\}, add an additional \{c\}\.$/),
 'rings of brighthearth':c=>artifact(c)&&hasLine(c,/^whenever you activate an ability, if it isn't a mana ability, you may pay \{2\}\. if you do, copy that ability\.(?: you may choose new targets for the copy\.)?$/),
 'devoted druid':c=>creature(c)&&hasLine(c,/^\{t\}: add \{g\}\.$/)&&hasLine(c,/^put a -1\/-1 counter on (?:devoted druid|this creature): untap (?:devoted druid|this creature)\.$/),
 'vizier of remedies':c=>creature(c)&&hasLine(c,/^if one or more -1\/-1 counters would be put on a creature you control, that many minus one -1\/-1 counters are put on it instead\.$/)
};
const commonLimitations=[
 'Choose a finite number of repetitions. The mana must be used before the current step or phase ends unless another effect lets you keep it.',
 'This establishes a mana engine only. A useful outlet, winning line, card access and protection are separate requirements.',
 'Opponents can disrupt the pieces or non-mana abilities. Unmodeled effects, animation, counters, cost changes and board states can invalidate this sequence.'
];
const packageData=[
 {
  id:'basalt-monument',label:'Basalt Monolith + Forsaken Monument',cards:['Basalt Monolith','Forsaken Monument'],colors:[],output:'colorless',resource:'C',startupMana:0,
  prerequisites:['Control both resolved artifacts and an untapped, noncreature Basalt Monolith; pay their casting costs separately.','Their relevant abilities must be active, with no untap restriction, ability tax or replacement changing this cycle.'],
  steps:['Tap Basalt Monolith. Its mana ability produces three colorless mana and Forsaken Monument adds one more, for four total.','Spend three of that mana on the Monolith’s own untap ability and let it resolve.','The Monolith is untapped again and one additional colorless mana remains. Repeat from that state.'],
  netResources:{C:1},sources:[SOURCES.basalt,SOURCES.monument,RULES],kind:'artifact'
 },
 {
  id:'basalt-rings',label:'Basalt Monolith + Rings of Brighthearth',cards:['Basalt Monolith','Rings of Brighthearth'],colors:[],output:'colorless',resource:'C',startupMana:2,
  prerequisites:['Control both resolved artifacts, with Basalt Monolith untapped and not a creature; pay casting costs separately.','Have two additional unrestricted mana available after deploying the pieces. The two mana are startup, not the total cost of casting the cards.','All abilities must remain active and unchanged. You must receive priority between the copied and original untap resolutions.'],
  steps:['Tap Basalt Monolith for three colorless mana; use it to activate its three-mana untap ability.','Rings triggers on that non-mana ability. Pay the two startup mana to copy the untap ability.','Resolve the copy first, untapping Basalt Monolith. Before the original ability resolves, tap it again for three colorless mana.','Resolve the original untap ability. The Monolith is untapped and three mana remain: one more than the two used to start this cycle. Retain two and repeat.'],
  netResources:{C:1},sources:[SOURCES.basalt,SOURCES.rings,RULES],kind:'artifact'
 },
 {
  id:'devoted-vizier',label:'Devoted Druid + Vizier of Remedies',cards:['Devoted Druid','Vizier of Remedies'],colors:['G','W'],output:'green',resource:'G',startupMana:0,
  prerequisites:['Control both resolved creatures and an untapped Devoted Druid that you have controlled since the beginning of your most recent turn, or give it haste. Pay casting costs separately.','Devoted Druid must have enough toughness to remain on the battlefield. Counter placement must be allowed; Vizier reduces its one-counter cost to zero rather than prohibiting counters.','Their abilities must remain active with no extra activation cost or untap restriction.'],
  steps:['Tap Devoted Druid for one green mana.','Activate its untap ability. Its one -1/-1 counter cost is modified by Vizier to place zero counters.','Resolve the untap ability. The Druid returns to the same untapped counter state and the green mana remains. Repeat.'],
  netResources:{G:1},sources:[SOURCES.druid,SOURCES.vizier,RULES],kind:'creature'
 }
];
const copy=v=>structuredClone(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const MANA_LOOP_CATALOGUE=freeze(copy(packageData));

export function readLoopIntent(value=''){
 const original=String(value||'').replace(/[’]/g,"'").replace(/["“][^"”]*["”]/g,'');
 const relaxation=/\b(?:(?:remove|drop|relax|skip)\s+(?:the |that |my )?(?:infinite\s+)?(?:mana\s+)?(?:loop|combo|mana)\s+requirement|no\s+(?:infinite\s+)?(?:mana\s+)?(?:loop|combo)\s+requirement|(?:don't|do not)\s+need\s+(?:an?\s+)?(?:infinite\s+)?(?:mana\s+)?(?:loop|combo|mana))\b/gi;
 const relaxed=relaxation.test(original);relaxation.lastIndex=0;
 const request=original.replace(relaxation,'');
 const mentions=[...request.matchAll(/\b(?:infinite|unlimited|unbounded|endless)\b/gi)];
 let mana=false,deniedMana=false,deniedAll=false,hasLoopNegation=false,scopedNegative=false,unsupported=false,ambiguousOutput=false,loopOutput=null;
 const outputs=new Set(),deniedOutputs=new Set();
 for(let i=0;i<mentions.length;i++){
  const mention=mentions[i],prefix=request.slice(0,mention.index).split(/[.!?;,]|\bbut\b|\bhowever\b|\band\s+(?=(?:make|build|create|generate|i|give|want|need|include|require)\b)/i).at(-1);
  // Negation belongs to this clause/outcome. "No infinite damage" does not ban
  // mana, and "don't make a deck with infinite mana" is not a positive request.
  const denied=/\b(?:no|not|without|avoid|don't|do not)\b(?:\s+[a-z'-]+){0,10}\s*$/i.test(prefix);
  const tail=request.slice(mention.index+mention[0].length,mentions[i+1]?.index??request.length).split(/[.!?;,]|\bbut\b|\bhowever\b/i)[0].trim();
  const manaMention=/\bmana\b/i.test(tail),other=/\b(?:damage|tokens?|draw|turns?|life|mill(?:ing)?)\b/i.test(tail);
  const generic=!manaMention&&!other&&/^(?:(?:any|all)\s+)?(?:combos?|loops?)\b/i.test(tail)||!tail;
  if(denied){
   hasLoopNegation=true;
   deniedAll||=generic;
   scopedNegative||=!generic&&(manaMention||other);
   if(manaMention){
    const colors=(tail.slice(0,tail.toLowerCase().indexOf('mana')).match(/\b(?:white|blue|black|red|green|colou?rless)\b/gi)||[]).map(c=>COLORS[c.toLowerCase()]);
    if(colors.length)colors.forEach(c=>deniedOutputs.add(c));else deniedMana=true;
   }
   continue;
  }
  if(!manaMention){if(generic||other||/^(?:[a-z-]+\s+){0,2}(?:combos?|loops?|goblins?|vampires?)\b/i.test(tail))unsupported=true;continue;}
  mana=true;
  if(other)unsupported=true;
  const colorWords=tail.slice(0,tail.toLowerCase().indexOf('mana')).match(/\b(?:white|blue|black|red|green|colou?rless)\b/gi)||[];
  const colors=[...new Set(colorWords.map(c=>COLORS[c.toLowerCase()]))];
  if(colors.length>1)ambiguousOutput=true;
  if(colors.length===1)outputs.add(colors[0]);
  if(/\b(?:mana (?:of|in) (?:any|every|all|each) colou?rs?|(?:any[- ]colou?r|all[- ]colou?r|colou?red) mana)\b/i.test(tail))outputs.add('any-color');
 }
 if(outputs.size>1)ambiguousOutput=true;
 if(outputs.size===1)loopOutput=[...outputs][0];
 // "Loop my opponents" gives no repeatable outcome, even without "infinite".
 for(const match of request.matchAll(/\bloop(?:s|ing)?\s+(?:(?:my|our|the|all)\s+)?(?:opponents?|opps?|ops?)\b/gi)){
  const prefix=request.slice(0,match.index).split(/[.!?;,]|\bbut\b|\bhowever\b/i).at(-1);
  if(!/\b(?:no|not|without|avoid|don't|do not)\b(?:\s+[a-z'-]+){0,10}\s*$/i.test(prefix))unsupported=true;
  else{hasLoopNegation=true;scopedNegative=true;}
 }
 const unsupportedLoop=ambiguousOutput?'Name the mana output to repeat: colorless, one color, or every color. The reviewed package must produce the requested output.':unsupported?'Specify the repeatable result you want, such as mana, damage, tokens or extra turns. Only the reviewed mana packages can currently receive an automatic loop check.':scopedNegative&&!deniedAll?'The requested absence of a specific infinite-loop outcome is unverified. The reviewed package catalogue can establish listed mana sequences, but cannot prove that no other combination in a deck creates that outcome. Revise the restriction before treating this as a checked result.':null;
 return {requireLoop:mana?'infinite-mana':null,loopOutput,unsupportedLoop,loopConflict:mana&&(deniedMana||deniedAll||loopOutput==='any-color'&&deniedOutputs.size>0||deniedOutputs.has(loopOutput)),clearLoop:!mana&&(deniedMana||deniedAll||deniedOutputs.size>0||relaxed),hasLoopNegation,avoidInfinite:deniedAll};
}

export function manaLoopCandidates(intent={},constraints={}){
 const request=typeof intent==='string'?readLoopIntent(intent):intent;
 if(request.requireLoop!=='infinite-mana'||request.loopConflict||request.avoid_infinite||request.unsupportedLoop)return [];
 const excluded=new Set((constraints.excluded_cards||request.excluded_cards||[]).map(key));
 const requested=request.loopOutput;
 return MANA_LOOP_CATALOGUE.filter(p=>!p.cards.some(n=>excluded.has(key(n)))&&(!requested||p.resource===requested)).map(copy);
}

// Ledger proof for this catalogue only. Each simulated iteration restores the
// source's untapped/counter state and increases a resource without consuming a
// finite card, counter or turn. It deliberately does not play a game of Magic.
export function traceManaLoop(id,{iterations=1,startupMana,ready=true,counterPlacementAllowed=true}={}){
 const p=MANA_LOOP_CATALOGUE.find(p=>p.id===id);
 if(!p)throw Error('Unknown reviewed mana package.');
 if(!Number.isInteger(iterations)||iterations<1||iterations>1000)throw Error('Choose 1 to 1000 finite repetitions for the ledger.');
 const start=startupMana??p.startupMana;
 if(!Number.isFinite(start)||start<p.startupMana)throw Error('The package startup mana is not available.');
 if(!ready)throw Error('The mana source must be untapped and able to activate.');
 if(p.id==='devoted-vizier'&&!counterPlacementAllowed)throw Error('Counter prohibition prevents paying Devoted Druid’s untap cost.');
 let mana=start,tapped=false,counters=0;const trace=[];
 const record=action=>trace.push({action,mana,tapped,counters});
 const tap=amount=>{if(tapped)throw Error('Source is already tapped.');tapped=true;mana+=amount;record('tap for mana');};
 const spend=amount=>{if(mana<amount)throw Error('Activation cannot be paid.');mana-=amount;record('pay activation');};
 const untap=()=>{tapped=false;record('resolve untap');};
 for(let i=0;i<iterations;i++){
  if(id==='basalt-monument'){tap(4);spend(3);untap();}
  else if(id==='basalt-rings'){tap(3);spend(3);spend(2);untap();tap(3);untap();}
  else{tap(1);record('place zero counters after Vizier replacement');untap();}
 }
 return {resource:p.resource,startMana:start,endMana:mana,netMana:mana-start,iterations,sourceUntapped:!tapped,counters,trace};
}

function blockers(rows,p){
 const found=[];
 for(const row of rows){
  const c=row.card||row.c||row,body=text(c),name=c.name||row.name;
  if(!name||! /\b(?:Artifact|Creature|Enchantment|Planeswalker)\b/.test(type(c)))continue;
  const all=/(?:activated abilities (?:of|from) (?:artifacts|creatures)(?: and (?:artifacts|creatures))? can'?t be activated)/.test(body);
  if(p.kind==='artifact'&&/(?:activated abilities of artifacts can'?t be activated|activated abilities of artifacts and creatures can'?t be activated|activated abilities of creatures and artifacts can'?t be activated)/.test(body))found.push(name+': artifact activation restriction');
  else if(p.kind==='creature'&&all&&/creatures/.test(body))found.push(name+': creature activation restriction');
  if(/activated abilities cost \{\d+\} more to activate/.test(body)||/activated abilities of (?:artifacts|creatures)[^.]*cost[^.]*more to activate/.test(body))found.push(name+': activation-cost increase is outside this proof');
  if(p.kind==='creature'&&/(?:counters can'?t be put on (?:artifacts, )?creatures|players can'?t get counters[\s\S]*counters can'?t be put)/.test(body))found.push(name+': counter placement is prohibited');
 }
 return [...new Set(found)];
}

export function inspectManaLoop(rows=[],request={}){
 const requested=request.requireLoop==='infinite-mana',scope='Reviewed exact-card mana packages only; list availability plus conditional rules sequence, not battlefield state, a win, or all Magic interactions.';
 const out={requested,requirement:request.requireLoop||null,status:'not-requested',issues:[],packages:[],missing:[],scope};
 if(request.loopConflict||requested&&request.avoid_infinite){out.status='conflict';out.issues.push('Infinite mana conflicts with the retained no-infinite-combos restriction. Choose which instruction to keep.');return out;}
 if(request.unsupportedLoop){out.status='unverified';out.issues.push(request.unsupportedLoop);return out;}
 if(!requested)return out;
 out.status='unverified';
 // Sideboard pieces do not establish a route in the playable starting list.
 const playable=rows.filter(r=>r.zone!=='side'&&r.zone!=='extra'&&(r.qty===undefined||Number(r.qty)>0));
 const cards=new Map(playable.map(r=>{const c=r.card||r.c||r;return [key(c.name||r.name),c];}));
 const candidates=manaLoopCandidates(request);
 for(const p of candidates){
  const missing=p.cards.filter(n=>!cards.has(key(n))),invalid=p.cards.filter(n=>cards.has(key(n))&&(!signatures[key(n)]?.(cards.get(key(n)))||limited(cards.get(key(n))))),blockedBy=blockers(playable,p);
  if(missing.length||invalid.length||blockedBy.length){out.missing.push({id:p.id,cards:missing,invalidCards:invalid,blockedBy});continue;}
  const proof=traceManaLoop(p.id);
  if(proof.netMana!==p.netResources[p.resource]||!proof.sourceUntapped||proof.counters!==0){out.missing.push({id:p.id,cards:[],invalidCards:['Package ledger did not reset to a productive state.'],blockedBy:[]});continue;}
  out.packages.push({...copy(p),status:'verified',limitations:[...commonLimitations]});
 }
 if(out.packages.length){out.status='verified';return out;}
 const output=request.loopOutput==='any-color'?'mana of every color':request.loopOutput?({W:'white',U:'blue',B:'black',R:'red',G:'green',C:'colorless'}[request.loopOutput]||'the requested')+' mana':'mana';
 out.issues.push('No reviewed repeatable '+output+' package is established by this exact playable list. Missing, changed or self-blocked pieces cannot satisfy the infinite-mana request.');
 return out;
}
