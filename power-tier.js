// The real game's own words. Constructed: the meta's Tier 1 / 2 / 3 (plus Casual) from the one Power
// number (0-100, the Collection chip); tournament lists bunch near the top, median ~83, lowest quarter ~56-63.
// Commander: the official Brackets 1-5 (extras.js bracketEstimate), never a made-up tier.
export const POWER_TIERS=[[90,'Tier 1'],[80,'Tier 2'],[60,'Tier 3'],[0,'Casual']];
export const BRACKET_NAMES={1:'Exhibition',2:'Core',3:'Upgraded',4:'Optimized',5:'cEDH'};
export const powerTier=v=>Number.isFinite(v)?POWER_TIERS.find(([min])=>v>=min)[1]:'';
export const bracketLabel=b=>Number.isInteger(b)&&BRACKET_NAMES[b]?'Bracket '+b:'';
// How the CPU deck compares with yours, from the same two numbers (6 points is a coin flip).
export function fairness(mine,theirs){
 if(!Number.isFinite(mine)||!Number.isFinite(theirs))return '';
 const gap=theirs-mine;return gap>6?'You’re the underdog':gap<-6?'You’re favoured':'Even match';
}
export const matchupLine=m=>{
 if(!m||!Number.isFinite(m.power))return '';
 const label=bracketLabel(m.bracket)?bracketLabel(m.bracket)+' '+BRACKET_NAMES[m.bracket]:powerTier(m.power);
 return [m.wildCard?'Wild Card':'',label+' · '+Math.round(m.power),fairness(m.myPower,m.power)].filter(Boolean).join(' · ');
};
