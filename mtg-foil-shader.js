// The Magic foil shader, as a template. Each foil type's code sits behind a #if, and a card's shader is
// composed with only its own type's lines, so no card pays for patterns it does not draw (one small
// program per foil type, compiled the first time that type is shown).
//
// The card is built in the order the printer builds it:
//   1 foil sheet : metal film with a pressed holographic pattern. Out of the light it looks like the plain
//                  card. Where the light catches it: a white glare, and either side of it wide bands of
//                  colour that slide across the card as it turns.
//   2 ink        : printed on the metal. Light ink lets the foil through, dark ink hides it.
//   3 top marks  : clear holograms pressed on top of the ink (Phyrexian marks, glitter). They show over any ink.
//   4 varnish    : a clear coat over the whole face that returns a small white gloss.
// Every length is a share of the card, never of the screen; detail too fine for the card's size on screen
// fades to its average instead of turning to noise.
// The light is a room light far away, as a phone is held (approved 15 Nov 2026, preview look "New"): the card turns
// under it, colour sweeps the foil in wide bands as it tilts, a soft bar of light passes when it is tipped toward the
// light, and the printed art keeps its own colours. There is no round spotlight (0.4.82 had one and it left a white
// haze over the art). Composed for one card, the shader draws exactly what that preview's shader drew
// (test-mtg-foil-real-browser.mjs compares them pixel for pixel with test-fixtures/finish-effects/mtg-foil-new-approved.glsl).
// Approximate simulation on reference images, not a physical-foil capture.
export const MTG_FOIL_TEMPLATE=`uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;
uniform vec4 u_art;uniform vec4 u_text;
uniform vec4 u_r1; // pattern, tint, coverage, relief (the shader is also composed for its pattern, see the #if lines)
uniform vec4 u_r2; // film, sparkle, stamp (1 shooting star), keep (share of the printed art left visible)
const float PI=3.14159265;
vec3 f_amb;float f_gloss;float f_leak;vec3 f_top;float f_glare;
// How strongly the foil shows: between the preview's Soft and Natural for every type; oil slick goes past Natural.
float strength(){return u_r2.x>.5?.9:.5;}
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+17.31));}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float inBox(vec2 p,vec4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
// Detail with this many repeats across the card's width is drawn only while a repeat covers a few pixels.
float lod(float cycles){return smoothstep(2.,5.,u_px.x/cycles);}
// The colour a holographic sheet sends to the eye turns through the spectrum as the angle changes.
vec3 hue(float t){return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));}
vec3 film(float cosT,float t){vec3 ph=4.*PI*1.45*t*cosT/vec3(650.,532.,450.);return .5+.5*cos(ph);}
vec3 shoulder(vec3 x){vec3 e=max(x-.8,0.);return min(x,.8)+.2*e/(e+.2);}
vec3 voro(vec2 q){vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return vec3(id,sqrt(d2)-sqrt(d1));}
// Light the foil sheet sends back, relative to white paper (1.0). lq is where the light's glare sits on the
// card, near/wide how much key light reaches this spot (tight and broad), N the surface normal with relief.
vec3 foil(float pat,float tint,vec2 uv,vec2 lq,vec3 L,vec3 V,vec3 N,float near,float wide,vec2 grad,float height){
 vec3 H=normalize(L+V);vec2 q=vec2(uv.x,uv.y*u_aspect),r=q-lq;vec2 g=normalize(vec2(.9,.44));
 // k colour turns per card width, ph extra turn, w how much colour (set <0 to fade it out inside the glare)
 float k=1.7,ph=0.,w=-1.,lines=1.,glint=0.,mirror=.5,ex=10.,amp=1.5,sat=.85,off=.55,spec=-1.,streak=.35,widen=0.;
 f_amb=vec3(.93);f_gloss=1.;f_leak=.05;f_top=vec3(0.);
 if(pat<1.5){}                                                                                  // traditional
#if PAT==2
 else if(pat<2.5){g=normalize(vec2(.6,.8));k=1.25;mirror=.3;ex=6.;amp=1.35;sat=.9;streak=0.;widen=.45;f_amb=vec3(.86);f_leak=.08;} // old border: hazy, strong, a darker card
#endif
#if PAT==3
 else if(pat<3.5){g=vec2(1.,0.);k=3.;mirror=1.;sat=.8;streak=0.;widen=.3;f_amb=vec3(.86);f_gloss=1.8;f_leak=.08;   // From the Vault: thick gloss, upright bars
  spec=.7*exp(-pow(H.x/.05,2.))+.3*exp(-pow(H.x/.2,2.));}
#endif
#if PAT==4
 else if(pat<4.5){float fine=lod(260.);vec3 c=voro(q*260.);vec2 j=hash2(c.xy);vec3 n=normalize(vec3((j-.5)*.9,1.)); // etched: metal ink grain, no laminate
  float grain=pow(max(dot(n,H),0.),70.)*2.,haze=pow(max(dot(N,H),0.),5.)*.5;
  spec=mix(haze,grain*.75+haze*.45,fine);mirror=1.;amp=.18;sat=.3;streak=0.;widen=.5;f_amb=vec3(.95);f_gloss=0.;f_leak=.03;}
#endif
#if PAT==5
 else if(pat<5.5){float gr=sin(height*55.);vec2 gn=length(grad)>1e-4?normalize(grad):vec2(1.,0.);  // textured: grooves along the art's contours
  ph=height*3.;N=normalize(N+vec3(gn*cos(height*55.)*.05,0.));mirror=.5;ex=22.;amp=1.3;lines=.82+.18*gr;streak=0.;}
#endif
#if PAT==6
 else if(pat<6.5){float w1=sin(q.x*30.+sin(q.y*9.)*2.),w2=sin((q.x+q.y)*24.+sin(q.x*7.)*2.5);      // surge: crossing waves
  g=normalize(vec2(.8,.6));k=2.2;ph=w1*.22+w2*.18;lines=.72+.28*w1*w2;amp=1.45;sat=.9;streak=0.;widen=.2;}
#endif
#if PAT==7
 else if(pat<7.5){}                                                                              // galaxy: traditional + stars (sparkle)
#endif
#if PAT==8
 else if(pat<8.5){vec2 c=q-vec2(.5,.5*u_aspect);float rr=length(c),a=atan(c.y,c.x);              // halo: arcs wheeling round the centre
  float arc=sin(a*6.+rr*40.);k=1.2;ph=a/PI+rr*2.5+arc*.12;w=1.;lines=.62+.38*arc;amp=1.7;streak=0.;widen=.45;}
#endif
#if PAT==9
 else if(pat<9.5){vec3 c=voro(q*30.);vec2 j=hash2(c.xy);float on=step(.55,j.x)*smoothstep(0.,.05,c.z); // confetti
  ph=on*j.y;amp=mix(1.,1.9,on);sat=mix(.7,.95,on);streak=.3*(1.-on);
  glint=on*pow(max(dot(normalize(vec3((j-.5)*.7,1.)),H),0.),40.)*.6;}
#endif
#if PAT==10
 else if(pat<10.5){g=vec2(1.,0.);k=5.5;amp=1.8;sat=.95;streak=.15;widen=.5;}                    // double rainbow (second sheet below)
#endif
#if PAT==11
 else if(pat<11.5){vec3 c=voro(q*24.);vec2 j=hash2(c.xy);vec3 fn=normalize(vec3((j-.5)*.55,1.));   // fracture: small shards, each with its own tilt
  float fine=lod(48.),edge=1.-smoothstep(0.,.06,c.z);ph=j.y*.7*fine;
  spec=mix(pow(max(dot(N,H),0.),8.)*.5,pow(max(dot(fn,H),0.),46.)*1.5,fine);glint=edge*fine*pow(max(dot(fn,H),0.),12.)*.3;mirror=1.;amp=.9;sat=.75;streak=0.;widen=.4;}
#endif
#if PAT==12
 else if(pat<12.5){vec2 c=q-vec2(.5,.42*u_aspect);float rr=length(c);                             // ripple
  k=.8;ph=rr*5.;w=1.;lines=mix(.9,.8+.2*sin(rr*170.),lod(54.));streak=0.;widen=.3;}
#endif
#if PAT==13
 else if(pat<13.5){vec2 p=q*vec2(9.,9.),c=floor(p),f=fract(p)-.5;float rr=length(f),fine=lod(60.); // mana: discs with a mana mark, pressed into the sheet
  float ring=1.-smoothstep(.02,.05,abs(rr-.32)),pip=0.;for(int i=0;i<5;i++){float ak=float(i)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.04,.07,length(f-.16*vec2(cos(ak),sin(ak)))));}
  float disc=1.-smoothstep(.3,.34,rr),sym=max(ring,pip)*fine;g=vec2(1.,0.);k=2.;ph=(hash(c+3.1)-.5)*.6*disc*fine;lines=1.+.22*disc*fine;
  glint=sym*(.25+pow(max(dot(N,H),0.),6.)*.7);streak=.15;widen=.25;}
#endif
#if PAT==14
 else if(pat<14.5){vec2 p=q*vec2(16.,22.);float row=floor(p.y);p.x+=mod(row,2.)*.5;vec2 f=fract(p)-vec2(.5,0.);  // dragonscale
  float sc=length(f*vec2(1.,1.3)),fine=lod(32.);N=normalize(N+vec3(f*vec2(.6,.4),0.)*fine);ph=sc*.8*fine;lines=1.-.45*smoothstep(.4,.5,sc)*fine;glint=fine*smoothstep(.3,.45,sc)*(1.-smoothstep(.45,.5,sc))*pow(max(dot(N,H),0.),6.)*.3;mirror=.6;ex=14.;streak=0.;widen=.3;}
#endif
#if PAT==15
 else if(pat<15.5){g=vec2(.3,.95);k=2.8;amp=1.8;sat=.95;widen=.5;lines=mix(.95,.88+.12*sin(q.y*PI*2.*95.),lod(190.));} // rainbow foil: more colour at every angle
#endif
#if PAT==16
 else if(pat<16.5){vec2 p=q*14.,f=fract(p)-.5;float dm=abs(f.x)+abs(f.y);                       // invisible ink: clear pattern seen only in the reflection
  f_top=vec3((smoothstep(.34,.36,dm)-smoothstep(.42,.44,dm))*lod(56.)*pow(max(dot(N,H),0.),22.)*.5);}
#endif
#if PAT==17
 else if(pat<17.5){}                                                                             // raised / embossed: traditional + relief
#endif
#if PAT==18||COVER==6
 else if(pat<18.5){mirror=1.;ex=12.;amp=.45;sat=.35;streak=.1;widen=.3;f_amb=vec3(.9);f_leak=.1;} // silver / gold mirror sheet
#endif
#if PAT==19
 else if(pat<19.5){f_gloss=1.35;}                                                             // ampersand: the big & is already in the card picture; it sits under a glossier coat
#endif
#if PAT==20
 else if(pat<20.5){g=vec2(.3,.95);k=1.9;lines=mix(.86,.72+.28*sin(q.y*PI*2.*80.),lod(160.));streak=0.;} // Vault Boy: CRT scanlines in the sheet
#endif
#if PAT>=21
 else{vec2 p=q*vec2(4.,5.3);p.x+=mod(floor(p.y),2.)*.5;vec2 c=floor(p),m=(fract(p)-.5)/vec2(4.,5.3);              // step-and-compleat: rows of the Phyrexian mark on top of the ink
  float ring=abs(length(m)-.024)-.0055,bar=max(abs(m.x)-.005,abs(m.y)-.043);float sym=(1.-smoothstep(0.,.004,min(ring,bar)))*lod(45.);
  vec2 mc=(c+.5-vec2(mod(c.y,2.)*.5,0.))/vec2(4.,5.3)-lq;float band=exp(-dot(mc,mc)/.22)*smoothstep(.03,.12,length(mc)+.05*hash(c));
  f_top=sym*hue(mc.y*2.4+mc.x*.5+.3)*band*1.25;}
#endif
 float along=dot(r,g);
 // Fine dashes in the sheet, laid along the colour bands.
 float fs=lod(45.)*streak,n=vnoise(vec2(dot(q,g)*45.,dot(q,vec2(-g.y,g.x))*6.));
 if(w<0.)w=smoothstep(.05,.22,abs(along));
 float t=abs(along)*k+ph+(n-.5)*fs+dot(N.xy,g)*2.;
 vec3 rb=mix(vec3(1.),hue(t),sat);
 if(pat>9.5&&pat<10.5)rb=.5*(rb+mix(vec3(1.),hue(abs(dot(r,normalize(vec2(-.5,.86))))*4.5),sat))*1.1;
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
 vec3 metal=tint<.5?vec3(1.):tint<1.5?vec3(1.,.78,.4):vec3(.9,.93,.98);
 vec3 col=w*amp*mix(.7,1.,strength())*(rb-off)*(1.+1.2*(n-.5)*fs);
 if(tint>.5)col=metal*w*amp*(.25+.3*dot(rb,vec3(.333)))+col*.3*step(1.5,tint);
 float env=mix(wide,1.,near*.6);
 f_amb=max(f_amb,vec3(1.));f_amb*=metal;f_glare=near*mirror*spec*.6;
 return f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines;
}
#if STAMP==1
float shootingStar(vec2 uv){vec2 c=vec2(u_text.x+.035,u_text.w-.03),d=(uv-c)*vec2(1.,u_aspect);
 float star=max(0.,1.-(abs(d.x)+abs(d.y))*95.)+max(0.,1.-length(d)*140.);
 vec2 t=d;float arc=.004*sin(clamp(t.x*40.,0.,PI));float tail=step(0.,t.x)*step(t.x,.05)*smoothstep(.0022,0.,abs(t.y+arc))*(1.-t.x*20.);
 return clamp(star*2.+tail,0.,1.);}
#endif
// base: linear colour of the ink at this spot; uv: where on the card face (0,0 top left). Returns linear colour.
vec3 foilShade(vec3 base,vec2 uv,vec4 mk,vec4 rl,vec2 grad){
 float art=inBox(uv,u_art),text=inBox(uv,u_text);
 vec2 lp=vec2(.5,.45)+u_tilt*.6;vec3 P=vec3(uv.x,uv.y*u_aspect,0.);vec2 lq=vec2(lp.x,lp.y*u_aspect);
 vec3 L=normalize(vec3(lq,.85)-P),V=normalize(vec3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 // How much key light reaches this spot: a tight share for the glare, a broad one for hazy sheets.
 vec2 dl=P.xy-lq;float near=exp(-dot(dl,dl)/.3),wide=.3+.7*exp(-dot(dl,dl)/1.1);
 // A room light far away, as a phone is held: the card turns under it. Its mirror image sweeps the card as a long soft
 // bar, and the colour lies over the whole sheet in wide bands that move with the turn. No round spot.
 {float yaw=u_tilt.x*.5,pitch=u_tilt.y*.5,cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);
  vec3 Lw=normalize(vec3(.25,-.6,1.)),a=vec3(Lw.x*cy+Lw.z*sy,Lw.y,-Lw.x*sy+Lw.z*cy);
  L=normalize(vec3(a.x,a.y*cp+a.z*sp,-a.y*sp+a.z*cp));H=normalize(L+V);
  lq=vec2(.5,.5*u_aspect)+L.xy/max(L.z,.25)*2.2;dl=P.xy-lq;
  vec2 bn=normalize(vec2(.8,1.));float across=dot(dl,bn);
  near=strength()*exp(-across*across/.006)*(.5+.5*exp(-dot(dl,dl)/3.));
  wide=.62+.38*exp(-dot(dl,dl)/2.5);}
 float rel=u_r1.w*(1.-.7*text);vec3 N=normalize(vec3(-grad*rel*9.,1.));
 float pat=u_r1.x,tint=u_r1.y,mode=u_r1.z;
 // Where the foil shows: whole card; frame only (etched art is printed on white); or one ink.
 float cov=1.;
 if(mode>.5&&mode<1.5)cov=1.-art;else if(mode>1.5&&mode<2.5)cov=mk.r;else if(mode>3.5&&mode<4.5)cov=mk.b;else if(mode>4.5&&mode<5.5)cov=mk.a;
 if(mode>1.5&&(mode<2.5||(mode>3.5&&mode<5.5)))cov*=1.-text;
 vec3 F=foil(pat,tint,uv,lq,L,V,N,near,wide,grad,rl.r);
 // Gold stamped on top of a foil card (gilded): the stamp is its own raised gold metal, the rest stays foil.
#if COVER==6
 if(mode>5.5){vec3 amb=f_amb,tp=f_top;float gl=f_gloss,lk=f_leak;vec3 G=foil(18.,1.,uv,lq,L,V,N,near,wide,grad,rl.r);float s=smoothstep(.25,.6,mk.r)*(1.-text);
  F=mix(F,G*1.1,s);f_amb=mix(amb,f_amb,s);f_gloss=mix(gl,1.6,s);f_leak=mix(lk,.3,s);f_top=tp;}
#endif
 // Thin film replaces the sheet's colour (oil slick): colour depends on view angle and film thickness.
vec3 fadd=vec3(0.);
#if FILM
 if(u_r2.x>.5){float t=320.+260.*rl.r+120.*hash(floor(uv*vec2(120.,168.)));vec3 f=film(dot(N,V),t);f_amb=vec3(.2);F=f*(.2+wide*(1.1*pow(max(dot(N,H),0.),16.)+.45));
  // The film is a clear coat over the ink, so its colour also flows over black ink, in slow swirls that shift with the turn.
  vec2 dq=P.xy-lq;float cT=.7+.3/(1.+dot(dq,dq))+.05*rl.r,t2=420.+330.*vnoise(uv*vec2(3.,4.2))+120.*rl.r;
  fadd=clamp((film(cT,t2)-.5)*1.35+.5,0.,1.)*(.35*wide+.5*near)*.4;}
#endif
 // Ink over metal: light ink lets the lit foil through, dark ink hides it; the darkest ink still passes a
 // faint glint of the highlight.
 float keep=u_r2.w,c=clamp(cov*(1.-keep),0.,1.);
 float lum=dot(base,vec3(.2126,.7152,.0722)),top=max(base.r,max(base.g,base.b)),vis=mix(.25,1.,smoothstep(.01,.3,lum));
 if(u_r2.x>.5||tint>.5)vis=1.;
 // Respect the art: on the picture the sheet's colour stays a light veil (ink over foil filters it); on the frame and text box it is full.
 vis*=mix(1.,.45,art*(1.-step(.5,mode)*step(mode,1.5)));
 vec3 Fv=f_amb+(F-f_amb)*vis;
 vec3 lit=base*(1.+.1*(1.-base))*Fv+(1.-top)*f_leak*f_glare*2.*f_amb*.5;
 vec3 outC=mix(base,shoulder(lit),c);
#if FILM
 outC+=(1.-outC)*fadd*(1.-.6*top)*c;
#endif
 // Raised relief: glossy rims where the embossed height turns toward the light.
#if RELIEF
 if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.3+.7*near)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*vec3(1.,.97,.92)*rim*rel*cov*.6;}
#endif
 // Galaxy / surge sparks: a few large stars and many fine ones; the fine ones only at sizes that can show them.
#if SPARK
 if(u_r2.y>0.){for(int i=0;i<2;i++){float n=i==0?26.:70.,fade=i==0?1.:lod(70.);vec2 sq=vec2(uv.x,uv.y*u_aspect)*n,sc=floor(sq);vec2 j=hash2(sc+float(i)*9.);float on=step(1.-(i==0?.1:.2)*u_r2.y,j.x);
  float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sq)-.2-.6*hash2(sc*1.3)));
  float tw=pow(max(dot(normalize(vec3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=(1.-outC)*on*pt*fade*(.1+tw*1.6)*cov*(.4+.6*near)*vec3(1.,.97,.9);}}
#endif
 // Fluorescent ink glows under any light, on top of its foil.
 if(mode>2.5&&mode<3.5)outC+=base*mk.g*.4*(.6+.4*near);
#if STAMP==1
 if(u_r2.z>.5&&u_r2.z<1.5){float s=shootingStar(uv);outC=mix(outC,shoulder(F*vec3(.95,.97,1.)*1.1+vec3(.08)),s*.85);}
#endif
 // Marks pressed on top of the ink show over any ink.
 outC+=(1.-outC)*f_top;
 // Varnish: one clear coat over the whole face (not on metal-ink etched cards) returns a small white gloss.
 float coat=pow(max(dot(N,H),0.),60.)*.05*f_gloss;
 outC+=(1.-outC)*coat*mix(.35,1.,c);
 return clamp(outC,0.,1.);
}`;
// A very small preprocessor: #if / #elif / #else / #endif over whole lines. Conditions are NAME, NAME==n,
// NAME!=n, NAME>n, NAME<n, NAME>=n, NAME<=n joined by && and ||. The rules are this small so the native app can
// run the same ones in Kotlin, where shaders have no preprocessor. Whole-line comments are dropped from the result.
const holds=(expr,defs)=>expr.split('||').some(or=>or.split('&&').every(t=>{const m=t.trim().match(/^([A-Z_]+)\s*(?:(==|!=|>=|<=|>|<)\s*(-?\d+))?$/);if(!m)throw Error('foil shader: bad condition "'+t.trim()+'"');
 if(!(m[1] in defs))throw Error('foil shader: unknown name '+m[1]);
 const v=defs[m[1]],n=+m[3];return !m[2]?v!==0:m[2]==='=='?v===n:m[2]==='!='?v!==n:m[2]==='>'?v>n:m[2]==='<'?v<n:m[2]==='>='?v>=n:v<=n;}));
