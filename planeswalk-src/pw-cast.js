/* Planeswalk cast: the painted characters stand on the field and move, driven by the fight's own state.
   The rig is the art thread's roster preview (encounter/roster/roster.template.html, spec "Roster v10"): one shared
   WebGL canvas draws a figure (cloth, hair and flame masks, breath, soft bodies, key poses) and each unit copies its
   figure into a small 2D canvas inside its .art box. Assets: planeswalk-cast/cast.json, atlas/, mask/, drop/.
   Game logic drives every move: an enemy's intent picks its motion when it acts, a creature or spell that hurts an
   enemy plays the hero's cast or the ally's lunge and the hit lands at the impact beat, a dead enemy falls where it
   stood. The rules engine stays authoritative; damage numbers are held until the impact and released with the hit. */
(function(){
'use strict';
if(typeof document==='undefined'||typeof window==='undefined')return;
const BASE='planeswalk-cast/';
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR=Math.min(2,window.devicePixelRatio||1);
const GC={warm:[1,.55,.25],green:[.55,1,.4],cool:[.45,.78,1],violet:[.78,.5,1],holy:[1,.86,.52],none:[1,.84,.6]};
const ALIAS={ironalpha:'ironfang',alphasmith:'village-ironsmith',oliviaB:'olivia',acolyte:'skirsdag-cultist'};
const KSCALE={hero:1,boss:1.35,elite:1.12,regular:.8,token:.66};// of the hero's height: the repaint guide's 32% / 40% / 55% of the picture, held back so a boss fight keeps the hero readable
const MORPH={'village-ironsmith':'ironfang'};
const sm=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function br(u){const s=u*3.8;if(s<2.2){const q=s/2.2;return q*q*(3-2*q)}if(s<2.95){const q=(s-2.2)/.75;return 1-q*q}const q=(s-2.95)/.85;return -.28*Math.sin(q*Math.PI)*(1-q*.5)}
const css=c=>`rgb(${c.map(v=>Math.round(v*255)).join(',')})`,cssa=(c,a)=>`rgba(${c.map(v=>Math.round(v*255)).join(',')},${a})`;
const G=()=>{try{return {c,E,HERO,run,view}}catch(err){return null}};
const intent=e=>{try{return intentOf(e)[0]}catch(err){return ''}};
const tramples=e=>{try{return typeof TRAMPLES==='function'&&TRAMPLES(e)}catch(err){return false}};

/* ---------- cast data ---------- */
let D=null,BY={},BYG={},BYN={},BYA={},dataP=null;
function loadData(){preloadSheets();if(dataP)return dataP;dataP=fetch(BASE+'cast.json').then(r=>r.ok?r.json():Promise.reject(r.status)).then(d=>{D=d;for(const e of d){BY[e.key]=e;if(e.act==='allies'){BYA[e.name]=e;continue}BYN[e.name]=e;if(e.game&&e.game!=='planned'&&e.game!=='hero')BYG[e.game]=e}return d}).catch(err=>{console.warn('cast data',err);D=[]});return dataP}
function entryForFoe(e,g){if(!e||e.thrallOf)return null;const k=e.key;return BYG[k]||(g.E[k]&&g.E[k].figure&&BY[g.E[k].figure])||BY[ALIAS[k]]||(g.E[k]&&(BYN[g.E[k].name]||BYN[g.E[k].art]))||null}/* a registry row can name its figure key (figure:'kozilek-drone') */// a boss's second form (heraldB) names its art
// a summoned creature or token: its entry by card name (stand-in sheets until its own art lands)
function entryForAlly(a){return a&&BYA[a.name]||null}
// the hero's own figure, by its figure key or its exact name; a hero with none keeps its portrait (never another hero's painting)
function entryForHero(g){const H=g.HERO;return H&&(BY[H.figure]||BYN[H.name])||null}

/* ---------- shared WebGL canvas ---------- */
const GLC=document.createElement('canvas');GLC.width=GLC.height=1024;
let gl=null,GL2=false,U={};
try{gl=GLC.getContext('webgl2',{premultipliedAlpha:true,antialias:false});GL2=!!gl;if(!gl)gl=GLC.getContext('webgl',{premultipliedAlpha:true,antialias:false})}catch(err){gl=null}
const VS=`attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0,1);}`;
const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;uniform sampler2D A,M;uniform vec4 rc,ph;uniform float t,on,flare,hit,aura,wf,twitch,wind,oz,ofx,ofy;uniform vec2 px;uniform vec3 oa,gc,ac;
vec4 S(vec2 q){vec4 v=texture2D(A,rc.xy+clamp(q,0.,1.)*rc.zw);return (q.x<0.||q.y<0.||q.x>1.||q.y>1.)?vec4(0.):v;}
float br(float u){float s=u*3.8;if(s<2.2){float q=s/2.2;return q*q*(3.-2.*q);}if(s<2.95){float q=(s-2.2)/.75;return 1.-q*q;}float q=(s-2.95)/.85;return -.28*sin(q*3.14159)*(1.-q*.5);}
void main(){vec4 m=texture2D(M,uv);vec2 d=vec2(0.);
 if(on>.5&&oz>.5){float h=clamp((ofy-uv.y)/ofy,0.,1.);float mk=1.-.5*oa.z,sp=1.+.3*oa.z;d.y+=uv.y-(ofy-(ofy-uv.y)/mk);d.x+=uv.x-(ofx+(uv.x-ofx)/sp);d.x-=oa.x*(.06*pow(h,1.5)+.04*smoothstep(.55,0.,uv.x)*h);d.y+=oa.x*.015*h;d.x+=oa.y*.035*smoothstep(.55,.05,uv.x)*(.3+.7*h);d.y+=oa.y*.008*h;float b0=br(fract(ph.x-.10*h))*ph.w;d.y-=b0*.020*h;d.x-=(uv.x-ofx)*b0*.016*(.35+.65*h);float sw=sin(6.2832*(ph.y-.08*h))*.6+sin(6.2832*(ph.z-.05*h))*.4;d.x+=sw*.004*h*h;float bd=br(fract(ph.x-.16))*ph.w;d.y+=m.g*(.002+.006*(1.-bd));d.x+=m.g*sin(6.2832*(ph.y-.18))*.004;}
 else if(on>.5){
  d.x+=m.g*wind*(sin(t*1.25+uv.y*5.)*.6+sin(t*2.15+uv.y*9.+1.3)*.4)*.010;
  d.y+=m.g*wind*sin(t*1.7+uv.x*7.)*.003;
  d.x+=m.r*(sin(t*11.+uv.y*42.)*.0035+sin(t*17.+uv.y*23.)*.002);
  d.y+=m.r*(sin(t*8.+uv.x*31.)*.004+.003);
  d.x+=m.b*twitch*.018;}
 vec4 c=S(uv-d);
 if(oz>.5&&on>.5){float bg=br(fract(ph.x-.05))*ph.w;float lu=dot(c.rgb,vec3(.3,.59,.11));c.rgb+=c.rgb*lu*lu*lu*.45*max(bg,0.);}
 float fl=m.r*(.10+.06*sin(t*13.)+.05*sin(t*7.3)+flare*.9)*on;
 c.rgb+=gc*fl*c.a;
 float o=0.;
 o=max(o,S(uv-d+vec2(px.x,0.)).a);o=max(o,S(uv-d-vec2(px.x,0.)).a);
 o=max(o,S(uv-d+vec2(0.,px.y)).a);o=max(o,S(uv-d-vec2(0.,px.y)).a);
 o=max(o,S(uv-d+px*.7).a);o=max(o,S(uv-d-px*.7).a);
 o=max(o,S(uv-d+vec2(px.x,-px.y)*.7).a);o=max(o,S(uv-d-vec2(px.x,-px.y)*.7).a);
 float edge=clamp(o-c.a,0.,1.);
 c.rgb=mix(c.rgb,vec3(1.,.30,.18),hit*.55*c.a);
 c.rgb+=ac*aura*.06*c.a;
 vec3 rimc=hit>aura?vec3(1.,.22,.12):ac;float rim=edge*max(hit,aura*.75);
 c.rgb=mix(c.rgb,rimc,rim);c.a=max(c.a,rim);
 c.rgb=mix(c.rgb,vec3(1.),wf*c.a);
 gl_FragColor=vec4(c.rgb*c.a,c.a);}`;
if(gl){try{const sh=(ty,src)=>{const s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(s);return s};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw gl.getProgramInfoLog(pr);gl.useProgram(pr);
 const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 'rc ph t on flare hit aura wf twitch wind oz ofx ofy px oa gc ac'.split(' ').forEach(n=>U[n]=gl.getUniformLocation(pr,n));
 gl.uniform1i(gl.getUniformLocation(pr,'A'),0);gl.uniform1i(gl.getUniformLocation(pr,'M'),1);gl.clearColor(0,0,0,0);gl.disable(gl.BLEND)}catch(err){console.warn('cast gl',err);gl=null}}
const TEX=new Map(),IMGS={};
function mkTex(img,mip){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 if(mip&&GL2){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);return t}
const fileOf=k=>{const e=BY[k];return e?(e.file||k):k};
function load(key){if(!key||!BY[key])return Promise.resolve(null);const f=fileOf(key);if(IMGS[f])return IMGS[f].p;const o=IMGS[f]={},e=BY[key];
 const li=src=>new Promise((res,rej)=>{const i=new Image();i.decoding='async';i.onload=()=>res(i);i.onerror=rej;i.src=BASE+src});
 o.p=Promise.all([li('atlas/'+f+'.webp'),li('mask/'+f+'.webp'),e.drop?li(e.drop).then(i=>{o.d=i}).catch(()=>{}):null]).then(([a,m])=>{o.a=a;o.m=m;o.ok=true;return o}).catch(err=>{o.err=1;console.warn('cast load',key,err)});return o.p}
const ready=key=>{const o=IMGS[fileOf(key)];return !!(o&&o.ok)};
// a figure whose files failed to load stays on its own portrait; it is never waited on or re-synced again
const failed=key=>{const o=IMGS[fileOf(key)];return !!(o&&o.err)};
function gtex(key){key=fileOf(key);let t=TEX.get(key);if(!t){const o=IMGS[key];if(!o||!o.ok)return null;t={a:mkTex(o.a,true),m:mkTex(o.m,false)};TEX.set(key,t);if(TEX.size>12)evict()}t.used=T;return t}
function evict(){const keep=new Set([...rigs.values()].map(R=>R.cur.key));const old=[...TEX].filter(([k])=>!keep.has(k)).sort((a,b)=>a[1].used-b[1].used);
 while(TEX.size>12&&old.length){const [k,t]=old.shift();gl.deleteTexture(t.a);gl.deleteTexture(t.m);TEX.delete(k)}}
// Preload one at a time (the hero first, then the act's foes) while the player is on the map, so a fight opens with its art ready.
let preQ=[],preBusy=false;
function preload(keys){for(const k of keys)if(k&&BY[k]&&!IMGS[fileOf(k)]&&!preQ.includes(k))preQ.push(k);pump()}
function pump(){if(preBusy||!preQ.length)return;preBusy=true;load(preQ.shift()).then(()=>{preBusy=false;pump()})}
function actKeys(g){const out=[];try{const act=(g.run&&g.run.act)||1;for(const e of D){if(e.game==='planned'||e.game==='hero')continue;if(e.act==='act'+act)out.push(e.key)}}catch(err){}return out}

/* ---------- rigs: one per unit on the field ---------- */
const rigs=new Map(),ghosts=new Set();let T=0,last=performance.now(),loopOn=false;
const fxLayer=document.createElement('div');fxLayer.className='pw-cast-fx';fxLayer.setAttribute('aria-hidden','true');
const ro=new ResizeObserver(es=>{for(const en of es){const R=en.target._R;if(R)fit(R)}});
function rig(e,id,face){const cv=document.createElement('canvas');cv.className='pw-cast';cv.setAttribute('aria-hidden','true');
 const per={humanoid:[3.6,4.4],beast:[3,3.6],heavy:[4.8,5.6],eldrazi:[4.8,5.6],flyer:[3.2,3.8],wisp:[4.4,5.2],soft:[3.8,3.8]}[e.body]||[3.6,4.4];
 const R={id,e,cur:e,cv,ctx:cv.getContext('2d'),face,seed:Math.random()*40,P:per[0]+Math.random()*(per[1]-per[0]),off:Math.random()*5,
  moves:e.moves.map(m=>m==='flame'&&e.glowArea<.003?'gust':m),nf:0,act:null,mv:null,q:[],dead:0,phase2:false,fadeIn:-9,oz:e.body==='soft',ac:GC[e.glow]||GC.none,W:0,H:0,el:null,box:null};
 cv._R=R;ro.observe(cv);return R}
/* The canvas reaches past the figure's frame so lunges never clip, but never past the fight field: a frame's see-through margin at the screen edge is cut, the painting is not (fitWidth keeps the paint inside). */
/* On the field a figure's .art box is its body (the unit's width); the painting's frame is centred on the body by cx, at the box's height. Elsewhere (the zoom card) the box is the frame. */
function frameRect(R){const art=R.cv.parentNode,a=art.getBoundingClientRect();if(!art.closest||!art.closest('.battle .field'))return a;const e=R.cur,w=a.height*e.fw/e.fh,cx=e.cx??(e.foot?e.foot[0]:.5),l=a.left+a.width/2-cx*w;
 return {left:l,right:l+w,top:a.top,bottom:a.bottom,width:w,height:a.height}}
function clampCv(R){const art=R.cv.parentNode,f=art&&art.closest&&art.closest('.battle .field');if(!f){R.cv.style.removeProperty('left');R.cv.style.removeProperty('width');return}
 const A=art.getBoundingClientRect(),a=frameRect(R),b=f.getBoundingClientRect();if(!A.width||!a.width)return;const l=Math.max(a.left-.22*a.width,b.left),r=Math.min(a.right+.22*a.width,b.right);
 R.cv.style.left=((l-A.left)/A.width*100).toFixed(2)+'%';R.cv.style.width=(Math.max(.2*a.width,r-l)/A.width*100).toFixed(2)+'%'}
function fit(R){if(R.ghost)return;clampCv(R);const r=R.cv.getBoundingClientRect();if(!r.width||!r.height)return;R.W=r.width;R.H=r.height;const w=Math.round(r.width*DPR),h=Math.round(r.height*DPR);if(R.cv.width!==w)R.cv.width=w;if(R.cv.height!==h)R.cv.height=h;layout(R)}
// The .art box is the figure's own box: feet on its bottom edge, the canvas reaches past it so lunges never clip.
function layout(R){const e=R.cur,art=R.cv.parentNode;if(!art||!R.W)return;const a=frameRect(R),cr=R.cv.getBoundingClientRect();
 const w=a.width,h=a.height,x=a.left-cr.left,y=a.top-cr.top;R.box={x,y,w,h,fx:x+e.foot[0]*w,fy:y+e.foot[1]*h}}
const P0={dx:0,dy:0,sx:1,sy:1,rot:0,alpha:1,aura:0,hit:0,wf:0};
function atRest(R,t){const u=((t+R.off)%R.P)/R.P;return R.oz?(t%3.8)/3.8>.9:(u<.06||u>.94)}
function idlePose(R,t){const p={...P0};if(RM||R.oz)return p;const u=((t+R.off)%R.P)/R.P,b=br(u),s2=Math.sin(2*Math.PI*u);
 switch(R.e.body){case 'flyer':p.dy=-.014*s2;p.sy=1+.004*b;break;case 'wisp':p.dy=-.016*s2;p.rot=.006*Math.sin(2*Math.PI*u+1);break;
  case 'heavy':case 'eldrazi':p.sx=1+.003*b;p.sy=1+.005*b;break;case 'beast':p.sx=1+.006*b;p.sy=1+.005*b;break;default:p.sx=1+.004*b;p.sy=1+.008*b}
 const m=R.mv;if(m){const q=(t-m.t0)/m.d;if(q>=1)R.mv=null;else if(q>=0){const s=Math.sin(Math.PI*q);
  if(m.k==='shrug'){p.sy+=.012*s;p.sx-=.005*s}
  else if(m.k==='stomp'){if(q<.35)p.dy-=.014*sm(q/.35);else if(q<.45)p.dy-=.014*(1-sm((q-.35)/.1));else{p.sy-=.014*(1-sm((q-.45)/.55));p.sx+=.008*(1-sm((q-.45)/.55))}if(q>=.45&&!m.f){m.f=1;puff(R,0)}}
  else if(m.k==='drift')p.dx+=m.dir*.025*s;
  else if(m.k==='flutter')p.dy-=.008*s}}
 return p}
function fidget(R,t){const k=R.moves[Math.floor(Math.random()*R.moves.length)];
 if(k==='heave'){R.ev0=Math.ceil(t/3.8)*3.8;R.q.push({at:R.ev0+1.25,fn:R=>drip(R,1100)});return}
 if(k==='flame'){R.fl0=t;if(Math.random()<.5){R.g0=t+.3;R.gA=1;R.gd=2.8}return}
 if(k==='gust'){R.g0=t;R.gA=1;R.gd=2.8;return}
 if(k==='flutter'){R.g0=t;R.gA=1.7;R.gd=1.6;R.mv={k,t0:t,d:1.6};return}
 if(k==='twitch'||k==='glance'){R.tw0=t;R.twK=k;R.twD=k==='glance'?R.face:(Math.random()<.5?-1:1);return}
 R.mv={k,t0:t,d:{shrug:.8,stomp:.7,drift:2.6}[k]||1,dir:Math.random()<.5?-1:1}}
function twitchV(R,t){if(!R.tw0)return 0;const a=t-R.tw0;if(R.twK==='glance'){if(a>1.5)return 0;return R.twD*.7*sm(a/.3)*(1-sm((a-1.1)/.4))}if(a>.35)return 0;return R.twD*Math.sin(Math.PI*a/.35)}
function ozA(R,t){const a=R.atk0?(t-R.atk0)*1000:1e9,h=R.hit0?(t-R.hit0)*1000:1e9,m=R.mel0?(t-R.mel0)*1000:-1;let lean=0,dent=0;
 if(a<150)lean=-.35*sm(a/150);else if(a<250)lean=-.35+1.35*sm((a-150)/100);else if(a<330)lean=1;else if(a<580)lean=1-sm((a-330)/250);
 if(h<60)dent=h/60;else if(h<420){const q=(h-60)/360;dent=(1-q)*(1-q)*Math.cos(q*5.5)}
 return [lean,dent,m<0?0:sm(m/900)]}

/* ---------- actions: key poses on the beat, the body moves between them ---------- */
const EZ={lin:q=>q,out:q=>1-(1-q)*(1-q),in:q=>q*q,io:q=>q<.5?2*q*q:1-2*(1-q)*(1-q)};
const COMP=new Set(['cast-prep','attack','attack-follow','recover']);
function play(R,segs,done){let cur={...P0};for(const s of segs){s.p0=cur;s.p1={...cur,...s.to};cur=s.p1}R.act={segs,t0:T,done};R.mv=null;R.tw0=0;R.fl0=0}
function actPose(R,t){const A=R.act;let el=(t-A.t0)*1000;
 for(const s of A.segs){if(!s.fired){s.fired=1;s.at&&s.at(R)}if(el<s.d){const q=EZ[s.e](el/s.d),p={};for(const k in s.p1)p[k]=s.p0[k]+(s.p1[k]-s.p0[k])*q;if(s.shake)p.dx+=Math.sin(el*.11)*.008;return {p,f:s.f}}el-=s.d}
 R.act=null;R.nf=t+3+Math.random()*5;A.done&&A.done(R);return null}
// Impact beat of each motion (ms after it starts): the number, bar, sound and hit reaction land there.
const IMPACT={strike:250,quick:170,double:250,charge:310,crawl:280,swoop:280,cast:400,drain:400,reach:250,pull:270};
function act_(R,k,o){o=o||{};if(R.dead&&k!=='defeat')return 0;if(R.act&&k!=='hit'&&k!=='defeat')R.act=null;
 const e=R.cur,F=e.frames,f=R.face,has=n=>F[n]?n:null;
 const A=has('attack'),Rc=has('recover'),Pp=has('cast-prep'),Fo=has('attack-follow'),H=has('hit'),HR=has('hit-recover'),D1=has('defeat-1')||has('defeat-start')||H,D2=has('defeat-2')||D1;
 R.ac=GC[e.glow]||GC.none;const S=[],s=(d,fr,to,ez,at,x)=>S.push(Object.assign({d,f:fr,to:to||{},e:ez||'io',at},x));
 const tgt=o.target;
 if(R.oz){
  if(k==='hit'){R.hit0=T;s(60,null,{hit:1},'lin',R=>spark(R,R.box.fx+f*.06*R.box.w,chestY(R),[1,.45,.3]));s(380,null,{hit:0},'out')}
  else if(k==='defeat'){R.dead=1;R.mel0=T;s(80,null,{hit:1},'out');s(1000,null,{hit:0},'lin');s(600,null,{alpha:0},'in');s(500,null,{alpha:0},'lin');play(R,S,done);return 0}
  else{R.atk0=T;s(150,null,{});s(100,null,{});s(60,null,{});s(270,null,{})}
  play(R,S);return IMPACT.reach}
 switch(k){
  case 'strike':s(150,Pp,{dx:-f*.03,sx:1.01,sy:.98},'out');s(100,A,{dx:f*.10,sx:1,sy:1},'out');s(Fo?100:60,Fo||A,{},'lin');s(250,Rc,{dx:0},'io');break;
  case 'quick':s(90,Pp,{dx:-f*.02,sy:.985},'out');s(80,A,{dx:f*.09,sy:1},'out');s(60,Fo||A,{},'lin');s(200,Rc,{dx:0});break;
  case 'double':s(150,Pp,{dx:-f*.03,sx:1.01,sy:.98},'out');s(100,A,{dx:f*.10,sx:1,sy:1},'out');s(60,A,{},'lin');s(120,Rc,{dx:f*.05});s(90,A,{dx:f*.11},'out');s(60,A,{},'lin');s(250,Rc,{dx:0});break;
  case 'charge':s(180,Pp,{dx:-f*.045,sx:1.02,sy:.97},'out');s(130,A,{dx:f*.18,sx:1,sy:1},'in',R=>puff(R,-f));s(60,A,{},'lin');s(300,Rc,{dx:0});break;
  case 'crawl':s(160,null,{dx:-f*.02,sx:1.03,sy:.96},'out');s(120,A,{dx:f*.12,sx:1.04,sy:.97},'out');s(60,A,{},'lin');s(260,Rc,{dx:0,sx:1,sy:1});break;
  case 'swoop':s(170,null,{dx:-f*.02,dy:-.05},'out');s(110,A,{dx:f*.14,dy:.015},'in');s(60,A,{},'lin');s(300,Rc,{dx:0,dy:0});break;
  case 'cast':s(180,Pp,{dx:-f*.015,aura:1},'out',orb);s(110,A,{dx:f*.02},'out',R=>bolt(R,R.ac,tgt,220));s(Fo?100:60,Fo||A,{aura:.8},'lin');s(260,Rc,{dx:0,aura:0});break;
  case 'drain':R.ac=[1,.32,.36];s(180,Pp,{dx:-f*.015,aura:1},'out',orb);s(110,A,{dx:f*.02},'out',R=>bolt(R,R.ac,tgt,220));s(60,A,{},'lin');s(420,Rc,{dx:0,aura:.6},'io',R=>bolt(R,[1,.4,.45],tgt,300,true));s(220,null,{aura:0});break;
  case 'pull':{const Pl=has('pull')||A;s(160,Pp,{dx:f*.03,sx:1.01,sy:.98},'out');s(110,Pl,{dx:-f*.06},'out');s(320,Pl,{},'lin');s(260,Rc,{dx:0,sx:1,sy:1});break}
  case 'guard':R.ac=[.78,.9,1];s(150,null,{dx:-f*.01,sx:1.015,sy:.98,aura:.6},'out',shield);s(900,null,{},'lin');s(260,null,{dx:0,sx:1,sy:1,aura:0});break;
  case 'rally':s(200,null,{sx:1.012,sy:.975},'out');s(260,null,{sx:.995,sy:1.03,dy:-.008,aura:1},'out',sparks);s(520,null,{aura:.7},'lin');s(320,null,{sx:1,sy:1,dy:0,aura:0});break;
  case 'summon':s(180,Pp,{dx:-f*.015,aura:1},'out',orb);s(120,A,{dx:f*.01},'out',portal);s(420,A,{aura:.7},'lin');s(280,Rc,{dx:0,aura:0});break;
  case 'transform':{const to=o.to||BY[MORPH[R.e.key]];if(!to)return 0;load(to.key);s(480,null,{aura:1,sx:1.02,sy:1.02},'lin',null,{shake:1});s(90,null,{wf:1},'lin',R=>morph(R,to));s(380,null,{wf:0,aura:0,sx:1,sy:1},'out');break}
  case 'phase':s(320,null,{aura:1},'out',null,{shake:1});s(90,null,{wf:1},'lin',R=>{R.phase2=true});s(420,null,{wf:0,aura:0},'out');break;
  case 'hit':s(60,H,{dx:-f*.045,hit:1},'out',R=>spark(R,R.box.fx+f*.06*R.box.w,chestY(R),[1,.45,.3]));s(220,H,{dx:-f*.035,hit:.5},'lin');if(HR)s(120,HR,{dx:-f*.02,hit:.2});s(260,null,{dx:0,hit:0},'io');break;
  case 'defeat':R.dead=1;if(e.defeat==='sink'){s(80,H,{hit:1},'out');s(300,H,{hit:.4,dx:-f*.04},'out');s(800,H,{hit:0,dy:.05,alpha:0},'in');s(200,H,{alpha:0},'lin')}
   else if(e.defeat==='dissolve'){s(80,H,{hit:1},'out');s(260,D1,{hit:.3});s(1100,D2,{alpha:0,dy:-.06,hit:0},'in');s(400,D2,{alpha:0},'lin')}
   else{s(80,H,{hit:1,dx:-f*.03},'out');s(260,D1,{hit:.4,dx:-f*.04},'out');s(900,D2,{hit:0,dy:D2===H?.02:0},'lin');s(500,D2,{alpha:0},'in');s(300,D2,{alpha:0},'lin')}
   play(R,S,done);return 0;
  default:return 0}
 play(R,S);return IMPACT[k]||0}
function done(R){if(R.ghost){ghosts.delete(R);R.cv.remove();ro.unobserve(R.cv)}}
/* where the figure really stands (tools/cast-anchors.py measures the idle frame): cx lower-body centre, hx head centre, cw body width, all fractions of the frame.
   A figure takes the width of its body, not of its frame (--pw-pk): the frame's empty margins overhang its neighbours, so a crowded line keeps big figures, Slay the Spire style.
   The frame shifts so the body centre sits on the unit's centre; the bar, block chip and skull then centre on the unit, the intent on the head. */
const packOf=e=>Math.min(1,Math.max(.5,(e.cw??.6)*1.35));
function anchor(el,e){const f=e.foot?e.foot[0]:.5,cx=e.cx??f,cw=e.cw??.6,pk=packOf(e),S=(k,v)=>el.style.setProperty(k,v.toFixed(3));
 S('--pw-pk',pk);S('--pw-cx',cx);S('--pw-fx',0);S('--pw-hx',((e.hx??cx)-cx)/pk);S('--pw-cw',cw/pk);S('--pw-cwf',cw)}
function morph(R,to){if(!to||!ready(to.key))return;R.cur=to;R.e=to;R.oz=to.body==='soft';R.moves=to.moves.map(m=>m==='flame'&&to.glowArea<.003?'gust':m);if(R.el)anchor(R.el,to);if(R.el)R.el.style.setProperty('--pw-top',(to.top||0).toFixed(3));if(R.el)R.el.style.setProperty('--ar',(to.fw/to.fh).toFixed(3));layout(R)}

/* ---------- effects: DOM sprites on a fixed layer over the field ---------- */
function at(R,x,y){const r=R.cv.getBoundingClientRect();return [r.left+x,r.top+y]}
function fxEl(R,cls,x,y,style){if(!fxLayer.isConnected)document.body.append(fxLayer);const d=document.createElement('div');d.className='fxe '+cls;const [X,Y]=at(R,x,y);d.style.left=X+'px';d.style.top=Y+'px';if(style)Object.assign(d.style,style);fxLayer.appendChild(d);return d}
function anim(d,kf,ms,ez,delay){const a=d.animate(kf,{duration:ms,delay:delay||0,easing:ez||'ease-out',fill:'forwards'});a.onfinish=()=>d.remove();setTimeout(()=>d.remove(),ms+(delay||0)+200);return a}
const chestY=R=>R.box.y+(R.cur.top+(R.cur.foot[1]-R.cur.top)*.38)*R.box.h, headY=R=>R.box.y+(R.cur.top+.05)*R.box.h;
function spark(R,x,y,c,big){if(!R.box)return;const s=fxEl(R,'spark',x,y,{background:`radial-gradient(circle,#fff 0,${cssa(c,.95)} 22%,${cssa(c,.45)} 45%,${cssa(c,0)} 70%)`});anim(s,[{transform:`scale(${big?.6:.4})`,opacity:1},{transform:`scale(${big?1.6:1.15})`,opacity:0}],big?240:180)}
function orb(R){if(!R.box)return;const x=R.box.fx+R.face*.24*R.box.w,y=chestY(R),c=R.ac;const o=fxEl(R,'spark',x,y,{background:`radial-gradient(circle,#fff 0,${cssa(c,.9)} 25%,${cssa(c,0)} 70%)`});anim(o,[{transform:'scale(.2)',opacity:0},{transform:'scale(.75)',opacity:1,offset:.7},{transform:'scale(.5)',opacity:0}],320)}
// A bolt flies from the caster's hand to the target's chest (or back, for a drain).
function bolt(R,c,tgt,ms,inward){if(!R.box)return;const [ax,ay]=at(R,R.box.fx+R.face*.24*R.box.w,chestY(R));let bx,by;
 if(tgt&&tgt.rect){bx=tgt.rect.left+tgt.rect.width/2;by=tgt.rect.top+tgt.rect.height*.42}else{[bx,by]=at(R,R.box.fx+R.face*1.2*R.box.w,chestY(R))}
 const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(len<20)return;const ang=Math.atan2(dy,dx);
 const x0=inward?bx:ax,y0=inward?by:ay,dir=inward?-1:1,L=Math.min(60,len*.5);
 const d=document.createElement('div');d.className='fxe bolt';if(!fxLayer.isConnected)document.body.append(fxLayer);fxLayer.appendChild(d);
 Object.assign(d.style,{left:x0+'px',top:y0+'px',width:L+'px',background:`linear-gradient(90deg,${cssa(c,0)},${css(c)} 60%,#fff)`,boxShadow:`0 0 10px ${cssa(c,.8)}`,transformOrigin:'0 50%'});
 const rot=`rotate(${ang+(inward?Math.PI:0)}rad)`;
 anim(d,[{transform:`${rot} translateX(${-L}px)`,opacity:.2},{transform:`${rot} translateX(${len*.15-L}px)`,opacity:1,offset:.15},{transform:`${rot} translateX(${len-L}px)`,opacity:1}],ms,'ease-in');
 setTimeout(()=>{if(!inward){const s=document.createElement('div');s.className='fxe spark';s.style.left=bx+'px';s.style.top=by+'px';s.style.background=`radial-gradient(circle,#fff 0,${cssa(c,.95)} 22%,${cssa(c,.45)} 45%,${cssa(c,0)} 70%)`;fxLayer.appendChild(s);anim(s,[{transform:'scale(.4)',opacity:1},{transform:'scale(1.15)',opacity:0}],180)}},ms)}
function shield(R){if(!R.box)return;const w=Math.max(18,.2*R.box.w),h=.72*(R.box.fy-headY(R)),x=R.box.fx+R.face*.3*R.box.w,y=R.box.fy-h*.62,c=[.78,.9,1];
 const d=fxEl(R,'ring',x-w/2,y-h/2,{width:w+'px',height:h+'px',borderColor:'transparent',[R.face>0?'borderRightColor':'borderLeftColor']:cssa(c,.95),borderWidth:'3px',boxShadow:`${R.face*6}px 0 14px -6px ${cssa(c,.8)}`});
 anim(d,[{opacity:0,transform:'scaleY(.6)'},{opacity:1,transform:'scaleY(1)',offset:.1},{opacity:1,transform:'scaleY(1)',offset:.82},{opacity:0,transform:'scaleY(1.05)'}],1300,'linear')}
function sparks(R){if(!R.box)return;const c=R.ac;for(let i=0;i<10;i++){const x=R.box.fx+(Math.random()-.5)*.6*R.box.w,d=fxEl(R,'dot',x,R.box.fy-4,{background:css(c),boxShadow:`0 0 6px ${cssa(c,.9)}`});
 const rise=30+Math.random()*40;d.style.opacity=0;anim(d,[{transform:'translateY(0)',opacity:0},{transform:`translateY(${-rise*.3}px)`,opacity:1,offset:.25},{transform:`translateY(${-rise}px)`,opacity:0}],700+i*25,'ease-out',i*30)}}
function portal(R){if(!R.box)return;const c=R.ac,x=R.box.fx+R.face*.46*R.box.w,w=Math.max(40,.5*R.box.w);const d=fxEl(R,'ring',x-w/2,R.box.fy-w*.12,{width:w+'px',height:w*.24+'px',borderColor:cssa(c,.95),boxShadow:`0 0 14px ${cssa(c,.8)},inset 0 0 10px ${cssa(c,.6)}`});
 anim(d,[{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:1,offset:.3},{transform:'scale(1.15)',opacity:0}],900);
 const p=fxEl(R,'bolt',x,R.box.fy-4,{width:'6px',height:.5*R.box.h+'px',marginLeft:'-3px',marginTop:-.5*R.box.h+'px',background:`linear-gradient(0deg,${cssa(c,.85)},${cssa(c,0)})`,transformOrigin:'50% 100%'});
 anim(p,[{transform:'scaleY(0)',opacity:0},{transform:'scaleY(1)',opacity:.9,offset:.35},{transform:'scaleY(1)',opacity:0}],800)}
function puff(R,dir){if(!R.box)return;for(const s of [-1,1]){const d=fxEl(R,'puff',R.box.fx+s*.12*R.box.w,R.box.fy-3);anim(d,[{transform:'translateX(0) scale(.4)',opacity:.9},{transform:`translateX(${(dir||s)*-18}px) scale(1.2)`,opacity:0}],520)}}
function drip(R,gr){const I=R.cur,o=IMGS[fileOf(I.key)];if(!I.drop||!I.tips||!I.tips.length||R.dead||!R.box||!o||!o.d)return;const b=R.box,tp=I.tips[Math.floor(Math.random()*I.tips.length)],d=document.createElement('img');
 d.className='fxe drop';d.alt='';d.src=o.d.src;const dw=Math.max(5,I.dw*b.w*.8);const [X,Y]=at(R,b.x+tp[0]*b.w,b.y+tp[1]*b.h);d.style.left=X+'px';d.style.top=Y+'px';d.style.width=dw+'px';if(!fxLayer.isConnected)document.body.append(fxLayer);fxLayer.appendChild(d);
 const fall=Math.max(6,(I.foot[1]-tp[1])*b.h-dw*.5),g=5.2*b.h,tf=Math.max(140,Math.sqrt(2*fall/g)*1000),grow=gr||900+Math.random()*700,neck=140,spl=240,TT=grow+neck+tf+spl,X2='translate(-50%,-35%) ';
 d.animate([{transform:X2+'scale(.2,.3)',opacity:0,easing:'ease-out'},{transform:X2+'scale(.55,.7)',opacity:1,offset:.25*grow/TT,easing:'ease-in-out'},{transform:X2+'scale(.8,1.1)',opacity:1,offset:grow/TT,easing:'ease-in'},{transform:'translate(-50%,-5%) scale(.7,1.35)',opacity:1,offset:(grow+neck)/TT,easing:'cubic-bezier(.55,.085,.68,.53)'},{transform:`translate(-50%,${fall}px) scale(.72,1.3)`,opacity:1,offset:(grow+neck+tf)/TT,easing:'ease-out'},{transform:`translate(-50%,${fall+dw*.25}px) scale(1.9,.28)`,opacity:.85,offset:(grow+neck+tf+spl*.35)/TT},{transform:`translate(-50%,${fall+dw*.3}px) scale(2.2,.18)`,opacity:0}],{duration:TT,fill:'forwards'}).onfinish=()=>d.remove()}

/* ---------- draw ---------- */
const perf={ms:[],i:0,max:0};
function draw(R,t){const e=R.cur,o=IMGS[fileOf(e.key)];if(!o||!o.ok||!R.box||!R.W)return;const c2=R.ctx,b=R.box;
 let pose=null,fname=null;if(R.act){const a=actPose(R,t);if(a){pose=a.p;fname=a.f}}
 const idleF=R.phase2&&e.frames.phase2?'phase2':e.idle;
 if(!pose){pose=idlePose(R,t);if(!RM&&!R.dead){if(!R.nf)R.nf=t+2+Math.random()*7;if(t>R.nf&&atRest(R,t)){R.nf=t+7+Math.random()*8;fidget(R,t)}}}
 fname=fname||idleF;const on=!RM&&(R.oz||fname===e.idle)?1:0;
 let alpha=pose.alpha;if(t-R.fadeIn<.45)alpha*=Math.max(0,(t-R.fadeIn)/.45);
 c2.setTransform(DPR,0,0,DPR,0,0);c2.clearRect(0,0,R.W,R.H);if(alpha<=0)return;
 let comp=0;if(R.act&&COMP.has(fname)&&e.cx){const sh=e.cx[fname]-e.cx[e.idle];if(sh*R.face<0)comp=-sh*.75}
 const hover=e.body==='flyer'||e.body==='wisp',rr=b.w*.3*(hover?.75:1);
 c2.save();c2.globalAlpha=alpha*(hover?.32:.5);c2.translate(b.fx+(pose.dx+comp)*b.w*.85,b.fy+(hover?.03*b.h:0));c2.scale(1,.16);const sg=c2.createRadialGradient(0,0,0,0,0,rr);sg.addColorStop(0,'rgba(0,0,0,.85)');sg.addColorStop(1,'rgba(0,0,0,0)');c2.fillStyle=sg;c2.beginPath();c2.arc(0,0,rr,0,6.2832);c2.fill();c2.restore();
 c2.save();c2.globalAlpha=alpha;c2.translate(b.fx+(pose.dx+comp)*b.w,b.fy+pose.dy*b.h);if(pose.rot)c2.rotate(pose.rot);c2.scale(pose.sx,pose.sy);c2.translate(-e.foot[0]*b.w,-e.foot[1]*b.h);
 const fr=e.frames[fname]||e.frames[e.idle],tx=gl&&gtex(e.key);
 if(tx){let wd=Math.round(b.w*DPR),hd=Math.round(b.h*DPR);const k=Math.min(1,1024/Math.max(wd,hd));wd=Math.max(2,Math.round(wd*k));hd=Math.max(2,Math.round(hd*k));
  gl.viewport(0,0,wd,hd);gl.clear(gl.COLOR_BUFFER_BIT);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx.a);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tx.m);
  gl.uniform4f(U.rc,fr[0]/e.aw,fr[1]/e.ah,e.fw/e.aw,e.fh/e.ah);gl.uniform1f(U.t,on?t+R.seed:0);gl.uniform1f(U.on,on);
  const fl=R.fl0&&t-R.fl0<1.6?Math.sin(Math.PI*(t-R.fl0)/1.6)**2*.55:0;gl.uniform1f(U.flare,fl);
  const gu=R.g0&&t>R.g0&&t-R.g0<R.gd?Math.sin(Math.PI*(t-R.g0)/R.gd)**2*R.gA:0;gl.uniform1f(U.wind,(e.cloth||1)*(.35+.85*gu));
  gl.uniform1f(U.twitch,twitchV(R,t));gl.uniform1f(U.hit,pose.hit);gl.uniform1f(U.aura,pose.aura);gl.uniform1f(U.wf,pose.wf);
  gl.uniform2f(U.px,2.4*DPR/wd,2.4*DPR/hd);gl.uniform3fv(U.gc,GC[e.glow]||GC.none);gl.uniform3fv(U.ac,R.ac);
  gl.uniform1f(U.oz,R.oz?1:0);if(R.oz){const oa=ozA(R,t);gl.uniform1f(U.ofx,e.ax);gl.uniform1f(U.ofy,e.foot[1]);gl.uniform3f(U.oa,oa[0],oa[1],oa[2]);
   gl.uniform4f(U.ph,(t%3.8)/3.8,(t%5.3)/5.3,(t%8.9)/8.9,(1-oa[2])*(.28+.04*Math.sin(t*.29)+.72*(R.ev0?sm(t-R.ev0+1)*(1-sm(t-R.ev0-3.8)):0)))}
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);c2.drawImage(GLC,0,GLC.height-hd,wd,hd,0,0,b.w,b.h)}
 else c2.drawImage(o.a,fr[0],fr[1],e.fw,e.fh,0,0,b.w,b.h);
 c2.restore()}
