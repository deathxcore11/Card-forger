import wave,json,numpy as np,sys
loops=json.load(open('out/loops.json'))
for cid,(s0,e0) in sorted(loops.items()):
    with wave.open(f'wav/{cid}.wav') as w: a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).reshape(-1,2).astype(float)
    S=int(round(s0*48000)); E=int(round(e0*48000)); n=4800
    x=a[S:S+n]; y=a[E:E+n]
    jump=np.abs(a[E-1]-a[S-1]).max()  # sample before seam should match too
    print(cid, 'diff', round(np.sqrt(((x-y)**2).mean())/(np.sqrt((x**2).mean())+1),4), 'len', round(e0-s0,1))
