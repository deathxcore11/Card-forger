// Public Magic topics only. Profile tokens, chat history, collections and saved
// decks are never attached to a Wiki reference request.
async function requestReference(input,{fetcher=fetch,signal,endpoint='/api/reference/mtg-wiki'}={}) {
 const article=input.mode==='article';
 const response=await fetcher(endpoint,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.any([AbortSignal.timeout(article?18000:9000),...(signal?[signal]:[])])});
 if(!response.ok)throw Error(article?'The Wiki article could not be loaded.':'The Magic Wiki reference could not be loaded. Your cards and deck are unchanged.');
 const data=await response.json();
 if(!data||!['available','unavailable','not-found'].includes(data.status))throw Error('The Magic Wiki reference response was incomplete.');
 if(input.game&&data.game!==input.game)throw Error('The Wiki response belongs to a different game.');
 if(article&&(data.mode!=='article'||data.status==='available'&&(!data.article||typeof data.article.title!=='string'||!Array.isArray(data.article.lead)||!Array.isArray(data.article.sections)||!Array.isArray(data.article.images))))throw Error('The Wiki article response was incomplete.');
 return data;
}
export function readMtgWikiReference(title,{query=false,...options}={}) {
 if(typeof title!=='string'||!title.trim()||title.length>180)throw Error('Enter a Magic card or topic, up to 180 characters.');
 return requestReference({[query?'query':'title']:title.trim()},options);
}
export function readMtgWikiDaily(options={}) {return requestReference({daily:true},options);}
export function readGameWikiReference(game,title,{query=false,...options}={}) {
 if(!['mtg','ptcg','ygo'].includes(game))throw Error('Choose a supported card game.');
 if(typeof title!=='string'||!title.trim()||title.length>180)throw Error('Enter a card or topic, up to 180 characters.');
 return requestReference({game,[query?'query':'title']:title.trim()},{...options,endpoint:'/api/reference/wiki'});
}
export function readGameWikiDaily(game,options={}) {
 if(!['mtg','ptcg','ygo'].includes(game))throw Error('Choose a supported card game.');
 return requestReference({game,daily:true},{...options,endpoint:'/api/reference/wiki'});
}
export function readGameWikiArticle(game,title,{query=false,...options}={}){
 if(!['mtg','ptcg','ygo'].includes(game))throw Error('Choose a supported card game.');
 if(typeof title!=='string'||!title.trim()||title.length>180)throw Error('Enter a card or topic, up to 180 characters.');
 return requestReference({game,mode:'article',[query?'query':'title']:title.trim()},{...options,endpoint:'/api/reference/wiki'});
}
export function readMtgWikiArticle(title,{query=false,...options}={}){
 if(typeof title!=='string'||!title.trim()||title.length>180)throw Error('Enter a Magic card or topic, up to 180 characters.');
 return requestReference({mode:'article',[query?'query':'title']:title.trim()},options);
}
