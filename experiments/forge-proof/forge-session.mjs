// Isolated transport/presentation adapter. Forge alone owns legality and rules.
export const SCHEMA='cardstashy.forge-proof.v1';
export const VISIBILITY_SCHEMA='cardstashy.forge-visibility.v1';
const PHASES={UNTAP:'Untap',UPKEEP:'Upkeep',DRAW:'Draw',MAIN1:'PreCombatMain',COMBAT_BEGIN:'BeginningOfCombat',COMBAT_DECLARE_ATTACKERS:'DeclareAttackers',COMBAT_DECLARE_BLOCKERS:'DeclareBlockers',COMBAT_FIRST_STRIKE_DAMAGE:'FirstStrikeDamage',COMBAT_DAMAGE:'CombatDamage',COMBAT_END:'EndCombat',MAIN2:'PostCombatMain',END_OF_TURN:'End',CLEANUP:'Cleanup'};
const INPUTS={InputConfirmMulligan:'MulliganDecision',InputPassPriority:'Priority',InputAttack:'DeclareAttackers',InputBlock:'DeclareBlockers',InputSelectTargets:'TargetChoice'};
// What the player is being asked, by meaning. Forge's input class names (InputPayManaOfCostPayment,
// InputSelectEntitiesFromList, a dialog method) never reach the screen or the history.
export function nativeDecisionKind(raw){
 const input=String(raw?.inputType||'');
 if(INPUTS[input])return INPUTS[input];
 if(input.startsWith('InputPayMana'))return 'ManaPayment';
 if(raw?.prompt||input.startsWith('InputSelect')||input.startsWith('InputConfirm'))return 'Choice';
 return 'Decision';
}
const list=x=>Array.isArray(x)?x:[];
const id=x=>Number.isSafeInteger(x);
// Forge names a token's image after its script, which leads with the token's colors
// (t:w_1_1_soldier, t:c_a_treasure_sac, t:wb_1_1_spirit_flying); c is colorless.
export const tokenColors=key=>{const m=/^t:([wubrgc]{1,5})_/.exec(String(key||''));return m?[...new Set(m[1].replace(/c/g,'').toUpperCase())]:null;};
export function localBridgeUrl(value){
 const url=new URL(value);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||!['','/'].includes(url.pathname)||url.search||url.hash)throw Error('Use a loopback HTTP origin only, such as http://127.0.0.1:8765.');
 return url.origin;
}
// Your hand reads like Arena's: lands first, then spells by mana value, lowest first;
// equal cards keep Forge's order. Presentation only: every action still names the card.
export function manaValue(cost){
 let total=0;for(const [,sym] of String(cost||'').matchAll(/\{([^}]+)\}/g)){if(/^\d+$/.test(sym))total+=Number(sym);else if(/^[XYZ]$/.test(sym))continue;else{const two=sym.match(/^(\d+)\//);total+=two?Number(two[1]):1;}}
 return total;
}
export const arenaHandOrder=cards=>cards.map((c,i)=>({c,i,land:c.known&&c.types?.includes('Land')?0:1,mv:c.known?manaValue(c.manaCost):Infinity})).sort((a,b)=>a.land-b.land||a.mv-b.mv||a.i-b.i).map(x=>x.c);
// Forge appends bookkeeping such as "[Phase: CardStashy]" to some stack descriptions.
export const stackText=t=>String(t||'').replace(/\s*\[Phase: [^\]]*\]/g,'').trim();
export function optionLabel(value){
 if(value===null||value===undefined)return 'Unlabelled native option';
 if(['string','number','boolean'].includes(typeof value))return String(value);
 if(value.hidden===true||value.card?.hidden===true)return 'Face-down card';
 return value.description||value.name||value.text||`Native ${value.kind||'option'}${id(value.id)?' #'+value.id:''}`;
}
export function optionCardId(value){
 const card=value?.card||value;return card&&card.hidden===false&&typeof card.name==='string'&&id(card.id)?card.id:null;
}
// This evidence is authored by native Forge projection, not a client capability or
// signature. Hosted callers must first validate allocation/generation/account/viewer
// through createForgeHostClient; loopback callers retain their bearer boundary.
function visibilityGrants(raw,seatById){
 const v=raw.visibility,grants=new Map();
 if(v?.schema!==VISIBILITY_SCHEMA||v.viewer!==raw.viewer||v.revision!==raw.revision||
    typeof raw.forgeRevision!=='string'||!/^[0-9a-f]{40}$/.test(raw.forgeRevision)||v.forgeRevision!==raw.forgeRevision||!Array.isArray(v.cards))return grants;
 for(const g of v.cards){
  if(!g||!id(g.id)||!['Hand','Library'].includes(g.zone)||!seatById.has(g.zoneHolder)||grants.has(g.id))return new Map();
  grants.set(g.id,g);
 }
 return grants;
}
export function projectForge(raw,{lookupArtwork=()=>null}={}){
 if(raw?.schema!==SCHEMA){if(raw?.status==='initializing')return null;throw Error('Unsupported Forge snapshot schema.');}
 if(!id(raw.revision)||!Array.isArray(raw.players)||raw.players.length!==2||raw.players.some(p=>!id(p?.id))||new Set(raw.players.map(p=>p.id)).size!==2)throw Error('Invalid Forge snapshot.');
 const seatById=new Map(raw.players.map((p,seat)=>[p.id,seat])),seat=seatById.get(raw.viewer);
 if(seat===undefined||raw.players.filter(p=>p.isViewer).length!==1||raw.players[seat].isViewer!==true)throw Error('Forge viewer identity mismatch.');
 const failed=raw.status==='failed'||!!raw.failure;
 const cards=new Map(),grants=visibilityGrants(raw,seatById),rows=[],seen=new Map(),conflicts=new Set();
 const zones=new Set(['Hand','Library','Battlefield','Graveyard','Exile','Command']);
 // Bridges with the 4.2.7 adapter patch list each visible card's current keywords (omitted
 // when it has none) and always send dayNight. Older bridges send neither, so keywords stay
 // unknown (null) and the table falls back to keyword-only lines of the rules text.
 const keywordsReported=Object.hasOwn(raw,'dayNight');
 const keywordList=k=>Array.isArray(k)?k.filter(x=>typeof x==='string'||typeof x?.text==='string').slice(0,40).map(x=>typeof x==='string'?x:{keyword:typeof x.keyword==='string'?x.keyword:null,text:x.text}):keywordsReported?[]:null;
 // Determine duplicate/conflicting IDs before any identity or artwork lookup.
 for(const p of raw.players)for(const [zone,z]of Object.entries(p.zones||{}))for(const c of list(z?.cards)){
  if(!c||!id(c.id))continue;
  if(seen.has(c.id))conflicts.add(c.id);else seen.set(c.id,c);
  rows.push({c,zone,holder:p.id});
 }
 const sameReference=(a,b)=>['id','zone','owner','controller','hidden','name','text','type','manaCost','setCode','imageKey'].every(k=>a[k]===b[k]);
 for(const s of list(raw.stack))if(s?.source&&id(s.source.id)){
  const c=s.source;if(seen.has(c.id)&&!sameReference(seen.get(c.id),c))conflicts.add(c.id);else if(!seen.has(c.id))seen.set(c.id,c);
 }
 const addCard=(c,zone=c?.zone,holder=null)=>{
  if(failed||!c||!id(c.id)||conflicts.has(c.id)||!seatById.has(c.owner)||!seatById.has(c.controller)||c.zone!==zone||(!zones.has(zone)&&zone!=='Stack'))return;
  const privateZone=['Hand','Library'].includes(zone),grant=grants.get(c.id);
  const permitted=privateZone&&grant?.zone===zone&&grant.zoneHolder===holder;
  // Compatibility with pre-evidence native bridges permits only the viewer's
  // own Hand container. Owner/controller fields never authorize private rows.
  const legacyOwnHand=raw.visibility===undefined&&zone==='Hand'&&holder===raw.viewer;
  if(privateZone&&(!permitted&&!legacyOwnHand||c.hidden!==false))return;
  if(c.hidden===true){cards.set(c.id,{id:c.id,owner:seatById.get(c.owner),controller:seatById.get(c.controller),zone,known:false,tapped:c.tapped===true});return;}
  if(c.hidden!==false||typeof c.name!=='string'||!c.name)return;
  const types=typeof c.type==='string'?c.type.split(/\s+/).filter(t=>['Creature','Land','Artifact','Enchantment','Planeswalker','Battle','Instant','Sorcery'].includes(t)):[];
  const card={id:c.id,owner:seatById.get(c.owner),controller:seatById.get(c.controller),zone,known:true,name:c.name,types,type:c.type||'',manaCost:c.manaCost||'',text:c.text||'',power:c.power??null,toughness:c.toughness??null,tapped:c.tapped===true,attacking:c.attacking===true,blocking:c.blocking===true,isToken:c.token===true,commander:c.commander===true,damage:c.damage||0,summoningSick:c.summoningSick===true,counters:c.counters||{},keywords:keywordList(c.keywords),crew:Number.isSafeInteger(c.crew)&&c.crew>=0?c.crew:null,attachedTo:Number.isSafeInteger(c.attachedTo)?c.attachedTo:null,attachments:list(c.attachments).filter(Number.isSafeInteger),attackTarget:['player','card'].includes(c.attackTarget?.kind)&&Number.isSafeInteger(c.attackTarget?.id)?{kind:c.attackTarget.kind,id:c.attackTarget.id}:null,blockingIds:list(c.blockingIds).filter(Number.isSafeInteger)};
  if(card.isToken){const colors=tokenColors(c.imageKey);if(colors)card.tokenColors=colors;}
  if(privateZone){card.zoneHolder=seatById.get(holder);if(permitted)card.zoneVisibility='native-face-visible';}
  const artwork=lookupArtwork(card.name,c);if(artwork)card.printing={playArtwork:artwork};
  cards.set(c.id,card);
 };
 for(const {c,zone,holder}of rows)addCard(c,zone,holder);
 const count=n=>id(n)&&n>=0?n:0;
 const playerCounters=c=>Object.fromEntries(Object.entries(c&&typeof c==='object'?c:{}).filter(([k,v])=>typeof k==='string'&&k.length<=40&&Number.isSafeInteger(v)&&v>0));
 const players=raw.players.map((p,seat)=>({seat,nativeId:p.id,name:p.name,life:p.life,handCount:count(p.zones?.Hand?.count),libraryCount:count(p.zones?.Library?.count),counters:playerCounters(p.counters)}));
 const stack=list(raw.stack).map(s=>{if(s.source&&!cards.has(s.source.id)&&s.source.zone==='Stack')addCard(s.source);return {id:s.id,source:cards.has(s.source?.id)?s.source.id:null,text:stackText(s.text),controller:seatById.get(s.activatingPlayer)};});
 const revealedZones=[];
 for(const p of players)for(const zone of ['Hand','Library']){
  if(zone==='Hand'&&p.seat===seat)continue;
  const visible=[...cards.values()].filter(c=>c.zone===zone&&c.zoneHolder===p.seat&&c.zoneVisibility==='native-face-visible').map(c=>c.id);
  if(visible.length)revealedZones.push({zone,seat:p.seat,nativeId:p.nativeId,count:zone==='Hand'?p.handCount:p.libraryCount,cards:visible});
 }
 const terminal=raw.status==='finished'?{winner:seatById.get(raw.winnerPlayerId)??players.find(p=>p.name===raw.winner)?.seat??null,reason:'engine-terminal'}:null;
 const human=!raw.busy&&!terminal&&!failed;
 return {revision:raw.revision,terminal,failure:failed?'NATIVE_PROJECTION_UNAVAILABLE':null,outcomes:[],surface:{seat,players,cards:[...cards.values()],hand:arenaHandOrder([...cards.values()].filter(c=>c.zone==='Hand'&&c.zoneHolder===seat)).map(c=>c.id),revealedZones,stack,turn:raw.turn??0,phase:PHASES[raw.phase]||raw.phase||'Opening hand',activeSeat:seatById.get(raw.activePlayer),prioritySeat:seatById.get(raw.priorityPlayer)??(human?seat:null),decision:{kind:failed?'ProjectionUnavailable':terminal?'GameOver':raw.turn===0?'MulliganDecision':nativeDecisionKind(raw)},awaitingHuman:human,canAct:human,choices:[],interaction:{canSubmit:false,opportunities:[]}}};
}
// Retain only current projected card representations in the native presentation
// cache too. Invalid receipts must not merely hide a face while storing it here.
// Native prompt options remain their separate engine-authored dialog contract.
function retainProjectedNative(next,projection){
 const copy=structuredClone(next),view=projection.surface,current=new Map(view.cards.map(c=>[c.id,c]));
 const row=(c,zone,holder=null)=>{
  const visible=current.get(c?.id);
  if(!visible||visible.zone!==zone||c.zone!==zone||(['Hand','Library'].includes(zone)&&visible.zoneHolder!==holder))return null;
  return visible.known?c:{id:c.id,owner:c.owner,controller:c.controller,zone,hidden:true,tapped:c.tapped===true};
 };
 for(const p of copy.players){const holder=view.players.find(v=>v.nativeId===p.id)?.seat;for(const [zone,z]of Object.entries(p.zones||{}))if(z&&typeof z==='object')z.cards=list(z.cards).map(c=>row(c,zone,holder)).filter(Boolean);}
 for(const entry of list(copy.stack)){if(typeof entry.text==='string')entry.text=stackText(entry.text);}
 for(const entry of list(copy.stack))if(entry.source){const c=current.get(entry.source.id);entry.source=row(entry.source,entry.source.zone,c?.zoneHolder??null);}
 if(projection.failure)Object.assign(copy,{status:'failed',failure:'native_match_failed',message:'Native match stopped.',prompt:null,stack:[],selection:{cards:[],targets:[],chosen:[],actionable:[]},buttons:{},notification:{},lastActionError:null,autoPassNoActions:false});
 return copy;
}
export function createForgeSession({baseUrl,token,fetchImpl=globalThis.fetch,pollMs=350,lookupArtwork=()=>null}={}){
 const origin=localBridgeUrl(baseUrl);if(typeof token!=='string'||!token.trim())throw Error('Enter the local bridge token.'); async function request(path,body){
  const response=await fetchImpl(origin+path,{method:body?'POST':'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{throw Error('Forge returned an unreadable response.');}
  if(!response.ok){const e=Error(data.error||`Forge HTTP ${response.status}`);e.status=response.status;throw e;}return data;
 }
 return createForgePresentationSession({request,pollMs,lookupArtwork,onClose:()=>{token='';}});
}
// Transport injection keeps the local bearer boundary intact. The hosted client
// supplies same-origin account requests, never a remote bridge URL or token.
const SETTINGS_OPS=new Set(['controlMode','autoPay','phaseStop','yieldSource']),AWAIT_STALE_MS=4000;
const settingsKey=n=>JSON.stringify([n?.controlMode??null,n?.autoPay??null,n?.phaseStops??null,(n?.stack||[]).map(x=>x?.yielded===true)]);
export function createForgePresentationSession({request,pollMs=350,lookupArtwork=()=>null,onClose=()=>{},allowControlMode=false,transportStatus=()=>({blocked:false,error:null})}={}){
 if(typeof request!=='function')throw Error('FORGE_TRANSPORT_REQUIRED');
 let awaitSince=0,native=null,status=null,selected=null,draft=null,error=null,actionError=null,sending=false,awaitRevision=null,closed=false,timer=null,refreshing=null,boundViewer=null,lastAcceptedRevision=-1;
 const listeners=new Set();
 // Forge reports Hand, Battlefield and the other zones but not its Stack zone, so a card being paid
 // for, or resolving while its stack item is still listed, can be missing from a snapshot taken while
 // Forge works. Keep it where it was, inert, until Forge places it: it no longer blinks out and back.
 // Only your own hand and the public battlefield, only while Forge is busy (capped) or you are paying.
 const TRANSIT_MS=2500,transit=new Map();
 const holdInTransit=(projection,next)=>{
  const prev=status?.surface,view=projection.surface,paying=view.decision.kind==='ManaPayment';
  if(!prev||projection.failure||projection.terminal||prev.seat!==view.seat||!(next.busy===true||paying)){transit.clear();return projection;}
  const now=Date.now(),ids=new Set(view.cards.map(c=>c.id)),kept=[],hand=[...view.hand];
  for(const c of prev.cards){
   if(ids.has(c.id)||!c.known||!(c.zone==='Battlefield'||c.zone==='Hand'&&c.zoneHolder===view.seat))continue;
   const since=transit.get(c.id)??now;if(!paying&&now-since>TRANSIT_MS)continue;
   kept.push({...c,inTransit:true});if(c.zone==='Hand')hand.splice(Math.min(Math.max(prev.hand.indexOf(c.id),0),hand.length),0,c.id);
  }
  for(const k of [...transit.keys()])if(!kept.some(c=>c.id===k))transit.delete(k);
  for(const c of kept)if(!transit.has(c.id))transit.set(c.id,now);
  return kept.length?{...projection,surface:{...view,cards:[...view.cards,...kept],hand}}:projection;
 };
 const effectiveDraft=()=>draft||(native?.prompt?.method==='order'&&native.prompt.ordered===true?{revision:native.revision,promptId:native.prompt.id,indexes:[...list(native.prompt.destinationIndexes)],remember:false}:null);
 const snapshot=()=>({status,selected,pending:null,busy:sending||awaitRevision!==null||!!native?.busy||transportStatus().blocked===true,error:status?.failure?'NATIVE_PROJECTION_UNAVAILABLE':!status&&error?'FORGE_PROJECTION_UNAVAILABLE':null,clock:null,native,nativeDraft:effectiveDraft(),transportError:transportStatus().error||actionError||error});
 // The transport state last shown. A lost action settled without a new board changes only
 // this, so it is redrawn on its own; otherwise the table would stay looking locked.
 let shownTransport='';
 const transportKey=()=>{const t=transportStatus();return (t.blocked===true)+'|'+(t.error||'');};
 const emit=()=>{shownTransport=transportKey();for(const fn of listeners)fn(snapshot());};
 const clearPrivateState=()=>{transit.clear();native=null;status=null;selected=null;draft=null;awaitRevision=null;};
 const acceptState=next=>{
  if(closed)return false;
  if(boundViewer!==null&&next?.viewer!==boundViewer){clearPrivateState();error='Forge viewer identity changed.';emit();throw Error(error);}
  if(id(next?.revision)&&next.revision<lastAcceptedRevision)return false;
  // A snapshot at the same revision is normally a repeat. Forge can still finish working without
  // a new revision (busy clears and a payment step opens), so a change of busy, input or prompt
  // is taken; otherwise the table would sit on "applying your play" with no Cancel.
  // Bounded: an accepted action that never shows a newer revision cannot hold the table forever once Forge is idle.
  if(awaitRevision!==null&&!sending&&next?.busy!==true&&id(next?.revision)&&next.revision===lastAcceptedRevision&&Date.now()-awaitSince>AWAIT_STALE_MS){awaitRevision=null;emit();}
  // Settings (Smart / Full Control, auto-pay, stops, yields) can also change without a new revision.
  if(id(next?.revision)&&next.revision===lastAcceptedRevision&&!(native&&((native.busy===true)!==(next.busy===true)||(native.inputType||'')!==(next.inputType||'')||(native.prompt?.id??null)!==(next.prompt?.id??null)||settingsKey(native)!==settingsKey(next))))return false;
  let projection;
  try{projection=projectForge(next,{lookupArtwork});}catch(e){clearPrivateState();error=e.message;emit();throw e;}
  if(!projection)return false;
  boundViewer=next.viewer;lastAcceptedRevision=next.revision;
  if(native?.revision!==next.revision){draft=null;actionError=null;}
  native=retainProjectedNative(next,projection);status=holdInTransit(projection,next);
  if(awaitRevision!==null&&next.revision>awaitRevision)awaitRevision=null;
  if(selected!==null&&!status?.surface.cards.some(c=>c.id===selected&&c.known))selected=null;
  emit();return true;
 };

 const refresh=()=>{
  if(closed)return Promise.resolve();if(refreshing)return refreshing;
  refreshing=request('/state').then(next=>{if(closed)return;error=null;if(next!==null)acceptState(next);if(transportKey()!==shownTransport){if(shownTransport.startsWith('true|')&&transportStatus().blocked!==true)actionError=null;emit();}}).catch(e=>{if([401,410].includes(e.status)||e.code==='ACCOUNT_CHANGED'||e.code?.includes('MISMATCH')||e.code==='INVALID_NATIVE_TERMINAL_RECEIPT')clearPrivateState();error=e.message;emit();throw e;}).finally(()=>{refreshing=null;});return refreshing;
 };
 async function send(op,payload={},expectedRevision=native?.revision){
  if(closed||!status||snapshot().busy||native.failure||status.failure||status.terminal)throw Error('MATCH_NOT_READY');
  if(expectedRevision!==native.revision)throw Error('STALE_CHOICE');
  sending=true;error=null;actionError=null;emit();
  try{
   await request('/action',{...payload,op,revision:expectedRevision});
   // Never replay an action automatically after network uncertainty or a stale reply.
   // A concurrent poll may already have observed this action's advancement
   // before its receipt arrived. Do not wait again for an already accepted
   // revision: repeated snapshots are deliberately ignored by acceptState.
   // A settings command is done once accepted: Forge need not start a new revision for it.
   awaitRevision=SETTINGS_OPS.has(op)||lastAcceptedRevision>expectedRevision?null:expectedRevision;awaitSince=Date.now();draft=null;
   await refresh();
  }catch(e){draft=null;awaitRevision=null;actionError=e.message;emit();try{await refresh();}catch{}actionError=e.message;}
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
  const known=kind==='card'?status?.surface.cards.some(c=>c.id===nativeId&&!c.inTransit):kind==='player'?native?.players.some(p=>p.id===nativeId):kind==='stack'?native?.stack.some(s=>s.id===nativeId):false;
  if(!known)throw Error('STALE_CHOICE');return send(kind,{id:nativeId},expectedRevision);
 };
 return {snapshot,acceptState,refresh,subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn);},
  async start({readInitial=true}={}){if(readInitial)await refresh();const poll=async()=>{if(closed)return;try{await refresh();}catch{}if(!closed)timer=setTimeout(poll,pollMs);};timer=setTimeout(poll,pollMs);},
  close(){if(closed)return;closed=true;clearTimeout(timer);clearPrivateState();error=null;actionError=null;emit();listeners.clear();onClose();},
  inspect(cardId){if(status?.surface.cards.some(c=>c.id===cardId&&c.known)){selected=cardId;emit();}},
  nativeSelect,nativeButton(op,revision=native?.revision){if(native.prompt)throw Error('Use the native dialog.');if(!['ok','cancel'].includes(op)||native.buttons?.[op+'Enabled']!==true)throw Error('Native button is disabled.');return send(op,{},revision);},
  // Dialog options are a separate engine-authored visibility contract. Resolve
  // artwork only for a visible card in the current offered option, never by
  // looking through private zone containers or accepting a caller's card name.
  promptCardArtwork(index,revision=native?.revision){
   if(revision!==native?.revision||native?.prompt?.supported!==true)return null;
   const option=list(native.prompt.options).find(o=>o.index===index),card=option?.value?.card||option?.value;
   if(optionCardId(option?.value)===null)return null;
   const artwork=lookupArtwork(card.name,card);
   return {id:card.id,name:card.name,known:true,zone:card.zone,...(artwork?{printing:{playArtwork:artwork}}:{})};
  },
  // A yes/no question about one card ("Put Liliana the Faultless on the top of library or
  // graveyard?") names that card in Forge's own prompt; show its catalogue art. Only a name the
  // current prompt states is looked up, never a hidden zone.
  promptNamedCard(revision=native?.revision){
   const p=native?.prompt;if(revision!==native?.revision||p?.supported!==true)return null;
   const text=String(p.message||native.message||''),m=/\bput (.+?) (?:on(?:to)? (?:the )?(?:top|bottom)|in(?:to)? (?:your |its owner's )?(?:graveyard|hand|library))/i.exec(text);
   const name=m?.[1]?.replace(/ \(\d+\)$/,'').trim();if(!name||name.length>80)return null;
   const artwork=lookupArtwork(name,{name});return artwork?{name,known:true,printing:{playArtwork:artwork}}:null;
  },
  selectPrompt,confirmPrompt,clearPrompt(){const p=currentPrompt();draft=p.method==='order'?{revision:native.revision,promptId:p.id,indexes:[],remember:false}:null;emit();},
  rememberPrompt(value){const p=currentPrompt();if(p.method!=='order'||p.rememberAllowed!==true||typeof value!=='boolean')throw Error('Native remember choice not offered.');draft={...effectiveDraft(),remember:value};emit();},
  reorderPrompt(index,direction){const p=currentPrompt();if(p.method!=='order'||p.ordered!==true||![1,-1].includes(direction))throw Error('Native order movement not offered.');const indexes=[...promptIndexes()],at=indexes.indexOf(index),to=at+direction;if(at<0||to<0||to>=indexes.length)return;[indexes[at],indexes[to]]=[indexes[to],indexes[at]];draft={...effectiveDraft(),indexes};emit();},
  replyValue(value){const p=currentPrompt();return send('reply',{promptId:p.id,value});},
  setControlMode(value){if(!allowControlMode||!['smart','full'].includes(value)||!['smart','full'].includes(native?.controlMode))throw Error('NATIVE_CONTROL_MODE_UNAVAILABLE');if(native.prompt||native.inputType==='InputLockUI')throw Error('MATCH_NOT_READY');return send('controlMode',{value});},
  setAutoPay(value){if(!allowControlMode||typeof value!=='boolean'||typeof native?.autoPay!=='boolean')throw Error('NATIVE_AUTO_PAY_UNAVAILABLE');if(native.prompt||native.inputType==='InputLockUI')throw Error('MATCH_NOT_READY');return send('autoPay',{value});},
  // Older bridges carry no phaseStops; the table then offers no stop controls.
  setPhaseStop(seat,phase,mode){if(!allowControlMode||!native?.phaseStops||typeof native.phaseStops!=='object')throw Error('NATIVE_PHASE_STOPS_UNAVAILABLE');return send('phaseStop',{seat,phase,mode});},
  yieldSource(id,value=true){const item=native?.stack?.find(x=>x.id===id);if(!allowControlMode||item?.ability!==true)throw Error('NATIVE_YIELD_UNAVAILABLE');if(native.prompt||native.inputType==='InputLockUI')throw Error('MATCH_NOT_READY');return send('yieldSource',{id,value:!!value});},
  concede(){return send('concede');},
  // No fake session rules or generic choose/cast fallback are exposed.
 };
}
