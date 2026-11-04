// One Power number (0-100, the Collection chip), one Tier word. Bands follow the real spread of
// tournament lists, which bunch near the top: median ~83, lowest quarter ~56-63.
export const POWER_TIERS=[[90,'Top Meta'],[80,'Competitive'],[60,'Tuned'],[0,'Casual']];
export const powerTier=v=>Number.isFinite(v)?POWER_TIERS.find(([min])=>v>=min)[1]:'';
// How the CPU deck compares with yours, from the same two numbers (6 points is a coin flip).
export function fairness(mine,theirs){
 if(!Number.isFinite(mine)||!Number.isFinite(theirs))return '';
 const gap=theirs-mine;return gap>6?'You’re the underdog':gap<-6?'You’re favoured':'Even match';
}
export const matchupLine=m=>{
 if(!m||!Number.isFinite(m.power))return '';
 return [m.wildCard?'Wild Card':'',powerTier(m.power)+' · '+Math.round(m.power),fairness(m.myPower,m.power)].filter(Boolean).join(' · ');
};
