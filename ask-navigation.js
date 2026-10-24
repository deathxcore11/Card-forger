// Temporary browser-history layers for an Ask-originated deck. Conversation DOM
// and sheet snapshots stay in memory: history contains only an opaque session ID
// and position, never a prompt, draft, card list or account data.
export function createAskNavigation({history=globalThis.history,location=globalThis.location,captureSheet,restoreSheet,closeSheet,closeAsk,sheetKey,beforeLeaveSheet=()=>{}}){
 const marker='cardstashyAsk',retired=new Map();
 let session=null,position=-1,painting=false,armed=false,pending=null,resolvePending=null,generation=0,retiredTravel=null,leavingToRoute=false;
 const retire=()=>{if(!session)return;const mark=history.state?.[marker],end=mark?.id===session.id?mark.position:position;retired.set(session.id,{last:position,end:Math.max(0,end)});if(retired.size>12)retired.delete(retired.keys().next().value);};
 const entry=()=>history.state?.[marker];
 const valid=()=>!!session&&session.current();
 const active=()=>valid()&&position>=0&&entry()?.id===session.id;
 const clean=state=>{const next={...state};delete next[marker];return next;};
 const save=(leaving=false)=>{if(position>0&&session){if(leaving)beforeLeaveSheet();const snapshot=captureSheet();if(snapshot)session.frames[position]=snapshot;}};
 const paint=fn=>{painting=true;try{fn();}finally{painting=false;}};
 const base=()=>{closeSheet();if(session?.baseSheet)restoreSheet(session.baseSheet);};
 const hide=(restoreBase=true)=>paint(()=>{closeAsk();if(restoreBase&&valid())base();else closeSheet();});
 const restore=()=>paint(()=>{
  if(position===0){base();session.show();}
  else {closeAsk();restoreSheet(session.frames[position]);}
 });
 const push=()=>history.pushState({...clean(history.state),[marker]:{id:session.id,position}},'',location.href);
 const settle=()=>{const done=resolvePending;resolvePending=null;pending=null;leavingToRoute=false;done?.();};
 const travel=delta=>{
  if(pending)return pending;
  pending=new Promise(resolve=>{resolvePending=resolve;});
  const result=pending;history.go(delta);return result;
 };
 const leave=async(forget=false)=>{
  if(painting)return;
  if(forget)leavingToRoute=true;
  if(pending){await pending;return leave(forget);}
  if(!active()){if(forget){retire();session=null;generation++;}leavingToRoute=false;return;}
  save(true);armed=false;hide(!forget);await travel(-position-1);
  if(forget){retire();session=null;generation++;}leavingToRoute=false;
 };
 return {
  get active(){return active();},get atAsk(){return active()&&position===0;},get atSheet(){return active()&&position>0;},get busy(){return !!pending;},
  open(options){
   if(!options.current())return;
   if(pending){const owner=generation;return pending.then(()=>{if(generation===owner&&options.current())this.open(options);});}
   if(active())return;
   generation++;leavingToRoute=false;session={...options,id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random(),frames:[null],baseSheet:captureSheet(),baseId:history.state?.cardstashy?.entryId,url:location.href};
   position=0;push();restore();
  },
  async restart(){
   if(!active()||position!==0)return;
   const options=session,owner=generation;await leave();
   if(generation===owner&&options.current())this.open(options);
  },
  async handoff(open){
   if(!active()||pending)return;
   const owner=session;armed=true;paint(closeSheet);
   try{return await open();}
   finally{armed=false;if(session===owner&&active()&&position===0&&!pending)restore();}
  },
  beforeSheet(){if(!painting&&!pending&&active()&&(armed||position>0))save();},
  sheetOpened(){
   if(painting||pending||!active()||(!armed&&position===0))return;
   const snapshot=captureSheet();if(!snapshot)return;
   const previous=session.frames[position];
   if(position>0&&sheetKey(previous?.ctx)===sheetKey(snapshot.ctx)){session.frames[position]=snapshot;return;}
   session.frames.splice(position+1);session.frames.push(snapshot);position++;push();
  },
  back(){if(!active())return false;if(!pending){save(true);void travel(-1);}return true;},
  backToAsk(){if(!active()||position===0)return false;if(!pending){save(true);void travel(-position);}return true;},
  rootClosed(){if(!painting)void leave();},
  leave,
  closeInternal(){if(painting||!active()&&!pending)return false;void leave(true);return true;},
  // Internal sheet teardown (a route/account/workspace change) is not a user
  // dismissal. It must never revive an old conversation after the change.
  discard(){if(painting)return;retire();generation++;armed=false;session=null;position=-1;if(entry())history.replaceState(clean(history.state),'',location.href);settle();},
  historyChanged(){
   const target=entry();
   if(retiredTravel){if(target?.id===retiredTravel.id&&target.position===retiredTravel.from)return true;retiredTravel=null;}
   if(valid()&&target?.id===session.id&&Number.isInteger(target.position)&&target.position>=0&&target.position<session.frames.length){
    if(position===target.position&&!pending)return false;
    save(true);position=target.position;restore();
    settle();return true;
   }
   if(position>=0){
    if(!valid())retire();
    save(true);hide(!leavingToRoute);position=-1;
    const sameBase=valid()&&location.href===session.url&&history.state?.cardstashy?.entryId===session.baseId;
    settle();if(sameBase)return true;
   }
   // We can skip only retired frames whose bounded positions we created in
   // this page lifetime. Never guess a history distance after a cold reload.
   const tombstone=target&&retired.get(target.id);
   if(tombstone&&Number.isInteger(target.position)&&target.position>=0&&target.position<=tombstone.end){
    const destination=target.position<tombstone.last?-1:tombstone.end;
    tombstone.last=destination;
    if(destination!==target.position){retiredTravel={id:target.id,from:target.position};history.go(destination-target.position);return true;}
   }
   // A reload/account change cannot resurrect in-memory content. Remove only
   // our marker and leave the ordinary route/game history to the app.
   if(target)history.replaceState(clean(history.state),'',location.href);
   return false;
  }
 };
}

// innerHTML does not contain live input/checkbox/select properties. Preserve
// only the existing sheet's noncredential controls, in memory, without focus
// changes or events that could submit a rebuild or save anything.
export function captureSheetForm(root){
 return [...root.querySelectorAll('input,textarea,select')].map((node,index)=>({node,index})).filter(({node})=>!['file','password'].includes(node.type)).map(({node,index})=>({index,tag:node.tagName,type:node.type,value:node.value,checked:node.checked,selection:typeof node.selectionStart==='number'?[node.selectionStart,node.selectionEnd]:null}));
}
export function restoreSheetForm(root,fields=[]){
 const nodes=[...root.querySelectorAll('input,textarea,select')];
 for(const field of fields){const node=nodes[field.index];if(!node||node.tagName!==field.tag||node.type!==field.type||['file','password'].includes(node.type))continue;node.value=field.value;if(typeof field.checked==='boolean')node.checked=field.checked;if(field.selection)try{node.setSelectionRange(...field.selection);}catch{}}
}
