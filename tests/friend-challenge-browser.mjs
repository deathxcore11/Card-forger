// Friend challenge, end to end in the real app with a synthetic room server: the host presses the
// crossed swords on a friend in the Friends list and sends a challenge; the friend gets a sealed
// letter, accepts, picks a deck and both players open the same match. A second challenge answered
// "Not now" tells the host quietly.
import assert from 'node:assert/strict';
import {startServer,openSearchApp,makeSearchFixtures} from './search-fixtures.mjs';
import {workspaceSig} from '../cloud.js';
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const INVITE='ChAlLeNgEfOrYoU0123456789_-abcdefghijklmnop',ROOM='11111111-2222-4333-8444-555555555556',MATCH='66666666-7777-4888-9999-aaaaaaaaaaab';
const HOST='aaaaaaaa-0000-4000-8000-000000000001',GUEST='bbbbbbbb-0000-4000-8000-000000000002';
const deck=id=>({id,name:'Islands '+id,format:'Standard',cards:[{name:'Island',qty:60}],side:[]});
const friend=(id,name)=>({id,relationship:'accepted',display_name:name,username:name.toLowerCase()+'_x'});
const account=id=>{const s=makeSearchFixtures().state;s.decks=[deck(id)];s.activeDeck=id;
 return {user:{id,email:id+'@example.invalid'},profiles:{[HOST]:{display_name:'Host',username:'host_x'},[GUEST]:{display_name:'Guest',username:'guest_x'}},art:{},people:{[HOST]:[friend(GUEST,'Guest')],[GUEST]:[friend(HOST,'Host')]},items:{},rows:{[id]:{data:s,revision:1}},writes:[],storage:{'cardforge-v2':s,'cardforge-cloud-v1':{userId:id,revision:1,sig:workspaceSig(s)}}};};
