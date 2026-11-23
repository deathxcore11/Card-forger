import { Game } from '../src/sim/game.js'; import { newBot, botRecord } from './bot.mjs';
let withSpell = 0, lv = []; for (let seed = 1; seed <= 12; seed++) { const g = new Game(seed, { mode: 'run', difficulty: 'medium', duelist: 'kael' }), bot = newBot({ focus: true, world: true }); for (let i = 0; i < 60 * 300 && !g.over; i++) g.tick(botRecord(g, bot)); const s = g.field.spells.find(x => x && x.id === 'widening-rite'); lv.push(s ? s.level : 0); if (s) withSpell++; }
console.log('seeds with the Spell by 5:00:', withSpell + '/12', 'levels', lv.join(' '));
