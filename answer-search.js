// Reads a typed question with fixed rules and names the app lookup that answers it. No AI, no network,
// no DOM: the caller runs the named lookup (the same ones in ai-tools.js) and draws the answer card.
// An answer is offered only when the ask was recognised AND every blank is filled; otherwise the plan
// says what is missing (so the screen can offer chips) or that the app's data cannot answer.
import {parseQuery} from './universal-search.js';
import {gameGlossaryEntry} from './game-wiki-knowledge.js';
import {MTG_VOCABULARY} from './mtg-vocabulary.js';

const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9$.]+/g,' ').trim();
const GAMES=[['mtg',/\b(?:magic|mtg|magic the gathering)\b/,'Magic'],['ptcg',/\b(?:pokemon|ptcg|pokemon tcg)\b/,'Pokémon'],['ygo',/\b(?:yu ?gi ?oh|ygo)\b/,'Yu-Gi-Oh!']];
export const GAME_LABEL=Object.fromEntries(GAMES.map(g=>[g[0],g[2]]));
// The formats each game's tournament data or rules know by name. Longer names first so "duel commander" beats "commander".
const FORMATS={
 mtg:['Duel Commander','Standard','Pioneer','Modern','Legacy','Vintage','Pauper','Premodern','Commander'],
 ptcg:['Standard','Expanded','Gym Leader Challenge'],
 ygo:['Advanced','Goat','Edison'],
};
const FORMAT_ALIAS={cedh:'Commander',edh:'Commander',glc:'Gym Leader Challenge',tcg:'Advanced'};
const RANKS=[
 ['price-desc',/\b(?:most expensive|priciest|most valuable|highest priced?|worth the most|costs? the most|best pulls?|chase cards?)\b/,'highest price'],
 ['price-asc',/\b(?:cheapest|least expensive|lowest priced?|costs? the least)\b/,'lowest price'],
 ['newest',/\b(?:newest|latest|most recent|last)\b/,'newest'],
 ['oldest',/\b(?:oldest|first|earliest)\b/,'oldest'],
 ['largest',/\b(?:biggest|largest)\b/,'biggest'],
];
const MINE=/\b(?:my|mine|i own|i have|do i|have i|ive got|i got)\b/;
const year=n=>(n.match(/\b(19[89]\d|20[0-4]\d)\b/)||[])[1]||null;
const chip=(label,kind,fix=false)=>({label,kind,fix});

function findSet(n,sets=[]){
 // Longest set name that appears whole in the question; a bare code counts only beside the word "set".
 let best=null;
 for(const s of sets){const name=norm(s.name||s.title);if(name.length>=4&&(' '+n+' ').includes(' '+name+' ')&&(!best||name.length>best.len))best={set:s,len:name.length,text:name};}
 if(best)return best;
 if(/\bsets?\b/.test(n))for(const s of sets){const code=norm(s.code);if(code&&code.length>=3&&new RegExp('\\b'+code+'\\b').test(n))return {set:s,len:code.length,text:code};}
 return null;
}
function findFormat(n,game){
 for(const [alias,name] of Object.entries(FORMAT_ALIAS))if(new RegExp('\\b'+alias+'\\b').test(n)&&FORMATS[game]?.includes(name))return name;
 return (FORMATS[game]||[]).find(f=>new RegExp('\\b'+norm(f)+'\\b').test(n))||null;
}
// What is left after the words that only shape the question: the thing being asked about.
const SHAPE=/\b(?:this|that|it|how much|how many|how|how many|what|whats|what is|is|are|does|do|did|the|a|an|of|for|in|on|to|me|my|i|own|have|got|worth|price|priced|cost|costs|value|card|cards|copy|copies|right now|now|today|currently|please|tell|show|magic|mtg|pokemon|ptcg|yugioh|ygo|go for|going for|selling for|mean|means|meaning|work|works|keyword|ability|mechanic|explain|rule|rules|when|come out|came out|released?|release date|set|sets|many|any|there)\b/g;
const subject=n=>n.replace(SHAPE,' ').replace(/[$.]/g,' ').replace(/\s+/g,' ').trim();

