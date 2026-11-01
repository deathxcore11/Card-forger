import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgeHostClient,createFriendRooms,friendInviteLink,friendInviteFromHash,friendPlayerCard,FORGE_REVISION} from './play-forge-host-client.js';
import {projectForge} from './experiments/forge-proof/forge-session.mjs';

const GUEST='11111111-1111-4111-8111-111111111112';
const ROOM='44444444-4444-4444-8444-444444444444';
const MATCH='22222222-2222-4222-8222-222222222222';
const GENERATION='33333333-3333-4333-8333-333333333333';
const SCHEMA='cardstashy.forge-proof.v1';
const INVITE='A'.repeat(43);
const deck={id:'d1',name:'My deck',format:'Commander',commander:'Commander Name',cards:[{name:'Mountain',qty:99},{name:'Commander Name',qty:1}],side:[]};

test('friend rooms open, peek, join, read and cancel through the host, sending only the chosen deck',async()=>{
 const calls=[];
 const rooms=createFriendRooms({getAccessToken:async()=>'fixture.account.token',fetchImpl:async(path,init)=>{
  calls.push({path,method:init.method,body:init.body&&JSON.parse(init.body)});
  if(path==='/api/play/rooms')return Response.json({roomId:ROOM,format:'Commander',status:'open',seat:'host',invite:INVITE},{status:201});
  if(path==='/api/play/rooms/join'&&!JSON.parse(init.body).deck)return Response.json({roomId:ROOM,format:'Commander',status:'open',seat:'guest'});
  if(path==='/api/play/rooms/join')return Response.json({matchId:MATCH,generation:GENERATION,status:'initializing'},{status:202});
  if(init.method==='DELETE')return new Response(null,{status:204});
  return Response.json({roomId:ROOM,status:'started',matchId:MATCH,seat:'host'});
 }});
 const opened=await rooms.open('Commander',deck);
 assert.equal(opened.invite,INVITE);assert.equal(calls[0].body.format,'Commander');assert.equal(calls[0].body.deck.cards.length,2);
 assert.equal((await rooms.peek(INVITE)).seat,'guest');assert.deepEqual(Object.keys(calls[1].body),['invite']);
 assert.equal((await rooms.join(INVITE,'Commander',deck)).matchId,MATCH);
 assert.equal((await rooms.read(ROOM)).matchId,MATCH);assert.equal(calls[3].method,'GET');
 assert.equal(await rooms.cancel(ROOM),null);assert.equal(calls[4].method,'DELETE');
 await assert.rejects(rooms.open('Vintage',deck),/FRIEND_FORMAT_UNSUPPORTED/);
 await assert.rejects(rooms.peek('not-an-invite'),/This invite is no longer valid/);
});

test('room refusals read as plain sentences',async()=>{
 const rooms=createFriendRooms({getAccessToken:async()=>'t',fetchImpl:async()=>Response.json({error:'room_full'},{status:409})});
 await assert.rejects(rooms.peek(INVITE),e=>e.code==='room_full'&&e.message==='This room already has two players.'&&e.status===409);
});

test('invite links round-trip and reject anything else',()=>{
 assert.equal(friendInviteLink(INVITE),'https://cardstashy.com/#play/join/'+INVITE);
 assert.equal(friendInviteFromHash('#play/join/'+INVITE),INVITE);
 for(const bad of ['#play/join/short','#play/join/'+INVITE+'x','#deck/'+INVITE,''])assert.equal(friendInviteFromHash(bad),null);
});

test('a joined friend match is opened by id, learns its generation, and sees its own seat',async()=>{
 const client=createForgeHostClient({readAccount:()=>({user:{id:GUEST},accountGeneration:1}),getAccessToken:async()=>'fixture.account.token',fetchImpl:async()=>Response.json({matchId:MATCH,generation:GENERATION,status:'running',snapshot:{schema:SCHEMA,forgeRevision:FORGE_REVISION,revision:1,viewer:1,players:[{id:0,isViewer:false},{id:1,isViewer:true}],pregame:{schema:'cardstashy.forge-pregame.v1',firstPlayerId:0,selection:'random',playStyle:'quick'}}})});
 client.attach(MATCH);
 const read=await client.read();
 assert.equal(read.snapshot.viewer,1);assert.equal(client.status().allocation.generation,GENERATION);
 assert.throws(()=>client.attach(MATCH),/MATCH_ALREADY_OPEN/);
});

test('each player sends only their name and picture, and an older server still opens the room',async()=>{
 const card=friendPlayerCard({displayName:' deathxcore11\u0007 ',username:'dx',avatarArt:{game:'mtg',cardId:'c',name:'Art',image:'https://cards.scryfall.io/art_crop/a.jpg',ratio:1.4,zoom:9,x:.3,y:.6},avatarUrl:'https://x/y.png',email:'never@sent'});
 assert.deepEqual(card,{name:'deathxcore11',image:'https://cards.scryfall.io/art_crop/a.jpg',crop:{ratio:1.4,zoom:4,x:.3,y:.6}});
 assert.deepEqual(friendPlayerCard({displayName:'Photo',avatarUrl:'https://p/x.png'}),{name:'Photo',image:'https://p/x.png',crop:null});
 assert.equal(friendPlayerCard({}),null);
 const bodies=[];let old=true;
 const rooms=createFriendRooms({getAccessToken:async()=>'fixture.account.token',fetchImpl:async(path,init)=>{const body=JSON.parse(init.body);bodies.push(body);
  if(old&&body.player)return Response.json({error:'invalid_room'},{status:400});
  return Response.json({roomId:ROOM,format:'Commander',status:'open',seat:'host',invite:INVITE,opponent:null},{status:201});}});
 await rooms.open('Commander',deck,card);
 assert.deepEqual(bodies.map(b=>!!b.player),[true,false]);
 old=false;bodies.length=0;await rooms.open('Commander',deck,card);
 assert.deepEqual(bodies[0].player,card);assert.equal(bodies.length,1);
});

test('a friend match names the other player by the name they chose',()=>{
 const raw=()=>({schema:'cardstashy.forge-proof.v1',status:'running',revision:1,viewer:0,players:[{id:0,name:'Player 1',isViewer:true,life:40,zones:{}},{id:1,name:'Player 2',isViewer:false,life:40,zones:{}}],stack:[]});
 assert.equal(projectForge(raw(),{rivalName:'ldwd11'}).surface.players.find(p=>p.seat===1).label,'ldwd11');
 assert.equal(projectForge(raw()).surface.players.find(p=>p.seat===1).label,'CPU');
});