export function composeFoil(template,defs){
 const out=[],stack=[];let on=true;
 for(const line of template.split('\n')){const m=line.match(/^#(if|elif|else|endif)\b\s*(.*)$/);
  if(!m){if(/^\s*#/.test(line))throw Error('foil shader: stray directive "'+line.trim()+'"');if(on&&!/^\s*\/\//.test(line))out.push(line);continue;}
  const [,d,e]=m;
  if(d==='if'){const taken=on&&holds(e,defs);stack.push({outer:on,taken});on=taken;}
  else if(!stack.length)throw Error('foil shader: #'+d+' without #if');
  else if(d==='endif')on=stack.pop().outer;
  else{const s=stack.at(-1);if(s.taken||!s.outer)on=false;else{on=d==='else'||holds(e,defs);s.taken=on;}}}
 if(stack.length)throw Error('foil shader: #if without #endif');
 return out.join('\n');
}
// What a recipe compiles in. The shader still reads the recipe from u_r1 / u_r2 at run time; the defs only leave
// out the lines a recipe can never reach, so every composed shader draws what the whole template draws.
// A gilded card (COVER 6) also draws the gold sheet of pattern 18 for its stamped gold.
export const foilDefs=r=>({PAT:r.pat,COVER:r.cover,FILM:r.film>.5?1:0,SPARK:r.sparkle>0?1:0,STAMP:r.stamp===1?1:0,RELIEF:r.relief>0?1:0});
export const foilKey=d=>[d.PAT,d.COVER,d.FILM,d.SPARK,d.STAMP,d.RELIEF].join('.');
const HEAD=`precision highp float;
varying vec2 v;
uniform sampler2D u_card;   // card image, resampled to the display size
uniform sampler2D u_mask;   // R gold ink, G neon ink, B bare paper, A drawn lines
uniform sampler2D u_relief; // R height, G/B stroke direction, A stroke strength
`,MAIN=`
void main(){
 vec2 uv=vec2(v.x,1.-v.y);vec3 base=toLin(texture2D(u_card,v).rgb);vec4 mk=texture2D(u_mask,v),rl=texture2D(u_relief,v);
#if RELIEF||PAT==5
 vec2 e=u_texel*2.;float hx=texture2D(u_relief,v+vec2(e.x,0.)).r-texture2D(u_relief,v-vec2(e.x,0.)).r,hy=texture2D(u_relief,v-vec2(0.,e.y)).r-texture2D(u_relief,v+vec2(0.,e.y)).r;
#else
 float hx=0.,hy=0.;
#endif
 gl_FragColor=vec4(toSrgb(foilShade(base,uv,mk,rl,vec2(hx,hy))),1.);
}`;
export const MTG_FOIL_UNIFORMS=['u_card','u_mask','u_relief','u_tilt','u_px','u_texel','u_aspect','u_art','u_text','u_r1','u_r2'];
// The fragment shader for one recipe (a row of mtg-foil-recipes.js).
export const mtgFoilFragment=r=>composeFoil(HEAD+MTG_FOIL_TEMPLATE+MAIN,foilDefs(r));
