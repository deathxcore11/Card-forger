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
 for(const s of sets){const name=norm(s.name||s.title);if((name.length>=4||(name.length===3&&/\b(?:in|from|of|when|release\w*|sets?|came out|come out)\b/.test(n)))&&(' '+n+' ').includes(' '+name+' ')&&(!best||name.length>best.len))best={set:s,len:name.length,text:name};}
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

// The other player in the question: "my friend has a blue deck", "against control", "to beat mono red".
const PLAYER='(?:friends?|buddy|buddies|brother|sister|opponents?|dad|mom|son|daughter|wife|husband|girlfriend|boyfriend|partner|kids?|cousin|roommate|playgroup|pod|group)';
const OTHER_PLAYER=new RegExp('\\b(?:my|our|his|her|their) (?:best )?'+PLAYER+'\\b','g');
const OPPONENT=new RegExp('\\b(?:(?:and|but|because|since|when|while|if) )?(?:my|a|our|his|her|their) (?:best )?'+PLAYER+' (?:has|have|plays?|is playing|are playing|uses?|runs?|is on|will (?:play|use|bring|have)|always plays?|only plays?|loves?|likes?) (?:an? |the )?(.+)$|\\b(?:against|versus|vs|to beat|that beats?|that can beat|beats|beating) (?:(?:my|a|his|her|their) '+PLAYER+' ?s? )?(?:an? |the )?(.+)$');
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
// Kinds of card in Pokémon and Yu-Gi-Oh!: never an artist's name, never a card's name.
const PTCG_TYPE={grass:'Grass',fire:'Fire',water:'Water',lightning:'Lightning',electric:'Lightning',psychic:'Psychic',fighting:'Fighting',darkness:'Darkness',dark:'Darkness',metal:'Metal',steel:'Metal',dragon:'Dragon',colorless:'Colorless',colourless:'Colorless',fairy:'Fairy'};
const YGO_ATTRIBUTE={dark:'DARK',light:'LIGHT',earth:'EARTH',water:'WATER',fire:'FIRE',wind:'WIND',divine:'DIVINE'};
const KIND_WORDS={
 mtg:new Set(),
 ptcg:new Set([...Object.keys(PTCG_TYPE),'pokemon','pokemons','trainer','trainers','supporter','supporters','item','items','stadium','stadiums','tool','tools','energy','energies','basic','stage','ex','gx','v','vmax','vstar','tera','holo','holos','reverse','rare','rares','promo','promos','type','types']),
 ygo:new Set([...Object.keys(YGO_ATTRIBUTE),'monster','monsters','spell','spells','trap','traps','link','links','synchro','synchros','xyz','fusion','fusions','ritual','rituals','pendulum','pendulums','effect','normal','tuner','tuners','extra','rare','rares','attribute','type','types','level','rank']),
};
// One finish, edition or rarity of a card has its own price, which the search does not read.
const FINISH=/\b(?:reverse holos?|holos?|holofoil|1st edition|first edition|unlimited|shadowless|ghost rares?|secret rares?|ultra rares?|super rares?|starlight rares?|quarter century|collectors rares?|full arts?|alt(?:ernate)? arts?|special illustration rares?|illustration rares?|hyper rares?|rainbow rares?|gold rares?|etched|borderless|showcase|extended art|graded|psa ?\d*|bgs ?\d*|cgc ?\d*|near mint|played|damaged)\b/;
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
function planOne(q,ctx={}){
 const raw=String(q||'').trim(),P=parseQuery(raw);
 let n=norm(raw).replace(/\bmono(white|blue|black|red|green)\b/g,'mono $1'),opp='';
 // "... and my friend has a blue deck", "... against control": the other player's deck is not the deck being asked for.
 if(/\bdecks?\b/.test(n)){const om=n.match(OPPONENT);if(om&&om.index>0){opp=(om[1]||om[2]||'').replace(/\b(?:decks?|one|ones)\b/g,' ').replace(/\s+/g,' ').trim();n=n.slice(0,om.index).replace(/\b(?:and|but|because|since|when|while|if|that|to)$/,'').trim();}}
 const nowYear=String(new Date().getFullYear());
 const named=GAMES.find(g=>g[1].test(n)),game=ctx.fix?.game||(named?named[0]:ctx.game||'mtg');
 const read=[chip(GAME_LABEL[game],'game',true)],missing=[];
 const plan=(intent,call,extra={})=>({intent,game,P,read,missing,call:missing.length?null:call,answerable:!missing.length&&!!call,hand:null,...extra});
 // A table of other players described in full is a deck request for that table, whatever else the line says.
 const table=/\b(?:decks?|make|build|commander)\b/.test(n)?readPod(raw):null;
 if(table){
  const {pod}=table,seed=/\bthis (?:commander|card|one|legend|pokemon|monster)\b|\bi have this\b/i.test(raw)?ctx.screen?.card?.name||'':'';
  read.push(chip('deck builder','page'));if(seed)read.push(chip(seed,'card'));
  if(pod.size)read.push(chip('pod of '+pod.size,'filter'));
  if(pod.decks.length)read.push(chip('against '+pod.decks.map(d=>d.label).join(' · '),'filter'));
  if(pod.power)read.push(chip("match the pod's power",'filter'));
  for(const l of pod.lacks)read.push(chip('pod lacks '+l,'filter'));
  return plan('build',{tool:'build_deck',args:{game,request:table.mine,format:ctx.fix?.format||(game==='mtg'&&(pod.size>=3||/\bcommander\b/.test(n))?'Commander':''),...(seed?{seed}:{})},opponent:'',pod});
 }
 if(n.length<2)return plan('none',null);
 // Search syntax typed by hand (c:r, t:dragon, usd<5) is a search line, not a question.
 if(/(?:^|\s)-?[a-z]{1,10}[:=<>](?=\S)/i.test(raw))return plan('names',null);
 const mine=MINE.test(n.replace(OTHER_PLAYER,' ')),rank=RANKS.find(r=>r[1].test(n)),y=year(n);
 const hit=findSet(n,ctx.sets),thisSet=/\b(?:this|that|the current) (?:set|expansion)\b/.test(n);
 const cant=(scope,what,left)=>{read.push(chip(scope,'scope'));return plan('unknown',null,{why:`Search can't narrow ${what} by "${left.join(' ')}" yet.`});};
 const colorChips=col=>{for(const c of col?.chips||[])read.push(chip(c,'filter'));};
 const colorArgs=col=>col?{...(col.colors?{colors:col.colors,exact:!!col.exact}:{}),...(col.without?{without:col.without}:{}),...(col.count?{count:col.count}:{})}:{};
 const format=()=>{const f=(FORMATS[game].includes(ctx.fix?.format)?ctx.fix.format:null)||findFormat(n,game)||(l=>FORMATS[game].includes(l)?l:null)(ctx.formatLast?.[game]==='EDH'?'Commander':ctx.formatLast?.[game])||DEFAULT_FORMAT[game];read.push(chip(f,'format',true));return f;};

 // Build a deck: the builder is set up from the words (format, budget, colours, theme); no AI drafts anything.
 // Asking for a kind of deck rather than a ranking ("what is a fun commander deck with angels", "a ramp deck i can buy for under $50",
 // "a cool blue-eyes deck to surprise my friend") is the same job: the builder makes it.
 const wantsDeck=/\bdecks?\b/.test(n)&&!/\bmy (?:\w+ ){0,2}decks?\b/.test(n.replace(OTHER_PLAYER,' '))&&!/\b(?:meta(?:game)?|tournaments?|winning|tier ?(?:1|one)|most played|most popular)\b/.test(n)&&(
  /\b(?:fun|funnest|funniest|funner|cool|coolest|casual|silly|janky|jank|spicy|unique|interesting|creative|weird|awesome|sick|neat|surpris\w+|unexpected|themed?|tribal|kindred)\b/.test(n)||
  /\b(?:suggest|recommend|give me|i want|i need|id like|i would like|looking for|ideas? for|help me (?:find|pick|choose|make|build)|can you (?:find|suggest|recommend)|could you|make me|build me)\b/.test(n)||
  (/\b(?:what is|whats|what would be|what are|is there|are there|show me)\b.*\ban? (?:\w+ ){0,6}decks?\b/.test(n)&&!/\b(?:best|top|strongest)\b/.test(n))||
  /\bdecks? (?:that |which )?(?:(?:i|we) (?:can|could)|(?:can|could|should) (?:i|we)) (?:buy|purchase|get|afford)\b/.test(n));
 if(/\b(?:make|create|build)\b.*\bdeck\b/.test(n)||wantsDeck){
  // "I have this commander": the card open on screen is what the deck is built around.
  const seed=/\bthis (?:commander|card|one|legend|pokemon|monster)\b|\bi have this\b/.test(n)?ctx.screen?.card?.name||'':'';
  read.push(chip('deck builder','page'));if(seed)read.push(chip(seed,'card'));if(opp)read.push(chip('against '+opp,'filter'));
  return plan('build',{tool:'build_deck',args:{game,request:opp?n:raw,format:ctx.fix?.format||'',...(seed?{seed}:{})},opponent:opp});
 }

 // Do something in the app: "scan a card", "start a match", "open my wishlist".
 if(ACT_VERB.test(n)&&P.words.length<=6){const act=ACTIONS.find(a=>a[0].test(n));if(act){read.push(chip(act[1],'page'));return plan('go',{tool:'go',args:{route:act[2],title:act[1]}});}}

 // Cards by an artist. Yu-Gi-Oh! cards carry no artist, so that game says so instead of guessing.
 // A set named beside the artist ("cards by rebecca guay in bloomburrow") and colour or type words ("red cards by john avon") narrow the list.
 const artistIn=(hit?n.replace(hit.text,' '):n).replace(GAMES.find(g=>g[0]===game)[1],' ').replace(/\s+/g,' ').trim().replace(/ (?:in|from)(?: the)?(?: set)?$/,'');
 let artist=artistOf(artistIn);
 // "black cards" and "cards that draw cards" are not artists: a name made of filter or filler words is not a name.
 if(artist&&artist.split(' ').some(w=>COLORS[w]||RARITY[w]||TYPES.includes(w.replace(/s$/,''))||singular(w)||['that','with','like','in','my','the','best','top','most','from','for','and','or','not','draw','good','new','cheap','all','how','many','much','what','which','who','when','are','is','do','does','i','me','show','any','these','those','this'].includes(w)||KIND_WORDS[game].has(w)))artist=null;
 // "trainer cards", "spell cards": one bare word before "cards" is a kind of card, not a person. An artist needs "by", or two names.
 if(artist&&!/\b(?:by|from|artist|illustrator)\b/.test(artistIn)&&artist.split(' ').length<2)artist=null;
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
 const CLOSEST=/\b(?:i can (?:build|make|afford)|can i (?:build|make)|(?:am i |im )?clos(?:est|e) to(?: (?:owning|building|finishing))?|clos(?:est|er|e)\b.*\bto (?:my|what i|the cards i|mine)\b(?: (?:collection|cards|binder|own|have))?|for my (?:collection|cards)|(?:with|from) my (?:collection|cards)|i (?:almost|nearly) (?:have|own))\b/;
 const closest=deckWord&&CLOSEST.test(n)&&!/\b(?:of )?my decks?\b/.test(n),deckPrice=deckWord&&!/\bcards?\b/.test(n)&&(rank?.[0].startsWith('price')||/\b(?:budget|cheap|affordable)\b/.test(n))?(rank?.[0]==='price-desc'?'priciest':'cheapest'):null;
 if((closest||!mine)&&((opp&&deckWord)||(metaWord&&(deckWord||bestWord||/\bwhats?\b/.test(n)||/\bmeta(?:game)?\b/.test(n)))||(bestWord&&deckWord)||closest||deckPrice)){
  if((y&&y!==nowYear)||/\b(?:last|previous|past) (?:year|season|month)\b|\b(?:years?|months?) ago\b|\ball time\b|\bever\b|\bhistory\b/.test(n)){read.push(chip('tournament decks','source'));return plan('unknown',null,{why:"The tournament data only covers recent events, so the app can't answer for another time."});}
  // "best deck with black lotus": what follows "with" is a card's name, word for word, not a colour and not filler.
  const withM=n.match(/\b(?:with|playing|running|using|that (?:plays?|runs?|uses?|has|have)) (.+)$/),withCard=withM&&!/^(?:my|no|only)\b/.test(withM[1])?withM[1].replace(formatWords(game),' ').replace(/\b(?:right now|today|currently|this week|in it|in them|in the meta|in|decks?)\s*$/g,' ').replace(/\s+/g,' ').trim().replace(/ in$/,''):'';
  const nq=withCard?n.slice(0,withM.index):n;
  const f=format(),col=game==='mtg'?deckColors(nq):null;
  const nthM=n.match(/\b(second|2nd|third|3rd|fourth|4th|fifth|5th)\b/),nth=nthM?{second:2,'2nd':2,third:3,'3rd':3,fourth:4,'4th':4,fifth:5,'5th':5}[nthM[1]]:1;
  const capM=n.match(/\b(?:under|below|less than|cheaper than|for) \$ ?(\d+)(?:\.\d+)?|\$ ?(\d+)(?:\.\d+)? or less/),under=capM?Number(capM[1]||capM[2]):null;
  // Whatever is left names the deck or a card in it: "aggro", "prowess", "lightning bolt", "charizard".
  const match=withCard||rest(nq,capM?.[0],nowYear,/\bthis (?:year|season|month)\b/g,GAME_WORDS,formatWords(game),/\btop \d+\b/g,col?.used,CLOSEST,closest?/\b(?:clos(?:est|er|e)|collection|cards|binder|own|have)\b/g:null,rank?.[1],nthM?.[0],
   game==='mtg'?null:/\b(?:types?|attribute|monsters?|energy)\b/g,
   /\b(?:meta(?:game)?|tournaments?|decks?|archetypes?|lists?|winning|wins|tier ?(?:1|one|list)|tier|competitive|best|top|strongest|most played|most popular|most common|number one|1|played|popular|good|strong|powerful|most|more|lot|pick|choose|week|month|lately|recently|being|play|playing|plays|run|running|runs|use|using|uses|build|budget|cheap|affordable|finish|complete)\b/g).join(' ');
  const sort=closest?'closest':deckPrice;
  read.push(chip('tournament decks','source'));colorChips(col);
  if(match)read.push(chip('"'+match+'"','filter'));
  if(under!=null)read.push(chip('under $'+under+' to finish','filter'));
  if(opp)read.push(chip('against '+opp,'filter'));
  read.push(chip(sort==='closest'?'closest to your collection':sort==='cheapest'?'cheapest to finish':sort==='priciest'?'highest price':nth>1?'number '+nth+' by share':'top share','ask'));
  return plan('meta.best',{tool:'meta_decks',args:{game,format:f,...colorArgs(col),...(match?{match}:{}),...(sort?{sort}:{}),...(under!=null?{under}:{})},pick:'top',nth,pre:col?.pre||'',post:col?.post||'',opponent:opp});
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
  if(/\b(?:do i (?:own|have)|have i got|i own|i have|ive got|how many .+ (?:do i (?:own|have)|have i got|i (?:own|have)))\b/.test(n)&&!/\b(?:each turn|per turn|a turn|every turn|in (?:my|a|the) (?:hand|deck)|first turn|draw|summons?|attacks?|phase)\b/.test(n)){
   const name=nameOf(n.replace(MINE,' '));
   // "how many red cards do i own", "how many foils do i have": a colour, type, rarity or finish is not a card name.
   const kinds=name.split(' ').filter(w=>game==='mtg'?COLORS[w]||RARITY[w]||/^foils?$/.test(w)||TYPES.includes(w.replace(/(?:ies|s)$/,'')):KIND_WORDS[game].has(w)||w==='cards'||w==='card'||/^foils?$/.test(w)),isCard=game==='ptcg'&&/\benergy\b/.test(name);
   if(kinds.length&&!isCard&&(kinds.length===name.split(' ').length||/\bfoils?\b/.test(name)))return cant('your collection','your collection',kinds);
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
  const whole=n.replace(/^(?:what does|what is|whats|what are|how does|how do|explain|define)\s+/,'').replace(/\s+(?:mean|means|meaning|do|does|work|works)$/,'').replace(/^(?:a|an|the) /,'').replace(GAME_WORDS,' ').replace(/\s+/g,' ').replace(/^in | in$/g,'').trim();
  const term=whole&&(gameGlossaryEntry(game,whole)||(whole.endsWith('s')&&gameGlossaryEntry(game,whole.slice(0,-1))))?whole:subject(n),entry=term?gameGlossaryEntry(game,term)||(term.endsWith('s')?gameGlossaryEntry(game,term.slice(0,-1)):null):null;
  if(entry&&(meaning||norm(entry.label)===term)){read.push(chip('keyword: '+entry.label,'keyword'),chip('meaning','ask'));return plan('keyword',{tool:'glossary',args:{game,term:entry.label}},{entry});}
 }
 // Is a card legal in a format: read from the card's own legality list.
 if(!mine&&/\b(?:legal|banned|forbidden|restricted|limited|semi limited|allowed|playable)\b/.test(n)&&/^(?:is|are|can i|can you|was)\b/.test(n)){
  const ocg=game==='ygo'&&/\bocg\b/.test(n);
  const name=nameOf(n.replace(formatWords(game),' ').replace(GAME_WORDS,' ').replace(/\b(?:legal|banned|forbidden|restricted|semi limited|limited|allowed|playable|can|you|play|use|run|still|not|ever|was|ocg|format|on the (?:ban ?list|list))\b/g,' ').replace(/\s+/g,' ').trim().replace(/(?: (?:in|on|the))+$/,''));
  if(name){const f=format();if(ocg)read.push(chip('OCG list','filter'));read.push(chip(name,'card'),chip('legality','ask'));return plan('card.legal',{tool:'card_details',args:{game,name},pick:'legal',format:f,ocg});}
 }
 // A rules question: the Judge reads the bundled rulebook and quotes the rule that covers it (judge-search.js). No AI.
 if(/\b(?:can i|can you|does .+ (?:trigger|stack|resolve|counter|target|work with)|what happens (?:if|when)|who wins|in response|interaction|ruling)\b/.test(n)||(/^(?:can|could|does|do|is|are|if|when can|when do|when does|how does|how do|how many|what happens)\b/.test(n)&&/\b(?:attacks?|blocks?|blocked|respond|triggers?|stacks?|countered|targets?|tapped|untap|sacrific\w+|destroy\w*|exiled?|dies|enters?|summoning|priority|mulligan|commander|combat|damage|phase|step|evolve|retreat|chains?|summon|activate|resolves?|tokens?|lands?|first turn|each turn|draw|prize|hand|attach|shuffle|discard)\b/.test(n)&&!(mine&&/\b(?:my (?:collection|cards|decks?|binders?|wishlist)|own)\b/.test(n)))){read.push(chip('rules','ask'));return plan('ruling',{tool:'judge',args:{game,question:raw}});}

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
  const fin=n.match(FINISH)||(game!=='mtg'&&n.match(/\bfoils?\b/));
  if(fin){read.push(chip('price','ask'));return plan('unknown',null,{why:`Search can't price one finish, edition or rarity ("${fin[0]}") of a card yet. Ask with only the card's name for its usual price.`});}
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

// ---- Spelling. A word that is one slip away from a word the search knows ("modren", "cheepest", "standrd") is read as that word,
// but only when the question as typed was not understood: a card's own name ("Commandeer") is never "corrected" into a question word.
const KNOWN=new Set(('best top strongest cheapest expensive valuable priciest popular played newest latest oldest biggest largest deck decks card cards collection binder wishlist worth price value cost budget '+
 'tournament tournaments meta metagame competitive winning legal banned forbidden limited restricted playable release released rotate creature creatures instant instants sorcery sorceries artifact artifacts enchantment enchantments planeswalker planeswalkers land lands legendary equipment vehicle '+
 'common uncommon mythic rare white blue black red green colorless multicolor mono color colour colors colours magic pokemon yugioh commander closest build which what where when under below against artist illustrated '+
 'second third fourth fifth trainer supporter stadium energy monster monsters spell spells trap traps dragon dragons flying trample haste').split(' ').concat(Object.keys(GUILDS),Object.values(FORMATS).flat().flatMap(f=>norm(f).split(' ')),Object.keys(FORMAT_ALIAS)));
// Everyday words that sit one letter from a search word and are never a slip of it.
const COMMON=new Set('whats hows wheres whens thats heres there their these those them then than that this with have has had been being were where when will would could should about after before again every other some more most much many each both into onto over only also just very really like make made want need know think good great nice cool cheap first last next play plays game games name names find show tell give take open close start bolt ring lotus path fire water dark light storm burn list lists rest test west nest pest vest lest beck neck peck dock duck desk disc disk read real seal deal meal heal best beat beast bust base'.split(' '));
function slips(a,b){
 // Damerau-Levenshtein distance, stopped early: adjacent letters swapped count once.
 if(Math.abs(a.length-b.length)>2)return 3;
 const d=[];for(let i=0;i<=a.length;i++){d[i]=[i];for(let j=1;j<=b.length;j++)d[i][j]=i===0?j:Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1),i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]?d[i-2][j-2]+1:9);}
 return d[a.length][b.length];
}
export function respell(text,ctx={},keep=new Set()){
 const words=new Set(KNOWN);for(const s of ctx.sets||[])for(const w of norm(s.name||s.title).split(' '))if(w.length>=5)words.add(w);
 const fixes=[],out=String(text||'').split(/(\s+)/).map(tok=>{
  const w=norm(tok);if(!w||keep.has(w)||/\s/.test(tok)||w.includes(' ')||/\d/.test(w)||w.length<4||words.has(w)||FILL.has(w)||COMMON.has(w))return tok;
  let best=null,tie=false;const max=w.length>=8?2:1;
  for(const k of words){if(Math.abs(k.length-w.length)>max||k[0]!==w[0]&&k[1]!==w[1])continue;const dist=slips(w,k);
   // A four-letter word is only repaired when two neighbouring letters were swapped ("dcek"), never by guessing a letter.
   if(dist>max||(w.length===4&&!(k.length===4&&[...k].sort().join('')===[...w].sort().join(''))))continue;
   if(!best||dist<best.dist){best={k,dist};tie=false;}else if(dist===best.dist&&k!==best.k)tie=true;}
  if(!best||tie)return tok;
  fixes.push([w,best.k]);return best.k;
 });
 return {text:out.join(''),fixes};
}
// How well a reading holds: answered outright beats a name search, a shrug or a leftover word treated as a deck name.
const weak=p=>!p.answerable||p.call?.pick==='maybe'||!!p.call?.args?.match||p.intent==='names';
function planSpelled(q,ctx){
 const p=planOne(q,ctx);if(!weak(p))return p;
 let fixed=respell(q,ctx);if(!fixed.fixes.length)return p;
 let p2=planOne(fixed.text,ctx);
 // Taken only when the repaired words read better than the words as typed.
 if(weak(p2)&&!(p2.intent==='build'||(p2.answerable&&p2.call?.pick!=='maybe'&&p.intent==='names')))return p;
 // Only the repairs the reading needs are kept: in "is pot of greed bannd" the card keeps its own word "greed".
 const keep=new Set();
 for(const [from] of fixes(fixed)){
  const t=respell(q,ctx,new Set([...keep,from])),p3=planOne(t.text,ctx);
  if(p3.intent===p2.intent&&p3.call?.tool===p2.call?.tool&&p3.call?.pick===p2.call?.pick&&weak(p3)===weak(p2)&&!p3.call?.args?.match===!p2.call?.args?.match){keep.add(from);fixed=t;p2=p3;}
 }
 if(!fixed.fixes.length)return p;
 for(const [from,to] of fixes(fixed))p2.read.push(chip('"'+from+'" read as '+to,'spelling'));
 p2.P=p.P;p2.respelled=fixed.text;return p2;
}
const fixes=f=>f.fixes.filter(([a,b],i,all)=>all.findIndex(x=>x[0]===a)===i);

