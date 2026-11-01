// Friend invite, end to end in the real app with a synthetic room server: the host makes an
// invite and copies the link with a real mouse click; a second account opens the link, picks a
// deck, joins, and opens the started match on its own seat.
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
const server_={joined:false,calls:[],players:[]};
async function rooms(page){
 await page.route('**/api/play/**',async route=>{const req=route.request(),url=new URL(req.url()),body=req.postData()?JSON.parse(req.postData()):null;server_.calls.push(`${req.method()} ${url.pathname}`);if(body?.player)server_.players.push(body.player.name);
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/api/play/rooms'&&req.method()==='POST'){assert.equal(body.format,'Standard');return json({roomId:ROOM,format:'Standard',status:'open',expiresAt:Date.now()+1800000,seat:'host',invite:INVITE},201);}
  if(url.pathname==='/api/play/rooms/join'){assert.equal(body.invite,INVITE);if(body.deck){server_.joined=true;return json({roomId:ROOM,format:'Standard',status:'started',matchId:MATCH,seat:'guest'});}return json({roomId:ROOM,format:'Standard',status:'open',seat:'guest'});}
  if(url.pathname==='/api/play/rooms/'+ROOM)return json(server_.joined?{roomId:ROOM,format:'Standard',status:'started',matchId:MATCH,seat:'host'}:{roomId:ROOM,format:'Standard',status:'open',seat:'host'});
  if(url.pathname==='/api/play/matches/'+MATCH)return json({error:'match_not_found'},404);
  return json({error:'unexpected'},404);});
}
const pick=async page=>{if(!await page.locator('[data-act="playSelectDeck"]').count()){await page.locator('.pl-format:not(.pl-mat)>summary').click();await page.locator('[data-play-value="Standard"]').click();}await page.locator('[data-act="playSelectDeck"]').first().click();};
try{
 const host=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(HOST)}),hp=host.page;
 await hp.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:server.base});await rooms(hp);
 await hp.evaluate(()=>{location.hash='#play';});await hp.locator('[data-play-style="social"]').click();
 await pick(hp);await hp.locator('[data-act="playFriendCreate"]:not([disabled])').click();
 await hp.locator('#playInviteLink').waitFor();
 assert.equal(await hp.locator('#playInviteLink').inputValue(),'https://cardstashy.com/#play/join/'+INVITE,'the link itself is shown');
 await hp.locator('[data-act="playFriendCopy"]').click();// a real mouse click, as on desktop
 await hp.locator('[data-act="playFriendCopy"]',{hasText:'Link copied'}).waitFor();
 assert.equal(await hp.evaluate(()=>navigator.clipboard.readText()),'https://cardstashy.com/#play/join/'+INVITE);
 await hp.screenshot({path:'/tmp/friend-invite-host-1440.png'});
 const guest=await openSearchApp(browser,server.base,{width:1440,height:900,hasTouch:false,accountFixture:account(GUEST)}),gp=guest.page;await rooms(gp);
 await gp.evaluate(i=>{location.hash='#play/join/'+i;},INVITE);
 await gp.locator('[data-act="playFriendJoin"]').waitFor();await pick(gp);
 await gp.locator('[data-act="playFriendJoin"]:not([disabled])').click();
 await gp.waitForFunction(()=>document.querySelector('#practicePlayerMat'));
 await gp.waitForTimeout(1500);
 assert(server_.calls.includes('GET /api/play/matches/'+MATCH),'the guest opens the started match: '+server_.calls.join(', '));
 // The host's 2 s room check sees the match and opens it on the host's seat.
 await hp.waitForFunction(()=>document.querySelector('#practicePlayerMat'),null,{timeout:8000});
 for(let i=0;i<40&&server_.calls.filter(c=>c==='GET /api/play/matches/'+MATCH).length<2;i++)await hp.waitForTimeout(100);// the mat opens a moment before its first read
 assert(server_.calls.filter(c=>c==='GET /api/play/matches/'+MATCH).length>=2,'both players open the same match');
 assert.deepEqual(server_.players,['Host','Guest'],'each player sends the name the other will see');
 console.log('friend invite flow OK:',server_.calls.join(' | '));
}finally{await browser.close();await server.close();}
