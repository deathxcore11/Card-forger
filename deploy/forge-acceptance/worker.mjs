// A reversible, same-origin test mount. Main website deployment is unchanged.
import { proxyForgePlayRequest } from '../forge-host/src/app-route.mjs';
export const PREFIX='/__forge-acceptance/';
const ORIGIN='https://cardstashy.com';
const missing=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
export function acceptanceWorker(overrides){
 return {async fetch(request,env){
  const url=new URL(request.url);
  if(url.origin!==ORIGIN||!url.pathname.startsWith(PREFIX))return missing();
  const file=url.pathname.slice(PREFIX.length)||'index.html';
  const target=new URL(file==='index.html'?'/':'/'+file,ORIGIN);target.search=url.search;
  if(file.startsWith('api/')){
   const forward=new Request(target,request);
   return proxyForgePlayRequest(forward,env)||missing();
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
  // Keep this test mount out of persistent/offline caches. Never install a
  // second service worker or replace the production registration.
  if(file==='sw.js'||file.startsWith('.')||file.includes('%')||file.startsWith('deploy/')||file.startsWith('docs/')||!/^[-A-Za-z0-9_./]+\.(?:html|css|js|mjs|json|webmanifest|svg|png|jpe?g|webp|ico|woff2?|wasm|mp4)$/.test(file))return missing();
  let response;
  if(Object.hasOwn(overrides,file)){
   const type=/\.m?js$/.test(file)?'application/javascript':file.endsWith('.css')?'text/css':'text/html';
   response=new Response(overrides[file],{headers:{'Content-Type':type+'; charset=utf-8'}});
  }else{
   // Static fallback only; never forward browser credentials or API bodies.
   response=await env.PRODUCTION_ASSETS.fetch(new Request(target,{method:request.method,headers:{Accept:request.headers.get('Accept')||'*/*'},redirect:'manual'}));
  }
  const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('X-CardStashy-Forge-Test','1');
  headers.delete('ETag');headers.delete('Last-Modified');
  if(file==='index.html'&&response.ok&&request.method!=='HEAD'){
   const html=(await response.text()).replace(/<body([^>]*)>/i,'<body$1><aside role="status" style="padding:8px 16px;background:#172e33;color:#fff;text-align:center;font:14px system-ui">Forge test · Your existing decks and account · Match history is not yet saved</aside>');
   headers.delete('Content-Length');return new Response(html,{status:response.status,headers});
  }
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
 }};
}
