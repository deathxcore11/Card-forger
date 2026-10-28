import {pokemonTitleReadings,pokemonTitleLine,shortTrainerNames,pokemonTitleLabel,scanNameKey,scanCardNameKey,ptcgNumberReadings,ptcgNumberMatches,ptcgIdentifierKey,scanCollectorKey,mtgIdentifierEvidence,ygoCodeReadings,ygoPasscodes} from './scan.js';
import {pokemonTrainerSubtitle,pokemonIdentityNames} from './pokemon-identity.js';
export const collectorKey=value=>String(value??'').trim().replace(/^0+(?=\d)/,'').toLowerCase();
// Evidence is independent of which observations happen to exist in the local
// catalogue. One known reading plus a different unknown reading is still a conflict.
export function scanIdentifierEvidence(g,read={}){
 const sources=[String(read.code||''),String(read.full||'')];
 if(g==='mtg'){const evidence=mtgIdentifierEvidence(read.code,read.full);return {...evidence,identifierConflict:evidence.observations.length>1};}
 if(g==='ptcg'){const readings=sources.flatMap(ptcgNumberReadings),observations=[...new Map(readings.map(({num,total})=>[ptcgIdentifierKey(num,total)||scanCollectorKey(num)+'/'+scanCollectorKey(total),{num,total}])).values()];return {observations,readings,identifierUncertain:readings.some(r=>r.corrected),identifierConflict:observations.length>1};}
 const readings=[...new Map(sources.flatMap(ygoCodeReadings).map(r=>[r.raw,r])).values()],observations=[...new Set(readings.map(r=>r.code))],passcodes=[...new Set(sources.flatMap(ygoPasscodes))];
 return {observations,readings,passcodes,identifierUncertain:readings.some(r=>r.corrected),identifierConflict:readings.length>1||passcodes.length>1};
}
export function readScanSignals(g,read={}){
 const header=String(read.name||''),stats=String(read.stats||''),text=header+'\n'+stats+'\n'+String(read.full||'');
 const number=(regex,source=text)=>{const m=source.match(regex);return m?Number(m[1]):null;};
 // The detail crop includes rules text, so an inline "create a 1/1 ... token"
 // is not this card's power/toughness. Only an isolated, unambiguous stat line
 // can veto a candidate; absent or conflicting standalone fractions are unknown.
 const pts=g==='mtg'?[...new Map([...stats.matchAll(/^[ \t]*(\d{1,2})[ \t]*\/[ \t]*(\d{1,2})[ \t]*\r?$/gm)].map(m=>[m[1]+'/'+m[2],m.slice(1).map(Number)])).values()]:[];
 // Symbols that OCR did not actually read are absent evidence, never an invented mismatch.
 const mana=g==='mtg'?(String(read.mana||header).match(/(?:\{(?:\d+|[WUBRGCSXP]|[WUBRG]\/[WUBRGP]|2\/[WUBRG])\})+/gi)||[]).join('').toUpperCase():'';
 return {hp:g==='ptcg'?number(/\bHP\s*(\d{2,3})\b/i,header)??number(/\b(\d{2,3})\s*HP\b/i,header):null,atk:g==='ygo'?number(/\bATK\s*[/:]?\s*(\d{1,5})(?![\d/])\b/i):null,def:g==='ygo'?number(/\bDEF\s*[/:]?\s*(\d{1,5})(?![\d/])\b/i):null,level:g==='ygo'?number(/\b(?:LEVEL|LV[.]?)\s*[:/]?\s*(\d{1,2})\b/i,header+'\n'+String(read.level||'')):null,stage:g==='ptcg'?header.match(/\b(STAGE\s*[12]|BASIC)\b/i)?.[1]?.replace(/\s/g,'').toLowerCase()||'':'',mana,pt:pts.length===1?pts[0]:null,text};
}
// Keep primary title readings separate from search substrings and from rules/footer
// hints. A fuzzy search hit is not evidence that a different printed title agrees.
export function scanTitleEvidence(g,card,read={}){
 const canonical=String(card?.name||''),nameKey=n=>scanCardNameKey(g,n),subtitle=g==='ptcg'?scanNameKey(pokemonTrainerSubtitle(canonical)):'',faces=[...(g==='ptcg'?pokemonIdentityNames(card):[canonical]),...(card?.card_faces||[]).map(c=>c.name),...canonical.split(/\s+\/\/\s+/)].map(nameKey).filter(Boolean);
 const observations=Array.isArray(read.titles)&&read.titles.length?read.titles:[{text:String(read.name||''),source:'title',confidence:null}];
 const primary=[],weak=[];
 // Recognition already caps observations; never discard a later contradictory title.
 for(const observation of observations){
  const lines=String(observation.text||'').split(/\r?\n/).map(line=>line.replace(/\{[^}]*\}/g,'')).map(line=>g==='ptcg'?pokemonTitleLine(line):line.trim()).map(line=>g==='ptcg'?(pokemonTitleReadings(line).find(n=>faces.includes(nameKey(n)))||line):line).filter(line=>!(g==='ptcg'&&pokemonTitleLabel(line))).filter(line=>!subtitle||scanNameKey(line)!==subtitle)
   .filter(line=>line&&!/^(?:BASIC|STAGE\s*[12]|HP\s*\d+|\d+\s*HP|TRAINER|ITEM|SUPPORTER|STADIUM|INSTANT|SORCERY|LAND|SPELL CARD|TRAP CARD)\W*$/i.test(line)&&!/^evolves from\b|^©|^copyright|^illus\b|^ATK\b|^DEF\b|^\[/i.test(line)&&(faces.includes(nameKey(line))||!(g==='mtg'?/^(?:legendary|creature|artifact|enchantment|planeswalker|battle)\b/i:g==='ygo'?/^(?:DARK|LIGHT|EARTH|FIRE|WATER|WIND|DIVINE|LEVEL\s*\d+)$/i:/^(?:weakness|resistance|retreat|ability)$/i).test(line)));
  const combined=nameKey(lines.join(' ')),strong=observation.source!=='full-hint'&&observation.source!=='orientation'&&(observation.confidence==null||observation.confidence>=70);
  // Wrapped titles and split-card faces are one observation. Keep meaningful
  // digits, slashes, qualifiers and suffixes; fuzzy search fragments never count.
  if(lines.length&&faces.includes(combined)&&(g!=='ptcg'||combined.length>=3||shortTrainerNames(read).some(n=>nameKey(n)===combined))){(strong?primary:weak).push(combined);continue;}
  for(const line of lines){
   const clean=(/^[A-Za-zÀ-ž][A-Za-zÀ-ž0-9 ,'’.:!&/–—-]*$/.test(line)||(g==='ptcg'&&/^(?:Nidoran\s*[♀♂]|Unown\s*[!?])$/i.test(line)))&&(!/[A-Za-z]\d|\d[A-Za-z]/.test(line)||faces.includes(nameKey(line))),key=nameKey(line);if(!key||(key.length<3&&!(g==='ptcg'&&(/^(?:n|az)$/.test(nameKey(canonical))||shortTrainerNames({...read,name:line}).some(n=>nameKey(n)===key)))))continue;
   (strong&&clean?primary:weak).push(key);
  }
 }
 const known=[...new Set(primary)],matches=known.filter(n=>faces.includes(n)),incompatible=known.filter(n=>!faces.includes(n));
 return {exactMatch:matches.length>0,weakMatch:weak.some(n=>faces.includes(n)),nameConflict:incompatible.length>0,titleConflict:matches.length>0&&incompatible.length>0,observations:known.length,weakObservations:weak.length};
}
export function signalEvidence(g,card,read={}){
 const s=readScanSignals(g,read),conflicts=[],agrees=[],header=[read.name||'',...(read.titles||[]).map(t=>t.text||'')].join('\n'),hpReadings=g==='ptcg'?[...new Set([...header.matchAll(/\bHP\s*(\d{2,3})\b|\b(\d{2,3})\s*HP\b/gi)].map(m=>Number(m[1]||m[2])))]:[],stages=g==='ptcg'?[...new Set([...header.matchAll(/\b(STAGE\s*[12]|BASIC)\b/gi)].map(m=>m[1].replace(/\s/g,'').toLowerCase()))]:[],signalConflict=hpReadings.length>1||stages.length>1,numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 for(const [field,label] of [['hp','HP'],['atk','ATK'],['def','DEF'],['level','level']])if(s[field]!==null&&numeric(card?.[field])){if(field==='hp'&&hpReadings.length? !hpReadings.includes(Number(card[field])):s[field]!==Number(card[field]))conflicts.push(label);else agrees.push(label);}
 if(s.pt&&numeric(card?.power)&&numeric(card?.toughness)){if(s.pt[0]!==Number(card.power)||s.pt[1]!==Number(card.toughness))conflicts.push('power/toughness');else agrees.push('power/toughness');}
 if(s.stage&&card?.stage){if(!stages.includes(String(card.stage).replace(/\s/g,'').toLowerCase()))conflicts.push('stage');else agrees.push('stage');}
 if(s.mana&&card?.mana_cost){if(s.mana!==String(card.mana_cost).toUpperCase())conflicts.push('mana cost');else agrees.push('mana cost');}
 const {observations,passcodes=[],identifierConflict,identifierUncertain=false}=scanIdentifierEvidence(g,read);
 if(read.game&&read.game!==g)conflicts.push('game');
 if(g==='ptcg'&&read.setId&&card?.set?.id&&String(read.setId)!==String(card.set.id))conflicts.push('set');
 if(g==='ptcg'){if(observations.length&&card?.set?.number&&card?.set?.total){if(!observations.some(n=>ptcgNumberMatches(card,n)))conflicts.push('collector number');else agrees.push('collector number');}}
 if(g==='mtg'){if(observations.length&&card?.set&&card?.collector_number){if(!observations.some(c=>c.set===String(card.set).toLowerCase()&&collectorKey(c.number)===collectorKey(card.collector_number)))conflicts.push('set / collector number');else agrees.push('set / collector number');}}
 if(g==='ygo'){
  const ids=passcodes;
  if(ids.length&&/^\d+$/.test(String(card?.id||''))){if(!ids.some(x=>Number(x)===Number(card.id)))conflicts.push('passcode');else agrees.push('passcode');}
 }
 const attacks=[...new Set([...(card?.attackNames||[]),...(card?.attacks||[]).map(x=>x.name)])];
 for(const name of attacks)if(scanNameKey(name).length>=5&&scanNameKey(s.text).includes(scanNameKey(name)))agrees.push('attack '+name);
 const title=scanTitleEvidence(g,card,read);
 return {conflicts,agrees,score:agrees.length*20+(title.exactMatch?30:0),identifierConflict,identifierUncertain,signalConflict,...title};
}
export function rankScanCandidates(g,cands,read={}){
 const ranked=cands.map(c=>{const e=signalEvidence(g,{...c.card,name:c.card?.name||c.name},read),codes=g==='ygo'?scanIdentifierEvidence(g,read).observations:[];if(codes.length&&c.print&&!codes.includes(c.print.split('|')[0]))e.conflicts.push('set code');return {c,e};});
 const supported=ranked.some(({e})=>e.exactMatch&&!e.conflicts.length);
 // Printings narrowed by a partly readable footer may disagree with a garbled
 // code ("FON" for FDN, "KIC0" for KICO). Only footer conflicts are tolerated,
 // only for an exact title or when no title was read, and only as review:
 // identifierConflict keeps them from verifying.
 const footerOnly=(c,e)=>c.footerNarrowed===true&&(e.exactMatch||e.observations===0)&&!e.nameConflict&&!e.signalConflict&&e.conflicts.every(x=>x==='collector number'||x==='set / collector number'||x==='set code');
 return ranked.filter(({c,e})=>(!e.conflicts.length||footerOnly(c,e))&&(!supported||!e.nameConflict||e.exactMatch||c.identitySource==='artwork'))
 .sort((a,b)=>b.e.score-a.e.score).map(({c,e})=>{
  if(e.conflicts.length)return {...c,exact:false,identifierConflict:true,why:`${c.why} · printed code read differently`,signalMatches:e.agrees};
  const identityConflict=e.nameConflict||c.identityConflict===true,conflict=e.identifierConflict||e.identifierUncertain||identityConflict||e.signalConflict;
  return {...c,exact:conflict?false:c.exact,...(e.identifierConflict?{identifierConflict:true}:{}),...(e.identifierUncertain?{identifierUncertain:true}:{}),...(e.signalConflict?{signalConflict:true}:{}),...(identityConflict?{identityConflict:true}:{}),why:e.signalConflict?'Conflicting printed stats · check card identity':e.identifierConflict?'Conflicting printed identifiers · check printing'+(identityConflict?' and card identity':''):e.identifierUncertain?'Uncertain printed characters · check the full code':identityConflict?'Conflicting title evidence · check card identity':e.agrees.length?`${e.agrees.join(' + ')} agree · ${c.exact?'check finish and edition':'check printing'}`:c.why,signalMatches:e.agrees};
 });
}
// Bounded edit distance is a suggestion tool; fuzzy names alone never verify a printing.
export function nameDistance(a,b,limit=2){a=scanNameKey(a);b=scanNameKey(b);if(Math.abs(a.length-b.length)>limit)return limit+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(Math.min(...row)>limit)return limit+1;prev=row;}return prev[b.length];}
