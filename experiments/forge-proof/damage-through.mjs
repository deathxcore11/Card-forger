// While you declare blockers: what gets through right now (table additions 6, the app's rule). The table never predicts
// what Forge has not stated (ruling of 2 Nov): N is only the power of attackers aimed at you that have no blocker.
// Trample, double strike, anything attached to an attacker, unknown power or unknown keywords make it "At least N";
// when that leaves nothing certain (at least 0) there is no chip. In a pod only attacks aimed at you count.
const kwText=k=>typeof k==='string'?k:String(k?.text||k?.keyword||'');
const tramples=c=>(c.keywords||[]).some(k=>/^trample/i.test(kwText(k).trim()));
export function damageThrough(surface){
 if(!surface?.cards||!surface.players)return null;
 const me=surface.players.find(p=>p.seat===surface.seat),field=surface.cards.filter(c=>c.zone==='Battlefield');if(!me)return null;
 const atMe=field.filter(c=>c.attacking&&c.controller!==surface.seat&&(!c.attackTarget||(c.attackTarget.kind==='player'&&c.attackTarget.id===me.nativeId)));
 if(!atMe.length)return null;
 const blocked=new Set(field.filter(c=>c.blocking||(c.blockingIds||[]).length).flatMap(c=>c.blockingIds||[]));
 const open=atMe.filter(c=>!blocked.has(c.id)),power=c=>{const p=Number(c.power);return Number.isFinite(p)?Math.max(0,p):null;};
 const n=open.reduce((s,c)=>s+(power(c)||0),0);
 const unsure=c=>c.keywords===null||c.keywords===undefined||power(c)===null||(c.attachments||[]).length>0||(c.keywords||[]).some(k=>/^(trample|double strike)/i.test(kwText(k).trim()));
 const atLeast=open.some(unsure)||atMe.some(c=>blocked.has(c.id)&&tramples(c));
 if(atLeast&&n===0)return null;
 return {n,atLeast};
}
export function throughText({n,atLeast},life){
 const hurt=n>0;
 return {hurt,atLeast,head:!hurt?'No damage gets through':atLeast?`At least ${n} damage gets through`:`${n} damage gets through`,
  sub:!hurt?`Your life stays at ${life}`:atLeast?`Your life: ${life} → ${life-n} or less`:`Your life: ${life} → ${life-n}`};
}
