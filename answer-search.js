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
const DEFAULT_FORMAT={mtg:'Standard',ptcg:'Standard',ygo:'Advanced'};
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
// A card's name keeps its own small words ("the one ring", "path to exile"): only the question's shape is cut away, then stray edge words.
const NAME_SHAPE=/\b(?:how much|how many|whats the (?=price|cost|value)|what is the (?=price|cost|value)|what is|whats|what|does|do|did|me|my|i|own|have|got|worth|price|priced|cost|costs|value|card|cards|copy|copies|right now|now|today|currently|please|tell|show|magic|mtg|pokemon|ptcg|yugioh|ygo|go for|going for|selling for|this|that|it)\b/g;
const EDGE=new Set(['is','are','of','for','in','on','a','an']);
const nameOf=n=>{const w=n.replace(NAME_SHAPE,' ').replace(/[$.]/g,' ').split(/\s+/).filter(Boolean);while(w.length&&EDGE.has(w[0]))w.shift();while(w.length&&EDGE.has(w.at(-1)))w.pop();return w.join(' ');};

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
 const words=n.split(' '),parts=[],labels=[],used=[];let m;
 const colors=[...new Set(words.map(w=>COLORS[w]).filter(Boolean))];used.push(...words.filter(w=>COLORS[w]));
 if(/\bmono\b/.test(n)&&colors.length===1){parts.push('c='+colors[0]);labels.push('mono '+Object.keys(COLORS).find(k=>COLORS[k]===colors[0]));used.push('mono');}
 else for(const c of colors){parts.push('c:'+c);labels.push(Object.keys(COLORS).find(k=>COLORS[k]===c));}
 for(const w of words){const t=TYPES.find(t=>w===t||w===t+'s'||(t==='sorcery'&&w==='sorceries'));if(t){parts.push('t:'+t);labels.push(t);used.push(w);}}
 for(const w of words){const t=singular(w);if(t&&!TYPES.includes(t)&&!COLORS[w]){parts.push('t:'+t);labels.push(TRIBES.get(t));used.push(w);}}
 for(const [k,label] of KEYWORDS)if(k.length>3&&(m=n.match(new RegExp('\\b(?:with|has|have|having) '+k.replace(/[-]/g,'[- ]')+'\\b')))){parts.push('keyword:"'+k+'"');labels.push(label);used.push(m[0]);}
 for(const w of words)if(RARITY[w]){parts.push('r:'+RARITY[w]);labels.push(RARITY[w]);used.push(w);}
 if((m=n.match(/\b(\d{1,2}) (?:mana|drops?|cmc|mv)\b|\b(?:costs?|mana value|cmc|mv)(?: of)? (\d{1,2})\b/))){const v=m[1]||m[2];parts.push('mv='+v);labels.push(v+' mana');used.push(m[0]);}
 if((m=n.match(/\b(?:(\d{1,2}) (?:mana )?or (less|more)|(?:under|less than|below) (\d{1,2}) mana|(?:over|more than|above) (\d{1,2}) mana)\b/))){const v=m[1]||m[3]||m[4],op=m[2]==='more'||m[4]?'>=':m[3]?'<':'<=';parts.push('mv'+op+v);labels.push(op+v+' mana');used.push(m[0]);}
 if((m=n.match(/\b(?:under|below|less than|cheaper than) \$? ?(\d+(?:\.\d+)?)(?! mana)\b|\b(?:for|at) \$ ?(\d+(?:\.\d+)?) or less\b/))){const v=m[1]||m[2];parts.push('usd<'+v);labels.push('under $'+v);used.push(m[0]);}
 if((m=n.match(/\b(?:over|above|more than) \$? ?(\d+(?:\.\d+)?)(?! mana)\b/))){parts.push('usd>'+m[1]);labels.push('over $'+m[1]);used.push(m[0]);}
 if((m=n.match(/\b(\d{1,2}) ?\/ ?(\d{1,2})\b/))){parts.push('pow='+m[1],'tou='+m[2]);labels.push(m[1]+'/'+m[2]);used.push(m[0]);}
 if(format&&/\b(?:legal|playable|in|for)\b/.test(n)){parts.push('f:'+format.toLowerCase().replace(/ /g,''));labels.push(format+' legal');used.push('legal','playable');}
 return parts.length?{q:[...new Set(parts)].join(' '),labels:[...new Set(labels)],count:new Set(parts).size,used:used.sort((a,b)=>b.length-a.length)}:null;
}

