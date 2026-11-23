import sys,json; sys.path.insert(0,'.')
import fc,numpy as np
from PIL import Image
from remap import oklab,hx,R,D
def kmeans(X,k,it=40,seed=3):
    rng=np.random.default_rng(seed); C=[X[rng.integers(len(X))]]
    for _ in range(k-1):
        d=np.min([((X-c)**2).sum(1) for c in C],0); C.append(X[rng.choice(len(X),p=d/d.sum())])
    C=np.array(C)
    for _ in range(it):
        lab=((X[:,None]-C[None])**2).sum(-1).argmin(1)
        for j in range(k):
            if (lab==j).any(): C[j]=X[lab==j].mean(0)
    return lab
CFG={
 'duelist-kael-anim':dict(k=9,ramps=['hair_red','skin','ember','leather','ink','cream'],ov={1:'skin',3:'hair_red',8:'leather',6:'cream'},bias={1:1}),
 'duelist-mira-anim':dict(k=9,ramps=['hair_pale','skin','teal','leather','ink','cream','inkblue'],ov={8:'cream'},bias={1:1}),
 'mon-ember-wyvern-f1-rig':dict(k=5,ramps=['ember','hair_red','belly'],ov={}),
 'tree-olive-a':dict(k=3,ramps=['canopy','bark'],ov={}),
 'life-butterfly-rig':dict(k=3,ramps=['ink','ember'],ov={}),
}
def run(n,cfg=None,verbose=True):
    cfg=cfg or CFG[n]; pos,idx,uv,img=fc.load(D+n+'.glb'); col=fc.facecols(idx,uv,img); A=oklab(col)
    lab=kmeans(A*np.array([0.5,2,2]),cfg['k']); out=np.zeros((len(idx),3)); hexout=['']*len(idx); info=[]
    for j in range(cfg['k']):
        m=lab==j
        if not m.any(): continue
        mean=A[m].mean(0); best=None
        for r in cfg['ramps']:
            RL=oklab(np.array([hx(h) for h in R[r]],float)); d=(((RL-mean)*np.array([0.5,1.5,1.5]))**2).sum(1).min()
            if best is None or d<best[0]: best=(d,r)
        r=cfg['ov'].get(j,best[1]); H=sorted(R[r],key=lambda h:oklab(np.array(hx(h),float))[0]); RL=np.array([oklab(np.array(hx(h),float))[0] for h in H])
        L=A[m,0]; base=int(np.argmin(np.abs(RL-np.median(L))))+cfg.get('bias',{}).get(j,0); z=(L-np.median(L))/(L.std()+1e-6)
        st=np.clip(base+np.round(z*cfg.get('spread',0.7)).astype(int),0,len(H)-1)
        ii=np.where(m)[0]
        for a,s in zip(ii,st): out[a]=hx(H[s]); hexout[a]=H[s]
        info.append((j,int(m.sum()),'%02x%02x%02x'%tuple(col[m].mean(0).astype(int)),r))
    if verbose:
        for i in info: print(' ',n,i)
    return pos,idx,col,out,hexout,lab
if __name__=='__main__':
    for n in (sys.argv[1:] or CFG):
        pos,idx,col,out,hexout,lab=run(n)
        a=np.concatenate([fc.render(pos,idx,col,yaw=y) for y in (0.5,3.6)],1); b=np.concatenate([fc.render(pos,idx,out,yaw=y) for y in (0.5,3.6)],1)
        Image.fromarray(np.concatenate([a,b],0)).save(n+'-ab.png')
    from PIL import Image as I
    for g,ns in (('ab1',['duelist-kael-anim','duelist-mira-anim']),('ab2',['mon-ember-wyvern-f1-rig','tree-olive-a','life-butterfly-rig'])):
        ims=[I.open(n+'-ab.png') for n in ns]; s=I.new('RGB',(840*len(ims),840))
        for k,i in enumerate(ims): s.paste(i,(k*840,0))
        s.save(g+'.png')
