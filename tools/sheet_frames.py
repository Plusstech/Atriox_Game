"""
Detecção de frames por componentes conectados (não confia na grade nominal).

- Máscara: alpha >= ALPHA_MIN (descarta o ruído de alpha 1–7 presente nas folhas).
- Dilatação moderada une partes do mesmo frame (espada, mechas, faíscas próximas).
- Componentes pequenos (partículas soltas) são anexados ao frame grande mais próximo.
- Frames são ordenados em linhas (por y) e colunas (por x).

Uso direto: python tools/sheet_frames.py  → gera pranchas de inspeção em art_source/v02/_inspect/
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art_source", "v02")

ALPHA_MIN = 8

# Organização nominal (colunas por linha, linhas). Os cortes reais são ajustados
# aos "vales" de densidade perto das divisões nominais.
SHEETS = {
    "atriox_run": {"cols": [4, 4, 4], "expected": 12},
    "atriox_combat": {"cols": [4, 4, 4, 4], "expected": 16},
    "atriox_solar": {"cols": [5, 4, 4, 4], "expected": 17},
    "apollon_blessing": {"cols": [3, 3], "expected": 6},
    "caim_blood": {"cols": [4, 4, 4], "expected": 12},
    "caim_move": {"cols": [6, 6, 6, 6], "expected": 24},
    "wyvern": {"cols": [4, 4, 4], "expected": 12},
}


def load(name):
    return np.array(Image.open(os.path.join(SRC, name + ".png")).convert("RGBA"))


def _valleys(prof, n, win_frac=0.3):
    L = len(prof)
    cuts = [0]
    for k in range(1, n):
        c = int(L * k / n)
        win = int(L / n * win_frac)
        a, b = max(1, c - win), min(L - 1, c + win)
        seg = prof[a:b]
        idx = np.where(seg <= seg.min() + 1)[0]
        cuts.append(a + int(np.median(idx)))
    cuts.append(L)
    return cuts


def cells(name, rgba):
    cfg = SHEETS[name]
    solid = rgba[:, :, 3] >= 128
    rows = len(cfg["cols"])
    rc = _valleys(solid.sum(1), rows)
    out = []
    for r in range(rows):
        band = solid[rc[r]:rc[r + 1]]
        cc = _valleys(band.sum(0), cfg["cols"][r])
        for c in range(len(cc) - 1):
            out.append((cc[c], rc[r], cc[c + 1], rc[r + 1]))
    return out


def extract(name, rgba=None):
    """
    Retorna [(rgba_frame_cheio, bbox)] em ordem de leitura.
    Cada componente conectado pertence ao frame onde está ≥85% da sua massa
    (inteiro, mesmo que ultrapasse a célula); componentes realmente fundidos
    entre frames são divididos pela célula de cada pixel.
    """
    if rgba is None:
        rgba = load(name)
    h, w = rgba.shape[:2]
    cs = cells(name, rgba)
    cell_id = np.zeros((h, w), np.int32)
    for i, (x0, y0, x1, y1) in enumerate(cs):
        cell_id[y0:y1, x0:x1] = i
    mask = rgba[:, :, 3] >= ALPHA_MIN
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    owner = cell_id.copy()
    weight = rgba[:, :, 3].astype(np.float64)
    # massa por (componente, célula)
    flat_l = lab[mask]
    flat_c = cell_id[mask]
    flat_w = weight[mask]
    key = flat_l.astype(np.int64) * len(cs) + flat_c
    sums = np.bincount(key, weights=flat_w, minlength=(n + 1) * len(cs)).reshape(n + 1, len(cs))
    tot = sums.sum(1)
    best = sums.argmax(1)
    share = np.where(tot > 0, sums.max(1) / np.maximum(tot, 1e-9), 0)
    whole = share >= 0.85
    comp_owner = np.where(whole, best, -1)
    lo = comp_owner[lab]
    owner = np.where((lab > 0) & (lo >= 0), lo, cell_id)
    # componentes fundidos entre frames: separa a "ponte" por erosão + vizinho mais próximo
    objs = ndimage.find_objects(lab)
    for ci in np.nonzero(~whole)[0]:
        if ci == 0 or tot[ci] < 2000:
            continue
        sl = objs[ci - 1]
        comp = lab[sl] == ci
        cid = cell_id[sl]
        markers = None
        for it in range(2, 26, 2):
            er = ndimage.binary_erosion(comp, iterations=it)
            ml, mn = ndimage.label(er, structure=np.ones((3, 3)))
            if mn >= 2:
                sizes = ndimage.sum(er, ml, range(1, mn + 1))
                keep = [k + 1 for k, sz in enumerate(sizes) if sz >= 0.04 * comp.sum()]
                if len(keep) >= 2:
                    markers = (ml, keep)
                    break
        if markers is None:
            continue
        ml, keep = markers
        piece_cell = {}
        for k in keep:
            cvals = cid[ml == k]
            piece_cell[k] = int(np.bincount(cvals).argmax())
        seed = np.isin(ml, keep)
        _, (iy, ix) = ndimage.distance_transform_edt(~seed, return_indices=True)
        nearest = ml[iy, ix]
        sub_owner = owner[sl]
        for k, c in piece_cell.items():
            sub_owner[comp & (nearest == k)] = c
        owner[sl] = sub_owner
    frames = []
    for i in range(len(cs)):
        sel = mask & (owner == i)
        ys, xs = np.nonzero(sel)
        if len(xs) == 0:
            frames.append((None, cs[i]))
            continue
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        fr = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        sub = rgba[y0:y1, x0:x1].copy()
        sub[~sel[y0:y1, x0:x1]] = 0
        fr[:] = sub
        frames.append((fr, (int(x0), int(y0), int(x1), int(y1))))
    return frames


def detect(name, rgba=None):
    return [b for _, b in extract(name, rgba)]


def inspect(name):
    rgba = load(name)
    boxes = detect(name, rgba)
    h, w = rgba.shape[:2]
    bg = Image.new("RGBA", (w, h), (90, 90, 96, 255))
    bg.alpha_composite(Image.fromarray(rgba))
    d = ImageDraw.Draw(bg)
    for i, b in enumerate(boxes):
        d.rectangle(b, outline=(0, 255, 120, 255), width=2)
        d.rectangle((b[0], b[1], b[0] + 34, b[1] + 22), fill=(0, 0, 0, 255))
        d.text((b[0] + 4, b[1] + 4), str(i), fill=(255, 255, 0, 255))
    os.makedirs(os.path.join(SRC, "_inspect"), exist_ok=True)
    bg.convert("RGB").resize((w // 2, h // 2)).save(os.path.join(SRC, "_inspect", name + ".png"))
    exp = SHEETS[name]["expected"]
    print(f"{name:18s} {len(boxes):2d} frames (esperado {exp}) {'OK' if len(boxes) == exp else 'VERIFICAR'}")
    return boxes


if __name__ == "__main__":
    for n in (sys.argv[1:] or SHEETS.keys()):
        inspect(n)
