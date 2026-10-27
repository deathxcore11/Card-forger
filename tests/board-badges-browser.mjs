// Live Forge table (fixture board, no transport): the battlefield icon layer on desktop and
// on touch. Badges sit around the art without covering names or power/toughness, never take
// a tap from the card, overflow into "+N", and the card's name reads everything they show.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 for(const [name,width,height,touch] of [['Desktop',1440,900,false],['Galaxy Z Fold 8 Ultra',884,830,true],['Fold sideways',982,729,true],['Tablet portrait',768,1024,true],['Laptop',1280,720,false]]){
  const context=await browser.newContext(touch?{viewport:{width,height},hasTouch:true,isMobile:true}:{viewport:{width,height}}),page=await context.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  // Offline, the fixture still needs one printed card to compare live power against.
  await page.route('https://api.scryfall.com/cards/collection',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({data:[{object:'card',id:'fixture-serra-angel',name:'Serra Angel',type_line:'Creature — Angel',mana_cost:'{3}{W}{W}',oracle_text:'Flying, vigilance',power:'4',toughness:'4',colors:['W'],rarity:'uncommon'}]})}));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=badges');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getTiming().iterations===Infinity));await sleep(300);
  const m=await page.evaluate(()=>{
   const tile=n=>[...document.querySelectorAll('.play-match-battlefields .play-match-card[data-instance]')].find(c=>c.querySelector('.play-match-card-name')?.textContent===n);
   const rect=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
   const overlap=(a,b)=>Math.max(0,Math.min(a.r,b.r)-Math.max(a.l,b.l))*Math.max(0,Math.min(a.b,b.b)-Math.max(a.t,b.t));
   const issues=[];
   for(const card of document.querySelectorAll('.play-match-battlefields .play-match-card[data-instance]')){
    const layer=card.querySelector('.cs-tile-layer');if(!layer)continue;const cardRect=rect(card);
    if(getComputedStyle(layer).pointerEvents!=='none'||layer.getAttribute('aria-hidden')!=='true')issues.push('layer takes events: '+card.dataset.instance);
    const nameEl=card.querySelector('.play-match-card-name'),stats=card.querySelector('.play-current-stats'),visible=cardRect.r>0&&cardRect.l<innerWidth&&card.dataset.tapped!=='true';
    for(const b of layer.querySelectorAll('.cs-badge,.cs-plaque,.cs-damage,.cs-crew')){
     const r=rect(b);if(!visible||!r.w)continue;
     if(nameEl&&overlap(r,rect(nameEl))>2)issues.push(`${nameEl.textContent}: badge over the name`);
     if(stats&&rect(stats).w&&overlap(r,rect(stats))>2)issues.push(`${nameEl?.textContent}: badge over power/toughness`);
     if(r.l<cardRect.l-1||r.r>cardRect.r+1||r.t<cardRect.t-1||r.b>cardRect.b+1)issues.push(`${nameEl?.textContent}: badge outside the tile`);
     // A touch on the badge still reaches the card itself, wherever its lane has it in view.
     const x=r.l+r.w/2,y=r.t+r.h/2;let shown=y<innerHeight;for(let p=card.parentElement;p&&shown;p=p.parentElement){if(getComputedStyle(p).overflow==='visible')continue;const c=rect(p);shown=x>=c.l&&x<=c.r&&y>=c.t&&y<=c.b;}
     const hit=shown&&document.elementFromPoint(x,y);if(hit&&hit.closest('.play-match-card')!==card&&!hit.closest('.forge-arrows'))issues.push(`${nameEl?.textContent}: badge blocks the card (${hit.className?.baseVal??hit.className})`);
    }
   }
   const bane=tile('Baneslayer Angel'),serra=tile('Serra Angel'),chandra=tile('Chandra, Torch of Defiance'),copter=tile('Smuggler’s Copter');
   return {issues,
    bane:[...bane.querySelectorAll('.cs-tile-layer .cs-badge')].map(b=>b.className.replace('cs-badge ','')),
    serraLabel:serra.getAttribute('aria-label'),serraShift:serra.querySelector('.play-current-stats')?.dataset.shiftP,
    chandra:chandra?.querySelector('.cs-plaque b')?.textContent,copter:copter?.querySelector('.cs-crew b')?.textContent,
    sol:tile('Sol Ring')?.closest('.play-match-lane')?.dataset.cardGroup,
    seats:[...document.querySelectorAll('.play-match-seat .cs-player-counters')].map(e=>e.getAttribute('aria-label')),
    seatIssues:[...document.querySelectorAll('.play-match-seat .cs-player-counters')].flatMap(e=>{const seat=e.closest('.play-match-seat'),r=rect(e),s=rect(seat),out=[];if(r.l<s.l||r.r>s.r||r.t<s.t||r.b>s.b)out.push(seat.dataset.playerSeat+': counters cut off by the seat');for(const sel of ['.play-match-life','.play-match-player strong,.play-match-player h2,.play-match-player h3']){const t=seat.querySelector(sel);if(t&&overlap(r,rect(t))>2)out.push(seat.dataset.playerSeat+': counters over '+sel);}return out;}),
    oldChips:[...document.querySelectorAll('.play-match-battlefields :is(.play-tapped-chip,.play-marked-damage,.play-counter,.play-match-keywords)')].filter(e=>e.getBoundingClientRect().width>0).length};
  });
  assert.deepEqual(m.issues,[],`${name}: badges stay clear of names and stats, inside the tile, and never block a tap`);
  assert.ok(m.bane.includes('cs-kw-flying')&&m.bane.includes('cs-kw-first-strike')&&m.bane.includes('cs-more'),`${name}: four keywords show two and "+2" (${m.bane})`);
  assert.ok(m.bane.includes('cs-combat-blocking'),`${name}: the blocker carries the block marker`);
  assert.match(m.serraLabel,/Flying, Vigilance · 2 \+1\/\+1 counters · 2 damage marked/,`${name}: the card's name reads every badge`);
  assert.equal(m.serraShift,'up',`${name}: power above the printed card reads as raised`);
  if(m.chandra!==undefined)assert.equal(m.chandra,'4',`${name}: loyalty plaque shows the live count`);
  if(m.copter!==undefined)assert.equal(m.copter,'1',`${name}: the vehicle shows its crew requirement`);
  assert.equal(m.sol,'lands',`${name}: Sol Ring sits with the lands`);
  assert.deepEqual(m.seats.sort(),['2 energy','3 poison'],`${name}: player counters on both seats`);
  assert.deepEqual(m.seatIssues,[],`${name}: player counters sit fully on the seat, clear of life and name`);
  assert.equal(m.oldChips,0,`${name}: the old text chips are replaced`);
  if(!touch){
   // The preview explains each icon: the same glyph sits beside the keyword or state it stands for.
   await page.locator('.play-match-battlefields .play-match-card[data-instance]',{hasText:'Serra Angel'}).first().hover();
   await page.waitForFunction(()=>document.querySelector('.forge-peek')?.dataset.open==='true');
   const peek=await page.evaluate(()=>({kw:[...document.querySelectorAll('.forge-peek-keywords li b')].map(b=>[b.textContent.trim(),!!b.querySelector('svg.forge-peek-icon')]),chips:[...document.querySelectorAll('.forge-peek-chip')].map(c=>[c.dataset.kind,!!c.querySelector('svg.forge-peek-icon')])}));
   assert.deepEqual(peek.kw,[['Flying',true],['Vigilance',true]],`${name}: preview keywords carry their icons`);
   assert.ok(peek.chips.length>=2&&peek.chips.every(([,icon])=>icon),`${name}: preview damage and counter rows carry their icons (${JSON.stringify(peek.chips)})`);
  }
  assert.deepEqual(errors,[],`${name}: no page errors`);
  console.log(`PASS ${name} ${width}x${height}: keyword rail with overflow, state/combat/counter/damage badges, plaques, crew and player counters, all clear of names and stats and never in the way of a tap.`);
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
