import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Inspect the builder's real literal policy without pinning or generating a
// native bundle. Full build/boot tests later inspect the packaged entry page.
const source=await readFile(new URL('../scripts/build-web.mjs',import.meta.url),'utf8');
const literal=source.match(/const csp = (\[[\s\S]*?\])\.join\('; '\);/)?.[1];
assert(literal,'The native builder must expose one explicit CSP inventory');
const policy=new Map(vm.runInNewContext(literal).map(value=>{
 const [directive,...sources]=value.split(/\s+/);return [directive,sources];
}));

test('Wiki reader art uses pinned image locations without broadening native connections',()=>{
 const images=policy.get('img-src'),connections=policy.get('connect-src');
 for(const location of [
  'https://files.mtg.wiki',
  'https://archives.bulbagarden.net/media/upload/',
  'https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/',
  'https://static.wikia.nocookie.net/yugioh/images/',
 ])assert(images.includes(location),location+' must be loadable in the native Wiki reader');
 for(const broad of ['*','https:','http:','https://static.wikia.nocookie.net','https://archives.bulbagarden.net'])assert(!images.includes(broad),'No broad image permission: '+broad);
 for(const source of connections)assert(!/mtg\.wiki|bulbagarden\.net|wikia\.nocookie\.net|yugioh\.fandom\.com/.test(source),'Wiki JSON remains on the first-party service route');
 assert(images.includes("'self'")&&images.includes('https://cardstashy.com'),'Existing packaged and first-party art remain supported');
 assert(connections.includes('https://cardstashy.com'));
 assert.deepEqual(Array.from(policy.get('object-src')),["'none'"]);
 assert.deepEqual(Array.from(policy.get('frame-src')),["'none'"]);
});
