import assert from 'node:assert/strict';
import { ANDROID_BETA, androidBetaDownload } from './android-beta.js';
// An APK over Cloudflare's 25 MiB static limit is served by the Worker from its committed parts, in order.
const parts = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])], asked = [];
const env = { ASSETS: { fetch: async request => { const path = new URL(request.url).pathname; asked.push(path); const n = Number(path.match(/\.part(\d+)$/)?.[1]); return parts[n - 1] ? new Response(parts[n - 1]) : new Response('missing', { status: 404 }); } } };
const url = 'https://cardstashy.com' + ANDROID_BETA.href;
const response = await androidBetaDownload(new Request(url), env);
assert.equal(response.headers.get('Content-Type'), 'application/vnd.android.package-archive');
assert.equal(response.headers.get('Content-Length'), String(ANDROID_BETA.bytes));
assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4, 5]);
assert.deepEqual(asked, [ANDROID_BETA.href + '.part1', ANDROID_BETA.href + '.part2', ANDROID_BETA.href + '.part3']);
const head = await androidBetaDownload(new Request(url, { method: 'HEAD' }), env);
assert.equal(head.body, null); assert.equal(head.headers.get('Content-Length'), String(ANDROID_BETA.bytes));
assert.equal(await androidBetaDownload(new Request(url, { method: 'POST' }), env), null);
assert.equal(await androidBetaDownload(new Request(url), { ASSETS: { fetch: async () => new Response('', { status: 404 }) } }), null);
console.log('PASS: a split Android APK downloads as one file, in part order, with its recorded size.');
