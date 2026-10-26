// Deliberately small, deterministic research policy. Does not receive engine state.
// Scores permitted summaries only; no claim of Commander/competitive strength.
export const CPU_POLICY_VERSION='visible-tactics-v2';
const n=v=>Number.isFinite(v)?v:0;
export function cpuPacket(view,actions){
 const known=new Map(view.cards.filter(c=>c.known).map(c=>[c.id,c]));
 const own=id=>{const c=known.get(id);return c?.controller===view.seat&&['Hand','Battlefield','Graveyard','Exile','Command','Stack'].includes(c.zone)?c:null;};
 const publicCard=id=>{const c=known.get(id);return c&&['Battlefield','Stack','Graveyard','Exile','Command'].includes(c.zone)?c:null;};
 const creature=c=>c?{power:n(c.power),toughness:n(c.toughness),damage:n(c.damage),tapped:c.tapped===true,keywords:[...(c.keywords||[])].sort()}:null;
 return {version:CPU_POLICY_VERSION,ownLife:n(view.players.find(p=>p.seat===view.seat)?.life),opponentLife:n(view.players.find(p=>p.seat!==view.seat)?.life),
  ownBattlefield:view.cards.filter(c=>c.zone==='Battlefield'&&c.controller===view.seat&&c.known).map(creature),
  opponentBattlefield:view.cards.filter(c=>c.zone==='Battlefield'&&c.controller!==view.seat&&c.known).map(creature),
  choices:actions.map(a=>{
   const data=a.data||{},c=own(data.object_id);
   if(a.type==='PassPriority')return {kind:'pass'};
   if(a.type==='PlayLand')return {kind:'land',available:!!c&&c.zone==='Hand'};
   if(a.type==='CastSpell')return {kind:'cast',card:creature(c),available:!!c};
   if(a.type==='MulliganDecision')return {kind:'mulligan',keep:data.choice?.type==='Keep'};
   if(a.type==='DeclareAttackers')return {kind:'attack',attackers:(data.attacks||[]).map(row=>creature(own(row[0])))};
   if(a.type==='DeclareBlockers')return {kind:'block',blocks:(data.assignments||[]).map(row=>({blocker:creature(own(row[0])),attacker:creature(publicCard(row[1]))}))};
   if(a.type==='AssignCombatDamage')return {kind:'combatDamage',toPlayer:n(data.trample_damage)+n(data.controller_damage),toCreatures:(data.assignments||[]).map(([id,amount])=>({amount:n(amount),creature:creature(publicCard(id))}))};
   if(a.type==='ChooseLegend')return {kind:'legend',card:creature(own(data.keep)),available:own(data.keep)?.zone==='Battlefield'};
   return {kind:'unsupported'};
  })};
}
export function chooseVisible(packet,rng){
 if(packet?.version!==CPU_POLICY_VERSION||!Array.isArray(packet.choices)||!packet.choices.length)throw Error('INVALID_CPU_PACKET');
 // This initial policy is suitable only for the land/creature research fixture.
 // Unsupported decision types stop instead of making a strategically blind choice.
 let best=-Infinity,index=-1;
 const threats=(packet.opponentBattlefield||[]).filter(c=>!c.tapped);
 for(const [i,c]of packet.choices.entries()){
  let score=-Infinity;
  if(c.kind==='pass')score=0;
  if(c.kind==='land'&&c.available)score=100;
  if(c.kind==='cast'&&c.available)score=50+n(c.card?.power)+n(c.card?.toughness);
  if(c.kind==='mulligan')score=c.keep?10:0;
  if(c.kind==='combatDamage')score=4*n(c.toPlayer)+(c.toCreatures||[]).reduce((sum,r)=>sum+Math.min(n(r.amount),Math.max(0,n(r.creature?.toughness)-n(r.creature?.damage))),0);
  if(c.kind==='legend'&&c.available)score=n(c.card?.power)+n(c.card?.toughness)-n(c.card?.damage)+(c.card?.tapped?0:1);
  if(c.kind==='attack')score=c.attackers.reduce((sum,a)=>{
   if(!a)return -Infinity;
   const power=n(a.power),tough=n(a.toughness)-n(a.damage);
   const canKill=threats.some(b=>n(b.power)>=tough);
   const canTrade=threats.some(b=>n(b.power)>=tough&&n(b.toughness)>power);
   return sum+power*(threats.length?1:3)-(canTrade?power+3:canKill?1:0);
  },0);
  if(c.kind==='block')score=c.blocks.reduce((sum,{blocker:b,attacker:a})=>{
   if(!a||!b)return -Infinity;
   return sum+n(a.power)+(n(b.power)>=n(a.toughness)?4:0)-(n(a.power)>=n(b.toughness)?n(b.power)+n(b.toughness):0);
  },0);
  if(score>best){best=score;index=i;}
 }
 if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');
 return {index,rng:rng>>>0};
}
