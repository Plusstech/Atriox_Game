"""Append the supplied v0.3 sheets to the existing multi-atlas. No global black keying.
Requires Pillow, numpy, scipy. Run after build_atlases.py.
"""
import json
import hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import sheet_frames as sf
from build_atlases import pivot_feet, body_height

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art_source/v03'
OUT = ROOT / 'public/assets/atlas'

def build():
    prepared=json.loads((SRC/'prepared/source.json').read_text())
    if prepared['sha256'] != hashlib.sha256((SRC/'toknar_combat.png').read_bytes()).hexdigest():
        raise ValueError('Toknar source changed: regenerate prepared frames with tools/prepare_toknar.py')
    data=json.loads((OUT/'characters.json').read_text())
    data['textures']=[t for t in data['textures'] if not t['image'].startswith('advanced-')]
    # Expand logical Atriox canvas for long swords without changing the existing pixels.
    old=data['meta']['origins']['atriox']; px=round(old['originX']*old['sourceW']); py=round(old['originY']*old['sourceH'])
    for t in data['textures']:
        for f in t['frames']:
            if f['filename'].startswith('atriox_'):
                f['spriteSourceSize']['x']+=400-px; f['spriteSourceSize']['y']+=440-py
                f['sourceSize']={'w':850,'h':520}
    data['meta']['origins']['atriox']={'originX':400/850,'originY':440/520,'sourceW':850,'sourceH':520}
    data['meta']['origins']['toknar']={'originX':0.5,'originY':0.85,'sourceW':650,'sourceH':400}
    entries=[]; manifest={}
    specs={'toknar_move':(4,4),'toknar_combat':(4,4),'atriox_advanced':(6,3),'atriox_advanced_solar':(6,3)}
    for name,(cols,rows) in specs.items():
        rgba=np.array(Image.open(SRC/(name+'.png')).convert('RGBA'))
        sf.SHEETS[name]={'cols':[cols]*rows,'expected':cols*rows}
        if name=='toknar_combat':
            frames=[]
            # Authored row boundaries: the final poses are taller than nominal cells.
            ys=[0,293,533,730,1024]
            for row in range(rows):
                for col in range(cols):
                    x0=round(col*rgba.shape[1]/cols); x1=round((col+1)*rgba.shape[1]/cols)
                    prepared=SRC/'prepared'/f'toknar_combat_{row*cols+col:02d}.png'
                    if not prepared.exists():
                        raise FileNotFoundError('Run tools/prepare_toknar.py once, or restore art_source/v03/prepared')
                    frames.append((np.array(Image.open(prepared).convert('RGBA')),(x0,ys[row],x1,ys[row+1])))
        else:
            frames=sf.extract(name,rgba)
        # Scale per sheet using idle bodies, never the extent of golden/red particles.
        reference=[0,1,2,3] if name=='toknar_move' else [3,4,7] if name=='toknar_combat' else [0,5,6,17]
        scale=(280 if name.startswith('toknar') else 228)/np.median([body_height(frames[i][0]) for i in reference])
        board=Image.new('RGB',(6*240,((len(frames)+5)//6)*250),(65,69,77)); draw=ImageDraw.Draw(board)
        for i,(a,bounds) in enumerate(frames):
            a[a[:,:,3]<8]=0
            # Move sheet faces left, combat sheet faces right except its initial overhead.
            if name=='toknar_move' or (name=='toknar_combat' and i==0): a=a[:,::-1].copy()
            im=Image.fromarray(a).resize((max(1,round(a.shape[1]*scale)),max(1,round(a.shape[0]*scale))),Image.Resampling.LANCZOS)
            a=np.array(im); pivot=pivot_feet(a); bb=im.getbbox(); im=im.crop(bb)
            tpx=pivot[0]-bb[0]; tpy=pivot[1]-bb[1]
            char='toknar' if name.startswith('toknar') else 'atriox'; PX,PY=(325,340) if char=='toknar' else (400,440)
            fname=f'{name}_{i:02d}'
            entries.append((fname,im,round(PX-tpx),round(PY-tpy),char))
            ms = (180 if i<4 else 95 if i<12 else 230) if name=='toknar_move' else [180,150,150,260][i%4] if name=='toknar_combat' else 160 if i%6==0 else 110
            manifest[fname]={'sourceBounds':list(bounds),'pivot':[round(pivot[0],2),round(pivot[1],2)],'scale':round(scale,4),'ms':ms}
            thumb=im.copy(); thumb.thumbnail((230,210)); x=(i%6)*240+5; y=(i//6)*250+25
            board.paste(thumb,(x,y),thumb); draw.text((x,y-20),fname,fill='white')
        (SRC/'_inspect').mkdir(exist_ok=True); board.save(SRC/'_inspect'/f'{name}.png')
    pages=[]
    for name,im,sx,sy,char in sorted(entries,key=lambda e:-e[1].height):
        w,h=im.size
        if not pages or pages[-1]['y']+h+3>2048:
            pages.append({'img':Image.new('RGBA',(2048,2048)),'frames':[],'x':0,'y':0,'row':h})
        p=pages[-1]
        if p['x']+w+3>2048: p['x']=0; p['y']+=p['row']+3; p['row']=h
        if p['y']+h+3>2048:
            pages.append({'img':Image.new('RGBA',(2048,2048)),'frames':[],'x':0,'y':0,'row':h}); p=pages[-1]
        x,y=p['x'],p['y']; p['img'].paste(im,(x,y)); p['x']+=w+3; p['row']=max(p['row'],h)
        sw,sh=(650,400) if char=='toknar' else (850,520)
        p['frames'].append({'filename':name,'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':True,'spriteSourceSize':{'x':sx,'y':sy,'w':w,'h':h},'sourceSize':{'w':sw,'h':sh}})
    for i,p in enumerate(pages):
        filename=f'advanced-{i}.webp'; p['img'].save(OUT/filename,'WEBP',quality=92,method=6)
        data['textures'].append({'image':filename,'format':'RGBA8888','size':{'w':2048,'h':2048},'scale':1,'frames':p['frames']})
    data['meta']['advancedFrames']=manifest
    (OUT/'characters.json').write_text(json.dumps(data,separators=(',',':')))
    (SRC/'frames.json').write_text(json.dumps(manifest,indent=2))
    print(f'v0.3: {len(entries)} frames, {len(pages)} atlas pages')

if __name__=='__main__': build()