const room={sent:null,status:'open',calls:[]};
async function rooms(page,who){
 await page.route('**/api/play/**',async route=>{const req=route.request(),url=new URL(req.url()),body=req.postData()?JSON.parse(req.postData()):null;room.calls.push(`${who} ${req.method()} ${url.pathname}`);
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/api/play/rooms'&&req.method()==='POST'){assert.equal(body.to,GUEST,'the challenge names the friend');room.sent=body;room.status='open';return json({roomId:ROOM,format:body.format,status:'open',expiresAt:Date.now()+300000,seat:'host',invite:INVITE,challenge:true},201);}
  if(url.pathname==='/api/play/rooms'&&req.method()==='GET')return json({challenges:who==='guest'&&room.sent&&room.status==='open'?[{roomId:ROOM,invite:INVITE,format:room.sent.format,expiresAt:Date.now()+300000,fromId:HOST,from:room.sent.player}]:[]});
  if(url.pathname==='/api/play/rooms/join'){assert.equal(body.invite,INVITE);if(body.deck){room.status='started';return json({matchId:MATCH,generation:'33333333-3333-4333-8333-333333333333',status:'initializing'},202);}return json({roomId:ROOM,format:room.sent.format,status:room.status,seat:'guest',challenge:true,opponent:room.sent.player});}
  if(url.pathname==='/api/play/rooms/'+ROOM&&req.method()==='DELETE'){room.status=who==='guest'?'declined':'cancelled';return route.fulfill({status:204});}
  if(url.pathname==='/api/play/rooms/'+ROOM)return json({roomId:ROOM,format:room.sent.format,status:room.status,seat:who==='host'?'host':'guest',challenge:true,...(room.status==='started'?{matchId:MATCH}:{})});
  if(url.pathname==='/api/play/matches/'+MATCH)return json({error:'match_not_found'},404);
  if(url.pathname==='/api/play/warm')return json({status:'unsupported'});
  return json({error:'unexpected'},404);});
}
const pick=async page=>{if(!await page.locator('[data-act="playSelectDeck"]').count()){await page.locator('.pl-format:not(.pl-mat)>summary').click();await page.locator('[data-play-value="Standard"]').click();}await page.locator('[data-act="playSelectDeck"]').first().click();};
const challenge=async hp=>{
 await hp.evaluate(()=>{location.hash='#community';});await hp.locator('[data-community-panel="friends"]').first().click();
 await hp.locator('[data-community-challenge]').first().waitFor();if(!room.shotFriends){room.shotFriends=true;await hp.screenshot({path:'/tmp/challenge-friends-1440.png'});}
 await hp.locator('[data-community-challenge]').first().click();
 await hp.locator('.pl-seat--friend h2',{hasText:'Challenge guest_x'}).waitFor();
 await pick(hp);await hp.locator('[data-act="playFriendCreate"]:not([disabled])',{hasText:'Send challenge'}).click();
 await hp.locator('.pl-seat--friend h2',{hasText:'Waiting for guest_x'}).waitFor();
};
try{
 const host=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(HOST)}),hp=host.page;await rooms(hp,'host');
 const guest=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(GUEST)}),gp=guest.page;await rooms(gp,'guest');
 await challenge(hp);
 assert.equal(await hp.locator('#playInviteLink').count(),0,'a challenge needs no link');
 await hp.screenshot({path:'/tmp/challenge-host-1440.png'});
 // The friend gets the letter wherever they are in the app.
 await gp.evaluate(()=>{location.hash='#home';});
 await gp.locator('.cs-challenge-letter').waitFor({timeout:30000});
 assert.match(await gp.locator('.cs-challenge-letter').innerText(),/host_x challenges you[\s\S]*Standard · friend match/);
 await gp.screenshot({path:'/tmp/challenge-letter-1440.png'});
 // The Multiplayer card carries the seal while the challenge waits; the letter fits a phone.
 await gp.evaluate(()=>{location.hash='#play';});await gp.locator('.pl-mode--sealed .pl-seal').waitFor();
 await gp.screenshot({path:'/tmp/challenge-play-home-1440.png'});
 await gp.setViewportSize({width:390,height:844});await gp.waitForTimeout(300);await gp.screenshot({path:'/tmp/challenge-letter-390.png'});
 const box=await gp.locator('.cs-challenge-letter').boundingBox();assert(box.x>=0&&box.x+box.width<=390,'the letter fits a phone');
 await gp.setViewportSize({width:1440,height:900});
 await gp.locator('.cs-letter-accept').click();
 await gp.locator('[data-act="playFriendJoin"]').waitFor();await pick(gp);
 await gp.locator('[data-act="playFriendJoin"]:not([disabled])',{hasText:'Accept'}).click();
 await gp.waitForFunction(()=>document.querySelector('#practicePlayerMat'));
 await hp.waitForFunction(()=>document.querySelector('#practicePlayerMat'),null,{timeout:8000});
 for(let i=0;i<40&&room.calls.filter(c=>c.endsWith('GET /api/play/matches/'+MATCH)).length<2;i++)await hp.waitForTimeout(100);
 assert(room.calls.includes('guest GET /api/play/matches/'+MATCH)&&room.calls.includes('host GET /api/play/matches/'+MATCH),'both players open the same match: '+room.calls.join(', '));
 // "Not now": the host's lobby says so kindly.
 const host2=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(HOST)}),hp2=host2.page;await rooms(hp2,'host');
 const guest2=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(GUEST)}),gp2=guest2.page;await rooms(gp2,'guest');
 await challenge(hp2);
 await gp2.locator('.cs-challenge-letter').waitFor({timeout:30000});await gp2.locator('.cs-letter-later').click();
 assert.equal(await gp2.locator('.cs-challenge-letter').count(),0);
 await hp2.locator('#playMatchStatus',{hasText:"Not this time. guest_x can't play right now."}).waitFor({timeout:8000});
 await hp2.screenshot({path:'/tmp/challenge-declined-1440.png'});
 console.log('friend challenge flow OK');
}finally{await browser.close();await server.close();}