function loop(now){if(!rigs.size&&!ghosts.size){loopOn=false;return}requestAnimationFrame(loop);const t0=performance.now();const dt=Math.min(.1,(now-last)/1000);last=now;if(document.hidden)return;T+=dt;
 for(const R of [...rigs.values(),...ghosts])try{if(R.q.length){const due=R.q.filter(x=>x.at<=T);if(due.length){R.q=R.q.filter(x=>x.at>T);due.forEach(x=>T-x.at<1.5&&x.fn(R))}}draw(R,T)}catch(err){console.warn('cast',err);R.act=null}
 if((perf.i&7)===0)for(const R of rigs.values())if(R.el&&R.el.isConnected)R.lastRect=R.cv.getBoundingClientRect();
 const ms=performance.now()-t0;perf.ms[perf.i++%120]=ms;if(ms>perf.max)perf.max=ms;if(perfEl)perfTick(ms)}
function startLoop(){if(loopOn)return;loopOn=true;last=performance.now();requestAnimationFrame(loop)}

/* ---------- the field: mount a rig in every unit that has a painted figure ---------- */
const app=document.getElementById('app');
let prev=null,fightC=null,fightReady=false,fightT0=0,holds=new Map();const FIGHT_WAIT=4000;// a slow figure or mat never holds the fight longer than this
function px(v){const n=parseFloat(v);return isNaN(n)?0:n}
function snap(g){const c=g.c;const foes=new Map();for(const e of c.enemies)foes.set(String(e.id),{e,key:e.key,hp:e.hp,shield:e.shield||0,acting:!!e.acting,phase2:!!e.phase2,intent:intent(e)});
 const allies=new Map();for(const a of c.allies)allies.set(String(a.id),{a,dmg:a.dmg,tapped:!!a.tapped});
 return {c,foes,allies,hp:g.run.hp,ward:c.ward||0,busy:!!c.busy}}
