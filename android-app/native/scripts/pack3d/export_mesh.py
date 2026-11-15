# The 3D pack for the app: Randall's Blender pack (mesh_19950.json, already cut from base.obj) lightened for phones and split the
# way the web preview splits it: the body and the torn-off strip above the tear line, each with a front and a back that get the
# wrapper's flat-projected UVs. Writes assets/packs/pack3d-mesh.bin (little-endian).
import json,base64,struct,sys
import numpy as np, fast_simplification as fs
src,out,target=sys.argv[1],sys.argv[2],int(sys.argv[3])
m=json.load(open(src))
pos=np.frombuffer(base64.b64decode(m['pos']),dtype=np.uint16).reshape(-1,3).astype(np.float64)
idx=np.frombuffer(base64.b64decode(m['idx']),dtype=np.uint16).reshape(-1,3).astype(np.int64)
mn=np.array(m['min']);mx=np.array(m['max'])
V=mn+pos/65535*(mx-mn)
H=1.9;s=H/(mx[1]-mn[1])
V=(V-(mn+mx)/2)*s;V[:,2]*=.62
v2,f2=fs.simplify(V.astype(np.float32),idx.astype(np.int32),target_count=target)
v2=v2.astype(np.float64);f2=f2.astype(np.int64)
# smooth normals on the whole pack (as three's computeVertexNormals on the indexed mesh)
fn=np.cross(v2[f2[:,1]]-v2[f2[:,0]],v2[f2[:,2]]-v2[f2[:,0]])
vn=np.zeros_like(v2)
for k in range(3): np.add.at(vn,f2[:,k],fn)
vn/=np.linalg.norm(vn,axis=1,keepdims=True)+1e-12
bmin=v2.min(0);bmax=v2.max(0);W=bmax[0]-bmin[0];HH=bmax[1]-bmin[1]
CUT=bmax[1]-HH*.085
cy=v2[f2].mean(1)[:,1]
front_face=fn[:,2]>=0
def group(sel,back):
    faces=f2[sel];used,inv=np.unique(faces.reshape(-1),return_inverse=True)
    P=v2[used];N=vn[used];u=(P[:,0]-bmin[0])/W;v=(P[:,1]-bmin[1])/HH
    if back:u=1-u
    data=np.concatenate([P,N,u[:,None],v[:,None]],1).astype('<f4')
    return data,inv.reshape(-1).astype('<u2')
groups=[group((cy<=CUT)&front_face,False),group((cy<=CUT)&~front_face,True),group((cy>CUT)&front_face,False),group((cy>CUT)&~front_face,True)]
with open(out,'wb') as f:
    f.write(b'PK3D');f.write(struct.pack('<i',1))
    f.write(struct.pack('<6f',H,CUT,bmin[0],bmax[0],bmin[1],bmax[1]))
    for d,i in groups:
        assert len(d)<65536
        f.write(struct.pack('<ii',len(d),len(i)));f.write(d.tobytes());f.write(i.tobytes())
print('faces',len(f2),'groups',[(len(d),len(i)//3) for d,i in groups],'W',W,'H',HH,'CUT',CUT,'bytes',sum(len(d)*32+len(i)*2 for d,i in groups))
