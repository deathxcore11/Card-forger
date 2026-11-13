// Runs a plan from answer-search.js with the app's own lookups (ai-tools.js) and shapes the answer card.
// Every sentence is filled from what the lookup returned. A lookup that fails or comes back empty gives a
// plain "miss" line, never a guess. No AI, no DOM: answerMarkup() only builds a string.
import {readBuildContract} from './ai-build-contract.js';
import {buildLeftover,deckColors} from './answer-search.js';
import {PLAY_STYLES,playStylesIn} from './builder.js';
const usd=n=>typeof n==='number'&&Number.isFinite(n)?'$'+n.toFixed(2):null;
// Dates are written by hand: the app's small JS engine has no locale formatting.
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const when=iso=>{const t=Date.parse(iso);if(!Number.isFinite(t))return '';const d=new Date(t);return new Date().toDateString()===d.toDateString()?'today':MONTHS[d.getMonth()].slice(0,3)+' '+d.getDate();};
const longDate=d=>{const t=Date.parse(d);if(!Number.isFinite(t))return String(d||'');const x=new Date(t);return MONTHS[x.getUTCMonth()]+' '+x.getUTCDate()+', '+x.getUTCFullYear();};
const cardItem=(game,c)=>({kind:'card',game,ref:c.ref||(game==='mtg'?c.name:String(c.id||c.name)),label:c.name});
const miss=(text,extra={})=>({ok:false,miss:text,items:[],more:[],buttons:[],...extra});
const UNKNOWN="The app's data can't answer that one.";

// A wiki article's fact box holds labelled facts ("Winner", "Release date", "Location"). A question's words are
// matched to those labels, so "who won ..." reads the Winner row instead of guessing from prose.
const FACT_WORDS=[
 [/\b(?:won|win|winner|wins|champion|champions)\b/,/^(?:winner|winners|champion|world champion)s?$/],
 [/\b(?:when|date|year|released?|come out|came out|held|happen\w*)\b/,/^(?:date|dates|release date|released|first released)$/],
 [/\bborn\b|\bbirthday\b|\bhow old\b/,/^born$/],[/\bdied?\b|\bdeath\b|\bpassed\b/,/^died$/],
 [/\b(?:where|location|place|city|country|held)\b/,/^(?:location|venue|residence|nationality)$/],
 [/\b(?:designed|designer|designers|made|created|design)\b/,/^(?:set design|vision design|design|designer|designers|lead designer|development)$/],
 [/\bart direct\w*\b/,/^art direction$/],[/\bprize\b|\bpayout\b|\bmoney\b/,/^(?:prize pool|winnings)$/],
 [/\b(?:how many players|attendance|players|attended)\b/,/^attendance$/],[/\bformats?\b/,/^formats?$/],
 [/\bnickname\b|\bcalled\b/,/^nickname$/],[/\b(?:mechanics?|keywords?)\b/,/^(?:keywords.*|themes and mechanics)$/],
 [/\b(?:how many cards|set size|how big)\b/,/^set size$/],[/\bplane\b/,/^plane$/],[/\b(?:set )?code\b/,/^expansion code$/],
];
const blockText=c=>(c||[]).map(x=>typeof x?.text==='string'?x.text:Array.isArray(x?.content)?blockText(x.content):x?.label||'').join('');
const tidy=v=>String(v||'').replace(/\[\d+\]/g,'').replace(/\s*\b[A-Z]{3} flag /g,' · ').replace(/^ · /,'').replace(/\u200b/g,'').replace(/;\s*\d+ (?:years?|months?|days?) ago.*$/,'').replace(/\s+/g,' ').trim();
/** The fact-box rows of a wiki article as [label, value]. */
export function wikiFacts(article){
 const out=[];for(const b of article?.lead||[])if(b?.infobox)for(const r of b.rows||[]){const c=r.cells||[];if(c.length===2&&c[0].header&&!c[1].header){const label=tidy(blockText(c[0].content)),value=tidy(blockText(c[1].content));if(label&&value&&value.length<=200)out.push([label,value]);}}
 return out;
}
/** The fact a question asks for, or null: only a label the question's own words point at. */
export function wikiFact(article,question){
 const n=String(question||'').toLowerCase(),facts=wikiFacts(article);
 for(const [ask,label] of FACT_WORDS)if(ask.test(n)){const f=facts.find(([l])=>label.test(l.toLowerCase()));if(f)return {label:f[0],value:f[1]};}
 return null;
}

/**
 * tools: makeAskTools() result. io: { cardSearch({game,q,order,dir,limit}) -> [{name,price,ref?}], signal }
 * Returns { ok, say, strong, quote, items, more, buttons:[{label,item|route|search|discover|judge}], source, miss }
 */
