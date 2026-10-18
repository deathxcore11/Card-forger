// A three-way account merge, never a sum or a blind union of owned cards.
// The server revision orders account copies. Device clocks never choose a winner.
import { normalizeValueHistory } from './value-history.js';
const missing=Symbol('missing');
const clone=x=>x===missing?missing:structuredClone(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const stable=x=>Array.isArray(x)?x.map(stable):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const equal=(a,b)=>a===missing||b===missing?a===b:JSON.stringify(stable(a))===JSON.stringify(stable(b));
const get=(x,key)=>object(x)&&Object.hasOwn(x,key)?x[key]:missing;
const incidental=path=>path==='lastSavedAt'||path==='activeDeck'||/^tcg\.[^.]+\.activeDeck$/.test(path)||path==='settings.game';
const history=path=>path==='valueHistory'||/^tcg\.[^.]+\.valueHistory$/.test(path);
const recordList=path=>/^(?:tcg\.[^.]+\.)?(?:decks|collection|references|wishlist|notes)$/.test(path)||path==='settings.binders';
function keyed(values){
 if(!Array.isArray(values))return null;
 const map=new Map();
 for(const value of values){if(!object(value)||typeof value.id!=='string'||!value.id||map.has(value.id))return null;map.set(value.id,value);}
 return map;
}
// Useful for deciding whether recovered changes were authored content or only a
// price observation / current-screen preference. No editable preference is omitted.
export function workspaceContentSig(state){
 const clean=(value,path='')=>{
  if(Array.isArray(value))return value.map((x,i)=>clean(x,`${path}.${i}`));
  if(!object(value))return value;
  return Object.fromEntries(Object.keys(value).sort().filter(k=>!incidental(path?`${path}.${k}`:k)&&!history(path?`${path}.${k}`:k)).map(k=>[k,clean(value[k],path?`${path}.${k}`:k)]));
 };
 return JSON.stringify(clean(state));
}
function validSelections(state){
 for(const side of [state,...Object.values(state?.tcg||{})]){
  if(side && side.activeDeck && Array.isArray(side.decks) && !side.decks.some(d=>d.id===side.activeDeck))side.activeDeck=null;
 }
 return state;
}
export function mergeAccountWorkspaces(base,local,remote){
 const conflicts=[];
 const merge=(before,here,account,path='')=>{
  // Current game/deck remains a device navigation choice, never a conflict.
  if(incidental(path))return clone(here===missing?account:here);
  if(history(path)){
   const b=new Map(normalizeValueHistory(before===missing?[]:before).map(p=>[p.date,p]));
   const l=new Map(normalizeValueHistory(here===missing?[]:here).map(p=>[p.date,p]));
   const r=new Map(normalizeValueHistory(account===missing?[]:account).map(p=>[p.date,p]));
   return [...new Set([...b.keys(),...l.keys(),...r.keys()])].sort().map(date=>{
    const bv=b.get(date)??missing,lv=l.get(date)??missing,rv=r.get(date)??missing;
    if(rv===missing)return clone(lv===missing?bv:lv);
    if(lv===missing||equal(lv,rv))return clone(rv);
    return clone(equal(rv,bv)?lv:rv);
   });
  }
  if(object(here)&&object(account)&&(before===missing||object(before))){
   const result={};
   for(const key of new Set([...Object.keys(before===missing?{}:before),...Object.keys(here),...Object.keys(account)])){
    const value=merge(get(before,key),get(here,key),get(account,key),path?`${path}.${key}`:key);
    if(value!==missing)Object.defineProperty(result,key,{value,enumerable:true,writable:true,configurable:true});
   }
   return result;
  }
  if(equal(here,account))return clone(account);
  if(equal(here,before))return clone(account);
  if(equal(account,before))return clone(here);
  if(recordList(path)){
   const b=keyed(before===missing?[]:before),l=keyed(here),r=keyed(account);
   if(b&&l&&r){
    // Remote order is canonical; append only new local IDs. Baseline omissions
    // are tombstones: an unchanged old row cannot resurrect a deletion.
    // If deletion and editing genuinely compete, the remote choice wins.
    const order=[...r.keys(),...[...l.keys()].filter(id=>!r.has(id))],result=[];
    for(const id of order){
     const bv=b.get(id)??missing,lv=l.get(id)??missing,rv=r.get(id)??missing;
     let chosen;
     if(equal(lv,rv)||equal(lv,bv))chosen=rv;
     else if(equal(rv,bv))chosen=lv;
     else {chosen=rv;conflicts.push(`${path}[${id}]`);}
     if(chosen!==missing)result.push(clone(chosen));
    }
    return result;
   }
  }
  // Ambiguous lists and competing edits of a single record are not invented or
  // combined. The full local state is saved before this result can be applied.
  conflicts.push(path||'workspace');
  return clone(account);
 };
 const state=merge(base??missing,local,remote);
 // Without a trusted baseline, do not guess that old local records are additions.
 if(!base){
  const preserve=(l,r,path='')=>{
   if(history(path)||incidental(path))return merge(missing,l,r,path);
   if(!object(r))return clone(r);
   const out={};for(const key of Object.keys(r)){Object.defineProperty(out,key,{value:preserve(get(l,key),r[key],path?`${path}.${key}`:key),enumerable:true,writable:true,configurable:true});}return out;
  };
  return {state:validSelections(preserve(local,remote)),conflicts:workspaceContentSig(local)===workspaceContentSig(remote)?[]:['workspace'],hasBaseline:false};
 }
 return {state:validSelections(state),conflicts,hasBaseline:true};
}
