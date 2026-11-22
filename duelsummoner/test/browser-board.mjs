// Real-browser check of the leaderboard flow against the local reference service: finish a run in the game, see "Score sent, checking it",
// then "Verified, you placed #1", then the score on the weekly board in the main menu. Usage: node test/browser-board.mjs [outDir]
import { launch, wait } from './cdp.mjs';
import { Board } from '../tools/board-core.mjs';
import { createServer } from '../tools/board-server.mjs';

const board = new Board(null), server = createServer(board, { checkEveryMs: 700 });
await new Promise(r => server.listen(8766, r));
const b = await launch({ out: process.argv[2], query: '?debug&board=http://localhost:8766&name=Randall' });
const R = {};
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); for (let i = 0; i < 400; i++) D.game.tick({ mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 }); D.game.endRun(); return 1; })()`);
R.sent = await (async () => { for (let i = 0; i < 40; i++) { const t = await b.evalIn(`document.getElementById('dBoard').textContent`); if (t) return t; await wait(250); } return ''; })();
await b.shot('board-sent');
R.final = await (async () => { for (let i = 0; i < 60; i++) { const t = await b.evalIn(`document.getElementById('dBoard').textContent`); if (/Verified|rejected/.test(t)) return t; await wait(500); } return await b.evalIn(`document.getElementById('dBoard').textContent`); })();
await b.shot('board-verified');
await b.evalIn(`window.__ds.setMode('start'); window.__ds.menus.showMain(); 1`); await wait(1500);
R.menu = await b.evalIn(`document.getElementById('lbOnline') ? document.getElementById('lbOnline').innerText : 'no panel'`);
await b.shot('board-menu');
R.errors = await b.evalIn('window.__errs');
console.log(JSON.stringify(R, null, 1)); b.close(); server.close(); setTimeout(() => process.exit(0), 300);