// The subject of the last answer (a tournament deck, a card, one of your decks): what "it" means on the next line.
let about=null;
export const answerAbout=()=>about;
export const forgetAnswer=()=>{about=null;};
// What people ask next about a subject, as whole questions the search itself answers. [off] is a reason a chip cannot be asked yet.
function followUps(sub){
 if(sub.kind==='meta')return [{label:'What does it cost me?',q:'how much does it cost'},{label:'How much do I own?',q:'how much of it do i own'},{label:"What's in it?",q:'what cards are in it'},{label:'Where did it place?',q:'where did it place'},{label:'What beats it?',q:'what beats it'}];
 if(sub.kind==='card')return [{label:'Do I own it?',q:'do i own it'},...(sub.game==='mtg'?[{label:'Is it legal?',q:'is it legal in '+(sub.format||'standard')}]:[{label:'Is it legal?',q:'is it legal'}]),{label:'Which decks play it?',q:'best deck with '+sub.name}];
 if(sub.kind==='mydeck')return [{label:'Is it legal?',q:'is my '+sub.name+' deck legal'},{label:'Make it better',q:'how do i make my '+sub.name+' deck better'},{label:'What beats it?',q:'what beats my '+sub.name+' deck'}];
 return [];
}
export async function answerFor(plan,tools,io={}){
 const a=await answerAll(plan,tools,io);
 // A card answered about is the subject too: "is it legal", "do I own it" on the next line mean that card.
 if(a?.ok&&!a.subject&&plan?.call?.tool==='card_details'&&a.strong)a.subject={kind:'card',game:plan.game,name:a.strong,format:plan.call.format||''};
 if(a?.ok&&a.subject){about=a.subject;const asked=String(plan?.P?.raw||'').toLowerCase();a.follow=followUps(a.subject).filter(f=>f.q!==asked&&!(plan.call?.facet&&f.q===({cost:'how much does it cost',own:'how much of it do i own',list:'what cards are in it',place:'where did it place',beat:'what beats it'})[plan.call.facet]));}
 return a;
}
async function answerAll(plan,tools,io={}){
 // No answer may sit on "Looking…" for ever: after [io.limitMs] the wait ends with a plain sentence, and asking again uses whatever has loaded since.
 let timer;const first=answerOne(plan,tools,io),late=new Promise(r=>{timer=setTimeout(()=>r(miss('That is taking too long on this connection. Check your internet, then ask again.',{slow:true})),io.limitMs||20000);});
 const a=await Promise.race([first,late]).finally(()=>clearTimeout(timer));first?.catch?.(()=>{});
 if(!a||!plan?.extra?.length)return a&&(delete a.facets,a);
 // The other asks on the same line, in the order asked. A follow-up about "it" reads the first answer's own facts.
 a.also=[];
 for(const e of plan.extra){
  let text;
  if(!a.ok)text='Not answered, because the first part found nothing.';
  else if(e.facet)text=a.facets?.[e.facet]||"Search can't answer that about this deck yet.";
  else{const b=e.plan?await answerOne(e.plan,tools,io):null;text=!b?"Search can't answer that one. Try it on its own line.":b.ask?b.ask.ask:b.ok?[b.strong,b.say&&b.say!=='From the wiki page'?b.say:'',b.fact?b.fact.label+': '+b.fact.value:'',b.quote?'“'+b.quote+'”':''].filter(Boolean).join(' '):b.miss;}
  a.also.push({ask:e.text,text});
 }
 delete a.facets;return a;
}
async function answerOne(plan,tools,io={}){
 if(!plan||plan.hand)return null;
 if(plan.intent==='unknown')return miss(plan.why||UNKNOWN);
 if(plan.missing?.length)return {ok:false,ask:plan.missing[0],items:[],more:[],buttons:[]};
 if(!plan.call)return null;
 const {tool,args,pick}=plan.call,g=plan.game;
 try{
  if(tool==='go')return {ok:true,say:'Open '+args.title+'.',items:[],more:[],buttons:[{label:'Open '+args.title,route:args.route}],go:args.route};
  if(tool==='build_deck'){
   const {request,labels,unused,rows}=buildRequest(args.request,g,args.format,{seed:args.seed,opponent:plan.call.opponent,pod:plan.call.pod});
   const opp=plan.call.opponent,pod=plan.call.pod,notes=[unused.length?(rows.length>1?'The builder has no setting yet for the words marked not used.':'Not used yet: '+unused.map(u=>'"'+u+'"').join(', ')+'. The builder has no setting for that yet.'):'',opp&&!request.against?`The builder can't tune a deck against ${opp} yet.`:'',
    request.against?'Answers for the other colours are only cards whose own text names that colour or cannot be countered. The app does not know how the matchup plays.':'',
    pod?.decks?.some(d=>!d.colors?.length)?`It could not read a colour from: ${pod.decks.filter(d=>!d.colors?.length).map(d=>d.label).join(', ')}.`:'',
    pod?.power&&!request.power?"The pod's power is not known to the app. Add a bracket (\"bracket 3\") or a power level and the builder aims there.":'',
    g!=='mtg'&&(opp||pod)?'Power targets and answers for other decks are for Magic decks so far.':''].filter(Boolean);
   return {ok:true,say:rows.length>1?'The deck builder is set up from your words.':labels.length?'The deck builder is set up from your words: '+labels.join(', ')+'.':'Open the deck builder to choose a card, format and budget.',rows:rows.length>1?rows:[],note:notes.join(' '),items:[],more:[],buttons:[{label:'Open the deck builder',build:request}],source:'Deck builder · nothing is saved until you choose'};
  }
  if(tool==='judge'){
   // The rule that covers the question, quoted from the bundled rulebook. An unsure match is not shown as an answer.
   const j=io.judge?await io.judge(g,args.question):null,r=j?.status==='answered'?j.lead:null;
   if(!r)return pick==='maybe'?miss(UNKNOWN):{ok:false,miss:'I couldn’t find one rule that settles that. Ask a Judge shows the closest rules.',items:[],more:[],buttons:[{label:'Ask a Judge',judge:true}]};
   const mtg=g==='mtg',page=String(r.number).match(/p(\d+)$/)?.[1];
   return {ok:true,strong:mtg?'Rule '+r.number:(r.heading||'Rulebook').replace(/\s*·\s*PDF page \d+$/,'')+(page?', page '+page:''),say:mtg&&r.heading?' · '+r.heading:'',quote:r.focus||r.text,items:[],more:[],
    source:(j.edition?j.edition.title+' · '+j.edition.date+' · ':'')+'quoted from the rulebook',buttons:[{label:j.rules.length?'See the rules that go with it':'Open in Ask a Judge',judge:true}]};
  }
  if(tool==='glossary'){
   const e=plan.entry;
   return {ok:true,strong:e.label,quote:e.definition,items:[],more:[],source:e.sourceLabel,
    buttons:[{label:'Read more',route:'#wiki/'+encodeURIComponent(e.label)},...(g==='mtg'&&e.official?[{label:'Cards with '+e.label.toLowerCase(),discover:{kind:'keyword',value:e.label}}]:[]),{label:'Ask a Judge',judge:true}]};
  }
  if(tool==='meta_decks'){
   // The tournament feed sometimes fails on its first read: one more try before saying it is unavailable.
   let r=await tools.meta_decks(args);if(r.error&&!r.format)r=await tools.meta_decks(args);
   const fmt=g==='mtg'&&args.format?args.format:r.format||args.format,{pre='',post='',nth=1}=plan.call;
   // What was asked for, in words, so a miss names it: "No mono-red Standard deck ...", never the top deck of another colour.
   const asked=[pre,fmt,'deck',post].filter(Boolean).join(' '),quoted=args.match?'"'+args.match+'"':'';
   if(r.none)return miss(quoted?(r.matched?.known===false?`No ${asked} among the tournament decks is named ${quoted} right now.`:`No ${asked} among the tournament decks is named ${quoted} or plays a card named ${quoted} right now.`):args.under!=null?`No ${asked} among the tournament decks costs you $${args.under} or less to finish right now.`:args.sort?`The app has no prices for the ${fmt} tournament decks right now.`:`No ${asked} is among the tournament decks right now.`);
   if(r.error||!r.decks?.length)return miss(r.error||'No tournament decks for '+args.format+' right now.');
   const source=[r.source,r.fetchedAt?'updated '+when(r.fetchedAt):''].filter(Boolean).join(' · ');
   if(pick==='cards')return {ok:true,say:'The most played cards are on the tournament page for '+fmt+'.',items:[],more:[],buttons:[{label:'Open '+fmt+' tournament decks',route:'#decks/inspiration'}],source};
   const top=r.decks[nth-1],items=tools.suggestedItems().slice(nth-1,nth+2),ord=['','','2nd ','3rd ','4th ','5th '][nth]||'';
   if(!top)return miss(`Only ${r.decks.length} ${asked}${r.decks.length===1?' is':'s are'} among the tournament decks right now.`);
   // "aggro" found in the deck's name reads as a kind of deck; found in its list, as a card it plays.
   const kind=[pre,r.matched?.by==='name'?args.match:'',fmt,'deck'].filter(Boolean).join(' '),tail=[post,r.matched?.by==='card'?'that plays '+(r.matched.card||quoted):r.matched?.by==='kind'?'whose monsters are mostly '+r.matched.kind.toUpperCase():'',args.under!=null?`that costs you $${args.under} or less to finish`:''].filter(Boolean).join(' '),what=kind+(tail?' '+tail:''),field=`${top.lists?top.lists+(top.lists===1?' list, ':' lists, '):''}${top.share}% of the field`;
   let say;
   if(args.sort==='closest'){
    if(!top.ownedPercent)return miss(`You don't own cards from any ${what} among the tournament decks yet.`);
    say=`is the ${what} closest to your collection: you own ${top.ownedPercent}% of it${usd(top.costToFinish)?', about '+usd(top.costToFinish)+' to finish':''}.`;
   }else if(args.sort)say=`is the ${args.sort==='cheapest'?'cheapest':'most expensive'} ${what} to finish from your collection: about ${usd(top.costToFinish)}. It is ${field}.`;
   else say=`is the ${ord}most played ${what} right now: ${field}.`;
   const hues=top.colors!=null?[...top.colors].map(c=>({w:'white',u:'blue',b:'black',r:'red',g:'green'})[c]).join(', ')||'colourless':'';
   const facets={
    cost:usd(top.costToFinish)?`About ${usd(top.costToFinish)} to finish; you own ${top.ownedPercent}% of it.`:top.listUnavailable?'Its list is not available, so there is no price.':'Some of its cards have no price right now, so there is no total.',
    own:top.ownedPercent!=null?`You own ${top.ownedPercent}% of it${top.missingCopies?', '+top.missingCopies+' cards short':''}.`:'Its list is not available, so the app cannot compare it with your cards.',
    colors:hues?'Its colours: '+hues+'.':g==='mtg'?'Its card colours could not be loaded right now.':'This game has no deck colours.',
    place:top.best?'Best finish: '+top.best+'.':'The feed has no finish for it.',
    popular:`${field.charAt(0).toUpperCase()+field.slice(1)}.`,
    list:'Open the deck to see its full list.',
    beat:g==='mtg'?'Ask "what beats it" on its own line and the app simulates the matchups.':'Search can only simulate Magic matchups so far.',
   };
   const subject={kind:'meta',game:g,format:g==='mtg'?args.format:r.format,key:top.key,name:top.name};
   if(pick==='about'){
    const f=plan.call.facet,rows=f==='list'?(top.cards||[]).map(c=>({label:c.name,value:'×'+c.qty+(c.owned?' · you own '+Math.min(c.owned,c.qty):'')})):[];
    const text=f==='list'&&rows.length?`plays ${top.cardCount} cards. Its most played:`:f==='other'?say:facets[f]||"Search can't answer that about this deck yet.";
    return {ok:true,subject,strong:top.name,say:f==='list'&&rows.length||f==='other'?text:': '+text,rows,items:items.slice(0,1),more:[],buttons:[{label:'Open the deck',item:items[0]}],source};
   }
   const vs=plan.call.opponent?[{ask:'against '+plan.call.opponent,text:`Search can't rank decks by how they do against ${plan.call.opponent} yet, so this is by play share.`}]:null;
   return {ok:true,subject,facets,...(vs?{vs}:{}),strong:top.name,say,items:items.slice(0,1),more:items.slice(1),moreLabel:args.sort==='closest'?'Next closest':args.sort?'Then':'Next most played',
    buttons:[{label:'Open the deck',item:items[0]},{label:'All '+fmt+' decks',route:'#decks/inspiration'}],source:args.sort||args.under!=null?[source,'cost is for the copies you are missing'].filter(Boolean).join(' · '):source,note:[top.colors!=null?'Colours: '+([...top.colors].map(c=>({w:'white',u:'blue',b:'black',r:'red',g:'green'})[c]).join(', ')||'colourless'):'',top.best?'Best finish: '+top.best:''].filter(Boolean).join(' · ')};
  }
  if(tool==='set_cards'){
   if(pick==='price-asc'){
    if(g!=='mtg'||!io.cardSearch)return miss('The app can rank the most expensive cards in a set, not the cheapest, for this game.');
    const cards=await io.cardSearch({game:g,q:'set:'+args.set+' usd>0',order:'usd',dir:'asc',limit:3});if(!cards)return miss('The card prices could not be loaded right now. Ask again in a moment.');if(!cards.length)return miss('No priced cards found in that set.');
    return {ok:true,strong:cards[0].name,say:`is the cheapest priced card in the set at ${usd(cards[0].price)}.`,items:[cardItem(g,cards[0])],more:cards.slice(1).map(c=>cardItem(g,c)),moreLabel:'Then',buttons:[{label:'Open the card',item:cardItem(g,cards[0])},{label:'Whole set',item:{kind:'set',game:g,ref:args.set,label:'Set'}}],source:'Regular (non-foil) market price'};
   }
   const r=await tools.set_cards(args);if(r.error)return r.requiresChoice?{ok:false,ask:{slot:'set',ask:'Which set?',choices:(r.candidates||[]).slice(0,6)},items:[],more:[],buttons:[]}:miss(r.error);
   const priced=(r.cards||[]).filter(c=>c.price!=null);if(!priced.length)return miss('No priced cards found in '+r.set.name+'.');
   const top=priced[0],partial=g!=='mtg'&&r.checked&&r.set.cards&&r.checked<r.set.cards;
   return {ok:true,strong:top.name,say:`is the most expensive card in ${r.set.name} at ${usd(top.price)}.`,items:[cardItem(g,top)],more:priced.slice(1,3).map(c=>cardItem(g,c)),moreLabel:'Then',
    buttons:[{label:'Open the card',item:cardItem(g,top)},{label:'Whole set',item:{kind:'set',game:g,ref:String(r.set.id||r.set.code),label:r.set.name}}],
    source:[g==='mtg'?'Regular (non-foil) market price':'Market price',r.set.name,String(r.set.date||'').slice(0,4)].filter(Boolean).join(' · '),
    note:partial?`Only ${r.checked} of ${r.set.cards} cards were price-checked, so a pricier card may be missing.`:''};
  }
  if(tool==='list_sets'){
   const r=await tools.list_sets(args),set=s=>({kind:'set',game:g,ref:String(s.id||s.code),label:s.name});
   if(pick==='upcoming'){const s=r.upcoming?.[0];if(!s)return miss('The app has no upcoming set listed yet.');return {ok:true,strong:s.name,say:`is the next set, due ${longDate(s.date)}.`,items:[set(s)],more:r.upcoming.slice(1,3).map(set),moreLabel:'After that',buttons:[{label:'Open the set',item:set(s)}],source:'Set list'};}
   const s=pick==='newest'?r.latestReleased||r.sets?.[0]:r.sets?.[0];if(!s)return miss('No set by that name.');
   const say=pick==='date'?(s.status==='upcoming'?`comes out ${longDate(s.date)}.`:`came out ${longDate(s.date)}.`):pick==='count'?`has ${s.cards} cards.`:pick==='newest'?`is the newest set, released ${longDate(s.date)}.`:pick==='oldest'?`is the oldest set, released ${longDate(s.date)}.`:`is the biggest set with ${s.cards} cards.`;
   return {ok:true,strong:s.name,say,items:[set(s)],more:[],buttons:[{label:'Open the set',item:set(s)}],source:'Set list'};
  }
  if(tool==='my_collection'){
   const r=await tools.my_collection(args);
   if(pick==='total'){if(!r.copies)return miss('Your collection is empty in this game.');return {ok:true,say:`Your collection is worth ${usd(r.totalValue)||'an unknown amount'} across ${r.copies} cards${r.unpriced?`, with ${r.unpriced} not priced`:''}.`,items:(r.cards||[]).slice(0,1).map(c=>cardItem(g,c)),more:[],moreLabel:'',buttons:[{label:'Open Value',route:'#collection/value'}],source:'Your saved cards and conditions',note:r.cards?.[0]?'Most valuable: '+r.cards[0].name+(usd(r.cards[0].value)?' '+usd(r.cards[0].value):''):''};}
   const cards=r.cards||[];if(!cards.length)return miss('Your collection is empty in this game.');
   const top=cards[0],label=pick==='newest'?'the card you added last':pick==='price-asc'?'your least valuable card':'your most valuable card';
   return {ok:true,strong:top.name,say:`is ${label}${pick!=='newest'&&usd(top.value)?' at '+usd(top.value):''}.`,items:[cardItem(g,top)],more:cards.slice(1,args.limit>1?5:1).map(c=>cardItem(g,c)),moreLabel:'Then',buttons:[{label:'Open the card',item:cardItem(g,top)},{label:'Open Value',route:'#collection/value'}],source:'Your saved cards and conditions'};
  }
  if(tool==='my_decks'){
   const r=await tools.my_decks(args),decks=[...(r.decks||[])],narrowed=plan.read.filter(c=>c.kind==='filter').map(c=>c.label).join(', ');
   if(!decks.length)return miss(narrowed?(r.unknownColors?"Some of your decks' cards are not loaded yet, so the app can't sort them by colour right now.":`None of your saved decks match: ${narrowed}.`):'You have no saved decks in this game.');
   const deck=d=>({kind:'deck',game:g,ref:String(d.id),label:d.name});
   if(pick==='power'){const ranked=decks.filter(d=>d.power!=null).sort((a,b)=>b.power-a.power);if(!ranked.length)return miss('None of your decks has a power score yet.');return {ok:true,strong:ranked[0].name,say:`is your strongest ${narrowed?'deck ('+narrowed+')':'deck'} by the app's power score (${ranked[0].power}).`,items:[deck(ranked[0])],more:ranked.slice(1,3).map(deck),moreLabel:'Then',buttons:[{label:'Open the deck',item:deck(ranked[0])}],source:"The app's Deck Power score, not a win rate"};}
   return {ok:true,say:narrowed?`${decks.length} of your saved decks match${decks.length===1?'es':''}: ${narrowed}.`:`You have ${decks.length} saved deck${decks.length===1?'':'s'}.`,items:decks.slice(0,3).map(deck),more:[],buttons:[{label:'All my decks',route:'#decks'}],source:'Your saved decks'};
  }
  if(tool==='deck_check'||tool==='deck_upgrade'){
   const r=await tools[tool](args),deck=d=>({kind:'deck',game:g,ref:String(d.id),label:d.name}),ask=tool==='deck_check'?n=>'is my '+n+' deck legal'+(args.format?' in '+args.format:''):n=>'how do i make my '+n+' deck better';
   if(r.none)return miss('You have no saved decks in this game.',{buttons:[{label:'All my decks',route:'#decks'}]});
   // More than one deck fits, or none by that name: the decks are offered as chips, never guessed.
   if(r.choose)return {ok:true,say:r.unmatched?`None of your saved decks is named "${args.match}". Pick one:`:'Which of your decks?',items:[],more:[],follow:r.choose.map(d=>({label:d.name+(d.format?' · '+d.format:''),q:ask(d.name.toLowerCase())})),buttons:[{label:'All my decks',route:'#decks'}],source:'Your saved decks'};
   if(r.error)return miss(r.error,{buttons:[{label:'Open the deck',item:deck(r.deck)}]});
   const subject={kind:'mydeck',game:g,name:r.deck.name.toLowerCase()},open={label:'Open the deck',item:deck(r.deck)};
   if(tool==='deck_check'){
    const bad=r.issues.filter(i=>i.kind==='bad'),un=r.issues.filter(i=>i.kind==='unverified'),notes=r.issues.filter(i=>i.kind==='note');
    // A row per failing card or rule, in the validator's own words: "Name: reason" splits into the row's two halves.
    const row=(i,tone)=>{const m=i.text.match(/^(.{2,60}?): (.+)$/);return m?{label:m[1],value:m[2].replace(/\.$/,''),tone}:{label:'',value:i.text.replace(/\.$/,''),tone};};
    const rows=[...bad.map(i=>row(i,'bad')),...un.slice(0,bad.length?3:8).map(i=>row(i,'warn'))].slice(0,12);
    const more=bad.length+un.length-rows.length;
    const say=bad.length?`: not yet. ${bad.length} thing${bad.length===1?'':'s'} to fix for ${r.format}.`:un.length?`: nothing breaks ${r.format}, but ${un.length} check${un.length===1?'':'s'} could not be finished.`:`: yes. All ${r.cards} cards are legal in ${r.format}.`;
    const note=[more>0?`And ${more} more in the deck's own rules review.`:'',pick==='rotate'?'The app has no rotation dates, so this is what is legal today, not what leaves next.':'',...notes.slice(0,1).map(i=>i.text)].filter(Boolean).join(' ');
    return {ok:true,subject,strong:r.deck.name,say,rows,note,items:[deck(r.deck)],more:[],buttons:[open],source:`The app's ${r.format} deck rules · card legality from the card data`};
   }
   if(r.far)return {ok:true,subject,strong:r.deck.name,say:` is not close to any ${r.target.format} tournament list this week. The nearest is ${r.target.name}, sharing ${r.percent}% of its cards.`,meter:{pct:r.percent,label:r.percent+'% of '+r.target.name},items:[deck(r.deck)],more:[],buttons:[open],source:'Counted against this week\'s tournament lists'};
   const buy=r.addCopies-r.ownedCopies,bill=!buy?'':r.unpriced?(r.cost?usd(r.cost)+' plus '+r.unpriced+' with no price':'no price for the rest'):usd(r.cost)+' for the rest';
   const rows=[{label:'Add '+r.addCopies+' card'+(r.addCopies===1?'':'s'),value:[r.ownedCopies?'you own '+r.ownedCopies:'',bill].filter(Boolean).join(' · ')||'none'},...r.add.slice(0,5).map(c=>({label:'+ '+c.qty+' '+c.name,value:c.owned>=c.qty?'you own it':c.price!=null?usd(c.price*(c.qty-c.owned)):'no price'})),
    {label:'Cut '+r.cutCopies+' card'+(r.cutCopies===1?'':'s'),value:r.cut.slice(0,3).map(c=>c.qty+' '+c.name).join(', ')+(r.cut.length>3?' and '+(r.cut.length-3)+' more':'')}];
   return {ok:true,subject,strong:r.deck.name,say:` shares ${r.percent}% of its cards with ${r.target.name}, the closest ${r.target.format} tournament list${r.target.best?' ('+r.target.best+')':''}.`,meter:{pct:r.percent,label:r.percent+'% of the way to '+r.target.name},rows,
    note:r.add.length>5?`${r.add.length-5} more cards to add are in that deck's list.`:'',items:[deck(r.deck)],more:[],buttons:[open,...(r.target.key?[{label:'Open '+r.target.name,item:{kind:'meta',game:g,ref:r.target.key,label:r.target.name}}]:[])],source:'Counted against this week\'s tournament lists. It does not say which deck wins.'};
  }
  if(tool==='deck_matchup'){
   const r=await tools.deck_matchup(args),deck=d=>({kind:'deck',game:g,ref:String(d.id),label:d.name}),metaItem=x=>({kind:'meta',game:g,ref:x.key||x.name,label:x.name});
   const src="The app's matchup simulation, 2,000 simulated games per deck. It models two decks racing; it is not games played on the table.";
   if(r.none)return miss('You have no saved decks in this game.',{buttons:[{label:'All my decks',route:'#decks'}]});
   if(r.choose)return {ok:true,say:r.unmatched?`None of your saved decks is named "${args.match}". Pick one:`:'Which of your decks?',items:[],more:[],follow:r.choose.map(d=>({label:d.name+(d.format?' · '+d.format:''),q:'what beats my '+d.name.toLowerCase()+' deck'})),buttons:[{label:'All my decks',route:'#decks'}],source:'Your saved decks'};
   if(r.error)return miss(r.error,r.deck?.id?{buttons:[{label:'Open the deck',item:deck(r.deck)}]}:{});
   if(r.noField)return miss(`No ${r.deck.format} tournament deck ${r.opponent?'matches "'+r.opponent+'"':'has those colours'} in this week's feed, so there is nothing to simulate against.`);
   const row=(x,flip)=>({label:x.name,value:(flip?100-x.win:x.win)+'% · '+x.share+'% of decks',tone:(flip?100-x.win:x.win)>=55?'good':(flip?100-x.win:x.win)<=45?'bad':''});
   if(pick==='beats'){
    // From the other decks' side: the lists this one does worst against.
    const by=[...r.field].sort((a,b)=>a.win-b.win),top=by[0];
    if(top.win>=50)return {ok:true,strong:r.deck.name,say:` is not behind against any of the ${r.field.length} most played ${r.deck.format} decks in the app's simulation. Its closest matchup is ${top.name} (${top.win}%).`,rows:by.slice(0,3).map(x=>row(x,true)),items:[],more:[],buttons:[],source:src};
    return {ok:true,strong:top.name,say:` does best against ${r.deck.name} in the app's simulation: it wins ${100-top.win}% of simulated games.`,rows:by.slice(1,4).filter(x=>x.win<50).map(x=>row(x,true)),items:[metaItem(top)],more:[],buttons:[{label:'Open '+top.name,item:metaItem(top)}],source:src};
   }
   const subject={kind:'mydeck',game:g,name:r.deck.name.toLowerCase()},open={label:'Open the deck',item:deck(r.deck)};
   if(r.narrowed||r.field.length===1){
    const x=r.field[0];
    return {ok:true,subject,strong:r.deck.name,say:` wins ${x.win}% of simulated games against ${x.name}. On the play ${x.onPlay}%, on the draw ${x.onDraw}%.`,meter:{pct:x.win,label:x.win+'% against '+x.name},rows:r.field.slice(1).map(y=>row(y)),note:(x.reasons||[]).slice(0,2).join(' '),items:[deck(r.deck)],more:[],buttons:[open,{label:'Open '+x.name,item:metaItem(x)}],source:src};
   }
   const by=[...r.field].sort((a,b)=>a.win-b.win),ahead=r.field.filter(x=>x.win>=50).length;
   return {ok:true,subject,strong:r.deck.name,say:` is ahead against ${ahead} of the ${r.field.length} most played ${r.deck.format} decks in the app's simulation. Its hardest matchup is ${by[0].name} (${by[0].win}%).`,rows:by.slice(0,5).map(x=>row(x)),note:r.skipped?`${r.skipped} list${r.skipped===1?'':'s'} could not be loaded and ${r.skipped===1?'is':'are'} not counted.`:'',items:[deck(r.deck)],more:[],buttons:[open],source:src};
  }
  if(tool==='meta_trend'){
   const r=await tools.meta_trend(args),d=x=>{const t=Date.parse(x);if(!Number.isFinite(t))return String(x||'');const y=new Date(t);return y.getUTCDate()+' '+MONTHS[y.getUTCMonth()].slice(0,3);};
   if(r.error)return miss(r.error);
   if(r.empty)return miss(r.start?`The app started saving tournament days on ${d(r.start)}, so there is no earlier day to compare with yet. Ask again in a few days.`:'The app has no saved tournament days for this format yet, so it cannot compare with an earlier time.',{buttons:[{label:'Open tournament decks',route:'#decks/meta'}]});
   const src=`${r.format} tournament feed, one saved line a day since ${d(r.start)}. Each share is over the 30 days before its date.`,short=r.short?`The saved days only go back to ${d(r.day)}, so that is the day compared with.`:'';
   if(!r.decks.length)return miss(r.trend==='then'?`No ${r.format} deck is on record for ${d(r.day)}.`:`No ${r.format} deck has ${r.trend==='falling'?'fallen':'risen'} since ${d(r.day)}.`+(short?' '+short:''));
   const top=r.decks[0],item=x=>({kind:'meta',game:g,ref:x.key||x.name,label:x.name}),line=x=>({label:x.name,value:r.trend==='then'?x.then+'% then · '+(x.gone?'not in the feed now':x.now+'% now'):(x.delta>0?'+':'−')+Math.abs(x.delta)+' · '+(x.fresh?'not in the top 40':x.then+'%')+' to '+x.now+'%',tone:r.trend==='then'?'':x.delta>0?'good':'bad'});
   const say=r.trend==='then'?`was the most played ${r.format} deck on ${d(r.day)}, at ${top.then}% of decks. ${top.gone?'It is not in the feed now.':'It is at '+top.now+'% now.'}`:`is ${r.trend==='falling'?'falling':'rising'} the most in ${r.format}: ${top.fresh?'not in the top 40':top.then+'% of decks'} on ${d(r.day)}, ${top.now}% now.`;
   return {ok:true,...(top.key?{subject:{kind:'meta',game:g,format:r.format,key:top.key,name:top.name}}:{}),strong:top.name,say,rows:r.decks.slice(1).map(line),note:short,items:top.gone?[]:[item(top)],more:[],buttons:top.gone?[]:[{label:'Open the deck',item:item(top)}],source:src};
  }
  if(tool==='price_moves'){
   const r=await tools.price_moves(args),span=plan.call.span||'past week',d=x=>{const t=Date.parse(x);if(!Number.isFinite(t))return String(x||'');const y=new Date(t);return y.getUTCDate()+' '+MONTHS[y.getUTCMonth()].slice(0,3);},signed=v=>(v<0?'−':'+')+usd(Math.abs(v)),src='Prices this device has saved. It saves one each time it sees a price move.';
   if(r.error)return miss(r.error);
   if(r.card){
    const item=cardItem(g,{name:r.card.name,id:r.card.id}),open={label:'Open the card',item};
    if(!r.move)return miss(`This device has no saved price for ${r.card.name} from before today, so it can't compare.${usd(r.card.price)?' It is '+usd(r.card.price)+' now.':''}`,{items:[item],buttons:[open]});
    const m=r.move,delta=Math.round((m.to-m.from)*100)/100,word=delta>0?'is up':delta<0?'is down':'has not moved';
    return {ok:true,strong:r.card.name,say:delta?`${word} ${usd(Math.abs(delta))} since ${d(m.since)}: ${usd(m.from)} then, ${usd(m.to)} now.`:`${word} since ${d(m.since)}: ${usd(m.to)}.`,note:m.late?`The saved prices for this card start on ${d(m.since)}, later than the ${span} you asked about.`:'',items:[item],more:[],buttons:[open],source:src};
   }
   if(!r.counted)return miss(`This device has no saved prices for your cards going back that far (${span}). It saves a price each time it sees one, so this fills in from now on.`,{buttons:[{label:'Open Value',route:'#collection/value'}]});
   const rows=r.movers.map(m=>({label:m.name+(m.qty>1?' ×'+m.qty:''),value:signed(m.delta)+' · '+usd(m.from)+' to '+usd(m.to),tone:m.delta>0?'good':'bad'}));
   const say=!r.up&&!r.down?`None of your cards with a saved price has moved over the ${span}.`:`Your collection is ${r.total>0?'up':r.total<0?'down':'level'}${r.total?' '+usd(Math.abs(r.total)):''} over the ${span}. ${r.up} card${r.up===1?'':'s'} went up and ${r.down} went down.`;
   const note=[r.missing?`${r.missing} of your cards have no saved price that far back and are not counted.`:'',r.late?`For some cards the saved prices start later, the latest on ${d(r.earliest)}.`:''].filter(Boolean).join(' ');
   return {ok:true,say,rows,note,items:[],more:[],buttons:[{label:'Open Value',route:'#collection/value'}],source:src};
  }
  if(tool==='card_details'){
   let r=await tools.card_details(args);
   // "how many lightning bolts do i have": the plural of a card's name is still that card.
   if((r.error||!r.card)&&/[^s]s$/.test(args.name)){const one=await tools.card_details({...args,name:args.name.slice(0,-1)});if(one.card)r=one;}
   if(r.error||!r.card)return miss(r.error||'No card by that name.');
   const c=r.card,item=cardItem(g,c);
   if(pick==='legal'&&g==='ptcg'){
    const f=plan.call.format,ok=c.legalIn?.[String(f).toLowerCase()];
    if(typeof ok!=='boolean')return miss(`The app has no ${f} legality for ${c.name}.`,{items:[item]});
    return {ok:true,strong:c.name,say:ok?`is legal in ${f}.`:`is not legal in ${f}.`,items:[item],more:[],buttons:[{label:'Open the card',item}],source:'Format legality from the card data · other printings of the same card can differ'};
   }
   if(pick==='legal'&&g==='ygo'){
    const f=plan.call.format,list=f==='Goat'?'goat':plan.call.ocg?'ocg':'tcg',label=list==='goat'?'Goat format':list.toUpperCase();
    if(f==='Edison'||!c.ban)return miss(`The app has no ${f==='Edison'?'Edison':label} list status for ${c.name}.`,{items:[item]});
    const st=c.ban[list];
    return {ok:true,strong:c.name,say:st==='banned'?`is Forbidden on the ${label} list: no copies allowed.`:st==='limited'?`is Limited on the ${label} list: 1 copy allowed.`:st==='semi'?`is Semi-Limited on the ${label} list: 2 copies allowed.`:`is not on the ${label} Forbidden & Limited list: 3 copies allowed.`,items:[item],more:[],buttons:[{label:'Open the card',item}],source:'Forbidden & Limited list from the card data'};
   }
   if(pick==='legal'){
    const f=plan.call.format,st=c.legalities?.[f==='Duel Commander'?'duel':String(f).toLowerCase().replace(/ /g,'')];
    if(!st)return miss(`The app has no ${f} legality for ${c.name}.`,{items:[item]});
    return {ok:true,strong:c.name,say:st==='legal'?`is legal in ${f}.`:st==='banned'?`is banned in ${f}.`:st==='restricted'?`is restricted in ${f}: one copy per deck.`:`is not legal in ${f}.`,items:[item],more:[],buttons:[{label:'Open the card',item}],source:'Format legality from the card data'};
   }
   if(pick==='price-foil'){const f=usd(c.foilPrice);if(!f)return miss('The app has no foil price for '+c.name+' right now.',{items:[item]});return {ok:true,strong:c.name,say:`is ${f} in foil.`,items:[item],more:[],buttons:[{label:'Open the card',item}],source:[c.set,'foil market price'].filter(Boolean).join(' · ')};}
   if(pick==='owned')return {ok:true,strong:c.name,say:c.owned?`: you own ${c.owned}.`:`: you don't own it.`,items:[item],more:[],buttons:[{label:'Open the card',item}],source:'Your saved cards'};
   const p=usd(c.price),f=usd(c.foilPrice);if(!p&&!f)return miss('The app has no price for '+c.name+' right now.',{items:[item]});
   return {ok:true,strong:c.name,say:`is ${p||f+' in foil'}${p&&f?' ('+f+' in foil)':''}.`,items:[item],more:[],buttons:[{label:'Open the card',item}],source:[c.set,'market price'].filter(Boolean).join(' · ')};
  }
  if(tool==='app_help'){
   const r=await tools.app_help(args),t=r.topics?.[0];if(!t)return miss("The app's guide has nothing on that.");
   const item={kind:'help',game:g,ref:t.ref,label:t.title};
   return {ok:true,strong:t.title,quote:t.summary,items:[],more:[],buttons:[{label:'Show me how',item}],source:'App guide'};
  }
  if(tool==='wiki_lookup'){
   const tries=[args.query,...(plan.call.alternates||[])].slice(0,3);
   for(const query of tries){
    const r=await tools.wiki_lookup({game:g,query},{userRequest:tries.join(' '),signal:io.signal}).catch(()=>null),flat=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),hit=r?.status==='available'&&(r.results.find(x=>flat(x.source?.title)===flat(query))||r.results[0]);
    if(!hit)continue;
    const title=hit.source?.title||query;
    // The article's own fact box answers "who won", "when", "where" directly; the short excerpt stays as the quote.
    const article=io.wikiArticle?await io.wikiArticle(g,title).catch(()=>null):null,fact=article?wikiFact(article,plan.P.raw):null;
    return {ok:true,say:'From the wiki page',strong:title,fact,quote:hit.extract||'',items:[],more:[],buttons:[{label:'Read the article',route:'#wiki/'+encodeURIComponent(title)}],others:r.results.filter(x=>x!==hit).slice(0,2).map(x=>x.source?.title).filter(Boolean),source:[r.source?.providerName||'Wiki','community reference'].join(' · ')};
   }
   return miss('The wiki has no page for that, or it could not be reached.');
  }
  if(tool==='discover'||tool==='card_search'){
   const search=tool==='discover'?{discover:{kind:args.kind,value:args.value}}:{search:{q:args.q,order:args.order,dir:args.dir}};
   const q=tool==='discover'?(g==='mtg'?'a:"'+args.value+'"':null):args.q;
   const cards=q&&io.cardSearch?await io.cardSearch({game:g,q,order:args.order||'edhrec',dir:args.dir||'asc',limit:3}):[];
   if(cards===null)return miss('The card database could not be reached right now. Ask again in a moment.');
   const what=tool==='discover'?'Cards illustrated by '+args.value:plan.read.filter(c=>c.kind==='filter').map(c=>c.label).join(', ');
   if(q&&io.cardSearch&&!cards.length)return miss('No cards match: '+what+'.');
   const lead=pick==='price-asc'?'is the cheapest':pick==='price-desc'?'is the most expensive':null;
   return {ok:true,...(lead&&cards[0]?{strong:cards[0].name,say:`${lead} (${what}) at ${usd(cards[0].price)||'no price'}.`}:{say:what+'.'}),items:cards.map(c=>cardItem(g,c)),more:[],buttons:[{label:'See them all in Search',...search}],source:'Card search'};
  }
 }catch{return miss('That lookup failed. Check your connection and try again.');}
 return null;
}

