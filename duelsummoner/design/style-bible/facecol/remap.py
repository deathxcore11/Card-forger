import sys,json; sys.path.insert(0,'.')
import fc,numpy as np
from PIL import Image
def lin(c): c=c/255.0; return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def oklab(rgb):
    l=lin(np.asarray(rgb,float)); M1=np.array([[0.4122214708,0.5363325363,0.0514459929],[0.2119034982,0.6806995451,0.1073969566],[0.0883024619,0.2817188376,0.6299787005]])
    lms=np.cbrt(l@M1.T); M2=np.array([[0.2104542553,0.7936177850,-0.0040720468],[1.9779984951,-2.4285922050,0.4505937099],[0.0259040371,0.7827717662,-0.8086757660]]); return lms@M2.T
def hx(h): return [int(h[i:i+2],16) for i in (0,2,4)]
R={'skin':['8a5a40','c08a64','e8b890'],'ember':['8a2a20','c8462c','f08040'],'teal':['1f4f5a','2f7f86','6fc0c0'],'leather':['3a2a20','5e4030','8a6448'],'ink':['18161c','2a2632'],'cream':['d8ccb0','f0e8d4'],
 'hair_red':['6a1a1a','a8302a'],'hair_pale':['9fb0d8','d8e0f0'],'canopy':['3f6e4e','5a9a66','74ae72','9cc88a'],'bark':['3e342f','5e5048','7d6a5c'],'belly':['d0835a','e8b890'],'inkblue':['1c2440','2e3f66']}
MODELS={
 'duelist-kael-anim':['hair_red','skin','ember','leather','ink','cream'],
 'duelist-mira-anim':['hair_pale','skin','teal','leather','ink','cream','inkblue'],
 'mon-ember-wyvern-f1-rig':['ember','hair_red','belly','ink'],
 'tree-olive-a':['canopy','bark'],
 'life-butterfly-rig':['ink','ember'],
}
D='/mnt/project-files/duel-summoner/models-in/'
def run(n,wL=0.7,wC=1.5,lift=0.0):
    pos,idx,uv,img=fc.load(D+n+'.glb'); col=fc.facecols(idx,uv,img)
    pal=[]; 
    for r in MODELS[n]:
        for h in R[r]:
            if h not in pal: pal.append(h)
    P=np.array([hx(h) for h in pal],float); PL=oklab(P); A=oklab(col); A[:,0]+=lift
    w=np.array([wL,wC,wC]); d=(((A[:,None]-PL[None])*w)**2).sum(-1); ix=d.argmin(1)
    return pos,idx,col,pal,P,ix
if __name__=='__main__':
    sheets=[]
    for n in MODELS:
        pos,idx,col,pal,P,ix=run(n)
        a=np.concatenate([fc.render(pos,idx,col,yaw=y) for y in (0.5,3.6)],1); b=np.concatenate([fc.render(pos,idx,P[ix],yaw=y) for y in (0.5,3.6)],1)
        Image.fromarray(np.concatenate([a,b],0)).save(n+'-ab.png')
        print(n,{pal[k]:int((ix==k).sum()) for k in range(len(pal))})
