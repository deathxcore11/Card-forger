import subprocess, json, re, os, sys
from concurrent.futures import ThreadPoolExecutor
D=os.path.dirname(os.path.abspath(__file__))
def go(f):
    cid=f[:-4]; src=f'{D}/wav/{f}'
    r=subprocess.run(['ffmpeg','-hide_banner','-i',src,'-af','loudnorm=print_format=json','-f','null','-'],capture_output=True,text=True).stderr
    j=json.loads(r[r.rindex('{'):r.rindex('}')+1]); I=float(j['input_i']); tp=float(j['input_tp'])
    target=-16.0 if cid in ('MUS-PW-11','MUS-PW-12','MUS-TBL-06','MUS-TBL-07') else -19.0
    gain=min(target-I, -1.0-tp)
    for ext,args in (('ogg',['-c:a','libopus','-b:a','64k']),('m4a',['-c:a','aac','-b:a','96k','-movflags','+faststart'])):
        subprocess.run(['ffmpeg','-v','error','-y','-i',src,'-af',f'volume={gain:.2f}dB','-ar','48000' if ext=='ogg' else '44100',*args,'-map_metadata','-1',f'{D}/out/{cid}.{ext}'],check=True)
    return cid, round(I,1), round(gain,1)
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(go, sorted(os.listdir(f'{D}/wav'))): print(*r)
