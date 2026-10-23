import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {init,parse} from 'es-module-lexer';
await init();
const root=process.cwd(), bundle=JSON.parse(await readFile('bundle-manifest.json','utf8'));
const config=JSON.parse(await readFile('capacitor.config.json','utf8'));
const native=JSON.parse(await readFile('android/app/src/main/assets/capacitor.config.json','utf8'));
if(JSON.stringify(config)!==JSON.stringify(native)) throw Error('Stale native configuration');
let imports=0;
for(const file of bundle.files){
 const bytes=await readFile(path.join('www',file.path));
 if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Manifest mismatch: '+file.path);
 const packaged=await readFile(path.join('android/app/src/main/assets/public',file.path));
 if(!bytes.equals(packaged))throw Error('Stale Android asset: '+file.path);
 if(file.path.endsWith('.js'))for(const item of parse(bytes.toString())[0])if(item.specifier?.startsWith('.')){await access(path.join(root,'www',path.dirname(file.path),item.specifier.split('?')[0]));imports++;}
}
const app=await readFile('www/app.js','utf8'),entry=await readFile('www/native-entry.js','utf8'),html=await readFile('www/index.html','utf8');
if(!app.includes('!globalThis.CARDSTASHY_NATIVE && "serviceWorker" in navigator'))throw Error('Native SW guard missing');
if(!app.includes('CARDSTASHY_DOCUMENTS'))throw Error('Native export bridge missing');
if(!entry.includes('CARDSTASHY_ARTWORK_STORAGE'))throw Error('Native artwork bridge missing');
if(!html.includes('native-integration.css'))throw Error('Native CSS missing');
if(bundle.appId!==config.appId||bundle.releaseReady!==false)throw Error('Invalid integration provenance');
console.log(JSON.stringify({files:bundle.files.length,relativeImports:imports,packagedAssetsMatch:true,releaseReady:false}));
