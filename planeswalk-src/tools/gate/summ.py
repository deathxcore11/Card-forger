import json,collections,sys,re
r=json.load(open(sys.argv[1]))
by=collections.defaultdict(lambda:collections.defaultdict(list))
tot=0
for k,fs in r.items():
    for f in fs:
        tot+=1
        d={x:y for x,y in f.items() if x not in('rule','px','x','r','top','bottom','size','dx','dy','insetDiff','left','right','errors')}
        by[f['rule']][json.dumps(d,ensure_ascii=False)[:150]].append(k)
print('TOTAL',tot)
for rule,m in sorted(by.items(),key=lambda x:-sum(len(v) for v in x[1].values())):
    print('==',rule,sum(len(v) for v in m.values()),'unique',len(m))
    for d,v in sorted(m.items(),key=lambda x:-len(x[1]))[:int(sys.argv[2]) if len(sys.argv)>2 else 10]:
        sizes=sorted(set(k.split('@')[1] for k in v));routes=sorted(set(k.split('@')[0] for k in v))
        print('  ',len(v),d,'|',','.join(sizes),'|',','.join(routes)[:150])
