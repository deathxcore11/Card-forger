import {createForgeSession,localBridgeUrl} from './forge-session.mjs';
import {mountForgeTable} from './forge-table.mjs';
const form=document.getElementById('connectionForm'),status=document.getElementById('connectStatus'),root=document.getElementById('table'),screen=document.getElementById('connect'),file=document.getElementById('connectionFile'),url=document.getElementById('bridgeUrl'),token=document.getElementById('bridgeToken'),button=document.getElementById('connectButton');
let session=null,table=null;
const key=name=>String(name).trim().toLocaleLowerCase('en-US'),artwork=new Map();
// Public presentation catalogs are independent of the private match snapshot.
// No card-name lookup requests, bearer headers or gameplay state go to an art service.
for(const path of ['../phase-engine/ui-review-catalog.json','./artwork.json'])try{const response=await fetch(path,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});if(response.ok)for(const card of await response.json())if(card.id&&card.name)artwork.set(key(card.name),{card,finish:null,source:'public-reference-printing',badges:[]});}catch{}
const local=location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname);
if(!local){status.textContent='This proof must be served from localhost or 127.0.0.1. Do not paste its token into a hosted page.';button.disabled=true;file.disabled=true;token.disabled=true;}
file.addEventListener('change',async()=>{try{const chosen=file.files[0];if(!chosen)return;if(chosen.size>4096)throw Error('Not a valid connection file.');const config=JSON.parse(await chosen.text());url.value=localBridgeUrl(config.baseUrl);if(typeof config.token!=='string'||!config.token)throw Error('The connection file has no token.');token.value=config.token;status.textContent='Local connection loaded. Ready to connect.';}catch(e){status.textContent=e.message;}finally{file.value='';}});
const disconnect=()=>{table?.destroy();table=null;session?.close();session=null;root.hidden=true;screen.hidden=false;status.textContent='Disconnected from the browser. The native process was not conceded or changed.';button.disabled=false;};
form.addEventListener('submit',async e=>{e.preventDefault();if(!local||session)return;button.disabled=true;status.textContent='Connecting to the local native match…';
 try{session=createForgeSession({baseUrl:url.value,token:token.value,lookupArtwork:name=>artwork.get(key(name))});token.value='';table=mountForgeTable(root,{session,onExit:disconnect});await session.start();screen.hidden=true;root.hidden=false;status.textContent='';}
 catch(e){table?.destroy();table=null;session?.close();session=null;status.textContent=`Could not connect: ${e.message}`;button.disabled=false;}
});
window.addEventListener('pagehide',()=>session?.close());