function unmountAll(){for(const R of rigs.values()){R.cv.remove();ro.unobserve(R.cv)}rigs.clear();holds.clear();groundOff(app.querySelector('.battle'))}
function sync(){const g=G();if(!g||!g.c||g.view!=='battle'||!app.querySelector('.battle .field')){if(rigs.size)unmountAll();prev=null;fightC=null;if(g&&D&&D.length&&g.view!=='battle'){preload([entryForHero(g)&&entryForHero(g).key,...actKeys(g)]);preloadGround()}return}
 if(!D){loadData().then(()=>sync());return}
 const now=snap(g);if(fightC!==now.c){fightC=now.c;fightReady=false;fightT0=performance.now();plates=null;fightH=null;unmountAll();prev=null}
 // the fight opens with every figure ready, or it stays on the portraits until they are
 const hero=app.querySelector('.battle .unit.hero'),foeEls=[...app.querySelectorAll('.battle .side.foe .unit[data-id]')],allyEls=[...app.querySelectorAll('.battle .side.you .unit.ally[data-id]')];
 const allyOf=el=>entryForAlly(now.c.allies.find(x=>String(x.id)===el.dataset.id));
 const want=[];const hE=entryForHero(g);if(hE)want.push(hE.key);for(const el of foeEls){const en=entryForFoe(now.c.enemies.find(x=>String(x.id)===el.dataset.id),g);if(en)want.push(en.key)}for(const el of allyEls){const en=allyOf(el);if(en)want.push(en.key)}
 if(!fightReady){const miss=want.filter(k=>!ready(k)&&!failed(k)),gl=groundLoad(app.querySelector('.battle')),left=FIGHT_WAIT-(performance.now()-fightT0);if((miss.length||gl)&&left>0){const c0=now.c;Promise.race([Promise.all([...miss.map(load),gl].filter(Boolean)),new Promise(r=>setTimeout(r,left+20))]).then(()=>{if(fightC===c0&&!fightReady)sync()});prev=now;return}fightReady=true}
 const field=app.querySelector('.battle .field');field.classList.add('pw-stage');// the stage layout (full width, feet low) must be on before the measure
 const seats=size(field,hero,foeEls,now,g,hE,allyOf);
 if(seats===false){if(rigs.size)unmountAll();prev=now;return}
 if(prev)diff(prev,now,g);prev=now;
 const seen=new Set();
 if(hero&&hE&&ready(hE.key)){mount('hero',hero,hE,1,Math.max(0,g.run.hp)+'/'+g.run.max);seen.add('hero')}
 for(const el of foeEls){const id=el.dataset.id,fe=now.c.enemies.find(x=>String(x.id)===id),en=entryForFoe(fe,g);if(!en)continue;if(!ready(en.key)){if(!failed(en.key))load(en.key).then(()=>{if(fightC===now.c&&ready(en.key))sync()});continue}mount(id,el,en,-1,Math.max(0,fe.hp)+'/'+fe.max);seen.add(id)}
 for(const el of allyEls){const id='a:'+el.dataset.id,en=allyOf(el);if(!en)continue;if(!ready(en.key)){if(!failed(en.key))load(en.key).then(()=>{if(fightC===now.c&&ready(en.key))sync()});continue}mount(id,el,en,1);seen.add(id)}
 for(const [id,R] of rigs){if(seen.has(id))continue;rigs.delete(id);if(R.dying){R.ghost=true;ghosts.add(R);ghost(R)}else{R.cv.remove();ro.unobserve(R.cv)}}
 fitWidth(field);clearTop(field);clearChip(field);watchFoes(field);ground();if(rigs.size||ghosts.size)startLoop()}
