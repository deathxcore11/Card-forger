// ---------- Fusion engine: any two creatures fuse, and the child can fuse again, up to rank 4 (Epic).
// The first parent is the Line (body and name carry on). The second is grafted into the next free slot: head, wings, tail, arms. When no slot fits it gives pattern and glow only.
const FX={},FX_RANK=['Basic','Fusion','Greater Fusion','Super Fusion','Epic Fusion'],FX_SLOTS=[['head',/^(head|jaw)/],['wings',/^(wing|fin)/],['tail',/^tail/],['arms',/^(arm|claw)/]];
// attack recipes for the creatures in the lab: delivery, shape, timing, element, rider
const FX_AB={hat:['Pulse','cone','at once','Fire','spreads on death'],wyv:['Bolt','line','at once','Fire','pierces'],gol:['Plant','zone','on a timer','Earth','taunts'],lynx:['Dash','one target','after a wind-up','Ice','hunts elites'],rime:['Pulse','ring','at once','Ice','splits in three'],
  firefly:['Beam','line','held','Light','heals you on kills'],shade:['Bite','one target','at once','Dark','jumps on death'],newt:['Lob','chain','on a timer','Lightning','marks targets'],familiar:['Bite','one target','at once','Lightning','sets off marks'],mole:['Drop','zone','after a wind-up','Earth','staggers'],
  toad:['Lob','zone','on a timer','Poison','leaves a puddle'],hedgehog:['Dash','line','when you are hurt','Poison','fires spines'],ferret:['Dash','chain','at once','Wind','bounces between enemies'],ray:['Beam','line','held','Wind','pulls enemies in'],imp:['Bite','one target','at once','Fire','costs 1 LP, hits 40% harder'],
  bonepup:['Bite','one target','at once','Dark','bites harder at low LP'],crab:['Bite','one target','at once','Earth','kills can drop a coin'],kit:['Bolt','chain','on a timer','Light','grows with coins held']};
