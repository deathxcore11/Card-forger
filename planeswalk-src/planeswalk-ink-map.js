/* Planeswalk ink map (Randall 30 Oct: "better than Moxgate", dotted ink trails, more Magic vibes). Three layers:
   1) inked node stamps, painted HUD strip, wax-seal emblems, quill trails; 2) hero portrait seal, captions on pickable stops,
   dusk wash; 3) dotted trails, rune rings, summoning circle with the five mana symbols, loyalty shield, corner scrollwork. */
/* Planeswalk "Ink" map + painted HUD (mockup layer). Hand-inked node stamps, wobbly dashed ink trails,
   a brush-masked boss emblem, a painted HUD strip with chunky icons, and wax-seal emblems. No glows. */
(()=>{
const INK='#140d09',BONE='#ecdfc2',SHADE='#c2b08a';
const rough=(seed,s=2.2,f=.07)=>`<filter id='r' x='-15%' y='-15%' width='130%' height='130%'><feTurbulence type='fractalNoise' baseFrequency='${f}' numOctaves='2' seed='${seed}'/><feDisplacementMap in='SourceGraphic' scale='${s}' xChannelSelector='R' yChannelSelector='G'/></filter>`;
const svg=(body,seed=3,vb='0 0 64 64')=>`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'><defs>${rough(seed)}</defs><g filter='url(#r)' stroke='${INK}' stroke-width='3.2' stroke-linejoin='round' stroke-linecap='round' fill='${BONE}'>${body}</g></svg>`;
const uri=s=>`url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const sword=`<path d='M32 4 L36.5 12 L36.5 40 L27.5 40 L27.5 12 Z'/><path d='M32 4 L36.5 12 L36.5 40 L32 40 Z' fill='${SHADE}' stroke='none'/><line x1='32' y1='13' x2='32' y2='37' stroke-width='1.3'/><rect x='19' y='39.5' width='26' height='5.5' rx='2.5'/><rect x='29.5' y='45' width='5' height='10' rx='1.5'/><circle cx='32' cy='58.5' r='3.6'/>`;
const ICON={
 fight:svg(`<g transform='rotate(42 32 32) translate(0 1) scale(.92) translate(2.8 2.8)'>${sword}</g><g transform='rotate(-42 32 32) translate(0 1) scale(.92) translate(2.8 2.8)'>${sword}</g>`,4),
 elite:svg(`<path d='M19 16 L22 5 L27 12 L32 3 L37 12 L42 5 L45 16 Z' fill='${SHADE}'/><path d='M16 33 C16 20 23 14 32 14 C41 14 48 20 48 33 C48 40 45 43 42 45 L42 52 L22 52 L22 45 C19 43 16 40 16 33 Z'/><path d='M32 14 C41 14 48 20 48 33 C48 40 45 43 42 45 L42 52 L36 52 C40 44 42 30 32 14 Z' fill='${SHADE}' stroke='none'/><ellipse cx='25.5' cy='32' rx='5' ry='5.8' fill='${INK}' stroke='none'/><ellipse cx='38.5' cy='32' rx='5' ry='5.8' fill='${INK}' stroke='none'/><path d='M32 37 L29.6 42.5 L34.4 42.5 Z' fill='${INK}' stroke-width='1'/><path d='M23 47.5 L41 47.5' stroke-width='1.6'/><path d='M27 47.5 L27 52 M32 47.5 L32 52 M37 47.5 L37 52' stroke-width='1.3'/><path d='M26 52 L27.6 58 L29.4 52 M34.6 52 L36.4 58 L38 52' fill='${BONE}' stroke-width='1.6'/>`,7),
 rest:svg(`<rect x='10' y='48' width='44' height='8' rx='4' transform='rotate(16 32 52)' fill='${SHADE}'/><rect x='10' y='48' width='44' height='8' rx='4' transform='rotate(-16 32 52)'/><path d='M32 6 C38 17 47 22 45 34 C44 42 38.5 47 32 47 C25.5 47 20 42 19.5 34 C19 26 25 22 26 15 C29 19 30.5 21.5 31 24 C33.5 17.5 31 12 32 6 Z'/><path d='M32.5 25 C36 31 39 34 38 39.5 C37 43.5 34.8 45 32 45 C29 45 26.6 43 26.8 39.5 C27 35 30.6 32.6 32.5 25 Z' fill='${INK}' stroke='none'/>`,9),
 shop:svg(`<path d='M23 23 C14 30 12 44 18 52 C22 57.5 42 57.5 46 52 C52 44 50 30 41 23 Z'/><path d='M41 23 C50 30 52 44 46 52 C44 55 40 56.5 36 57 C44 48 44 33 38 23 Z' fill='${SHADE}' stroke='none'/><path d='M22 23 L42 23 L40 18 L24 18 Z' fill='${SHADE}'/><path d='M25 18 C24 13 27 10 32 10 C37 10 40 13 39 18' fill='${BONE}'/><path d='M27 18 C24 12 18 12 17 16 M37 18 C40 12 46 12 47 16' fill='none' stroke-width='1.8'/><circle cx='32' cy='40' r='7.5' fill='none' stroke-width='2.2'/><path d='M32 35 L32 45 M29 37.5 L35 37.5 M29 42.5 L35 42.5' stroke-width='1.6'/>`,11),
 treasure:svg(`<path d='M9 30 L9 22 C9 13 55 13 55 22 L55 30 Z' fill='${SHADE}'/><rect x='9' y='30' width='46' height='24' rx='2'/><path d='M9 42 L55 42' stroke-width='1.4'/><path d='M18 16 L18 54 M46 16 L46 54' stroke-width='3'/><rect x='27.5' y='26' width='9' height='11' rx='1.5' fill='${SHADE}'/><circle cx='32' cy='30.5' r='1.8' fill='${INK}' stroke='none'/><path d='M32 31 L32 34.5' stroke-width='1.6'/>`,13),
 event:svg(`<g transform='rotate(-9 32 32)'><rect x='16' y='5' width='32' height='54' rx='3.5'/><rect x='20.5' y='9.5' width='23' height='45' rx='2' fill='none' stroke-width='1.3'/><path d='M23 32 C27.5 25.5 36.5 25.5 41 32 C36.5 38.5 27.5 38.5 23 32 Z' fill='${SHADE}' stroke-width='2'/><circle cx='32' cy='32' r='3.8' fill='${INK}' stroke='none'/><path d='M32 15 L32 20 M24.5 18 L26.8 22 M39.5 18 L37.2 22 M32 44 L32 49' stroke-width='1.5'/></g>`,15),
 dungeon:svg(`<rect x='8' y='52' width='48' height='7' rx='1.5' fill='${SHADE}'/><path d='M14 52 L14 28 C14 13 50 13 50 28 L50 52 Z'/><path d='M23 18 L23 52 M32 15 L32 52 M41 18 L41 52 M14 36 L50 36' stroke-width='2.6'/><circle cx='32' cy='36' r='2.2' fill='${INK}' stroke='none'/>`,17),
 bargain:svg(`<path d='M18 10 L46 10 C46 25 40 33 32 33 C24 33 18 25 18 10 Z'/><path d='M19.5 13 L44.5 13 C44 18 42.5 21 40.5 23 L23.5 23 C21.5 21 20 18 19.5 13 Z' fill='#8e1b16' stroke='none'/><rect x='29.5' y='33' width='5' height='14' rx='1.5'/><path d='M19 56 C19 48.5 45 48.5 45 56 Z' fill='${SHADE}'/><path d='M40.5 23 C41.5 28 42 31 40.5 33 C39 31 39.6 28 40.5 23 Z' fill='#8e1b16' stroke-width='1.2'/>`,19),
};
ICON.ante=ICON.bargain;
// a ragged ink-wash blot behind each stamp keeps it legible on the painting
const BLOT=uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='3' seed='5'/><feDisplacementMap in='SourceGraphic' scale='16'/><feGaussianBlur stdDeviation='2.2'/></filter></defs><circle cx='50' cy='50' r='33' fill='#06070a' fill-opacity='.6' filter='url(#b)'/></svg>`);
// hand-drawn circle for visited nodes (two loose passes, like a quill mark)
const RING=c=>uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>${rough(21,2.4,.05)}</defs><g filter='url(#r)' fill='none' stroke='${c}' stroke-linecap='round'><path d='M78 30 C70 14 44 9 27 20 C9 33 10 64 29 79 C47 92 76 86 86 64 C92 50 88 37 80 29' stroke-width='5'/><path d='M74 24 C83 35 86 47 82 60' stroke-width='3' opacity='.7'/></g></svg>`);
// brush-edged mask for the boss portrait, and its sketched frame
const BRUSH=uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.06' numOctaves='3' seed='8'/><feDisplacementMap in='SourceGraphic' scale='10'/></filter></defs><circle cx='50' cy='50' r='42' fill='#000' filter='url(#m)'/></svg>`);
const BOSSRING=c=>uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>${rough(31,3,.04)}</defs><g filter='url(#r)' fill='none' stroke-linecap='round'><circle cx='50' cy='50' r='45' stroke='${INK}' stroke-width='4.5'/><path d='M14 38 C20 15 52 2 76 14 C95 25 99 56 84 76 C70 95 36 97 18 80' stroke='${c}' stroke-width='3.2' opacity='.95'/><path d='M8 56 C7 46 10 40 14 34' stroke='${c}' stroke-width='2' opacity='.7'/></g></svg>`);
// painted HUD strip: slate band with a torn lower edge and brush grain
const STRIP=uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 100' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2f3b45'/><stop offset='.75' stop-color='#1d252d'/><stop offset='1' stop-color='#151b21'/></linearGradient><filter id='t'><feTurbulence type='fractalNoise' baseFrequency='.012 .6' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 .55  0 0 0 0 .62  0 0 0 0 .66  0 0 0 .22 0'/><feComposite in2='SourceGraphic' operator='in'/></filter></defs><path id='p' d='M0 0 H1200 V84 L1185 88 1170 83 1150 91 1128 85 1104 89 1080 82 1052 90 1030 86 1004 92 980 84 955 88 930 83 905 90 880 86 850 92 826 84 800 88 776 82 750 90 724 85 700 91 676 84 650 88 622 82 600 90 574 86 550 92 524 84 500 89 476 83 450 90 424 85 400 91 374 84 350 88 324 82 300 90 274 86 250 92 224 84 200 89 176 83 150 90 124 85 100 91 74 84 50 88 24 82 0 90 Z' fill='url(#g)'/><path d='M0 0 H1200 V84 L1185 88 1170 83 1150 91 1128 85 1104 89 1080 82 1052 90 1030 86 1004 92 980 84 955 88 930 83 905 90 880 86 850 92 826 84 800 88 776 82 750 90 724 85 700 91 676 84 650 88 622 82 600 90 574 86 550 92 524 84 500 89 476 83 450 90 424 85 400 91 374 84 350 88 324 82 300 90 274 86 250 92 224 84 200 89 176 83 150 90 124 85 100 91 74 84 50 88 24 82 0 90 Z' fill='#fff' filter='url(#t)'/><path d='M0 84 L24 82 50 88 74 84 100 91 124 85 150 90 176 83 200 89 224 84 250 92 274 86 300 90 324 82 350 88 374 84 400 91 424 85 450 90 476 83 500 89 524 84 550 92 574 86 600 90 622 82 650 88 676 84 700 91 724 85 750 90 776 82 800 88 826 84 850 92 880 86 905 90 930 83 955 88 980 84 1004 92 1030 86 1052 90 1080 82 1104 89 1128 85 1150 91 1170 83 1185 88 1200 84' fill='none' stroke='#0a0d10' stroke-width='3'/></svg>`);
const HUDI={
 heart:svg(`<path d='M32 56 C18 46 6 36 6 22 C6 12 14 6 22 6 C27 6 30.5 9 32 12.5 C33.5 9 37 6 42 6 C50 6 58 12 58 22 C58 36 46 46 32 56 Z' fill='#d8343a'/><path d='M32 56 C46 46 58 36 58 22 C58 15 54 10 49 8 C55 16 50 34 32 56 Z' fill='#9d1f27' stroke='none'/><path d='M15 18 C16 13 20 11 24 11.5' fill='none' stroke='#ffb3aa' stroke-width='3'/>`,23),
 coin:svg(`<circle cx='32' cy='32' r='25' fill='#e7b443'/><circle cx='32' cy='32' r='25' fill='none' stroke='#8a5a12' stroke-width='1.2' transform='translate(0 0)'/><circle cx='32' cy='32' r='18' fill='none' stroke='#9a6a18' stroke-width='2.4'/><path d='M32 19 L32 45 M24 26 L40 26 M27 34 C27 40 37 40 37 34' fill='none' stroke='#7a4c0e' stroke-width='2.6'/><path d='M14 26 C16 19 21 14 27 12' fill='none' stroke='#fff0b0' stroke-width='3'/>`,25),
 deck:svg(`<rect x='18' y='10' width='30' height='42' rx='3' transform='rotate(12 33 31)' fill='${SHADE}'/><rect x='14' y='12' width='30' height='42' rx='3' fill='#5a3b2a'/><rect x='18' y='16' width='22' height='34' rx='2' fill='none' stroke='#c9a46a' stroke-width='1.6'/><path d='M29 24 L33 32 L29 40 L25 32 Z' fill='#c9a46a' stroke-width='1.4'/>`,27),
 help:svg(`<path d='M22 22 C22 12 42 10 42 22 C42 29 33 30 33 38' fill='none' stroke='${BONE}' stroke-width='6'/><circle cx='33' cy='50' r='4' fill='${BONE}' stroke='none'/>`,29),
 menu:svg(`<path d='M14 18 L50 18 M14 32 L50 32 M14 46 L50 46' stroke='${BONE}' stroke-width='6'/>`,33),
};
const CSS=`
/* trails */
#app .map>svg.pw-paths{background:none!important}
.pw-paths path{filter:none!important;animation:none!important;stroke-dasharray:none;transition:opacity .2s}
.pw-paths path.future{stroke:${BONE};stroke-opacity:.34;stroke-width:2.1;stroke-dasharray:6 5 2 6 9 5 3 6}
.pw-paths path.behind{stroke:${BONE};stroke-opacity:.12;stroke-width:1.8;stroke-dasharray:6 5 2 6 9 5 3 6}
.pw-paths path.ahead{stroke:var(--ink-hero);stroke-opacity:.62;stroke-width:2.8;stroke-dasharray:7 6 3 6}
.pw-paths path.walked{stroke:var(--ink-hero);stroke-opacity:.95;stroke-width:3.4;stroke-dasharray:10 5 4 5}
.pw-paths path.shadow{stroke:#0a0705!important;stroke-opacity:.5!important;stroke-width:5.2!important}
.map.pw-cascade .pw-paths path{opacity:.35}
.map.pw-cascade .pw-paths path.pw-reach{opacity:1;stroke-opacity:.75;stroke:${BONE};stroke-width:2.6;filter:none!important}
.map.pw-cascade .pw-paths path.pw-reach.walked,.map.pw-cascade .pw-paths path.pw-reach.ahead{stroke:var(--ink-hero)}
/* stamps */
#app .map .maprow>.node:not(.boss){--ns:60px}
@media (max-aspect-ratio:3999/5000){#app .map .maprow>.node:not(.boss){--ns:52px}.pw-paths path.future,.pw-paths path.behind{stroke-width:1.6}.pw-paths path.walked{stroke-width:2.6}.pw-paths path.shadow{stroke-width:3.8!important}}
#app .map .node:not(.boss)::before{background:${BLOT} center/130% no-repeat!important;box-shadow:none!important;border:0!important;animation:none!important;transform:none!important;opacity:.95;filter:none!important}
#app .map .node:not(.boss)::after{display:none!important}
#app .map .node:not(.boss){overflow:visible;background:none!important;border:0!important;box-shadow:none!important}
#app .map .maprow>.node:not(.boss) b{height:var(--ns)!important;font-size:0!important;color:transparent!important;background:var(--ink-ic) center/100% no-repeat!important;box-shadow:none!important;border:0!important;filter:drop-shadow(0 2px 0 #000a)!important;text-shadow:none!important;transition:transform .25s ease-out,opacity .25s}
${Object.entries(ICON).map(([k,v])=>`#app .map .node[data-t=${k}]{--ink-ic:${uri(v)}}`).join('\n')}
#app .map .maprow>.node:not(.boss):not(.open):not(.done) b{opacity:.62;filter:grayscale(.35) brightness(.86) drop-shadow(0 2px 0 #000a)!important}
#app .map .maprow>.node.past b{opacity:.32!important}
#app .map .maprow>.node.open b{animation:ink-bob 1.6s ease-in-out infinite!important}
@keyframes ink-bob{0%,100%{transform:scale(1)}50%{transform:scale(1.13)}}
@media (prefers-reduced-motion:reduce){#app .map .maprow>.node.open b{animation:none!important;transform:scale(1.1)!important}}
#app .map .maprow>.node.done::after{content:""!important;display:block!important;position:absolute!important;left:50%!important;top:calc((44px - var(--ns))/2 - 6px)!important;width:calc(var(--ns) + 12px)!important;height:calc(var(--ns) + 12px)!important;margin:0 0 0 calc(var(--ns)/-2 - 6px)!important;background:var(--ink-ring) center/contain no-repeat!important;box-shadow:none!important;border:0!important;animation:none!important;pointer-events:none}
#app .map .node.past{opacity:1!important;filter:none!important}
/* boss: painted emblem with a brushed edge, no gold ring */
#app .map .node.boss::before{box-shadow:none!important;border:0!important;-webkit-mask:${BRUSH} center/100% no-repeat;mask:${BRUSH} center/100% no-repeat;filter:saturate(.9) contrast(1.05)}
#app .map .node.boss::after{content:""!important;display:block!important;position:absolute!important;inset:auto!important;left:50%!important;top:0!important;width:var(--bw,112%);aspect-ratio:1;translate:-50% -6%;background:${BOSSRING('var(--ink-hero-raw)')} center/contain no-repeat!important;box-shadow:none!important;animation:none!important;pointer-events:none}
#app .map .node.boss .heal{background:#1a120c!important;border:1px solid #6b5a3a!important;color:#d9c9a3!important;box-shadow:none!important;font-family:var(--body)!important}
/* painted HUD strip */
#app>.top{background:${STRIP} top/100% 100% no-repeat!important;height:calc(var(--pw-hud-h) + 14px)!important;box-shadow:none!important;padding-bottom:10px!important}
#app>.top .life,#app>.top .gold{background:none!important;border:0!important;box-shadow:none!important;font:800 1.15rem/1 var(--display)!important;letter-spacing:.02em;display:inline-flex!important;align-items:center;gap:6px;padding:0 6px!important}
#app>.top .life{color:#f0564f!important;text-shadow:0 2px 0 #3b0d0d,0 0 1px #000}
#app>.top .gold{color:#f2c45a!important;text-shadow:0 2px 0 #3d2a06}
#app>.top .life::before,#app>.top .gold::before{content:"";width:30px;height:30px;flex:none;background:var(--hi) center/contain no-repeat}
#app>.top .life{--hi:${uri(HUDI.heart)}}#app>.top .gold{--hi:${uri(HUDI.coin)}}
#app>.top .life{font-size:0!important}#app>.top .life::after{content:attr(data-v);font:800 1.15rem/1 var(--display)}
#app>.top .gold{font-size:0!important}#app>.top .gold::after{content:attr(data-v);font:800 1.15rem/1 var(--display)}
#app>.top .lifebar{display:none!important}
#app>.top :is(.btn,summary.btn){background:radial-gradient(circle at 40% 30%,#3e4a54,#1b232a 70%)!important;border:2px solid #0a0d10!important;box-shadow:inset 0 1px 0 #ffffff22,0 2px 0 #0008!important;color:${BONE}!important}
#app>.top details.deck>summary{display:inline-flex!important;align-items:center;gap:6px;border-radius:12px!important}
#app>.top details.deck>summary::before{content:"";width:26px;height:26px;background:${uri(HUDI.deck)} center/contain no-repeat}
#app>.top .pw-infobtn,#app>.top .pw-menubtn{font-size:0!important;border-radius:50%!important}
#app>.top .pw-infobtn::before,#app>.top .pw-menubtn::before{content:"";width:22px;height:22px;background:var(--hi) center/contain no-repeat}
#app>.top .pw-infobtn{--hi:${uri(HUDI.help)}}#app>.top .pw-menubtn{--hi:${uri(HUDI.menu)}}
/* wax-seal emblems in a tray under the strip */
#app>.top .emblems{position:absolute;left:14px;top:calc(var(--pw-hud-h) + 12px);display:flex!important;gap:6px;background:none!important;border:0!important}
#app>.top .emblems svg.emb{width:34px;height:34px;filter:drop-shadow(0 3px 2px #000b)}
#app>.top .emblems svg.emb circle{fill:url(#seal);stroke:#3a0d0a;stroke-width:1.6}
#app>.top .emblems svg.emb.mythic circle{fill:url(#sealM)}
#app>.top .emblems svg.emb text{fill:#ffd9c2!important;font-weight:700;paint-order:stroke;stroke:#4a0f0b;stroke-width:1.2}
`;
const st=document.createElement('style');st.id='ink-css';st.textContent=CSS;document.head.append(st);
// shared gradients for the wax seals
document.body.insertAdjacentHTML('beforeend',`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="seal" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#d0473a"/><stop offset=".6" stop-color="#9a2219"/><stop offset="1" stop-color="#5e110c"/></radialGradient><radialGradient id="sealM" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#f3d27a"/><stop offset=".6" stop-color="#c08a2a"/><stop offset="1" stop-color="#6e4a10"/></radialGradient></defs></svg>`);
const hero=()=>{try{return run&&run.hero==='W'?'W':'R'}catch{return 'R'}};
const tint=()=>{const c=hero()==='W'?'#f0d27a':'#e0442f';const de=document.documentElement;de.style.setProperty('--ink-hero',c);de.style.setProperty('--ink-hero-raw',c);de.style.setProperty('--ink-ring',RING(c))};
// trails: resample each Bézier into a slightly wavering quill line
const wob=(x,s)=>{const t=Math.sin(x*12.9898+s*78.233)*43758.5453;return t-Math.floor(t)};
const quill=()=>{const svgEl=document.querySelector('.map>svg.pw-paths');if(!svgEl||svgEl.dataset.ink===svgEl.innerHTML.length+'')return;
 const ps=[...svgEl.querySelectorAll('path:not(.shadow)')];let out='';
 for(const p of ps){const L=p.getTotalLength(),n=Math.max(6,Math.round(L/9)),seed=(p.dataset.a+p.dataset.b).split('').reduce((a,c)=>a+c.charCodeAt(0),0);let d='';
  for(let i=0;i<=n;i++){const q=p.getPointAtLength(L*i/n),q2=p.getPointAtLength(Math.min(L,L*i/n+1)),dx=q2.x-q.x,dy=q2.y-q.y,l=Math.hypot(dx,dy)||1,j=(i===0||i===n)?0:(wob(i,seed)-.5)*2.2;
   d+=(i?' L':'M')+(q.x-dy/l*j).toFixed(1)+' '+(q.y+dx/l*j).toFixed(1)}
  const cls=p.getAttribute('class');out+=`<path class="shadow ${cls}" d="${d}"/><path class="${cls}" data-a="${p.dataset.a}" data-b="${p.dataset.b}" d="${d}"/>`}
 svgEl.innerHTML=out;svgEl.dataset.ink=svgEl.innerHTML.length+''};
const hud=()=>{const t=document.querySelector('#app>.top');if(!t)return;for(const k of ['life','gold']){const e=t.querySelector('.'+k);if(!e)continue;const v=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').replace(/[♥◎]/g,'').trim()||e.dataset.v||'';e.dataset.v=v;e.setAttribute('aria-label',(k==='life'?'Life ':'Gold ')+v)}};
const all=()=>{tint();quill();hud()};
let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;all()})}}).observe(document.getElementById('app'),{childList:true,subtree:true});all();
window.__ink=all;
})();

