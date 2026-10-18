// Account workspaces are separate durable records, including artwork and recovery.
// The active record remains compatible with older backups; switching is atomic.
export const ACCOUNT_OWNER = 'cardstashy-workspace-owner-v1';
export const LEGACY_ARCHIVE = 'cardstashy-before-account-isolation-v1';
export const accountRecord = owner => 'cardstashy-workspace-v1:' + (owner || 'guest');
export function createAccountWorkspaces({read,write,getState,blank,normalize,storage,recovery}) {
 let owner, initialized=false,baseline=null;
 return {
  get owner(){return owner;},
  get guard(){if(!initialized)return null;const captured=baseline,capturedOwner=owner;return {key:ACCOUNT_OWNER,get value(){return owner===capturedOwner?baseline:captured;},advance:true,onCommit:next=>{if(owner===capturedOwner)baseline=next;}};},
  async current(){return initialized && JSON.stringify(await read(ACCOUNT_OWNER))===JSON.stringify(baseline);},
  async switchTo(nextOwner,meta){
   nextOwner ||= null;
   const marker=await read(ACCOUNT_OWNER);
   // Older releases have only a sync baseline. It is ownership evidence, never
   // permission to copy that workspace into whichever account next signs in.
   const previous=initialized?owner:(marker?.owner || meta?.userId || null);
   if(initialized && JSON.stringify(marker)!==JSON.stringify(baseline))throw Error('The account changed in another tab. Reload CardStashy to continue.');
   const current={state:structuredClone(initialized?getState():await read(storage)||getState()),recovery:await read(recovery),meta:marker&&meta?.userId===previous?meta:null};
   const archive=!marker && !await read(LEGACY_ARCHIVE)?{...current,previousSyncOwner:meta?.userId||null,at:new Date().toISOString()}:null;
   const target=previous===nextOwner?current:await read(accountRecord(nextOwner));
   const state=normalize(structuredClone(target?.state || blank()));
   if(previous===nextOwner && marker && Number.isSafeInteger(marker.revision)){owner=nextOwner;baseline=marker;initialized=true;return {state,previous,meta:target?.meta?.userId===nextOwner?target.meta:null};}
   const nextMarker={owner:nextOwner,revision:(Number(marker?.revision)||0)+1};
   await write([
    ...(archive?[[LEGACY_ARCHIVE,archive]]:[]),
    [accountRecord(previous),current],
    [storage,state],
    [recovery,target?.recovery || blank()],
    [ACCOUNT_OWNER,nextMarker],
   ],{guardRecord:{key:ACCOUNT_OWNER,value:marker}});
   owner=nextOwner;baseline=nextMarker;initialized=true;
   return {state,previous,migrationBackup:archive?.state,meta:target?.meta?.userId===nextOwner?target.meta:null};
  },
  async eraseArchived(id){
   if(!id||id===owner)throw Error('Sign out of that account before removing its archived workspace.');
   await write([[accountRecord(id),{state:blank(),recovery:blank(),meta:null}]],{guardRecord:this.guard});
  },
  async guest(){return (await read(accountRecord(null)))?.state || null;},
 };
}