// The estimate above cannot see every skin rule (chip widths, crowd rules); if the mounted line still overflows the field, the figures shrink to fit.
// A tall boss must not reach the HUD: with big phone text its chips grow, so it gives up height until its top clears the bar.
// The hero's incoming chip sits on her head; on short screens her head can reach the night/hunger badge under the portrait ring, so the chip slides right of it.
function clearChip(field){const chip=field&&field.querySelector('.unit.hero>.incoming'),esc=app.querySelector('.pw-esc');if(!chip)return;chip.style.removeProperty('--pw-chipdx');if(!esc)return;
 let r=esc.getBoundingClientRect();for(const e of esc.querySelectorAll('*')){const q=e.getBoundingClientRect();if(q.width&&q.height)r={left:Math.min(r.left,q.left),top:Math.min(r.top,q.top),right:Math.max(r.right,q.right),bottom:Math.max(r.bottom,q.bottom)}}
 const c=chip.getBoundingClientRect();if(!r.right||c.left>=r.right+4||c.top>=r.bottom+2||c.bottom<=r.top||c.right<=r.left)return;
 const sc=field.getBoundingClientRect().width/(field.clientWidth||1)||1;chip.style.setProperty('--pw-chipdx',((r.right+4-c.left)/sc).toFixed(1)+'px')}
