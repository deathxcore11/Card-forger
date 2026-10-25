// Local verification helper only. Owns one isolated Chromium process group;
// never attaches to the user's browser or terminates an unrelated process.
import {spawn} from 'node:child_process';import {once} from 'node:events';import {readFile,mkdir,rm} from 'node:fs/promises';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
export async function startTestBrowser({profile,offline=false}={}){
 if(!profile||!process.env.CARDSTASHY_CHROMIUM_PATH)throw Error('EXPLICIT_TEST_PROFILE_AND_BROWSER_REQUIRED');profile=resolve(profile);await mkdir(profile,{recursive:true});await rm(join(profile,'DevToolsActivePort'),{force:true});
 const child=spawn(process.env.CARDSTASHY_CHROMIUM_PATH,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{detached:true,stdio:['ignore','ignore','pipe']});
 let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8192);});let exited=false;const exit=once(child,'exit').then(([code,signal])=>{exited=true;return {code,signal};});
 async function kill(){if(!exited){try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}}return exit;}
 try{
  let port;const deadline=Date.now()+20000;while(!port){if(exited)throw Error('TEST_BROWSER_EXITED: '+stderr);if(Date.now()>deadline)throw Error('TEST_BROWSER_BOOT_TIMEOUT: '+stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}if(!port)await new Promise(r=>setTimeout(r,25));}
  const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs'))),browser=await chromium.connectOverCDP('http://127.0.0.1:'+port),context=browser.contexts()[0];await context.setOffline(offline);
  return {browser,context,kill,pid:child.pid};
 }catch(error){await kill();throw error;}
}
