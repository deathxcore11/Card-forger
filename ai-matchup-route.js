// Server-only, one bounded paid call through the existing shared AI allowance.
import { cleanMatchupRequest, validateMatchupAnalysis, matchupAnalysisSchema, MATCHUP_INSTRUCTIONS } from './ai-matchup-core.js';
import { loadServerRulePack, retrieveRules, sourceCoverage } from './rules-retrieval.js';
const reply = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const MAX_BYTES = 360000;
async function readBounded(request) {
  if (Number(request.headers.get('Content-Length'))>MAX_BYTES) throw fail('The matchup is too large.',413);
  // Bound bytes while streaming rather than allocating an unbounded body first.
  const reader=request.body?.getReader(); if (!reader) throw fail('Send both previewed decks.');
  let size=0; const chunks=[];
  for (;;) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw fail('The matchup is too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('Send a valid JSON matchup.');}
}
export async function aiMatchupRoute(request,env,{fetcher=fetch}={}) {
  const limitsEnabled=env.AI_LIMITS_ENABLED!=='false';
  const configured=!!(env.OPENAI_API_KEY&&(!limitsEnabled||env.AI_REVIEW_LIMITS));
  if(request.method==='GET')return reply({available:configured,game:'mtg',beta:true,scoreChanges:false,limitsEnabled});
  if(request.method!=='POST')return reply({message:'Use POST for an AI matchup.'},405,{Allow:'GET, POST'});
  if(!configured)return reply({message:'AI Matchups is not connected yet. Your decks and Power checks are unchanged.'},503);
  if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return reply({message:'Open AI Matchups from this app.'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return reply({message:'Send a JSON matchup.'},415);
  try {
    const context=cleanMatchupRequest(await readBounded(request));
    if ([context.player,context.opponent].some(d=>!d.cards.some(c=>c.known&&(c.text||c.type)))) throw fail('Load card details for both decks before starting the matchup.');
    // Integrity-pinned rule excerpts only; no client-supplied rules or source URLs are fetched.
    const pack=await loadServerRulePack(env,'mtg');
    const rules=retrieveRules(pack,`${context.question} casting sorcery instant priority stack combat target sacrifice adventure ${context.player.cards.concat(context.opponent.cards).map(c=>c.text).join(' ').slice(0,6000)}`,{format:context.format,limit:8}).map(r=>({id:r.id,title:r.title,text:r.text,source:r.source}));
    if (!rules.length) throw fail('The rules grounding is unavailable. Try again later.',503);
    if(limitsEnabled){
      const day=new Date().toISOString().slice(0,10),ip=request.headers.get('CF-Connecting-IP')||'unknown';
      // Same per-client key as deck review, and same global Durable Object. No separate free bucket.
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(day+':'+ip)))].map(x=>x.toString(16).padStart(2,'0')).join('');
      const gate=env.AI_REVIEW_LIMITS.get(env.AI_REVIEW_LIMITS.idFromName('global'));
      if(!(await gate.fetch('https://limit/reserve',{method:'POST',body:JSON.stringify({hash})})).ok)return reply({code:'app_limit',message:'AI allowance reached. Try later; your decks and Power checks are unchanged.'},429,{'Retry-After':'3600'});
    }
    const upstream=await fetcher('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:6000,instructions:MATCHUP_INSTRUCTIONS+'\nUse the provided integrity-checked official rule excerpts for precise interactions. They are dated and incomplete. When they do not establish an interaction, explain a conditional strategic plan and disclose the gap. Card records come from the app and are not independently re-fetched by this endpoint.',input:JSON.stringify({...context,rules,rulesCoverage:sourceCoverage('mtg')}),text:{format:{type:'json_schema',name:'magic_matchup',strict:true,schema:matchupAnalysisSchema(context)}}})});
    if(!upstream.ok){
      let error={};try{error=(await upstream.json()).error||{};}catch{}
      if(['credit_balance_exhausted','insufficient_quota'].includes(error.code)||error.type==='insufficient_quota')return reply({code:'billing',message:'OpenAI API credits need attention before AI Matchups can run. No deck changes were made.'},503);
      if(['project_spend_limit_exceeded','organization_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(error.code))return reply({code:'spend_limit',message:'The AI provider spending or usage limit was reached. No deck changes were made.'},503);
      if(upstream.status===429)return reply({code:'rate_limit',message:'AI Matchups was temporarily rate-limited. Wait before trying again; no automatic retry was made.'},503);
      if(upstream.status===401)return reply({code:'authentication',message:'The server AI connection needs attention. No deck changes were made.'},503);
      return reply({code:'provider_unavailable',message:'AI Matchups is temporarily unavailable. No deck changes were made.'},502);
    }
    const result=await upstream.json();if(result.status!=='completed')throw fail('The AI could not finish the matchup. No result was saved.',502);
    const output=(result.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    let raw;try{raw=JSON.parse(output);}catch{throw fail('The AI returned an unreadable matchup. No result was saved.',502);}
    return reply({...validateMatchupAnalysis(raw,context),generatedAt:new Date().toISOString(),model:String(result.model||'').slice(0,120),provenance:context.opponent.provenance,rulesCoverage:sourceCoverage('mtg')});
  }catch(e){return reply({message:e.status?e.message:'AI Matchups timed out or is unavailable. No deck changes were made.'},e.status||502);}
}
