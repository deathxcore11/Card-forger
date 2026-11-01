// Account-scoped setup/review only. No auth requests, inventory writes, deck saves
// or match admission occur here. readDecks supplies the current account's Magic
// lists; selectDeck accepts an ID only and always re-reads that source.
// API: snapshot/reconcile/refresh, selectDeck/clearSelection, updateDraft,
// importPaste(text,{name,format})/importDraft, reviewImport/clearImport.
// updateDraft is deliberately silent by default so typing need not rerender UI.
// The Practice CPU level is remembered on this device; Quick Play ignores it.
const CPU_LEVEL_KEY='cardstashy.practiceCpuLevel';
function savedCpuLevel(){try{const v=globalThis.localStorage?.getItem(CPU_LEVEL_KEY);return ['Easy','Medium','Hard'].includes(v)?v:'Medium';}catch{return 'Medium';}}
export function createPlaySetup({readAccount,readDecks,parseImport,resolveNames,onChange,getLocked}={}) {
 if(typeof readAccount!=='function'||typeof readDecks!=='function'||typeof parseImport!=='function')throw Error('Play setup requires account, deck and import readers.');
 const MAX_ROWS=2500,MAX_TEXT=100000,MAX_DECK_BYTES=2000000;
 let key=null,epoch=0,operation=0,owner=null,locked=false,account={},saved=[],selectedId=null,selectedImport=null,candidate=null,opponent=null,inspectedSeat='player',selectedKind=null,opponentSource=null,playStyle='practice',quickMatch=null,quickPlayerKey=null;
 let draft={name:'',text:'',format:''},importStatus='idle',error=null,warnings=[],importErrors=[],unresolved=[],busy=false;
 let match={format:'Commander',mode:'cpu',difficulty:savedCpuLevel(),startingPlayer:'random',podSize:'2',cpu3Level:'Medium',cpu4Level:'Medium'},browse={query:'',source:'yours'};
 // Commander pods (Practice only): the extra CPUs' random decks, picked when the match starts.
 let extraOpponents=[];
 // Decks you chose for the pod's extra seats (CPU 3, CPU 4). An empty seat gets a random Commander deck at Play.
 let podPicks={cpu3:null,cpu4:null},podSources={cpu3:null,cpu4:null};
 const POD_SEATS=['cpu3','cpu4'];
 // Seats you can fill: you, CPU 2, and the pod seats the chosen player count actually has.
 const seatOpen=seat=>seat==='player'||seat==='opponent'||(seat==='cpu3'&&pod())||(seat==='cpu4'&&pod()&&Number(match.podSize)>=4);
 function putCpu(seat,deck,source){if(seat==='opponent'){opponent=deck;opponentSource=source;}else{podPicks[seat]=deck;podSources[seat]=deck?source:null;}}
 const text=(v,max)=>typeof v==='string'&&v.length<=max?v:'';
 const identity=v=>(typeof v==='string'||typeof v==='number')&&String(v).length>0&&String(v).length<=160?String(v):null;
 function clone(value){
  const result=structuredClone(value),seen=new Set();let nodes=0;
  function check(v,depth=0){
   if(++nodes>50000||depth>20)throw Error('Deck data exceeds the setup review limit.');
   if(v===null||typeof v==='boolean')return;
   if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Deck data contains an invalid number.');return;}
   if(typeof v==='string'){if(v.length>MAX_TEXT)throw Error('Deck data contains an oversized field.');return;}
   if(!v||typeof v!=='object'||seen.has(v))throw Error('Deck data must be a finite plain record.');
   if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw Error('Deck data must be a plain record.');
   seen.add(v);for(const [k,child]of Object.entries(v)){if(k.length>160)throw Error('Deck data contains an oversized field name.');if(child!==undefined)check(child,depth+1);}seen.delete(v);
  }
  check(result);if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_DECK_BYTES)throw Error('Deck data exceeds the setup review limit.');return result;
 }
 function reset(){operation++;playStyle='practice';quickMatch=null;selectedId=null;selectedImport=null;candidate=null;opponent=null;inspectedSeat='player';selectedKind=null;opponentSource=null;draft={name:'',text:'',format:''};match={format:'Commander',mode:'cpu',difficulty:savedCpuLevel(),startingPlayer:'random',podSize:'2',cpu3Level:'Medium',cpu4Level:'Medium'};podPicks={cpu3:null,cpu4:null};podSources={cpu3:null,cpu4:null};browse={query:'',source:'yours'};importStatus='idle';error=null;warnings=[];importErrors=[];unresolved=[];busy=false;}
 function sync(){
  let next;try{next=readAccount()||{};}catch{next={};}
  const nextOwner=identity(next.user?.id),nextLocked=Boolean(next.switching||next.locked||getLocked?.(next));
  const generation=next.accountGeneration??next.generation??next.epoch??null;
  const nextKey=JSON.stringify([nextOwner,typeof generation==='string'||typeof generation==='number'?generation:null,nextLocked]);
  const changed=key!==nextKey;if(changed){key=nextKey;epoch++;reset();}
  account=next;owner=nextOwner;locked=nextLocked;
  try{const lists=owner&&!locked?readDecks(owner):[];saved=Array.isArray(lists)?lists:[];}catch{saved=[];}
  if(selectedId!==null&&!saved.some(d=>identity(d?.id)===selectedId)){selectedId=null;error='The selected deck is no longer available in this account.';}
  if(selectedId!==null&&saved.find(d=>identity(d?.id)===selectedId)?.format!==match.format){selectedId=null;error='The deck format changed. Choose a deck for the current match format.';}
  return changed;
 }
 function inspectDeck(source){
  let deck;try{deck=clone(source);}catch{return {deck:null,issues:['This deck contains malformed or oversized data.'],mainCount:null,sideCount:null,rowCount:0};}
  const issues=[];let mainCount=0,sideCount=0;
  if(!deck||Array.isArray(deck)||typeof deck!=='object')return {deck:null,issues:['This deck is not a valid record.'],mainCount:null,sideCount:null,rowCount:0};
  if(typeof deck.name!=='string'||!deck.name.trim()||deck.name.length>160)issues.push('Deck name is missing or exceeds 160 characters.');
  if(deck.format!==undefined&&(typeof deck.format!=='string'||deck.format.length>80))issues.push('Deck format is malformed.');
  function count(rows,zone,optional=false){
   if(rows===undefined&&optional)return 0;
   if(!Array.isArray(rows)){issues.push(zone+' must be a card list.');return null;}
   if(rows.length>MAX_ROWS){issues.push(zone+' exceeds the '+MAX_ROWS+'-row review limit.');return null;}
   let total=0,valid=true;
   for(let i=0;i<rows.length;i++){
    const row=rows[i];if(!row||Array.isArray(row)||typeof row!=='object'||typeof row.name!=='string'||!row.name.trim()||row.name.length>512||!Number.isSafeInteger(row.qty)||row.qty<1){issues.push(zone+' row '+(i+1)+' needs a card name and a positive whole quantity.');valid=false;continue;}
    total+=row.qty;if(!Number.isSafeInteger(total)){issues.push(zone+' quantity is too large to count safely.');valid=false;break;}
   }
   return valid?total:null;
  }
  mainCount=count(deck.cards,'Main deck');sideCount=count(deck.side,'Sideboard',true);
  return {deck,issues,mainCount,sideCount,rowCount:Array.isArray(deck.cards)?deck.cards.length:0};
 }
 function profile(){
  if(!owner||locked)return {signedIn:false,ownerId:null,locked,displayName:'Player',username:'',avatarArt:null,avatarUrl:''};
  const p=account.profile||{};let avatarArt=null;
  try{const art=account.art?.avatar??account.avatarArt??null;avatarArt=art===null?null:clone(art);}catch{}
  return {signedIn:Boolean(owner),ownerId:owner,locked,displayName:text(p.display_name,160)||text(p.username,160)||'Player',username:text(p.username,160),avatarArt,avatarUrl:text(p.avatar_url,4096)};
 }
 function value(){
  const decks=saved.map(d=>{const x=inspectDeck(d);return {id:d?.id??null,name:text(d?.name,160)||'Untitled deck',format:text(d?.format,80),commander:typeof d?.commander==='string'?text(d.commander,512):null,mainCount:x.mainCount,sideCount:x.sideCount,rowCount:x.rowCount,valid:x.issues.length===0,issues:x.issues};});
  let selected=null;
  if(selectedId!==null){const source=saved.find(d=>identity(d?.id)===selectedId);if(source)selected=inspectDeck(source).deck;}
  else if(selectedImport)selected=clone(selectedImport);
  if(quickMatch&&JSON.stringify(selected)!==quickPlayerKey){opponent=null;opponentSource=null;quickMatch=null;}
  return {profile:profile(),decks,selected,opponent:opponent?clone(opponent):null,inspectedSeat,playStyle,quickMatch:quickMatch?clone(quickMatch):null,match:{...match},extraOpponents:pod()?extraOpponents.map(x=>({deck:clone(x.deck),difficulty:x.difficulty})):[],podDecks:Object.fromEntries(POD_SEATS.map(k=>[k,seatOpen(k)&&podPicks[k]?clone(podPicks[k]):null])),podSources:Object.fromEntries(POD_SEATS.map(k=>[k,seatOpen(k)?podSources[k]:null])),browse:{...browse},importCandidate:candidate?clone(candidate):null,reviewDeck:candidate?clone(candidate):null,selectedSource:selectedId!==null?'saved':selectedImport?(selectedKind||'import'):null,opponentSource,importStatus,error,warnings:[...warnings],importErrors:[...importErrors],unresolved:[...unresolved],busy,draft:{...draft},readiness:{ready:false,code:'engine-verification-pending',reason:'Matches are unavailable while the rules engine, CPU and recovery checks are being verified.'}};
 }
 function snapshot(){sync();return value();}
 const pod=()=>match.format==='Commander'&&playStyle==='practice'&&match.mode==='cpu'&&Number(match.podSize)>2;
 // The pod's extra seats, in seat order (CPU 3 then CPU 4), each with its own level.
 function setExtraOpponents(decks){sync();if(!pod())throw Error('Four-player games are Commander Practice only.');const want=Number(match.podSize)-2;
  if(!Array.isArray(decks)||decks.length!==want||decks.some(d=>inspectDeck(d).issues.length||d?.format!=='Commander'))throw Error('Each extra CPU needs a complete Commander deck.');
  extraOpponents=decks.map((d,i)=>({deck:clone(d),difficulty:i===0?match.cpu3Level:match.cpu4Level}));return value();}
 function notify(){onChange?.(value());}
 function reconcile(){const changed=sync();if(changed)notify();return value();}
 function requireAccount(){if(!owner||locked){error=locked?'Account switching is in progress.':'Sign in to choose or import a Magic deck.';return false;}return true;}
 function retireQuick(){if(playStyle==='quick'){opponent=null;opponentSource=null;quickMatch=null;}}
 function selectDeck(id,seat='player'){
  sync();if(!requireAccount()){notify();return value();}const lookup=identity(id),source=lookup===null?null:saved.find(d=>identity(d?.id)===lookup);
  if(!source){error='That deck is not available in this account.';notify();return value();}
  if(source.format!==match.format){error='Choose a '+match.format+' deck. Other formats remain available in Decks.';notify();return value();}
  const inspected=inspectDeck(source);if(!inspected.deck){error=inspected.issues.join(' ');notify();return value();}
  if(!seatOpen(seat))throw Error('Unknown seat.');
  operation++;busy=false;candidate=null;importStatus='idle';if(seat!=='player'){putCpu(seat,clone(inspected.deck),'saved');}else{retireQuick();selectedId=lookup;selectedImport=null;selectedKind=null;}inspectedSeat=seat;error=null;warnings=[...inspected.issues];importErrors=[];unresolved=[];notify();return value();
 }
 function configure(partial){
  sync();
  const allowed={format:['Standard','Commander','Modern','Pioneer','Legacy','Vintage','Pauper','Standard Brawl'],mode:['cpu','friends'],difficulty:['Easy','Medium','Hard'],startingPlayer:['random','first','second'],podSize:['2','3','4'],cpu3Level:['Easy','Medium','Hard'],cpu4Level:['Easy','Medium','Hard']};
  if(!partial||Array.isArray(partial)||typeof partial!=='object'||Object.entries(partial).some(([k,v])=>!Object.hasOwn(allowed,k)||!allowed[k].includes(v))){error='Choose an available format, opponent and starting player.';return value();}
  if(partial.format&&partial.format!==match.format){
   operation++;selectedId=null;selectedImport=null;candidate=null;opponent=null;podPicks={cpu3:null,cpu4:null};podSources={cpu3:null,cpu4:null};inspectedSeat='player';selectedKind=null;opponentSource=null;busy=false;importStatus='idle';warnings=[];importErrors=[];unresolved=[];
   draft={...draft,format:partial.format};
  }
  if(partial.mode==='friends')inspectedSeat='player';
  extraOpponents=[];
  if(partial.difficulty&&partial.difficulty!==match.difficulty){retireQuick();try{globalThis.localStorage?.setItem(CPU_LEVEL_KEY,partial.difficulty);}catch{/* this device only */}}
  quickMatch=partial.format?null:quickMatch;match={...match,...partial,...(playStyle==='quick'?{startingPlayer:'random'}:{})};
  // Pods are Commander and Practice only.
  if(match.format!=='Commander'||playStyle==='quick'||match.mode!=='cpu')match.podSize='2';if(!seatOpen(inspectedSeat))inspectedSeat='player';error=null;notify();return value();
 }
 function searchDecks(query){sync();if(typeof query==='string'&&query.length<=160)browse={...browse,query};return value();}
 function setSource(source){sync();if(!['yours','precons','community','meta','random'].includes(source))throw Error('Unknown deck source.');browse={source,query:''};notify();return value();}
 function chooseTemporary(source,{seat=inspectedSeat,sourceKind='import'}={}){sync();if(!requireAccount())throw Error('Sign in before choosing a deck.');if(!seatOpen(seat)||!['precons','community','meta','random','import','starter'].includes(sourceKind))throw Error('Unknown deck selection.');const x=inspectDeck(source);if(x.issues.length||x.deck?.format!==match.format)throw Error('Choose a complete list for the current format.');operation++;busy=false;if(seat!=='player'){putCpu(seat,clone(x.deck),sourceKind);}else{retireQuick();selectedId=null;selectedImport=clone(x.deck);selectedKind=sourceKind;}inspectedSeat=seat;error=null;notify();return value();}
 function updateDraft(partial,{notify:shouldNotify=false}={}){
  sync();if(!requireAccount())return value();
  if(!partial||typeof partial!=='object'||Array.isArray(partial)||Object.keys(partial).some(k=>!['name','text','format'].includes(k))){error='Draft fields are malformed.';return value();}
  for(const [field,max]of [['name',160],['text',MAX_TEXT],['format',80]])if(Object.hasOwn(partial,field)&&(typeof partial[field]!=='string'||partial[field].length>max)){error='Draft '+field+' exceeds its review limit or is malformed.';return value();}
  if(Object.entries(partial).some(([k,v])=>draft[k]!==v)){draft={...draft,...partial};operation++;candidate=null;busy=false;importStatus='idle';error=null;warnings=[];importErrors=[];unresolved=[];}
  if(shouldNotify)notify();return value();
 }
 const notes=(input,label)=>{
  if(input===undefined)return [];if(!Array.isArray(input)||input.length>MAX_ROWS)throw Error(label+' is malformed.');
  return input.map(item=>{
   if(typeof item==='string'&&item.length<=2000)return item;
   if(!item||Array.isArray(item)||typeof item!=='object'||typeof item.reason!=='string'||!item.reason.trim()||item.reason.length>2000)throw Error(label+' is malformed.');
   if(item.line!==undefined&&item.line!==null&&!((Number.isSafeInteger(item.line)&&item.line>=0)||(typeof item.line==='string'&&item.line.length<=2000)))throw Error(label+' line is malformed.');
   return (item.line!==undefined&&item.line!==null?'Line '+item.line+': ':'')+item.reason;
  });
 };
 const namesFrom=(input,label)=>{
  if(input===undefined)return [];if(!Array.isArray(input)||input.length>MAX_ROWS)throw Error(label+' is malformed.');
  return input.map(item=>{const name=typeof item==='string'?item:item?.name;if(typeof name!=='string'||!name.trim()||name.length>512)throw Error(label+' is malformed.');return name;});
 };
 const nameKey=name=>name.normalize('NFKC').trim().toLowerCase();
 async function importPaste(input,options={}){
  sync();if(!requireAccount()){notify();return value();}
  const prepared=updateDraft({text:input,...(Object.hasOwn(options,'name')?{name:options.name}:{}),...(Object.hasOwn(options,'format')?{format:options.format}:{})});
  if(prepared.error){notify();return value();}if(!draft.text.trim()){error='Paste a deck list to review.';notify();return value();}
  const ticket=++operation,capturedEpoch=epoch,capturedKey=key,inputDraft={...draft};candidate=null;busy=true;error=null;warnings=[];importErrors=[];unresolved=[];importStatus='parsing';notify();
  const current=()=>{sync();return epoch===capturedEpoch&&key===capturedKey&&operation===ticket&&owner&&!locked;};
  try{
   const parsed=await parseImport(inputDraft.text,{name:inputDraft.name,format:inputDraft.format});if(!current())return value();
   importErrors=notes(parsed?.errors,'Import errors');warnings=notes(parsed?.warnings,'Import warnings');unresolved=namesFrom(parsed?.unresolved,'Unresolved names');
   const fatalErrors=(parsed?.errors||[]).filter(item=>typeof item==='string'||item?.fatal===true);
   if(fatalErrors.length)throw Error('The pasted list contains errors: '+notes(fatalErrors,'Import errors').join(' '));
   // Best-effort row issues remain explicit before the user chooses a list.
   // The parser's complete diagnostics/raw rows stay on the candidate clone.
   warnings=[...warnings,...importErrors];
   const raw=parsed?.deck??parsed;
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('The pasted deck could not be read.');
   const proposed={...raw,id:raw.id??'play-import-'+epoch+'-'+ticket,name:inputDraft.name||raw.name||'Imported deck',format:inputDraft.format||raw.format||match.format};
   if(proposed.format!==match.format)throw Error('Imported format differs from the selected match format.');
   const checked=inspectDeck(proposed);if(checked.issues.length)throw Error(checked.issues.join(' '));
   if(resolveNames){
    importStatus='resolving';notify();const names=[...new Set([...checked.deck.cards,...(checked.deck.side||[])].map(r=>r.name))];
    const resolved=await resolveNames(names);if(!current())return value();
    if(!resolved||!Array.isArray(resolved.failed))throw Error('Name lookup did not return a complete result.');
    const failed=namesFrom(resolved.failed,'Name lookup result'),attempted=new Set(names.map(nameKey));
    unresolved=[...new Set([...unresolved.filter(name=>!attempted.has(nameKey(name))),...failed])];
   }
   if(!current())return value();candidate=checked.deck;busy=false;importStatus='review';error=null;notify();return value();
  }catch(cause){
   if(!current())return value();busy=false;candidate=null;importStatus='error';error=cause instanceof Error&&cause.message.startsWith('The pasted list contains errors:')?cause.message:'The pasted deck could not be reviewed. Check its rows, quantities and format.';notify();return value();
  }
 }
 function reviewImport(seat='player'){sync();if(!requireAccount()){notify();return value();}if(busy||!candidate||importStatus!=='review'){error='Finish reviewing a valid pasted list before selecting it.';notify();return value();}if(!seatOpen(seat))throw Error('Unknown seat.');inspectedSeat=seat;if(seat!=='player'){putCpu(seat,clone(candidate),'import');}else{retireQuick();selectedImport=clone(candidate);selectedId=null;selectedKind='import';}candidate=null;importStatus='selected';error=null;notify();return value();}
 function clearImport(){sync();operation++;candidate=null;busy=false;importStatus='idle';error=null;warnings=[];importErrors=[];unresolved=[];notify();return value();}
 function clearSelection(seat='player'){sync();if(POD_SEATS.includes(seat)){putCpu(seat,null,null);}else if(seat==='opponent'){opponent=null;opponentSource=null;quickMatch=null;}else{retireQuick();selectedId=null;selectedImport=null;selectedKind=null;}error=null;notify();return value();}
 function chooseOpponent(source){sync();if(!requireAccount())throw Error("Sign in before choosing an opponent.");const x=inspectDeck(source);if(x.issues.length||x.deck?.format!==match.format)throw Error("Choose a complete opponent list for the current format.");opponent=clone(x.deck);opponentSource=source.practiceBuild?'random':'import';inspectedSeat='opponent';notify();return value();}
 function setPlayStyle(style){sync();if(!['quick','practice'].includes(style))throw Error('Unknown play style.');playStyle=style;quickMatch=null;inspectedSeat='player';if(style==='quick'){opponent=null;opponentSource=null;match={...match,startingPlayer:'random'};}notify();return value();}
 function setQuickOpponent(result){sync();if(!requireAccount()||match.mode!=='cpu'||playStyle!=='quick'||result?.difficulty!==match.difficulty)throw Error('The matchup changed. Find a CPU deck again.');chooseOpponent(result.deck);opponentSource='quick';inspectedSeat='player';quickPlayerKey=JSON.stringify(value().selected);quickMatch={reason:String(result.reason||''),candidateCount:result.candidateCount,estimated:result.estimated,difficulty:result.difficulty};notify();return value();}
 function inspectSeat(seat){sync();if(!seatOpen(seat))throw Error('Unknown seat.');inspectedSeat=seat;return value();}
 return {snapshot,setExtraOpponents,reconcile,refresh:reconcile,selectDeck,chooseTemporary,chooseOpponent,setPlayStyle,setQuickOpponent,inspectSeat,configure,searchDecks,setSource,updateDraft,importPaste,importDraft:()=>{sync();return importPaste(draft.text,{name:draft.name,format:draft.format});},reviewImport,clearImport,clearSelection};
}
