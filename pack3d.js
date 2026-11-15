// The 3D booster pack (Randall 15 Nov: "new animations and models … real art"), the web side of the app's Pack3D.kt.
// Randall's Blender pack, lightened for phones (assets/packs/pack3d-mesh.bin), wearing the set's real wrapper photo
// (assets/packs/real/<set>.webp) on its front and a darkened mirror of it on its back. The strip above the tear line
// (8.5 % from the top, where the 2D pack's seam glows) is its own part, so it can rip off. Drawn with WebGL into a canvas
// that sits in the pack's body, under the seam and the flash.
const REAL=new Set("10e 2ed 2x2 2xm 3ed 4ed 5dn 5ed 6ed 7ed 8ed 9ed a25 acr aer afr akh ala all apc arb arn atq avr bbd blb bng bok bro chk chr clb clu cmm cmr cn2 cns con csp dbl dft dgm dis dka dmr dmu dom drk dsk dst ecl eld ema emn eoe eve exo fdn fem fin fra frf fut gpt grn gtc hml hob hou ice iko ima inr inv isd jou jud khm kld ktk lci lea leb leg lgn lrw ltr m10 m11 m12 m13 m14 m15 m19 m20 m21 mat mb2 mbc mbs mh1 mh2 mh3 mid mir mkm mm2 mm3 mma mmq mom mor mrd msh nem neo nph ody ogw one ons otj pcy plc pls rav ren rin rix rna roe rtr rvr scg shm snc soi sok som sos spm sth stx sum tdm thb ths tla tmp tmt tor tsp tsr uds ugl ulg uma unf unh usg ust vis vow war woe wth wwk xln zen znr".split(' '));
const SEAL=.085;
export function pack3dCode(game,set={}){const c=String(set.code||set.id||'').toLowerCase();return game==='mtg'&&REAL.has(c)?c:'';}
let meshP=null;
const loadMesh=()=>meshP||=fetch('./assets/packs/pack3d-mesh.bin').then(r=>{if(!r.ok)throw Error('pack mesh '+r.status);return r.arrayBuffer();}).then(parse);
// pack3d-mesh.bin: "PK3D", version 1, six floats (height, tear line, x and y bounds), then four groups (body front, body back,
// strip front, strip back), each a vertex count, an index count, x y z nx ny nz u v per vertex and 16-bit indices.
export function parse(buf){
 const v=new DataView(buf);if(String.fromCharCode(...new Uint8Array(buf,0,4))!=='PK3D'||v.getInt32(4,true)!==1)throw Error('not a pack mesh');
 let o=8;const f=()=>{const x=v.getFloat32(o,true);o+=4;return x;};
 const h=f(),cut=f(),x0=f(),x1=f(),y0=f(),y1=f(),groups=[];
 for(let g=0;g<4;g++){const nv=v.getInt32(o,true),ni=v.getInt32(o+4,true);o+=8;
  const data=new Float32Array(buf.slice(o,o+nv*32));o+=nv*32;const index=new Uint16Array(buf.slice(o,o+ni*2));o+=ni*2;groups.push({data,index,verts:nv});}
 return {h,cut,x0,x1,y0,y1,groups,width:x1-x0,height:y1-y0,aspect:(x1-x0)/(y1-y0)};
}
const loadImage=src=>new Promise((ok,no)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>no(Error('no wrapper photo'));i.src=src;});
// The back: the front mirrored, blurred and darkened, its foil seals kept sharp (as the app's PackSkin.make).
function backOf(img){
 const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
 const s=document.createElement('canvas');s.width=Math.max(1,Math.round(w/18));s.height=Math.max(1,Math.round(h/18));s.getContext('2d').drawImage(img,0,0,s.width,s.height);
 x.save();x.translate(w,0);x.scale(-1,1);x.filter='saturate(.7) brightness(.42)';x.imageSmoothingQuality='high';x.drawImage(s,0,0,w,h);x.filter='none';
 const b=Math.round(h*SEAL);x.drawImage(img,0,0,w,b,0,0,w,b);x.drawImage(img,0,h-b,w,b,0,h-b,w,b);x.restore();return c;
}
const VS=`attribute vec3 p;attribute vec3 n;attribute vec2 t;
uniform float stretch,cut,px0,dist,ax,by,lift,strip;uniform vec2 hz,hx;uniform mat3 rot;
varying vec2 vt;varying vec3 vn;varying vec3 vp;
void main(){vec3 q=vec3(p.x*stretch,p.y,p.z);vec3 m=normalize(vec3(n.x/stretch,n.y,n.z));
 if(strip>.5){vec2 r=vec2(q.x-px0,q.y-cut);vec2 r2=vec2(r.x*hz.x-r.y*hz.y,r.x*hz.y+r.y*hz.x);
  float y3=r2.y*hx.x-q.z*hx.y,z3=r2.y*hx.y+q.z*hx.x;q=vec3(r2.x+px0,y3+cut+lift,z3);
  vec2 m2=vec2(m.x*hz.x-m.y*hz.y,m.x*hz.y+m.y*hz.x);m=vec3(m2.x,m2.y*hx.x-m.z*hx.y,m2.y*hx.y+m.z*hx.x);}
 q=rot*q;m=rot*m;vt=vec2(t.x,1.-t.y);vn=m;vp=q;
 gl_Position=vec4(q.x*ax,q.y*by,-q.z,dist-q.z);}`;