const FX_NAMED={tyrant:['hat','wyv'],strix:['newt','familiar'],colossus:['rime','lynx'],gloam:['firefly','shade'],tortoise:['gol','mole'],hydra:['toad','hedgehog'],roc:['ferret','ray'],manticore:['imp','bonepup'],hoard:['crab','kit']};
const FX_BIG={'one target':'line',line:'cone',cone:'ring',ring:'zone',zone:'wide zone','wide zone':'huge zone',chain:'long chain','long chain':'endless chain'};
const FX_REACT={'Fire+Ice':'Steam','Fire+Lightning':'Overload','Fire+Poison':'Blast','Fire+Wind':'Firestorm','Earth+Fire':'Magma','Ice+Lightning':'Shatter','Ice+Poison':'Preserve','Ice+Wind':'Blizzard','Earth+Ice':'Permafrost','Lightning+Poison':'Conduct','Lightning+Wind':'Thunderhead','Earth+Lightning':'Magnetise','Poison+Wind':'Miasma','Earth+Poison':'Overgrowth','Earth+Wind':'Sandstorm','Dark+Light':'Eclipse'};
const fxReact=(a,b)=>{const k=[a,b].sort().join('+');return FX_REACT[k]||(a==='Light'||b==='Light'?'Prism':a==='Dark'||b==='Dark'?'Hex':null)};
const fxSpecies=id=>id.replace(/\d$/,'');
function fxMix(A,B){const els=[...new Set([...A.els,...B.els])].slice(0,3),riders=[...new Set([...B.riders,...A.riders])].slice(0,4);return{delivery:A.delivery,shape:FX_BIG[B.shape]||B.shape,timing:A.timing,els,riders}}
function fxAb(id){const sp=fxSpecies(id);if(FX_AB[sp]){const q=FX_AB[sp];return{delivery:q[0],shape:q[1],timing:q[2],els:[q[3]],riders:[q[4]]}}if(FX_NAMED[id]){const n=FX_NAMED[id];return fxMix(fxAb(n[0]),fxAb(n[1]))}return{delivery:'Bite',shape:'one target',timing:'at once',els:[],riders:[]}}
function fxOf(id){if(FX[id])return FX[id];const named=FX_NAMED[id];return FX[id]={line:id,rank:named?1:0,slots:{},anc:named?named.slice():[fxSpecies(id)],ab:fxAb(id),pts:named?550:250}}
function fxSentence(ab){const r=[];for(let i=0;i<ab.els.length;i++)for(let j=i+1;j<ab.els.length;j++){const x=fxReact(ab.els[i],ab.els[j]);if(x&&!r.includes(x))r.push(x)}return{parts:[['Delivery',ab.delivery],['Shape',ab.shape],['Timing',ab.timing],['Element',ab.els.join(' + ')||'none'],['Riders',ab.riders.join(', ')||'none']],react:r}}
function fxClean(v){v.each((x,y,z)=>v.get(x+1,y,z)||v.get(x-1,y,z)||v.get(x,y+1,z)||v.get(x,y-1,z)||v.get(x,y,z+1)||v.get(x,y,z-1)?null:0)}
// which slots would b fill on a? Up to two free ones per fusion, in the order head, wings, tail, arms. (none = hide, growths and glow only)
function fxSlots(a,b,A,B){const fa=fxOf(a),has=(M,re)=>M.parts.some(p=>re.test(p.name)||re.test(p.parent||'')),out=[];for(const[s,re]of FX_SLOTS){if(fa.slots[s]||!has(B,re))continue;if(s==='head'&&!(A.parts.some(p=>p.name==='head')&&B.parts.some(p=>p.name==='head')))continue;out.push(s);if(out.length>=2)break}return out}
function fxSlot(a,b,A,B){return fxSlots(a,b,A,B)[0]||null}
const fxH=s=>{let h=7;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h},FX_CREST=/^(tower|wisp|ring|frill|crest|horn|shell|spike|mane|crown)/,FX_HIDE=['saddle','haunch','stripes','patches'],FX_GROW=['mantle','rump','none'];
const FX_ELS=['Fire','Ice','Lightning','Poison','Wind','Earth','Light','Dark'],FX_SECRET=['split','puddle','chain','pull','heal','jump','coin'];
function fuse(a,b,rng=Math.random){const fa=fxOf(a),fb=fxOf(b),rank=Math.max(fa.rank,fb.rank)+1;if(rank>4||a===b)return null;const id='fx_'+a+'__'+b;if(DEFS[id])return id;
  const slots=fxSlots(a,b,chiBuild(a),chiBuild(b)),slot=slots[0]||null,reOf=s=>FX_SLOTS.find(x=>x[0]===s)[1],inS=(p,s)=>{const re=reOf(s);return re.test(p.name)||re.test(p.parent||'')},h0=fxH(id),hide=FX_HIDE[h0%4],grow=FX_GROW[(h0>>>3)%3];
  // name: the newest two graft words, the Line's own last word, and a title at the top two ranks, so a fusion of fusions never repeats its parent's name
  const core=fa.core||chiName(a).split(' ').pop(),gw=(fb.words&&fb.words[0])||chiName(b).split(' ')[0],words=[...new Set([gw,...(fa.words||[])])].filter(w=>w!==core).slice(0,3),name=words.slice(0,2).join('-')+' '+core+(rank===3?' Prime':rank===4?' Apex':'');
  // mutation roll: 80% standard, 15% Twin-Core, 5% Prismatic. The game passes the run's seeded dice as rng.
  const ab=fxMix(fa.ab,fb.ab),m=rng();let mut=null;if(m<.05){const el=FX_ELS.filter(x=>!ab.els.includes(x)),rd=FX_SECRET;mut={k:'prism',el:el[rng()*el.length|0],rider:rd[rng()*rd.length|0]}}else if(m<.2)mut={k:'twin'};
  FX[id]={line:fa.line,rank,slots:{...fa.slots,...Object.fromEntries(slots.map(s=>[s,b]))},anc:[...fa.anc,...fb.anc],ab,pts:Math.round((fa.pts+fb.pts)*1.1),slot,newSlots:slots,from:[a,b],mut,core,words,inf:{},hide,grow};
  def(id,name,'chimera',M=>{const A=chiBuild(a),B=chiBuild(b),bod=M2=>{const q=M2.parts.filter(p=>p.name==='body');return chiBox(q.length?q:M2.parts.filter(p=>!/^(head|jaw)/.test(p.name)))},ba=bod(A),bb=bod(B);
    // a small graft never replaces a grand limb: when the Line's own limb is clearly the bigger one for its body, the Line keeps it and it takes the graft's colours instead
    const plan=slots.map(s=>{const graft=B.parts.filter(p=>inS(p,s)),gA=A.parts.filter(p=>inS(p,s));return{s,graft,gA,infuse:s!=='head'&&gA.length>0&&chiBox(graft).dim/bb.dim<.7*chiBox(gA).dim/ba.dim}}),gone=new Set();for(const q of plan)if(!q.infuse)q.gA.forEach(p=>gone.add(p));
    const keep=A.parts.filter(p=>!gone.has(p)),ca=chiCols(keep,false),cb=chiCols(B.parts,false),gb=chiCols(B.parts,true)[0],hb=B.halos[0];
    // three colours: the Line's main colour, the graft's main colour as the second, one glow
    const am=new Map();if(ca[1]!=null&&cb[0]!=null&&cb[0]!==ca[0])am.set(ca[1],cb[0]);const bm=new Map();if(cb[1]!=null&&ca[0]!=null&&cb[1]!==cb[0])bm.set(cb[1],ca[0]);
    const rc=m=>c=>(c&0x1000000)?(gb||c):(m.has(c)?m.get(c):c),f=rc(bm);
    for(const p of keep){const g=rc(am);p.v.each((x,y,z,c)=>{const n=g(c);return n===c?null:n});M.parts.push(p)}
    // ---- one of a kind body. The graft's own body is laid over the Line's at the same size, and two things come across from it.
    // HIDE: part of the Line's body wears the graft's real surface, block for block (saddle, haunch, stripes or patches, fixed by the pair).
    // GROWTH: what the graft's body has that the Line's lacks grows out of the Line there (mantle = along the back, rump = the hind end), so shells, spines, mushrooms and humps carry over.
    {const AB=keep.filter(p=>p.name==='body'),BB=B.parts.filter(p=>p.name==='body');if(AB.length&&BB.length){const kb=Math.max(.3,Math.min(2.6,ba.dim/bb.dim*.92)),W=[0,1,2].map(i=>ba.mx[i]-ba.mn[i]||1),to=[ba.c[0],ba.mn[1],ba.c[2]],from=[bb.c[0],bb.mn[1],bb.c[2]];
      const sB=(x,y,z)=>{for(const p of BB){const c=p.v.get(Math.round(from[0]+(x-to[0])/kb),Math.round(from[1]+(y-to[1])/kb),Math.round(from[2]+(z-to[2])/kb));if(c)return c}return 0},eye=c=>c===INK||c===WHITE||(c&0x1000000);
      const uvw=(x,y,z)=>[(x-ba.mn[0])/W[0],(y-ba.mn[1])/W[1],(z-ba.mn[2])/W[2]],edge=(x,y,z)=>(hash3(R(x/3),R(y/3),R(z/3))-.5)*.16;
      const inHide=(x,y,z)=>{const[u,v,w]=uvw(x,y,z),e=edge(x,y,z);return hide==='saddle'?v+e>.56&&w<.8:hide==='haunch'?w+e<.46:hide==='stripes'?v>.2&&((w*6.5+e*2)|0)%2===0:hash3(R(x/5)+h0%97,R(y/5),R(z/5))>.52};
      const inGrow=(x,y,z)=>{const[u,v,w]=uvw(x,y,z);return grow==='mantle'?v>.5&&w<.72&&w>.05:grow==='rump'?w<.42&&v>.18:false};
      const own=new Set();for(const p of AB)p.v.each((x,y,z)=>{own.add(K(x,y,z));return null});
      for(const p of AB)p.v.each((x,y,z,c)=>{if(eye(c)||!inHide(x,y,z))return null;let n=sB(x,y,z);if(!n)n=sB(Math.round(x*.6),y,z)||sB(0,y,z)||cb[0];return n&&!(n===INK||n===WHITE)?f(n):null});
      if(grow!=='none'){const oth=new Set();for(const p of keep)if(p.name!=='body')p.v.each((x,y,z)=>{oth.add(K(x,y,z));return null});const v=AB[0].v,px=Math.ceil(W[0]*.2),py=Math.ceil(W[1]*.45);
        for(let x=ba.mn[0]-px;x<=ba.mx[0]+px;x++)for(let y=ba.mn[1]+1;y<=ba.mx[1]+py;y++)for(let z=ba.mn[2];z<=ba.mx[2];z++){const k=K(x,y,z);if(own.has(k)||oth.has(k)||!inGrow(x,Math.min(y,ba.mx[1]),z))continue;const c=sB(x,y,z);if(c)v.m.set(k,f(c))}fxClean(v)}}}
    const key=(x,y,z)=>((x+256)<<20)|((y+256)<<10)|(z+256),BS=new Set(),OS=new Set(),SX=new Map(),sd=p=>/R$/.test(p.name||p.part)?-1:/L$/.test(p.name||p.part)?1:0;
    for(const p of keep){const body=p.name==='body';p.v.each((x,y,z)=>{(body?BS:OS).add(key(x,y,z));if(body){const q=y*1024+z,ax=Math.abs(x);if(!(SX.get(q)>=ax))SX.set(q,ax)}return null})}
    const gn=[],inf={};
    for(const Q of plan){const slot=Q.s,re=reOf(slot),graft=Q.graft,gA=Q.gA;
      if(Q.infuse){const cg=chiCols(gA,false),cl=chiCols(graft,false),lm=new Map();if(cg[0]!=null&&cl[0]!=null)lm.set(cg[0],cl[0]);if(cg[1]!=null&&(cl[1]||cl[0])!=null)lm.set(cg[1],cl[1]||cl[0]);for(const p of gA)p.v.each((x,y,z,c)=>lm.has(c)?lm.get(c):null);inf[slot]=1;continue}
      let k,place;
      if(slot==='head'){const aH=A.parts.find(p=>p.name==='head'),bH=B.parts.find(p=>p.name==='head');const vol=L=>{let n=0;for(const p of L)p.v.each(()=>{n++;return null});return n||1};k=Math.max(0.3,Math.min(2.6,Math.min(chiBox(gA).dim/chiBox(graft).dim,Math.cbrt(vol(gA)/vol(graft))*1.15)));place=(p,pos)=>[0,1,2].map(i=>aH.pv[i]+(pos[i]-bH.pv[i])*k)}
      else if(gA.length){
        // the Line already has this limb: the graft takes its place joint for joint and takes over its size, so a small wing never floats where a big wing's middle used to be
        k=Math.max(0.3,Math.min(2.6,chiBox(gA).dim/chiBox(graft).dim*.9));const root=(L,s)=>L.find(p=>sd(p)===s&&re.test(p.name))||L.find(p=>sd(p)===s),an={};
        for(const s of[1,-1,0]){const g=root(graft,s);if(!g)continue;const l=root(gA,s)||root(gA,-s)||root(gA,0)||gA[0],m=root(gA,s)?1:(s&&sd(l)===-s?-1:1);an[s]={from:g.pv,to:[l.pv[0]*m*(s||sd(l)?1:0),l.pv[1],l.pv[2]]}}
        place=(p,pos)=>{const q=an[sd(p)]||an[1]||an[0]||an[-1];return[0,1,2].map(i=>q.to[i]+(pos[i]-q.from[i])*k)}}
      else{
        // the Line has no such limb: find the spot on its hide where the graft sits best. Try every joint height and length along the body, press the joint onto the surface there, and keep the spot that cuts through the least of what is already there.
        k=ba.dim/bb.dim;const lim={wings:1.5,tail:1,arms:.55}[slot]*ba.dim,gd=chiBox(graft).dim;if(gd*k>lim)k=lim/gd;k=Math.max(0.3,Math.min(2.6,k));
        const base=(p,pos)=>[0,1,2].map(i=>Math.round(ba.c[i]+(pos[i]-bb.c[i])*k)),pts=graft.map(p=>{const pv=base(p,p.pv),a=[];let n=0;chiScale(p.v,p.pv,pv,k).each((x,y,z)=>{if(n++%3===0)a.push(x,y,z);return null});return{s:sd(p)||(pv[0]<-1?-1:pv[0]>1?1:0),pv,a}});
        const R0=pts.find(q=>re.test(graft[pts.indexOf(q)].name))||pts[0],py=R0.pv[1],pz=R0.pv[2],px=Math.abs(R0.pv[0]),H=ba.mx[1]-ba.mn[1],Lz=ba.mx[2]-ba.mn[2],pref={arms:Lz>H*1.2?[.8,.8]:[.6,.6],wings:[.9,.55],tail:[.55,0]}[slot],wy=ba.mn[1]+H*pref[0],wz=ba.mn[2]+Lz*pref[1];
        const surf=(y,z)=>{let m=-1;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const v=SX.get((y+j)*1024+z+i);if(v>m)m=v}return m};let best=null;
        const score=(ox,oy,oz)=>{let n=0;for(const q of pts){const a=q.a,dx=q.s*ox;for(let i=0;i<a.length;i+=3){const x=a[i]+dx,y=a[i+1]+oy,z=a[i+2]+oz;if(y<0)n+=4;const kk=key(x,y,z);if(OS.has(kk))n+=3;else if(BS.has(kk))n+=1}}return n},tot=pts.reduce((n,q)=>n+q.a.length/3,0)||1;
        if(slot==='tail'){for(let ty=ba.mn[1]+1;ty<=ba.mx[1];ty+=2){let zs=1e9;for(let z=ba.mn[2];z<=ba.mx[2];z++)if(surf(ty,z)>=0){zs=z;break}if(zs>1e8)continue;const oy=ty-py,oz=zs+1-pz,sc=score(0,oy,oz)/tot+Math.abs(ty-wy)/H*.5;if(!best||sc<best.sc)best={sc,o:[0,oy,oz]}}}
        else for(let ty=ba.mn[1]+2;ty<=ba.mx[1];ty+=2)for(let tz=ba.mn[2]+2;tz<=ba.mx[2]-1;tz+=2){const xs=surf(ty,tz);if(xs<0)continue;const ox=xs-1-px,oy=ty-py,oz=tz-pz,sc=score(ox,oy,oz)/tot+Math.abs(ty-wy)/H*.5+Math.abs(tz-wz)/Lz*.5;if(!best||sc<best.sc)best={sc,o:[ox,oy,oz]}}
        const o=best?best.o:[0,0,0];place=(p,pos)=>{const q=base(p,pos),i=graft.indexOf(graft.find(g=>g.name===(p.name||p.part))),s=i<0?0:pts[i].s;return[q[0]+s*o[0],q[1]+o[1],q[2]+o[2]]}}
      for(const p of graft){const pv=place(p,p.pv),v=chiScale(p.v,p.pv,pv,k,f);
        // nothing of the graft stays inside what is already there, so two surfaces never flicker through each other
        if(slot!=='head')v.each((x,y,z)=>BS.has(key(x,y,z))||OS.has(key(x,y,z))?0:null);fxClean(v);v.each((x,y,z)=>{OS.add(key(x,y,z));return null});M.parts.push({name:p.name,pv,v,parent:slot==='head'?p.parent:undefined});gn.push(p.name)}
      for(const h of B.halos)if(re.test(h.part))M.halos.push({part:h.part,pos:place({name:h.part},h.pos),color:h.color,size:h.size*k})}
    // CREST: a tower, frill, ring or wisp the graft carries and the Line does not rides on the Line's back
    {const have=new Set(M.parts.map(p=>p.name)),top=(x,z)=>{let m=-1e9;for(let y=ba.mx[1];y>=ba.mn[1];y--)if(BS.has(key(x,y,z))){m=y;break}return m},kc=Math.max(.3,Math.min(2,ba.dim/bb.dim*.8));
      for(const p of B.parts){if(!FX_CREST.test(p.name)||have.has(p.name))continue;const bx=chiBox([p]),u=(bx.c[0]-bb.c[0])/((bb.mx[0]-bb.mn[0])/2||1),w=(bx.c[2]-bb.c[2])/((bb.mx[2]-bb.mn[2])/2||1),tx=Math.round(ba.c[0]+Math.max(-.6,Math.min(.6,u))*(ba.mx[0]-ba.mn[0])/2),tz=Math.round(ba.c[2]+Math.max(-.5,Math.min(.4,w))*(ba.mx[2]-ba.mn[2])/2);let ty=top(tx,tz);if(ty<-1e8)ty=top(0,tz);if(ty<-1e8)ty=ba.mx[1];
        const from=[bx.c[0],bx.mn[1],bx.c[2]],to=[tx,ty,tz],pv=[0,1,2].map(i=>Math.round(to[i]+(p.pv[i]-from[i])*kc)),v=chiScale(p.v,p.pv,pv,kc,f);v.each((x,y,z)=>BS.has(key(x,y,z))||OS.has(key(x,y,z))?0:null);fxClean(v);M.parts.push({name:p.name,pv,v});have.add(p.name)}}
    FX[id].inf={...((FX[a]||{}).inf||{}),...inf};
    for(const h of A.halos)if(M.parts.some(p=>p.name===h.part)&&!M.halos.some(q=>q.part===h.part))M.halos.push({part:h.part,pos:h.pos,color:hb?hb.color:h.color,size:h.size});
    const names=new Set(M.parts.map(p=>p.name)),need=[...new Set([...A.parts,...B.parts].map(p=>p.name))].filter(n=>!names.has(n)),dum=()=>({rotation:{},position:{},scale:{setScalar(){},set(){}}}),aHas=new Set(A.parts.map(p=>p.name));
    M.anim=(p,t)=>{for(const n of need)if(!p[n])p[n]=dum();if(A.anim)A.anim(p,t);for(const n of gn){if(aHas.has(n)||!p[n])continue;const s=/R$/.test(n)?-1:1;if(/^(wing|fin)/.test(n))p[n].rotation.z=s*(0.15+0.45*Math.sin(t*5));else if(/^tail/.test(n))p[n].rotation.y=0.4*Math.sin(t*3);else if(/^(arm|claw)/.test(n))p[n].rotation.x=0.2*Math.sin(t*2+s);else if(n==='head')p[n].rotation.x=0.06*Math.sin(t*2)}}
  },FX_RANK[rank]+'. Built by the fusion engine.');return id}
