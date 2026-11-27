// ---------- Chimera rule: any two monsters make a third. Body from one parent; head, missing wings or tail, and glow colour from the other.
function chiBuild(id){const M={parts:[],halos:[],anim:null,
    part(name,pv,fn,o={}){const v=new V();if(o.s){v.sym=false;v.sx=o.s}fn(v);this.parts.push({name,pv,v,parent:o.parent})},
    pair(name,pv,fn,o={}){this.part(name+'L',pv,fn,{...o,s:1});this.part(name+'R',[-pv[0],pv[1],pv[2]],fn,{...o,s:-1})},
    halo(part,pos,color,size){this.halos.push({part,pos,color,size})}};DEFS[id].mk(M);return M}
function chiBox(ps){const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(const p of ps)p.v.each((x,y,z)=>{mn[0]=Math.min(mn[0],x);mn[1]=Math.min(mn[1],y);mn[2]=Math.min(mn[2],z);mx[0]=Math.max(mx[0],x);mx[1]=Math.max(mx[1],y);mx[2]=Math.max(mx[2],z);return null});
  return{mn,mx,dim:Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])+1,c:[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2]}}
function chiCols(ps,glow){const n=new Map();for(const p of ps)p.v.each((x,y,z,c)=>{if(!!(c&0x1000000)===glow&&c!==INK&&c!==WHITE)n.set(c,(n.get(c)||0)+1);return null});return[...n].sort((a,b)=>b[1]-a[1]).map(e=>e[0])}
function chiScale(v,from,to,k,map){const b=chiBox([{v}]),o=new V();o.sym=false;const lo=i=>Math.floor(to[i]+(b.mn[i]-0.5-from[i])*k),hi=i=>Math.ceil(to[i]+(b.mx[i]+0.5-from[i])*k);
  for(let x=lo(0);x<=hi(0);x++)for(let y=lo(1);y<=hi(1);y++)for(let z=lo(2);z<=hi(2);z++){const c=v.get(Math.round(from[0]+(x-to[0])/k),Math.round(from[1]+(y-to[1])/k),Math.round(from[2]+(z-to[2])/k));if(c)o.put(x,y,z,map?map(c):c)}return o}
const chiName=id=>DEFS[id].name.replace(/, form \d/,'');
function chimera(a,b){const isH=p=>/^(head|jaw)/.test(p.name)||/^(head|jaw)/.test(p.parent||'');
  // the parent with a separate head gives the body when only one has one
  let A0=chiBuild(a),B0=chiBuild(b);if(!A0.parts.some(p=>p.name==='head')&&B0.parts.some(p=>p.name==='head')){const t=a;a=b;b=t}
  const id='chi_'+a+'_'+b;if(DEFS[id])return id;
  def(id,chiName(b).split(' ')[0]+' '+chiName(a).split(' ').pop(),'chimera',M=>{const A=chiBuild(a),B=chiBuild(b);
    const aH=A.parts.find(p=>p.name==='head'),bH=B.parts.find(p=>p.name==='head'),swap=aH&&bH;
    const aBody=A.parts.filter(p=>!isH(p)),bBody=B.parts.filter(p=>!isH(p)),ca=chiCols(swap?aBody:A.parts,false),cb=chiCols(B.parts,false),gb=chiCols(B.parts,true)[0],hb=B.halos[0];
    // colour: with a head swap the body keeps its main colour and takes the other parent's main colour as its second; without one it takes both
    const cm=new Map();if(swap){if(ca[1]!=null&&cb[0]!=null)cm.set(ca[1],cb[0])}else{if(cb[0]!=null)cm.set(ca[0],cb[0]);if(ca[1]!=null&&cb[1]!=null)cm.set(ca[1],cb[1])}
    const rc=c=>(c&0x1000000)&&gb?gb:(cm.has(c)?cm.get(c):c);
    for(const p of A.parts){if(swap&&isH(p))continue;p.v.each((x,y,z,c)=>{const n=rc(c);return n===c?null:n});M.parts.push(p)}
    if(swap){const k=chiBox(A.parts.filter(isH)).dim/chiBox(B.parts.filter(isH)).dim;
      for(const p of B.parts.filter(isH)){const pv=[0,1,2].map(i=>aH.pv[i]+(p.pv[i]-bH.pv[i])*k);M.parts.push({name:p.name,pv,v:chiScale(p.v,bH.pv,aH.pv,k),parent:p.parent})}
      for(const h of B.halos)if(isH({name:h.part}))M.halos.push({part:h.part,pos:[0,1,2].map(i=>aH.pv[i]+(h.pos[i]-bH.pv[i])*k),color:h.color,size:h.size*k})}
    // wings, fins, tail, arms or claws the body does not have come over from the other parent, scaled to the body
    const ba=chiBox(aBody.filter(p=>p.name==='body')),bb=chiBox(bBody.filter(p=>p.name==='body')),kb=ba.dim/bb.dim,extra=[];
    for(const g of['wing','fin','tail','arm','claw'])if(!A.parts.some(p=>p.name.startsWith(g)))for(const p of B.parts)if(p.name.startsWith(g)&&!A.parts.some(q=>q.name===p.name)){
      const pv=[0,1,2].map(i=>ba.c[i]+(p.pv[i]-bb.c[i])*kb);M.parts.push({name:p.name,pv,v:chiScale(p.v,p.pv,pv,kb),parent:undefined});extra.push(p.name)}
    for(const h of A.halos)if(M.parts.some(p=>p.name===h.part))M.halos.push({part:h.part,pos:h.pos,color:hb?hb.color:h.color,size:h.size});
    const names=new Set(M.parts.map(p=>p.name)),need=[...new Set([...A.parts,...B.parts].map(p=>p.name))].filter(n=>!names.has(n)),dum=()=>({rotation:{},position:{},scale:{setScalar(){}}});
    M.anim=(p,t)=>{for(const n of need)if(!p[n])p[n]=dum();if(A.anim)A.anim(p,t);if(extra.length){const w=Math.sin(t*5);for(const n of extra){const s=/R$/.test(n)?-1:1;if(/^(wing|fin)/.test(n))p[n].rotation.z=s*(0.15+0.45*w);else if(/^tail/.test(n))p[n].rotation.y=0.4*Math.sin(t*3);else p[n].rotation.x=0.2*Math.sin(t*2+s)}}}
  },'Chimera of '+chiName(a)+' and '+chiName(b)+'. Built by rule, not by hand.');return id}