// Things the app can do, asked for as an action: "scan a card", "start a match", "open my wishlist".
const ACTIONS=[
 [/\b(?:scan|scanner)\b/,'Scan cards','#scan'],
 [/\b(?:play|start|begin)\b.*\b(?:match|game|quick play)\b|\bquick play\b/,'Play','#play'],
 [/\bplaneswalk\b/,'Planeswalk','planeswalk.html'],
 [/\bwish ?list\b/,'Wishlist','#collection/wishlist'],
 [/\bbinders?\b/,'Binders','#collection/binders'],
 [/\b(?:deck ideas|ideas for decks)\b/,'Deck ideas','#decks/ideas'],
 [/\bsettings?\b|\bpreferences\b/,'Settings','#settings'],
 [/\brule ?book\b|\brules page\b/,'Rules','#rules'],
 [/\bmy collection\b/,'Collection','#collection'],
 [/\bmy decks\b/,'My decks','#decks'],
];
const ACT_VERB=/^(?:open|go to|goto|take me to|show me|show|start|launch|begin|lets|let me|i want to|scan|play)\b/;
// Words that filter cards. Magic only for now: its search already takes all of these as one line.
const COLORS={white:'w',blue:'u',black:'b',red:'r',green:'g',colorless:'c',colourless:'c',multicolor:'m',multicolour:'m',multicolored:'m',gold:'m'};
const TYPES=['creature','instant','sorcery','artifact','enchantment','planeswalker','land','battle','legendary','equipment','aura','saga','vehicle','token'];
const RARITY={common:'common',uncommon:'uncommon',rare:'rare',mythic:'mythic',mythics:'mythic',rares:'rare',commons:'common',uncommons:'uncommon'};
const TRIBES=new Map(MTG_VOCABULARY['creature-types'].map(t=>[t.toLowerCase(),t]));
const KEYWORDS=new Map(MTG_VOCABULARY['keyword-abilities'].map(k=>[k.toLowerCase(),k]));
const singular=w=>TRIBES.has(w)?w:w.endsWith('ves')&&TRIBES.has(w.slice(0,-3)+'f')?w.slice(0,-3)+'f':w.endsWith('ies')&&TRIBES.has(w.slice(0,-3)+'y')?w.slice(0,-3)+'y':w.endsWith('s')&&TRIBES.has(w.slice(0,-1))?w.slice(0,-1):null;
/** Artist of a card question: "cards by rebecca guay", "art by john avon", "rebecca guay artist". */
export function artistOf(n){
 const m=n.match(/\b(?:cards? |art |artwork |illustrated |illustrations? |drawn |painted |everything )+(?:by|from) (?:the )?(?:artist )?([a-z][a-z .]{2,40})$/)||n.match(/\b(?:artist|illustrator) ([a-z][a-z .]{2,40})$/)||n.match(/^([a-z][a-z .]{2,40}) (?:artist|illustrator|art|artwork|cards)$/);
 return m?m[1].replace(/\b(?:cards?|art)\b/g,'').replace(/\s+/g,' ').trim():null;
}
/** Read colour, type, mana, rarity, keyword, format and price words into one Magic search line. Null when nothing filters. */
export function cardFilters(n,format){
 const words=n.split(' '),parts=[],labels=[];let m;
 const colors=[...new Set(words.map(w=>COLORS[w]).filter(Boolean))];
 if(/\bmono\b/.test(n)&&colors.length===1){parts.push('c='+colors[0]);labels.push('mono '+Object.keys(COLORS).find(k=>COLORS[k]===colors[0]));}
 else for(const c of colors){parts.push('c:'+c);labels.push(Object.keys(COLORS).find(k=>COLORS[k]===c));}
 for(const w of words){const t=TYPES.find(t=>w===t||w===t+'s'||(t==='sorcery'&&w==='sorceries'));if(t){parts.push('t:'+t);labels.push(t);}}
 for(const w of words){const t=singular(w);if(t&&!TYPES.includes(t)&&!COLORS[w]){parts.push('t:'+t);labels.push(TRIBES.get(t));}}
 for(const [k,label] of KEYWORDS)if(k.length>3&&new RegExp('\\b(?:with|has|have|having) '+k.replace(/[-]/g,'[- ]')+'\\b').test(n)){parts.push('keyword:"'+k+'"');labels.push(label);}
 for(const w of words)if(RARITY[w]){parts.push('r:'+RARITY[w]);labels.push(RARITY[w]);}
 if((m=n.match(/\b(\d{1,2}) (?:mana|drops?|cmc|mv)\b|\b(?:costs?|mana value|cmc|mv)(?: of)? (\d{1,2})\b/))){const v=m[1]||m[2];parts.push('mv='+v);labels.push(v+' mana');}
 if((m=n.match(/\b(?:(\d{1,2}) (?:mana )?or (less|more)|(?:under|less than|below) (\d{1,2}) mana|(?:over|more than|above) (\d{1,2}) mana)\b/))){const v=m[1]||m[3]||m[4],op=m[2]==='more'||m[4]?'>=':m[3]?'<':'<=';parts.push('mv'+op+v);labels.push(op+v+' mana');}
 if((m=n.match(/\b(?:under|below|less than|cheaper than) \$? ?(\d+(?:\.\d+)?)(?! mana)\b|\b(?:for|at) \$ ?(\d+(?:\.\d+)?) or less\b/))){const v=m[1]||m[2];parts.push('usd<'+v);labels.push('under $'+v);}
 if((m=n.match(/\b(?:over|above|more than) \$? ?(\d+(?:\.\d+)?)(?! mana)\b/))){parts.push('usd>'+m[1]);labels.push('over $'+m[1]);}
 if((m=n.match(/\b(\d{1,2}) ?\/ ?(\d{1,2})\b/))){parts.push('pow='+m[1],'tou='+m[2]);labels.push(m[1]+'/'+m[2]);}
 if(format&&/\b(?:legal|playable|in|for)\b/.test(n)){parts.push('f:'+format.toLowerCase().replace(/ /g,''));labels.push(format+' legal');}
 return parts.length?{q:[...new Set(parts)].join(' '),labels:[...new Set(labels)],count:new Set(parts).size}:null;
}

