import http from 'node:http';
import {createRequire} from 'node:module';
import {readActionMetadata} from '../experiments/forge-proof/combined-browser-proof/harness/action-diagnostics.mjs';
const require=createRequire(process.env.FORGE_BROWSER_TOOLS+'/package.json');
const {chromium}=require('playwright');
let posts=0;
const server=http.createServer(async(req,res)=>{
 if(req.method==='POST'){
  posts++;let body='';for await(const chunk of req)body+=chunk;
  const input=JSON.parse(body);
  res.writeHead(202,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({commandId:input.commandId,state:'accepted'}));
 }else res.end('<button>Send</button><script>document.querySelector("button").onclick=async()=>{const r=await fetch("/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({commandId:"fixture-command-0001",generation:"00000000-0000-4000-8000-000000000001",action:{op:"reply",revision:1,promptId:3}})});document.body.dataset.receipt=(await r.json()).state}</script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>route.continue());
 const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/actions')),page.getByRole('button').click()]);
 const metadata=await readActionMetadata(response,{stage:'native reveal acknowledgement'});
 console.log(JSON.stringify({metadata,posts,browser:browser.version(),uiReceipt:await page.locator('body').getAttribute('data-receipt')}));
 console.log('BODY',await response.body().then(b=>({bytes:b.length,kind:b.constructor.name}),e=>({error:e.message})));
}finally{await browser?.close();server.close();}
