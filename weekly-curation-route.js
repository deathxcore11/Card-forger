import { curationPlan, curationWeek } from './weekly-curation.js';
import { ptcgMeta, ygoMeta } from './meta.js';
const OBJECT_NAME = 'public-weekly-curation-v1';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
const object = env => env.AI_REVIEW_LIMITS?.get(env.AI_REVIEW_LIMITS.idFromName(OBJECT_NAME));
const query = spec => new URLSearchParams(spec).toString();
function boundedMetaFetch(fetchImpl, overallSignal) {
  let calls = 0;
  return async (value, init = {}) => {
    const u = new URL(value), endpoint = u.origin === 'https://play.limitlesstcg.com' && (u.pathname === '/api/tournaments' && u.search === '?game=PTCG&format=STANDARD&limit=100' || /^\/api\/tournaments\/[a-zA-Z0-9_-]{1,80}\/(?:standings|pairings)$/.test(u.pathname) && !u.search) || u.origin === 'https://ygoprodeck.com' && ((u.pathname === '/api/decks/getDecks.php' && ['0','20','40'].includes(u.searchParams.get('offset'))) || (u.pathname === '/api/top/getFormat.php' && /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dateStart') || ''))) && u.searchParams.get('format') === 'Tournament Meta Decks';
    if (!endpoint || u.username || u.password || u.hash || ++calls > 40) throw Error('Unsupported or exhausted public Meta source');
    const response = await fetchImpl(u.href, { ...init, redirect: 'error', credentials: 'omit', signal: overallSignal ? AbortSignal.any([overallSignal,AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
    if (!response.ok) return response;
    const max = 4 * 1024 * 1024; if (Number(response.headers.get('Content-Length')) > max) throw Error('Meta source exceeded the size limit');
    const reader = response.body?.getReader(); if (!reader) throw Error('Meta source unavailable');
    let size = 0, body = ''; const decoder = new TextDecoder();
    try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw Error('Meta source exceeded the size limit'); } body += decoder.decode(value,{stream:true}); } } finally { reader.releaseLock(); }
    return new Response(body + decoder.decode(), {status:response.status,headers:{'Content-Type':'application/json'}});
  };
}
export async function weeklyCurationRoute(request, url, env) {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  const game = url.searchParams.get('game'), kind = url.pathname === '/api/community' ? 'news' : 'meta';
  const format = kind === 'news' ? '' : game === 'mtg' ? url.searchParams.get('format') || 'Modern' : game === 'ptcg' ? 'Standard' : 'TCG';
  if ([...url.searchParams.keys()].some(key => !['game',...(kind === 'meta' ? ['format'] : [])].includes(key)) || url.searchParams.getAll('game').length !== 1 || url.searchParams.getAll('format').length > 1) return json({ error: 'Unsupported curation request' },400);
  const spec = curationPlan().find(row => row.kind === kind && row.game === game && row.format === format);
  if (!spec) return json({ error: 'Unsupported curation feed' }, 400);
  const gate = object(env);
  if (!gate) return json({ game, format, items: [], selections: [], cadence: 'weekly', status: 'unavailable', error: 'Shared weekly curation is not configured yet.' });
  // Read-only: no client flags, query strings, visits or refresh buttons can
  // invoke provider calls or reserve another weekly attempt.
  try { return await gate.fetch(`https://curation.internal/weekly/read?${query(spec)}`); }
  catch { return json({ game, format, items: [], selections: [], cadence: 'weekly', status: 'unavailable', error: 'The shared weekly snapshot is temporarily unavailable.' }); }
}
export async function scheduledWeeklyCuration(env, { loadMtg, now = Date.now(), fetchImpl = globalThis.fetch, overallMs = 120000 } = {}) {
  const gate = object(env); if (!gate) return { status: 'not-configured', attempted: 0 };
  const controller=new AbortController(),duration=Math.min(120000,Math.max(1,Number(overallMs)||120000)),deadlineAt=now+duration;let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Weekly schedule deadline reached'));},duration);});
  const bounded=fn=>Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error('Weekly schedule deadline reached');return fn();}),deadline]);
  let attempted=0,ready=0,week=curationWeek(now);
  try {
    const response=await bounded(()=>gate.fetch(new Request('https://curation.internal/weekly/due',{signal:controller.signal}))),payload=await bounded(()=>response.json());
    if(!response.ok||payload.week!==week)return {status:'unavailable',attempted:0};
    const allowed=new Map(curationPlan().map(row=>[query(row),row]));
    for(const raw of (Array.isArray(payload.due)?payload.due:[]).slice(0,14)){
      if(controller.signal.aborted)break;
      const spec=allowed.get(query(raw));if(!spec)continue;
      let source=null;
      if(spec.kind==='meta'){
        try{source=await bounded(()=>spec.game==='mtg'?loadMtg?.(spec.format,{signal:controller.signal}):spec.game==='ptcg'?ptcgMeta({fetchImpl:boundedMetaFetch(fetchImpl,controller.signal),now,server:true}):ygoMeta({fetchImpl:boundedMetaFetch(fetchImpl,controller.signal),now,server:true}));}
        catch(error){if(controller.signal.aborted)throw error;source={game:spec.game,format:spec.format,decks:[],source:'',unavailable:true};}
      }
      if(controller.signal.aborted)break;
      if(source)source={game:source.game,format:source.format,source:source.source,fetchedAt:source.fetchedAt,decks:(Array.isArray(source.decks)?source.decks:[]).slice(0,300).map(({player,...deck})=>deck)};
      attempted++;
      try{
        const result=await bounded(()=>gate.fetch(new Request(`https://curation.internal/weekly/refresh?${query(spec)}`,{method:'POST',headers:{'Content-Type':'application/json','X-Weekly-Deadline':String(deadlineAt)},body:JSON.stringify(source),signal:controller.signal})));
        if((await bounded(()=>result.json())).status==='ready')ready++;
      }catch(error){if(controller.signal.aborted)throw error;/* A claimed attempt is never retried here. */}
    }
    return {status:controller.signal.aborted?'deadline':'checked',attempted,ready,week};
  }catch{return {status:controller.signal.aborted?'deadline':'unavailable',attempted,ready,week};}
  finally{clearTimeout(timer);}
}
