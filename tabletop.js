import {esc} from './ui.js';
import {privateKey} from './account-scope.js';
import {tableTheme,themeOptions,tableThemeArtwork} from './tabletop-themes.js';
import {newNight,cleanNight,elapsed,clockText,startClock,pauseClock,isLong,endTurn,undoTurn,setNote,setWinner,setSpirit,setSpiritValue,spiritAward,spiritUndo,spiritScores,summary,loadJournal,addJournal,journalLine,SPIRIT_KINDS,SPIRIT_LABELS} from './game-night.js';
import {newShareCode,shareLink,openShare,validCode} from './table-share.js';
const GAMES=['mtg','ptcg','ygo'],key=g=>privateKey('cardstashy-tabletop-v1:'+g);
export function newTable(game='mtg',{players=2,commander=false}={}){
 if(!GAMES.includes(game))throw Error('Choose a supported game.');
 const count=game==='mtg'?Math.max(2,Math.min(6,Math.floor(Number(players)||2))):2;
 return {version:1,game,commander:game==='mtg'&&!!commander,turn:0,turnHistory:[],result:'',night:newNight(),deck:null,players:Array.from({length:count},(_,i)=>({id:i,name:'Player '+(i+1),theme:tableTheme(game,'',i).id,life:game==='ygo'?8000:commander?40:20,poison:0,damage:{},pokemon:Array.from({length:6},()=>({damage:0,status:'None'})),position:0,history:[]}))};
}
function address(player,field){
 if(field==='life'||field==='poison')return [player,field];
 const pk=/^pokemon:(\d):damage$/.exec(field);if(pk&&Number(pk[1])<6)return [player.pokemon[Number(pk[1])],'damage'];
 const cmd=/^commander:([0-5]-[12])$/.exec(field);if(cmd)return [player.damage,cmd[1]];
 throw Error('Unknown counter.');
}
export function changeCounter(session,id,field,delta){
 if(!Number.isInteger(delta)||Math.abs(delta)>100000)return false;
 const p=session.players.find(p=>p.id===id);if(!p)return false;
 let object,prop;try{[object,prop]=address(p,field);}catch{return false;}
 const before=Number(object[prop])||0,after=Math.max(field==='life'?-100000:0,Math.min(100000,before+delta));
 if(before===after)return false;object[prop]=after;p.history.push({field,before,after});p.history=p.history.slice(-80);return true;
}
export function changeStatus(session,id,position,status){
 const p=session.players[id];if(!p||!p.pokemon[position]||!['None','Asleep','Paralyzed','Confused','Poisoned','Burned','Asleep + Poisoned','Paralyzed + Poisoned','Confused + Poisoned','Asleep + Burned','Paralyzed + Burned','Confused + Burned','Poisoned + Burned','Asleep + Poisoned + Burned','Paralyzed + Poisoned + Burned','Confused + Poisoned + Burned'].includes(status))return false;
 const before=p.pokemon[position].status;if(before===status)return false;p.pokemon[position].status=status;p.history.push({field:'status:'+position,before,after:status});p.history=p.history.slice(-80);return true;
}
export function undoPlayer(session,id){const p=session.players[id],h=p?.history.pop();if(!h)return false;if(h.field.startsWith('status:'))p.pokemon[Number(h.field.slice(7))].status=h.before;else{const [o,k]=address(p,h.field);o[k]=h.before;}return true;}
export function saveTable(session,storage=globalThis.localStorage){try{storage.setItem(key(session.game),JSON.stringify(session));return true;}catch{return false;}}
export function loadTable(game,storage=globalThis.localStorage){try{
 const saved=JSON.parse(storage.getItem(key(game))),integer=(v,min=0)=>Number.isInteger(v)&&v>=min&&v<=100000;
 if(saved?.version!==1||saved.game!==game||!Array.isArray(saved.players)||saved.players.length<2||saved.players.length>(game==='mtg'?6:2))return null;
 const s=newTable(game,{players:saved.players.length,commander:saved.commander});
 for(const [i,p]of saved.players.entries()){
  if(p.id!==i||!integer(p.life,-100000)||!integer(p.poison)||!integer(p.position)||p.position>5||!Array.isArray(p.pokemon)||p.pokemon.length!==6||p.pokemon.some(c=>!integer(c.damage)||!statusOptions.includes(c.status))||!p.damage||Array.isArray(p.damage)||typeof p.damage!=='object'||Object.entries(p.damage).some(([k,v])=>!/^([0-5]-[12])$/.test(k)||!integer(v))||!Array.isArray(p.history))return null;
  for(const h of p.history){if(!h||typeof h.field!=='string')return null;if(/^status:[0-5]$/.test(h.field)){if(!statusOptions.includes(h.before)||!statusOptions.includes(h.after))return null;}else{try{address(p,h.field);}catch{return null;}if(!integer(h.before,h.field==='life'?-100000:0)||!integer(h.after,h.field==='life'?-100000:0))return null;}}
  s.players[i]={...s.players[i],life:p.life,poison:p.poison,position:p.position,damage:p.damage,pokemon:p.pokemon,name:String(p.name||'Player '+(i+1)).slice(0,40),...(safeArt(p.art)?{art:safeArt(p.art)}:{}),theme:tableTheme(game,p.theme,i).id,history:p.history.slice(-80)};
 }
 if(!integer(saved.turn)||!Array.isArray(saved.turnHistory)||saved.turnHistory.some(v=>!integer(v)))return null;
 s.turn=saved.turn;s.turnHistory=saved.turnHistory.slice(-80);s.result=String(saved.result||'').slice(0,150);s.night=cleanNight(saved.night,s.players.length);s.deck=saved.deck&&typeof saved.deck.id==='string'?{id:saved.deck.id.slice(0,80),name:String(saved.deck.name||'').slice(0,80)}:null;return s;
}catch{return null;}}
const statusOptions=['None','Asleep','Paralyzed','Confused','Poisoned','Burned','Asleep + Poisoned','Paralyzed + Poisoned','Confused + Poisoned','Asleep + Burned','Paralyzed + Burned','Confused + Burned','Poisoned + Burned','Asleep + Poisoned + Burned','Paralyzed + Poisoned + Burned','Confused + Poisoned + Burned'];
// Seat art: a card the player picked from their own Collection. Only card-image hosts the site already uses.
const ART_HOSTS=['api.scryfall.com','cards.scryfall.io','images.pokemontcg.io','images.ygoprodeck.com','assets.tcgdex.net'];
export function safeArt(url){try{const u=new URL(String(url||''));return u.protocol==='https:'&&ART_HOSTS.includes(u.hostname)&&u.href.length<=600?u.href:'';}catch{return '';}}
// What a seat's big number is, and how much one tap and one hold move it.
export function seatMain(s,p){
 if(s.game==='ptcg'){const i=p.position;return {field:`pokemon:${i}:damage`,label:i?'Bench '+i+' damage':'Active damage',value:p.pokemon[i].damage,step:10,hold:50};}
 if(s.game==='ygo')return {field:'life',label:'Life points',value:p.life,step:100,hold:1000};
 return {field:'life',label:'Life',value:p.life,step:1,hold:10};
}
function chips(s,p){
 const out=[],n=s.night;
 if(s.game==='mtg'){if(p.poison||!s.commander)out.push(['Poison',p.poison]);if(s.commander)out.push(['Cmdr',Math.max(0,...Object.values(p.damage||{}),0)]);}
 if(s.game==='ptcg'){out.push([p.position?'Bench '+p.position:'Active',p.pokemon[p.position].status==='None'?'OK':p.pokemon[p.position].status]);}
 if(n?.spirit.on)out.push(['Spirit',spiritScores(s)[p.id].points]);
 if(n?.winner===p.id)out.push(['Winner','']);
 return out.map(([k,v])=>`<button class="gn-chip" data-seat-open="${p.id}">${esc(k)}${v!==''?` <b>${esc(String(v))}</b>`:''}</button>`).join('');
}
// Where each seat sits: phones lie flat in the middle of the table, so seats face their player.
export function seatPlaces(n,wide){
 return Array.from({length:n},(_,i)=>{
  if(wide)return {rot:0};if(n===2)return {rot:i===0?180:0};
  if(n%2&&i===n-1)return {rot:0,span:true};return {rot:i%2?-90:90};
 });
}
function seatHtml(s,p,active,place={}){
 const theme=tableTheme(s.game,p.theme,p.id),m=seatMain(s,p),art=safeArt(p.art);
 return `<section class="gn-seat${active?' gn-active':''}${place.span?' gn-span':''}" data-rot="${place.rot||0}" style="--seat-color:${theme.color}" data-seat-panel="${p.id}"><div class="gn-art table-seat-art" ${art?'':`data-theme-art="${theme.id}"`} aria-hidden="true">${art?`<img class="table-art-image" src="${esc(art)}" alt="" decoding="async" referrerpolicy="no-referrer">`:''}</div><div class="gn-inner"><button class="gn-name" data-seat-open="${p.id}" title="${esc(p.name)}">${esc(p.name)}</button><div class="gn-mid"><button class="gn-tap gn-minus" data-table-delta="${-m.step}" data-hold="${-m.hold}" data-field="${m.field}" data-seat="${p.id}" aria-label="${esc(p.name)}: ${esc(m.label)} minus ${m.step}"><span aria-hidden="true">−</span></button><div class="gn-num"><span class="gn-delta" data-delta="${p.id}" aria-hidden="true"></span><output class="gn-life" data-table-output="${p.id}:${m.field}" data-main="${p.id}" aria-label="${esc(p.name)} ${esc(m.label)}" aria-live="polite">${m.value}</output></div><button class="gn-tap gn-plus" data-table-delta="${m.step}" data-hold="${m.hold}" data-field="${m.field}" data-seat="${p.id}" aria-label="${esc(p.name)}: ${esc(m.label)} plus ${m.step}"><span aria-hidden="true">+</span></button></div><div class="gn-chips">${chips(s,p)}</div></div></section>`;
}
const RING=213.6;
export function openTabletop({game='mtg',confirm=async()=>false,judge=()=>{},storage=globalThis.localStorage,artFor=async()=>null,deck=null,cloud=null,joinCode='',panel=''}={}){
 if(document.querySelector('.tabletop-dialog'))return;
 const ownerKey=privateKey('tabletop-owner');
 let friends=[],cards=null,s=joinCode?null:loadTable(game,storage),share=null,shareCode='',shareStatus='',guest=!!joinCode,editor=false,seated=null,watching=false,tick=null,sig='',wake=null,wantsWake=false,opener=document.activeElement,approvedResetGame='',closed=false,sheet='';
 const d=document.createElement('dialog');d.className='tabletop-dialog';d.setAttribute('aria-label','Game Night');document.body.append(d);
 const header=()=>`<header class="tabletop-head"><div><p class="eyebrow">THE WAR CHEST</p><h2>Game Night</h2></div><button data-table="close" class="icon" aria-label="Close Game Night">×</button></header>`;
 function setup(){d.classList.remove('gn');d.innerHTML=header()+`<section class="table-setup"><h3>A fresh game.</h3><p class="muted">Counters stay on this device. Your collection and decks stay separate.</p><label>Game<select id="tableGame">${GAMES.map(g=>`<option value="${g}" ${game===g?'selected':''}>${{mtg:'Magic',ptcg:'Pokémon',ygo:'Yu-Gi-Oh!'}[g]}</option>`).join('')}</select></label><div id="tableMagic" ${game!=='mtg'?'hidden':''}><label>Players<select id="tablePlayers">${[2,3,4,5,6].map(n=>`<option>${n}</option>`).join('')}</select></label><label class="check"><input id="tableCommander" type="checkbox"> Commander · start at 40 life</label></div><section class="table-player-choices" id="tablePlayerChoices" aria-label="Player themes"></section><button class="btn" data-table="start">Start game</button></section>`;setupPlayers();}
 function loadArt(){
  const currentGame=s?.game||d.querySelector('#tableGame')?.value||game;
  for(const node of d.querySelectorAll('[data-theme-art]')){
   const theme=node.dataset.themeArt;
   Promise.resolve(artFor(currentGame,theme)).then(card=>{if(closed||!node.isConnected||node.dataset.themeArt!==theme)return;node.innerHTML=tableThemeArtwork(currentGame,card);}).catch(()=>{});
  }
 }
 function setupPlayers(){
  const g=d.querySelector('#tableGame').value,count=g==='mtg'?Number(d.querySelector('#tablePlayers').value):2,previous=new Map([...d.querySelectorAll('[data-setup-theme]')].map(n=>[n.dataset.setupTheme,n.value]));
  d.querySelector('#tablePlayerChoices').innerHTML=Array.from({length:count},(_,i)=>{const theme=tableTheme(g,previous.get(String(i)),i);return `<article class="table-player-choice" style="--seat-color:${theme.color}"><div class="table-seat-art" data-theme-art="${theme.id}" aria-hidden="true"></div><label><b>Player ${i+1}</b><select data-setup-theme="${i}" aria-label="Player ${i+1} theme">${themeOptions(g,theme.id)}</select></label></article>`;}).join('');loadArt();
 }
 const canTap=()=>!guest||(editor&&!watching&&seated!==null);
 const statusLabel={joining:'Joining the table…',live:'Live',away:'The host is away. Showing the last table.',offline:'Disconnected from the table.'};
 const shareText=()=>guest?(statusLabel[shareStatus]||'')+(canTap()?'':' · Watching'):shareCode?(statusLabel[shareStatus]||''):'';
 const turnSeat=()=>s.turn%s.players.length;
 function drawClock(){
  if(!s)return;const ms=elapsed(s),long=isLong(s),medal=d.querySelector('.gn-medal');if(!medal)return;
  medal.querySelector('[data-clock]').textContent=clockText(ms);medal.querySelector('[data-medal-turn]').textContent='T'+(s.turn+1);
  medal.classList.toggle('gn-long',long);medal.querySelector('.gn-ring').style.strokeDashoffset=String(Math.max(0,RING*(1-ms/s.night.longMs)));
  medal.setAttribute('aria-label',`Turn ${s.turn+1}, ${s.players[turnSeat()].name}, clock ${clockText(ms)}${long?', long turn':''}. Open the table menu`);
  const c=d.querySelector('[data-menu-clock]');if(c)c.textContent='Clock '+clockText(ms)+(long?' · long turn':'');
 }
 function nightPanel(){
  const n=s.night,log=n.log.length?`<ol class="table-log-list">${n.log.slice().reverse().map(e=>`<li class="${e.long?'gn-long-row':''}"><b>T${e.turn}</b> ${esc(s.players[e.seat]?.name||'')} · ${clockText(e.ms)}${e.long?' · long':''}${e.note?`<br><span>${esc(e.note)}</span>`:''}</li>`).join('')}</ol>`:'<p class="foot">Turns appear here as you finish them.</p>';
  let html=`<details class="table-log" ${panel==='log'?'open':''}><summary>Turn log (${n.log.length})</summary>${log}</details>`;
  if(guest)return html;
  const sp=n.spirit,scores=spiritScores(s);
  html+=`<details class="table-spirit" ${sp.on||panel==='spirit'?'open':''}><summary>Table Spirit</summary><label class="check"><input type="checkbox" data-spirit-on ${sp.on?'checked':''}> Count Table Spirit</label>${sp.on?`<div class="spirit-values">${SPIRIT_KINDS.map(k=>`<label>${SPIRIT_LABELS[k]} points<input type="number" inputmode="numeric" min="0" max="20" data-spirit-value="${k}" value="${sp.values[k]}"></label>`).join('')}</div><div class="spirit-players">${s.players.map(p=>`<article class="spirit-player"><h4>${esc(p.name)} · <b>${scores[p.id].points}</b> pts</h4>${SPIRIT_KINDS.map(k=>{const c=sp.tally[p.id]?.[k]||0;return `<div class="spirit-row"><button data-spirit-sub data-seat="${p.id}" data-kind="${k}" aria-label="Take back ${SPIRIT_LABELS[k]} for ${esc(p.name)}" ${c?'':'disabled'}>−</button><span>${SPIRIT_LABELS[k]} <b>${c}</b></span><button data-spirit-add data-seat="${p.id}" data-kind="${k}" aria-label="Add ${SPIRIT_LABELS[k]} for ${esc(p.name)}" ${k==='firstBlood'&&sp.firstBlood!==null?'disabled':''}>+</button></div>`;}).join('')}</article>`).join('')}</div>`:''}</details>`;
  if(s.deck){const j=loadJournal(s.game,s.deck.id,storage);html+=`<details class="table-journal" ${panel==='journal'?'open':''}><summary>Journal · ${esc(s.deck.name||'this deck')}</summary><button data-table="journal">Add this game to the journal</button>${j.length?`<ol class="table-log-list">${j.slice().reverse().map(e=>`<li>${new Date(e.at).toLocaleDateString()} · ${esc(e.line)}</li>`).join('')}</ol>`:''}</details>`;}
  const live=share&&shareCode;
  html+=`<details class="table-share" ${live||panel==='share'?'open':''}><summary>Share this table</summary>${live?`<label>Table link<input readonly data-share-link value="${esc(shareLink(shareCode))}"></label><div class="table-share-actions"><button data-table="shareCopy">Copy link</button>${navigator.share?'<button data-table="shareSend">Send link</button>':''}<button data-table="shareStop">Stop sharing</button></div><div class="table-invite"><label>Invite a friend<select data-invite-friend><option value="">Choose a friend</option>${friends.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label><button data-table="inviteSend">Send invite</button></div>`:'<button data-table="shareStart">Share this table</button>'}<p class="foot" data-share-status role="status">${esc(shareText())}</p></details>`;
  return html;
 }
 function menuSheet(){
  const who=s.players[turnSeat()].name,host=!guest;
  return `<div class="gn-sheet" data-audit-scroll role="dialog" aria-label="Table menu"><h3>Turn ${s.turn+1} · ${esc(who)}<span data-menu-clock></span></h3>
  <div class="gn-acts">${canTap()?`<button class="gn-act gn-primary" data-table="turn">Next turn</button><button class="gn-act" data-table="turnUndo" ${s.turnHistory.length?'':'disabled'}>Undo turn</button>`:''}${host?`<button class="gn-act" data-table="clock">${s.night.running?'Pause clock':'Start clock'}</button><button class="gn-act" data-table="coin">Flip a coin</button><button class="gn-act" data-table="die">Roll a d6</button><button class="gn-act" data-table="judge">Ask the Judge</button><button class="gn-act" data-table="awake" ${navigator.wakeLock?'':'disabled'}>${wake?'Let the screen sleep':navigator.wakeLock?'Keep the screen on':'Keep awake unavailable'}</button><button class="gn-act" data-table="new">New game</button>`:''}<button class="gn-act" data-table="close">Leave the table</button></div>
  <p class="table-result" role="status">${esc(s.result)}</p>
  ${host?`<label class="table-note"><span>Note for this turn</span><input data-night-note maxlength="200" value="${esc(s.night.note)}"></label>`:''}
  <p class="foot" data-save-status role="status">${esc(guest?shareText():'Saved on this device')}</p>
  <section class="table-night" data-night-panel>${nightPanel()}</section>
  <button class="gn-done" data-sheet="close">Back to the table</button></div>`;
 }
 const counter=(id,field,label,value,step=1)=>`<div class="table-counter" data-counter="${field}"><span>${label}</span><div><button data-table-delta="${-step}" data-field="${field}" data-seat="${id}" aria-label="${esc(label)}: subtract ${step}">−${step}</button><output data-table-output="${id}:${field}" aria-live="polite">${value}</output><button data-table-delta="${step}" data-field="${field}" data-seat="${id}" aria-label="${esc(label)}: add ${step}">+${step}</button></div></div>`;
 function seatSheet(id){
  const p=s.players[id],g=s.game,host=!guest,tap=canTap();
  let body='';
  if(host)body+=`<label>Name<input data-seat-name="${id}" maxlength="40" value="${esc(p.name)}"></label><div class="gn-two"><label>Seat colour<select data-theme-seat="${id}">${themeOptions(g,tableTheme(g,p.theme,id).id)}</select></label>${cards?.length?`<label>Card art<select data-seat-art="${id}"><option value="">Colour art</option>${cards.map(c=>`<option value="${esc(c.url)}" ${c.url===p.art?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:''}</div>`;
  if(g==='mtg')body+=counter(id,'poison','Poison',p.poison)+(s.commander?s.players.filter(x=>x.id!==id).map(src=>[1,2].map(n=>counter(id,`commander:${src.id}-${n}`,`Commander damage from ${esc(src.name)}${n===2?' (partner)':''}`,p.damage[src.id+'-'+n]||0)).join('')).join(''):'');
  if(g==='ptcg')body+=`<div class="gn-two"><label>Pokémon<select data-position="${id}">${p.pokemon.map((_,i)=>`<option value="${i}" ${p.position===i?'selected':''}>${i?'Bench '+i:'Active Pokémon'}</option>`).join('')}</select></label><label>Status<select data-status-seat="${id}" data-status-position="${p.position}">${statusOptions.map(v=>`<option ${p.pokemon[p.position].status===v?'selected':''}>${v}</option>`).join('')}</select></label></div>`+counter(id,`pokemon:${p.position}:damage`,'Damage',p.pokemon[p.position].damage,10);
  if(g==='ygo')body+=`<div class="table-calculator"><label>Amount<input inputmode="numeric" type="number" min="1" max="100000" value="1000" data-calc-input="${id}"></label><button data-calc="subtract" data-seat="${id}">Subtract</button><button data-calc="add" data-seat="${id}">Add</button></div>`;
  return `<div class="gn-sheet" data-audit-scroll role="dialog" aria-label="${esc(p.name)}" data-seat-sheet="${id}"><h3>${esc(p.name)}</h3>${body}<div class="gn-acts">${tap?`<button class="gn-act" data-table-undo="${id}" ${p.history.length?'':'disabled'}>Undo last change</button>`:''}${host?`<button class="gn-act" data-table="winner" data-seat="${id}" aria-pressed="${s.night.winner===id}">${s.night.winner===id?'Winner':'Mark as winner'}</button>`:''}</div><button class="gn-done" data-sheet="close">Back to the table</button></div>`;
 }
 function joinView(){
  const open=p=>/^Player \d$/.test(p.name);
  d.classList.remove('gn');
  d.innerHTML=header()+`<section class="gn-join"><h3>${esc(s.players[0].name)}'s table</h3><p class="muted">${{mtg:'Magic',ptcg:'Pokémon',ygo:'Yu-Gi-Oh!'}[s.game]}${s.commander?' · Commander':''} · ${s.players.filter(p=>!open(p)).length} of ${s.players.length} seats taken · ${esc(statusLabel[shareStatus]||'')}</p><div class="gn-slots">${s.players.map(p=>`<div class="gn-slot ${open(p)?'gn-open':''}"><span>${esc(open(p)?'Open seat':p.name)}</span>${editor?`<button data-claim="${p.id}">${open(p)?'Sit here':'This is me'}</button>`:''}</div>`).join('')}</div><button class="btn ghost" data-table="watch">Watch the table</button>${editor?'':'<p class="foot">Sign in to take a seat. Anyone with the link can watch.</p>'}</section>`;
 }
 const layout=()=>innerWidth>innerHeight?'wide':'phone';
 function paint(){
  if(!s)return guest?paintJoining():setup();
  if(guest&&seated===null&&!watching)return joinView();
  sig=signature();d.classList.add('gn');d.dataset.layout=layout();d.classList.toggle('table-viewer',!canTap());
  const at=turnSeat();
  const n=s.players.length,wide=d.dataset.layout==='wide',places=seatPlaces(n,wide),k=wide?n:n===2?1:2*Math.floor(Math.ceil(n/2)/2);
  const grid=(list,top)=>{if(!list.length)return '';const cols=wide?(n<=4?n:3):n===2?1:2,rows=Math.ceil(list.length/cols)||1;return `<div class="gn-table" style="--cols:${cols};--rows:${rows};flex-grow:${rows}">${list.map(p=>seatHtml(s,p,p.id===at,places[p.id])).join('')}</div>`;};
  const medal=`<div class="gn-strip"><button class="gn-medal"`;
  d.innerHTML=`<div class="gn-board"${sheet!==''?' inert':''}>${grid(s.players.slice(0,k))}${medal} data-sheet="menu"><svg viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="34" class="gn-track"/><circle cx="38" cy="38" r="34" class="gn-ring" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" transform="rotate(-90 38 38)"/></svg><span class="gn-medal-in"><span data-medal-turn>T${s.turn+1}</span><span data-clock>0:00</span></span></button></div>${grid(s.players.slice(k))}</div>${sheet==='menu'?menuSheet():sheet!==''?seatSheet(Number(sheet)):''}`;
  loadArt();drawClock();if(!canTap())for(const b of d.querySelectorAll('.gn-tap'))b.disabled=true;
 }
 function paintJoining(){d.classList.remove('gn');d.innerHTML=header()+`<p class="table-result" role="status">${esc(shareText()||statusLabel.joining)}</p>`;}
 const signature=()=>JSON.stringify([s.players.map(p=>[p.name,p.theme,p.art,p.position,p.pokemon[p.position].status,p.poison>0,p.damage]),s.night.winner,s.night.spirit,s.night.running,s.turn,s.turnHistory.length>0,s.result,layout()]);
 function persist(){if(closed||guest||privateKey('tabletop-owner')!==ownerKey)return;const ok=saveTable(s,storage),node=d.querySelector('[data-save-status]');if(node)node.textContent=ok?'Saved on this device':'Device storage is unavailable. Keep this session open; changes may not survive a reload.';share?.publish();}
 const deltas=new Map();
 function showDelta(id,by){const node=d.querySelector(`[data-delta="${id}"]`);if(!node||!by)return;const cur=deltas.get(id)||{sum:0,t:0};clearTimeout(cur.t);cur.sum+=by;node.textContent=(cur.sum>0?'+':'')+cur.sum;node.classList.add('gn-on');cur.t=setTimeout(()=>{node.classList.remove('gn-on');deltas.delete(id);},1400);deltas.set(id,cur);}
 function patchView(id){
  const p=s.players[id];
  d.querySelectorAll(`[data-table-output^="${id}:"]`).forEach(n=>{const field=n.dataset.tableOutput.slice(String(id).length+1);let v;try{const [o,k]=address(p,field);v=o[k]||0;}catch{return;}if(n.hasAttribute('data-main')&&String(v)!==n.textContent)showDelta(id,v-Number(n.textContent));n.textContent=v;});
  const u=d.querySelector(`[data-table-undo="${id}"]`);if(u)u.disabled=!p.history.length;
  const chip=d.querySelector(`[data-seat-panel="${id}"] .gn-chips`);if(chip)chip.innerHTML=chips(s,p);
 }
 function patch(id){patchView(id);persist();}
 function rerender(){paint();}
 function patchAll(){for(const p of s.players)patchView(p.id);drawClock();const n=d.querySelector('[data-night-panel]');if(n)paintNight();}
 function paintNight(){const box=d.querySelector('[data-night-panel]');if(!box)return;const open=new Set([...box.querySelectorAll('details[open]')].map(x=>x.className));box.innerHTML=nightPanel();for(const x of box.querySelectorAll('details'))if(open.has(x.className))x.open=true;}
 function received(table){s=table;if(guest&&seated===null&&!watching)return joinView();if(!d.querySelector('.gn-table')||signature()!==sig)rerender();else patchAll();}
 async function requestWake(){try{wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null;});}catch{wantsWake=false;s.result='Keep the screen on is unavailable right now. Your counters are saved.';}if(sheet==='menu')paint();}
 const visibility=()=>{if(!document.hidden&&wantsWake&&!wake)requestWake();};document.addEventListener('visibilitychange',visibility);
 const resize=()=>{if(s&&d.classList.contains('gn')&&d.dataset.layout!==layout())paint();};addEventListener('resize',resize);
 function cleanup(){if(closed)return;closed=true;clearInterval(tick);share?.close();share=null;wantsWake=false;wake?.release();document.removeEventListener('visibilitychange',visibility);removeEventListener('resize',resize);d.remove();if(opener?.isConnected)opener.focus({preventScroll:true});}
 d.addEventListener('close',cleanup,{once:true});
 function close(){d.close();cleanup();}
 function guestTap(b,id){const t=b.dataset;
  if(t.table==='close')return close();
  if(t.table==='watch'){watching=true;return paint();}
  if(t.claim!==undefined){const seat=Number(t.claim);share?.tap({t:'claim',seat,name:cloud?.me?.()?.name||'',art:''});seated=seat;return paint();}
  if(t.sheet){sheet=t.sheet==='close'?'':t.sheet;return paint();}
  if(t.seatOpen!==undefined){sheet=t.seatOpen;return paint();}
  if(!canTap()||!share)return;
  if(b.hasAttribute('data-table-delta'))return share.tap({t:'delta',seat:id,field:t.field,delta:Number(t.tableDelta)});
  if(b.hasAttribute('data-table-undo'))return share.tap({t:'undo',seat:Number(t.tableUndo)});
  if(t.calc)return share.tap({t:'delta',seat:id,field:'life',delta:(t.calc==='subtract'?-1:1)*Number(d.querySelector(`[data-calc-input="${id}"]`).value)});
  if(t.table==='turn'||t.table==='turnUndo')return share.tap({t:t.table});}
 const sayShare=m=>{const n=d.querySelector('[data-share-status]');if(n)n.textContent=m;};
 async function startShare(){const client=cloud?.client?.();if(!client)return sayShare('Sharing needs an online connection.');
  shareCode=newShareCode();shareStatus='joining';
  try{share=await openShare({client,code:shareCode,host:true,editor:true,getState:()=>s,setState:()=>{},onStatus:st=>{shareStatus=st;sayShare(shareText());}});paintNight();Promise.resolve(cloud?.friends?.()).then(list=>{if(!closed&&Array.isArray(list)){friends=list.filter(f=>f&&typeof f.id==='string').map(f=>({id:f.id,name:String(f.name||'A friend').slice(0,60)}));if(share)paintNight();}}).catch(()=>{});}
  catch(e){shareCode='';share=null;shareStatus='';sayShare(e.message||'The table could not be shared.');}}
 function apply(id,field,delta){if(changeCounter(s,id,field,delta))patch(id);}
 async function activate(b,hold=false){if(!b||closed||privateKey('tabletop-owner')!==ownerKey)return;const id=Number(b.dataset.seat);
  if(guest){if(hold&&b.dataset.hold&&canTap()&&share)return share.tap({t:'delta',seat:id,field:b.dataset.field,delta:Number(b.dataset.hold)});return guestTap(b,id);}
  if(b.dataset.sheet){sheet=b.dataset.sheet==='close'?'':b.dataset.sheet;panel='';if(sheet===''||sheet==='menu')return paint();return paint();}
  if(b.dataset.seatOpen!==undefined){sheet=b.dataset.seatOpen;if(cards===null&&cloud?.cards){cards=[];Promise.resolve(cloud.cards(s.game)).then(list=>{cards=(Array.isArray(list)?list:[]).map(c=>({name:String(c.name||'').slice(0,80),url:safeArt(c.url)})).filter(c=>c.name&&c.url).slice(0,400);if(!closed&&sheet!==''&&sheet!=='menu')paint();}).catch(()=>{});}return paint();}
  if(b.hasAttribute('data-spirit-add')||b.hasAttribute('data-spirit-sub')){if(b.hasAttribute('data-spirit-add')?spiritAward(s,id,b.dataset.kind):spiritUndo(s,id,b.dataset.kind)){paintNight();patchView(id);persist();}return;}
  if(b.hasAttribute('data-table-delta')){apply(id,b.dataset.field,Number(hold&&b.dataset.hold?b.dataset.hold:b.dataset.tableDelta));return;}
  if(b.hasAttribute('data-table-undo')){const who=Number(b.dataset.tableUndo);if(undoPlayer(s,who))patch(who);return;}
  if(b.dataset.calc){const amount=Number(d.querySelector(`[data-calc-input="${id}"]`).value);apply(id,'life',(b.dataset.calc==='subtract'?-1:1)*amount);return;}
  const action=b.dataset.table;
  if(action==='close')close();
  else if(action==='start'){game=d.querySelector('#tableGame').value;if(game!==approvedResetGame&&loadTable(game,storage)&&!await confirm('Replace the saved '+game+' table?'))return;if(closed||privateKey('tabletop-owner')!==ownerKey)return;approvedResetGame='';s=newTable(game,{players:d.querySelector('#tablePlayers').value,commander:d.querySelector('#tableCommander').checked});for(const p of s.players)p.theme=tableTheme(game,d.querySelector(`[data-setup-theme="${p.id}"]`)?.value,p.id).id;if(deck)s.deck={id:String(deck.id),name:String(deck.name||'')};const me=cloud?.me?.();if(me?.name)s.players[s.players.length-1].name=String(me.name).slice(0,40);sheet='';paint();persist();}
  else if(action==='new'){if(await confirm('Start a new game? This replaces the current counters. Your cards and decks will not change.')){if(closed||privateKey('tabletop-owner')!==ownerKey)return;approvedResetGame=s.game;s=null;sheet='';setup();}}
  else if(action==='judge')judge(s.game);
  else if(action==='clock'){if(s.night.running)pauseClock(s);else startClock(s);b.textContent=s.night.running?'Pause clock':'Start clock';drawClock();persist();}
  else if(action==='winner'){setWinner(s,id);persist();paint();}
  else if(action==='journal'){if(s.deck){addJournal(s.game,s.deck.id,{at:Date.now(),line:journalLine(summary(s))},storage);paintNight();}}
  else if(action==='shareStart')await startShare();
  else if(action==='inviteSend'){const to=d.querySelector('[data-invite-friend]')?.value;if(!to)return sayShare('Choose a friend first.');const r=await cloud?.invite?.(to,shareCode);sayShare(r?.sent?'Invite sent.':'The invite could not be sent. Check you are signed in and still friends.');}
  else if(action==='shareStop'){share?.close();share=null;shareCode='';shareStatus='';paintNight();}
  else if(action==='shareCopy'){try{await navigator.clipboard.writeText(shareLink(shareCode));sayShare('Link copied.');}catch{sayShare('Copy the link from the box above.');}}
  else if(action==='shareSend'){try{await navigator.share({title:'Join my table',url:shareLink(shareCode)});}catch{}}
  else if(action==='awake'){wantsWake=!wantsWake;if(wantsWake)await requestWake();else{await wake?.release();wake=null;paint();}}
  else if(action==='coin'||action==='die'){const a=new Uint32Array(1);crypto.getRandomValues(a);s.result=action==='coin'?(a[0]%2?'Heads':'Tails'):'Rolled '+(a[0]%6+1);const r=d.querySelector('.table-result');if(r)r.textContent=s.result;persist();}
  else if(action==='turn'||action==='turnUndo'){if(action==='turn')endTurn(s);else undoTurn(s);persist();paint();}
 }
 // Touch: a moved finger is scrolling, not a tap; a finger held on a seat half moves by the larger step.
 const touches=new Map(),handled=new WeakMap();
 d.addEventListener('pointerdown',e=>{const b=e.target.closest('button[data-table-delta],button[data-table-undo],button[data-calc]');if(!b||b.disabled)return;const t={b,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',held:false,timer:0};if(b.dataset.hold)t.timer=setTimeout(()=>{t.held=true;handled.set(b,Date.now());activate(b,true);},500);touches.set(e.pointerId,t);});
 const end=e=>{const t=touches.get(e.pointerId);touches.delete(e.pointerId);if(t)clearTimeout(t.timer);return t;};
 d.addEventListener('pointercancel',end);
 d.addEventListener('pointermove',e=>{const t=touches.get(e.pointerId);if(t&&Math.hypot(e.clientX-t.x,e.clientY-t.y)>=12)clearTimeout(t.timer);});
 d.addEventListener('pointerup',e=>{const t=end(e);if(!t||t.held)return;if(t.touch&&Math.hypot(e.clientX-t.x,e.clientY-t.y)<12&&e.target.closest('button')===t.b){e.preventDefault();handled.set(t.b,Date.now());activate(t.b);}});
 d.addEventListener('contextmenu',e=>{if(e.target.closest('.gn-tap'))e.preventDefault();});
 d.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled&&!(Date.now()-(handled.get(b)||0)<700))activate(b);});
 d.addEventListener('change',e=>{const n=e.target;if(guest)return;
  if(n.hasAttribute('data-spirit-on')){setSpirit(s,n.checked);paintNight();for(const p of s.players)patchView(p.id);persist();return;}
  if(n.hasAttribute('data-spirit-value')){setSpiritValue(s,n.dataset.spiritValue,n.value);paintNight();for(const p of s.players)patchView(p.id);persist();return;}
  if(n.id==='tableGame'){d.querySelector('#tableMagic').hidden=n.value!=='mtg';setupPlayers();}
  if(n.id==='tablePlayers')setupPlayers();
  if(n.hasAttribute('data-setup-theme')){const theme=tableTheme(d.querySelector('#tableGame').value,n.value),box=n.closest('.table-player-choice');box.style.setProperty('--seat-color',theme.color);box.querySelector('[data-theme-art]').dataset.themeArt=theme.id;box.querySelector('[data-theme-art]').replaceChildren();loadArt();}
  if(n.hasAttribute('data-seat-name')){const p=s.players[Number(n.dataset.seatName)];const v=n.value.replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,40);if(p&&v){p.name=v;persist();paint();}}
  if(n.hasAttribute('data-theme-seat')){const p=s.players[Number(n.dataset.themeSeat)];if(!p)return;p.theme=tableTheme(s.game,n.value,p.id).id;persist();paint();}
  if(n.hasAttribute('data-seat-art')){const p=s.players[Number(n.dataset.seatArt)];if(!p)return;const art=safeArt(n.value);if(art)p.art=art;else delete p.art;persist();paint();}
  if(n.hasAttribute('data-position')){const p=s.players[Number(n.dataset.position)];p.position=Number(n.value);persist();paint();}
  if(n.hasAttribute('data-status-seat')){const id=Number(n.dataset.statusSeat);if(changeStatus(s,id,Number(n.dataset.statusPosition),n.value))patch(id);}
 });
 d.addEventListener('input',e=>{if(!guest&&e.target.hasAttribute?.('data-night-note')){setNote(s,e.target.value);persist();}});
 d.addEventListener('error',e=>{if(e.target.matches?.('.table-seat-art img'))e.target.hidden=true;},true);
 d.addEventListener('cancel',e=>{e.preventDefault();if(sheet!==''){sheet='';paint();}else close();});
 if(s&&deck)s.deck={id:String(deck.id),name:String(deck.name||'')};
 if(guest){shareStatus='joining';const client=cloud?.client?.();editor=!!cloud?.signedIn?.();
  if(!validCode(joinCode)||!client)shareStatus='offline';
  else openShare({client,code:joinCode,host:false,editor,getState:()=>s,setState:received,onStatus:st=>{shareStatus=st;sayShare(shareText());const n=d.querySelector('[data-save-status]')||d.querySelector('.table-result');if(n)n.textContent=shareText();}}).then(h=>{if(closed)h.close();else share=h;}).catch(()=>{shareStatus='offline';const n=d.querySelector('.table-result');if(n)n.textContent=shareText();});}
 if(s&&['spirit','journal','log','share'].includes(panel))sheet='menu';
 paint();d.showModal();if(s)persist();tick=setInterval(drawClock,1000);
 if(s&&panel==='share'&&!guest)startShare();
}
