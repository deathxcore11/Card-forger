// Read-only provider diagnostic, separate from deterministic browser fixtures.
// Public bulk references only: no condition credits, user data or writes.
import {writeFile,mkdir} from 'node:fs/promises';
import {ygoSetPriceRoute} from '../ygo-set-prices.js';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run the live-source diagnostic in hosted CI.');
const reports=[];
for(const [name,code]of [['Beyond the Brave','BETB'],['2025 Mega-Pack Tin','MP25']]){
 let groups=[];const requests=[];
 const fetchSource=async(url,options)=>{try{const response=await fetch(url,options);requests.push({url,status:response.status});if(url.endsWith('/groups')&&response.ok)groups=(await response.clone().json()).results||[];return response;}catch(e){requests.push({url,error:e.message,cause:e.cause?.message});throw e;}};
 const response=await ygoSetPriceRoute(new URL('https://fixture.invalid/api/prices/yugioh-set?'+new URLSearchParams({name,code})),null,fetchSource),body=await response.json();
 reports.push({name,code,requests,status:body.status,http:response.status,products:body.products?.length||0,priced:body.products?.filter(p=>p.quotes.length).length||0,groupMatches:groups.filter(g=>g.abbreviation===code||g.name.includes(name.split(' Tin')[0])).map(g=>({name:g.name,code:g.abbreviation,id:g.groupId})),sample:body.products?.filter(p=>p.quotes.length).slice(0,2)});
}
await mkdir('test-results',{recursive:true});await writeFile('test-results/public-ygo-prices.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
