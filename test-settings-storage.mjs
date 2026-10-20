import assert from 'node:assert/strict';
import {cachedImages,localStorageFootprint} from './settings-storage.js';
import {createRecoverySnapshot,appendRecoverySnapshot} from './recovery-store.js';
const requests=paths=>paths.map(path=>({url:'https://cardstashy.test/'+path}));
const shell=requests(['app.js','index.html','img/ygo/1.jpg','icon.svg','scanidx/ptcg.bin']);
const other=requests(['private-photo.jpg']);
const buckets=new Map([['cardforge-shell-v261',shell],['unrelated-cache',other]]),deleted=[];
const storage={keys:async()=>[...buckets.keys()],open:async name=>({keys:async()=>buckets.get(name),delete:async request=>{deleted.push(request.url);buckets.set(name,buckets.get(name).filter(x=>x!==request));return true;}})};
assert.deepEqual(await cachedImages({storage}),{available:true,count:2});assert.equal(deleted.length,0);
assert.deepEqual(await cachedImages({storage,clear:true}),{available:true,count:2});
assert.deepEqual(buckets.get('cardforge-shell-v261').map(x=>x.url.split('/').at(-1)),['app.js','index.html','ptcg.bin']);
assert.equal(buckets.get('unrelated-cache').length,1,'other cache namespaces remain intact');
assert.deepEqual(await cachedImages({storage:null,clear:true}),{available:false,count:0});
await assert.rejects(()=>cachedImages({storage:{keys:async()=>{throw Error('denied');}}}),/denied/);
const values=new Map([['settings','dark'],['pending','data:image/jpeg;abc']]);
assert.equal(localStorageFootprint({length:2,key:i=>[...values.keys()][i],getItem:k=>values.get(k)}),38);
let journal=null;
const state={collection:[{id:'a',qty:3}],settings:{game:'mtg'},valueHistory:[{total:9}],lastSavedAt:'one'};
for(let i=0;i<30;i++)journal=appendRecoverySnapshot(journal,createRecoverySnapshot({...state,lastSavedAt:String(i)},{owner:'A',id:String(i)}));
assert.equal(journal.snapshots.length,1,'timestamp-only account reloads do not add snapshots');
for(const patch of [{collection:[{id:'a',qty:4}]},{settings:{game:'ygo'}},{valueHistory:[{total:10}]}])journal=appendRecoverySnapshot(journal,createRecoverySnapshot({...state,...patch},{owner:'A'}));
assert.equal(journal.snapshots.length,4,'distinct cards, settings and history remain recoverable');
assert.equal(journal.snapshots.at(-1).state.collection[0].qty,3,'original copy remains exact');
console.log('PASS: image-only app-cache cleanup, read-only storage estimates, unavailable/denied APIs, timestamp dedupe and distinct recovery protection.');

const {readFileSync}=await import('node:fs');
const {default:vm}=await import('node:vm');
const source=readFileSync('app.js','utf8'),action=source.slice(source.indexOf('A.exportBackup = () => {'),source.indexOf('async function recoverySnapshot'));
for(const failed of [false,true]){
 const classes=new Set(),status={textContent:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},messages=[],files=[];
 const ctx={A:{},Date,document:{getElementById:()=>status},backupPayload:()=>{if(failed)throw Error('export failure');return 'exact-workspace';},download:(...args)=>files.push(args),toast:x=>messages.push(x)};
 vm.runInNewContext(action,ctx);ctx.A.exportBackup();
 assert.equal(files.length,failed?0:1);assert.equal(classes.has('success'),!failed);
 assert.match(status.textContent,failed?/could not be prepared/:/Check your downloads/);assert.equal(messages.length,1);
}
console.log('PASS: actual backup handler leaves persistent honest success/failure feedback.');
