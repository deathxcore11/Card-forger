// Hot-stamped Yu-Gi-Oh! name foil. Letters are found in the card's own name bar
// (flat black or white ink that differs from the bar's median brightness and is
// nearly colourless, so gold, teal, magenta and dark Xyz bars all work), then lit
// as recessed foil by the detail view's existing light position. Approximate
// simulation over a flat image, not a physical-foil capture.
// Name bar measured on 813x1185 YGOPRODeck renders: clears descenders, stops before the Attribute orb.
export const YGO_NAME_BOX=[.072,.050,.828,.108];
export const YGO_NAME_RARITY={silver:1,gold:2,rainbow:3,platinum:4};
const masks=new Map();
const smooth=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};
// Coverage per pixel of the name bar (0..1). Pure so it can be tested without a browser.
export function glyphCoverage(rgba,w,h){
 const n=w*h,lum=new Float32Array(n),sat=new Float32Array(n);
 for(let i=0;i<n;i++){const r=rgba[i*4]/255,g=rgba[i*4+1]/255,b=rgba[i*4+2]/255;lum[i]=.2126*r+.7152*g+.0722*b;sat[i]=Math.max(r,g,b)-Math.min(r,g,b);}
 const med=Float32Array.from(lum).sort()[n>>1],raw=new Float32Array(n),out=new Float32Array(n);
 for(let i=0;i<n;i++)raw[i]=smooth(.20,.34,Math.abs(lum[i]-med))*(1-smooth(.18,.32,sat[i]));
 // Light 3x3 soften keeps letter edges anti-aliased for the bevel slope.
 for(let j=1;j<h-1;j++)for(let i=1;i<w-1;i++){let s=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)s+=raw[(j+b)*w+i+a]*(a||b?1:4);out[j*w+i]=Math.min(1,s/12);}
 return out;
}
// Reads the name bar from a loaded image. Cross-origin (tainted) images return null and
// keep the conservative title-band glint instead.
export function ygoNameMask(img){
 const src=img?.currentSrc||img?.src||'';if(!src||!img.naturalWidth)return null;
 if(masks.has(src))return masks.get(src);
 let result=null;
 try{
  const W=img.naturalWidth,H=img.naturalHeight,x0=Math.round(YGO_NAME_BOX[0]*W),y0=Math.round(YGO_NAME_BOX[1]*H),w=Math.round(YGO_NAME_BOX[2]*W)-x0,h=Math.round(YGO_NAME_BOX[3]*H)-y0;
  if(w<24||h<6)return null;
  const doc=img.ownerDocument,bar=doc.createElement('canvas');bar.width=w;bar.height=h;
  const bx=bar.getContext('2d',{willReadFrequently:true});bx.drawImage(img,x0,y0,w,h,0,0,w,h);
  const px=bx.getImageData(0,0,w,h),cover=glyphCoverage(px.data,w,h);
  const glyph=doc.createElement('canvas');glyph.width=w;glyph.height=h;const gx=glyph.getContext('2d'),gd=gx.createImageData(w,h);
  const alpha=doc.createElement('canvas');alpha.width=w;alpha.height=h;const ax=alpha.getContext('2d'),ad=ax.createImageData(w,h);
  for(let i=0;i<w*h;i++){const v=Math.round(cover[i]*255);gd.data[i*4]=v;gd.data[i*4+3]=255;ad.data[i*4+3]=v;}
  gx.putImageData(gd,0,0);ax.putImageData(ad,0,0);
  result={glyph,alphaUrl:alpha.toDataURL('image/png'),width:w,height:h};
 }catch{result=null;}
 if(masks.size>=24)masks.delete(masks.keys().next().value);
 masks.set(src,result);return result;
}
// CSS placement of a box-sized mask image inside a full-card layer.
export function nameMaskStyle(url){
 const [x0,y0,x1,y1]=YGO_NAME_BOX,sw=x1-x0,sh=y1-y0,pos=(o,s)=>`${(o/(1-s)*100).toFixed(3)}%`;
 const pc=v=>`${(v*100).toFixed(3)}%`;
 // Clipped to the name bar as well as masked to the letters, so nothing can paint outside it.
 return {clipPath:`inset(${pc(y0)} ${pc(1-x1)} ${pc(1-y1)} ${pc(x0)})`,maskImage:`url("${url}")`,webkitMaskImage:`url("${url}")`,maskSize:`${(sw*100).toFixed(3)}% ${(sh*100).toFixed(3)}%`,webkitMaskSize:`${(sw*100).toFixed(3)}% ${(sh*100).toFixed(3)}%`,maskPosition:`${pos(x0,sw)} ${pos(y0,sh)}`,webkitMaskPosition:`${pos(x0,sw)} ${pos(y0,sh)}`,maskRepeat:'no-repeat',webkitMaskRepeat:'no-repeat'};
}
const VS='attribute vec2 a;varying vec2 v;void main(){v=(a+1.0)*.5;gl_Position=vec4(a,0.0,1.0);}';
export const YGO_NAME_FRAGMENT=`precision highp float;
varying vec2 v;
uniform sampler2D u_glyph;
uniform vec2 u_light;uniform vec2 u_texel;uniform vec4 u_box;uniform float u_aspect;uniform float u_rarity;
vec3 toLinear(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
vec3 toSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
float g(vec2 p){return texture2D(u_glyph,p).r;}
void main(){
 float c=g(v);if(c<=0.0){gl_FragColor=vec4(0.0);return;}
 vec2 uv=u_box.xy+vec2(v.x,1.0-v.y)*(u_box.zw-u_box.xy); // card space, top-left origin
 // Letters are pressed into the card: height = -coverage. Slope from neighbours.
 vec2 d=u_texel*1.5;
 float dx=g(v+vec2(d.x,0.0))-g(v-vec2(d.x,0.0)),dy=g(v-vec2(0.0,d.y))-g(v+vec2(0.0,d.y));
 vec3 n=normalize(vec3(dx*1.6,dy*1.6,1.0));
 vec3 toL=vec3((u_light-uv)*vec2(1.0,u_aspect),.45),L=normalize(toL),H=normalize(L+vec3(0.0,0.0,1.0));
 float spot=exp(-dot(toL.xy,toL.xy)/.30),shade=clamp(dot(n,L)*.6+.4,.15,1.0),spec=pow(max(dot(n,H),0.0),48.0),wall=clamp(length(vec2(dx,dy)),0.0,1.0);
 vec2 tilt=(u_light-.5)/.55;
 vec3 metal;
 if(u_rarity<1.5)metal=vec3(.62,.66,.72);
 else if(u_rarity<2.5)metal=vec3(.83,.55,.13);
 else if(u_rarity>3.5)metal=vec3(.74,.77,.84); // platinum: cooler and brighter than silver
 else{float hue=fract(uv.x*1.3+uv.y*.7+tilt.x*.35+tilt.y*.2);vec3 rain=.5+.5*cos(6.28318*(hue+vec3(0.0,.33,.67)));
  float hatch=.5+.5*sin(dot(gl_FragCoord.xy,vec2(1.0))*1.2566); // 5 px period: never finer than the screen
  metal=mix(vec3(.70,.72,.78),toLinear(rain),.55+.25*hatch);}
 vec3 foil=metal*shade*(.42+.58*spot)+vec3(1.0,.97,.9)*(spec*(.35+.65*spot)+wall*max(dot(n,L),0.0)*spot*.6);
 gl_FragColor=vec4(toSrgb(clamp(foil,0.0,1.0)),c);
}`;
// Mounts the lit name canvas over the name bar. Returns null (keep the CSS layer) when
// WebGL, the shader or the pixels are unavailable; never fakes a lit result.
export function mountYgoNameFoil(overlay,img,material,mask){
 const rarity=YGO_NAME_RARITY[material];if(!rarity||!mask)return null;
 const doc=overlay.ownerDocument,canvas=doc.createElement('canvas'),[x0,y0,x1,y1]=YGO_NAME_BOX;
 canvas.className='finish-name-foil';canvas.setAttribute('aria-hidden','true');
 Object.assign(canvas.style,{left:`${x0*100}%`,top:`${y0*100}%`,width:`${(x1-x0)*100}%`,height:`${(y1-y0)*100}%`});
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});if(!gl)return null;
 const shader=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null;};
 const vs=shader(gl.VERTEX_SHADER,VS),fs=shader(gl.FRAGMENT_SHADER,YGO_NAME_FRAGMENT);if(!vs||!fs)return null;
 const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))return null;
 gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const u=n=>gl.getUniformLocation(p,n);
 [[mask.glyph,'u_glyph']].forEach(([source,name],i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
  for(const [k,val] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,k,val);gl.uniform1i(u(name),i);});
 gl.uniform2f(u('u_texel'),1/mask.width,1/mask.height);gl.uniform4f(u('u_box'),x0,y0,x1,y1);gl.uniform1f(u('u_aspect'),img.naturalHeight/img.naturalWidth);gl.uniform1f(u('u_rarity'),rarity);
 if(gl.getError())return null;
 overlay.append(canvas);
 let last='';
 const pct=v=>{const n=parseFloat(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n))/100:.5;};
 const draw=()=>{
  if(!canvas.isConnected)return;
  const css=globalThis.getComputedStyle?.(overlay),lx=pct(css?.getPropertyValue('--finish-x')),ly=pct(css?.getPropertyValue('--finish-y'));
  const dpr=Math.min(2,globalThis.devicePixelRatio||1),w=Math.max(1,Math.min(mask.width,Math.round(canvas.clientWidth*dpr))),h=Math.max(1,Math.min(mask.height,Math.round(canvas.clientHeight*dpr))),key=[lx,ly,w,h].join();
  if(key===last)return;last=key;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  // Same mapping as the approved prototype: light sits ahead of the pointer by 10%.
  gl.viewport(0,0,w,h);gl.uniform2f(u('u_light'),.5+(lx-.5)*1.1,.5+(ly-.5)*1.1);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 };
 // Light coordinates are inline custom properties set on an ancestor (pointer, gyro, zoom).
 // Watch those style attributes instead of running a per-frame loop.
 const mo=typeof MutationObserver==='undefined'?null:new MutationObserver(draw);
 for(let n=overlay.parentElement;n&&n!==doc.documentElement;n=n.parentElement)mo?.observe(n,{attributes:true,attributeFilter:['style','class']});
 const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(draw);ro?.observe(canvas);
 draw();
 return {canvas,draw,dispose(){mo?.disconnect();ro?.disconnect();canvas.remove();gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
