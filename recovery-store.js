// Private, owner-keyed device recovery. This journal is not uploaded with the
// workspace and does not delete older unsynced copies to make room for a new one.
// Callers serialize read/append/write with the workspace queue and owner guard.
import { workspaceContentSig } from './sync-merge.js';
export const recoveryKey=owner=>'cardstashy-recovery-journal-v1:'+encodeURIComponent(owner||'guest');
export const syncBaselineKey=owner=>'cardstashy-sync-baseline-v1:'+encodeURIComponent(owner||'guest');
export function recoverySummary(state){
 const games=[state||{},...Object.values(state?.tcg||{})];
 return {copies:games.reduce((n,g)=>n+(g.collection||[]).reduce((a,e)=>a+(Number(e.qty)||0),0),0),names:games.reduce((n,g)=>n+(g.collection?.length||0),0),decks:games.reduce((n,g)=>n+(g.decks?.length||0),0),wishlist:games.reduce((n,g)=>n+(g.wishlist?.length||0),0),saved:state?.lastSavedAt||null};
}
export function createRecoverySnapshot(state,{owner=null,label='Automatic recovery copy',reason='before-replace',revision=null,now=new Date(),id}={}){
 const copied=structuredClone(state);
 return {id:id||globalThis.crypto?.randomUUID?.()||'recovery-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),owner:owner||null,createdAt:now.toISOString(),label:String(label).slice(0,180),reason:String(reason).slice(0,80),revision:Number.isSafeInteger(revision)?revision:null,summary:recoverySummary(copied),state:copied};
}
export function readRecoverySnapshots(raw,owner=null){
 if(raw?.version!==1||raw.owner!==(owner||null)||!Array.isArray(raw.snapshots))return [];
 return raw.snapshots.filter(s=>s?.owner===(owner||null)&&typeof s.id==='string'&&s.state&&typeof s.state==='object').map(s=>structuredClone(s));
}
// Save timestamps do not change a recoverable workspace. Preserve settings,
// selection and all histories; never use the coarser authored-content signature.
export function recoveryStateSignature(state){
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
 const {lastSavedAt,...content}=state;
 return JSON.stringify(stable(content));
}
export function appendRecoverySnapshot(raw,snapshot){
 if(raw!==null&&raw!==undefined&&(raw.version!==1||raw.owner!==snapshot.owner||!Array.isArray(raw.snapshots)||raw.snapshots.some(s=>s?.owner!==snapshot.owner||typeof s.id!=="string"||!s.state||typeof s.state!=="object")))throw Error("The existing recovery journal could not be verified. Nothing was replaced.");
 const snapshots=readRecoverySnapshots(raw,snapshot.owner);
 // Deduplicate the full workspace except its save timestamp. Different history
 // or settings still merits recovery; no distinct version is evicted.
 const text=recoveryStateSignature(snapshot.state);
 const duplicate=snapshots.find(s=>recoveryStateSignature(s.state)===text);
 if(!duplicate)snapshots.unshift(structuredClone(snapshot));
 return {version:1,owner:snapshot.owner,snapshots};
}
export function recoveryHasContentChanges(local,remote){return workspaceContentSig(local)!==workspaceContentSig(remote);}
export function readSyncBaseline(raw,owner,revision){
 return raw?.owner===owner&&Number.isSafeInteger(raw.revision)&&raw.revision===revision&&raw.state&&typeof raw.state==='object'?structuredClone(raw):null;
}
export function createSyncBaseline(owner,revision,state){
 if(!owner||!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid account sync baseline.');
 return {owner,revision,state:structuredClone(state)};
}
