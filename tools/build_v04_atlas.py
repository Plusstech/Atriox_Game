"""Append normalized, clean-body Atriox frames to the current multi-atlas.
Keeps all earlier characters/pages intact. Re-running replaces only v04 pages.
"""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'art_source/v04'
OUT=ROOT/'public/assets/atlas'
PAGE=2048

def build():
    prepared=json.loads((SRC/'frames.json').read_text(encoding='utf-8'))
    data=json.loads((OUT/'characters.json').read_text(encoding='utf-8'))
    data['textures']=[t for t in data['textures'] if not t['image'].startswith('combat-v04-')]
    origin=data['meta']['origins']['atriox']
    px=round(origin['sourceW']*origin['originX']);py=round(origin['sourceH']*origin['originY'])
    scale=228/prepared['bodyReferenceHeight']
    entries=[]
    for name,cfg in prepared['frames'].items():
        im=Image.open(SRC/'normalized'/(name+'.png')).convert('RGBA')
        bbox=im.getbbox();cropped=im.crop(bbox)
        resized=cropped.resize((round(cropped.width*scale),round(cropped.height*scale)),Image.Resampling.LANCZOS)
        tpx=(prepared['anchor'][0]-bbox[0])*scale;tpy=(prepared['anchor'][1]-bbox[1])*scale
        entries.append((name,resized,round(px-tpx),round(py-tpy)))
    pages=[]
    for name,im,sx,sy in sorted(entries,key=lambda e:(-e[1].height,e[0])):
        w,h=im.size
        if not pages:pages.append({'image':Image.new('RGBA',(PAGE,PAGE)),'frames':[],'x':0,'y':0,'row':h})
        p=pages[-1]
        if p['x']+w+2>PAGE:p['x']=0;p['y']+=p['row']+2;p['row']=h
        if p['y']+h+2>PAGE:pages.append({'image':Image.new('RGBA',(PAGE,PAGE)),'frames':[],'x':0,'y':0,'row':h});p=pages[-1]
        x,y=p['x'],p['y'];p['image'].paste(im,(x,y));p['x']+=w+2;p['row']=max(p['row'],h)
        p['frames'].append({'filename':name,'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':True,'spriteSourceSize':{'x':sx,'y':sy,'w':w,'h':h},'sourceSize':{'w':origin['sourceW'],'h':origin['sourceH']}})
    for i,p in enumerate(pages):
        name=f'combat-v04-{i}.webp'
        height=max(f['frame']['y']+f['frame']['h'] for f in p['frames'])
        p['image'].crop((0,0,PAGE,height)).save(OUT/name,'WEBP',quality=94,method=6)
        data['textures'].append({'image':name,'format':'RGBA8888','size':{'w':PAGE,'h':height},'scale':1,'frames':p['frames']})
    data['meta']['cleanCombat']={'app':'tools/build_v04_atlas.py','normalizedSize':512,'normalizedAnchor':prepared['anchor'],'bodyReferenceHeight':prepared['bodyReferenceHeight'],'atlasScale':scale,'frames':prepared['frames']}
    (OUT/'characters.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
    print(f'Added {len(entries)} clean combat frames on {len(pages)} page(s)')

if __name__=='__main__':build()
