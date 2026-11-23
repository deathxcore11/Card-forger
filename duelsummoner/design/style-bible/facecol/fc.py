import sys,json,struct,io,numpy as np
from PIL import Image
def load(f):
    b=open(f,'rb').read(); jl=struct.unpack('<I',b[12:16])[0]; J=json.loads(b[20:20+jl]); bo=20+jl; bl=struct.unpack('<I',b[bo:bo+4])[0]; B=b[bo+8:bo+8+bl]
    def acc(i):
        a=J['accessors'][i]; v=J['bufferViews'][a['bufferView']]; off=v.get('byteOffset',0)+a.get('byteOffset',0); k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]; st=v.get('byteStride',0); sz=np.dtype(dt).itemsize*k
        if st and st!=sz:
            raw=np.frombuffer(B,dtype='u1',count=st*(a['count']-1)+sz,offset=off); out=np.stack([np.frombuffer(raw[i*st:i*st+sz].tobytes(),dtype=dt) for i in range(a['count'])])
        else: out=np.frombuffer(B,dtype=dt,count=a['count']*k,offset=off).reshape(-1,k)
        return out
    p=J['meshes'][0]['primitives'][0]; pos=acc(p['attributes']['POSITION']).astype(float); idx=acc(p['indices']).reshape(-1,3).astype(int)
    uv=acc(p['attributes']['TEXCOORD_0']).astype(float) if 'TEXCOORD_0' in p['attributes'] else None
    img=None
    if J.get('images'):
        v=J['bufferViews'][J['images'][0]['bufferView']]; img=np.asarray(Image.open(io.BytesIO(B[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB'))
    return pos,idx,uv,img
def facecols(idx,uv,img):
    h,w=img.shape[:2]; t=uv[idx]; c=t.mean(1,keepdims=True); pts=np.concatenate([c,(c+t)/2],1)  # F,4,2
    u=np.mod(pts[...,0],1); v=np.mod(pts[...,1],1)   # glTF uv: v down from top
    x=np.clip((u*w).astype(int),0,w-1); y=np.clip((v*h).astype(int),0,h-1)
    return img[y,x].astype(float).mean(1)
def render(pos,idx,col,size=420,yaw=0.6,pad=10):
    c,s=np.cos(yaw),np.sin(yaw); P=pos@np.array([[c,0,-s],[0,1,0],[s,0,c]]).T
    mn=P.min(0); mx=P.max(0); sc=(size-2*pad)/max(mx[0]-mn[0],mx[1]-mn[1])
    X=(P[:,0]-(mn[0]+mx[0])/2)*sc+size/2; Y=size/2-(P[:,1]-(mn[1]+mx[1])/2)*sc; Z=P[:,2]
    T=P[idx]; n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]); n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-9
    Lgt=np.array([0.35,0.7,0.6]); sh=0.72+0.28*np.abs(n@Lgt)
    im=np.full((size,size,3),[58,54,66],float); zb=np.full((size,size),-1e9)
    for f in range(len(idx)):
        a,b,cc=idx[f]; xs=X[[a,b,cc]]; ys=Y[[a,b,cc]]; zs=Z[[a,b,cc]]
        x0,x1=int(max(0,np.floor(xs.min()))),int(min(size-1,np.ceil(xs.max()))); y0,y1=int(max(0,np.floor(ys.min()))),int(min(size-1,np.ceil(ys.max())))
        if x1<x0 or y1<y0: continue
        gx,gy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
        d=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2])
        if abs(d)<1e-9: continue
        w0=((ys[1]-ys[2])*(gx-xs[2])+(xs[2]-xs[1])*(gy-ys[2]))/d; w1=((ys[2]-ys[0])*(gx-xs[2])+(xs[0]-xs[2])*(gy-ys[2]))/d; w2=1-w0-w1
        m=(w0>=0)&(w1>=0)&(w2>=0); z=w0*zs[0]+w1*zs[1]+w2*zs[2]
        sub=zb[y0:y1+1,x0:x1+1]; m&=z>sub; sub[m]=z[m]; im[y0:y1+1,x0:x1+1][m]=col[f]*sh[f]
    return im.clip(0,255).astype(np.uint8)
