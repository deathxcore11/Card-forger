// Run only after reviewing the official guidance/list update. Never changes
// policy dates based solely on an API retrieval date.
import {writeFile} from 'node:fs/promises';
const [guidanceDate,listDate,guidanceOverride,listOverride]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(guidanceDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(listDate||''))throw Error('Usage: node scripts/update-commander-evidence.mjs GUIDANCE_DATE LIST_DATE (review official sources first)');
if((guidanceDate!=='2025-10-21'||listDate!=='2026-02-09')&&(!guidanceOverride||!listOverride))throw Error('New policy dates require both reviewed official source URLs as extra arguments.');
for(const url of [guidanceOverride,listOverride].filter(Boolean))if(new URL(url).origin!=='https://magic.wizards.com')throw Error('Use reviewed official Wizards source URLs.');
const source='https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards',cards=new Map();
let url=source;
for(let page=0;url&&page<5;page++){
 if(new URL(url).origin!=='https://api.scryfall.com')throw Error('Unexpected pagination origin.');
 const response=await fetch(url,{headers:{'User-Agent':'CardStashy-Commander-Evidence/1.0','Accept':'application/json'}});
 if(!response.ok)throw Error('Game Changer refresh failed: '+response.status);
 const body=await response.json();if(!Array.isArray(body.data)||body.data.some(c=>!c.oracle_id||!c.name||c.game_changer!==true))throw Error('Incomplete membership data; snapshot kept.');
 for(const c of body.data)cards.set(c.oracle_id,{oracleId:c.oracle_id,name:c.name});
 url=body.has_more?body.next_page:null;if(url)await new Promise(r=>setTimeout(r,150));
}
if(url||cards.size<1)throw Error('Incomplete membership response; snapshot kept.');
const snapshot={version:'game-changers-'+listDate,guidanceDate,listDate,retrievedAt:new Date().toISOString().slice(0,10),source,guidanceUrl:guidanceOverride||'https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025',listUrl:listOverride||'https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026',cards:[...cards.values()].sort((a,b)=>a.name.localeCompare(b.name))};
await writeFile(new URL('../game-changers.js',import.meta.url),'// Dated Oracle-identity membership snapshot. Review policy separately.\nexport const GAME_CHANGER_SNAPSHOT=Object.freeze('+JSON.stringify(snapshot,null,2)+');\n');
console.log('Updated '+cards.size+' Oracle identities. Review source URLs and the diff before release.');