const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vt;varying vec3 vn;varying vec3 vp;uniform sampler2D tex;uniform float alpha,inside,camz;
void main(){vec3 m=normalize(vn);bool facing=dot(m,vec3(0.,0.,camz)-vp)>0.;
 vec3 L=vec3(.35,.55,.76);float g=min(1.,.62+.48*max(0.,dot(m,L)));
 if(!facing){if(inside<.5)discard;float d=g*.42;gl_FragColor=vec4(vec3(d,d,d+.024)*alpha,alpha);return;}
 bool seal=vt.y<${SEAL}||vt.y>1.-${SEAL};vec3 H=normalize(L+vec3(0.,0.,1.));float ndh=max(0.,dot(m,H));
 float n2=ndh*ndh,n4=n2*n2,n8=n4*n4;float peak=seal?n8*n4*n2:n8*n8*n8*n4*n2;
 float band=clamp(1.-abs(2.*m.z*m.y-.35)/.22,0.,1.);
 float s=clamp((seal?.55:.22)*peak+(seal?.35:.12)*band*band,0.,1.);
 vec4 c=texture2D(tex,vt);gl_FragColor=vec4((c.rgb*g+s*c.a)*alpha,c.a*alpha);}`;
const bez=(x1,y1,x2,y2)=>x=>{let lo=0,hi=1,t=.5;for(let i=0;i<24;i++){t=(lo+hi)/2;const bx=3*(1-t)**2*t*x1+3*(1-t)*t*t*x2+t**3;if(bx<x)lo=t;else hi=t;}return 3*(1-t)**2*t*y1+3*(1-t)*t*t*y2+t**3;};
const stripEase=bez(.3,.6,.4,1);
/**
 * Puts the 3D pack into [host] (the pack's body) for set [code]. Resolves to a controller, or null when the browser has no WebGL
 * or the photo or model fails to load (the 2D pack stays then). Controller: drift(x,y) turns it (-1..1), tear() rips the strip
 * (from 100 ms, 330 ms long), moveTo(el) moves the canvas (the torn pack the cards leave from), reset() seals it again,
 * dispose() frees it.
 */
export async function mountPack3D(host,code,{still=false}={}){
 const canvas=document.createElement('canvas');canvas.className='pack-3d-canvas';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl',{premultipliedAlpha:true,antialias:true,alpha:true});if(!gl)return null;
 let mesh,img;try{[mesh,img]=await Promise.all([loadMesh(),loadImage(`./assets/packs/real/${code}.webp`)]);}catch{return null;}
 const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const prog=gl.createProgram();try{gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));}catch{return null;}
 gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;gl.useProgram(prog);
 const U={};for(const k of ['stretch','cut','px0','dist','ax','by','lift','strip','hz','hx','rot','tex','alpha','inside','camz'])U[k]=gl.getUniformLocation(prog,k);
 const A={p:gl.getAttribLocation(prog,'p'),n:gl.getAttribLocation(prog,'n'),t:gl.getAttribLocation(prog,'t')};
 const bufs=mesh.groups.map(g=>{const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,g.data,gl.STATIC_DRAW);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,g.index,gl.STATIC_DRAW);return {vb,ib,count:g.index.length};});
 const texOf=src=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t;};
 const front=texOf(img),back=texOf(backOf(img));
 const aspect=img.naturalWidth/img.naturalHeight,stretch=aspect/mesh.aspect;
 let dx=0,dy=0,tearAt=0,tearing=false,stripGone=false,floatOn=!still,floatMix=floatOn?1:0,mixFrom=0,mixAt=0,raf=0,disposed=false;const t0=performance.now();
 const frame=now=>{raf=0;if(disposed)return;
  if(canvas.isConnected&&canvas.getClientRects().length){
   const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),W=Math.max(1,Math.round(r.width*dpr)),H=Math.max(1,Math.round(r.height*dpr));
   if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
   // The breathing turn eases out over 150 ms once the pack is torn, so the tap does not snap it.
   const target=floatOn&&!tearing&&!stripGone?1:0;if(target!==(mixAt?mixTo:floatMix)){mixFrom=floatMix;mixTo=target;mixAt=now;}
   if(mixAt){const k=Math.min(1,(now-mixAt)/150);floatMix=mixFrom+(mixTo-mixFrom)*k;if(k>=1)mixAt=0;}
   const fl=(.5-.5*Math.cos((now-t0)/4500*2*Math.PI))*floatMix;
   const yaw=-.10*fl+dx*.5,pitch=.05*fl-dy*.22;
   const tear=stripGone?1:tearing?stripEase(Math.max(0,Math.min(1,(now-tearAt-100)/330))):0;
   draw(W,H,yaw,pitch,tear);
  }
  raf=requestAnimationFrame(frame);};
 let mixTo=floatMix;
 const draw=(W,H,yaw,pitch,t)=>{
  gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  // The camera: 30° field of view, far enough that the pack's height fills the box's height at its middle.
  const dist=mesh.height/(2*Math.tan(Math.PI/12)),focal=H*dist/mesh.height;
  gl.uniform1f(U.stretch,stretch);gl.uniform1f(U.cut,mesh.cut);gl.uniform1f(U.dist,dist);gl.uniform1f(U.camz,dist);gl.uniform1f(U.ax,focal*2/W);gl.uniform1f(U.by,focal*2/H);
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  // yaw about y, then pitch about x (column-major for GL).
  gl.uniformMatrix3fv(U.rot,false,[cy,sy*sp,-sy*cp, 0,cp,sp, sy,-cy*sp,cy*cp]);
  // The strip hinges at the torn-from corner on the tear line, swings up and out, and tips back (as the app).
  const side=1,hz=side*(Math.min(t,.45)/.45*.55+Math.max(0,t-.45)/.55*2.05),hx=-(Math.min(t,.45)/.45*.25+Math.max(0,t-.45)/.55*.65);
  gl.uniform2f(U.hz,Math.cos(hz),Math.sin(hz));gl.uniform2f(U.hx,Math.cos(hx),Math.sin(hx));gl.uniform1f(U.px0,side*mesh.width/2*stretch);gl.uniform1f(U.lift,t*.12+Math.max(0,t-.45)*.25);
  gl.uniform1i(U.tex,0);gl.activeTexture(gl.TEXTURE0);
  const part=(gi,strip,alpha)=>{const b=bufs[gi];gl.bindBuffer(gl.ARRAY_BUFFER,b.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.ib);
   gl.enableVertexAttribArray(A.p);gl.vertexAttribPointer(A.p,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(A.n);gl.vertexAttribPointer(A.n,3,gl.FLOAT,false,32,12);
   gl.enableVertexAttribArray(A.t);gl.vertexAttribPointer(A.t,2,gl.FLOAT,false,32,24);
   gl.bindTexture(gl.TEXTURE_2D,gi%2?back:front);gl.uniform1f(U.strip,strip?1:0);gl.uniform1f(U.alpha,alpha);
   // The body's inside shows only once the top is open (sealed, it would peek through the crimp's zigzag); the strip's never.
   gl.uniform1f(U.inside,!strip&&(t>0||stripGone)?1:0);gl.drawElements(gl.TRIANGLES,b.count,gl.UNSIGNED_SHORT,0);};
  part(0,false,1);part(1,false,1);
  // The strip holds while it is pulled back, then fades as it flies off.
  const sa=t<.45?1:1-(t-.45)/.55;if(!stripGone&&sa>0){gl.depthMask(false);part(2,true,sa);part(3,true,sa);gl.depthMask(true);}
 };
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ctl.onLost?.();},{once:true});
 host.prepend(canvas);raf=requestAnimationFrame(frame);
 const ctl={canvas,aspect,
  drift(x,y){dx=x;dy=y;},
  tear(){if(tearing)return;tearing=true;tearAt=performance.now();},
  moveTo(el){stripGone=true;el.prepend(canvas);},
  reset(home){tearing=false;stripGone=false;(home||host).prepend(canvas);},
  dispose(){disposed=true;cancelAnimationFrame(raf);canvas.remove();gl.getExtension('WEBGL_lose_context')?.loseContext();}};
 return ctl;
}
