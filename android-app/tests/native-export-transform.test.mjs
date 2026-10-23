import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { transformNativeExports, transformNativeTcgExports } from '../scripts/transform-native-exports.mjs';
const fixture = await readFile(new URL('./fixtures/native-export-app.js', import.meta.url), 'utf8');
const transformed = transformNativeExports(fixture);
function context(native = true, save = async () => ({status:'saved', saved:true})) {
  const messages = [], events = [], classes = new Set();
  const status = {textContent:'', classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)}};
  const ctx = vm.createContext({A:{}, CARDSTASHY_NATIVE:native, CARDSTASHY_DOCUMENTS:{saveDocument:save}, toast:m=>messages.push(m),
    navigator:{clipboard:{writeText:async()=>{throw Error('blocked');}}},
    Blob, URL:{createObjectURL:()=>{events.push('url');return 'blob:test';}, revokeObjectURL:()=>events.push('revoke')}, setTimeout:f=>f(),
    document:{createElement:()=>({click:()=>events.push('click'),remove:()=>events.push('remove')}),body:{appendChild:()=>events.push('append')},getElementById:()=>status},
    backupPayload:()=>'{"cards":[]}', recoverySnapshot:async()=>({label:'Before',state:{}}),backupEnvelope:s=>s,fileSafe:s=>s,
    currentDeck:()=>({name:'Example',cards:[]}),proxyList:()=>[{}],aggregateCards:()=>[],V:{rowsFor:()=>[]},S:{catalog:{}},proxySheetHTML:()=>'<html>proxy</html>',
    window:{open:()=>{events.push('popup');return null;}}
  });
  vm.runInContext(transformed,ctx);
  return {ctx,messages,events,status,classes};
}
test('strict transform rejects missing/duplicate anchors and repeated application',()=>{
  assert.throws(()=>transformNativeExports(''),/exactly one/);
  assert.throws(()=>transformNativeExports(fixture+fixture),/exactly one/);
  assert.throws(()=>transformNativeExports(transformed),/exactly one/);
});
test('native save passes exact filename, data and MIME and waits for receipt',async()=>{
  let complete, options;
  const {ctx,messages,events}=context(true, o=>{options=o;return new Promise(r=>complete=r);});
  const pending=ctx.download('cards.csv','one,two','text/csv');
  assert.equal(messages.length,0);assert.equal(events.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(options)),{name:'cards.csv',text:'one,two',mime:'text/csv'});
  complete({status:'saved',saved:true});await pending;
  assert.deepEqual(messages,['Document saved.']);
});
test('native cancellation, invalid receipt, and rejection never produce saved/downloaded success',async()=>{
  for (const save of [async()=>({status:'cancelled',saved:false}),async()=>({}),async()=>{throw Error('disk full');}]) {
    const {ctx,messages,events,status,classes}=context(true,save);
    await ctx.A.exportBackup();await ctx.A.downloadRecovery({dataset:{id:'a'}});await ctx.copyText('abc','Copied');await ctx.A.proxies({dataset:{scope:'all'}});
    assert.equal(events.length,0);
    assert.equal(classes.has('success'),false);
    assert.ok(!messages.some(m=>m==='Document saved.'||m.includes('downloaded')||m.includes('Backup prepared')));
    assert.ok(!status.textContent.startsWith('✓'));
  }
});
test('backup status waits for confirmed saved receipt',async()=>{
  let complete;const {ctx,status,classes}=context(true,()=>new Promise(r=>complete=r));
  const pending=ctx.A.exportBackup();assert.equal(status.textContent,'');
  complete({status:'saved',saved:true});await pending;
  assert.equal(status.textContent,'✓ Backup saved.');assert.equal(classes.has('success'),true);
});
test('browser blob download and original backup/copy/proxy messages preserved',async()=>{
  const {ctx,messages,events,status}=context(false,()=>{throw Error('must not use native bridge');});
  assert.equal(ctx.download('a','b'),undefined);
  await ctx.A.exportBackup();await ctx.copyText('abc','Copied');await ctx.A.proxies({dataset:{scope:'all'}});
  assert.equal(events.filter(e=>e==='click').length,4);assert.equal(events.filter(e=>e==='popup').length,1);
  assert.ok(status.textContent.includes('Check your downloads'));
  assert.ok(messages.some(m=>m.includes('Clipboard blocked — downloaded')));
  assert.ok(messages.some(m=>m.includes('Pop-up blocked — downloaded')));
});
test('TCG exports return shared save promise and fail closed on source drift',async()=>{
  const source=await readFile(new URL('./fixtures/native-export-tcg.js',import.meta.url),'utf8');
  const result=transformNativeTcgExports(source);
  assert.equal((result.match(/return download\(/g)||[]).length,2);
  assert.throws(()=>transformNativeTcgExports(result),/exactly one/);
  new vm.Script(result);
});