/** A typed deck request as the deck builder's own setup: {game, format, budget, colors, theme, creatureTypesOnly, seed}. The words are
 *  read by the builder's fixed contract reader (ai-build-contract.js); nothing is guessed and no deck is drafted here. */
const THEME_NAMES=['Cats','Angels','Humans','Elves','Goblins','Zombies','Lifelink','Lifegain','Tokens','Artifacts','Graveyard'];
const COLOR_NAMES={W:'white',U:'blue',B:'black',R:'red',G:'green',C:'colorless'};
// A power target said in words, as the builder's own dial (Deck Forge: casual, focused, strong, max).
// Commander brackets 1 to 5 are the published ones; "tier" counts down from the top; "power level" is the 1 to 10 table talk.
const POWER_NAME={casual:'Casual',focused:'Focused',strong:'Strong',max:'Maximum'},BRACKET_NAME={1:'Exhibition',2:'Core',3:'Upgraded',4:'Optimized',5:'cEDH'};
const NUM={one:1,two:2,three:3,four:4,five:5};
export function readPower(words){
 const n=String(words||'').toLowerCase(),m=n.match(/\b(tier|bracket|power level|power) ?(\d+|one|two|three|four|five)\b/);
 if(!m)return /\bcedh\b/.test(n)?{power:'max',label:'cEDH: maximum power',said:'cedh'}:null;
 const v=NUM[m[2]]||Number(m[2]),kind=m[1];
 if(kind==='bracket'){if(v<1||v>5)return null;return {power:v<=2?'casual':v===3?'focused':v===4?'strong':'max',bracket:v,label:`bracket ${v} (${BRACKET_NAME[v]})`,said:m[0]};}
 if(kind==='tier'){const power=v<=1?'max':v===2?'strong':v===3?'focused':'casual';return {power,label:`tier ${v}: ${POWER_NAME[power].toLowerCase()} power`,said:m[0]};}
 if(v<1||v>10)return null;
 const power=v<=4?'casual':v<=6?'focused':v<=8?'strong':'max';return {power,label:`power level ${v}: ${POWER_NAME[power].toLowerCase()} power`,said:m[0]};
}
export function buildRequest(words,game='mtg',format='',extra={}){
 const c=readBuildContract([{type:'message',role:'user',content:String(words||'')}],null,{game}),g=c.game||game,request={game:g},labels=[],used=[];
 const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
 if(g==='mtg'){
  const f=format||c.format;if(f){request.format=f;labels.push(f);}
  // The builder's own reading knows colour words; guild and shard names ("izzet", "esper") are read here the way search reads them.
  if(!c.colors?.length){const dc=deckColors(String(words||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' '));if(dc?.colors?.length&&!dc.without?.length)c.colors=dc.colors.map(x=>x.toUpperCase());}
  if(c.colors?.length){request.colors=[...c.colors];labels.push(c.colors.map(x=>COLOR_NAMES[x]).join(' and '));}
  const t=c.themes?.[0];if(t){request.theme=THEME_NAMES.find(n=>n.toLowerCase()===t||n.toLowerCase()===t+'s'||n.toLowerCase()===t.replace(/f$/,'ves'))||cap(t);labels.push(request.theme.toLowerCase()+' theme');used.push(t,t+'s',t.replace(/f$/,'ves'),request.theme);}
  // Further themes ("angels and flying") go to the builder as its style, which it reads the same way as the first.
  const more=(c.themes||[]).slice(1);if(more.length){request.style=more.join(' ');for(const m of more){labels.push(m+' theme');used.push(m,m+'s');}}
  // What the other players lacked is a reason for a theme of my own: no reach or no flyers means my flyers get through.
  const lacks=(extra.pod?.lacks||[]).join(' ');
  if(/\b(?:reach|flying|flyers?|fliers?)\b/.test(lacks)&&!(c.themes||[]).includes('flying')){request.style=[request.style,'flying'].filter(Boolean).join(' ');if(!request.theme)request.theme='Flying';labels.push('flying, because the pod lacks reach');}
  else if(/\b(?:reach|flying|flyers?|fliers?)\b/.test(lacks)){const i=labels.indexOf('flying theme');if(i>=0)labels[i]='flying, because the pod lacks reach';}
  // A play style moves the builder's own role targets (builder.js PLAY_STYLES).
  for(const k of playStylesIn(words)){request.style=[request.style,k==='draw'?'card draw':k].filter(Boolean).join(' ');labels.push(PLAY_STYLES[k].label);used.push(...(String(words).toLowerCase().match(new RegExp(PLAY_STYLES[k].re.source,'g'))||[]));}
  // A power target is the builder's power dial; the other players' colours ask for cards whose own text answers them.
  const pw=readPower(words);if(pw){request.power=pw.power;if(pw.bracket)request.bracket=pw.bracket;labels.push(pw.label);used.push(pw.said);}
  const foes=[...new Set([...(extra.pod?.decks||[]).flatMap(d=>d.colors||[]),...(deckColors(String(extra.opponent||'')+' deck')?.colors||[])])].map(x=>x.toUpperCase()).sort((p,q)=>'WUBRG'.indexOf(p)-'WUBRG'.indexOf(q));
  if(foes.length){request.against=foes;labels.push('answers for '+foes.map(x=>COLOR_NAMES[x]).join(', '));}
  if(c.creatureTypesOnly?.length)request.creatureTypesOnly=[...c.creatureTypesOnly];
  // "a ramp deck around krenko mob boss": what follows "around" is the card to build around, as it is for the other games.
  const around=!extra.seed&&!c.commander&&!c.required_cards?.length?(String(words||'').toLowerCase().replace(/[^a-z0-9' ,-]+/g,' ').match(/\b(?:built |build |based )?around ([a-z0-9' ,-]{3,40}?)(?= (?:and|but|with|for|under|in|that|so|because)\b|$)/)||[])[1]||'':'';
  const aroundName=around.replace(/\b(?:this|my|the|a|an) ?(?:commander|card|one|legend)?\b/g,' ').replace(/\s+/g,' ').trim();
  // A theme or a play style after "around" ("built around dragons", "around ramp") is not a card.
  const aroundCard=aroundName.length>2&&!(c.themes||[]).some(t=>aroundName.includes(t)||t.includes(aroundName))&&!playStylesIn(aroundName).length&&!deckColors(aroundName+' deck')?.colors?.length;
  const seed=extra.seed||c.commander||c.required_cards?.[0]||(aroundCard?aroundName:'');if(seed){request.seed=seed;labels.push('built around '+seed);used.push(seed,'this commander','this card','this one','this legend','i have this');}
 }
 if(c.budget>0){request.budget=String(c.budget);labels.push((c.budgetBoundary==='exclusive'?'under $':'up to $')+c.budget);}
 if(c.budget_basis==='owned'){request.budgetBasis='owned';labels.push('only cards you own');}
 if(!c.goal&&/\bfunn?(?:est|iest|er)\b/i.test(String(words)))c.goal='fun';
 if(c.goal&&c.goal!=='strongest'&&g==='mtg')request.goal=c.goal;
 if(c.goal&&c.goal!=='strongest')labels.push(c.goal==='fun'?'a fun deck':c.goal==='theme'?'theme first':c.goal+' deck');
 // What is left names the thing to build around in Pokémon and Yu-Gi-Oh! (a Pokémon, an archetype); in Magic it is shown as not used.
 let unused=buildLeftover(words,g,used).filter(u=>!(request.power&&/^(?:tier|bracket|power)/.test(u)));
 if(g!=='mtg'&&!request.seed){
  if(extra.seed){request.seed=extra.seed;labels.push('built around '+extra.seed);}
  else{const i=unused.findIndex(u=>!/^(?:tier|bracket|power|would|will|can|could|might|surpris|impress|annoy|scare|shock)/.test(u));if(i>=0){request.seed=unused[i];labels.push('built around "'+unused[i]+'"');unused=unused.filter((_,k)=>k!==i);}}
 }
 // The same reading as rows, for the answer card: one line per setting the builder will get.
 const rows=[];
 if(request.format)rows.push({label:'Format',value:request.format});
 if(request.colors?.length)rows.push({label:'Colours',value:request.colors.map(x=>COLOR_NAMES[x]).join(', ')});
 if(request.seed)rows.push({label:'Built around',value:request.seed});
 const themes=[request.theme,...String(request.style||'').split(' ').filter(w=>w&&w.toLowerCase()!==String(request.theme||'').toLowerCase()&&!/^(?:ramp|control|card|draw|removal)$/.test(w))].filter(Boolean);
 if(themes.length)rows.push({label:themes.length>1?'Themes':'Theme',value:themes.join(', ').toLowerCase()+(extra.pod?.lacks?.length&&/flying/i.test(themes.join(' '))?' (the pod lacks reach)':'')});
 const styles=g==='mtg'?playStylesIn(words).map(k=>PLAY_STYLES[k].label):[];
 if(styles.length)rows.push({label:'Play style',value:styles.join(', ')});
 if(request.power)rows.push({label:'Power',value:readPower(words).label});
 if(request.against?.length)rows.push({label:'Answers for',value:request.against.map(x=>COLOR_NAMES[x]).join(', ')});
 if(request.budget)rows.push({label:'Budget',value:(c.budgetBoundary==='exclusive'?'under $':'up to $')+request.budget});
 if(request.budgetBasis==='owned')rows.push({label:'Cards',value:'only cards you own'});
 if(c.goal&&c.goal!=='strongest')rows.push({label:'Goal',value:c.goal==='fun'?'a fun deck':c.goal==='theme'?'theme first':c.goal});
 for(const u of unused)rows.push({label:'Not used',value:'"'+u+'"',tone:'warn'});
 return {request,labels,unused,rows};
}

