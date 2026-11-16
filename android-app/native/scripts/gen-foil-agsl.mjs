// Writes the app's Magic foil shader (ui/Foil.kt, AGSL_TEMPLATE) from the site's (mtg-foil-shader.js MTG_FOIL_TEMPLATE), so the
// app draws what the site draws: the same template with its #if lines (Foil.compose runs the site's composeFoil rules in Kotlin),
// GLSL vector names as AGSL's, and the one texture read written as the app's map read. The app's own main() (security stamp, maps
// fading in, card alpha) is in Foil.kt beside it. Run: node android-app/native/scripts/gen-foil-agsl.mjs [repo root] [--check]
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:path.join(here,'..','..','..'));
const check=process.argv.includes('--check');
// --golden <file>: the site's composeFoil over Foil.kt's three parts for every recipe (FoilTest.composedLikeTheSite reads it).
const goldenAt=process.argv.indexOf('--golden'),golden=goldenAt>0?process.argv[goldenAt+1]:null;
const {MTG_FOIL_TEMPLATE,composeFoil,foilDefs}=await import(path.join(root,'mtg-foil-shader.js'));
export function toAgsl(t){
 let s=t;
 // The site's uniforms the app declares itself (its own header in Foil.kt).
 s=s.replace(/^uniform vec3 u_star;.*\n/m,'').replace(/^uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;\n/m,'')
  .replace(/^uniform vec4 u_art;uniform vec4 u_text;\n/m,'').replace(/^uniform vec4 u_r1;.*\n/m,'').replace(/^uniform vec4 u_r2;.*\n/m,'');
 if(/^uniform /m.test(s))throw Error('a site uniform is left in the template: '+s.match(/^uniform .*$/m)[0]);
 // Facet foil's seed, read at its texel's centre: the app's maps are read in map pixels.
 const tex='texture2D(u_mask,(floor(vec2(uv.x,1.-uv.y)/u_texel)+.5)*u_texel).r';
 if(s.split(tex).length!==2)throw Error('the facet seed read changed: update gen-foil-agsl.mjs');
 s=s.replace(tex,'float(u_mask.eval(floor(uv*u_map)+.5).r)');
 if(/texture2D|u_texel|gl_FragColor|varying/.test(s))throw Error('a GLSL-only name is left: '+s.match(/texture2D|u_texel|gl_FragColor|varying/)[0]);
 s=s.replace(/\bvec([234])\b/g,'float$1').replace(/\bmat([234])\b/g,'float$1x$1');
 return s;
}
const agsl=toAgsl(MTG_FOIL_TEMPLATE);
const kt=path.join(here,'..','app','src','main','java','dev','cardstashy','nativeplay','ui','Foil.kt');
const src=readFileSync(kt,'utf8'),a='    const val AGSL_TEMPLATE = """\n',b='\n"""\n    // END AGSL_TEMPLATE';
const i=src.indexOf(a),j=src.indexOf(b);if(i<0||j<0)throw Error('Foil.kt has no AGSL_TEMPLATE markers');
if(agsl.includes('"""')||agsl.includes('$'))throw Error('template text cannot sit in a Kotlin raw string');
const next=src.slice(0,i+a.length)+agsl+src.slice(j);
if(check){if(next!==src){console.log('Foil.kt AGSL_TEMPLATE is out of date: run gen-foil-agsl.mjs');process.exit(1);}console.log('Foil.kt AGSL_TEMPLATE matches mtg-foil-shader.js');}
else{writeFileSync(kt,next);console.log('wrote AGSL_TEMPLATE',agsl.length,'chars');}
if(golden){
 const {MTG_FOIL_RECIPES}=await import(path.join(root,'mtg-foil-recipes.js'));
 const now=readFileSync(kt,'utf8'),part=n=>{const m=now.match(new RegExp('const val '+n+' = """([\\s\\S]*?)"""'));if(!m)throw Error('Foil.kt has no '+n);return m[1];};
 const whole=part('AGSL_HEAD')+part('AGSL_TEMPLATE')+part('AGSL_MAIN'),out={};
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES))out[k]=composeFoil(whole,foilDefs(r));
 writeFileSync(golden,JSON.stringify(out));console.log('wrote',Object.keys(out).length,'composed programs to',golden);
}
