"""Optional preparation step for the opaque combat sheet.
Uses rembg's u2netp model, preserving RGB including black hair/leather.
Prepared RGBA frames are checked in so the normal atlas build needs no model/network.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image
from rembg import new_session, remove

root=Path(__file__).resolve().parent.parent/'art_source/v03'
out=root/'prepared';out.mkdir(exist_ok=True)
source=root/'toknar_combat.png'
im=Image.open(source).convert('RGBA')
session=new_session('u2netp')
ys=[0,293,533,730,1024]
for r in range(4):
    for c in range(4):
        frame=im.crop((c*384,ys[r],(c+1)*384,ys[r+1]))
        remove(frame,session=session).save(out/f'toknar_combat_{r*4+c:02d}.png')
(out/'source.json').write_text(json.dumps({'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'model':'u2netp','method':'foreground alpha segmentation; RGB preserved','rows':ys},indent=2))
print('16 prepared Toknar frames')
