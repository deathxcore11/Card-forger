// Read-only diagnosis on the hosted browser runner. No app mocks, credentials,
// response substitution, relaxed TLS/CORS or production state changes.
import {createServer} from 'node:http';
import {chromium,devices} from 'playwright';
const url='https://api.scryfall.com/cards/7673784e-db4b-43a1-8d55-1bb9fc1e284f';
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Transport check</title>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
 for(const mode of ['default-phone','default-desktop','http1-phone']) {
  const browser=await chromium.launch(mode==='http1-phone'?{args:['--disable-http2','--disable-quic']}:{});
  try {
   const context=await browser.newContext(mode==='default-desktop'?{}:{...devices['Pixel 7']});
   const page=await context.newPage(),network=[];
   const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
   cdp.on('Network.responseReceived',e=>{if(e.response.url===url)network.push({status:e.response.status,protocol:e.response.protocol});});
   cdp.on('Network.loadingFailed',e=>network.push({error:e.errorText,blockedReason:e.blockedReason,cors:e.corsErrorStatus}));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   const result=await page.evaluate(async url=>{
    const start=performance.now();try {
     const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
     const card=await response.json();return {status:response.status,id:card.id,name:card.name,ms:Math.round(performance.now()-start)};
    }catch(error){return {error:error.name+': '+error.message,ms:Math.round(performance.now()-start)};}
   },url);
   console.log('SCRYFALL_TRANSPORT',JSON.stringify({mode,result,network}));
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