/** Turn a history question into the wiki page titles most likely to hold the answer, best first. */
export function wikiTitles(q,game='mtg'){
 const n=norm(q),y=year(n),out=[];
 const event=/\bworlds?\b|\bworld champ\w*|\bchampion\w*\b|\btournaments?\b/.test(n),pro=/\bpro tour\b/.test(n);
 if(y&&pro)out.push(`${Number(y)-1}–${String(y).slice(2)} Pro Tour Season`,`${y}–${String(Number(y)+1).slice(2)} Pro Tour Season`);
 if(y&&event&&!pro)out.push(`${y} World Championships`);
 if(y&&event&&!pro&&game==='mtg')out.push(`${Number(y)-1}–${String(y).slice(2)} Pro Tour Season`);
 const plain=n.replace(/\b(?:who|whom|what|when|where|why|how|which|won|win|wins|winner|was|were|is|are|did|does|do|the|a|an|of|in|at|for|to|tell|me|about|history|magic|mtg|magics|pokemon|pokemons|yugioh|ygo|s)\b/g,' ').replace(/\s+/g,' ').trim();
 if(plain&&!out.includes(plain))out.push(plain);
 return out;
}

/**
 * ctx: { game, formatLast:{mtg,ptcg,ygo}, screen:{set,deck,card}, sets:[{code,name}], decks:[{id,name}] }
 * Returns { intent, game, read:[chips], call:{tool,args}|null, missing:[{slot,ask}], answerable, hand }
 *   answerable: the lookup can run now.  hand: 'judge' | 'build' | null for work another screen owns.
 */
