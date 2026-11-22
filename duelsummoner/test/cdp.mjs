// Minimal Chrome DevTools driver: starts the static server and a headless Chrome (GPU on), returns evaluate/screenshot helpers.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const wait = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ out, port = 8767, debugPort = 9334, query = '?debug', uncapped = false } = {}) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  out = out || join(tmpdir(), 'ds-shots'); mkdirSync(out, { recursive: true });
  const chromePath = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const server = spawn(process.execPath, ['serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=' + debugPort, '--window-size=1280,720', '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'ds-chrome-')),
    '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run', ...(uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : []), 'about:blank'], { stdio: 'ignore' });
  const close = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
  process.on('exit', close);
  let ws, id = 0; const pending = new Map();
  for (let i = 0; i < 50; i++) {
    try {
      const tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json')).json(), tab = tabs.find(t => t.type === 'page');
      if (tab) { ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); break; }
    } catch {}
    await wait(200);
  }
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalIn = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails).slice(0, 600));
    return r.result.result.value;
  };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__errs=[];window.addEventListener("error",e=>__errs.push(String(e.message)));const ce=console.error;console.error=function(){__errs.push([].join.call(arguments," "));ce.apply(console,arguments)}' });
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/' + query });
  for (let i = 0; i < 60 && !(await evalIn('!!window.__ds')); i++) await wait(200);
  return { evalIn, shot, send, close, out };
}
