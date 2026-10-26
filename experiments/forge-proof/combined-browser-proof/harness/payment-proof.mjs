// Read-only observer of the exact viewer snapshots delivered to the browser.
// This measures the fixed Mimic proof line, never computes legal play or pays.
import assert from 'node:assert/strict';
export const PAYMENT_PROOF_SCHEMA='cardstashy.mimic-payment-browser.v1';
const own=s=>s.players?.find(p=>p.id===s.viewer&&p.isViewer);
const rows=(p,zone)=>p?.zones?.[zone]?.cards||[];
const mana=p=>['W','U','B','R','G','C'].map(k=>p?.mana?.[k]);
const zeroMana=p=>mana(p).every(n=>n===0);
export function createMimicPaymentProof(before,cardId){
 const player=own(before),lands=rows(player,'Battlefield').filter(c=>c.type?.includes('Land'));
 assert.equal(before.controlMode,'smart','payment proof requires original Smart sequence');
 assert.equal(before.busy,false);assert.equal(before.prompt,null);
 assert.equal(before.activePlayer,before.viewer);assert.equal(before.phase,'MAIN1');
 assert.equal(rows(player,'Hand').filter(c=>c.id===cardId&&c.name==='Metallic Mimic').length,1);
 assert.equal(lands.length,2);assert(lands.every(c=>c.tapped===false));assert(zeroMana(player));
 assert(Number.isSafeInteger(before.nativeAutoPayments)&&before.nativeAutoPayments>=0);
 const landIds=new Set(lands.map(c=>c.id)),stackIds=new Set();
 let revision=before.revision,stackPresent=false,stackEntries=0,maxStackCopies=0,castRequests=0,castAccepted=0,resolved=null;
 let autoPayments=0,tappedLands=0,lifeSpent=0;
 const summary=()=>({schema:PAYMENT_PROOF_SCHEMA,seed:20261025,sequence:'saved-keen-mimic-v1',
  controlMode:'smart',stackEntries,uniqueStackItems:stackIds.size,maxStackCopies,castRequests,castAccepted,
  autoPayments,tappedLands,lifeSpent,spellOnBattlefield:resolved!==null,controlsResumed:false,result:'incomplete'});
 return {
  request(body){if(body?.action?.op==='card'&&body.action.id===cardId){castRequests++;assert.equal(castRequests,1,'duplicate Mimic request');}},
  receipt(diagnostic){if(!resolved&&['native creature tap','native creature click'].includes(diagnostic.stage)){
   assert.equal(diagnostic.state,'accepted','Mimic receipt must be bound and accepted');castAccepted++;
   assert.equal(castAccepted,1,'duplicate Mimic acceptance');
  }},
  observe(s){
   if(s.revision<=revision)return;
   assert.equal(s.viewer,before.viewer);revision=s.revision;
   const matches=(s.stack||[]).filter(x=>x.source?.id===cardId);
   maxStackCopies=Math.max(maxStackCopies,matches.length);assert(maxStackCopies<=1,'duplicate stack spell');
   if(matches.length&&!stackPresent)stackEntries++;
   stackPresent=matches.length>0;
   for(const entry of matches){assert(Number.isSafeInteger(entry.id)&&entry.id>=0);stackIds.add(entry.id);}
   assert(stackEntries<=1&&stackIds.size<=1,'Mimic entered the stack more than once');
   autoPayments=s.nativeAutoPayments-before.nativeAutoPayments;
   assert(Number.isSafeInteger(autoPayments)&&autoPayments>=0&&autoPayments<=1,'payment count differs');
   const p=own(s);lifeSpent=player.life-p.life;
   tappedLands=rows(p,'Battlefield').filter(c=>landIds.has(c.id)&&c.tapped===true).length;
  },
  resolve(s){
   this.observe(s);const p=own(s);
   assert.equal(s.turn,before.turn);assert.equal(s.phase,'MAIN1');assert.equal(s.activePlayer,before.viewer);
   assert.equal(s.busy,false);assert.equal(s.prompt,null);assert.equal(stackEntries,1,'stack entry was not observed');
   assert.equal(stackIds.size,1);assert.equal(maxStackCopies,1);assert.equal(castRequests,1);assert.equal(castAccepted,1);
   assert.equal(autoPayments,1);assert.equal(tappedLands,2);assert.equal(lifeSpent,0);assert(zeroMana(p));
   assert.equal(rows(p,'Battlefield').filter(c=>c.id===cardId).length,1);
   assert.equal(rows(p,'Hand').filter(c=>c.id===cardId).length,0);
   assert.equal((s.stack||[]).filter(x=>x.source?.id===cardId).length,0);
   assert.equal(rows(p,'Battlefield').filter(c=>landIds.has(c.id)).length,2);
   resolved=s.revision;return summary();
  },
  finish(s){assert(resolved!==null);this.observe(s);assert(s.revision>resolved&&!s.busy&&!s.prompt);assert.equal(s.controlMode,'smart');
   const p=own(s);assert.equal(s.turn,before.turn);assert.equal(s.phase,'MAIN1');assert.equal(s.activePlayer,before.viewer);
   assert.equal(autoPayments,1);assert.equal(tappedLands,2);assert.equal(lifeSpent,0);assert(zeroMana(p));
   assert.equal(rows(p,'Battlefield').filter(c=>c.id===cardId).length,1);assert.equal((s.stack||[]).filter(x=>x.source?.id===cardId).length,0);
   return {...summary(),controlsResumed:true,result:'passed'};},
  summary,
 };
}