/* Ink map v2 (mockup layer on top of ink.js): solid quill trails with a soft wash, ink captions on the
   nodes you can pick, a Chandra/Elspeth portrait seal with the classic mana pip, Sorin's W/B pips on the
   boss seal, and a dusk wash behind the route so the stamps read on the painting. No glows. */
(()=>{
const MANA=window.PW_MANA;const BONE='#ecdfc2';
const pip=c=>`url("${MANA[c]}")`;
const CSS=`
#app .map{position:relative}
#app .map>.ink-vig{position:absolute;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 62% 58% at 50% 54%,#05070acc,#05070a66 62%,#0000 100%)}
#app .map>:not(.ink-vig){position:relative;z-index:1}
#app .map>svg.pw-paths{position:absolute!important}
/* trails: a quill line over a faint ink wash, no dashes; the walked route is a hero-colour brush */
.pw-paths path.future,.pw-paths path.behind,.pw-paths path.ahead,.pw-paths path.walked{stroke-dasharray:none!important;stroke-linecap:round;stroke-linejoin:round}
.pw-paths path.future{stroke:${BONE};stroke-opacity:.42;stroke-width:1.5}
.pw-paths path.behind{stroke:${BONE};stroke-opacity:.14;stroke-width:1.3}
.pw-paths path.ahead{stroke:${BONE};stroke-opacity:.9;stroke-width:2.4}
.pw-paths path.walked{stroke:var(--ink-hero);stroke-opacity:1;stroke-width:5}
.pw-paths path.shadow{stroke:#050302!important;stroke-opacity:.4!important;stroke-width:3.6!important}
.pw-paths path.shadow.walked{stroke-width:9!important;stroke-opacity:.7!important}
@media (max-aspect-ratio:3999/5000){.pw-paths path.walked{stroke-width:3.8}.pw-paths path.shadow{stroke-width:3!important}.pw-paths path.shadow.walked{stroke-width:7!important}.pw-paths path.future{stroke-width:1.3}
 #app#app>.top>.ink-hero{width:34px;height:34px;margin-right:0;box-shadow:0 0 0 2px #0a0d10,0 0 0 4px var(--ink-hero),0 2px 4px #000b}#app#app>.top>.ink-hero>i{width:17px;height:17px;right:-5px;bottom:-3px}
 #app>.top .gold::before,#app>.top .life::before{width:24px!important;height:24px!important}#app#app>.top :is(.life,.gold){padding:0 2px!important;gap:4px}#app#app>.top :is(.life,.gold)::after{font-size:1rem!important}}
/* stamps you can pick: full ink, a bone caption under them */
#app .map .maprow>.node.open b{opacity:1!important;filter:drop-shadow(0 2px 0 #000c)!important}
#app .map .maprow>.node .nl{display:none!important}
#app .map .maprow>.node.open .nl{display:block!important;position:absolute;left:50%;top:calc(50% + var(--ns)/2 + 2px);translate:-50% 0;white-space:nowrap;
 font:700 .78rem/1 var(--display)!important;letter-spacing:.08em;text-transform:uppercase;color:${BONE}!important;opacity:1!important;
 text-shadow:0 1px 0 #000,0 0 6px #000,0 0 2px #000;background:none!important;padding:0!important;border:0!important;clip:auto!important;clip-path:none!important;width:auto!important;height:auto!important;overflow:visible!important;margin:0!important}
#app .map .maprow>.node:not(.open):not(.done) b{opacity:.78!important}
/* first-row captions sit above the stamp so they clear the "You arrive here" label */
#app .map .maprow>.node.open[data-r="0"] .nl{top:auto!important;bottom:calc(50% + var(--ns)/2 + 16px)}
/* captions clear the rune ring, on a soft ink smudge so a trail passing behind never runs through the letters */
@media (max-width:370px){#app .map .maprow>.node.open[data-r="0"] .nl{bottom:calc(50% + var(--ns)/2 + 9px)}}
#app .map .maprow>.node.open .nl{background:#0b0907b3!important;box-shadow:0 0 8px 5px #0b0907b3;border-radius:6px}
/* sideways maps: the first column is always fights and sits on the edge label, so it goes without a caption */
@media (min-aspect-ratio:4/5){#app .map .maprow>.node.open[data-r="0"] .nl{display:none!important}}
/* portrait seal in the HUD: hero painting in a brushed ring with its mana pip */
#app>.top>h1{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;margin:0!important;padding:0!important;white-space:nowrap}
@media (max-width:370px){#app>.top>.ink-hero{display:none!important}}
#app>.top.ink-tight>.ink-hero{display:none!important}
#app>.top.ink-tight2{gap:2px!important}#app>.top.ink-tight2 .deck>summary{padding-inline:8px!important}
#app>.top>.ink-hero{position:relative;flex:none;width:52px;height:52px;border-radius:50%;margin-right:4px;background:var(--hero-img) center 22%/cover;box-shadow:0 0 0 3px #0a0d10,0 0 0 5px var(--ink-hero),0 3px 6px #000b}
#app>.top>.ink-hero>i{display:none!important;position:absolute;right:-6px;bottom:-4px;width:22px;height:22px;border-radius:50%;background:var(--pip) center/100% no-repeat;box-shadow:0 0 0 2px #0a0d10}
/* boss seal: Sorin's white and black pips under the ring */
#app .map .node.boss>.ink-pips{position:absolute;left:50%;top:-6px;translate:-50% 0;display:flex;gap:4px;z-index:3}
#app .map .node.boss>.ink-pips>i{width:24px;height:24px;border-radius:50%;background:var(--pip) center/100% no-repeat;box-shadow:0 0 0 2px #0a0d10,0 2px 3px #000b}
/* the mana symbol lives on the action-point orb only: none on the portrait seal or in the wax seals' faces */
#app>.top .emblems .emb-mana{display:none!important}
#app>.top .emblems svg.emb{position:relative}
`;
const st=document.createElement('style');st.id='ink2-css';st.textContent=CSS;document.head.append(st);
const hero=()=>{try{return run&&run.hero==='W'?'W':'R'}catch{return 'R'}};
const art=n=>{const e=document.createElement('i');e.dataset.n=n;e.style.display='none';document.body.append(e);const v=getComputedStyle(e).getPropertyValue('--img');e.remove();return v};
const apply=()=>{const t=document.querySelector('#app>.top');const h=hero();
 if(t&&!t.querySelector('.ink-hero')){const p=document.createElement('span');p.className='ink-hero';p.setAttribute('aria-hidden','true');
  p.style.setProperty('--hero-img',art(h==='W'?'Elspeth, Sun\'s Champion':'Chandra, Torch of Defiance'));p.innerHTML=`<i style='--pip:${pip(h)}'></i>`;const h1=t.querySelector(':scope>h1');h1?h1.after(p):t.prepend(p)}
 // a full top bar (big text, narrow phone) drops the portrait seal before anything spills off the screen
 if(t){// the bar is tight once its items reach within 4px of the screen edge: first the gaps, emblems and deck button slim down, then the portrait goes
  const edge=()=>{const T=t.getBoundingClientRect();return [...t.children].some(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<T.left+4||r.right>T.right-4)})};
  t.classList.remove('ink-tight','ink-tight2');if(edge()){t.classList.add('ink-tight2');if(edge())t.classList.add('ink-tight')}}
 const m=document.querySelector('#app .map');if(m&&!m.querySelector('.ink-vig')){const v=document.createElement('div');v.className='ink-vig';m.prepend(v)}
 const b=document.querySelector('#app .map .node.boss');if(b&&!b.querySelector('.ink-pips')){const s=document.createElement('span');s.className='ink-pips';s.setAttribute('aria-hidden','true');s.innerHTML=[...(b.dataset.cols||'')].filter(c=>'WUBRG'.includes(c)).map(c=>`<i style='--pip:${pip(c)}'></i>`).join('');b.append(s)}};
