"""Apply a foot-anchored follow-through pass after renew_art.py, before building manifest."""
from pathlib import Path
import json, numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
spec=json.loads((root/'art/batch5/request.json').read_text())
kinds={a['path']:a['kind'] for a in spec['assets']}
for p in sorted((root/'assets/sprite').rglob('*.png')):
 rel=p.relative_to(root/'assets').as_posix()
 K=spec['kinds'][kinds.get(rel,'hero')]; w,h=K['cell'];foot=K['foot']
 im=np.array(Image.open(p).convert('RGBA'));source=im.copy()
 for act in ('walk','attack','cast','hurt'):
  if act not in K['anims']:continue
  n=K['anims'][act]['n']
  for i in range(n):
   # Travel reference: RO priest walk top at 1,2,4,3,1,2,4,3 with stationary sole.
   dip,lean={'walk':([0,1,3,2,0,1,3,2],[0,1,2,1,0,1,2,1]),'attack':([1,0,1,4,4,2],[-2,-3,0,5,5,1]),'cast':([1,0,2,1],[-1,-2,3,1]),'hurt':([3,1],[-4,-2])}[act]
   idx=round(i*(len(dip)-1)/(n-1)); col=K['col'][act]+i
   for row in range(5):
    dst=im[row*h:(row+1)*h,col*w:(col+1)*w];src=source[row*h:(row+1)*h,col*w:(col+1)*w]
    ys,xs=np.where(src[:,:,3]>0)
    if not len(ys):continue
    top=ys.min();bottom=ys.max();span=max(1,bottom-top)
    frac=np.clip((bottom-np.arange(h))/span,0,1)
    dx=np.rint(-lean[idx]*[0,.72,1,.72,0][row]*K['height']/80*frac).astype(int)
    dx=np.clip(dx,1-xs.min(),w-2-xs.max())
    newtop=top+round(dip[idx]*K['height']/90)
    desty=np.arange(newtop,bottom+1); srcy=np.rint(top+(desty-newtop)*span/max(1,bottom-newtop)).astype(int)
    dst[:]=0
    for y,sy in zip(desty,srcy):dst[y]=np.roll(src[sy],dx[sy],axis=0)
 Image.fromarray(im).save(p,compress_level=5)
print('Updated locomotion, recoil and attacks on',len(list((root/'assets/sprite').rglob('*.png'))),'sheets.')