// ---- Several asks in one line: "what is the best red deck, how much does it cost and where did it place?"
const ASK_WORD="how|what|whats|what's|where|when|who|is|are|do|does|did|can|which|will";
const splitAsks=raw=>String(raw||'').split(new RegExp('\\s*[?;]+\\s*|\\s+(?:and also|also|and then|then|plus)\\s+(?=(?:'+ASK_WORD+')\\b)|,?\\s+and\\s+(?=(?:'+ASK_WORD+')\\b)|,\\s+(?=(?:'+ASK_WORD+')\\b)','i')).map(s=>s.trim()).filter(s=>s.length>=2).slice(0,5);
const IT=/\b(?:it|its|that deck|this deck|the deck|that one|this one|that card|this card|the card|that|them)\b/;
// What a follow-up asks about the deck the first ask found.
const DECK_FACETS=[
 ['beat',/\b(?:beat|beats|against|counter|counters|weak to|lose to|loses to|good against|bad against|matchups?)\b/],
 ['own',/\b(?:do i (?:own|have)|how (?:much|many) (?:of (?:it|them) )?do i (?:own|have)|how close|what am i missing|what do i need|missing)\b/],
 ['cost',/\b(?:how much|cost|costs|price|priced|expensive|cheap|afford|buy|to build|to finish|worth)\b/],
 ['colors',/\bcolou?rs?\b/],
 ['place',/\b(?:place|placed|finish|finished|results?|won|win|how did|did it do|do well)\b/],
 ['popular',/\b(?:popular|how many (?:people|players|lists)|share|how played|how common)\b/],
 ['list',/\b(?:whats in|what is in|cards (?:are )?in|decklist|deck list|what does it (?:play|run)|what cards)\b/],
];
// ---- A whole table described in one breath: "I'm in a pod with three other people. They have a blue-white, a red-blue and a
// mono-black deck, I have this commander, keep it within their bracket, they had no reach so I'd like flying."
// The other players' decks, the table's power and what they lacked are facts about THEM; only the rest describes my deck.
const COUNT={one:1,two:2,three:3,four:4,five:5,1:1,2:2,3:3,4:4,5:5};
const THEM='(?:they|them|the others?|the other (?:players|people|decks|guys)|my friends|our friends|my opponents|opponents|everyone else|the rest)';
export function readPod(raw){
 const parts=String(raw||'').split(/[.!?;]+|,?\s+\b(?:and|so|but|because|since|plus|also)\b\s+(?=(?:i|im|i'm|i’m|id|i'd|i’d|we|were|we're|we’re|they|a lot|lots|most|some|none|many|last time)\b)/i).map(x=>x.trim()).filter(Boolean);
 const pod={size:0,decks:[],power:false,lacks:[]},mine=[];
 for(const part of parts){
  const t=norm(part);let used=false,keep='';
  const sz=t.match(/\b(one|two|three|four|five|\d) other (?:people|players|friends|guys|decks|opponents)\b/);
  if(sz){pod.size=COUNT[sz[1]]+1;used=true;}else if(/\b(?:in|with) (?:a|my|our|the) (?:pod|playgroup|play group|group|table)\b/.test(t)){pod.size=pod.size||4;used=true;}
  const th=t.match(new RegExp('\\b'+THEM+'\\b.*?\\b(?:have|has|had|play|plays|played|run|runs|ran|are on|are playing|were playing|bring|brings|brought|use|uses|used)\\b (.+)$'));
  const lack=t.match(new RegExp('\\b(?:'+THEM+'|of them|none of them)\\b.*?\\b(?:didnt have|dont have|did not have|do not have|have no|had no|lack|lacked|lacks|couldnt block|cant block|had nothing (?:with|for)|have nothing (?:with|for))\\b ?(?:any |much |a lot of |many )?(.+)$'));
  if(lack){pod.lacks.push(lack[1].replace(/\b(?:creatures?|blockers?|cards?|at all|really)\b/g,' ').replace(/\s+/g,' ').trim());used=true;}
  else if(th&&/\bdecks?\b|\b(?:white|blue|black|red|green|mono)\b/.test(th[1])){
   // "a blue, white, a red, blue, and a black mono deck": each "a" starts a deck. With no "a", commas and "and" divide them.
   let said=part.slice(part.toLowerCase().search(/\b(?:have|has|had|plays?|played|runs?|ran|are on|are playing|were playing|brings?|brought|uses?|used)\b/)).replace(/^\S+(?: (?:on|playing))?\s+/,'');
   // Their decks end at the word "deck"; what follows on the same line is about mine.
   const end=said.search(/\bdecks?\b/i);if(end>=0){const cut=end+said.slice(end).match(/^decks?/i)[0].length;keep=said.slice(cut).replace(/^[\s,]+/,'');said=said.slice(0,cut);}
   // Two or more "a ..." is a spoken list where commas sit inside a deck's colours; otherwise commas and "and" divide the decks.
   const spoken=(said.match(/\ban?\b/gi)||[]).length>=2;
   const segs=(spoken?said.split(/,?\s*\b(?:and\s+)?an?\b\s+/i):said.split(/\s*,\s*(?:and\s+)?|\s+\band\b\s+/i)).map(x=>x.replace(/^an?\s+/i,'').trim()).filter(Boolean);
   for(const seg of segs){
    const w=norm(seg).replace(/\b(white|blue|black|red|green) mono\b/g,'mono $1').replace(/\bmono(white|blue|black|red|green)\b/g,'mono $1').replace(/\b(?:decks?|ones?|player|guy)\b/g,' ').replace(/\s+/g,' ').trim();if(!w)continue;
    const dc=deckColors(w+' deck'),cs=dc?.colors||[];
    const names={w:'white',u:'blue',b:'black',r:'red',g:'green'};
    pod.decks.push(cs.length&&!dc.without?.length?{colors:cs,label:cs.length===1?'mono-'+names[cs[0]]:[...'wubrg'].filter(c=>cs.includes(c)).map(c=>names[c]).join('-')}:{colors:[],label:w});
   }
   used=true;
  }
  const POWER=/,?\s*\b(?:(?:that|which|and|to|so it|make it|keep it|trying to make it|im trying to make it|i'm trying to make it)\s+)*(?:is\s+|stays?\s+|be\s+)?(?:within|match|matches|matching|the same as|same as|around|close to|near|fits?|fair for|even with|on par with|at)\s+(?:their|the pod'?s?|the table'?s?|our|everyone'?s?|everybody'?s?)\s+(?:power levels?|power|brackets?|levels?)(?:\s+or\s+(?:within\s+)?(?:their|the|our)\s+(?:power levels?|power|brackets?|levels?))?/i;
  const src=used?keep:part;
  if(POWER.test(src)){pod.power=true;keep=src.replace(POWER,' ').trim();used=true;}
  if(!used)mine.push(part);else if(keep&&norm(keep).split(' ').length>=2)mine.push(keep);
 }
 const found=pod.decks.length>0||(pod.size>0&&(pod.power||pod.lacks.length>0));
 return found?{pod,mine:mine.join('. ')}:null;
}

const FACET_LABEL={cost:'cost to finish',own:'how much you own',colors:'colours',place:'best finish',popular:'how popular',list:'cards in it',beat:'matchups',other:'about it'};
function planAbout(raw,ctx){
 const a=ctx.about,t=norm(raw);if(!a||!t||!IT.test(t))return null;
 // Words that name something else ("how much is it in modern", "is it better than burn") are a new question, not a follow-up.
 if(a.kind==='meta'){
  if(ctx.fix?.game&&ctx.fix.game!==a.game)return null;
  const f=DECK_FACETS.find(x=>x[1].test(t));
  const left=rest(t.replace(IT,' '),f?f[1]:null,/\b(?:how|much|many|does|do|did|is|are|was|what|whats|where|which|who|can|could|would|will|i|me|my|to|of|in|the|a|an|and|for|with|well|good good|have|has|own|need|cards?|decks?|lists?|play|run|finish|build|cost|costs|whole|all|still|right now|now|today|please|tell|show)\b/g);
  if(left.length)return null;
  const read=[chip(GAME_LABEL[a.game],'game'),chip(a.name,'deck'),chip(FACET_LABEL[f?f[0]:'other'],'ask')];
  return {intent:'meta.about',game:a.game,P:parseQuery(raw),read,missing:[],call:{tool:'meta_decks',args:{game:a.game,format:a.format,key:a.key},pick:'about',facet:f?f[0]:'other',name:a.name},answerable:true,hand:null};
 }
 if(a.kind==='card'||a.kind==='mydeck'){
  const p=planSpelled(t.replace(IT,a.kind==='card'?a.name:'my '+a.name+' deck'),{...ctx,about:null,game:a.game});
  return p.answerable&&p.call?.pick!=='maybe'&&p.intent!=='names'?p:null;
 }
 return null;
}

/**
 * ctx: as planOne. Reads a whole line: spelling slips are repaired when the words as typed were not understood, and a line that
 * holds several asks is answered ask by ask (plan.extra: [{text, facet} | {text, plan}]), follow-ups meaning the first answer by "it".
 */
export function planQuery(q,ctx={}){
 const raw=String(q||'').trim();
 // A follow-up about the last answer: "how much is it", "what's in it", "is it legal". [ctx.about] is that answer's subject.
 const follow=ctx.about?planAbout(raw,ctx):null;if(follow)return follow;
 const whole=planSpelled(raw,ctx),parts=splitAsks(raw);
 if(parts.length<2||['build','go','help','keyword','wiki','none'].includes(whole.intent)||(whole.intent==='ruling'&&whole.call?.pick!=='maybe'))return whole;
 const main=planSpelled(parts[0],ctx);
 if(!main.answerable||main.call?.pick==='maybe'||main.intent==='names')return whole;
 const inner={...ctx,game:main.game,fix:{...(ctx.fix||{}),game:main.game,format:ctx.fix?.format||(main.call.tool==='meta_decks'?main.call.args.format:undefined)}};
 main.extra=parts.slice(1).map(text=>{
  const t=norm(text);
  if(main.call.tool==='meta_decks'&&(IT.test(t)||!/\b(?:decks?|cards?|sets?)\b/.test(t))){const f=DECK_FACETS.find(x=>x[1].test(t));if(f)return {text,facet:f[0]};if(IT.test(t))return {text,facet:'other'};}
  // About the card just asked for: "it" is that card.
  const name=main.call.tool==='card_details'?main.call.args.name:'';
  const sub=planSpelled(name&&IT.test(t)?t.replace(IT,name):text,inner);
  return {text,plan:sub};
 });
 if(main.extra.some(e=>e.facet==='colors'))main.call.args.needColors=true;
 main.read.push(chip('+ '+main.extra.length+' more ask'+(main.extra.length>1?'s':''),'ask'));
 main.P=parseQuery(raw);
 return main;
}

/** The words of a deck request the builder's setup did not take: [used] are the labels it did take. Never dropped, always shown. */
export function buildLeftover(words,game,used=[]){
 let n=norm(words).replace(/\bmono(white|blue|black|red|green)\b/g,'mono $1');
 // "tier 2", "bracket 3", "power level 7" are whole asks, kept as said.
 const power=(n.match(/\b(?:tier|bracket|power level|power) ?(?:\d+|one|two|three|four|five)\b/)||[])[0]||'';
 if(power)n=n.replace(power,' ');
 // A wish no setting can hold ("that would surprise my friend") is kept whole and shown as not used.
 const wish=(n.match(/\b(?:that |which |to )?(?:would |will |can |could |might )?(?:surpris\w*|impress\w*|annoy\w*|scare\w*|shock\w*) (?:my |a |the |his |her )?(?:best )?\w+\b/)||[])[0]||'';
 if(wish)n=n.replace(wish,' ');
 const left=rest(n,used.map(norm).filter(Boolean),GAME_WORDS,formatWords(game),/\$ ?\d+(?:\.\d+)?|\b\d+ (?:dollars?|bucks?|usd)\b/g,
  /\b(?:decks?|make|makes|made|build|builds|built|create|creates|want|wants|need|needs|would|like|id|lets|let|suggest|recommend|looking|ideas?|help|pick|choose|play|plays|playing|played|purchase|buy|afford|get|use|uses|using|utilizes?|utilizing|around|based|focused|under|below|less|than|most|least|up|about|roughly|budget|cheap|affordable|new|really|super|pretty|kind|sort|good|great|nice|strong|fun|funnest|funniest|funner|casual|silly|janky|jank|theme|themed|tribal|kindred|competitive|best|strongest|optimal|optimized|powerful|chaos|chaotic|weak|bad|mono|only|own|owned|cards?|collection|commander|edh|cedh|have|has|one|something|thing|anything|possible|maybe|also|too|then|which|who|whats|im|ive|cool|coolest|awesome|sick|neat|interesting|unique|creative|weird|there|having|if|thats|trying|were|all|keep|up|able)\b/g,
  game==='mtg'?[...Object.keys(COLORS),...Object.keys(GUILDS)]:[]);
 return [...(power?[power]:[]),...(left.length?[left.join(' ')]:[]),...(wish?[wish.replace(/^(?:that|which|to) /,'')]:[])];
}

/** What a tapped "Read as" chip can be changed to. */
export const fixChoices=(plan,kind)=>kind==='format'?FORMATS[plan.game].filter(f=>!['Goat','Edison','Gym Leader Challenge','Duel Commander'].includes(f)):kind==='game'?GAMES.map(g=>g[2]):[];
export const gameOfLabel=label=>GAMES.find(g=>g[2]===label)?.[0]||null;
