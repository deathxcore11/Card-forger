// Browser checks for the sound module that need the page served over http (a page opened from a file never asks for
// sounds). No audio file is needed: the list of sounds and a short silent sound are made here and handed to the page.
//   node tools/crucible/sound-checks.cjs <build folder with index.html>
// Reported 21 November 2026 (review of the updated build): one failed request for the list of sounds muted the whole
// session, because the failure was remembered as "there are no sounds".
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
(async () => {
  const dir = path.resolve(process.argv[2] || '.'); let pass = 0, fail = 0;
  const check = (name, ok, info) => { if (ok) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + ' ' + JSON.stringify(info === undefined ? null : info)); } };
  const types = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((q, r) => { // the build folder only; anything under audio/ is answered by the routes below
    const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const wav = (() => { // a quarter second of silence, 8 kHz, 16 bit, one channel
    const n = 2000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
  const sounds = { ui_move_a: { file: 'ui_move_a' }, mus_quiet: { file: 'mus_quiet' } };
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  for (const first of ['a 503 answer', 'a dropped connection', 'an answer that is not the list']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    let asked = 0, mend = false; const files = [];
    await page.route('**/audio/**', route => {
      const u = route.request().url();
      if (/manifest\.json/.test(u)) { asked++;
        if (mend) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sounds }) });
        return first === 'a 503 answer' ? route.fulfill({ status: 503, body: 'busy' }) : first === 'a dropped connection' ? route.abort('connectionreset') : route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' }); }
      files.push(u.split('/audio/')[1]); return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
    });
    await page.goto(url); await page.waitForTimeout(400);
    await page.mouse.click(8, 8); await page.waitForTimeout(400); // the first tap wakes the sound and asks for the list
    await page.evaluate(() => { window.LMAudio.cue('screen:home', {}); window.LMAudio.play('ui_move_a'); }); await page.waitForTimeout(400);
    check(`the list of sounds fails once (${first}): the page stays silent and whole`, asked === 1 && !files.length && !(await page.evaluate(() => window.LMAudio.ready)) && !errors.length, { asked, files, errors });
    await page.evaluate(() => { for (let i = 0; i < 20; i++) window.LMAudio.play('ui_move_a'); }); await page.waitForTimeout(300);
    check('a burst of cues straight after does not ask again at once', asked === 1, asked);
    mend = true; await page.waitForTimeout(4200);
    await page.evaluate(() => window.LMAudio.play('ui_move_a')); await page.waitForTimeout(900);
    const ready = await page.evaluate(() => window.LMAudio.ready), beds = await page.evaluate(() => window.LMAudio.beds);
    check('a later cue asks for the list again and the sound loads', asked === 2 && ready === true && files.some(f => /^ui_move_a\./.test(f)), { asked, ready, files });
    check('and the music the screen had asked for starts', beds.music === 'mus_quiet' && files.some(f => /^mus_quiet\./.test(f)), beds);
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.LMAudio.play('ui_move_a'); }); await page.waitForTimeout(300);
    check('once loaded, the list is not asked for again', asked === 2 && !errors.length, { asked, errors });
    await page.close();
  }
  { // the usual case: the list loads at the first tap and is asked for once
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); let asked = 0;
    await page.route('**/audio/**', route => { if (/manifest\.json/.test(route.request().url())) { asked++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sounds }) }); } return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
    await page.goto(url); await page.waitForTimeout(400); await page.mouse.click(8, 8); await page.waitForTimeout(500);
    await page.evaluate(() => { window.LMAudio.cue('screen:home', {}); window.LMAudio.play('ui_move_a'); }); await page.waitForTimeout(700);
    check('with nothing failing, the list is asked for once and music plays', asked === 1 && (await page.evaluate(() => window.LMAudio.ready)) === true && (await page.evaluate(() => window.LMAudio.beds.music)) === 'mus_quiet', asked);
    await page.close();
  }
  await browser.close(); server.close();
  console.log(`sound checks: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
