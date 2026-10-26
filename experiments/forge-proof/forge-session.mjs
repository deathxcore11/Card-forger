// Isolated transport/presentation adapter. Forge alone owns legality and rules.
export const SCHEMA='cardstashy.forge-proof.v1';
const PHASES={UNTAP:'Untap',UPKEEP:'Upkeep',DRAW:'Draw',MAIN1:'PreCombatMain',COMBAT_BEGIN:'BeginningOfCombat',COMBAT_DECLARE_ATTACKERS:'DeclareAttackers',COMBAT_DECLARE_BLOCKERS:'DeclareBlockers',COMBAT_FIRST_STRIKE_DAMAGE:'FirstStrikeDamage',COMBAT_DAMAGE:'CombatDamage',COMBAT_END:'EndCombat',MAIN2:'PostCombatMain',END_OF_TURN:'End',CLEANUP:'Cleanup'};
const INPUTS={InputConfirmMulligan:'MulliganDecision',InputPassPriority:'Priority',InputAttack:'DeclareAttackers',InputBlock:'DeclareBlockers',InputPayMana:'ManaPayment'};
const list=x=>Array.isArray(x)?x:[];
const id=x=>Number.isSafeInteger(x);
export function localBridgeUrl(value){
 const url=new URL(value);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||!['','/'].includes(url.pathname)||url.search||url.hash)throw Error('Use a loopback HTTP origin only, such as http://127.0.0.1:8765.');
 return url.origin;
}
export function optionLabel(value){
 if(value===null||value===undefined)return 'Unlabelled native option';
 if(['string','number','boolean'].includes(typeof value))return String(value);
 if(value.hidden===true||value.card?.hidden===true)return 'Face-down card';
 return value.description||value.name||value.text||`Native ${value.kind||'option'}${id(value.id)?' #'+value.id:''}`;
}
export function optionCardId(value){
 const card=value?.card||value;return card&&card.hidden!==true&&typeof card.name==='string'&&id(card.id)?card.id:null;
}
export function projectForge(raw,{lookupArtwork=()=>null}={}){
 if(raw?.schema!==SCHEMA){if(raw?.status==='initializing')return null;throw Error('Unsupported Forge snapshot schema.');}
 if(!id(raw.revision)||!Array.isArray(raw.players)||raw.players.length!==2)throw Error('Invalid Forge snapshot.');
 const seatById=new Map(raw.players.map((p,seat)=>[p.id,seat])),seat=seatById.get(raw.viewer);
 if(seat===undefined||raw.players.filter(p=>p.isViewer).length!==1||raw.players[seat].isViewer!==true)throw Error('Forge viewer identity mismatch.');
 const cards=new Map();
 const addCard=(c,zone=c?.zone)=>{
  if(!c||!id(c.id)||!seatById.has(c.owner)||!seatById.has(c.controller))return;
  // Never create opponent hand/library identities, even from malformed data.
  if(['Hand','Library'].includes(zone)&&c.owner!==raw.viewer)return;
  if(c.hidden===true){if(['Hand','Library'].includes(zone))return;cards.set(c.id,{id:c.id,owner:seatById.get(c.owner),controller:seatById.get(c.controller),zone,known:false,tapped:c.tapped===true});return;}
  if(typeof c.name!=='string')return;
  const types=typeof c.type==='string'?c.type.split(/\s+/).filter(t=>['Creature','Land','Artifact','Enchantment','Planeswalker','Battle','Instant','Sorcery'].includes(t)):[];
  const card={id:c.id,owner:seatById.get(c.owner),controller:seatById.get(c.controller),zone,known:true,name:c.name,types,type:c.type||'',manaCost:c.manaCost||'',text:c.text||'',power:c.power??null,toughness:c.toughness??null,tapped:c.tapped===true,attacking:c.attacking===true,blocking:c.blocking===true,isToken:c.token===true,commander:c.commander===true,damage:c.damage||0,summoningSick:c.summoningSick===true,counters:c.counters||{},keywords:list(c.keywords)};
  const artwork=lookupArtwork(card.name,c);if(artwork)card.printing={playArtwork:artwork};
  cards.set(c.id,card);
 };
 const players=raw.players.map((p,seat)=>{for(const [zone,z]of Object.entries(p.zones||{}))for(const c of list(z.cards))addCard(c,zone);return {seat,nativeId:p.id,name:p.name,life:p.life,handCount:p.zones?.Hand?.count??0,libraryCount:p.zones?.Library?.count??0};});
 const stack=list(raw.stack).map(s=>{if(s.source)addCard(s.source);return {id:s.id,source:s.source?.id??null,text:s.text||'',controller:seatById.get(s.activatingPlayer)};});
 const terminal=raw.status==='finished'?{winner:seatById.get(raw.winnerPlayerId)??players.find(p=>p.name===raw.winner)?.seat??null,reason:'engine-terminal'}:null;
 const human=!raw.busy&&!terminal&&!raw.failure;
 return {revision:raw.revision,terminal,outcomes:[],surface:{seat,players,cards:[...cards.values()],hand:[...cards.values()].filter(c=>c.zone==='Hand'&&c.owner===seat).map(c=>c.id),stack,turn:raw.turn??0,phase:PHASES[raw.phase]||raw.phase||'Opening hand',activeSeat:seatById.get(raw.activePlayer),prioritySeat:seatById.get(raw.priorityPlayer)??(human?seat:null),decision:{kind:terminal?'GameOver':raw.turn===0?'MulliganDecision':INPUTS[raw.inputType]||raw.prompt?.method||raw.inputType||'Forge decision'},awaitingHuman:human,canAct:human,choices:[],interaction:{canSubmit:false,opportunities:[]}}};
}
export function createForgeSession({baseUrl,token,fetchImpl=globalThis.fetch,pollMs=350,lookupArtwork=()=>null}={}){
 const origin=localBridgeUrl(baseUrl);if(typeof token!=='string'||!token.trim())throw Error('Enter the local bridge token.');
 let native=null,status=null,selected=null,draft=null,error=null,actionError=null,sending=false,awaitRevision=null,closed=false,timer=null,refreshing=null;
 const listeners=new Set();
 const effectiveDraft=()=>draft||(native?.prompt?.method==='order'&&native.prompt.ordered===true?{revision:native.revision,promptId:native.prompt.id,indexes:[...list(native.prompt.destinationIndexes)],remember:false}:null);
 const snapshot=()=>({status,selected,pending:null,busy:sending||awaitRevision!==null||!!native?.busy,error:null,clock:null,native,nativeDraft:effectiveDraft(),transportError:actionError||error});
 const emit=()=>{for(const fn of listeners)fn(snapshot());};
 const acceptState=next=>{
  if(native&&next.revision<native.revision)return false;
  const projection=projectForge(next,{lookupArtwork});
  if(native?.revision!==next.revision){draft=null;actionError=null;}
  native=next;status=projection;
  if(awaitRevision!==null&&next.revision>awaitRevision)awaitRevision=null;
  if(selected!==null&&!status?.surface.cards.some(c=>c.id===selected&&c.known))selected=null;
  emit();return true;
 };
 async function request(path,body){
  const response=await fetchImpl(origin+path,{method:body?'POST':'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{throw Error('Forge returned an unreadable response.');}
  if(!response.ok){const e=Error(data.error||`Forge HTTP ${response.status}`);e.status=response.status;throw e;}return data;
 }
 const refresh=()=>{
  if(closed)return Promise.resolve();if(refreshing)return refreshing;
  refreshing=request('/state').then(next=>{error=null;acceptState(next);}).catch(e=>{error=e.message;emit();throw e;}).finally(()=>{refreshing=null;});return refreshing;
 };
 async function send(op,payload={},expectedRevision=native?.revision){
  if(closed||!status||snapshot().busy||native.failure||status.terminal)throw Error('MATCH_NOT_READY');
  if(expectedRevision!==native.revision)throw Error('STALE_CHOICE');
  sending=true;error=null;actionError=null;emit();
  try{
   await request('/action',{...payload,op,revision:expectedRevision});
   // Never replay an action automatically after network uncertainty or a stale reply.
   awaitRevision=expectedRevision;draft=null;
   await refresh();
  }catch(e){draft=null;awaitRevision=null;try{await refresh();}catch{}actionError=e.message;}
  finally{sending=false;emit();}
 }
 const currentPrompt=()=>{const p=native?.prompt;if(!p||p.supported!==true)throw Error('Native prompt is not supported.');if(p.method==='order'){const options=list(p.options).map(o=>o.index),partition=[...list(p.sourceIndexes),...list(p.destinationIndexes)];if(p.ordered!==true||partition.length!==options.length||new Set(partition).size!==options.length||partition.some(i=>!options.includes(i)))throw Error('Native ordered-source/destination contract is unavailable.');}return p;};
 const promptIndexes=()=>{const p=currentPrompt(),d=effectiveDraft();return d?.revision===native.revision&&d?.promptId===p.id?d.indexes:[];};
 const selectPrompt=index=>{const p=currentPrompt();if(snapshot().busy)throw Error('MATCH_NOT_READY');if(!list(p.options).some(o=>o.index===index))throw Error('STALE_CHOICE');let indexes=[...promptIndexes()];if(indexes.includes(index))indexes=indexes.filter(i=>i!==index);else if(p.max===1)indexes=[index];else if(indexes.length<p.max)indexes.push(index);else throw Error('CHOICE_FULL');draft={...effectiveDraft(),revision:native.revision,promptId:p.id,indexes};emit();};
 const confirmPrompt=()=>{const p=currentPrompt(),indexes=promptIndexes();if(indexes.length<p.min||indexes.length>p.max)throw Error('CHOICE_INCOMPLETE');return send('reply',{promptId:p.id,indexes,...(p.method==='order'&&p.rememberAllowed===true?{remember:effectiveDraft()?.remember===true}:{})});};
 const nativeSelect=(kind,nativeId,expectedRevision=native?.revision)=>{
  if(snapshot().busy)throw Error('MATCH_NOT_READY');
  if(expectedRevision!==native?.revision)throw Error('STALE_CHOICE');
  if(native?.prompt){if(kind!=='card')throw Error('Use the native dialog options.');const matches=list(native.prompt.options).filter(o=>optionCardId(o.value)===nativeId);if(matches.length!==1)throw Error('Choose the specific native option below.');selectPrompt(matches[0].index);return;}
  const known=kind==='card'?status?.surface.cards.some(c=>c.id===nativeId):kind==='player'?native?.players.some(p=>p.id===nativeId):kind==='stack'?native?.stack.some(s=>s.id===nativeId):false;
  if(!known)throw Error('STALE_CHOICE');return send(kind,{id:nativeId},expectedRevision);
 };
 return {snapshot,acceptState,refresh,subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn);},
  async start(){await refresh();const poll=async()=>{if(closed)return;try{await refresh();}catch{}if(!closed)timer=setTimeout(poll,pollMs);};timer=setTimeout(poll,pollMs);},
  close(){closed=true;clearTimeout(timer);token='';listeners.clear();},
  inspect(cardId){if(status?.surface.cards.some(c=>c.id===cardId&&c.known)){selected=cardId;emit();}},
  nativeSelect,nativeButton(op,revision=native?.revision){if(native.prompt)throw Error('Use the native dialog.');if(!['ok','cancel'].includes(op)||native.buttons?.[op+'Enabled']!==true)throw Error('Native button is disabled.');return send(op,{},revision);},
  selectPrompt,confirmPrompt,clearPrompt(){const p=currentPrompt();draft=p.method==='order'?{revision:native.revision,promptId:p.id,indexes:[],remember:false}:null;emit();},
  rememberPrompt(value){const p=currentPrompt();if(p.method!=='order'||p.rememberAllowed!==true||typeof value!=='boolean')throw Error('Native remember choice not offered.');draft={...effectiveDraft(),remember:value};emit();},
  reorderPrompt(index,direction){const p=currentPrompt();if(p.method!=='order'||p.ordered!==true||![1,-1].includes(direction))throw Error('Native order movement not offered.');const indexes=[...promptIndexes()],at=indexes.indexOf(index),to=at+direction;if(at<0||to<0||to>=indexes.length)return;[indexes[at],indexes[to]]=[indexes[to],indexes[at]];draft={...effectiveDraft(),indexes};emit();},
  replyValue(value){const p=currentPrompt();return send('reply',{promptId:p.id,value});},
  concede(){return send('concede');},
  // No fake session rules or generic choose/cast fallback are exposed.
 };
}