function clearTop(field){const hud=app.querySelector(':scope>.top');if(!hud||!field)return;const lim=hud.getBoundingClientRect().bottom+2;let moved=false;
 for(const u of field.querySelectorAll(':scope>.side.foe>.unit.pw-fig')){let k=parseFloat(u.style.getPropertyValue('--k'))||1,n=0;
  while(k>.6&&u.getBoundingClientRect().top<lim&&n++<12){k=Math.max(.6,k-.05);u.style.setProperty('--k',k.toFixed(3));moved=true}}
 if(moved)for(const R of rigs.values())fit(R)}
// Text size and summons change the foes' row height without a re-render: re-check the HUD clearance and the ground then.
let foeRO=null,foeSeen=null,unitSeen=new WeakSet(),fontAt=0,fontMO=null;function watchFoes(field){const foe=field&&field.querySelector(':scope>.side.foe');if(!foe)return;
 if(foeRO)for(const u of field.querySelectorAll('.side>.unit'))if(!unitSeen.has(u)){unitSeen.add(u);foeRO.observe(u)}/* a unit that grows with the text size (a portrait plate's 3.3em pill) re-checks the line too */
 if(foe===foeSeen)return;foeSeen=foe;unitSeen=new WeakSet();
 {const yo=field.querySelector(':scope>.side.you');if(yo){if(!fontMO)fontMO=new MutationObserver(()=>{const f=app.querySelector('.battle .field.pw-stage'),y=f&&f.querySelector(':scope>.side.you');if(y&&px(getComputedStyle(y).fontSize)!==fontAt)sync()});fontMO.disconnect();fontMO.observe(yo,{attributes:true,attributeFilter:['style','class']})}}/* a text size set on the elements themselves re-solves the line in the same task, before anything paints (the resize observer below waits for the next frame) */
 if(!foeRO)foeRO=new ResizeObserver(()=>requestAnimationFrame(()=>{const f=app.querySelector('.battle .field.pw-stage');if(!f)return;const y=f.querySelector(':scope>.side.you');if(y&&px(getComputedStyle(y).fontSize)!==fontAt)return sync();/* the text size changed: solve the line again (the plates' 3.3em minimum grew) */fitWidth(f);clearTop(f);clearChip(f);ground()}));foeRO.disconnect();foeRO.observe(foe);const you=field.querySelector(':scope>.side.you');if(you)foeRO.observe(you);for(const u of field.querySelectorAll('.side>.unit')){unitSeen.add(u);foeRO.observe(u)}}/* both sides: a bigger text size widens the portraits after render, and the line must still fit */
