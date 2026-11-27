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
// which slot would b fill on a? (null = pattern and glow only)
function fxSlot(a,b,A,B){const fa=fxOf(a),has=(M,re)=>M.parts.some(p=>re.test(p.name)||re.test(p.parent||''));for(const[s,re]of FX_SLOTS){if(fa.slots[s]||!has(B,re))continue;if(s==='head'&&!(A.parts.some(p=>p.name==='head')&&B.parts.some(p=>p.name==='head')))continue;return s}return null}
const FX_ELS=['Fire','Ice','Lightning','Poison','Wind','Earth','Light','Dark'],FX_SECRET=['split','puddle','chain','pull','heal','jump','coin'];
function fuse(a,b,rng=Math.random){const fa=fxOf(a),fb=fxOf(b),rank=Math.max(fa.rank,fb.rank)+1;if(rank>4||a===b)return null;const id='fx_'+a+'__'+b;if(DEFS[id])return id;
  const slot=fxSlot(a,b,chiBuild(a),chiBuild(b)),re=slot?FX_SLOTS.find(s=>s[0]===slot)[1]:null,inG=p=>re&&(re.test(p.name)||re.test(p.parent||''));
  const name=chiName(b).split(' ')[0]+' '+chiName(a).split(' ').pop();
  // mutation roll: 80% standard, 15% Twin-Core, 5% Prismatic. The game passes the run's seeded dice as rng.
  const ab=fxMix(fa.ab,fb.ab),m=rng();let mut=null;if(m<.05){const el=FX_ELS.filter(x=>!ab.els.includes(x)),rd=FX_SECRET;mut={k:'prism',el:el[rng()*el.length|0],rider:rd[rng()*rd.length|0]}}else if(m<.2)mut={k:'twin'};
  FX[id]={line:fa.line,rank,slots:slot?{...fa.slots,[slot]:b}:{...fa.slots},anc:[...fa.anc,...fb.anc],ab,pts:Math.round((fa.pts+fb.pts)*1.1),slot,from:[a,b],mut};
  def(id,name,'chimera',M=>{const A=chiBuild(a),B=chiBuild(b),keep=A.parts.filter(p=>!inG(p)),graft=B.parts.filter(inG);
    const ca=chiCols(keep,false),cb=chiCols(B.parts,false),gb=chiCols(B.parts,true)[0],hb=B.halos[0];
    // three colours: the Line's main colour, the graft's main colour as the second, one glow
    const am=new Map();if(ca[1]!=null&&cb[0]!=null&&cb[0]!==ca[0])am.set(ca[1],cb[0]);const bm=new Map();if(cb[1]!=null&&ca[0]!=null&&cb[1]!==cb[0])bm.set(cb[1],ca[0]);
    const rc=m=>c=>(c&0x1000000)?(gb||c):(m.has(c)?m.get(c):c);
    for(const p of keep){const f=rc(am);p.v.each((x,y,z,c)=>{const n=f(c);return n===c?null:n});M.parts.push(p)}
    if(slot){const gA=A.parts.filter(inG),bodyOf=M2=>{const q=M2.parts.filter(p=>p.name==='body');return chiBox(q.length?q:M2.parts.filter(p=>!/^(head|jaw)/.test(p.name)))},ba=bodyOf(A),bb=bodyOf(B);
      let k,from,to;if(slot==='head'){const aH=A.parts.find(p=>p.name==='head'),bH=B.parts.find(p=>p.name==='head');k=chiBox(gA).dim/chiBox(graft).dim;from=bH.pv;to=aH.pv}
      else{k=ba.dim/bb.dim;if(gA.length){from=chiBox(graft).c;to=chiBox(gA).c}else{from=bb.c;to=ba.c}}
      if(slot!=='head'){const lim={wings:1.5,tail:1,arms:.9}[slot]*ba.dim,gd=chiBox(graft).dim;if(gd*k>lim)k=lim/gd}
      k=Math.max(0.3,Math.min(2.6,k));const f=rc(bm);
      for(const p of graft){const pv=[0,1,2].map(i=>to[i]+(p.pv[i]-from[i])*k),v=chiScale(p.v,p.pv,pv,k,f);fxClean(v);M.parts.push({name:p.name,pv,v,parent:slot==='head'?p.parent:undefined})}
      for(const h of B.halos)if(inG({name:h.part}))M.halos.push({part:h.part,pos:[0,1,2].map(i=>to[i]+(h.pos[i]-from[i])*k),color:h.color,size:h.size*k})}
    for(const h of A.halos)if(M.parts.some(p=>p.name===h.part)&&!M.halos.some(q=>q.part===h.part))M.halos.push({part:h.part,pos:h.pos,color:hb?hb.color:h.color,size:h.size});
    const names=new Set(M.parts.map(p=>p.name)),need=[...new Set([...A.parts,...B.parts].map(p=>p.name))].filter(n=>!names.has(n)),dum=()=>({rotation:{},position:{},scale:{setScalar(){},set(){}}}),gn=slot?graft.map(p=>p.name):[],aHas=new Set(A.parts.map(p=>p.name));
    M.anim=(p,t)=>{for(const n of need)if(!p[n])p[n]=dum();if(A.anim)A.anim(p,t);for(const n of gn){if(aHas.has(n)||!p[n])continue;const s=/R$/.test(n)?-1:1;if(/^(wing|fin)/.test(n))p[n].rotation.z=s*(0.15+0.45*Math.sin(t*5));else if(/^tail/.test(n))p[n].rotation.y=0.4*Math.sin(t*3);else if(/^(arm|claw)/.test(n))p[n].rotation.x=0.2*Math.sin(t*2+s);else if(n==='head')p[n].rotation.x=0.06*Math.sin(t*2)}}
  },FX_RANK[rank]+'. Built by the fusion engine.');return id}
