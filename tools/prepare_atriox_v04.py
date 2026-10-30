"""Prepare supplied combat sheets without synthesizing poses or globally keying black.

Source RGB contains a brown backdrop but the supplied alpha already removes it.
Clear near-invisible alpha noise, split connected figures, then use one body scale
and a ground anchor for all 512x512 exports. Run before build_v04_atlas.py.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import sheet_frames as sf
from build_atlases import body_mask, body_height

ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'art_source/v04'
OUT=SRC/'normalized'
INSPECT=SRC/'_inspect'
SPECS={
    'atriox_guard': {'cols':[2,2], 'refs':[0,1,2,3], 'role':'guard', 'source':'Atriox em guarda, espada erguida-5 - Copia.png'},
    'atriox_horizontal': {'cols':[4,4], 'refs':[0,7], 'role':'attack_1', 'source':'Spritesheet de guerreiro com espada transparente-6 - Copia.png'},
    'atriox_return': {'cols':[4,4], 'refs':[6,7], 'role':'attack_2', 'source':'Spritesheet de espadachim em oito poses-7 - Copia.png'},
    'atriox_charge': {'cols':[2,2], 'refs':[0,1,2,3], 'role':'charge_hold', 'source':'Espadachim em spritesheet transparente de quatro quadros-8 - Copia.png'},
    'atriox_ascending': {'cols':[4,4], 'refs':[0,7], 'role':'ascending (Sentença)', 'source':'Spritesheet de ataque ascendente com espada-9 - Copia.png'},
    'atriox_diagonal': {'cols':[4,4], 'refs':[0,7], 'role':'attack_3 (finalizador diagonal)', 'source':'atriox_combo_3.png (pacote PROMPT_MASTER v0.5)'},
}
SIZE=512
# Explicit cuts (normalized 512px coords): tips of the neighbouring pose's blade that
# touch this pose's boots in the source sheet, so no automatic split can separate them.
# atriox_diagonal_05 is NOT cleaned: the stray blade crosses its leg; the animation skips it.
MANUAL_ERASE={('atriox_diagonal',6):[(110,394,174,446)]}
ANCHOR=(256,448)
MARGIN=10

def foot_anchor(a):
    m=body_mask(a)
    ys,xs=np.nonzero(m)
    if len(xs)==0: raise ValueError('No opaque body pixels')
    bottom=float(np.percentile(ys,99.9))
    height=bottom-float(np.percentile(ys,0.1))
    feet=xs[ys>=bottom-height*0.10]
    return (float((np.percentile(feet,0.5)+np.percentile(feet,99.5))/2),bottom)

def clean(a):
    a=a.copy()
    # Brown backdrop is in hidden RGB. Respect the supplied segmentation alpha.
    a[a[:,:,3]<8]=0
    mask=a[:,:,3]>0
    labels,n=ndimage.label(mask,structure=np.ones((3,3)))
    sizes=np.bincount(labels.ravel());sizes[0]=0
    if n:
        main=int(sizes.argmax())
        near=ndimage.distance_transform_edt(labels!=main)
        for label in range(1,n+1):
            if sizes[label]<10 and near[labels==label].min()>8:a[labels==label]=0
    return a

def drop_loose(a,share=0.06):
    """Blade tips of neighbouring poses left after splitting chained figures: small, detached."""
    a=a.copy();m=a[:,:,3]>0
    labels,n=ndimage.label(m,structure=np.ones((3,3)))
    if n<2:return a
    sizes=np.bincount(labels.ravel());sizes[0]=0
    for label in range(1,n+1):
        if sizes[label]<share*sizes.max():a[labels==label]=0
    return a

def prepare():
    OUT.mkdir(parents=True,exist_ok=True);INSPECT.mkdir(exist_ok=True)
    sheets={};provenance={};body_target=256.0
    for name,cfg in SPECS.items():
        path=SRC/(name+'.png')
        rgba=clean(np.array(Image.open(path).convert('RGBA')))
        sf.SHEETS[name]={'cols':cfg['cols'],'expected':sum(cfg['cols']),'split_all':name=='atriox_diagonal'}
        extracted=sf.extract(name,rgba)
        if len(extracted)!=sum(cfg['cols']) or any(a is None for a,_ in extracted):raise ValueError(name)
        frames=[(clean(a),bounds) for a,bounds in extracted]
        if name=='atriox_diagonal':frames=[(drop_loose(a),b) for a,b in frames]
        ref=float(np.median([body_height(frames[i][0]) for i in cfg['refs']]))
        anchors=[foot_anchor(a) for a,_ in frames]
        # One common target across all sheets; even the longest sword must fit.
        for (a,_),(px,py) in zip(frames,anchors):
            y,x=np.nonzero(a[:,:,3]>0)
            for extent,space in [(px-x.min(),ANCHOR[0]-MARGIN),(x.max()-px,SIZE-ANCHOR[0]-MARGIN),(py-y.min(),ANCHOR[1]-MARGIN),(y.max()-py,SIZE-ANCHOR[1]-MARGIN)]:
                if extent>0:body_target=min(body_target,ref*space/extent)
        sheets[name]=(frames,ref,anchors)
        provenance[name]={'sourceName':cfg['source'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':len(frames),'role':cfg['role'],'alphaCleanupThreshold':8}
    # Integer target makes reproducible runtime scale calibration straightforward.
    body_target=int(np.floor(body_target))
    meta={'size':SIZE,'anchor':list(ANCHOR),'bodyReferenceHeight':body_target,'sources':provenance,'frames':{}}
    for name,(frames,ref,anchors) in sheets.items():
        scale=body_target/ref
        board=Image.new('RGB',(4*256,((len(frames)+3)//4)*286),(56,60,67));draw=ImageDraw.Draw(board)
        previews=[];norms=[]
        for i,((a,bounds),(px,py)) in enumerate(zip(frames,anchors)):
            image=Image.fromarray(a).resize((max(1,round(a.shape[1]*scale)),max(1,round(a.shape[0]*scale))),Image.Resampling.LANCZOS)
            ox=int(round(ANCHOR[0]-px*scale));oy=int(round(ANCHOR[1]-py*scale))
            canvas=Image.new('RGBA',(SIZE,SIZE));canvas.alpha_composite(image,(ox,oy))
            arr=np.array(canvas);arr[arr[:,:,3]<8]=0
            for x0,y0,x1,y1 in MANUAL_ERASE.get((name,i),[]):
                # explicit cut: only grey blade pixels inside the box (boots/cloth stay)
                box=arr[y0:y1,x0:x1];rgb=box[:,:,:3].astype(int)
                sat=(rgb.max(2)-rgb.min(2))/np.maximum(rgb.max(2),1)
                box[((sat<0.38)|(rgb.max(2)<95))&(box[:,:,3]>0)]=0
            canvas=Image.fromarray(arr)
            bbox=canvas.getbbox()
            if not bbox or bbox[0]<MARGIN-2 or bbox[2]>SIZE-MARGIN+2 or bbox[1]<MARGIN-2 or bbox[3]>SIZE-MARGIN+2:raise ValueError(f'Clipped frame {name}_{i:02d}: {bbox}')
            filename=f'{name}_{i:02d}.png';canvas.save(OUT/filename);norms.append(canvas)
            phase='loop' if len(frames)==4 else 'windup' if i<3 else 'active' if i<5 else 'recovery'
            meta['frames'][filename[:-4]]={'source':name,'index':i,'sourceBounds':list(bounds),'sourceFootAnchor':[round(px,3),round(py,3)],'scale':round(scale,7),'anchor':list(ANCHOR),'size':[SIZE,SIZE],'bounds':list(bbox),'phase':phase,'durationMs':160 if len(frames)==4 else 60}
            thumb=canvas.resize((256,256));x=(i%4)*256;y=(i//4)*286
            board.paste(thumb,(x,y+22),thumb);draw.text((x+5,y+4),f'{name} {i+1} {phase}',fill='white')
            draw.line((x+120,y+246,x+136,y+246),fill='#60ff90');draw.line((x+128,y+238,x+128,y+254),fill='#60ff90')
            bg=Image.new('RGBA',(SIZE,SIZE),(56,60,67,255));bg.alpha_composite(canvas)
            previews.append(bg.resize((384,384)).convert('RGB'))
        board.save(INSPECT/(name+'.png'))
        previews[0].save(INSPECT/(name+'.gif'),save_all=True,append_images=previews[1:],duration=160 if len(frames)==4 else 85,loop=0)
        # Numeric continuity evidence, with fixed canvas/anchor and no frame reordering.
        silhouettes=[np.array(im.getchannel('A'))>128 for im in norms]
        distances=[int(np.logical_xor(a,b).sum()) for a,b in zip(silhouettes,silhouettes[1:]+silhouettes[:1])]
        provenance[name]['silhouetteChangesIncludingLoop']=distances
        provenance[name]['normalizationScale']=round(scale,7)
    (SRC/'frames.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{len(meta["frames"])} frames normalized to 512x512; common body height {body_target}px')

if __name__=='__main__':prepare()
