// Rules text on the table names the player and the CPU's deck, never Forge's seat names (Randall, 10 Nov):
// "CardStashy's Commander" reads "<your name>'s Commander", "Forge AI — Limit Break" reads "Limit Break".
import assert from 'node:assert/strict';
import {projectForge,SCHEMA} from './experiments/forge-proof/forge-session.mjs';
const card=(id,owner,text,zone='Battlefield')=>({id,owner,controller:owner,name:'Gisa and Geralf',type:'Legendary Creature',text,zone,hidden:false});
const raw=(text)=>({schema:SCHEMA,revision:5,viewer:1,status:'running',players:[
 {id:1,name:'CardStashy',isViewer:true,life:35,zones:{Battlefield:{cards:[card(10,1,text)]},Hand:{count:0},Library:{count:40}}},
 {id:2,name:'Forge AI — Limit Break',life:18,zones:{Battlefield:{cards:[card(11,2,"Forge AI — Limit Break's Commander")]},Hand:{count:6},Library:{count:40}}}],stack:[]});
const text="CardStashy's Commander\nCast from command zone 1 times\nCommander damage to Forge AI — Limit Break from Gisa and Geralf: 12";
let p;try{p=projectForge(raw(text),{selfName:'ldwd11'});}catch(e){console.log('fixture shape not accepted:',e.message);process.exit(1);}
const all=JSON.stringify(p);
assert.ok(!/CardStashy/.test(all.replace(/"name":"CardStashy"/g,'')),'no engine seat name for you in card text');
const mine=p.surface?.cards?.find(c=>c.id===10)||[...(p.cards?.values?.()||[])].find(c=>c.id===10);
const cpu=p.surface?.cards?.find(c=>c.id===11);
console.log(mine?.text,'|',cpu?.text);
assert.match(mine.text,/^ldwd11's Commander/);assert.match(mine.text,/Commander damage to Limit Break from Gisa and Geralf: 12/);
assert.equal(cpu.text,"Limit Break's Commander");
console.log('forge seat names: ok');
