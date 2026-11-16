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
// The look is "Blended" (the Foil Test Bench, owner's yes on 16 Nov 2026: "ok good", then "love it ship it"): every sheet
// is soft and wide, the light is an upright band that crosses the card as it turns, and each foil type is corrected from
// real footage of the real card (old border: frame only; etched: stamped metal ink; the one real shooting star; silver
// scroll: a picture printed on silver with mirror plates; dragonscale: a net of silver lines; traditional: colour only on
// light ink inside the band of light). Per-card maps (mtg-foil-analysis.js: blendMaps, cardBoxes, findScanStar) place
// the foil on each card's own frame instead of one fixed rectangle per frame type.
// Composed for one card, the shader draws exactly what the bench drew (test-mtg-foil-real-browser.mjs compares it with
// test-fixtures/finish-effects/mtg-foil-blended-approved.glsl).
// Approximate simulation on reference images, not a physical-foil capture.
export const MTG_FOIL_TEMPLATE=`uniform vec3 u_star; // x,y of the shooting star on the card, z: 1 draw it, 2 the scan already has it
uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;
uniform vec4 u_art;uniform vec4 u_text;
uniform vec4 u_r1; // pattern, tint, coverage, relief (the shader is also composed for its pattern, see the #if lines)
uniform vec4 u_r2; // film, sparkle, stamp (1 shooting star), keep (share of the printed art left visible)
const float PI=3.14159265;
vec3 f_amb;float f_gloss;float f_leak;vec3 f_top;float f_glare;float f_ac;float f_zone;float f_x0;vec3 f_add;float f_et;float f_ink;
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
float softBox(vec2 p,vec4 b){vec2 e=vec2(.004,.003);vec2 lo=smoothstep(b.xy-e,b.xy+e,p),hi=1.-smoothstep(b.zw-e,b.zw+e,p);return lo.x*lo.y*hi.x*hi.y*step(1e-4,b.z-b.x);}
vec3 scales(vec2 q){q.x+=q.y*.5;vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),r=o+.5+(hash2(n+o)-.5)*.5-f;r.x-=r.y*.5;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return vec3(id,sqrt(d2)-sqrt(d1));}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
vec3 spectrum(float l){float a=(l-600.)/70.,b=(l-440.)/30.,c=(l-540.)/60.,d=(l-455.)/40.;return vec3(exp(-a*a)+.35*exp(-b*b),exp(-c*c),exp(-d*d))*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
vec3 grating(vec3 L,vec3 V,vec2 g,float d){float s=abs(dot(L.xy+V.xy,g));return spectrum(d*s)+spectrum(d*s/2.)/2.+spectrum(d*s/3.)/3.;}
vec3 voro(vec2 q){vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return vec3(id,sqrt(d2)-sqrt(d1));}
// Light the foil sheet sends back, relative to white paper (1.0). lq is where the light's glare sits on the
// card, near/wide how much key light reaches this spot (tight and broad), N the surface normal with relief.
vec3 foil(float pat,float tint,vec2 uv,vec2 lq,vec3 L,vec3 V,vec3 N,float near,float wide,vec2 grad,float height){
 vec3 H=normalize(L+V);vec2 q=vec2(uv.x,uv.y*u_aspect),r=q-lq;vec2 g=normalize(vec2(.6,.8));
 // k colour turns per card width, ph extra turn, w how much colour (set <0 to fade it out inside the glare)
 float k=1.3,ph=0.,w=-1.,lines=1.,glint=0.,mirror=.32,ex=7.,amp=1.4,sat=.88,off=.55,spec=-1.,streak=0.,widen=0.;
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
  float grain=pow(max(dot(n,H),0.),40.)*2.2,haze=0.;float bz=min(1.,exp(-f_ac*f_ac/.05)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.04)),core=exp(-f_ac*f_ac/.014)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.01);f_et=.56+.6*bz+.75*core+grain*mix(.5,1.,fine)*(.12+.9*bz);f_add=vec3(1.,.96,.88)*(core*.16+grain*fine*bz*.4);
  spec=mix(haze,grain*.75+haze*.45,fine);mirror=1.;amp=.18;sat=.3;streak=0.;widen=.5;f_amb=vec3(.95);f_gloss=0.;f_leak=.03;}
#endif
#if PAT==5
 else if(pat<5.5){float fine=lod(120.),hh=height*85.+vnoise(q*6.)*3.;vec2 gn=length(grad)>1e-4?normalize(grad):vec2(1.,0.);float sl=cos(hh),side=dot(gn,normalize(u_tilt+vec2(.3,-.4)))*sl;
  ph=height*2.4+side*.16*fine;N=normalize(N+vec3(gn*sl*.07*fine,0.));mirror=.5;ex=16.;amp=1.75;sat=.95;k=1.5;lines=mix(1.,.86+.22*smoothstep(-.6,.8,sin(hh)),fine);glint=fine*smoothstep(.55,1.,side)*.22;}
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
  k=.8;ph=rr*3.;w=1.;amp=1.35;sat=.85;lines=mix(.95,.72+.36*smoothstep(-.2,.9,sin(rr*52.-dot(u_tilt,c)*14.)),lod(40.));streak=0.;widen=.3;}
#endif
#if PAT==13
 else if(pat<13.5){vec2 p=q*vec2(9.,9.),c=floor(p),f=fract(p)-.5;float rr=length(f),fine=lod(60.); // mana: discs with a mana mark, pressed into the sheet
  float ring=1.-smoothstep(.02,.05,abs(rr-.32)),pip=0.;for(int i=0;i<5;i++){float ak=float(i)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.04,.07,length(f-.16*vec2(cos(ak),sin(ak)))));}
  float disc=1.-smoothstep(.3,.34,rr),sym=max(ring,pip)*fine;g=vec2(1.,0.);k=2.;ph=(hash(c+3.1)-.5)*.6*disc*fine;lines=1.+.22*disc*fine;
  glint=sym*(.25+pow(max(dot(N,H),0.),6.)*.7);streak=.15;widen=.25;}
#endif
#if PAT==14
 else if(pat<14.5){vec3 vc=scales(q*vec2(19.,20.));vec2 id=vc.xy;float fine=lod(42.),j=hash(id),net=(1.-smoothstep(.04,.15,vc.z))*fine,cell=(1.-net)*fine;
  float ly=(.45+u_tilt.y*.6)*u_aspect,dy=q.y-ly;
  float bz=min(1.,exp(-f_ac*f_ac/.035)+.45*exp(-(f_ac+.5)*(f_ac+.5)/.02))*(.12+.88*exp(-dy*dy/.22));
  float hot=smoothstep(.45+j*.35,.7+j*.35,bz),var=.6+.4*vnoise(q*8.+u_tilt*2.);
  ph=j*.2*fine;mirror=.6;ex=14.;amp=1.1;lines=1.-.3*cell*bz*(1.-hot);glint=net*bz*bz*.6;
  float b1=exp(-f_ac*f_ac/.0008),b2=exp(-(f_ac+.5)*(f_ac+.5)/.0006);
  f_top=vec3(.92,.96,1.)*(net*(.02+bz*bz*.8*var)+cell*hot*.45)+(hue(f_ac*11.+.05)*b1+hue((f_ac+.5)*13.+.3)*b2*.6)*.45;}
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
 else if(pat<18.5){mirror=1.;ex=12.;amp=.45;sat=.35;streak=.1;widen=.3;f_amb=vec3(.9);f_leak=.1;float zb=min(1.,exp(-f_ac*f_ac/.07)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.05));glint=.7*zb;f_add=(tint>.5&&tint<1.5?vec3(1.,.82,.46):vec3(.9,.93,.98))*zb*.2;} // silver / gold mirror sheet
#endif
#if PAT==19
 else if(pat<19.5){f_gloss=1.6;amp=1.;sat=.8;mirror=.5;}                                                             // ampersand: the big & is already in the card picture; it sits under a glossier coat
#endif
#if PAT==20
 else if(pat<20.5){g=vec2(.3,.95);k=1.9;lines=mix(.86,.72+.28*sin(q.y*PI*2.*80.),lod(160.));streak=0.;} // Vault Boy: CRT scanlines in the sheet
#endif
#if PAT==24
 else if(pat>23.5&&pat<24.5){vec2 p=q*4.6,c=floor(p),f=fract(p)-.5;vec2 j=hash2(c);float a=j.x*6.2832,ca=cos(a),sa=sin(a);f=vec2(ca*f.x-sa*f.y,sa*f.x+ca*f.y)*1.2;
  float d=min(min(seg(f,vec2(0.,-.08),vec2(0.,.24))-.042,seg(f,vec2(-.03,-.05),vec2(-.16,.16))-.038),min(seg(f,vec2(.03,-.05),vec2(.16,.16))-.038,seg(f,vec2(0.,-.1),vec2(0.,-.22))-.035));
  float sym=(1.-smoothstep(-.012,.012,d))*step(.42,j.y)*lod(24.);vec2 cc=(c+.5)/4.6;float am=dot(cc-vec2(f_x0,.5*u_aspect),normalize(vec2(1.,.22))),band=min(1.,exp(-am*am/.05)+.6*exp(-(am+.5)*(am+.5)/.035));
  f_top=sym*mix(vec3(.9,.95,1.),hue(am*1.8+j.x+.2),.4)*(.05+.6*band);}
#endif
#if PAT==25
 else if(pat>24.5&&pat<25.5){float fine=lod(140.);vec3 c=voro(q*70.);vec2 j=hash2(c.xy);vec3 fn=normalize(vec3((j-.5)*.9,1.));float zb=min(1.,exp(-f_ac*f_ac/.06)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.04));
  ph=j.y*.8*fine;amp=1.2+.9*zb;sat=.95;k=1.5;glint=fine*pow(max(dot(fn,H),0.),24.)*1.1*zb;}
#endif
#if PAT==26
 else if(pat>25.5&&pat<26.5){vec2 c=q-vec2(.5,.36*u_aspect);float rr=length(c),a=atan(c.y,c.x),zb=min(1.,exp(-f_ac*f_ac/.05)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.035));
  k=.8;ph=a/PI*.5+rr*1.6;w=1.;amp=1.3;sat=.9;f_leak=0.;glint=.9*zb;mirror=.5;f_add=vec3(.92,.94,1.)*zb*.34;}
#endif
#if PAT==27
 else if(pat>26.5&&pat<27.5){vec3 c=voro(q*52.);vec2 j=hash2(c.xy);float fine=lod(104.),on=step(.6,j.x)*smoothstep(0.,.08,c.z)*fine;
  ph=on*j.y;amp=mix(1.,1.8,on);sat=mix(.85,.95,on);glint=on*pow(max(dot(normalize(vec3((j-.5)*1.1,1.)),H),0.),44.)*.9;}
#endif
#if PAT==28
 else if(pat>27.5&&pat<28.5){amp=1.75;sat=.95;k=1.5;}
#endif
#if PAT==29
 else if(pat>28.5){vec3 vc=voro(mat2(1.,.5,-.35,1.)*q*vec2(26.,13.));vec2 id=vc.xy,j=hash2(id);vec3 fn=normalize(vec3((j-.5)*1.4,1.));float fine=lod(26.),dark=step(hash(id+6.6),.18)*fine;
  ph=mix(.4,j.x<.82?.34+.16*j.y:j.y,fine);k=.3;w=1.;amp=2.2*(1.-dark)*mix(1.,.5+.9*hash(id+1.2),fine);sat=1.;off=.4;mirror=.9;spec=mix(pow(max(dot(N,H),0.),8.)*.5,pow(max(dot(fn,H),0.),12.)*1.4,fine)*(1.-dark);f_amb=vec3(mix(.4,.05,dark));f_gloss=1.;}
#endif
#if PAT==23
 else if(pat>22.5){float fine=lod(120.),fib=sin(q.y*746.+sin(q.x*12.)*1.5),band=exp(-pow((q.x-f_x0)/.2,2.))+.5*exp(-pow((q.x-f_x0+.55)/.16,2.));
  mirror=.6;ex=5.;amp=.3;sat=.16;f_leak=.1;glint=band*(.95+.12*fib*fine);lines=1.+.04*fib*fine;f_add=vec3(.95,.92,.86)*band*.2;}
#endif
#if PAT==21
 else if(pat<21.5){amp=1.;mirror=.3;}
#endif
#if PAT==22
 else{vec2 p=q*vec2(4.,5.3);p.x+=mod(floor(p.y),2.)*.5;vec2 c=floor(p),m=(fract(p)-.5)/vec2(4.,5.3);              // step-and-compleat: rows of the Phyrexian mark on top of the ink
  float ring=abs(length(m)-.024)-.0055,bar=max(abs(m.x)-.005,abs(m.y)-.043);float sym=(1.-smoothstep(0.,.004,min(ring,bar)))*lod(45.);
  vec2 mcc=(c+.5-vec2(mod(c.y,2.)*.5,0.))/vec2(4.,5.3);float am=dot(mcc-vec2(f_x0,.5*u_aspect),normalize(vec2(1.,.22)));vec2 mc=vec2(am*.9,mcc.y*.35);float band=min(1.,exp(-am*am/.09)+.6*exp(-(am+.5)*(am+.5)/.06));
  f_top=sym*hue(mc.y*2.4+mc.x*.5+.3)*band*1.25;}
#endif
 float along=dot(r,g);
 // Fine dashes in the sheet, laid along the colour bands.
#if PAT==3
 float fs=lod(45.)*streak,n=vnoise(vec2(dot(q,g)*45.,dot(q,vec2(-g.y,g.x))*6.));
 if(w<0.)w=smoothstep(.05,.22,abs(along));
#else
 float fs=0.,n=.5;if(w<0.)w=smoothstep(0.,.3,abs(along));
#endif
 float t=abs(along)*k+ph+(n-.5)*fs+dot(N.xy,g)*2.;
 vec3 rb=mix(vec3(1.),hue(t),sat);
 if(pat>9.5&&pat<10.5)rb=.5*(rb+mix(vec3(1.),hue(abs(dot(r,normalize(vec2(-.5,.86))))*4.5),sat))*1.1;
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
 vec3 metal=tint<.5?vec3(1.):tint<1.5?vec3(1.,.78,.4):vec3(.9,.93,.98);
#if PAT==23
 metal=vec3(.95,.92,.86);
#endif
#if FILM
 vec3 col=w*amp*mix(.7,1.,strength())*(rb-off)*(1.+1.2*(n-.5)*fs);
 if(tint>.5)col=metal*w*amp*(.25+.3*dot(rb,vec3(.333)))+col*.3*step(1.5,tint);
 float env=mix(wide,1.,near*.6);
 f_amb=max(f_amb,vec3(1.));f_amb*=metal;f_glare=near*mirror*spec*.6;
 return f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines;
#elif PAT==4
 // Etched: no sheet at all. The metal ink only gets brighter or darker (f_et), in its own printed colour.
 f_amb=vec3(1.);f_glare=0.;return vec3(f_et);
#elif PAT==29
 // Emblem chips: dark metal that each chip lights in its own colour.
 float env=mix(wide,1.,near*.6);vec3 o=f_amb*.45+env*rb*rb*amp*.8+spec*.7;f_amb=vec3(1.);f_glare=0.;return o;
#elif PAT!=3
 // The soft sheet: wide slow colour over the whole sheet, a little stronger where the light is.
 vec3 col=w*amp*mix(.7,1.,strength())*(rb-off);
 if(tint>.5)col=metal*w*amp*(.25+.3*dot(rb,vec3(.333)))+col*.3*step(1.5,tint);
 float env=mix(wide,1.,near*.6);
#if PAT==1||PAT==2||PAT==10||PAT==15
 col*=mix(.3,1.,f_zone);  // out of the light a real foil is nearly a plain card
#endif
 f_amb=max(f_amb,vec3(1.));f_amb*=metal;f_glare=near*mirror*spec*.6;
 return f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines;
#else
 // From the Vault keeps the light-line model: relief and pressed patterns bend the light line, so each scale or groove catches it on its own.
 float a1=f_ac+dot(N.xy,vec2(1.,.22))*.35+(lines-1.)*.02,a2=a1+.5;
 float s1=exp(-a1*a1/.012),s2=exp(-a2*a2/.009);
 // The spectrum runs across each line; the sheet's pattern (ph) shifts it, which is how the pattern shows.
 vec3 h1=mix(vec3(1.),hue(a1*4.2+ph+(n-.5)*fs),sat),h2=mix(vec3(1.),hue(a2*4.8+.4+ph),sat);
 vec3 sp=(h1-.45)*s1+(h2-.45)*s2*.5;
 vec3 col=w*amp*.2*(rb-off);
 float sheen=.2*mix(.6,1.,mirror);
 f_add=(h1*s1+h2*s2*.5)*amp*.3*lines;
 if(tint>.5){sp=metal*(s1+.5*s2)*(.6+.3*dot(rb,vec3(.333)));col=metal*w*amp*.1+col*.3*step(1.5,tint);sheen=.55;f_add=metal*(s1+.5*s2)*.4*lines;}
 f_amb=max(f_amb,vec3(1.))*metal;f_glare=near*mirror*spec*.6;
 return f_amb*mix(.9,1.,f_zone)+f_zone*(col*lines+glint*metal+metal*sheen*lines)+sp*amp*lines+f_glare*metal*lines;
#endif
}
#if STAMP==1
float shootingStar(vec2 uv,float fat){vec2 d=(uv-u_star.xy)*vec2(1.,u_aspect);
 float core=max(0.,1.-length(d)*(34./fat));
 float th=260./fat,rays=max(0.,1.-abs(d.x)*th)*max(0.,1.-abs(d.y)*(11./fat))+max(0.,1.-abs(d.y)*th)*max(0.,1.-abs(d.x)*(14./fat));
 vec2 e=vec2(d.x+d.y,d.x-d.y)*.7071;rays+=.8*(max(0.,1.-abs(e.x)*th)*max(0.,1.-abs(e.y)*(26./fat))+max(0.,1.-abs(e.y)*th)*max(0.,1.-abs(e.x)*(26./fat)));
 float u=clamp(d.x/.29,0.,1.),yc=-.052*sin(u*PI*.5),wd=mix(.011,.0015,u)*fat;
 float tail=step(0.,d.x)*step(d.x,.29)*smoothstep(wd,wd*.3,abs(d.y-yc))*pow(1.-u,.35);
 return clamp(core*1.8+rays+tail,0.,1.);}
#endif
// base: linear colour of the ink at this spot; uv: where on the card face (0,0 top left). Returns linear colour.
vec3 foilShade(vec3 base,vec2 uv,vec4 mk,vec4 rl,vec2 grad){
 float art=softBox(uv,u_art),text=softBox(uv,u_text);
#if PAT==23||PAT==28
 art=mk.g;text=mk.b;
#endif
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
  wide=.62+.38*exp(-dot(dl,dl)/2.5);
  f_x0=.7+u_tilt.x*.62-u_tilt.y*.15;f_add=vec3(0.);f_ink=0.;
  f_ac=dot(P.xy-vec2(f_x0,.5*u_aspect),normalize(vec2(1.,.22)));float b2=f_ac+.5;
  f_zone=min(1.,exp(-f_ac*f_ac/.05)+.5*exp(-b2*b2/.035));
#if PAT==3
  near=strength()*min(1.,exp(-f_ac*f_ac/.012)+.5*exp(-b2*b2/.009));wide=.25+.75*f_zone;
#endif
 }
 float rel=u_r1.w*(1.-.7*text);vec3 N=normalize(vec3(-grad*rel*9.,1.));
 float pat=u_r1.x,tint=u_r1.y,mode=u_r1.z;
 // Where the foil shows: whole card; frame only (etched art is printed on white); or one ink.
 float cov=1.;
 if(mode>6.5)cov=(1.-art)*(1.-text);else if(mode>.5&&mode<1.5)cov=1.-art;else if(mode>1.5&&mode<2.5)cov=mk.r;else if(mode>3.5&&mode<4.5)cov=mk.b;else if(mode>4.5&&mode<5.5)cov=mk.a;
#if PAT==4
 // Mystical Archive etched (Tainted Pact, the owner's video): the gold ornaments and the name, type and rules panels are all
 // gold metal ink. A scan shows the panels as cream; any warm cream or gold ink outside the picture counts, letters stay print.
 if(mode>1.5&&mode<2.5){vec3 sc=toSrgb(base);float mx=max(sc.r,max(sc.g,sc.b)),warm=smoothstep(.06,.16,sc.r-sc.b)*step(sc.b,sc.g)*smoothstep(.5,.65,mx)*(1.-smoothstep(.2,.32,sc.r-sc.g));cov=max(smoothstep(.5,.75,mk.r),warm)*(1.-art);}
#else
 if(mode>1.5&&(mode<2.5||(mode>3.5&&mode<5.5)))cov*=1.-text;
#endif
#if PAT==5
 cov*=1.-.7*text;
#endif
#if PAT==21
 cov*=1.-text;
#endif
#if PAT==29
 cov=mk.r;base=mix(base,vec3(.34),.9*cov);
#endif
 vec3 F=foil(pat,tint,uv,lq,L,V,N,near,wide,grad,rl.r);
#if PAT==29
 f_ink=1.;
#endif
#if PAT==23
 {float bl=dot(base,vec3(.2126,.7152,.0722)),s0=smoothstep(.25,.6,mk.r),s=s0,x=f_ac+(bl-.3)*.25;
  s*=1.-smoothstep(.05,.14,dot(toSrgb(base),vec3(.2126,.7152,.0722))-rl.r);  // letters and small print lighter than the metal around them are white ink
  float hot=exp(-x*x/.016)+.6*exp(-(x+.5)*(x+.5)/.012);
  float ch=.3+1.9*hot+.3*smoothstep(-.3,.3,sin(x*10.+1.));
  // The picture itself is printed on silver (the owner's video of Culling the Weak): where the scan is speckled grey the
  // card is bare silver and reads bright white; where the scan is tinted, coloured ink lies over the silver and reads as a
  // deep, rich colour out of the light and a pale washed one in it. Black ink stays black. No rainbow anywhere.
  vec3 sg=toSrgb(base);float chroma=max(sg.r,max(sg.g,sg.b))-min(sg.r,min(sg.g,sg.b)),neu=smoothstep(.46,.58,rl.r)*(1.-smoothstep(.07,.12,chroma)),a=mk.g*(1.-s);
  float zb=min(1.,exp(-f_ac*f_ac/.05)+.5*exp(-(f_ac+.5)*(f_ac+.5)/.035)),body=smoothstep(.04,.3,bl);
  float gl=step(.985,hash(floor(uv*vec2(220.,306.))+floor(f_ac*14.)))*zb;
  vec3 tint=max(vec3(0.),vec3(bl)+(base-bl)*mix(4.5,2.,zb))*mix(vec3(.5,.36,.58),vec3(1.5),zb)+vec3(.8,.78,.92)*zb*.12*body;
  vec3 bare=mix(base*mix(1.,mix(2.1,2.8,zb),body),vec3(.8,.82,.86)*mix(.9,1.2,zb),.9*smoothstep(.1,.26,bl))+vec3(.9,.92,1.)*gl*.5*body;
  vec3 want=mix(tint,bare,neu);
  F=mix(F,want/max(base,vec3(.02)),a);f_amb=mix(f_amb,vec3(1.),a);f_leak=mix(f_leak,0.,a);
  float zs=min(1.,exp(-x*x/.11)+.6*exp(-(x+.5)*(x+.5)/.08));ch=.07+1.55*zs+.5*hot;
  F=mix(F,vec3(ch),s);f_amb=mix(f_amb,vec3(1.),s);f_gloss=mix(f_gloss,2.,s);f_leak=mix(f_leak,.05,s);f_ink=max(s0,a);
  // Letters and small print on the metal are white ink: they stay white while the metal around them goes dark or bright.
  F=mix(F,vec3(.9)/max(base,vec3(.02)),s0-s);
  f_add=mix(f_add,vec3(.96,.97,1.)*hot*.55,s);}
#endif
#if PAT==24
 f_top*=1.-.75*text;
#endif
 // Gold stamped on top of a foil card (gilded): the stamp is its own raised gold metal, the rest stays foil.
#if COVER==6
 if(mode>5.5){float s=smoothstep(.25,.6,mk.r)*(1.-text);
#if PAT==28
  s=(1.-art)*mix(.85,1.,smoothstep(.25,.6,mk.r));
#elif PAT==25
  s*=1.-art;
#endif
  float gb=min(1.,exp(-f_ac*f_ac/.05)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.04)),gc=exp(-f_ac*f_ac/.014)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.01);
  vec3 G=vec3(.5+.75*gb+.8*gc)*mix(vec3(1.),hue(f_ac*1.4+uv.y*.6+.15)*1.2,.25*gb);
  F=mix(F,G,s);f_amb=mix(f_amb,vec3(1.),s);f_gloss=mix(f_gloss,1.6,s);f_leak=mix(f_leak,.1,s);f_top*=1.-s;f_add=vec3(1.,.93,.75)*gc*.2*s;
#if PAT==28
  f_add=vec3(1.,.84,.48)*(gb*.3+gc*.25)*s;
#endif
 }
#endif
 // Thin film replaces the sheet's colour (oil slick): colour depends on view angle and film thickness.
vec3 fadd=vec3(0.);
#if FILM
 if(u_r2.x>.5){float x=f_ac,x2=x+.5,b=min(1.,exp(-x*x/.016)+.5*exp(-x2*x2/.012));
  float blot=vnoise(uv*vec2(3.,4.2)+u_tilt*.5);
  vec3 sp=hue(x*1.7+uv.y*.3+blot*.55+rl.r*.2+.02);
  float hl=pow(max(dot(N,H),0.),16.);
  F=mix(vec3(.4,.46,.56),mix(vec3(1.),sp,.85)*2.1,b)*(1.+.6*hl);f_amb=vec3(1.);f_ink=1.;
  vec2 dq=P.xy-lq;float wash=exp(-dot(dq,dq)/.14);
  fadd=sp*b*.055+vec3(.6,.64,.7)*wash*.26;}
#endif
 // Ink over metal: light ink lets the lit foil through, dark ink hides it; the darkest ink still passes a
 // faint glint of the highlight.
 float keep=u_r2.w,c=clamp(cov*(1.-keep),0.,1.);
 float lum=dot(base,vec3(.2126,.7152,.0722)),top=max(base.r,max(base.g,base.b)),vis=mix(.25,1.,smoothstep(.01,.3,lum));
 if(u_r2.x>.5||tint>.5)vis=1.;
 // Respect the art: on the picture the sheet's colour stays a light veil (ink over foil filters it); on the frame and text box it is full.
#if PAT==26||PAT==28
 vis*=mix(1.,.9,art);
#elif PAT==12
 vis*=mix(1.,.7,art);
#elif PAT==1
 vis*=mix(1.,.75,art);
#elif FILM||PAT!=3
 vis*=mix(1.,.45,art*(1.-step(.5,mode)*step(mode,1.5)));
#else
 vis*=mix(1.,.55,art*(1.-step(.5,mode)*step(mode,1.5)));
#endif
#if FILM||PAT!=3
 vec3 Fv=f_amb+(F-f_amb)*vis;
#else
 vec3 Fv=(f_amb+(F-f_amb)*vis)*mix(1.,mix(.84,1.,f_zone),smoothstep(.3,.85,lum)*cov*(1.-.6*art));
#endif
 Fv=mix(Fv,F,f_ink);
#if FILM
 vec3 inkc=mix(vec3(lum),base,.35);
#else
 vec3 inkc=base;
#endif
#if PAT==4
 if(mode>1.5&&mode<2.5)inkc=mix(base,base*vec3(1.08,.9,.56),.6);
#endif
 vec3 lit=inkc*(1.+.1*(1.-inkc))*Fv+(1.-top)*f_leak*f_glare*2.*f_amb*.5;
 vec3 outC=mix(base,shoulder(lit),c);
#if PAT==4||COVER==6||PAT==18||PAT==23||PAT==26||PAT==29
 outC+=(1.-outC)*f_add*c*smoothstep(.02,.2,lum);
#endif
#if PAT==1||PAT==2||PAT==10||PAT==15
 // How a real foil meets the picture (the owner's video of four Edge of Eternities foils): inside the band of light the
 // colour is vivid, and it sits on the light ink only, so the bright shapes of the art light up in rainbow while dark ink
 // stays dark. The colour changes along the band. Straight at the light the whole card washes to pale silver.
 {float band=min(1.,exp(-f_ac*f_ac/.02)+.5*exp(-(f_ac+.5)*(f_ac+.5)/.014)),hi=pow(smoothstep(.05,.7,lum),1.3);
  vec3 rbw=hue(f_ac*2.6+uv.y*.9+rl.r*.25+.1);rbw=clamp(mix(vec3(dot(rbw,vec3(.333))),rbw,1.4),0.,1.5);
  vec3 tgt=outC*mix(vec3(1.),rbw*1.55,.8)+rbw*.22*(1.-outC);
  outC=mix(outC,tgt,band*hi*c*strength());
  vec2 dq=P.xy-lq;float g=exp(-dot(dq,dq)/.1)*c;
  outC=mix(outC,vec3(dot(outC,vec3(.2126,.7152,.0722)))*.55+vec3(.42,.44,.47),g*.6);}
#endif
#if FILM||PAT!=3
#else
 outC+=(1.-outC)*f_add*vis*c*(.35+.65*smoothstep(.02,.35,lum))*(1.-.85*art);
#endif
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
  float tw=pow(max(dot(normalize(vec3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=(1.-outC)*on*pt*fade*(.1+tw*1.6)*cov*(.5+.6*f_zone)*vec3(1.,.97,.9);}}
#if PAT==7
 {vec2 sq=vec2(uv.x,uv.y*u_aspect)*11.,sc=floor(sq);vec2 j=hash2(sc+3.3),o=.25+.5*hash2(sc*1.7+.4);float on=step(.5,j.x)*u_r2.y,rad=.05+.13*j.y*j.y;
  float pt=1.-smoothstep(rad*.7,rad,length(fract(sq)-o)),tw=pow(max(dot(normalize(vec3((hash2(sc+5.)-.5)*.7,1.)),H),0.),14.);
  outC+=(1.-outC)*on*pt*(.07+tw*1.1)*cov*mix(vec3(1.),hue(j.y*3.+j.x),.7);}
#endif
#endif
 // Fluorescent ink glows under any light, on top of its foil.
 if(mode>2.5&&mode<3.5)outC+=base*mk.g*.4*(.6+.4*near);
#if STAMP==1
 if(u_r2.z>.5&&u_r2.z<1.5){vec3 holo=mix(vec3(1.),hue(f_ac*1.6+uv.x*1.8+uv.y*.9+.1),.5);
  if(u_star.z>1.5){float wht=smoothstep(.62,.9,min(base.r,min(base.g,base.b)))*clamp(shootingStar(uv,3.2)*3.,0.,1.);outC=mix(outC,base*holo*1.06,wht*.9);}
  else if(u_star.z>.5){float s=shootingStar(uv,1.);outC=mix(outC,holo*.98+.02,s*.95);}}
#endif
 // Marks pressed on top of the ink show over any ink.
#if PAT==21
 {float shard=mk.g;
  if(shard>.004){float sd=texture2D(u_mask,(floor(vec2(uv.x,1.-uv.y)/u_texel)+.5)*u_texel).r;vec2 j=vec2(sd,fract(sd*7.31+.17));vec3 fn=normalize(vec3((j-.5)*1.1,1.));float nh=max(dot(fn,H),0.);
   float flash=pow(nh,22.),sheen=pow(nh,8.);vec3 fc2=grating(L,V,normalize(vec2(cos(j.x*PI),sin(j.x*PI))),1100.+j.y*900.);
   vec3 face=base*(.68+.5*sheen+1.6*flash*(.4+.6*near))+fc2*sheen*(.6+.9*near)*(.25+.75*smoothstep(.03,.3,lum))+vec3(.86,.93,1.)*flash*.12*near*smoothstep(.05,.4,lum);
   outC=mix(outC,clamp(shoulder(face),base*mix(.68,.93,smoothstep(.18,.4,lum)),max(base,vec3(.96))),smoothstep(0.,.35,shard));}
  float edge=mk.b;
  if(edge>.004){vec2 sd=rl.gb*2.-1.;float th=.5*atan(sd.y,sd.x);vec3 ge=grating(L,V,vec2(cos(th),sin(th)),1300.)*1.2*(.45+.8*near);outC=mix(outC,shoulder(outC+ge),edge);}}
#endif
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
export const MTG_FOIL_UNIFORMS=['u_card','u_mask','u_relief','u_tilt','u_px','u_texel','u_aspect','u_art','u_text','u_r1','u_r2','u_star'];
// The fragment shader for one recipe (a row of mtg-foil-recipes.js).
export const mtgFoilFragment=r=>composeFoil(HEAD+MTG_FOIL_TEMPLATE+MAIN,foilDefs(r));
