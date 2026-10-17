import {scanNameKey,ptcgNumbers,mtgCollector,ygoSetCodes} from './scan.js';
export const collectorKey=value=>String(value??'').trim().replace(/^0+(?=\d)/,'').toLowerCase();
export function readScanSignals(g,read={}){
 const header=String(read.name||''),stats=String(read.stats||''),text=header+'\n'+stats+'\n'+String(read.full||'');
 const number=(regex,source=text)=>{const m=source.match(regex);return m?Number(m[1]):null;};
 // Symbols that OCR did not actually read are absent evidence, never an invented mismatch.
 const mana=g==='mtg'?(String(read.mana||header).match(/(?:\{(?:\d+|[WUBRGCSXP]|[WUBRG]\/[WUBRGP]|2\/[WUBRG])\})+/gi)||[]).join('').toUpperCase():'';
 return {hp:g==='ptcg'?number(/\bHP\s*(\d{2,3})\b/i,header)??number(/\b(\d{2,3})\s*HP\b/i,header):null,atk:g==='ygo'?number(/\bATK\s*[/:]?\s*(\d{1,5})(?![\d/])\b/i):null,def:g==='ygo'?number(/\bDEF\s*[/:]?\s*(\d{1,5})(?![\d/])\b/i):null,level:g==='ygo'?number(/\b(?:LEVEL|LV[.]?)\s*[:/]?\s*(\d{1,2})\b/i,header+'\n'+String(read.level||'')):null,stage:g==='ptcg'?header.match(/\b(STAGE\s*[12]|BASIC)\b/i)?.[1]?.replace(/\s/g,'').toLowerCase()||'':'',mana,pt:g==='mtg'?stats.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/)?.slice(1).map(Number):null,text};
}
export function signalEvidence(g,card,read={}){
 const s=readScanSignals(g,read),conflicts=[],agrees=[],numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 for(const [field,label] of [['hp','HP'],['atk','ATK'],['def','DEF'],['level','level']])if(s[field]!==null&&numeric(card?.[field])){if(s[field]!==Number(card[field]))conflicts.push(label);else agrees.push(label);}
 if(s.pt&&numeric(card?.power)&&numeric(card?.toughness)){if(s.pt[0]!==Number(card.power)||s.pt[1]!==Number(card.toughness))conflicts.push('power/toughness');else agrees.push('power/toughness');}
 if(s.stage&&card?.stage){if(s.stage!==String(card.stage).replace(/\s/g,'').toLowerCase())conflicts.push('stage');else agrees.push('stage');}
 if(s.mana&&card?.mana_cost){if(s.mana!==String(card.mana_cost).toUpperCase())conflicts.push('mana cost');else agrees.push('mana cost');}
 const code=String(read.code||'')+'\n'+String(read.full||'');
 if(g==='ptcg'){const ns=ptcgNumbers(code);if(ns.length&&card?.set?.number&&card?.set?.total){if(!ns.some(n=>collectorKey(n.num)===collectorKey(card.set.number)&&Number(n.total)===Number(card.set.total)))conflicts.push('collector number');else agrees.push('collector number');}}
 if(g==='mtg'){const c=mtgCollector(code);if(c&&card?.set&&card?.collector_number){if(c.set!==card.set||collectorKey(c.number)!==collectorKey(card.collector_number))conflicts.push('set / collector number');else agrees.push('set / collector number');}}
 if(g==='ygo'){
  const ids=String(read.code||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>/^\d{8}$/.test(x));
  if(ids.length&&/^\d+$/.test(String(card?.id||''))){if(!ids.some(x=>Number(x)===Number(card.id)))conflicts.push('passcode');else agrees.push('passcode');}
 }
 const attacks=[...new Set([...(card?.attackNames||[]),...(card?.attacks||[]).map(x=>x.name)])];
 for(const name of attacks)if(scanNameKey(name).length>=5&&scanNameKey(s.text).includes(scanNameKey(name)))agrees.push('attack '+name);
 return {conflicts,agrees,score:agrees.length*20};
}
export function rankScanCandidates(g,cands,read={}){
 return cands.map(c=>{const e=signalEvidence(g,c.card,read),codes=g==='ygo'?ygoSetCodes(`${read.code||''}\n${read.full||''}`):[];if(codes.length&&c.print&&!codes.includes(c.print.split('|')[0]))e.conflicts.push('set code');return {c,e};}).filter(x=>!x.e.conflicts.length).sort((a,b)=>b.e.score-a.e.score).map(({c,e})=>({...c,why:e.agrees.length?`${e.agrees.join(' + ')} agree · ${c.exact?'check finish and edition':'check printing'}`:c.why,signalMatches:e.agrees}));
}
// Bounded edit distance is a suggestion tool; fuzzy names alone never verify a printing.
export function nameDistance(a,b,limit=2){a=scanNameKey(a);b=scanNameKey(b);if(Math.abs(a.length-b.length)>limit)return limit+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(Math.min(...row)>limit)return limit+1;prev=row;}return prev[b.length];}
