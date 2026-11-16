"""Lantern edition material pass. Run once on the original (35e79f3) asset tree.
Uses original game silhouettes, no external pixel samples. Requires numpy, Pillow."""
import json,re,sys,hashlib
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
AS=ROOT/'assets'
manifest=json.loads((AS/'manifest.json').read_text())
# Equipment swaps require exact byte values, including neutral outlines.
protected={(42,29,46)}
for main,trim in re.findall(r"outfit: \{ main: '(#\w+)', dark: '#\w+', trim: '(#\w+)'", (ROOT/'world.js').read_text()):
 for h in (main,trim):
  c=bytes.fromhex(h[1:])
  for k in (.35,0,-.3,-.55):
   protected.add(tuple(int(np.floor((v+(255-v)*k if k>0 else v*(1+k))+.5)) for v in c))
def transform(p):
 fn=AS/p
 if hashlib.md5(fn.read_bytes()).hexdigest()[:8]!=manifest['v'][p]:raise ValueError('source hash mismatch: '+p)
 im=Image.open(fn).convert('RGBA')
 a=np.array(im); rgb=a[:,:,:3].astype('float32'); alpha=a[:,:,3]
 group=p.split('/')[0]; pixel=group in ('sprite','px')
 lum=rgb@np.array([.28,.58,.14],dtype='float32')
 # Indigo ink in the darkest fold, ochre reflected light, pearl highlights.
 x=lum/255
 val=np.interp(x,[0,.12,.32,.55,.78,1],[6,26,72,149,217,251])
 shadow=(1-x)**2; gold=np.sin(x*np.pi)**2
 sat=.94 if group in ('tile','prop') else 1.09
 c=val[:,:,None]+(rgb-lum[:,:,None])*sat+np.stack([8*gold+7*x,1*gold-3*shadow,17*shadow-14*gold-10*x],axis=2)
 if group=='tile':
  y,u=np.indices(alpha.shape); h,w=y.shape; region=p.split('/')[1].split('_')[0]
  U=u/(w-1)*2*np.pi; V=y/(h-1)*2*np.pi
  if 'water' in p: v=np.maximum(0,np.cos(6*V+1.6*np.sin(2*U)+.8*np.sin(U+V))-.82)*83
  elif region=='factory': v=-5*(np.cos(4*U+2*V)>.97)+3*(np.cos(4*U+2*V+.18)>.97)
  elif region=='harbor': v=4*np.sin(6*V+np.sin(U)) + 2*np.cos(11*V+2*U)
  elif region=='meadow': v=5*np.sin(U+2*V)*np.cos(3*U-V)+3*np.cos(7*U+5*V)
  else: v=5*np.sin(2*U-V+.6*np.cos(3*V))+2*np.cos(5*U+7*V)
  c+=v[:,:,None]
 elif not pixel and group!='vfx':
  # Upper-left bevel inside each original pigment boundary, without changing alpha.
  prev=np.roll(lum,1,axis=0);prev[0]=lum[0]
  left=np.roll(lum,1,axis=1);left[:,0]=lum[:,0]
  c+=np.clip(lum-(prev+left)/2,-18,18)[:,:,None]*.34
 if group=='vfx':
  # Remain neutral so the runtime multiply tint still works; sharpen the falloff.
  c=rgb; a[:,:,3]=np.uint8(np.round(255*(alpha/255)**1.17))
 else:
  out=np.uint8(np.clip(np.round(c),0,255))
  if pixel:
   keys=(a[:,:,0].astype('uint32')<<16)|(a[:,:,1].astype('uint32')<<8)|a[:,:,2]
   keep=np.isin(keys,[(r<<16)|(g<<8)|b for r,g,b in protected]);out[keep]=rgb[keep]
  a[:,:,:3]=out
 a[alpha==0]=0
 im=Image.fromarray(a)
 if p.startswith('ui/skill_') and im.size==(128,128):
  # Engraved opposing corners; retain each element's original central glyph.
  d=ImageDraw.Draw(im)
  for sx,sy in [(1,1),(-1,-1),(-1,1),(1,-1)]:
   tr=lambda pts:[(x if sx==1 else 127-x,y if sy==1 else 127-y) for x,y in pts]
   for pts,col in [([(8,29),(8,16),(16,8),(29,8)],'#513d48'), ([(10,26),(10,17),(17,10),(26,10)],'#c19965'), ([(14,20),(17,17),(20,14)],'#f8d99e')]:
    d.line(tr(pts),fill=col,width=1)
 im.save(fn,compress_level=5)
 return p
if __name__=='__main__':
 if manifest['v'].get('sprite/hero/priest.png') != 'd112b1d3':sys.exit('Run on original 35e79f3 assets before rebuilding the manifest')
 with ProcessPoolExecutor(4) as pool: print('Updated',sum(1 for _ in pool.map(transform,manifest['files'],chunksize=8)),'assets')
