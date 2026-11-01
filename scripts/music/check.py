import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from tracks import CUES
for cid,fn in CUES.items():
    s,bars,loop=fn(); step=s.bar_ticks//8; clash=0; tot=0; worst={}
    notes=[(n,name) for name,t in s.tracks.items() if t['channel']!=9 for n in t['notes']]
    for t in range(0,bars*s.bar_ticks,step):
        on=[(p,name) for (st,d,p,v),name in notes if st+20<=t<st+d-20 and d>step]
        if len(on)<2: continue
        tot+=1; pcs={}
        for p,name in on: pcs.setdefault(p%12,set()).add(name)
        bad=[(a,b) for a in pcs for b in pcs if (b-a)%12==1 and not (pcs[a]==pcs[b] and len(pcs[a])==1)]
        if bad:
            clash+=1
            for a,b in bad: k=tuple(sorted(pcs[a]|pcs[b])); worst[k]=worst.get(k,0)+1
    top=sorted(worst.items(),key=lambda x:-x[1])[:3]
    print(f"{cid:12} clash {100*clash/max(tot,1):4.1f}%  {top}")