// Last resort for a crowded line on big text (every unit already at its minimum width and neighbours still touch): the side gaps
// close, then the minimum widths step down (to 78%), measured after each step, until no two units overlap.
function squeeze(field){const us=()=>[...field.querySelectorAll(':scope>.side>.unit')].map(u=>u.getBoundingClientRect()).filter(q=>q.width).sort((a,b)=>a.left-b.left),fr=field.getBoundingClientRect();
 const bad=()=>{const q=us();return q.some((r,i)=>i&&r.left<q[i-1].right-.5)||(q.length&&(q[0].left<fr.left-.5||q[q.length-1].right>fr.right+.5))};
 const set=k=>{field.style.setProperty('--pw-sq',k.toFixed(2));field.classList.toggle('pw-squeeze',k<1.001)};
 let k=parseFloat(field.style.getPropertyValue('--pw-sq'))||1;if(!bad())return;if(k>1)k=1;set(k);
 for(let i=0;i<7&&bad()&&k>.78;i++){k=Math.max(.78,k-.04);set(k)}
 /* still touching at the smallest minimum (the 5v5 on the square viewer at 130% text): the line itself gets shorter by the overlap, a step at a time */
 for(let i=0;i<4&&bad();i++){const q=us();let ov=0;for(let j=1;j<q.length;j++)ov+=Math.max(0,q[j-1].right-q[j].left+1);const span=q.length?q[q.length-1].right-q[0].left:0,H=parseFloat(field.style.getPropertyValue('--pw-fh'))||0;if(!H||span<=0)break;const H2=Math.max(44,Math.floor(H*(1-ov/span))-1);if(H2>=H)break;field.style.setProperty('--pw-fh',H2+'px');if(rigs.size)for(const R of rigs.values())fit(R)}
 if(rigs.size)for(const R of rigs.values())fit(R)}
function fitWidth(field){const you=field.querySelector('.side.you'),foe=field.querySelector('.side.foe');if(!you||!foe)return;
 const sc=field.getBoundingClientRect().width/(field.clientWidth||1)||1,room=field.clientWidth-8;// the whole line, glow canvases included, stays inside the field
 for(let i=0;i<3;i++){const y=you.getBoundingClientRect(),f=foe.getBoundingClientRect();let l=Math.min(y.left,f.left),r=Math.max(y.right,f.right);
  for(const u of field.querySelectorAll(':scope>.side>.unit')){const q=u.getBoundingClientRect();if(q.width){l=Math.min(l,q.left);r=Math.max(r,q.right)}}/* units that overflow their side (plates at their min width) count too */
  for(const R of rigs.values()){const a=R.el&&R.el.isConnected&&field.contains(R.el)&&R.el.querySelector(':scope>.art');if(!a)continue;const q=frameRect(R),b=R.cur.bx||[0,1];if(q.width){l=Math.min(l,q.left+b[0]*q.width-6);r=Math.max(r,q.left+b[1]*q.width+6)}}/* the painted figure (tools/cast-anchors.py bx), not its see-through frame or canvas */
  const fr=field.getBoundingClientRect(),cx=fr.left+fr.width/2,used=2*Math.max(cx-l,r-cx)/sc;if(used<=room+.5)break;// measured from the centre: a big glow on one side must fit too; the gaps do not shrink with the figures, so it takes a pass or two
  const H=parseFloat(field.style.getPropertyValue('--pw-fh'))||0,H2=Math.max(44,Math.floor(H*room/used)-1);if(!H||H2>=H)break;field.style.setProperty('--pw-fh',H2+'px');for(const R of rigs.values())fit(R)}
 squeeze(field)}
// Figure height: the field's room, less the chips above and the name and bar below, and the row must fit side by side.
// Everyone stands on one line, heroes left and foes right (Randall 31 Oct: never stack the foes above the hero).
// Under the floor (96px, or 11% of the screen height) the figures read as specks, so a fight that cannot seat them at the floor keeps the portrait plates
// (decided once per fight and viewport; a fight already on figures only drops to plates when a summon crowds it hard).
const ALLY=.42,SEAL=.5,CHROME=36,MINW={hero:92,fig:56};/* = cast.css min-width of a hero / other figure unit *//* under 80px on screen the figures read as specks; a 5-on-5 on a phone or the Fold just makes it, Slay the Spire style, instead of falling back to plates */const floor=()=>80;let plates=null,fightH=null;
function size(field,hero,foeEls,now,g,hE,allyOf){if(!field)return;const you=field.querySelector('.side.you'),foe=field.querySelector('.side.foe');if(!you||!foe)return;
 const cs=getComputedStyle(field),W=field.clientWidth-px(cs.paddingLeft)-px(cs.paddingRight),Hf=field.clientHeight;// the room between the paddings
 const gapF=Math.min(20,px(cs.columnGap)||px(cs.gap)||12),// figure fields get a 20px column gap (cast.css); the first measure happens before any figure mounts
  gapY=px(getComputedStyle(you).columnGap)||px(getComputedStyle(you).gap)||8,gapE=px(getComputedStyle(foe).columnGap)||px(getComputedStyle(foe).gap)||8;
 let arY=0,arF=0,nY=0,nF=0,nA=0,kmax=1;const its=[];// [width per px of height, min width] per unit; -1 = a portrait's tap minimum
 for(const el of you.children){if(el.matches('.slot'))continue;if(el===hero&&hE){const p=hE.fw/hE.fh*packOf(hE);arY+=p;its.push([p,MINW.hero])}else if(el.matches('.unit')){const ae=el.matches('.ally[data-id]')&&allyOf?allyOf(el):null;if(ae){const k=ae.scale||.8,p=k*ae.fw/ae.fh*packOf(ae);arY+=p;its.push([p,MINW.fig]);el.style.setProperty('--k',k)}else{arY+=ALLY;nA++;its.push([ALLY,-1])}}else continue;nY++}
 for(const el of foeEls){const fe=now.c.enemies.find(x=>String(x.id)===el.dataset.id),en=entryForFoe(fe,g);if(en){const k=KSCALE[fe.rank||(en.rank==='token'?'token':'regular')]||.8,p=k*en.fw/en.fh*packOf(en);arF+=p;its.push([p,MINW.fig]);el.style.setProperty('--k',k);if(k>kmax)kmax=k}else{arF+=SEAL;its.push([SEAL,-1])}nF++}
 if(!arY&&!arF)return;
 /* Slay the Spire framing (Randall 1 Nov): solve the height for the full line, hero + 4 allies and 4 foes, from the first frame, so figures
    never grow when a fight starts small or shrink when summons arrive. Missing seats count as the average figure already on that side. */
 const real=its.slice(),nYr=nY,nFr=nF;
 {const fy=its.slice(0,nY).filter(([p,m])=>m===MINW.fig),pY=fy.length?fy.reduce((t,[p])=>t+p,0)/fy.length:.42,ff=its.slice(nY).filter(([p])=>p>0),pF=ff.length?ff.reduce((t,[p])=>t+p,0)/ff.length:.5;
  for(;nY<5;nY++){arY+=pY;its.push([pY,MINW.fig])}for(;nF<4;nF++){arF+=pF;its.push([pF,MINW.fig])}
  field.__pwFull={pY,pF}}
 const Hmax=(Hf-CHROME)/kmax;// a boss fight: the hero gives up a little height, the boss takes what the field allows (below)
 const sc=field.getBoundingClientRect().width/(field.clientWidth||1)||1,tap=Math.max(44/Math.max(1,sc),37);/* and never under the plate's stat pill (cast.css min-width 3.3em) */field.style.setProperty('--pw-tap',tap.toFixed(2)+'px');/* a portrait needs 44 on-screen px to tap, not 44 of the zoomed phone layout's px (on the Fold those dwarfed the figures) */
 /* the tallest height whose line fits: each unit is its body's width at that height, but never under its min width (cast.css: the bar's room, a portrait's tap), so solve by halving */
 const room=W-gapF-Math.max(0,nY-1)*gapY-Math.max(0,nF-1)*gapE-8,pmin=Math.max(tap,3.3*((fontAt=px(getComputedStyle(you).fontSize))||14)),need=h=>its.reduce((t,[p,m])=>t+Math.max(m<0?pmin:m,p*h),0);
 let H1=Hmax;if(need(0)>room)H1=Math.min(Hmax,...its.filter(([p])=>p>0).map(([p,m])=>(m<0?pmin:m)/p));/* even the minimum widths overflow: keep every unit at its minimum, as tall as that width allows (was the 44px floor, specks on the Fold) */
 else if(need(H1)>room){let lo=0,hi=Hmax;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(need(mid)<=room)lo=mid;else hi=mid}H1=lo}
 const vk=innerWidth+'x'+innerHeight;if(plates&&plates.vk!==vk)plates=null;
 let H=Math.min(innerHeight*.42/sc,Math.max(44,H1));
 /* one height per fight and screen: kept while the real line still fits at it, so a summon or a death never re-frames the fight */
 if(fightH&&fightH.vk===vk){const roomR=W-gapF-Math.max(0,nYr-1)*gapY-Math.max(0,nFr-1)*gapE-8,needR=h=>real.reduce((t,[p,m])=>t+Math.max(m<0?pmin:m,p*h),0);H=needR(fightH.H)<=roomR?fightH.H:Math.min(H,fightH.H)}
 fightH={vk,H};const Hs=H*sc;// a figure never takes more than 42% of the screen height// on-screen pixels: tablets scale the phone layout up
 if(!plates)plates={vk,on:Hs<floor()};else if(!plates.on&&Hs<floor()*.75)plates.on=true
 window.__pwSize={W,Hf,gapF,gapY,gapE,arY,arF,nY,nF,H1,H,sc,Hs,plates:plates.on};
 if(plates.on){field.classList.add('pw-plates');field.classList.remove('pw-small','pw-stage');field.style.removeProperty('--pw-fh');return false}
 field.classList.remove('pw-plates');for(const el of foeEls){const k=parseFloat(el.style.getPropertyValue('--k'))||1;if(k>1)el.style.setProperty('--k',Math.min(k,(Hf-CHROME-8)/H).toFixed(3))}/* the chip above and the bar below must stay inside the field, clear of the HUD */field.classList.toggle('pw-small',H*ALLY<64);field.style.setProperty('--pw-fh',Math.floor(H)+'px');return true}
