// Test-only validators. No game commands, card rules, private logs or network.
import assert from 'node:assert/strict';
export const FORGE_REVISION='e5a0f8156da70ffc7866f923bed371c0111707cd';
export function assertNativePrivacy(s){
 assert(s?.schema==='cardstashy.forge-proof.v1'&&s.forgeRevision===FORGE_REVISION,'Unexpected native snapshot identity');
 assert(Number.isSafeInteger(s.revision)&&Number.isSafeInteger(s.viewer),'Invalid native publication identity');
 assert(Array.isArray(s.players)&&s.players.length===2&&new Set(s.players.map(p=>p.id)).size===2,'Invalid native players');
 assert(s.players.filter(p=>p.isViewer===true&&p.id===s.viewer).length===1&&s.players.filter(p=>p.isViewer===true).length===1,'Invalid viewer binding');
 // This combined candidate REQUIRES the native visibility descendant. There is
 // no legacy-own-hand downgrade or prompt-only shortcut in this acceptance gate.
 const v=s.visibility,holders=new Set(s.players.map(p=>p.id)),grants=new Map();
 assert(v?.schema==='cardstashy.forge-visibility.v1'&&v.forgeRevision===s.forgeRevision&&v.viewer===s.viewer&&v.revision===s.revision&&Array.isArray(v.cards),'Missing or mismatched native visibility envelope');
 for(const g of v.cards){assert(g&&Number.isSafeInteger(g.id)&&['Hand','Library'].includes(g.zone)&&holders.has(g.zoneHolder)&&!grants.has(g.id),'Invalid or duplicate native visibility grant');grants.set(g.id,g);}
 const represented=new Set(),rows=new Map();let privateFaces=0;
 for(const p of s.players)for(const [zone,z]of Object.entries(p.zones||{}))for(const c of z.cards||[]){
  assert(c&&Number.isSafeInteger(c.id)&&!represented.has(c.id),'Duplicate card representation');represented.add(c.id);rows.set(c.id,c);
  if(['Hand','Library'].includes(zone)){
   const g=grants.get(c.id);
   assert(c.hidden===false&&c.zone===zone&&g?.zone===zone&&g.zoneHolder===p.id,'Private card lacks exact current native zone-holder permission');privateFaces++;
  }else if(c.hidden===true)assert(!['name','text','imageKey','manaCost','setCode','type'].some(k=>c[k]!==undefined),'Face-down public object carries identity');
 }
 assert([...grants.keys()].every(id=>represented.has(id)),'Native visibility grant has no delivered card');
 // Stack source copies cannot provide a second ingress for an omitted private
 // identity or conflict with the exact permitted current zone representation.
 for(const entry of s.stack||[])if(entry?.source){
  const c=entry.source,row=rows.get(c.id);
  if(['Hand','Library'].includes(c.zone)){
   assert(row&&row.zone===c.zone&&grants.has(c.id),'Private stack reference lacks current delivered permission');
   assert(['id','zone','owner','controller','hidden','name','text','type','manaCost','setCode','imageKey'].every(k=>row[k]===c[k]),'Conflicting private stack reference');
  }
  if(c.hidden===true)assert(!['name','text','imageKey','manaCost','setCode','type'].some(k=>c[k]!==undefined),'Face-down stack reference carries identity');
 }
 // Native one-shot dialogs are a separate permission contract and can precede
 // a board refresh. Do not fabricate a zone grant for them. CardView-shaped
 // prompt identities still require an explicit face flag; PaperCard/catalog
 // choices and generic engine prose are deliberately not reinterpreted here.
 for(const option of s.prompt?.options||[]){const c=option?.value?.card||option?.value;
  if(c&&Number.isSafeInteger(c.id)&&typeof c.zone==='string'){
   assert(c.hidden===true||c.hidden===false,'Prompt card face visibility flag missing');
   if(c.hidden===true)assert(!['name','text','imageKey','manaCost','setCode','type'].some(k=>c[k]!==undefined),'Masked prompt card carries identity');
  }
 }
 return {privateFaces,grants:grants.size};
}
export function boundedTimeout(requested,deadline,now=Date.now()){
 assert(Number.isSafeInteger(requested)&&requested>0&&Number.isFinite(deadline),'Invalid test deadline');
 const remaining=deadline-now;if(remaining<=0)throw Error('Absolute browser case deadline exceeded; no result invented');
 return Math.min(requested,remaining);
}
export function assertLayout(m,{touch=false}={}){
 const within=r=>r&&r.width>0&&r.height>0&&r.x>=-1&&r.y>=-1&&r.x+r.width<=m.width+1&&r.y+r.height<=m.height+1;
 const overlaps=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>2;
 for(const key of ['hand','you','cpu','dock']){assert(within(m[key]),'Required hand/HUD/dock region is outside viewport');const p=m.exposure?.[key];assert(p?.visible===true&&p.opacity>=.5&&p.areaRatio>.98&&p.hits>0,'Required region is transparent, clipped or occluded');}
 assert(m.lifeVisible?.length===2&&m.lifeVisible.every(Boolean),'Player life HUD is clipped or occluded');
 for(const key of ['hand','you','cpu'])assert(!overlaps(m[key],m.dock),'Decision dock obscures hand or player HUD');
 assert(m.compact===true,'Expected canonical compact passive native panel');
 if(touch)assert(m.dock.height<=m.height*.22+1,'Passive dock exceeds 22 percent touch-height budget');
 assert(m.controls.length>=3&&m.controls.every(c=>within(c)&&c.height>=43&&c.receivesPointer),'Canonical controls are clipped, undersized or covered');
 assert(m.visibleHandCards>0,'No own-hand card is visible');
 return true;
}
