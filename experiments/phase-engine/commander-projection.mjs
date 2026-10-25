// This accepts only the engine's seat-filtered state, never an authority save.
// Hidden locations/identities are deliberately absent. Missing facts stay null.
const seatId=n=>Number.isSafeInteger(n)&&n>=0&&n<2;
const id=n=>Number.isSafeInteger(n)&&n>0;
const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const publicZones=new Set(['Command','Battlefield','Stack','Graveyard','Exile']);
export function projectCommander(envelope,seat){
 const s=envelope?.state;
 if(!s||!seatId(seat)||s.viewer_projection!==seat)throw Error('INVALID_VIEW');
 const commanders=Object.values(s.objects||{}).filter(o=>id(o?.id)&&o.is_commander===true&&publicZones.has(o.zone)&&o.display_visible_to_viewer===true&&o.name!=='Hidden Card'&&o.face_down!==true).map(o=>({
  id:o.id,owner:seatId(o.owner)?o.owner:null,controller:seatId(o.controller)?o.controller:null,zone:o.zone,
  tax:count(o.commander_tax),castCount:count(s.commander_cast_count?.[o.id])
 })).sort((a,b)=>a.id-b.id);
 const visible=new Set(commanders.map(c=>c.id));
 const damage=(Array.isArray(s.commander_damage)?s.commander_damage:[]).filter(d=>visible.has(d?.commander)&&seatId(d.player)&&count(d.damage)!==null).map(d=>({commanderId:d.commander,player:d.player,amount:d.damage})).sort((a,b)=>a.commanderId-b.commanderId||a.player-b.player);
 return {version:1,coverage:'visible-public-objects',commanders,damage,damageAvailable:Array.isArray(s.commander_damage)};
}

// Capture the public designation once at game start. Subsequent reads never
// learn a hidden card's name, location, owner or controller from its object.
// This registry is reset per game; it is not match recovery/persistence.
export function createCommanderProjector(){
 let binding=null,registry=new Map();
 function reset(envelope,seat){
  const visible=projectCommander(envelope,seat),objects=envelope.state.objects||{};
  binding=seat;registry=new Map(visible.commanders.filter(c=>c.zone==='Command').map(c=>[c.id,{id:c.id,owner:c.owner,name:typeof objects[c.id]?.name==='string'?objects[c.id].name.slice(0,300):null}]));
 }
 function read(envelope,seat){
  const current=projectCommander(envelope,seat),s=envelope.state;
  // Legacy durable-resume paths have no initial public identity receipt.
  // Keep their prior bounded visible-object display rather than invent history.
  if(binding===null)return current;
  if(binding!==seat)throw Error('COMMANDER_LEDGER_WRONG_SEAT');
  const byId=new Map(current.commanders.map(c=>[c.id,c]));
  const commanders=[...registry.values()].map(known=>{
   const visible=byId.get(known.id);
   return visible?{...visible,name:known.name,visible:true}:{...known,controller:null,zone:null,tax:null,castCount:count(s.commander_cast_count?.[known.id]),visible:false};
  }).sort((a,b)=>a.id-b.id);
  const damage=(Array.isArray(s.commander_damage)?s.commander_damage:[]).filter(d=>registry.has(d?.commander)&&seatId(d.player)&&count(d.damage)!==null).map(d=>({commanderId:d.commander,player:d.player,amount:d.damage})).sort((a,b)=>a.commanderId-b.commanderId||a.player-b.player);
  return {...current,coverage:'public-designation-ledger',commanders,damage};
 }
 return {reset,read};
}
