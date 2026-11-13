// Runs a plan from answer-search.js with the app's own lookups (ai-tools.js) and shapes the answer card.
// Every sentence is filled from what the lookup returned. A lookup that fails or comes back empty gives a
// plain "miss" line, never a guess. No AI, no DOM: answerMarkup() only builds a string.
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
export async function answerFor(plan,tools,io={}){
 if(!plan||plan.hand)return null;
 if(plan.intent==='unknown')return miss(plan.why||UNKNOWN);
 if(plan.missing?.length)return {ok:false,ask:plan.missing[0],items:[],more:[],buttons:[]};
 if(!plan.call)return null;
 const {tool,args,pick}=plan.call,g=plan.game;
 try{
  if(tool==='go')return {ok:true,say:'Open '+args.title+'.',items:[],more:[],buttons:[{label:'Open '+args.title,route:args.route}],go:args.route};
  if(tool==='glossary'){
   const e=plan.entry;
   return {ok:true,strong:e.label,quote:e.definition,items:[],more:[],source:e.sourceLabel,
    buttons:[{label:'Read more',route:'#wiki/'+encodeURIComponent(e.label)},...(g==='mtg'&&e.official?[{label:'Cards with '+e.label.toLowerCase(),discover:{kind:'keyword',value:e.label}}]:[]),{label:'Ask a Judge',judge:true}]};
  }
  if(tool==='meta_decks'){
   // The tournament feed sometimes fails on its first read: one more try before saying it is unavailable.
   let r=await tools.meta_decks(args);if(r.error&&!r.format)r=await tools.meta_decks(args);
   if(r.error||!r.decks?.length)return miss(r.error||'No tournament decks for '+args.format+' right now.');
   const items=tools.suggestedItems().slice(0,3),top=r.decks[0],fmt=g==='mtg'&&args.format?args.format:r.format,source=[r.source,r.fetchedAt?'updated '+when(r.fetchedAt):''].filter(Boolean).join(' · ');
   if(pick==='cards')return {ok:true,say:'The most played cards are on the tournament page for '+fmt+'.',items:[],more:[],buttons:[{label:'Open '+fmt+' tournament decks',route:'#decks/inspiration'}],source};
   return {ok:true,strong:top.name,say:`is the most played ${fmt} deck right now: ${top.lists?top.lists+' lists, ':''}${top.share}% of the field.`,items:items.slice(0,1),more:items.slice(1),moreLabel:'Next most played',
    buttons:[{label:'Open the deck',item:items[0]},{label:'All '+fmt+' decks',route:'#decks/inspiration'}],source,note:top.best?'Best finish: '+top.best:''};
  }
  if(tool==='set_cards'){
   if(pick==='price-asc'){
    if(g!=='mtg'||!io.cardSearch)return miss('The app can rank the most expensive cards in a set, not the cheapest, for this game.');
    const cards=await io.cardSearch({game:g,q:'set:'+args.set+' usd>0',order:'usd',dir:'asc',limit:3});if(!cards.length)return miss('No priced cards found in that set.');
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
   const r=await tools.my_decks(args),decks=[...(r.decks||[])];if(!decks.length)return miss('You have no saved decks in this game.');
   const deck=d=>({kind:'deck',game:g,ref:String(d.id),label:d.name});
   if(pick==='power'){const ranked=decks.filter(d=>d.power!=null).sort((a,b)=>b.power-a.power);if(!ranked.length)return miss('None of your decks has a power score yet.');return {ok:true,strong:ranked[0].name,say:`is your strongest deck by the app's power score (${ranked[0].power}).`,items:[deck(ranked[0])],more:ranked.slice(1,3).map(deck),moreLabel:'Then',buttons:[{label:'Open the deck',item:deck(ranked[0])}],source:"The app's Deck Power score, not a win rate"};}
   return {ok:true,say:`You have ${decks.length} saved deck${decks.length===1?'':'s'}.`,items:decks.slice(0,3).map(deck),more:[],buttons:[{label:'All my decks',route:'#decks'}],source:'Your saved decks'};
  }
  if(tool==='card_details'){
   const r=await tools.card_details(args);if(r.error||!r.card)return miss(r.error||'No card by that name.');
   const c=r.card,item=cardItem(g,c);
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
   const what=tool==='discover'?'Cards illustrated by '+args.value:plan.read.filter(c=>c.kind==='filter').map(c=>c.label).join(', ');
   if(q&&io.cardSearch&&!cards.length)return miss('No cards match: '+what+'.');
   const lead=pick==='price-asc'?'is the cheapest':pick==='price-desc'?'is the most expensive':null;
   return {ok:true,...(lead&&cards[0]?{strong:cards[0].name,say:`${lead} (${what}) at ${usd(cards[0].price)||'no price'}.`}:{say:what+'.'}),items:cards.map(c=>cardItem(g,c)),more:[],buttons:[{label:'See them all in Search',...search}],source:'Card search'};
  }
 }catch{return miss('That lookup failed. Check your connection and try again.');}
 return null;
}

/** The answer card. preview(item,i) and esc come from the caller; buttons carry their index for the click handler. */
export function answerMarkup(a,read,{esc,preview=()=>''}){
 if(!a)return '';
 const chips=(read||[]).map(c=>c.fix&&(c.kind==='format'||c.kind==='game')?`<button type="button" class="answer-chip can-fix" data-answer-fix="${c.kind}" aria-label="Change ${esc(c.label)}">${esc(c.label)} ▾</button>`:`<span class="answer-chip">${esc(c.label)}</span>`).join('');
 const head=chips?`<p class="answer-read"><em>Read as</em>${chips}</p>`:'';
 if(a.ask)return `<section class="answer-card is-ask" aria-live="polite">${head}<p class="answer-say">${esc(a.ask.ask)}</p>${(a.ask.choices||[]).length?`<div class="answer-choices">${a.ask.choices.map((c,i)=>`<button type="button" class="chip" data-answer-choice="${i}">${esc(c.name)}</button>`).join('')}</div>`:''}</section>`;
 if(!a.ok)return `<section class="answer-card is-miss" aria-live="polite">${head}<p class="answer-say">${esc(a.miss)}</p><p class="answer-source">Here is the closest the app has.</p></section>`;
 const say=a.strong&&a.say==='From the wiki page'?`${esc(a.say)} <b>${esc(a.strong)}</b>:`:`${a.strong?`<b>${esc(a.strong)}</b> `:''}${esc(a.say||'')}`;
 return `<section class="answer-card" aria-live="polite">${head}<p class="answer-say">${say}</p>${a.fact?`<p class="answer-fact"><small>${esc(a.fact.label)}</small><b>${esc(a.fact.value)}</b></p>`:''}${a.quote?`<blockquote class="answer-quote">${esc(a.quote)}</blockquote>`:''}${a.note?`<p class="answer-note">${esc(a.note)}</p>`:''}${a.items.length?`<div class="answer-items">${a.items.map((s,i)=>preview(s,i)).join('')}</div>`:''}${a.buttons.length?`<div class="answer-buttons">${a.buttons.map((b,i)=>`<button type="button" class="${i?'btn ghost':'btn primary'}" data-answer-button="${i}">${esc(b.label)}</button>`).join('')}</div>`:''}${a.source?`<p class="answer-source">${esc(a.source)}</p>`:''}${a.more?.length?`<p class="home-app-label">${esc(a.moreLabel||'Also')}</p><div class="answer-items is-more">${a.more.map((s,i)=>preview(s,i+a.items.length)).join('')}</div>`:''}${a.others?.length?`<p class="home-app-label">Also on the wiki</p><div class="answer-choices">${a.others.map(t=>`<button type="button" class="chip" data-answer-wiki="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:''}</section>`;
}
