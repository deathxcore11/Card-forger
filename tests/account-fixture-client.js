// Hosted-browser fixture only. No real accounts, credentials or backend writes.
export function createClient(){
 const key='qa-account-model',read=()=>JSON.parse(localStorage.getItem(key)),write=m=>localStorage.setItem(key,JSON.stringify(m));
 let notify,hold=null;
 const user=()=>read().user,session=()=>user()?{user:user(),access_token:'synthetic-token'}:null;
 window.__accountFixture={
  switch(id){const m=read();m.user=id?{id,email:id+'@example.invalid'}:null;write(m);notify('SIGNED_IN',session());},
  holdProfile(id){hold={id};},release(){hold?.resolve?.();hold=null;},
  get model(){return read();},
 };
 return {auth:{onAuthStateChange(fn){notify=fn;},async getSession(){return {data:{session:session()}};},async signOut(){window.__accountFixture.switch(null);return {};},async signInWithPassword({email}){window.__accountFixture.switch(email.split('@')[0]);return {data:{session:session()}};}},
  from(table){let owner,revision,operation='read',payload;const q={select(){return q;},eq(k,v){if(k==='id'||k==='user_id')owner=v;if(k==='revision')revision=v;return q;},update(value){operation='update';payload=value;return q;},upsert(value){operation='update';payload=value;owner=value.id;return q;},insert(value){operation='insert';payload=value;owner=value.user_id;return q;},
   async maybeSingle(){const m=read(),data=table==='profiles'?m.profiles[owner]:m.rows[owner];if(table==='profiles'&&hold?.id===owner)await new Promise(r=>hold.resolve=r);return {data:structuredClone(data||null)};},
   async single(){return perform(true);},then(resolve,reject){return perform(false).then(resolve,reject);}};
   async function perform(single){const m=read();if(owner!==m.user?.id)throw Error('Fixture RLS rejected another account');if(table==='profiles'){m.profiles[owner]={...m.profiles[owner],...payload};write(m);return {data:m.profiles[owner]};}if(operation==='update'&&m.rows[owner]?.revision!==revision)return {data:[]};m.writes.push({owner,data:structuredClone(payload.data)});m.rows[owner]={...payload};write(m);return {data:single?{revision:payload.revision}:[{revision:payload.revision}]};}
   return q;
  },async rpc(name,{action,payload={}}={}){if(name!=='community_action')throw Error('Unmapped fixture RPC');const m=read(),id=m.user?.id;if(!id)throw Error('Sign in first');if(action==='lookup'){const query=String(payload.query||'').toLowerCase();const target=Object.keys(m.profiles).find(key=>key!==id&&(m.profiles[key].username?.toLowerCase()===query||(key+'@example.invalid').toLowerCase()===query));return {data:{person:target?{...m.profiles[target],...m.people?.[id]?.find(p=>p.id===target),id:target}:null}};}if(action==='profile'){if(!m.people?.[id]?.some(p=>p.id===payload.target&&p.relationship==='accepted'))throw Error('Accept a friend request first');return {data:{...m.profiles[payload.target],id:payload.target,items:m.items?.[payload.target]||[]}};}if(action==='save_art'){m.art[id]=payload;write(m);}if(action==='accept'){const p=m.people[id].find(p=>p.id===payload.target);p.relationship='accepted';write(m);}return {data:{art:m.art[id]||{},people:m.people?.[id]||[],items:m.items?.[id]||[],blocked:[]}};}
 };
}
