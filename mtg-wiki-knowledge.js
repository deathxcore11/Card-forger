// A small CardStashy-authored factual vocabulary with community reading links.
// No MTG Wiki article prose, images, dumps or runtime requests are imported here.
// Wiki terminology helps explain a request; current Oracle text and official
// rules remain the authority for card identity, legality and interactions.
const reviewedOn='2026-10-23';
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const copy=v=>structuredClone(v);
const key=v=>String(v||'').normalize('NFKC').replace(/[’]/g,"'").trim().toLowerCase().replace(/\s+/g,' ');
const source=(title,page)=>({title,publisher:'MTG Wiki',authority:'community-reference',url:'https://mtg.wiki/page/'+page,retrievedOn:reviewedOn});
const referenceOnly='Explanation and search vocabulary only. This entry does not certify a complete strategy or a working interaction.';
const make=(id,label,kind,aliases,summary,prerequisites,page,{official=false,modeled=false,coverage=referenceOnly}={})=>({id,label,kind,aliases:[label,...aliases],summary,prerequisites,source:source(label,page),sourceAuthority:'community-reference',sourceStatus:'curated',readOnly:true,official,builderCoverage:{status:modeled?'modeled':'reference-only',mechanicId:modeled?id:null,summary:coverage}});
export const MTG_KNOWLEDGE_SOURCE=freeze({
 title:'MTG Wiki reading references',url:'https://mtg.wiki/',publisher:'MTG Wiki contributors',authority:'community-reference',reviewedOn,
 scope:'A small locally reviewed concept dictionary, not an import of the whole wiki or a live wiki search service.',
 declaredWikiTextLicense:'CC BY-NC-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/',copyrightPolicyUrl:'https://mtg.wiki/page/MTG_Wiki%3ACopyrights',
 reuse:'Wiki article text and images are not copied. The wiki’s NonCommercial license and any separate media/import exceptions must be resolved before bulk or commercial reuse of its licensed material.'
});
// `official` classifies a term as an official game keyword. It never means
// the linked community page is an official source or has precedence over rules.
export const MTG_CONCEPTS=freeze([
 make('bloodlust','Bloodlust','informal-mechanic',['slith ability','slith mechanic','slith-style','slith style','combat counter growth'],
  'An informal name for combat-damage triggers that grow a creature with +1/+1 counters after it hits a player. It is distinct from the Bloodthirst keyword.',
  ['A creature must actually deal the specified combat damage to the required player.','Evasion can help it connect; counter amplification needs a real counter event. Read whether the effect grows itself or other creatures.'],
  'Bloodlust',{modeled:true,coverage:'The builder checks recognized own combat-damage-to-player counter triggers and compatible support. Other targets, conditions and wording remain unmodeled.'}),
 make('bloodthirst','Bloodthirst','keyword-ability',[],
  'A creature can enter with extra +1/+1 counters if an opponent was dealt damage earlier that turn. Its printed Bloodthirst value controls the bonus.',
  ['Damage must happen before the creature enters during the same turn.','Loss of life alone is not damage. The creature’s own enter-the-battlefield damage cannot retroactively satisfy its entry condition.'],
  'Bloodthirst',{official:true,modeled:true,coverage:'The builder checks recognized printed Bloodthirst payoffs and earlier opponent-damage enablers. It does not simulate every damage replacement, timing sequence or board state.'}),
 make('saboteur','Saboteur','informal-mechanic',['saboteurs','combat-damage payoff'],
  'A nickname for a creature rewarded when it deals combat damage to a player. The reward can be cards, counters or another effect; it is not one keyword.',
  ['The creature needs a way to connect in combat.','Check the exact recipient, trigger, reward and any once-per-turn limit.'],
  'Saboteur'),
 make('slith','Slith','creature-type',['sliths'],
  'A creature subtype associated with Mirrodin. “Slith ability” is also an informal nickname for combat-hit counter growth, but the subtype and that ability are separate properties.',
  ['A card’s type line establishes whether it is a Slith.','A creature can have combat-hit growth without being a Slith, and its subtype alone does not prove that trigger.'],
  'Slith'),
 make('evasion','Evasion','strategy-concept',['evasion ability','evasive creatures'],
  'Abilities that make an attacking creature harder to block help combat-hit plans connect. Flying and menace impose different blocking restrictions.',
  ['The attacker must still be able to attack.','Reach helps a creature block flyers; it does not make that creature evasive when attacking.'],
  'Evasion_ability'),
 make('aristocrats','Aristocrats','deck-archetype',['aristocrat','sacrifice strategy','sacrifice engine'],
  'A sacrifice-focused plan converts expendable creatures or other permanents into value through outlets and rewards for sacrificing or dying.',
  ['Provide expendable material, a usable sacrifice outlet and a payoff.','A sacrifice outlet does not automatically create replacement material or an infinite loop.'],
  'List_of_Magic_slang'),
 make('blink','Blink / flicker','informal-mechanic',['blink','flicker','blink strategy','flicker strategy'],
  'Exile-and-return effects can reuse enter-the-battlefield abilities or protect a permanent. Each effect specifies what returns, when it returns and who controls it.',
  ['The targeted permanent must be eligible and the return instruction must apply.','A returned object is normally a new object. Tokens, delayed returns and copied permanents need their own wording checked.'],
  'Flicker'),
 make('voltron','Voltron','deck-archetype',['voltron strategy'],
  'A plan that concentrates enhancements on one attacking creature, often a commander, using Equipment, Auras, counters or combat tricks.',
  ['The creature needs a way to deal relevant combat damage and survive interaction.','A large power number alone does not solve blockers, attachment timing, removal or sacrifice effects.'],
  'Voltron'),
 make('reanimator','Reanimator','deck-archetype',['reanimation','reanimator strategy'],
  'A graveyard plan places useful creatures into the graveyard and returns them to the battlefield through suitable effects.',
  ['Include a way to put the intended card in the graveyard and a legal return effect.','Check costs, target restrictions, replacement effects and graveyard interference. A shared graveyard theme alone is not a combo.'],
  'Reanimator'),
 make('ramp','Mana acceleration','strategy-concept',['ramp','mana ramp','mana acceleration'],
  'A resource plan increases available mana so larger or additional plays become possible. Extra lands, mana permanents and temporary mana have different limits.',
  ['The mana source must be usable and produce the colors needed by the plan.','A mana filter that merely exchanges mana is not automatically acceleration, and acceleration is not infinite mana.'],
  'Mana_acceleration'),
 make('cantrip','Cantrip','informal-mechanic',['cantrips'],
  'A spell that draws a replacement card alongside its other effect is commonly called a cantrip. Replacing itself is different from generating extra cards.',
  ['Check whether the spell actually draws and whether its effect can resolve.','Filtering or selecting a card is not always a draw event, and a cantrip does not automatically gain card advantage.'],
  'Cantrip'),
 make('looting','Looting','informal-mechanic',['loot','looting'],
  'Draw-then-discard selection changes the cards in hand without necessarily increasing their number. The order matters when comparing it with discard-then-draw effects.',
  ['Read the exact order and whether discarding is an additional cost or part of resolution.','Discard-then-draw effects can need a card in hand first and should not be treated as interchangeable with draw-then-discard.'],
  'Looting'),
 make('tutor','Tutor','informal-mechanic',['tutors','tutoring'],
  'A search effect finds a card from the library according to its restrictions. Its destination and visibility are determined by the individual effect.',
  ['Check what the search is allowed to find and where the card goes.','Finding a piece does not establish the mana, timing, other pieces or protection needed to execute a plan.'],
  'Tutor'),
 make('lifelink','Lifelink','keyword-ability',[],
  'Damage from a source with lifelink also gains that source’s controller the same amount of life. It applies when the damage is dealt, rather than using a separate life-gain trigger.',
  ['The source must deal actual damage.','Lifelink can apply to noncombat damage too; prevention can reduce both the damage and the resulting life gain.'],
  'Lifelink',{official:true}),
 make('lifegain','Lifegain','strategy-concept',['life gain','life-gain'],
  'A broad name for effects and strategies that increase a player’s life total. Gaining life, preventing damage and setting a life total are distinct instructions.',
  ['Read who gains life and when the event occurs.','A payoff needs its stated life-gain event; a card being associated with life totals does not automatically enable it.'],
  'Life'),
 make('lifedrain','Lifedrain','strategy-concept',['life drain','life-drain','drain life'],
  'A common name for effects that reduce an opponent’s life while gaining life for you. Some deal damage and some cause loss of life, so their interactions differ.',
  ['Check whether the exact effect deals damage or causes life loss.','The recipient and amount of life gain follow the card’s wording; “drain” alone does not define one uniform rules ability.'],
  'Life'),
 make('combat-damage-step','Combat damage step','rules-topic',[],
  'The combat step in which eligible attackers and blockers assign and deal combat damage. First strike and double strike can create a separate earlier damage step.',
  ['Use the current official combat rules and the creatures’ actual abilities.','An ability causing damage during combat is not automatically combat damage.'],
  'Combat_damage_step'),
 make('comprehensive-rules','Comprehensive Rules','rules-reference',['comprehensive rulebook','magic comprehensive rules'],
  'Magic’s detailed rules reference is organized into numbered rules and a glossary. Card wording, official rulings and the applicable current edition govern a specific interaction.',
  ['Check the edition date and exact rule number.','A community explanation helps navigation but does not replace the official rules document.'],
  'Comprehensive_Rules'),
 make('wizards-of-the-coast','Wizards of the Coast','background-topic',['wotc'],
  'The game publisher behind Magic: The Gathering. The linked community article provides background; official game rules and product announcements have their own primary sources.',
  ['Use official Wizards publications for authoritative rules, policy or product claims.'],
  'Wizards_of_the_Coast'),
 make('jakub-slemr','Jakub Šlemr','player-history',['jakub slemr'],
  'A Czech former professional Magic player who won the 1997 individual World Championship. Historical coverage describes past events, not current tournament performance.',
  ['Keep the event and year attached to historical achievements.'],
  'Jakub_%C5%A0lemr')
]);
const exact=new Map(MTG_CONCEPTS.flatMap(c=>[c.id,...c.aliases].map(alias=>[key(alias),c])));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function resolveMtgConcept(value){const concept=typeof value==='string'&&value.length<=160?exact.get(key(value)):null;return concept?copy(concept):null;}
export function searchMtgConcepts(query='',{limit=8}={}){
 if(typeof query!=='string'||query.length>240)return [];
 const q=key(query),words=q.split(/[^\p{L}\p{N}+]+/u).filter(Boolean),count=Number.isInteger(limit)?Math.max(1,Math.min(limit,20)):8;
 const rank=c=>{const aliases=[c.id,...c.aliases].map(key),body=key([c.summary,...c.prerequisites,c.kind].join(' '));return aliases.includes(q)?100:aliases.some(a=>a.startsWith(q))?60:words.reduce((n,w)=>n+(aliases.some(a=>a.includes(w))?10:body.includes(w)?1:0),0);};
 return MTG_CONCEPTS.map(c=>({c,rank:q?rank(c):1})).filter(r=>r.rank>0).sort((a,b)=>b.rank-a.rank||a.c.label.localeCompare(b.c.label)).slice(0,count).map(r=>copy(r.c));
}
export function readMtgConceptMentions(value=''){
 if(typeof value!=='string')return [];
 const positive=value.slice(0,2000).replace(/[’]/g,"'").replace(/["“][^"”]*["”]/g,match=>' '.repeat(match.length)),found=new Map();
 const aliases=[...new Set(MTG_CONCEPTS.flatMap(c=>[c.id,...c.aliases]))].sort((a,b)=>b.length-a.length),rx=new RegExp('\\b(?:'+aliases.map(escape).join('|')+')\\b','gi');
 for(const m of positive.matchAll(rx)){
  const prefix=positive.slice(0,m.index).split(/[.!?;,]|\bbut\b|\band\s+(?=(?:use|add|include|keep|build|make|create|i|want|need|give)\b)/i).at(-1).replace(/\bnot only\b/gi,'');
  const concept=exact.get(key(m[0]));if(!concept)continue;
  if(/\b(?:no|not|without|avoid|remove|drop|stop|skip|don't|do not)\b(?:\s+[a-z'-]+){0,10}\s*$/i.test(prefix)){found.delete(concept.id);continue;}
  found.set(concept.id,concept);
 }
 return [...found.values()].map(copy);
}

export function buildMtgWikiReference(value){
 if(typeof value!=='string'||value.length>160||/[\u0000-\u001f\u007f<>"\\]/.test(value)||/^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/|(?:javascript|data|file|mailto):)/i.test(value.trim()))return null;
 const title=value.normalize('NFC').trim().replace(/\s+/g,' ');
 if(!title)return null;
 const concept=resolveMtgConcept(title);
 return {title:concept?.label||title,url:concept?.source.url||'https://mtg.wiki/page/'+encodeURIComponent(title.replace(/ /g,'_')),publisher:'MTG Wiki',sourceAuthority:'community-reference',sourceStatus:concept?'curated':'linked-only',pageVerified:!!concept,fetched:false,readOnly:true,note:concept?'A locally reviewed explanation is available; the external article was not fetched by this app.':'Reading link only. This app has not fetched or verified the contents or existence of this page.'};
}
export const safeWikiReference=buildMtgWikiReference;
export function wikiLookupAvailability(){return {available:false,sourceStatus:'unavailable',readOnly:true,curatedConcepts:MTG_CONCEPTS.length,scope:MTG_KNOWLEDGE_SOURCE.scope,message:'This local reference has no successful online article response attached. An online lookup must return fetched, attributed evidence before its contents are available. Local explanations and reading links remain available; a link alone is not a retrieved article or verified card ruling.'};}