/** The answer card. preview(item,i) and esc come from the caller; buttons carry their index for the click handler. */
export function answerMarkup(a,read,{esc,preview=()=>''}){
 if(!a)return '';
 const chips=(read||[]).map(c=>c.fix&&(c.kind==='format'||c.kind==='game')?`<button type="button" class="answer-chip can-fix" data-answer-fix="${c.kind}" aria-label="Change ${esc(c.label)}">${esc(c.label)} ▾</button>`:`<span class="answer-chip">${esc(c.label)}</span>`).join('');
 const head=chips?`<p class="answer-read"><em>Read as</em>${chips}</p>`:'';
 if(a.ask)return `<section class="answer-card is-ask" aria-live="polite">${head}<p class="answer-say">${esc(a.ask.ask)}</p>${(a.ask.choices||[]).length?`<div class="answer-choices">${a.ask.choices.map((c,i)=>`<button type="button" class="chip" data-answer-choice="${i}">${esc(c.name)}</button>`).join('')}</div>`:''}</section>`;
 if(!a.ok)return `<section class="answer-card is-miss" aria-live="polite">${head}<p class="answer-say">${esc(a.miss)}</p><p class="answer-source">Here is the closest the app has.</p></section>`;
 const say=a.strong&&a.say==='From the wiki page'?`${esc(a.say)} <b>${esc(a.strong)}</b>:`:`${a.strong?`<b>${esc(a.strong)}</b>${String(a.say||'').startsWith(':')?'':' '}`:''}${esc(a.say||'')}`;
 const rows=(a.rows||[]).length?`<div class="answer-rows">${a.rows.map(r=>`<p class="answer-row${r.tone?' is-'+esc(r.tone):''}"><b>${esc(r.label)}</b><span>${esc(r.value||'')}</span></p>`).join('')}</div>`:'';
 const meter=a.meter?`<div class="answer-meter" role="img" aria-label="${esc(a.meter.label||a.meter.pct+'%')}"><i style="width:${Math.max(0,Math.min(100,Number(a.meter.pct)||0))}%"></i></div>`:'';
 const follow=(a.follow||[]).length?`<p class="answer-read answer-follow"><em>Ask more</em>${a.follow.map(f=>`<button type="button" class="answer-chip can-ask" data-answer-ask="${esc(f.q)}">${esc(f.label)}</button>`).join('')}</p>`:'';
 return `<section class="answer-card" aria-live="polite">${head}<p class="answer-say">${say}</p>${a.fact?`<p class="answer-fact"><small>${esc(a.fact.label)}</small><b>${esc(a.fact.value)}</b></p>`:''}${a.quote?`<blockquote class="answer-quote">${esc(a.quote)}</blockquote>`:''}${meter}${a.note?`<p class="answer-note">${esc(a.note)}</p>`:''}${rows}${[...(a.vs||[]),...(a.also||[])].map(x=>`<p class="answer-note answer-also"><b>${esc(x.ask)}</b> ${esc(x.text)}</p>`).join('')}${a.items.length?`<div class="answer-items">${a.items.map((s,i)=>preview(s,i)).join('')}</div>`:''}${a.buttons.length?`<div class="answer-buttons">${a.buttons.map((b,i)=>`<button type="button" class="${i?'btn ghost':'btn primary'}" data-answer-button="${i}">${esc(b.label)}</button>`).join('')}</div>`:''}${follow}${a.source?`<p class="answer-source">${esc(a.source)}</p>`:''}${a.more?.length?`<p class="home-app-label">${esc(a.moreLabel||'Also')}</p><div class="answer-items is-more">${a.more.map((s,i)=>preview(s,i+a.items.length)).join('')}</div>`:''}${a.others?.length?`<p class="home-app-label">Also on the wiki</p><div class="answer-choices">${a.others.map(t=>`<button type="button" class="chip" data-answer-wiki="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:''}</section>`;
}
