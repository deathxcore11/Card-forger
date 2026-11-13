// Light handling for the scanner: makes a frame look the same whether the room is dim, warm or
// bright, before anything is measured on it. Pure pixel maths (RGBA arrays), no DOM.

// Stretches a frame so its darkest and brightest parts span the full range, and removes a colour
// cast (each channel is stretched on its own, so a warm lamp's orange is pulled back to neutral).
// The limits come from the 2nd and 98th percentile, so a lamp's reflection or a black sleeve
// cannot set them. Returns a new RGBA array; the input is untouched.
export function levelFrame(rgba,w,h,{low=.02,high=.98,cast=true}={}){
 const n=w*h,hist=[new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)];
 for(let i=0;i<n;i++){const j=i*4;hist[0][rgba[j]]++;hist[1][rgba[j+1]]++;hist[2][rgba[j+2]]++;}
 const at=(hgram,q)=>{let c=0;const want=q*n;for(let v=0;v<256;v++){c+=hgram[v];if(c>=want)return v;}return 255;};
 let lo=hist.map(x=>at(x,low)),hi=hist.map(x=>at(x,high));
 if(!cast){const l=Math.min(...lo),u=Math.max(...hi);lo=[l,l,l];hi=[u,u,u];}
 const lut=lo.map((l,c)=>{const span=Math.max(24,hi[c]-l),t=new Uint8ClampedArray(256);for(let v=0;v<256;v++)t[v]=(v-l)*255/span;return t;});
 const out=new Uint8ClampedArray(rgba.length);
 for(let i=0;i<n;i++){const j=i*4;out[j]=lut[0][rgba[j]];out[j+1]=lut[1][rgba[j+1]];out[j+2]=lut[2][rgba[j+2]];out[j+3]=255;}
 return out;
}
