// Focused pure-Java test of exact Android parameter helper, not an Android build.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'android/app/src/main/java/dev/cardstashy/integration/CardStashyAuth.java'),'utf8');
const start=source.indexOf('    private boolean unsafeExternalText('),end=source.indexOf('    private boolean safeExternal(Uri',start);
if(start<0||end<0)throw Error('Java helper anchors changed');
const cases=[];
for(const key of ['access_token','refresh_token','id_token','authorization','apikey','api_key','token','code']) {
  for(const encoded of [key,key.toUpperCase(),[...key].map(c=>'%'+c.charCodeAt(0).toString(16)).join(''),key.replace('_','%255f')]) {
    for(const tail of [encoded+'=synthetic','q=ok&'+encoded+'=synthetic&q=again','/route?'+encoded+'=synthetic','q=ok;'+encoded+'=synthetic'])cases.push([tail,false]);
  }
}
for(const value of ['id_token%ZZ=x','%E0%A4%A=x','bad%=x','route?%00code=x','q=ok%26id_token=synthetic','q=ok%0Acode=x','%2526id_token=x'])cases.push([value,false]);
for(const value of ['details','/route?view=cards','q=rare%20card&game=mtg','condition=near-mint'])cases.push([value,true]);
const code='public class ExternalParameterTest {\n'+source.slice(start,end)+'\n public static void main(String[] args) { ExternalParameterTest checker = new ExternalParameterTest();\n'+cases.map(([value,expected],i)=>`if(checker.safeExternalParameters(${JSON.stringify(value)}) != ${expected}) throw new AssertionError("Case ${i}");`).join('\n')+`\n System.out.println("PASS ${cases.length} native parameter cases"); }\n}`;
const dir=await mkdtemp(path.join(os.tmpdir(), 'cardstashy-external-java-'));
try {
  await writeFile(path.join(dir,'ExternalParameterTest.java'),code);
  const bin=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'';
  execFileSync(bin?path.join(bin,'javac'):'javac',[path.join(dir,'ExternalParameterTest.java')],{stdio:'pipe'});
  process.stdout.write(execFileSync(bin?path.join(bin,'java'):'java',['-cp',dir,'ExternalParameterTest'],{encoding:'utf8'}));
}finally{await rm(dir,{recursive:true,force:true});}
