// Actual Worker/client boundaries; provider replies are deliberately adversarial.
// No provider calls, accounts or saved-deck writes.
import assert from 'node:assert/strict';
import {isDeckBuildRequest} from './ai-deck-goal.js';
import {aiAskRoute} from './ai-ask-route.js';
import {runAskLoop} from './ai-ask-loop.js';
const requests=[
 'Build an only goblin deck for red',
 'Give me a mono-red Goblin Commander deck',
 'I want a deck with only Goblins',
 "I'd like a mono-red Goblin-only Commander deck",
 'Can you do an only Goblin deck for red?',
 'Recommend a Goblin Commander deck under $100',
 'Please generate a mono-white Cats deck',
 'Only Goblins deck for red',
 'Goblin-only Commander deck please',
 'Can I get a red Goblin deck?',
 'Please rebuild my Goblin deck with only Goblins',
];
const information=[
 'How do I build a Goblin deck?',
 'Why does this Goblin deck have so few lands?',
 'What is a Commander deck?',
 'Review my red Goblin deck',
 'Recommend upgrades for my Goblin deck',
 'Suggest cards for a Goblin deck',
 'Open my Goblin deck',
 'Show me current tournament decks',
 'Most competitive Modern deck?',
 "I'd like to know how this deck works",
 'I want to upgrade my Goblin deck',
 'Give me advice on my Goblin deck',
 'I need help with my current deck',
 'Give me three cards to cut from my Goblin deck',
 'Make my Goblin deck better',
 'Can you make my current deck stronger?',
];
const u=content=>({type:'message',role:'user',content});
const origin='https://routing.invalid',env={OPENAI_API_KEY:'mock-only',AI_LIMITS_ENABLED:'false'};
const fabricated='Your complete deck is ready and already saved!\n1 Warmind Infantry\n1 Lightning Bolt\n98 Mountain';
for(const prompt of requests){
 assert.equal(isDeckBuildRequest(prompt),true,prompt);
 let payload;
 const result=await aiAskRoute(new Request(origin+'/api/ai/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'mtg',items:[u(prompt)]})}),env,{fetcher:async(_,init)=>{
  payload=JSON.parse(init.body);
  // Ignore the forced tool deliberately: the client must still refuse the prose.
  return Response.json({output:[{type:'message',role:'assistant',content:[{type:'output_text',text:fabricated}]}]});
 }});
 assert.equal(result.status,200);
 assert.equal(payload.tool_choice,'required',prompt);
 assert.deepEqual(payload.tools.map(t=>t.name).sort(),['build_deck','game_concepts','wiki_lookup'],prompt);
 assert(!payload.tools.some(t=>t.name==='answer'),'a new deck request cannot finish as unexecuted prose');
 assert.equal(payload.parallel_tool_calls,false);
 const response=await result.json();
 const answer=await runAskLoop({game:'mtg',items:[u(prompt)],tools:{},fetcher:async()=>Response.json(response)});
 assert.match(answer.text,/No deck was prepared by the app/,prompt);
 assert.doesNotMatch(answer.text,/Warmind|98 Mountain|already saved/);
 assert.deepEqual(answer.show,[]);
}
for(const prompt of information){
 assert.equal(isDeckBuildRequest(prompt),false,prompt);
 let payload;
 await aiAskRoute(new Request(origin+'/api/ai/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'mtg',items:[u(prompt)]})}),env,{fetcher:async(_,init)=>{payload=JSON.parse(init.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Information only.'}]}]});}});
 assert.equal(payload.tool_choice,'required',prompt);
}
console.log('PASS: natural deck requests reach the existing app builder; fabricated provider card lists cannot become deck results; learning, upgrades, saved decks and tournament browsing keep their own routes.');
