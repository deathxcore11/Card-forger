// Presentation of rules-authoritative values. Never add counters to P/T again,
// subtract marked damage from toughness, or guess when an effect expires.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const tone=(value,base)=>!finite(value)||!finite(base)?'neutral':value>base?'increased':value<base?'decreased':'neutral';
const labels={P1P1:'+1/+1',Plus1Plus1:'+1/+1',M1M1:'−1/−1',Minus1Minus1:'−1/−1','-1/-1':'−1/−1'};
export function cardStatView(card){
 if(card?.known!==true)return null;
 const counters=Object.entries(card.counters||{}).filter(([name,count])=>name.length<=80&&Number.isSafeInteger(count)&&count>0).map(([name,count])=>({name,label:labels[name]||name,count,tone:['P1P1','Plus1Plus1','+1/+1'].includes(name)?'increased':['M1M1','Minus1Minus1','-1/-1'].includes(name)?'decreased':'neutral'})).sort((a,b)=>a.name.localeCompare(b.name));
 return {power:finite(card.power)?card.power:null,toughness:finite(card.toughness)?card.toughness:null,
  basePower:finite(card.basePower)?card.basePower:null,baseToughness:finite(card.baseToughness)?card.baseToughness:null,
  powerTone:tone(card.power,card.basePower),toughnessTone:tone(card.toughness,card.baseToughness),
  token:card.isToken===true,emblem:card.isEmblem===true,tapped:card.tapped===true,
  damage:finite(card.damage)&&card.damage>0?card.damage:0,counters};
}