export function planQuery(q,ctx={}){
 const raw=String(q||'').trim(),n=norm(raw),P=parseQuery(raw);
 const named=GAMES.find(g=>g[1].test(n)),game=named?named[0]:ctx.game||'mtg';
 const read=[chip(GAME_LABEL[game],'game',true)],missing=[];
 const plan=(intent,call,extra={})=>({intent,game,P,read,missing,call:missing.length?null:call,answerable:!missing.length&&!!call,hand:null,...extra});
 if(n.length<2)return plan('none',null);
 const mine=MINE.test(n),rank=RANKS.find(r=>r[1].test(n)),y=year(n);
 const format=()=>{const f=findFormat(n,game)||ctx.formatLast?.[game]||FORMATS[game][0];read.push(chip(f,'format',true));return f;};

 // Build a deck: the builder owns it, exactly as today.
 if(/\b(?:make|create|build)\b.*\bdeck\b/.test(n))return plan('build',null,{hand:'build'});

 // Do something in the app: "scan a card", "start a match", "open my wishlist".
 if(ACT_VERB.test(n)&&P.words.length<=6){const act=ACTIONS.find(a=>a[0].test(n));if(act){read.push(chip(act[1],'page'));return plan('go',{tool:'go',args:{route:act[2],title:act[1]}});}}

 // Cards by an artist. Yu-Gi-Oh! cards carry no artist, so that game says so instead of guessing.
 const artist=artistOf(n.replace(GAMES.find(g=>g[0]===game)[1],' ').replace(/\s+/g,' ').trim());
 if(artist&&!mine){
  read.push(chip('artist: '+artist,'artist'));
  if(game==='ygo')return plan('unknown',null,{why:'Yu-Gi-Oh! cards do not name their artist.'});
  return plan('cards.artist',{tool:'discover',args:{game,kind:'artist',value:artist}});
 }
 if(/\bmost played cards?\b|\bstaples?\b/.test(n)&&!mine){const f=format();read.push(chip('most played cards','ask'));return plan('meta.cards',{tool:'meta_decks',args:{game,format:f},pick:'cards'});}

 // Tournament decks: "best deck in the meta", "what's winning in modern", "top pioneer decks".
 const metaWord=/\bmeta(?:game)?\b|\btournaments? decks?\b|\bwinning\b|\btier ?(?:1|one|list)\b|\bcompetitive\b/.test(n);
 const deckWord=/\b(?:decks?|archetypes?|lists?)\b/.test(n),bestWord=/\b(?:best|top|strongest|most played|most popular|most common|number one|#1)\b/.test(n);
 if(!mine&&((metaWord&&(deckWord||bestWord||/\bwhat\b/.test(n)))||(bestWord&&deckWord&&!rank?.[0].startsWith('price')))){
  const f=format();read.push(chip('tournament decks','source'),chip('top share','ask'));
  return plan('meta.best',{tool:'meta_decks',args:{game,format:f},pick:'top'});
 }

 // How-to questions about the app itself.
 if(/^how (?:do|can|would|should) i\b|^where (?:do|can|is|are)\b|^can i\b/.test(n)&&/\b(?:scan|add|import|export|sync|backup|back up|restore|share|binder|wishlist|trade|alert|sign in|log in|account|install|theme|sort|settings?)\b/.test(n)){
  read.push(chip('app help','source'));return plan('help',{tool:'app_help',args:{query:raw}});
 }

 // Your own cards and decks. Nothing here leaves the device.
 if(mine){
  if(/\bdecks?\b/.test(n)){read.push(chip('your decks','scope'));return plan('decks.mine',{tool:'my_decks',args:{game},pick:/\b(?:best|strongest|most powerful)\b/.test(n)?'power':'list'});}
  if(/\b(?:collection|cards|binder|stuff|everything)\b/.test(n)&&/\b(?:worth|value|valued|total)\b/.test(n)&&!rank){read.push(chip('your collection','scope'),chip('total value','ask'));return plan('collection.value',{tool:'my_collection',args:{game,sort:'value',limit:1},pick:'total'});}
  if(rank&&/\bcards?\b/.test(n)&&!findSet(n,ctx.sets)){
   const sort=rank[0]==='newest'?'recent':rank[0].startsWith('price')?'value':null;
   if(sort){read.push(chip('your collection','scope'),chip(rank[2],'ask'));return plan('collection.top',{tool:'my_collection',args:{game,sort,limit:/\bcards\b/.test(n)?10:1},pick:rank[0]});}
  }
  if(/\b(?:do i|have i|i own|i have|how many)\b/.test(n)){
   const name=subject(n.replace(MINE,' '));
   if(name){read.push(chip('your collection','scope'),chip(name,'card'));return plan('collection.own',{tool:'card_details',args:{game,name},pick:'owned'});}
  }
 }

 // Ranked cards in a set: "most expensive card in this set", "cheapest card in bloomburrow".
 const hit=findSet(n,ctx.sets),thisSet=/\b(?:this|that|the current) (?:set|expansion)\b/.test(n);
 if(rank&&rank[0].startsWith('price')&&(hit||thisSet||/\b(?:sets?|expansion)\b/.test(n))&&!mine){
  const set=hit?.set||(thisSet||!hit?ctx.screen?.set:null);
  if(set)read.push(chip(set.name||set.title,'set',true));else missing.push({slot:'set',ask:'Which set?'});
  read.push(chip('cards in set','source'),chip(rank[2],'ask'));
  return plan('set.rank',{tool:'set_cards',args:{game,set:String(set?.id||set?.code||''),limit:8},pick:rank[0]});
 }
 // Sets themselves: newest, next, oldest, biggest, or a named set's date.
 if(/\bsets?\b|\bexpansions?\b/.test(n)||hit){
  if(/\b(?:next|upcoming|coming)\b/.test(n)){read.push(chip('next set','ask'));return plan('set.next',{tool:'list_sets',args:{game,query:'',order:'newest',limit:5},pick:'upcoming'});}
  if(hit&&/\bwhen\b|\brelease|\bcome out\b|\bcame out\b|\bhow many cards\b|\bhow big\b/.test(n)){read.push(chip(hit.set.name||hit.set.title,'set',true),chip(/how (?:many|big)/.test(n)?'card count':'release date','ask'));return plan('set.info',{tool:'list_sets',args:{game,query:hit.set.name||hit.set.title,order:'newest',limit:3},pick:/how (?:many|big)/.test(n)?'count':'date'});}
  if(rank&&!rank[0].startsWith('price')&&!hit){read.push(chip(rank[2]+' set','ask'));return plan('set.rank-sets',{tool:'list_sets',args:{game,query:'',order:rank[0],limit:5},pick:rank[0]});}
 }

 // Keywords and rules words: the app's own keyword book and glossary come before any wiki.
 const meaning=/^(?:what does|what is|whats|what are|how does|how do|explain|define)\b|\b(?:mean|means|meaning|do|work|works)$/.test(n);
 if(meaning||P.words.length<=3){
  const term=subject(n),entry=term?gameGlossaryEntry(game,term)||(term.endsWith('s')?gameGlossaryEntry(game,term.slice(0,-1)):null):null;
  if(entry&&(meaning||norm(entry.label)===term)){read.push(chip('keyword: '+entry.label,'keyword'),chip('meaning','ask'));return plan('keyword',{tool:'glossary',args:{game,term:entry.label}},{entry});}
 }
 // A ruling between cards cannot be settled by fixed rules: hand it to Ask a Judge with the words carried over.
 if(/\b(?:can i|can you|does .+ (?:trigger|stack|resolve|counter|target|work with)|what happens (?:if|when)|who wins|in response|interaction|ruling)\b/.test(n))return plan('ruling',null,{hand:'judge'});

 // Cards by what they are: colour, type, mana, rarity, keyword, format, price. Two filters, or one plus a rank, make a question.
 if(game==='mtg'&&!mine&&!hit){
  const f=findFormat(n,game),filters=cardFilters(n,f);
  if(filters&&(rank||/\bcards?\b|\bcreatures?\b|\bspells?\b/.test(n)||(filters.count>=2&&!/^(?:is|are|why|should|does|do|can|could|which|who|when|where)\b/.test(n)))){
   for(const l of filters.labels)read.push(chip(l,'filter',true));
   const order=rank?.[0].startsWith('price')?'usd':rank?.[0]==='newest'||rank?.[0]==='oldest'?'released':'edhrec',dir=rank?.[0]==='price-desc'||rank?.[0]==='newest'?'desc':'asc';
   if(rank)read.push(chip(rank[2],'ask'));
   return plan('cards.filter',{tool:'card_search',args:{game,q:filters.q,order,dir},pick:rank?.[0]||'list'});
  }
 }

 // One card's price.
 if(/\b(?:how much|price|worth|cost|costs|going for|selling for)\b/.test(n)&&!mine){
  const name=subject(n);
  if(name){read.push(chip(name,'card'),chip('price','ask'));return plan('card.price',{tool:'card_details',args:{game,name},pick:'price'});}
  if(ctx.screen?.card){read.push(chip(ctx.screen.card.name,'card',true),chip('price','ask'));return plan('card.price',{tool:'card_details',args:{game,name:ctx.screen.card.name},pick:'price'});}
 }

 // History and people: the game's wiki, asked with page titles instead of the question as typed.
 if(/^(?:who|when|where)\b|\bhistory\b|\bwon\b|\bwinner\b|\bchampion\w*\b|\binvented\b|\bcreated\b|\bdesigned\b/.test(n)||(y&&/\b(?:tournament|worlds?|pro tour|championship)\b/.test(n))){
  const titles=wikiTitles(raw,game);
  if(y)read.push(chip(y,'year'));read.push(chip('wiki','source'));
  if(titles.length)return plan('wiki',{tool:'wiki_lookup',args:{game,query:titles[0]},alternates:titles.slice(1)});
 }
 // Question-shaped but nothing matched: say so plainly; plain name results still show underneath.
 return plan(/^(?:how|why|when|can|could|should|which|what|where|who|does|do|is|are)\b/.test(n)?'unknown':'names',null);
}
