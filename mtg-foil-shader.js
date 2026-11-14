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
// Approximate simulation on reference images, not a physical-foil capture.
export const MTG_FOIL_TEMPLATE=`uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;
uniform vec4 u_art;uniform vec4 u_text;
uniform vec4 u_r1; // .w relief height (the foil type itself is compiled in, see the #if lines)
uniform vec4 u_r2; // .y sparkle amount, .w keep (share of the printed art left visible)
const float PI=3.14159265;
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
vec3 voro(vec2 q,out float dn){vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 dn=sqrt(d1);return vec3(id,sqrt(d2)-dn);}
#if STAMP==1
float shootingStar(vec2 uv){vec2 c=vec2(u_text.x+.035,u_text.w-.03),d=(uv-c)*vec2(1.,u_aspect);
 float star=max(0.,1.-(abs(d.x)+abs(d.y))*95.)+max(0.,1.-length(d)*140.);
 vec2 t=d;float arc=.004*sin(clamp(t.x*40.,0.,PI));float tail=step(0.,t.x)*step(t.x,.05)*(1.-smoothstep(0.,.0022,abs(t.y+arc)))*(1.-t.x*20.);
 return clamp(star*2.+tail,0.,1.);}
#endif
// base: linear colour of the ink at this spot; uv: where on the card face (0,0 top left). Returns linear colour.
vec3 foilShade(vec3 base,vec2 uv,vec4 mk,vec4 rl,vec2 grad,vec4 em){
 float art=inBox(uv,u_art),text=inBox(uv,u_text);
 vec2 lp=vec2(.5,.45)+u_tilt*.6;vec3 P=vec3(uv.x,uv.y*u_aspect,0.);vec2 lq=vec2(lp.x,lp.y*u_aspect);
 vec3 L=normalize(vec3(lq,.85)-P),V=normalize(vec3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 // How much key light reaches this spot: a tight share for the glare, a broad one for hazy sheets.
 vec2 dl=P.xy-lq;float near=exp(-dot(dl,dl)/.3),wide=.3+.7*exp(-dot(dl,dl)/1.1);
 float goldInk=smoothstep(.12,.45,mk.r)*(1.-text);
#if COVER==6
 float rel=u_r1.w*(1.-.7*text)*goldInk;
#else
 float rel=u_r1.w*(1.-.7*text);
#endif
 vec3 N0=normalize(vec3(-grad*rel*9.,1.));
 // Where the foil shows: whole card; frame only (etched art is printed on white); or one ink.
 float cov=1.;
#if COVER==1
 cov=1.-art;
#elif COVER==2
 cov=mk.r*(1.-text);
#elif COVER==4
 cov=mk.b*(1.-text);
#elif COVER==5
 cov=mk.a*(1.-text);
#endif
#if EMB
 float g_emb=em.r,g_emb2=em.g,emb=smoothstep(.12,.45,g_emb)*(1.-text*smoothstep(.35,.7,dot(base,vec3(.333))));
#endif
#if EMB==1
 cov=emb*g_emb2;
#endif
#if PAT==18
 float g_gold=smoothstep(.1,.4,mk.r);
#else
 float g_gold=1.;
#endif
 float g_lum=dot(base,vec3(.2126,.7152,.0722));
 // ---- 1 the foil sheet. Light it sends back, relative to white paper (1.0).
 vec3 N=N0;float height=rl.r;vec2 q=vec2(uv.x,uv.y*u_aspect),r=q-lq;vec2 g=normalize(vec2(.9,.44));
 // k colour turns per card width, ph extra turn, w how much colour (set <0 to fade it out inside the glare)
 float k=1.7,ph=0.,w=-1.,lines=1.,glint=0.,mirror=.5,ex=10.,amp=1.5,sat=.85,off=.55,spec=-1.,streak=.35,widen=0.;
 vec3 f_amb=vec3(.93),f_top=vec3(0.),f_add=vec3(0.);float f_gloss=1.,f_leak=.05,f_glare=0.,f_topink=0.,f_str=1.,f_topdark=0.,v_d1=0.;float tbox=inBox(uv,u_text),ed=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)*u_aspect),tline=step(u_text.x,uv.x)*step(uv.x,u_text.z)*step(u_text.y-.06,uv.y)*step(uv.y,u_text.y);
#if PAT==2
 {g=normalize(vec2(.6,.8));k=1.25;mirror=.3;ex=6.;amp=1.35;sat=.9;streak=0.;widen=.45;f_amb=vec3(.86);f_leak=.08;} // old border: hazy, strong, a darker card
#elif PAT==3
 {float bx=q.x-lq.x,u=abs(bx)/.04,bar=1.-smoothstep(.75,1.2,u),u2=abs(bx-.4)/.02,bar2=.1*exp(-u2*u2*.5),fz=(u-1.65)/.32,fr=exp(-fz*fz);   // From the Vault: thick gloss and one narrow upright mirror streak with hard edges, yellow-gold at the core, orange at its flanks, a thin colour fringe outside. It is a reflection in the sheet, so ink colours it and black hides it; it is brightest over the art and weak on the rules text
  vec3 gold=mix(vec3(1.,.78,.05),vec3(1.,.34,0.),smoothstep(.3,1.05,u));float where=(1.-.6*tbox)*(.7+.3*near);
  f_add=(bar*(gold*3.4-1.05)+bar2*(vec3(1.,.8,.4)*1.6-.6)+fr*.9*(hue(.5+.2*sign(bx))-.4))*where;
  f_top=bar*gold*.6*where*smoothstep(.015,.1,g_lum);f_topdark=1.;
  g=vec2(1.,0.);k=2.4;mirror=.22;ex=34.;amp=.1;sat=.6;off=.3;streak=0.;widen=.1;f_amb=vec3(.97);f_gloss=3.6;f_leak=.01;}
#elif PAT==4
 {float fine=smoothstep(1.2,2.6,u_px.x/150.);vec3 c=voro(q*150.,v_d1);vec2 j=hash2(c.xy);vec3 n=normalize(vec3((j-.5)*1.6,1.)); // etched: metal ink, no laminate. Dull away from the light; under it the frame is brighter metal in its own colour and nearly half its grains flash one by one. The rules box only gets a little of it
  float lit=step(.55,hash(c.xy+3.7)),grain=lit*(1.-smoothstep(.2,.45,v_d1))*pow(max(dot(n,H),0.),24.)*3.4,calm=1.-.72*tbox;
  glint=grain*fine*1.5*calm;spec=pow(max(dot(N,H),0.),5.)*.5*calm;mirror=1.;w=1.;amp=1.7*calm;sat=.08;off=.1;streak=0.;widen=.3;f_amb=vec3(.62);f_gloss=0.;f_leak=0.;
  f_add=vec3(1.,.99,.96)*1.5*pow(near,1.5)*calm*(.75+.25*mix(1.,hash(c.xy+9.1)*2.,fine));}
#elif PAT==5
 {float gr=sin(height*55.);vec2 gn=length(grad)>1e-4?normalize(grad):vec2(1.,0.);  // textured: grooves along the art's contours
  ph=height*3.;N=normalize(N+vec3(gn*cos(height*55.)*.05,0.));mirror=.5;ex=22.;amp=1.3;lines=.82+.18*gr;streak=0.;}
#elif PAT==6
 {vec2 d=normalize(vec2(.72,-.7)),pp=vec2(-d.y,d.x);float s=dot(q,d),p=dot(q,pp)+.006*sin(s*9.+q.x*5.); // surge: ragged brush streaks of bright silver on grey metal, rising to the right, pale colour inside the lit ones; which streaks are lit changes with the light
  float n1=vnoise(vec2(p*30.,s*1.6)),n2=vnoise(vec2(p*85.+9.,s*4.5)),n3=vnoise(vec2(p*10.+3.,s*.8)),raw=mix(n1,n1*.45+n2*.55,lod(85.));
  float n4=vnoise(vec2(p*170.+4.,s*14.)),st=smoothstep(.4,.6,raw+(n3-.5)*.3+(n4-.5)*.22*lod(170.)),sel=smoothstep(.3,.7,.5+.5*cos(6.2832*(n3*2.3+dot(lq,pp)*.72+lq.x*.3)));
  g=pp;k=.9;ph=.2+n3*1.3+s*.3;w=1.;lines=st*(.06+1.3*sel);amp=1.45;sat=.62;off=.2;streak=0.;widen=.75;mirror=.5;f_amb=vec3(.6);f_leak=.0;}
#elif PAT==7
 {float fine=lod(30.),tw,pk;vec2 p=q*5.,c=floor(p),o=fract(p)-(.3+.4*hash2(c+7.7));                 // galaxy: planets of mixed size and colour and small pastel stars over a dense, clumped field of specks (the specks are the sparkle setting)
  float rad=.07+.2*pow(hash(c+4.1),3.),d=length(o),disc=(1.-smoothstep(rad-.025,rad,d))*step(.45,hash(c+2.3));pk=hash(c+9.1);
  vec3 dc=hue(pk<.22?.33:pk<.4?.5:pk<.55?.6:pk<.75?.83:pk<.88?.1:.72);dc=mix(dc,vec3(1.),clamp(.1+.35*smoothstep(-rad,rad,-(o.x+o.y)*.7)+.25*sin(o.y/rad*9.),0.,1.));
  float sat1=1.-smoothstep(.02,.03,abs(length(o-vec2(rad*1.25,-rad*.6))-.0))*1.;                    // a small moon beside some planets
  tw=pow(max(dot(normalize(vec3((hash2(c+5.)-.5)*.9,1.)),H),0.),5.);vec3 top=(disc*dc+(1.-disc)*sat1*step(.6,hash(c+3.9))*step(.45,hash(c+2.3))*vec3(.9,.95,1.))*(.4+.75*tw);
  p=q*6.+3.3;c=floor(p);o=fract(p)-(.3+.4*hash2(c+1.7));pk=hash(c+6.1);
  float star=step(.66,hash(c+11.3))*clamp(1.-(abs(o.x)+abs(o.y))/.085,0.,1.);tw=pow(max(dot(normalize(vec3((hash2(c+5.)-.5)*.9,1.)),H),0.),5.);
  top+=star*mix(vec3(1.),hue(pk<.33?.17:pk<.66?.25:.5),.4)*(.45+.9*tw)*(1.-disc);
  f_top=fine*mix(near,wide,.75)*top*(1.-.9*step(u_text.w+.012,uv.y));f_topink=.72;amp=.5;widen=.2;}
#elif PAT==8
 {vec2 c=q-vec2(.5,.5*u_aspect);float rr=length(c),a=atan(c.y,c.x);              // halo: a swirled sheet. One large blue-white streak crosses the card with the light, a small pink-violet one beside it
  float sw=vnoise(q*2.2+3.)+.5*vnoise(q*5.+1.),band=.5+.5*sin(a*2.+rr*9.+sw*3.+3.88);
  vec2 sd=normalize(vec2(.62,.78));float sx=dot(r,sd)+.05*(sw-.75),s3=(sx+.27)/.035,s1=exp(-sx*sx/(.065*.065))+.3*exp(-sx*sx/(.2*.2)),s2=exp(-s3*s3);
  f_add=(s1*vec3(.6,.82,1.)*2.6+s2*vec3(1.,.5,.95)*1.5)*(.6+.4*band)*(.45+.55*wide);
  k=.25;ph=.27+.08*sw;w=1.;lines=.4+.95*smoothstep(.2,.9,band);amp=1.9;sat=.42;off=.58;streak=0.;widen=.3;mirror=.3;f_amb=vec3(.78);f_leak=0.;}
#elif PAT==9
 {vec3 vc=voro(q*136.,v_d1);vec2 c=vc.xy,j=hash2(c);float fine=lod(112.);       // confetti: tiny glitter dots packed over dark ink, every dot its own pure colour; they stop where the dark ink stops and stay off the border, name, type line and rules text. Each dot flashes on its own
  float dt=1.-smoothstep(.24+.16*j.x,.36+.16*j.x,v_d1);
  float tw=pow(max(dot(normalize(vec3((hash2(c+5.)-.5)*1.7,1.)),H),0.),6.),zone=q.y*.62+dot(r,g)*.9+.1;
  float hz=zone*.3+hash(c+1.9),dk=smoothstep(.004,.03,g_lum)*(1.-smoothstep(.09,.22,g_lum)),quiet=smoothstep(.03,.05,ed)*(1.-.92*step(u_text.y-.06,uv.y))*(1.-.9*step(uv.y,.1))*dk;
  f_top=mix(near,wide,.85)*quiet*(fine*dt*mix(vec3(1.),hue(hz),.97-.25*tw)*(.3+1.5*tw)+(1.-fine)*.28*mix(vec3(1.),hue(hz),.85)*(.4+1.2*tw));f_topink=0.;
  amp=.12;sat=.6;streak=0.;widen=.1;f_leak=0.;}
#elif PAT==10
 {g=vec2(1.,0.);k=5.5;amp=1.8;sat=.95;streak=.15;widen=.5;}                    // double rainbow (second sheet below)
#elif PAT==11
 {vec3 vc=voro(mat2(1.,.4,-.3,1.)*q*vec2(64.,44.),v_d1);vec2 id=vc.xy,j=hash2(id);vec3 fn=normalize(vec3((j-.5)*1.5,1.));   // fracture: a crust of tiny silver chips on the border strip, each with its own tilt and a cool colour of its own; inside the art only a few specks on light ink, nothing on the rules text
  float fine=lod(60.),border=1.-smoothstep(.04,.055,ed),sp=step(.93,hash(id+3.3)),fl=pow(max(dot(fn,H),0.),10.);
  f_str=mix((.42+.4*sp)*(1.-.8*tbox)*(1.-.5*tline),1.,border);ph=.1+.6*j.y*fine;k=.5;w=1.;
  spec=mix(pow(max(dot(N,H),0.),8.)*.5,fl*1.8,fine)*f_str;mirror=1.;amp=1.5*f_str*mix(1.,.3+1.4*fl,fine);sat=mix(.45,.9,step(.4,j.x));off=.3;streak=0.;widen=.6;f_leak=0.;}
#elif PAT==12
 {float fine=lod(45.);vec3 rc=vec3(0.);                                               // ripple: a few wide rings running off the card, yellow-green drifting to orange and pink along the arc, grainy, glowing only near the light
  for(int i=0;i<3;i++){vec2 cc=i==0?vec2(.12,.4):i==1?vec2(.95,.75):vec2(.55,-.25);vec2 dv=q-cc;float rr=length(dv),r0=i==0?.42:i==1?.5:.62,a=i==1?atan(-dv.y,-dv.x)-PI:atan(dv.y,dv.x);
   for(int j=0;j<2;j++){float u=(rr-r0-float(j)*.16)/.0065,ring=exp(-u*u*.5)*(j==0?1.:.7);rc=max(rc,ring*hue(.86+.17*sin(a*1.5+float(i)*2.)+.04*u));}}
  rc*=mix(1.,.45+.8*hash(floor(q*220.)),lod(220.));k=1.;streak=.15;widen=.15;amp=.5;
  f_top=fine*rc*(.05+1.1*near*near)*(1.-.7*tbox)*mix(.3,1.,smoothstep(.03,.05,ed));f_topink=.25;}
#elif PAT==13
 {vec2 p=q*vec2(11.,11.),c=floor(p),f=fract(p)-.5;float rr=length(f),fine=lod(75.); // mana: faint ring medallions with a mark inside, pressed into the sheet; they share the sheet's own slow pastel colour
  float ring=1.-smoothstep(.012,.035,abs(rr-.36)),pip=0.;for(int i=0;i<5;i++){float ak=float(i)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.012,.035,abs(length(f-.15*vec2(cos(ak),sin(ak)))-.055)));}
  float sym=max(ring,pip*.8)*fine;k=.7;amp=.9;sat=.55;streak=0.;widen=.3;mirror=.35;f_leak=.03;
  glint=sym*(.02+pow(max(dot(N,H),0.),5.)*.16);}
#elif PAT==14
 {vec2 wq=q;wq.y+=.16*q.x+.22*(q.x-.15)*(q.x-.15)+.03*sin(q.x*5.1+q.y*2.);float gs=1.+.8*q.x;  // dragonscale: round-tipped scales that overlap like roof tiles, in rows that bow and shrink toward the right. Each scale is a pale ice-blue or lilac facet, lit or dull on its own, with a bright lower rim that shows over dark ink too
  vec2 pb=wq*vec2(12.,20.5)*gs,id=vec2(0.),of=vec2(0.);float fy=floor(pb.y);
  for(int y=1;y>=-1;y--)for(int x=-1;x<=1;x++){float ry=fy+float(y),ox=mod(ry,2.)*.5;vec2 ctr=vec2(floor(pb.x-ox)+float(x)+.5+ox,ry),dd=(pb-ctr)*vec2(1.,.5)/.6;if(dot(dd,dd)<1.){id=ctr;of=dd;}}
  float fine=lod(34.),t=length(of),rim=smoothstep(.74,.9,t)*(1.-smoothstep(.97,1.,t))*smoothstep(-.35,.25,of.y),under=1.-smoothstep(-.9,-.2,of.y);
  float fac=pow(max(dot(normalize(vec3((hash2(id+2.1)-.5)*1.4,1.)),H),0.),6.),body=mix(.3,1.,smoothstep(-.8,.7,of.y));
  vec3 tc=mix(mix(vec3(.66,.88,1.),vec3(.85,.74,1.),hash(id+5.3)),hue(hash(id+8.8)),.22);
  k=.12;ph=.27+.16*hash(id+7.1)*fine;w=1.;sat=.45;off=.42;amp=1.7;streak=0.;widen=.35;mirror=.35;ex=10.;f_amb=vec3(.8);f_leak=0.;
  lines=mix(1.,(.18+1.9*fac*body)*(1.-.5*under),fine);glint=fine*rim*(.5+2.2*fac);
  f_top=fine*rim*tc*(.07+.7*fac)*mix(near,wide,.55)*(1.-.55*tbox);f_topink=0.;}
#elif PAT==15
 {amp=1.7;sat=.95;widen=.15;}                                                   // rainbow foil (Secret Lair): a traditional foil with stronger colour
#elif PAT==16
 {amp=1.1;sat=.45;mirror=.75;widen=.1;f_leak=.12;}                              // invisible ink: in room light close to a plain card; under a lamp a flat silver-white sheen with only pale colour. The hidden notes show under black light only and differ on every card, so none are drawn
#elif PAT==18
 {mirror=.8;ex=20.;amp=.32;sat=.35;streak=.1;widen=.25;f_amb=vec3(.92);f_leak=.04; // silver / gold sheet: one calm metal colour, black ink stays black
#if TINT==1
  {amp=1.3*mix(.35,1.,g_gold);widen=.55;f_amb=vec3(mix(.9,.68,g_gold));f_leak=0.;f_top=vec3(1.,.93,.72)*.3*mix(near,wide,.5)*g_gold;f_topdark=1.;}
#endif
 }  // gold: deep amber away from the light, pale cream gold under it
#elif PAT==19
 {f_gloss=1.35;
#if EMB==1
  {vec3 vc=voro(mat2(1.,.5,-.35,1.)*q*vec2(26.,13.),v_d1);vec2 id=vc.xy,j=hash2(id);vec3 fn=normalize(vec3((j-.5)*1.4,1.));float fine=lod(26.),dark=step(hash(id+6.6),.18)*fine;       // emblem foil: flat straight-edged prism chips, mostly royal blue and cyan with a few warm ones; some chips sit dark until the card turns
   ph=mix(.4,j.x<.82?.34+.16*j.y:j.y,fine);k=.3;w=1.;amp=2.4*(1.-dark)*mix(1.,.5+.9*hash(id+1.2),fine);sat=1.;off=.4;streak=0.;widen=.85;mirror=.9;spec=mix(pow(max(dot(N,H),0.),8.)*.5,pow(max(dot(fn,H),0.),12.)*1.4,fine)*(1.-dark);f_amb=vec3(mix(.4,.05,dark));f_gloss=1.;}
#endif
 }                                                             // ampersand: the big & is already in the card picture; it sits under a glossier coat
#elif PAT==22
 {vec2 p=q*vec2(5.,9.1);p.x+=mod(floor(p.y),2.)*.5;vec2 c=floor(p),m=(fract(p)-.5)/vec2(5.,9.1);              // step-and-compleat: rows of the Phyrexian mark on top of the ink
  float ring=abs(length(m)-.027)-.0028,bar=max(abs(m.x)-.0024,abs(m.y)-.047);float sym=(1.-smoothstep(0.,.004,min(ring,bar)))*lod(45.);
  vec2 mc=(c+.5-vec2(mod(c.y,2.)*.5,0.))/vec2(5.,9.1)-lq;float band=exp(-dot(mc,mc)/.55)*smoothstep(.03,.12,length(mc)+.05*hash(c));
  f_top=sym*mix(hue(mc.y*2.4+mc.x*.5+.3+.25*length(m)*20.),vec3(1.,.66,.12),.75*step(.5,hash(c+4.4)))*band*1.5*(.35+.65*pow(hash(c+8.3),1.5))+.2*exp(-dot(r,r)/.6)*hue(dot(r,g)*1.2+.3);f_topink=.8;f_leak=.07;}
#endif
 float along=dot(r,g);
 // Fine dashes in the sheet, laid along the colour bands.
 float fs=lod(45.)*streak,n=vnoise(vec2(dot(q,g)*45.,dot(q,vec2(-g.y,g.x))*6.));
 if(w<0.)w=smoothstep(.05,.22,abs(along));
 float t=abs(along)*k+ph+(n-.5)*fs+dot(N.xy,g)*2.;
 vec3 rb=mix(vec3(1.),hue(t),sat);
#if PAT==10
 rb=.5*(rb+mix(vec3(1.),hue(abs(dot(r,normalize(vec2(-.5,.86))))*4.5),sat))*1.1;
#endif
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
#if TINT==0
 vec3 metal=vec3(1.);
#elif TINT==1
 vec3 metal=mix(vec3(.97,.95,.92),vec3(1.,.78,.4),g_gold);
#else
 vec3 metal=vec3(.9,.93,.98);
#endif
 vec3 col=w*amp*(rb-off)*(1.+1.2*(n-.5)*fs);
#if TINT==1
 col=metal*w*amp*(.25+.3*dot(rb,vec3(.333)));
#elif TINT==2
 col=metal*w*amp*(.25+.3*dot(rb,vec3(.333)))+col*.3;
#endif
 float env=mix(near,wide,widen);
 f_amb*=metal;f_glare=near*mirror*spec;
 vec3 F=f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines+f_add;
 N=N0;
 // Gold stamped on top of a foil card (gilded): the stamp is its own raised gold metal, the rest stays foil.
#if COVER==6
 {vec2 gg=normalize(vec2(.9,.44));float al=dot(r,gg),gn=vnoise(vec2(dot(q,gg)*45.,dot(q,vec2(-gg.y,gg.x))*6.)),gf=lod(45.)*.1,gw=smoothstep(.05,.22,abs(al));
  vec3 grb=mix(vec3(1.),hue(abs(al)*1.7+(gn-.5)*gf+dot(N.xy,gg)*2.),.35),gm=vec3(1.,.78,.4),ga=vec3(.68)*gm;
  vec3 G=ga+mix(near,wide,.55)*gm*gw*1.3*(.25+.3*dot(grb,vec3(.333)))+near*.8*pow(max(dot(N,H),0.),20.)*gm;float s=goldInk;
  F=mix(F,G*1.1,s);f_amb=mix(f_amb,ga,s);f_gloss=mix(f_gloss,1.6,s);f_leak=mix(f_leak,.3,s);f_glare=near*.8*pow(max(dot(N,H),0.),20.);}
#endif
 // Thin film replaces the sheet's colour (oil slick): colour depends on view angle and film thickness.
#if FILM
 {float bx=uv.x-lp.x,u=abs(bx)/.085,u2=abs(bx+.46)/.07,band=exp(-u*u*.8),band2=.5*exp(-u2*u2*.8);
  vec3 ramp=mix(mix(vec3(1.,.9,.62),vec3(1.,.48,.14),smoothstep(.15,.6,u)),mix(vec3(.6,.2,.85),vec3(.15,.4,1.),smoothstep(.95,1.5,u)),smoothstep(.6,1.,u));
  float ch=(max(base.r,max(base.g,base.b))-min(base.r,min(base.g,base.b)))/(max(base.r,max(base.g,base.b))+.02);
  f_amb=vec3(.3);F=mix(f_amb+(band*ramp+band2*vec3(.35,.4,1.))*8.*(.75+.25*near),vec3(1.),max(.5*smoothstep(.3,.6,ch),smoothstep(.55,.85,dot(base,vec3(.333)))));}
#endif
 // Ink over metal: light ink lets the lit foil through, dark ink hides it; the darkest ink still passes a
 // faint glint of the highlight.
 float keep=u_r2.w,c=clamp(cov*(1.-keep),0.,1.);
#if EMB==1
 base=mix(base,mix(vec3(.2),vec3(.5),g_emb2),.93*emb); // the emblem is foil stamped over the print: mostly metal, a little of the picture
#endif
 float lum=dot(base,vec3(.2126,.7152,.0722)),top=max(base.r,max(base.g,base.b)),vis=mix(.25,1.,smoothstep(.01,.3,lum));
#if PAT==11
 vis=smoothstep(.22,.6,lum); // fracture sits on the light border; the darker figure stays flat
#endif
#if FILM
 vis=1.;
#endif
#if COVER==3
 f_leak*=.1;vis*=.4*(1.-mk.g);
#endif
 vec3 Fv=f_amb+(F-f_amb)*vis;
 vec3 lit=base*(1.+.1*(1.-base))*Fv+(1.-top)*f_leak*(f_glare*2.+.14*near)*f_amb;
 vec3 outC=mix(base,shoulder(lit),c);
 // Raised relief: glossy rims where the embossed height turns toward the light.
#if RELIEF
 {float rim=pow(max(dot(N,H),0.),24.)*(.3+.7*near)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*vec3(1.,.97,.92)*rim*rel*cov*.6;}
#endif
 // Galaxy / surge sparks: a few large stars and many fine ones; the fine ones only at sizes that can show them.
#if SPARK
 {vec2 gq=vec2(uv.x,uv.y*u_aspect);float clump=.25+2.4*smoothstep(.35,.8,vnoise(gq*2.3+1.7));for(int i=0;i<3;i++){float n=i==0?24.:i==1?44.:72.,fade=i==0?1.:lod(n);vec2 sq=gq*n,sc=floor(sq);vec2 j=hash2(sc+float(i)*9.);float on=step(1.-clamp((i==0?.16:i==1?.3:.4)*u_r2.y*clump,0.,.95),j.x);
  float pt=1.-smoothstep(.04,.16+.12*j.y,length(fract(sq)-.25-.5*hash2(sc*1.3)));
  float tw=pow(max(dot(normalize(vec3((hash2(sc+5.)-.5)*1.5,1.)),H),0.),10.);outC+=(1.-outC)*on*pt*fade*(.06+.22*j.y*j.y+tw*2.4)*cov*(.6+.4*near)*(1.-.85*step(u_text.w+.012,uv.y))*vec3(1.,.97,.92);}}
#endif
 // Fluorescent ink glows under any light, on top of its foil.
#if COVER==3
 outC+=base*mk.g*.9*(.6+.4*near);
#endif
#if STAMP==1
 {float s=shootingStar(uv);outC=mix(outC,shoulder(F*vec3(.95,.97,1.)*1.1+vec3(.08)),s*.85);}
#endif
#if EMB==1
 outC+=(1.-outC)*.09*near*(1.-emb); // the plain card around a foil emblem only returns a soft grey glare
#endif
 // A clear glossy emblem over the foil: it adds no colour, it only catches the light sooner and harder than the card around it.
#if EMB==2
 {float gl=pow(max(dot(N,H),0.),14.);outC+=(1.-outC)*g_emb*(.035+.5*gl*gl+.12*near)*vec3(1.,.98,.95);}
#endif
#if PAT==4
 outC+=(1.-outC)*.055*pow(near,2.)*(1.-c)*smoothstep(.02,.2,lum);
#endif
 // Marks pressed on top of the ink show over any ink.
 outC+=(1.-outC)*f_top*c*max(0.,1.-f_topink*smoothstep(.08,.6,lum))*mix(1.,smoothstep(.006,.06,lum),f_topdark);
 // Varnish: one clear coat over the whole face (not on metal-ink etched cards) returns a small white gloss.
 float coat=pow(max(dot(N,H),0.),60.)*.05*f_gloss;
 outC+=(1.-outC)*coat*mix(.35,1.,c);
 return clamp(outC,0.,1.);
}
`;
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
// What a recipe compiles in. emblem: 0 none, 1 = the emblem is the card's only foil (Jurassic World
// Collection), 2 = a clear glossy emblem over the foil (the D&D ampersand promos).
export const foilDefs=(r,emblem=0)=>({PAT:r.pat===17?1:r.pat,TINT:r.tint,COVER:r.cover,FILM:r.film>.5?1:0,SPARK:r.sparkle>0?1:0,STAMP:r.stamp===1?1:0,RELIEF:r.relief>0?1:0,EMB:r.pat===19?emblem:0});
export const foilKey=d=>[d.PAT,d.TINT,d.COVER,d.FILM,d.SPARK,d.STAMP,d.RELIEF,d.EMB].join('.');
const HEAD=`precision highp float;
varying vec2 v;
uniform sampler2D u_card;   // card image, resampled to the display size
uniform sampler2D u_mask;   // R gold ink, G neon ink, B bare paper, A drawn lines
uniform sampler2D u_relief; // R height, G/B stroke direction, A stroke strength
#if EMB
uniform sampler2D u_emblem; // R: shape of a big foil or gloss emblem, G: where its foil chips sit
#endif
`,MAIN=`
void main(){
 vec2 uv=vec2(v.x,1.-v.y);vec3 base=toLin(texture2D(u_card,v).rgb);vec4 mk=texture2D(u_mask,v),rl=texture2D(u_relief,v);
#if EMB
 vec4 em=texture2D(u_emblem,v);
#else
 vec4 em=vec4(0.);
#endif
#if RELIEF
 vec2 e=u_texel*2.;float hx=texture2D(u_relief,v+vec2(e.x,0.)).r-texture2D(u_relief,v-vec2(e.x,0.)).r,hy=texture2D(u_relief,v-vec2(0.,e.y)).r-texture2D(u_relief,v+vec2(0.,e.y)).r;
#else
 float hx=0.,hy=0.;
#endif
 gl_FragColor=vec4(toSrgb(foilShade(base,uv,mk,rl,vec2(hx,hy),em)),1.);
}`;
export const MTG_FOIL_UNIFORMS=['u_card','u_mask','u_relief','u_emblem','u_tilt','u_px','u_texel','u_aspect','u_art','u_text','u_r1','u_r2'];
// The fragment shader for one recipe (a row of mtg-foil-recipes.js).
export const mtgFoilFragment=(r,emblem=0)=>composeFoil(HEAD+MTG_FOIL_TEMPLATE+MAIN,foilDefs(r,emblem));
