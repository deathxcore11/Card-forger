import {scanNameKey,ptcgNumbers,mtgCollector,ygoSetCodes} from './scan.js';
export function readScanSignals(g,read={}){
 const header=String(read.name||''),stats=String(read.stats||''),text=header+'\n'+stats+'\n'+String(read.full||'');
 const number=(regex,source=text)=>{const m=source.match(regex);return m?Number(m[1]):null;};
 return {hp:g==='ptcg'?number(/\bHP\s*(\d{2,3})\b/i,header)??number(/\b(\d{2,3})\s*HP\b/i,header):null,atk:g==='ygo'?number(/\bATK\s*[/:]?\s*(\d{1,5})(?![\d/])\b/i):null,def:g==='ygo'?number(/\bDEF\s*[/:]?\s*(\d{1,5})(?![\d/])\b/i):null,pt:g==='mtg'?stats.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/)?.slice(1).map(Number):null,text};
}
export function signalEvidence(g,card,read={}){
 const s=readScanSignals(g,read),conflicts=[],agrees=[];
 for(const [field,label] of [['hp','HP'],['atk','ATK'],['def','DEF']])if(s[field]!==null&&card?.[field]!==undefined&&Number.isFinite(Number(card[field]))){if(s[field]!==Number(card[field]))conflicts.push(label);else agrees.push(label);}
 if(s.pt&&Number.isFinite(Number(card?.power))&&Number.isFinite(Number(card?.toughness))){if(s.pt[0]!==Number(card.power)||s.pt[1]!==Number(card.toughness))conflicts.push('power/toughness');else agrees.push('power/toughness');}
 const code=String(read.code||'')+'\n'+String(read.full||'');
 if(g==='ptcg'){const ns=ptcgNumbers(code);if(ns.length&&card?.set?.number&&card?.set?.total){if(!ns.some(n=>Number(n.num)===Number(card.set.number)&&Number(n.total)===Number(card.set.total)))conflicts.push('collector number');else agrees.push('collector number');}}
 if(g==='mtg'){const c=mtgCollector(code);if(c&&card?.set&&card?.collector_number){if(c.set!==card.set||Number(c.number)!==Number(card.collector_number))conflicts.push('set / collector number');else agrees.push('set / collector number');}}
 for(const name of card?.attackNames||[])if(scanNameKey(name).length>=5&&scanNameKey(s.text).includes(scanNameKey(name)))agrees.push('attack '+name);
 return {conflicts,agrees,score:agrees.length*20};
}
export function rankScanCandidates(g,cands,read={}){
 return cands.map(c=>({c,e:signalEvidence(g,c.card,read)})).filter(x=>!x.e.conflicts.length).sort((a,b)=>b.e.score-a.e.score).map(({c,e})=>({...c,why:e.agrees.length?`${e.agrees.join(' + ')} agree · ${c.exact?'check finish and edition':'check printing'}`:c.why,signalMatches:e.agrees}));
}
// Bounded edit distance is a suggestion tool; fuzzy names alone never verify a printing.
export function nameDistance(a,b,limit=2){a=scanNameKey(a);b=scanNameKey(b);if(Math.abs(a.length-b.length)>limit)return limit+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(Math.min(...row)>limit)return limit+1;prev=row;}return prev[b.length];}
