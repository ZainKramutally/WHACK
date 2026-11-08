import json,sys,numpy as np
from PIL import Image
d0=sys.argv[1]
d=json.load(open(f'{d0}/log.json'))
L=[r for r in d['log'] if r['T'] is not None]
w=np.array([r['w'] for r in L]); T=np.array([r['T'] for r in L])
fr=d['frames2']
def lum(n):
    im=Image.open(f'{d0}/f{n:04d}.jpg').convert('L').resize((320,180),Image.BILINEAR)
    return np.asarray(im,dtype=np.float32)
prev=None; rows=[]
for f in fr:
    a=lum(f['n'])
    t=float(np.interp(f['w'],w,T,left=np.nan,right=np.nan))
    if prev is not None:
        diff=np.abs(a-prev)
        # 3x3 regions
        reg=[diff[i*60:(i+1)*60, j*107:(j+1)*107].mean() for i in range(3) for j in range(3)]
        rows.append((t,f['n'],diff.mean(),max(reg),int(np.argmax(reg)),a.mean()-prev.mean()))
    prev=a
rows=[r for r in rows if r[0]==r[0] and r[0]<8.5]
m=np.array([r[2] for r in rows])
print('frames',len(rows),'mean diff median',np.median(m),'p95',np.percentile(m,95))
thr=max(4*np.median(m),3)
print('spikes (mean diff > %.1f) :'%thr)
for r in sorted(rows,key=lambda r:-r[2])[:25]:
    print('T=%.3f f%d mean=%.2f maxreg=%.1f(r%d) dLum=%+.2f'%r)
json.dump([list(map(float,r)) for r in rows],open(f'{d0}/diffs.json','w'))
