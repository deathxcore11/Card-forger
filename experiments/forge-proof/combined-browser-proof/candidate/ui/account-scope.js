// Personal device records share the workspace's account boundary.
let scope=null,legacy;
const LEGACY='cardstashy-personal-record-owner-v1';
export function setAccountScope(owner,previousOwner=null){
 try{
  const saved=localStorage.getItem(LEGACY);
  legacy=saved===null?previousOwner||'guest':JSON.parse(saved);
  if(saved===null)localStorage.setItem(LEGACY,JSON.stringify(legacy));
 }catch{legacy=previousOwner||'guest';}
 scope=owner||'guest';
}
export function privateKey(key){
 if(scope===null)return key;
 const scoped=key+'::account:'+scope;
 if(scope===legacy){
  try{if(localStorage.getItem(scoped)===null){const value=localStorage.getItem(key);if(value!==null)localStorage.setItem(scoped,value);}}catch{}
 }
 return scoped;
}