function mount(id,el,entry,face,hp){const art=el.querySelector(':scope>.art');if(!art)return;let R=rigs.get(id);
 if(!R){R=rig(entry,id,face);rigs.set(id,R);R.fadeIn=T}
 else if(R.cur.key!==entry.key&&!R.act){morph(R,entry)}
 const st=art.querySelector(':scope>.stats'),bar=el.querySelector(':scope>.bar');if(st&&bar&&st.parentNode!==bar)bar.appendChild(st);if(bar&&hp)bar.dataset.hp=hp;// the life reads inside the bar, Test Fight style
 R.el=el;el.classList.add('pw-fig');el.style.setProperty('--ar',(R.cur.fw/R.cur.fh).toFixed(3));anchor(el,R.cur);el.style.setProperty('--pw-top',(R.cur.top||0).toFixed(3));/* bar and chips centre on the feet, the intent sits on the head, not the frame */if(R.cv.parentNode!==art)art.prepend(R.cv);fit(R)}
// A dead enemy keeps its last place on a fixed canvas while it falls.
function ghost(R){const r=R.lastRect||R.cv.getBoundingClientRect();if(!r.width){done(R);return}if(!fxLayer.isConnected)document.body.append(fxLayer);Object.assign(R.cv.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
 const b=R.box;fxLayer.appendChild(R.cv);R.W=r.width;R.H=r.height;R.box=b;R.el=null;const ms=R.dyingAt||0;if(ms)setTimeout(()=>act_(R,'defeat'),ms);else act_(R,'defeat')}

/* ---------- game logic to motion ---------- */
function kindOf(p,fe,g){const t=p.intent,d=g.E[p.key]||{};
 if(t==='atk'){if(fe.key==='sorin'||d.double)return 'double';if(d.first)return 'quick';if(tramples(fe))return 'charge';if(fe.key==='crawler')return 'crawl';if(fe.fly)return 'swoop';return 'strike'}
 if(t==='drain')return 'drain';if(t==='pull')return 'pull';if(t==='guard'||t==='shield'||t==='bolster'||t==='ward')return 'guard';if(t==='buff'||t==='enrage'||t==='rally')return 'rally';
 if(t==='summon'||t==='raise'||t==='scion'||t==='sweep')return 'summon';if(t==='transform')return 'transform';
 return 'cast'}
const rectOf=el=>{const a=el&&el.querySelector(':scope>.art');let r=(a||el)&&(a||el).getBoundingClientRect();if(r&&a&&el.classList.contains('pw-fig')){const q=el.getBoundingClientRect();r={left:q.left,right:q.right,width:q.width,top:r.top,bottom:r.bottom,height:r.height}}return r?{rect:r}:null};// a figure's body is its unit's width (the frame overhangs)
function hold(el,ms){if(!el||RM)return;el.classList.add('pw-hold');const id=el.dataset.id||'hero';holds.set(id,performance.now()+ms);setTimeout(()=>{if(el.isConnected)el.classList.remove('pw-hold');if(holds.get(id)<=performance.now()+1)holds.delete(id)},ms)}
function allyEl(id){return app.querySelector(`.battle .side.you .unit[data-id="${CSS.escape(id)}"]`)}
function foeEl(id){return app.querySelector(`.battle .side.foe .unit[data-id="${CSS.escape(id)}"]`)}
function heroEl(){return app.querySelector('.battle .unit.hero')}
function cssHit(el,cls){if(!el||!el.isConnected)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function diff(p,n,g){if(RM)return;const heroR=rigs.get('hero'),hEl=heroEl();
 // enemies acting: their intent picks the motion; whoever got hurt takes the hit on the beat
 let acted=false,beat=0;const dead=[];for(const [id] of p.foes)if(!n.foes.has(id)&&rigs.get(id))dead.push(rigs.get(id));
 for(const [aid] of p.allies)if(!n.allies.has(aid)&&rigs.get('a:'+aid))dead.push(rigs.get('a:'+aid));
 for(const [id,f] of n.foes){const pf=p.foes.get(id);if(!pf)continue;const R=rigs.get(id);
  if(f.key!==pf.key&&R){const to=entryForFoe(f.e,g);if(to&&to.key!==R.cur.key){act_(R,'transform',{to});continue}}
  if(f.phase2&&!pf.phase2&&R&&!R.act)act_(R,'phase');
  if(f.acting&&!pf.acting){acted=true;const kind=kindOf(pf,f.e,g);
   const tg=[];if(n.hp<p.hp||n.ward<p.ward)tg.push({el:hEl,R:heroR,rect:rectOf(hEl)});
   for(const [aid,a] of p.allies){const na=n.allies.get(aid);if(!na||na.dmg>a.dmg)tg.push({el:allyEl(aid),R:rigs.get('a:'+aid),rect:rectOf(allyEl(aid))})}
   const ms=R?act_(R,kind,{target:tg[0]||null}):0;beat=Math.max(beat,ms);
   if(ms){for(const t of tg)hold(t.el,ms);setTimeout(()=>{for(const t of tg){if(t.R)act_(t.R,'hit');else cssHit(t.el,'pw-recoil')}},ms)}
   else for(const t of tg){if(t.R)act_(t.R,'hit');else cssHit(t.el,'pw-recoil')}}}
 if(acted){for(const R of dead){R.dying=true;R.dyingAt=beat}return}
 // your turn: a creature that just tapped lunged; otherwise a spell flew from the hero
 const hurt=[];for(const [id,f] of n.foes){const pf=p.foes.get(id);if(pf&&f.hp<pf.hp)hurt.push({id,el:foeEl(id),R:rigs.get(id)})}
 for(const R of dead)hurt.push({id:R.id,el:null,R,dead:true});
 if(hurt.length){const att=[...n.allies].filter(([aid,a])=>a.tapped&&p.allies.get(aid)&&!p.allies.get(aid).tapped).map(([aid])=>[allyEl(aid),rigs.get('a:'+aid)]).filter(x=>x[0]||x[1]);
  let ms=0;if(att.length){const t=hurt.find(h=>h.el);for(const [el,R] of att){if(R&&!R.act){const en=R.cur,kind=(en.acts&&en.acts[0]&&en.acts[0][1])||'strike';ms=Math.max(ms,act_(R,kind,{target:t?rectOf(t.el):null}))}else{cssHit(el,'pw-lunge');ms=Math.max(ms,250)}}}
  else if(heroR&&!heroR.act){const t=hurt.find(h=>h.el);ms=act_(heroR,'cast',{target:t?rectOf(t.el):null})}
  for(const h of hurt){if(h.dead){h.R.dying=true;h.R.dyingAt=ms}else if(ms)hold(h.el,ms)}
  const land=()=>{for(const h of hurt){if(h.dead)continue;if(h.R)act_(h.R,'hit');else cssHit(h.el,'pw-recoil')}};
  if(ms)setTimeout(land,ms);else land()}
 if(n.hp<p.hp&&heroR&&!heroR.act)act_(heroR,'hit');}

/* ---------- zoom card: the held copy of a figure shows its idle pose ---------- */
new MutationObserver(ms=>{for(const m of ms)for(const nd of m.addedNodes){if(!(nd instanceof Element)||!nd.classList.contains('pw-zoom'))continue;const u=nd.querySelector('.unit.pw-fig');if(!u)continue;
 const src=[...rigs.values()].find(R=>R.el&&R.el.dataset.n===u.dataset.n)||[...rigs.values()][0];if(!src)continue;const e=src.cur,o=IMGS[fileOf(e.key)];if(!o||!o.ok)continue;
 u.style.setProperty('--ar',(e.fw/e.fh).toFixed(3));const cv=u.querySelector('canvas.pw-cast');if(!cv)continue;requestAnimationFrame(()=>{const r=cv.getBoundingClientRect(),a=cv.parentNode.getBoundingClientRect();cv.width=Math.round(r.width*DPR);cv.height=Math.round(r.height*DPR);const x=a.left-r.left,y=a.top-r.top,fr=e.frames[e.idle];const c2=cv.getContext('2d');c2.setTransform(DPR,0,0,DPR,0,0);c2.drawImage(o.a,fr[0],fr[1],e.fw,e.fh,x,y,a.width,a.height)})}}).observe(document.body,{childList:true});

/* ---------- perf readout (?castperf=1 or localStorage pw-castperf): rigs, frame ms, textures ---------- */
let perfEl=null;
function stats(){const a=perf.ms.filter(x=>x!=null);const avg=a.length?a.reduce((s,x)=>s+x,0)/a.length:0;let mem=0;for(const k of TEX.keys()){const e=BY[k];if(e)mem+=e.aw*e.ah*4*(GL2?1.33:1)+Math.round(e.aw/2)*Math.round(e.ah/2)*4}
 return {rigs:rigs.size,ghosts:ghosts.size,webgl:!!gl,webgl2:GL2,frameMsAvg:+avg.toFixed(2),frameMsMax:+perf.max.toFixed(2),textures:TEX.size,textureMB:+(mem/1048576).toFixed(1),jsHeapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null}}
function perfTick(ms){if(!perfEl.isConnected)document.body.append(perfEl);if((perf.i&15)===0){const s=stats();perfEl.textContent=`cast ${s.rigs} rigs · ${s.frameMsAvg} ms avg · ${s.frameMsMax} ms max · ${s.textures} tex ${s.textureMB} MB${s.jsHeapMB!=null?' · heap '+s.jsHeapMB+' MB':''} · ${s.webgl2?'webgl2':s.webgl?'webgl':'2d'}`}}
try{if(/[?&]castperf=1/.test(location.search)||localStorage.getItem('pw-castperf')==='1'){perfEl=document.createElement('div');perfEl.className='pw-cast-perf';perfEl.setAttribute('aria-hidden','true')}}catch(err){}

/* ---------- ground: the painted mat under the figures (Randall 31 Oct 11:41Z: the new mats, Slay the Spire placement) ---------- */
// A fight scene is one positioned box holding the mat (ground built in, feet line at 62% of the picture, floor from 48%).
// The box is placed so the feet line lands under the hero's feet at every size and never falls short of the screen; a wide
// phone cuts the sky, so the feet slide up a little first, and a wide twin of the mat (2.2:1) takes over where one exists.
// The painted mats (planeswalk-art/<key>.webp, 3:2, ground built in): the feet line sits at 62% of the picture, the floor opens at 48%.
const ART='./planeswalk-art/';
const MATS=['inn-area-graveyard','inn-area-village','inn-area-manor','inn-elite-thalia','inn-elite-gisa','inn-elite-olivia','inn-boss-sorin','inn-boss-liliana','inn-boss-avacyn','inn-dungeon-1','inn-dungeon-2','inn-dungeon-3',
 'zen-area-jungle','zen-area-coast','zen-area-wastes','zen-elite-kozilek','zen-elite-omnath','zen-elite-drana','zen-boss-obnixilis','zen-boss-ulamog','zen-boss-nissa','zen-dungeon-1','zen-dungeon-2','zen-dungeon-3'];
const FEET=.62,SLIDE=.07,CROP=.15;// feet line; how far the feet may slide up on a wide phone; the sky a phone may crop before they slide
const WIDE=new Set(MATS);// mats that also come as <key>-wide.webp (2272x1024): a battle wider than 1.8:1 takes that one, so a phone keeps the whole sky
const WIDE_AT=1.8,ACTS={1:'inn',2:'zen',3:'rav'};
const gready=im=>im.complete&&im.naturalHeight>0;
const gwait=im=>new Promise(res=>{if(im.complete)return res();im.addEventListener('load',res,{once:true});im.addEventListener('error',res,{once:true})});
let bgSig=null,bgKey=null;const BIMG={};const bimg=(k,wide)=>{const n=k+(wide&&WIDE.has(k)?'-wide':'');let im=BIMG[n];if(!im){im=BIMG[n]=new Image();im.decoding='async';im.src=ART+n+'.webp'}return im};
const isWide=b=>(b.offsetWidth+20)/(b.offsetHeight+20)>WIDE_AT;const matImg=(b,k)=>bimg(k,isWide(b));
function sceneOf(b){const v=getComputedStyle(b).getPropertyValue('--pw-bg').trim(),sig=v.slice(0,200);
 if(sig!==bgSig){bgSig=sig;bgKey=null;const rs=getComputedStyle(document.documentElement);
  for(const k of MATS){const u=rs.getPropertyValue('--pw-x-'+k).trim();if(u&&u.slice(0,200)===sig){bgKey=k;break}}
  }
 return bgKey}
function groundLoad(b){const k=b&&sceneOf(b);if(!k)return null;const im=matImg(b,k);return im.complete?null:gwait(im)}
// The act's mats load one after another while the map shows, so a fight opens on its painting without a wait.
function preloadGround(){const a=ACTS[document.body.dataset.actnum]||'inn',wide=innerWidth/innerHeight>WIDE_AT;let q=Promise.resolve();for(const k of MATS)if(k.startsWith(a))q=q.then(()=>gwait(bimg(k,wide)))}
function groundOff(b){if(!b)return;b.classList.remove('pw-ground');b.style.removeProperty('--pw-mat')}
function ground(){const b=app.querySelector('.battle'),field=b&&b.querySelector('.field.pw-stage'),hero=field&&(field.querySelector('.unit.hero.pw-fig>.art')||field.querySelector('.unit.pw-fig>.art'));// everyone stands on one line: a hero without a figure anchors the mat to any figure's feet
 if(!b||!hero||!rigs.size)return groundOff(b);
 const k=sceneOf(b),im=k&&matImg(b,k);if(!im||!gready(im))return groundOff(b);const BOX=im.naturalWidth/im.naturalHeight;
 const r=b.getBoundingClientRect(),zb=r.width/(b.offsetWidth||1)||1;// the battle is zoomed on tablets and desktops: work in its own px
 const Wb=b.offsetWidth+20,Hb=b.offsetHeight+20;// the backdrop sits 10px outside the battle (its ::after)
 const Ys=(hero.getBoundingClientRect().bottom-r.top)/zb+10;// the hero's feet
 let f=FEET;const boxH=f=>Math.max(Hb,Wb/BOX,Ys/f,(Hb-Ys)/(1-f));let Hg=boxH(f);// the picture's feet line under the feet, never short of the screen
 while(f>FEET-SLIDE+1e-6&&f*Hg-Ys>CROP*Hg){f=Math.max(FEET-SLIDE,f-.01);Hg=boxH(f)}// a wide phone cuts the sky: the feet slide up before the landmarks go
 const topG=Ys-f*Hg;
 const Wg=Hg*BOX,leftG=(Wb-Wg)/2;
 b.style.setProperty('--pw-bg-size',Wg.toFixed(1)+'px '+Hg.toFixed(1)+'px');b.style.setProperty('--pw-bg-pos',leftG.toFixed(1)+'px '+topG.toFixed(1)+'px');b.style.setProperty('--pw-mat','url("'+im.src+'")');
 b.classList.add('pw-ground')}
/* ---------- wiring ---------- */
/* ---------- painted spell sheets: planeswalk-cast/fx/<name>.webp, 3x2 cells, played once at 12 fps where the card lands ----------
   The game sends pw-spellfx {sheet, sel, late}: sel is the unit (or side) it lands on; late waits for the render that adds it. */
function sheetAt(name,sel){const u=document.querySelector(sel);if(!u)return;const a=u.querySelector(':scope>.art')||u,r=a.getBoundingClientRect();if(!r.width)return;
 const side=u.matches('.side'),s=side?Math.min(r.width*.8,innerHeight*.45):Math.max(r.width,r.height)*1.5,x=r.left+r.width/2,y=r.top+r.height*(side?.62:.55);
 if(!fxLayer.isConnected)document.body.append(fxLayer);const d=document.createElement('div');d.className='fxe pw-fxsheet';if(name==='shield'){/* one still: fade in, hold while the shield goes up, fade out */Object.assign(d.style,{left:x-s*.4+'px',top:y-s*.4+'px',width:s*.8+'px',height:s*.8+'px',backgroundImage:`url(${BASE}fx/shield.webp)`,backgroundSize:'contain',backgroundPosition:'50% 50%'});fxLayer.appendChild(d);d.animate([{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.75},{opacity:0}],{duration:1100}).finished.then(()=>d.remove(),()=>d.remove());return}Object.assign(d.style,{left:x-s/2+'px',top:y-s/2+'px',width:s+'px',height:s+'px',backgroundImage:`url(${BASE}fx/${name}.webp)`});fxLayer.appendChild(d);
 let f=0;const step=()=>{if(f>5||!d.isConnected){d.remove();return}d.style.backgroundPosition=`${(f%3)*50}% ${f<3?0:100}%`;f++;setTimeout(step,83)};step()}
const SHEETS=['fireball','grapeshot','summon-red','growth-red','quake-red','mana-red','draw','embers','fire-wave','exile','sun-spear','holy-burst','soldier-arrival','shield','anthem','sacrifice','belt-sacrifice','ultimatum-shatter','flashback-ghost'],SHEET_IMG=[];let sheetsP=false;
function preloadSheets(){if(sheetsP||RM)return;sheetsP=true;for(const n of SHEETS){const i=new Image();i.src=BASE+'fx/'+n+'.webp';SHEET_IMG.push(i)}}
addEventListener('pw-spellfx',ev=>{const d=ev.detail||{};if(RM||!d.sheet||!d.sel)return;const go=()=>sheetAt(d.sheet,d.sel);if(d.late)requestAnimationFrame(()=>requestAnimationFrame(go));else go()});
window.PW_CAST={stats,owns:id=>rigs.has(String(id))||rigs.has('a:'+id)||[...ghosts].some(R=>R.id===String(id)),impactDelay:id=>{const t=holds.get(String(id));return t?Math.max(0,Math.round(t-performance.now())):undefined},rigs,load,ready,resetPerf:()=>{perf.ms=[];perf.i=0;perf.max=0}};
if(app){new MutationObserver(()=>sync()).observe(app,{childList:true});addEventListener('resize',()=>{for(const R of rigs.values())fit(R);ground()});loadData().then(()=>sync())}
})();
