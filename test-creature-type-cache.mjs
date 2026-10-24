import assert from 'node:assert/strict';
import {creatureTypes,CREATURE_THEMES} from './planner.js';
import {typeText} from './core.js';
const escapePattern=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function original(c){const lines=c?.card_faces?.length?c.card_faces.map(f=>f.type_line||''):typeText(c).split(' // ');return [...new Set(lines.filter(t=>/\b(?:Creature|Kindred|Tribal)\b/.test(t)).flatMap(t=>{const suffix=(t.split('—')[1]||'').trim();return CREATURE_THEMES.filter(type=>new RegExp('(?:^|\\s)'+escapePattern(type)+'(?:$|\\s)').test(suffix));}))];}
for(const type of CREATURE_THEMES)for(const prefix of ['Creature','Kindred Sorcery','Tribal Enchantment']){
 const c={type_line:prefix+' — '+type};assert.deepEqual(creatureTypes(c),original(c),'Exact provider subtype '+type);
}
for(const c of [null,{}, {type_line:'Artifact — Equipment'},{type_line:'Creature — Goblin Wizard'}, {type_line:'Creature — Time Lord'}, {type_line:'Creature — Goblinish'}, {type_line:'Creature — Goblin\tWizard'}, {type_line:'Creature — Goblin // Creature — Elf'}, {type_line:'Creature',card_faces:[{type_line:'Creature — Goblin Wizard'},{type_line:'Creature — Elf Wizard'}]}])assert.deepEqual(creatureTypes(c),original(c));
const mutable={type_line:'Creature — Goblin'};const first=creatureTypes(mutable);first.push('Injected');assert.deepEqual(creatureTypes(mutable),['Goblin'],'Callers own fresh arrays');mutable.type_line='Creature — Elf';assert.deepEqual(creatureTypes(mutable),['Elf'],'In-place metadata updates are read, not stale object-identity results');
mutable.card_faces=[{type_line:'Creature — Time Lord'},{type_line:'Creature — Goblin'}];assert.deepEqual(creatureTypes(mutable),original(mutable));mutable.card_faces[0].type_line='Creature — Elf';assert.deepEqual(creatureTypes(mutable),original(mutable),'Face metadata refresh remains exact');
console.log('PASS: precompiled subtype patterns match original vocabulary, multiword/boundary/multiface ordering and fresh-array/metadata-refresh behavior.');
