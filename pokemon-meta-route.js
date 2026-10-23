// Public tournament JSON only. Fixed upstream routes, no URL/header passthrough.
const ORIGIN='https://play.limitlesstcg.com/api';
const formats={standard:'STANDARD',expanded:'EXPANDED',glc:'GLC'};
const ttl=6*3600,maxBytes=4*1024*1024;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function pokemonMetaRoute(request,url,ctx={}, {fetchImpl=globalThis.fetch,cache=globalThis.caches?.default}={}){
 if(request.method!=='GET')return json({message:'GET only'},405);
 const kind=url.pathname.split('/').at(-1),allowed=kind==='tournaments'?['format']:['id'];
 if(!['tournaments','standings','pairings'].includes(kind)||[...url.searchParams.keys()].some(k=>!allowed.includes(k)||url.searchParams.getAll(k).length!==1))return json({message:'Unsupported tournament query'},400);
 let path;
 if(kind==='tournaments'){
  const format=url.searchParams.get('format')||'standard';if(!Object.hasOwn(formats,format))return json({message:'Unsupported Pokémon tournament format'},400);
  path='/tournaments?game=PTCG&format='+formats[format]+'&limit=100';
 }else{
  const id=url.searchParams.get('id');if(!/^[A-Za-z0-9_-]{1,80}$/.test(id||''))return json({message:'Invalid tournament ID'},400);
  path='/tournaments/'+id+'/'+kind;
 }
 const key=new Request('https://cardstashy.cache/ptcg-meta/'+encodeURIComponent(path));
 const hit=await cache?.match(key);if(hit)return hit;
 try{
  // Workers support manual redirects; a 3xx is rejected by the non-OK gate below.
  const upstream=await fetchImpl(ORIGIN+path,{redirect:'manual',credentials:'omit',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)throw Error('Limitless tournament service is unavailable ('+upstream.status+'). Try again shortly.');
  if(Number(upstream.headers.get('Content-Length'))>maxBytes)throw Error('Tournament response exceeds the size limit.');
  const reader=upstream.body?.getReader();if(!reader)throw Error('Empty tournament response.');
  let size=0,text='';const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Tournament response exceeds the size limit.');}text+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
  const body=JSON.parse(text+decoder.decode());if(!Array.isArray(body))throw Error('Tournament source returned an invalid list.');
  const response=Response.json(body,{headers:{'Cache-Control':'public, max-age='+ttl}});
  if(cache){const job=cache.put(key,response.clone()).catch(()=>{});if(ctx.waitUntil)ctx.waitUntil(job);else await job;}
  return response;
 }catch{return json({message:'Couldn’t load Limitless tournament results. Try again shortly.'},502);}
}