let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;apply()})}}).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true,attributeFilter:['style']});addEventListener('resize',apply);apply();
})();

/* Ink map v3 (on ink.js + ink2.js): dotted ink trails, arcane rune rings on the stops you can take, a summoning circle
   inked under the planeswalker boss, a loyalty shield for life, and scrollwork corners on the map. Ink only, no glows. */
(()=>{
const BONE='#ecdfc2',INK='#140d09';
const uri=s=>`url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const rough=(id,seed,s=1.6,f=.06)=>`<filter id='${id}' x='-10%' y='-10%' width='120%' height='120%'><feTurbulence type='fractalNoise' baseFrequency='${f}' numOctaves='2' seed='${seed}'/><feDisplacementMap in='SourceGraphic' scale='${s}' xChannelSelector='R' yChannelSelector='G'/></filter>`;
// rune glyphs: little inked marks set around a ring
const glyphs=(n,r,cx=50,cy=50,sz=4)=>{let o='';const G=[`M0 -${sz} L0 ${sz} M-${sz*.6} -${sz*.3} L${sz*.6} ${sz*.3}`,`M-${sz*.6} ${sz} L0 -${sz} L${sz*.6} ${sz}`,`M-${sz*.6} -${sz} L${sz*.6} ${sz} M${sz*.6} -${sz} L-${sz*.6} ${sz}`,`M0 -${sz} L0 ${sz} M0 -${sz*.2} L${sz*.7} -${sz*.8}`,`M-${sz*.6} -${sz*.6} A${sz*.8} ${sz*.8} 0 1 0 ${sz*.6} -${sz*.6}`,`M-${sz*.7} 0 L${sz*.7} 0 M0 -${sz} L0 ${sz}`];
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;o+=`<path transform='translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a*180/Math.PI+90).toFixed(0)})' d='${G[i%G.length]}'/>`}return o};
const RUNE=c=>uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>${rough('r',41)}</defs><g filter='url(#r)' fill='none' stroke='${c}' stroke-linecap='round'><circle cx='50' cy='50' r='46' stroke-width='1.6' stroke-dasharray='1 5.2'/><circle cx='50' cy='50' r='40' stroke-width='1.2' opacity='.85'/><g stroke-width='1.3'>${glyphs(12,43.2,50,50,2.4)}</g></g></svg>`);
const SUMMON=c=>uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs>${rough('s',47,2,.04)}</defs><g filter='url(#s)' fill='none' stroke='${c}' stroke-linecap='round' stroke-linejoin='round'>
 <circle cx='100' cy='100' r='96' stroke-width='1.4' stroke-dasharray='0.5 6'/><circle cx='100' cy='100' r='90' stroke-width='1.6'/>
 <g stroke-width='1.5'>${glyphs(18,82,100,100,4)}</g>
 <path d='M100.0 26.0 L170.4 77.1 L143.5 159.9 L56.5 159.9 L29.6 77.1 Z' stroke-width='1.2' opacity='.8'/><path d='M100.0 26.0 L143.5 159.9 L29.6 77.1 L170.4 77.1 L56.5 159.9 Z' stroke-width='.8' opacity='.35' stroke-dasharray='1 4'/></g></svg>`);
const SHIELD=(f,d)=>uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs>${rough('l',53,1.4)}</defs><g filter='url(#l)' stroke='${INK}' stroke-width='3' stroke-linejoin='round'><path d='M32 4 L54 10 C54 32 48 48 32 60 C16 48 10 32 10 10 Z' fill='${f}'/><path d='M32 4 L54 10 C54 32 48 48 32 60 C40 44 44 28 44 9 Z' fill='${d}' stroke='none'/><path d='M32 14 L44 17 C44 31 40 41 32 49' fill='none' stroke='#fff6' stroke-width='2'/></g></svg>`);
const CORNER=uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs>${rough('c',59,1.8,.05)}</defs><g filter='url(#c)' fill='none' stroke='${BONE}' stroke-linecap='round' opacity='.55'><path d='M6 114 L6 30 C6 14 14 6 30 6 L114 6' stroke-width='2'/><path d='M14 114 L14 36 C14 22 22 14 36 14 L114 14' stroke-width='1' stroke-dasharray='1 5'/><path d='M30 6 C30 26 26 30 6 30' stroke-width='1.6'/><path d='M22 22 C34 18 44 26 40 36 C37 44 28 42 30 34 C31 30 35 30 36 33' stroke-width='1.5'/><circle cx='6' cy='6' r='3' fill='${BONE}' stroke='none'/></g></svg>`);
const CSS=`
/* dotted ink trails: round dots, the walked route in bigger hero-coloured dots */
.pw-paths path.future,.pw-paths path.behind,.pw-paths path.ahead,.pw-paths path.walked{stroke-linecap:round!important}
.pw-paths path.future{stroke:${BONE}!important;stroke-opacity:.55!important;stroke-width:3.2!important;stroke-dasharray:0.1 9!important}
.pw-paths path.behind{stroke:${BONE}!important;stroke-opacity:.2!important;stroke-width:2.6!important;stroke-dasharray:0.1 9!important}
.pw-paths path.ahead{stroke:${BONE}!important;stroke-opacity:.95!important;stroke-width:4.4!important;stroke-dasharray:0.1 10!important}
.pw-paths path.walked{stroke:var(--ink-hero)!important;stroke-opacity:1!important;stroke-width:6.2!important;stroke-dasharray:0.1 10!important}
.pw-paths path.shadow{stroke-linecap:round!important;stroke:#050302!important;stroke-opacity:.6!important;stroke-dasharray:0.1 9!important;stroke-width:5!important}
.pw-paths path.shadow.ahead{stroke-dasharray:0.1 10!important;stroke-width:6.4!important}
.pw-paths path.shadow.walked{stroke-dasharray:0.1 10!important;stroke-width:8.4!important;stroke-opacity:.75!important}
@media (max-aspect-ratio:3999/5000){.pw-paths path.future,.pw-paths path.behind{stroke-width:2.6!important;stroke-dasharray:0.1 7.5!important}.pw-paths path.shadow{stroke-width:4.2!important;stroke-dasharray:0.1 7.5!important}
 .pw-paths path.ahead{stroke-width:3.6!important;stroke-dasharray:0.1 8!important}.pw-paths path.shadow.ahead{stroke-width:5.4!important;stroke-dasharray:0.1 8!important}
 .pw-paths path.walked{stroke-width:5!important;stroke-dasharray:0.1 8!important}.pw-paths path.shadow.walked{stroke-width:7!important;stroke-dasharray:0.1 8!important}}
/* rune ring on each stop you can take, turning slowly like a ward */
#app .map .maprow>.node>.ink-rune{position:absolute;left:50%;top:22px;width:calc(var(--ns) + 30px);aspect-ratio:1;translate:-50% -50%;background:var(--rune) center/contain no-repeat;pointer-events:none;animation:ink-turn 24s linear infinite;z-index:-1}
@keyframes ink-turn{to{rotate:360deg}}
@media (prefers-reduced-motion:reduce){#app .map .maprow>.node>.ink-rune{animation:none}}
/* summoning circle inked under the boss */
#app .map .node.boss>.ink-summon{position:absolute;left:50%;top:50%;width:200%;aspect-ratio:1;translate:-50% -50%;background:var(--summon) center/contain no-repeat;pointer-events:none;z-index:-1;opacity:.7}
#app .map .node.boss>.ink-summon>i{position:absolute;width:14%;aspect-ratio:1;border-radius:50%;translate:-50% -50%;background:var(--pip) center/100% no-repeat;box-shadow:0 0 0 2px #0a0d10;filter:grayscale(1) brightness(.55);opacity:.7}
#app .map .node.boss>.ink-summon>i.on{filter:none;opacity:1}
@media (max-aspect-ratio:3999/5000){#app .map .node.boss>.ink-summon{width:175%}}
#app .map .node.boss>.ink-pips{display:none!important}
#app .map .node.boss *:not(.ink-summon,.ink-summon *,.heal){text-shadow:0 0 3px #000,0 0 6px #000,0 0 10px #000!important}
/* life as a planeswalker loyalty shield */
#app>.top .life::before{background:var(--shield) center/contain no-repeat!important;width:34px!important;height:34px!important}
/* scrollwork in the map corners */
#app .map>.ink-corner{position:absolute;width:clamp(56px,9vw,120px);aspect-ratio:1;background:${CORNER} center/contain no-repeat;pointer-events:none;z-index:0}
#app .map>.ink-corner.tl{left:6px;top:6px}#app .map>.ink-corner.tr{right:6px;top:6px;scale:-1 1}#app .map>.ink-corner.bl{left:6px;bottom:6px;scale:1 -1}#app .map>.ink-corner.br{right:6px;bottom:6px;scale:-1 -1}
`;
const st=document.createElement('style');st.id='ink3-css';st.textContent=CSS;document.head.append(st);
const hero=()=>{try{return run&&run.hero==='W'?'W':'R'}catch{return 'R'}};
const apply=()=>{const h=hero(),c=h==='W'?'#f0d27a':'#e0442f',de=document.documentElement;
 de.style.setProperty('--rune',RUNE(BONE));de.style.setProperty('--summon',SUMMON(BONE));
 de.style.setProperty('--shield',h==='W'?SHIELD('#f3e2a8','#c9a24f'):SHIELD('#d8343a','#9d1f27'));
 for(const n of document.querySelectorAll('#app .map .maprow>.node.open'))if(!n.querySelector('.ink-rune')){const i=document.createElement('i');i.className='ink-rune';i.setAttribute('aria-hidden','true');n.append(i)}
 const b=document.querySelector('#app .map .node.boss');if(b&&!b.querySelector('.ink-summon')){const i=document.createElement('i');i.className='ink-summon';i.setAttribute('aria-hidden','true');const on=[...(b.dataset.cols||'')];i.innerHTML=['W','U','B','R','G'].map((k,j)=>{const a=(-90+72*j)*Math.PI/180;return `<i class='${on.includes(k)?'on':''}' style='left:${50+37*Math.cos(a)}%;top:${50+37*Math.sin(a)}%;--pip:url("${window.PW_MANA[k]}")'></i>`}).join('');b.prepend(i)}
 const m=document.querySelector('#app .map');if(m&&!m.querySelector('.ink-corner'))for(const k of ['tl','tr','bl','br']){const i=document.createElement('i');i.className='ink-corner '+k;i.setAttribute('aria-hidden','true');m.append(i)}};
let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;apply()})}}).observe(document.getElementById('app'),{childList:true,subtree:true});apply();
})();
/* first-row captions keep clear of the stamps above them: when big text or a narrow map brings a neighbour close, the caption steps down toward its own ring */
(()=>{const app=document.getElementById('app');if(!app)return;let raf=0;
 const fit=()=>{raf=0;const ns=[...app.querySelectorAll('.map .maprow>.node')];if(!ns.length)return;const rs=new Map(ns.map(n=>[n,n.getBoundingClientRect()]));
  for(const n of ns){const c=n.querySelector(':scope>.nl');if(!c||!n.classList.contains('open')||n.dataset.r!=='0')continue;
   for(let d=0;d<=16;d+=2){c.style.setProperty('translate',`-50% ${d}px`);const r=c.getBoundingClientRect();
    if(!ns.some(m=>{if(m===n)return false;const o=rs.get(m);return Math.min(o.right,r.right)-Math.max(o.left,r.left)>1&&Math.min(o.bottom,r.bottom)-Math.max(o.top,r.top)>1}))break}}};
 const q=()=>{if(!raf)raf=requestAnimationFrame(fit)};
 new MutationObserver(ms=>{if(ms.some(m=>m.type==='childList'||!m.target.matches('.nl')))q()}).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});addEventListener('resize',q);document.fonts&&document.fonts.ready.then(q);q()})();
