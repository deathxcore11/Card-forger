// Play's random deck queue: one finished random deck waits per format (and
// bracket/style), built in the background once Play opens and again after
// each one is taken, so the Random button swaps a deck in at once.
// It never touches prices or the real collection; builds run one at a time
// and everything is dropped when the account or scope changes.
export function createRandomDeckQueue({produce,readScope=()=>null,delay=1200,schedule=(fn,ms)=>setTimeout(fn,ms),onReady=()=>{},idle=()=>true,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(typeof produce!=='function')throw Error('QUEUE_PRODUCER_REQUIRED');
 let scope=null,chain=Promise.resolve(),generation=0;
 const ready=new Map(),pending=new Map();
 const keyOf=r=>JSON.stringify([r.format,r.targetBracket??null,r.deckStyle||'classic']);
 const check=()=>{const now=JSON.stringify(readScope());if(now!==scope){scope=now;generation++;ready.clear();pending.clear();}};
 function fill(request){
  check();const k=keyOf(request);
  if(ready.has(k))return Promise.resolve(ready.get(k));
  if(pending.has(k))return pending.get(k);
  const mine=generation,live=()=>{check();return generation===mine;};
  // One background build at a time keeps card lookups gentle, and none
  // starts while a match is on the table (idle() says when it may run).
  const job=chain.then(async()=>{while(live()&&!idle())await wait(4000);}).then(()=>live()?produce({format:request.format,targetBracket:request.targetBracket??null,deckStyle:request.deckStyle||'classic'},{current:live}):null).then(deck=>{if(pending.get(k)===job)pending.delete(k);if(deck&&live()){ready.set(k,deck);onReady(request);}return deck||null;},()=>{if(pending.get(k)===job)pending.delete(k);return null;});
  chain=job.then(()=>{},()=>{});pending.set(k,job);return job;
 }
 return {
  key:keyOf,
  take(request){check();const k=keyOf(request),deck=ready.get(k);if(!deck)return null;ready.delete(k);schedule(()=>fill(request),delay);return structuredClone(deck);},
  pending(request){check();return pending.get(keyOf(request))||null;},
  peek(format){check();return [...ready.entries()].filter(([k])=>JSON.parse(k)[0]===format).map(([,deck])=>structuredClone(deck));},
  warm(requests=[]){check();for(const r of requests)schedule(()=>fill(r),delay);},
  fill,
  clear(){generation++;ready.clear();pending.clear();},
 };
}
