// Versus lobby, end to end in the real app with a synthetic room server: the host sends a challenge
// with no deck; the friend accepts; each picks a deck and taps Ready; the match opens on both seats.
import assert from 'node:assert/strict';
import {startServer,openSearchApp,makeSearchFixtures} from './search-fixtures.mjs';
import {workspaceSig} from '../cloud.js';
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const INVITE='AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde',ROOM='11111111-2222-4333-8444-555555555555',MATCH='66666666-7777-4888-9999-aaaaaaaaaaaa';
// Real account ids are UUIDs; the match client refuses anything else.
const HOST='aaaaaaaa-0000-4000-8000-000000000001',GUEST='bbbbbbbb-0000-4000-8000-000000000002';
const deck=id=>({id,name:'Islands '+id,format:'Standard',cards:[{name:'Island',qty:60}],side:[]});
const account=id=>{const s=makeSearchFixtures().state;s.decks=[deck(id)];s.activeDeck=id;
 return {user:{id,email:id+'@example.invalid'},profiles:{[HOST]:{display_name:'Host',username:'host_a'},[GUEST]:{display_name:'Guest',username:'guest_b'}},art:{},people:{},items:{},rows:{[id]:{data:s,revision:1}},writes:[],storage:{'cardforge-v2':s,'cardforge-cloud-v1':{userId:id,revision:1,sig:workspaceSig(s)}}};};

const pick=async page=>{if(!await page.locator('[data-act="playSelectDeck"]').count()){await page.locator('.pl-format:not(.pl-mat)>summary').click();await page.locator('[data-play-value="Standard"]').click();}await page.locator('[data-act="playSelectDeck"]').first().click();};
const R={joined:false,host:{deck:false,ready:false},guest:{deck:false,ready:false},started:false,calls:[]};
const view=role=>{const me=R[role],th=R[role==='host'?'guest':'host'];return {roomId:ROOM,format:'Standard',status:R.started?'started':'open',expiresAt:Date.now()+1800000,seat:role,lobby:true,guestJoined:R.joined,challenge:true,
 you:{hasDeck:me.deck,ready:me.ready},them:{joined:role==='host'?R.joined:true,hasDeck:th.deck,ready:th.ready},opponent:{name:role==='host'?'Guest':'Host'},...(R.started?{matchId:MATCH}:{})};};
async function rooms(page,role){
 await page.route('**/api/play/**',async route=>{const req=route.request(),url=new URL(req.url()),body=req.postData()?JSON.parse(req.postData()):null,p=url.pathname;R.calls.push(role+' '+req.method()+' '+p);
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/play/rooms'&&req.method()==='POST'){assert.equal(body.lobby,true);assert.equal(body.deck,undefined,'a lobby challenge carries no deck');assert.equal(body.to,GUEST);return json({...view('host'),invite:INVITE},201);}
  if(p==='/api/play/rooms'&&req.method()==='GET')return json({challenges:[]});
  if(p==='/api/play/rooms/join'){if(body.accept){R.joined=true;return json(view('guest'));}return json({roomId:ROOM,format:'Standard',status:'open',seat:'guest',lobby:true});}
  if(p==='/api/play/rooms/'+ROOM+'/ready'){const me=R[role];if(body.deck){me.deck=true;me.ready=false;}if(body.ready!==undefined)me.ready=body.ready;
   if(R.host.ready&&R.guest.ready){R.started=true;return json({matchId:MATCH,generation:'33333333-3333-4333-8333-333333333333',status:'initializing'},202);}return json(view(role));}
  if(p==='/api/play/rooms/'+ROOM)return json(view(role));
  if(p==='/api/play/matches/'+MATCH)return json({error:'match_not_found'},404);
  return json({error:'unexpected'},404);});
}
try{
 const host=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(HOST)}),hp=host.page;await rooms(hp,'host');
 await hp.evaluate(()=>{location.hash='#play';});await hp.locator('[data-play-style="social"]').click();
 // The friend's challenge button (the Friends list calls A.playChallenge with the friend).
 await hp.evaluate(id=>{const b=document.createElement('button');b.id=id;b.dataset.act='playChallenge';b.textContent='x';b.style.cssText='position:fixed;top:0;left:0;z-index:99999';document.body.append(b);b.username='guest_b';b.label='Guest';},GUEST);
 await hp.locator('button[data-act="playChallenge"]').click();
 await pick(hp);
 const send=hp.locator('[data-act="playFriendCreate"]:not([disabled])');await send.waitFor();assert.match(await send.innerText(),/Send challenge/);await send.click();
 await hp.locator('[data-act="playFriendReady"]',{hasText:'Waiting to accept'}).waitFor();
 // The friend accepts: both land in the lobby.
 const guest=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(GUEST)}),gp=guest.page;await rooms(gp,'guest');
 await gp.evaluate(i=>{location.hash='#play/join/'+i;},INVITE);
 await gp.locator('[data-act="playFriendReady"]').waitFor();
 await hp.locator('.pl-challenge-note',{hasText:'Choosing a deck'}).waitFor({timeout:8000});
 await pick(gp);await gp.locator('[data-act="playFriendReady"]:not([disabled])').click();
 await gp.locator('[data-act="playFriendReady"]',{hasText:'Ready ✓'}).waitFor();
 await hp.locator('.pl-challenge-note',{hasText:'Ready ✓'}).waitFor({timeout:8000});
 await gp.screenshot({path:'/tmp/friend-lobby-guest-1440.png'});await hp.screenshot({path:'/tmp/friend-lobby-host-1440.png'});
 await hp.locator('[data-act="playFriendReady"]:not([disabled])').click();
 await hp.waitForFunction(()=>document.querySelector('#practicePlayerMat'),null,{timeout:8000});
 await gp.waitForFunction(()=>document.querySelector('#practicePlayerMat'),null,{timeout:8000});
 console.log('versus lobby flow OK:',R.calls.join(' | '));
}finally{await browser.close();await server.close();}
