import {readFile,writeFile} from 'node:fs/promises';
import {parsePlayDeckImport} from '../../cardstashy/play-deck-import.js';
const root=new URL('../',import.meta.url),here=new URL('./fixtures/',import.meta.url);
const humanDeck=JSON.parse(await readFile(new URL('existing-calling-all-angels.json',here),'utf8'));
let section='',lines=[];
for(const raw of (await readFile(new URL('decks/keen-engineering.dck',root),'utf8')).split(/\r?\n/)){
 if(raw==='[Commander]'){section='commander';lines.push('Commander');continue;}
 if(raw==='[Main]'){section='main';lines.push('Deck');continue;}
 if(section&&/^\d+ /.test(raw))lines.push(raw.split('|')[0]);
}
const imported=parsePlayDeckImport(lines.join('\n'));
if(imported.errors.length)throw Error(JSON.stringify(imported.errors));
const opponentDeck={...imported,id:'existing-import-fixture',name:'Keen Engineering existing Play import',format:'Commander'};
const input={format:'Commander',humanDeck,opponentDeck,difficultyPolicyVersion:'forge-default-smart-v1'};
await writeFile(new URL('bootstrap-existing.json',here),JSON.stringify({input},null,2));
console.log('Existing saved fixture + actual existing parsePlayDeckImport result:',humanDeck.cards.reduce((s,r)=>s+r.qty,0),opponentDeck.cards.reduce((s,r)=>s+r.qty,0),'copies; no new parser/model.');