// Every answer must account for every word of the question. rest() is what is left once the words a rule
// understood are taken out; a rule that leaves words over must use them, say it can't, or not answer.
// (0.4.72 answered "best red deck" with a blue deck because the rule saw "best" and "deck" and never looked at "red".)
const FILL=new Set(('a an the of in on at for to from with and or is are was were be am do does did what whats which who how me my mine i im you your it its '+
 'this that these those there here please show tell give find list get see can could would should will right now today currently current out any some all just really very so').split(' '));
const GAME_WORDS=/\b(?:magic the gathering|magic|mtg|pokemon tcg|pokemon|ptcg|yu ?gi ?oh|ygo)\b/g;
const formatWords=game=>new RegExp('\\b(?:'+[...FORMATS[game].map(norm),...Object.keys(FORMAT_ALIAS)].join('|')+')\\b','g');
export function rest(n,...used){
 let s=' '+n+' ';
 for(const u of used.flat()){if(!u)continue;s=s.replace(typeof u==='string'?new RegExp('(?<![a-z0-9])'+u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![a-z0-9])','g'):u.global?u:new RegExp(u.source,'g'),' ');}
 return s.split(/[\s$.]+/).filter(w=>w&&!FILL.has(w));
}
// A deck's colours in words: "red" (has red), "mono red", "blue white", guild and shard names, "not blue", "two colour".
const WUBRG='wubrg',COLOR_WORD={w:'white',u:'blue',b:'black',r:'red',g:'green'};
const GUILDS={azorius:'wu',dimir:'ub',rakdos:'br',gruul:'rg',selesnya:'gw',orzhov:'wb',izzet:'ur',golgari:'bg',boros:'rw',simic:'gu',esper:'wub',grixis:'ubr',jund:'brg',naya:'rgw',bant:'gwu',abzan:'wbg',jeskai:'urw',sultai:'bgu',mardu:'rwb',temur:'gur'};
const NUMBER={one:1,two:2,three:3,four:4,five:5,1:1,2:2,3:3,4:4,5:5};
export function deckColors(n){
 const used=[],out={},chips=[];let s=n,m;
 const without=[];s=s.replace(/\b(?:but not|thats not|that isnt|not|non|no|without|except) (white|blue|black|red|green)\b/g,(t,c)=>{without.push(COLORS[c]);used.push(t);return ' ';});
 if((m=s.match(/\b(one|two|three|four|five|[1-5]) ?colou?r(?:ed|s)?\b/))){out.count=NUMBER[m[1]];used.push(m[0]);s=s.replace(m[0],' ');}
 const words=s.split(' '),guild=Object.keys(GUILDS).find(g=>words.includes(g)),named=[...new Set(words.map(w=>COLORS[w]).filter(c=>c&&WUBRG.includes(c)))],mono=words.includes('mono');
 const names=c=>[...c].sort((a,b)=>WUBRG.indexOf(a)-WUBRG.indexOf(b)).map(x=>COLOR_WORD[x]);
 let pre='',post='';
 if(guild){out.colors=[...GUILDS[guild]];out.exact=true;used.push(guild);pre=guild[0].toUpperCase()+guild.slice(1);chips.push(pre+' ('+names(out.colors).join('-')+')');}
 else if(named.length){
  out.colors=named;out.exact=mono||named.length>1;used.push(...words.filter(w=>COLORS[w]&&WUBRG.includes(COLORS[w])),mono?'mono':'');
  if(out.exact){pre=(named.length===1?'mono-':'')+names(named).join('-');chips.push(pre);}
  else{post='with '+names(named)[0]+' in it';chips.push('has '+names(named)[0]);}
 }
 if(without.length){out.without=without;post+=(post?' and ':'with ')+'no '+names(without).join(' or ');chips.push('no '+names(without).join(' or '));}
 if(out.count){pre=(pre?pre+' ':'')+out.count+'-colour';chips.push(out.count+' colour'+(out.count>1?'s':''));}
 return out.colors||out.without||out.count?{...out,used,pre,post,chips}:null;
}

/** Turn a history question into the wiki page titles most likely to hold the answer, best first. */
export function wikiTitles(q,game='mtg'){
 const n=norm(q),y=year(n),out=[];
 const event=/\bworlds?\b|\bworld champ\w*|\bchampion\w*\b|\btournaments?\b/.test(n),pro=/\bpro tour\b/.test(n);
 if(y&&pro)out.push(`${Number(y)-1}–${String(y).slice(2)} Pro Tour Season`,`${y}–${String(Number(y)+1).slice(2)} Pro Tour Season`);
 if(y&&event&&!pro)out.push(`${y} World Championships`);
 if(y&&event&&!pro&&game==='mtg')out.push(`${Number(y)-1}–${String(y).slice(2)} Pro Tour Season`);
 const plain=n.replace(/\b(?:who|whom|what|when|where|why|how|which|won|win|wins|winner|was|were|is|are|did|does|do|the|a|an|of|in|at|for|to|tell|me|about|history|designed|designer|designers|design|made|make|created|invented|born|died|die|held|released|release|come|came|out|old|prize|nickname|magic|mtg|magics|pokemon|pokemons|yugioh|ygo|s)\b/g,' ').replace(/\s+/g,' ').trim();
 if(plain&&!out.includes(plain))out.push(plain);
 return out;
}

/**
 * ctx: { game, formatLast:{mtg,ptcg,ygo}, screen:{set,deck,card}, sets:[{code,name}], decks:[{id,name}] }
 * Returns { intent, game, read:[chips], call:{tool,args}|null, missing:[{slot,ask}], answerable, hand }
 *   answerable: the lookup can run now.  hand: 'judge' | 'build' | null for work another screen owns.
 */
export function planQuery(q,ctx={}){
 const raw=String(q||'').trim(),n=norm(raw).replace(/\bmono(white|blue|black|red|green)\b/g,'mono $1'),P=parseQuery(raw);
 const named=GAMES.find(g=>g[1].test(n)),game=ctx.fix?.game||(named?named[0]:ctx.game||'mtg');
 const read=[chip(GAME_LABEL[game],'game',true)],missing=[];
 const plan=(intent,call,extra={})=>({intent,game,P,read,missing,call:missing.length?null:call,answerable:!missing.length&&!!call,hand:null,...extra});
 if(n.length<2)return plan('none',null);
 // Search syntax typed by hand (c:r, t:dragon, usd<5) is a search line, not a question.
 if(/(?:^|\s)-?[a-z]{1,10}[:=<>]/i.test(raw))return plan('names',null);
 const mine=MINE.test(n),rank=RANKS.find(r=>r[1].test(n)),y=year(n);
 const hit=findSet(n,ctx.sets),thisSet=/\b(?:this|that|the current) (?:set|expansion)\b/.test(n);
 const cant=(scope,what,left)=>{read.push(chip(scope,'scope'));return plan('unknown',null,{why:`Search can't narrow ${what} by "${left.join(' ')}" yet.`});};
 const colorChips=col=>{for(const c of col?.chips||[])read.push(chip(c,'filter'));};
 const colorArgs=col=>col?{...(col.colors?{colors:col.colors,exact:!!col.exact}:{}),...(col.without?{without:col.without}:{}),...(col.count?{count:col.count}:{})}:{};
 const format=()=>{const f=(FORMATS[game].includes(ctx.fix?.format)?ctx.fix.format:null)||findFormat(n,game)||(l=>FORMATS[game].includes(l)?l:null)(ctx.formatLast?.[game]==='EDH'?'Commander':ctx.formatLast?.[game])||DEFAULT_FORMAT[game];read.push(chip(f,'format',true));return f;};

 // Build a deck: the builder is set up from the words (format, budget, colours, theme); no AI drafts anything.
 if(/\b(?:make|create|build)\b.*\bdeck\b/.test(n)){read.push(chip('deck builder','page'));return plan('build',{tool:'build_deck',args:{game,request:raw,format:ctx.fix?.format||''}});}

 // Do something in the app: "scan a card", "start a match", "open my wishlist".
 if(ACT_VERB.test(n)&&P.words.length<=6){const act=ACTIONS.find(a=>a[0].test(n));if(act){read.push(chip(act[1],'page'));return plan('go',{tool:'go',args:{route:act[2],title:act[1]}});}}

 // Cards by an artist. Yu-Gi-Oh! cards carry no artist, so that game says so instead of guessing.
 // A set named beside the artist ("cards by rebecca guay in bloomburrow") and colour or type words ("red cards by john avon") narrow the list.
 const artistIn=(hit?n.replace(hit.text,' '):n).replace(GAMES.find(g=>g[0]===game)[1],' ').replace(/\s+/g,' ').trim().replace(/ (?:in|from)(?: the)?(?: set)?$/,'');
 let artist=artistOf(artistIn);
 // "black cards" and "cards that draw cards" are not artists: a name made of filter or filler words is not a name.
 if(artist&&artist.split(' ').some(w=>COLORS[w]||RARITY[w]||TYPES.includes(w.replace(/s$/,''))||singular(w)||['that','with','like','in','my','the','best','top','most','from','for','and','or','not','draw','good','new','cheap','all','how','many','much','what','which','who','when','are','is','do','does','i','me','show','any','these','those','this'].includes(w)))artist=null;
 if(artist&&!mine){
  if(game==='ygo'){read.push(chip('artist: '+artist,'artist'));return plan('unknown',null,{why:'Yu-Gi-Oh! cards do not name their artist.'});}
  const filters=game==='mtg'?cardFilters(artistIn.replace(artist,' ').replace(/\s+/g,' ').trim(),null):null;
  const left=rest(artistIn.replace(artist,' '),filters?.used,/\b(?:cards?|art|artwork|illustrated|illustrations?|drawn|painted|everything|by|artist|illustrator)\b/g);
  if(left.length){read.push(chip('artist: '+artist,'artist'));return plan('unknown',null,{why:`Search can't narrow an artist's cards by "${left.join(' ')}" yet.`});}
  if(hit||filters){
   if(game!=='mtg'){read.push(chip('artist: '+artist,'artist'));return plan('unknown',null,{why:"Search can't narrow an artist's cards by set for this game yet."});}
   read.push(chip('art by '+artist,'filter'));if(hit)read.push(chip(hit.set.name||hit.set.title,'filter'));for(const l of filters?.labels||[])read.push(chip(l,'filter'));
   return plan('cards.filter',{tool:'card_search',args:{game,q:['a:"'+artist+'"',hit?'set:'+String(hit.set.code||hit.set.id):'',filters?.q||''].filter(Boolean).join(' '),order:'edhrec',dir:'asc'},pick:'list'});
  }
  read.push(chip('artist: '+artist,'artist'));
  return plan('cards.artist',{tool:'discover',args:{game,kind:'artist',value:artist}});
 }
 if(/\bmost played cards?\b|\bstaples?\b/.test(n)&&!mine){const f=format();read.push(chip('most played cards','ask'));return plan('meta.cards',{tool:'meta_decks',args:{game,format:f},pick:'cards'});}

 // Tournament decks: "best deck in the meta", "what's winning in modern", "top pioneer decks".
 const metaWord=/\bmeta(?:game)?\b|\btournaments? decks?\b|\bwinning\b|\btier ?(?:1|one|list)\b|\bcompetitive\b/.test(n);
 const deckWord=/\b(?:decks?|archetypes?|lists?)\b/.test(n),bestWord=/\b(?:best|top|strongest|good|most played|most popular|most common|number one|#1)\b/.test(n)||/\b(?:what|which) decks?\b.*\b(?:play|run|use|pick|choose)\b/.test(n);
 // Words about you turn the question around: the tournament deck you are closest to owning, or the cheapest one to finish.
 const CLOSEST=/\b(?:i can (?:build|make|afford)|can i (?:build|make)|(?:am i |im )?clos(?:est|e) to(?: (?:owning|building|finishing))?|for my (?:collection|cards)|(?:with|from) my (?:collection|cards)|i (?:almost|nearly) (?:have|own))\b/;
 const closest=deckWord&&CLOSEST.test(n),deckPrice=deckWord&&!/\bcards?\b/.test(n)&&(rank?.[0].startsWith('price')||/\b(?:budget|cheap|affordable)\b/.test(n))?(rank?.[0]==='price-desc'?'priciest':'cheapest'):null;
 if((closest||!mine)&&((metaWord&&(deckWord||bestWord||/\bwhat\b/.test(n)))||(bestWord&&deckWord)||closest||deckPrice)){
  if(y||/\b(?:last|previous|past) (?:year|season|month)\b|\b(?:years?|months?) ago\b|\ball time\b|\bever\b|\bhistory\b/.test(n)){read.push(chip('tournament decks','source'));return plan('unknown',null,{why:"The tournament data only covers recent events, so the app can't answer for another time."});}
  const f=format(),col=game==='mtg'?deckColors(n):null;
  const nthM=n.match(/\b(second|2nd|third|3rd|fourth|4th|fifth|5th)\b/),nth=nthM?{second:2,'2nd':2,third:3,'3rd':3,fourth:4,'4th':4,fifth:5,'5th':5}[nthM[1]]:1;
  const capM=n.match(/\b(?:under|below|less than|cheaper than|for) \$ ?(\d+)(?:\.\d+)?|\$ ?(\d+)(?:\.\d+)? or less/),under=capM?Number(capM[1]||capM[2]):null;
  // Whatever is left names the deck or a card in it: "aggro", "prowess", "lightning bolt", "charizard".
  const match=rest(n,capM?.[0],GAME_WORDS,formatWords(game),/\btop \d+\b/g,col?.used,CLOSEST,rank?.[1],nthM?.[0],
   /\b(?:meta(?:game)?|tournaments?|decks?|archetypes?|lists?|winning|wins|tier ?(?:1|one|list)|tier|competitive|best|top|strongest|most played|most popular|most common|number one|1|played|popular|good|strong|powerful|most|more|lot|pick|choose|week|month|lately|recently|being|play|playing|plays|run|running|runs|use|using|uses|build|budget|cheap|affordable|finish|complete)\b/g).join(' ');
  const sort=closest?'closest':deckPrice;
  read.push(chip('tournament decks','source'));colorChips(col);
  if(match)read.push(chip('"'+match+'"','filter'));
  if(under!=null)read.push(chip('under $'+under+' to finish','filter'));
  read.push(chip(sort==='closest'?'closest to your collection':sort==='cheapest'?'cheapest to finish':sort==='priciest'?'highest price':nth>1?'number '+nth+' by share':'top share','ask'));
  return plan('meta.best',{tool:'meta_decks',args:{game,format:f,...colorArgs(col),...(match?{match}:{}),...(sort?{sort}:{}),...(under!=null?{under}:{})},pick:'top',nth,pre:col?.pre||'',post:col?.post||''});
 }

 // How-to questions about the app itself.
 if(/^how (?:do|can|would|should) i\b|^where (?:do|can|is|are)\b|^can i\b/.test(n)&&/\b(?:scan|add|import|export|sync|backup|back up|restore|share|binder|wishlist|trade|alert|sign in|log in|account|install|theme|sort|settings?)\b/.test(n)){
  read.push(chip('app help','source'));return plan('help',{tool:'app_help',args:{query:raw}});
 }

 // Your own cards and decks. Nothing here leaves the device.
 if(mine){
  if(/\bdecks?\b/.test(n)){
   if(/\b(?:worth|value|valued|cost|costs|price|priced|expensive|cheapest)\b/.test(n)){read.push(chip('your decks','scope'));return plan('unknown',null,{why:"Search can't total what your decks are worth yet."});}
   // Format, colour and name words narrow your decks: "my commander decks", "my best red deck", "open my burn deck".
   const f=findFormat(n,game),col=game==='mtg'?deckColors(n):null,power=/\b(?:best|strongest|most powerful|good|strong)\b/.test(n);
   const match=rest(n,GAME_WORDS,f?formatWords(game):null,MINE,col?.used,/\b(?:decks?|best|strongest|most powerful|powerful|good|strong|many|saved|open|go|have|own|got|ive)\b/g).join(' ');
   read.push(chip('your decks','scope'));if(f)read.push(chip(f,'filter'));colorChips(col);if(match)read.push(chip('"'+match+'"','filter'));
   return plan('decks.mine',{tool:'my_decks',args:{game,...(f?{format:f}:{}),...colorArgs(col),...(match?{match}:{})},pick:power?'power':'list'});
  }
  if(/\b(?:collection|cards|binder|stuff|everything)\b/.test(n)&&/\b(?:worth|value|valued|total)\b/.test(n)&&!rank){
   const left=rest(n,GAME_WORDS,MINE,/\b(?:collection|cards?|binder|stuff|everything|worth|value|valued|total|much|whole|entire|altogether)\b/g);
   if(left.length)return cant('your collection','your collection',left);
   read.push(chip('your collection','scope'),chip('total value','ask'));return plan('collection.value',{tool:'my_collection',args:{game,sort:'value',limit:1},pick:'total'});
  }
  if(/\bhow many (?:cards|copies)\b/.test(n)&&!rest(n,GAME_WORDS,MINE,/\b(?:many|cards|copies|total|collection|have|own|got|altogether)\b/g).length){read.push(chip('your collection','scope'),chip('card count','ask'));return plan('collection.value',{tool:'my_collection',args:{game,sort:'value',limit:1},pick:'total'});}
  if(rank&&/\bcards?\b/.test(n)&&!hit){
   const sort=rank[0]==='newest'?'recent':rank[0].startsWith('price')?'value':null;
   if(sort){
    const left=rest(n,GAME_WORDS,MINE,rank[1],/\b(?:cards?|collection|binder|added|add|got|one|ive)\b/g);
    if(left.length)return cant('your collection','your collection',left);
    read.push(chip('your collection','scope'),chip(rank[2],'ask'));return plan('collection.top',{tool:'my_collection',args:{game,sort,limit:/\bcards\b/.test(n)?10:1},pick:rank[0]});
   }
  }
  if(/\b(?:do i|have i|i own|i have|how many)\b/.test(n)){
   const name=nameOf(n.replace(MINE,' '));
   // "how many red cards do i own", "how many foils do i have": a colour, type, rarity or finish is not a card name.
   const kinds=name.split(' ').filter(w=>COLORS[w]||RARITY[w]||/^foils?$/.test(w)||TYPES.includes(w.replace(/(?:ies|s)$/,'')));
   if(kinds.length&&(kinds.length===name.split(' ').length||/\bfoils?\b/.test(name)))return cant('your collection','your collection',kinds);
   if(name){read.push(chip('your collection','scope'),chip(name,'card'));return plan('collection.own',{tool:'card_details',args:{game,name},pick:'owned'});}
  }
 }

 // Ranked cards in a set: "most expensive card in this set", "cheapest card in bloomburrow".
 if(rank&&rank[0].startsWith('price')&&(hit||thisSet||/\b(?:sets?|expansion)\b/.test(n))&&!mine){
  const set=hit?.set||(thisSet||!hit?ctx.screen?.set:null);
  // Colour, type and rarity words narrow the set's cards ("most expensive red card in bloomburrow"); anything else is said, not dropped.
  const bare=hit?n.replace(hit.text,' '):n,filters=game==='mtg'?cardFilters(bare,null):null;
  const left=rest(bare,GAME_WORDS,rank[1],filters?.used,/\b(?:cards?|sets?|expansions?|whole|entire)\b/g);
  if(left.length){if(set)read.push(chip(set.name||set.title,'set',true));return plan('unknown',null,{why:`Search can't narrow a set's cards by "${left.join(' ')}" yet.`});}
  if(filters&&set){
   read.push(chip(set.name||set.title,'filter'));for(const l of filters.labels)read.push(chip(l,'filter'));read.push(chip(rank[2],'ask'));
   return plan('cards.filter',{tool:'card_search',args:{game,q:'set:'+String(set.code||set.id)+' '+filters.q,order:'usd',dir:rank[0]==='price-desc'?'desc':'asc'},pick:rank[0]});
  }
  if(set)read.push(chip(set.name||set.title,'set',true));else missing.push({slot:'set',ask:'Which set?'});
  read.push(chip('cards in set','source'),chip(rank[2],'ask'));
  return plan('set.rank',{tool:'set_cards',args:{game,set:String(set?.id||set?.code||''),limit:8},pick:rank[0]});
 }
 // Sets themselves: newest, next, oldest, biggest, or a named set's date.
 if(/\bsets?\b|\bexpansions?\b/.test(n)||hit){
  const extra=(...used)=>rest(hit?n.replace(hit.text,' '):n,GAME_WORDS,...used).length>0;
  if(/\b(?:next|upcoming|coming)\b/.test(n)&&!extra(/\b(?:next|upcoming|coming|sets?|expansions?|when|come|comes|release\w*|new|date|due)\b/g)){read.push(chip('next set','ask'));return plan('set.next',{tool:'list_sets',args:{game,query:'',order:'newest',limit:5},pick:'upcoming'});}
  if(hit&&/\bwhen\b|\brelease|\bcome out\b|\bcame out\b|\bhow many cards\b|\bhow big\b/.test(n)&&!extra(/\b(?:when|release\w*|come|comes|came|many|cards?|big|sets?|expansions?|date|have|has)\b/g)){read.push(chip(hit.set.name||hit.set.title,'set',true),chip(/how (?:many|big)/.test(n)?'card count':'release date','ask'));return plan('set.info',{tool:'list_sets',args:{game,query:hit.set.name||hit.set.title,order:'newest',limit:3},pick:/how (?:many|big)/.test(n)?'count':'date'});}
  if(rank&&!rank[0].startsWith('price')&&!hit&&!extra(rank[1],/\b(?:sets?|expansions?|released|ever|made)\b/g)){read.push(chip(rank[2]+' set','ask'));return plan('set.rank-sets',{tool:'list_sets',args:{game,query:'',order:rank[0],limit:5},pick:rank[0]});}
 }

 // Keywords and rules words: the app's own keyword book and glossary come before any wiki.
 const meaning=/^(?:what does|what is|whats|what are|how does|how do|explain|define)\b|\b(?:mean|means|meaning|do|work|works)$/.test(n);
 if(meaning||P.words.length<=3){
  const term=subject(n),entry=term?gameGlossaryEntry(game,term)||(term.endsWith('s')?gameGlossaryEntry(game,term.slice(0,-1)):null):null;
  if(entry&&(meaning||norm(entry.label)===term)){read.push(chip('keyword: '+entry.label,'keyword'),chip('meaning','ask'));return plan('keyword',{tool:'glossary',args:{game,term:entry.label}},{entry});}
 }
 // Is a card legal in a format: read from the card's own legality list.
 if(game==='mtg'&&!mine&&/\b(?:legal|banned|restricted|allowed|playable)\b/.test(n)&&/^(?:is|are|can i|can you|was)\b/.test(n)){
  const name=nameOf(n.replace(formatWords(game),' ').replace(/\b(?:legal|banned|restricted|allowed|playable|can|you|play|use|run|still|not|ever|was)\b/g,' ').replace(/\s+/g,' ').trim());
  if(name){const f=format();read.push(chip(name,'card'),chip('legality','ask'));return plan('card.legal',{tool:'card_details',args:{game,name},pick:'legal',format:f});}
 }
 // A rules question: the Judge reads the bundled rulebook and quotes the rule that covers it (judge-search.js). No AI.
 if(/\b(?:can i|can you|does .+ (?:trigger|stack|resolve|counter|target|work with)|what happens (?:if|when)|who wins|in response|interaction|ruling)\b/.test(n)||(/^(?:can|could|does|do|is|are|if|when can|when do|when does|how does|how do|how many|what happens)\b/.test(n)&&/\b(?:attacks?|blocks?|blocked|respond|triggers?|stacks?|countered|targets?|tapped|untap|sacrific\w+|destroy\w*|exiled?|dies|enters?|summoning|priority|mulligan|commander|combat|damage|phase|step|evolve|retreat|chains?|summon|activate|resolves?|tokens?|lands?|first turn|each turn)\b/.test(n)&&!mine)){read.push(chip('rules','ask'));return plan('ruling',{tool:'judge',args:{game,question:raw}});}

 // Cards by what they are: colour, type, mana, rarity, keyword, format, price. Two filters, or one plus a rank, make a question.
 if(game==='mtg'&&!mine&&!hit){
  const f=findFormat(n,game),filters=cardFilters(n,f);
  const left=filters?rest(n,GAME_WORDS,filters.used,rank?.[1],formatWords(game),/\b(?:cards?|creatures?|spells?|best|top|good|strongest|most played|most popular|popular|played|cost|costs|legal|playable|have|has|having|ones?)\b/g):[];
  if(filters&&!left.length&&(rank||/\bcards?\b|\bcreatures?\b|\bspells?\b/.test(n)||(filters.count>=2&&!/^(?:is|are|why|should|does|do|can|could|which|who|when|where)\b/.test(n)))){
   for(const l of filters.labels)read.push(chip(l,'filter',true));
   const order=rank?.[0].startsWith('price')?'usd':rank?.[0]==='newest'||rank?.[0]==='oldest'?'released':'edhrec',dir=rank?.[0]==='price-desc'||rank?.[0]==='newest'?'desc':'asc';
   if(rank)read.push(chip(rank[2],'ask'));
   return plan('cards.filter',{tool:'card_search',args:{game,q:filters.q,order,dir},pick:rank?.[0]||'list'});
  }
 }

 // One card's price.
 if(/\b(?:how much|price|worth|cost|costs|going for|selling for)\b/.test(n)&&!mine){
  // One printing ("lightning bolt from bloomburrow") has its own price the search does not read; foil is read from the card.
  if(hit&&new RegExp('\\b(?:from|in)(?: the)? '+hit.text).test(n)){read.push(chip(hit.set.name||hit.set.title,'set'));return plan('unknown',null,{why:"Search can't price one printing of a card yet. Ask without the set name for its usual price."});}
  const foil=/\bfoils?\b/.test(n),name=nameOf(n.replace(/\b(?:in |a |an )?foils?\b/g,' ').replace(/\s+/g,' ').trim());
  if(name){read.push(chip(name,'card'),chip(foil?'foil price':'price','ask'));return plan('card.price',{tool:'card_details',args:{game,name},pick:foil?'price-foil':'price'});}
  if(ctx.screen?.card){read.push(chip(ctx.screen.card.name,'card',true),chip('price','ask'));return plan('card.price',{tool:'card_details',args:{game,name:ctx.screen.card.name},pick:'price'});}
 }

 // History and people: the game's wiki, asked with page titles instead of the question as typed.
 if(/^(?:who|when|where)\b|\bhistory\b|\bwon\b|\bwinner\b|\bchampion\w*\b|\binvented\b|\bcreated\b|\bdesigned\b/.test(n)||(y&&/\b(?:tournament|worlds?|pro tour|championship)\b/.test(n))){
  const titles=wikiTitles(raw,game);
  if(y)read.push(chip(y,'year'));read.push(chip('wiki','source'));
  if(titles.length)return plan('wiki',{tool:'wiki_lookup',args:{game,query:titles[0]},alternates:titles.slice(1)});
 }
 // Question-shaped but nothing matched: say so plainly; plain name results still show underneath.
 // Question-shaped and nothing else matched: the rulebook gets one try, and a miss is said plainly; plain name results still show underneath.
 return /^(?:how|why|when|can|could|should|which|what|where|who|does|do|is|are|if)\b/.test(n)?plan('ruling',{tool:'judge',args:{game,question:raw},pick:'maybe'}):plan('names',null);
}

/** What a tapped "Read as" chip can be changed to. */
export const fixChoices=(plan,kind)=>kind==='format'?FORMATS[plan.game].filter(f=>!['Goat','Edison','Gym Leader Challenge','Duel Commander'].includes(f)):kind==='game'?GAMES.map(g=>g[2]):[];
export const gameOfLabel=label=>GAMES.find(g=>g[2]===label)?.[0]||null;
