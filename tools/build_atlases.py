"""
Pipeline reproduzível: folhas de arte (art_source/v02) → atlas Phaser (public/assets/atlas).

Uso:  python tools/build_atlases.py            (gera atlas + pranchas de inspeção)
Requer: Pillow, NumPy, SciPy.

Decisões:
- Recorte por componentes conectados com posse por massa (tools/sheet_frames.py).
- Todos os frames normalizados para OLHAR PARA A DIREITA (flip quando necessário).
- Escala por FOLHA, calculada pela altura do CORPO em frames de referência
  (nunca pelo bounding box total dos efeitos: uma explosão não encolhe o personagem).
- Pivô por frame nos pés: x = centróide do torso (sem efeitos e sem lâmina),
  y = ponto mais baixo do corpo (botas). Personagens voadores: pivô no centróide.
- Cada personagem tem um "sourceSize" fixo com o pivô no mesmo ponto em todos os
  frames, e os frames são recortados (trim) no atlas: a origem do sprite é
  constante e trocar de frame nunca teletransporta o personagem.
- Ruído de alpha < 8 é zerado (as folhas têm halos quase invisíveis de alpha 1–7).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet_frames import extract  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "atlas")
INSPECT = os.path.join(ROOT, "art_source", "v02", "_inspect")
PAGE = 2048
PAD = 2

# Altura-alvo (px no atlas) de um personagem EM PÉ. Exibição no jogo: escala definida no TS.
TARGET = {"atriox": 228, "caim": 238, "wyvern": 190, "apollon": 228}

# --------------------------------------------------------------------------------------
# Frames usados (sheet, índice, flip para olhar à direita). Frames não listados não entram.
# --------------------------------------------------------------------------------------
CHARS = {
    "atriox": {
        "ref": [("atriox_combat", 7), ("atriox_combat", 3)],  # em pé (escala da folha combat)
        "sheets": {
            "atriox_run": {"flip": True, "frames": list(range(12)), "ref_ratio": 0.92},
            "atriox_combat": {
                "flip_map": {0: True, 1: True, 2: True, 3: False, 4: True, 5: False, 6: False, 7: False,
                             8: True, 9: True, 10: False, 11: True, 12: True, 13: True, 14: False, 15: True},
                "frames": list(range(16)),
            },
            "atriox_solar": {
                "flip_map": {0: False, 1: False, 2: False, 3: False, 4: False, 5: False, 6: False, 7: False, 8: False,
                             9: False, 10: False, 11: False, 12: True, 13: False, 14: False, 15: False, 16: False},
                "frames": [0, 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16],
                "ref": [4],
            },
        },
    },
    "caim": {
        "ref": [("caim_move", 23), ("caim_move", 17)],
        "sheets": {
            "caim_move": {"flip": False, "frames": list(range(24))},
            "caim_blood": {"flip": False, "frames": list(range(12)), "ref": [0, 4]},
        },
    },
    "wyvern": {
        "ref": [("wyvern", 0), ("wyvern", 7), ("wyvern", 11)],
        "flying": True,
        "sheets": {"wyvern": {"flip": True, "frames": list(range(12))}},
    },
    "apollon": {
        # cena da bênção: quadros compostos (Atriox + Apollon). Pivô = pés do Atriox.
        "ref": [("apollon_blessing", 5)],
        "composite": True,
        "sheets": {"apollon_blessing": {"flip": False, "frames": list(range(6))}},
    },
}

# VFX independentes (sem pivô de pés): crescente solar
FX = {"fx_solar_crescent": ("atriox_solar", 3, False)}

# Correções manuais de pivô (px na imagem final, relativos ao pivô automático)
PIVOT_FIX = {}

# --------------------------------------------------------------------------------------


def clean(a):
    a = a.copy()
    a[a[:, :, 3] < 8] = 0
    return a


def effect_mask(a):
    """Pixels de efeito: dourado/branco muito brilhante e saturado, ou vermelho de sangue/brilho."""
    r, g, b = [a[:, :, i].astype(np.int32) for i in range(3)]
    lum = (r * 3 + g * 6 + b) / 10
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1)
    gold_glow = (lum > 175) & (r > 200) & (g > 150)
    blood = (r > 110) & (g < 50) & (b < 60) & (sat > 0.6)
    semi = a[:, :, 3] < 170
    return gold_glow | blood | semi


def metal_mask(a):
    r, g, b = [a[:, :, i].astype(np.int32) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1)
    return (sat < 0.16) & (mx > 105)


def body_mask(a):
    return (a[:, :, 3] >= 200) & ~effect_mask(a) & ~metal_mask(a)


def body_height(a):
    m = body_mask(a)
    # remove ilhas pequenas (partes de efeitos com cor de corpo)
    lab, n = ndimage.label(m)
    if n == 0:
        return a.shape[0]
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 0.02 * m.sum()])
    ys = np.nonzero(keep)[0]
    return ys.max() - ys.min() + 1


def pivot_feet(a, composite=False):
    m = body_mask(a)
    h, w = m.shape
    if composite:
        m[:, int(w * 0.5):] = False  # Atriox fica à esquerda nos quadros da bênção
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 0.03 * m.sum()])
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return w / 2, h - 1
    top, bot = ys.min(), ys.max()
    band = (ys > top + (bot - top) * 0.25) & (ys < top + (bot - top) * 0.65)
    px = float(np.median(xs[band])) if band.any() else float(np.median(xs))
    # pés: percentil alto (ignora um pixel isolado)
    py = float(np.percentile(ys, 99.6))
    return px, py


def pivot_center(a):
    m = body_mask(a)
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return a.shape[1] / 2, a.shape[0] / 2
    return float(np.median(xs)), float(np.median(ys))


def resize(a, s):
    im = Image.fromarray(a, "RGBA")
    return np.array(im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS))


def trim(a):
    ys, xs = np.nonzero(a[:, :, 3] > 0)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return a[y0:y1, x0:x1], x0, y0


def drop_far_fragments(a):
    """Remove lascas pequenas e distantes do corpo principal (sobras de frames vizinhos)."""
    m = a[:, :, 3] > 0
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n <= 1:
        return a
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    dist = ndimage.distance_transform_edt(lab != main)
    out = a.copy()
    for i, s in enumerate(sizes, start=1):
        if i == main:
            continue
        if s < 0.02 * sizes.max() and dist[lab == i].min() > 45:
            out[lab == i] = 0
    return out


# correção manual de recorte: solar linha 0 — o arco do frame 1 sobrepõe o frame 2
def solar_override(frames, rgba):
    from sheet_frames import load  # noqa
    full = rgba
    a1, b1 = frames[1]
    a2, b2 = frames[2]
    # reconstrói frames 1 e 2 pela linha vertical x=700 na faixa y<290
    y1 = 290
    region = full[:y1].copy()
    region[region[:, :, 3] < 8] = 0
    left = region.copy()
    left[:, 712:] = 0
    left[:, :300] = 0
    right = region.copy()
    right[:, :712] = 0
    right[:, 936:] = 0
    out = []
    for part in (left, right):
        ys, xs = np.nonzero(part[:, :, 3] > 0)
        x0, yy0, x1, yy1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        out.append((part[yy0:yy1, x0:x1], (x0, yy0, x1, yy1)))
    frames[1], frames[2] = out[0], out[1]
    return frames


def get_frames(sheet):
    from sheet_frames import load
    rgba = load(sheet)
    fr = extract(sheet, rgba)
    if sheet == "atriox_solar":
        fr = solar_override(fr, rgba)
    return fr


def build():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(INSPECT, exist_ok=True)
    cache = {}

    def sheet_frames(name):
        if name not in cache:
            cache[name] = [clean(f) if f is not None else None for f, _ in get_frames(name)]
        return cache[name]

    entries = []  # (char, name, img, pivot)
    meta_chars = {}
    for char, cfg in CHARS.items():
        target = TARGET[char]
        # escala base pela referência
        ref_h = np.median([body_height(sheet_frames(s)[i]) for s, i in cfg["ref"]])
        base_sheet = cfg["ref"][0][0]
        sheet_scale = {}
        for sname, scfg in cfg["sheets"].items():
            if sname == base_sheet:
                sheet_scale[sname] = target / ref_h
            elif "ref" in scfg:
                h = np.median([body_height(sheet_frames(sname)[i]) for i in scfg["ref"]])
                sheet_scale[sname] = target / h
            else:
                # sem quadro em pé: mediana dos frames × razão esperada de altura da pose
                hs = [body_height(sheet_frames(sname)[i]) for i in scfg["frames"]]
                sheet_scale[sname] = target * scfg.get("ref_ratio", 1.0) / np.median(hs)
        print(char, {k: round(v, 3) for k, v in sheet_scale.items()})

        for sname, scfg in cfg["sheets"].items():
            frs = sheet_frames(sname)
            for i in scfg["frames"]:
                a = frs[i]
                if a is None:
                    print("  frame vazio", sname, i)
                    continue
                a = drop_far_fragments(a)
                flip = scfg.get("flip_map", {}).get(i, scfg.get("flip", False))
                if flip:
                    a = a[:, ::-1].copy()
                a = resize(a, sheet_scale[sname])
                if cfg.get("flying"):
                    px, py = pivot_center(a)
                else:
                    px, py = pivot_feet(a, cfg.get("composite", False))
                fname = f"{sname}_{i:02d}"
                fx, fy = PIVOT_FIX.get(fname, (0, 0))
                entries.append((char, fname, a, (px + fx, py + fy)))
        meta_chars[char] = {"sheetScale": {k: round(float(v), 4) for k, v in sheet_scale.items()}}

    for fname, (sname, i, flip) in FX.items():
        a = drop_far_fragments(sheet_frames(sname)[i])
        if flip:
            a = a[:, ::-1].copy()
        s = meta_chars["atriox"]["sheetScale"][sname]
        a = resize(a, s)
        entries.append(("fx", fname, a, (a.shape[1] / 2, a.shape[0] / 2)))

    # sourceSize fixo por personagem com o pivô no mesmo ponto
    trimmed = []
    ext = {}
    for char, name, a, (px, py) in entries:
        t, ox, oy = trim(a)
        tpx, tpy = px - ox, py - oy
        e = ext.setdefault(char, [0, 0, 0, 0])
        e[0] = max(e[0], tpx)
        e[1] = max(e[1], t.shape[1] - tpx)
        e[2] = max(e[2], tpy)
        e[3] = max(e[3], t.shape[0] - tpy)
        trimmed.append((char, name, t, tpx, tpy))
    src = {c: (int(np.ceil(e[0] + e[1])) + 2, int(np.ceil(e[2] + e[3])) + 2, int(np.ceil(e[0])) + 1, int(np.ceil(e[2])) + 1) for c, e in ext.items()}

    # empacotamento em prateleiras (multi-página)
    trimmed.sort(key=lambda t: -t[2].shape[0])
    pages = []  # [img, frames, shelf_y, shelf_h, cursor_x]
    placed = []
    for char, name, t, tpx, tpy in trimmed:
        h, w = t.shape[:2]
        ok = False
        for pi, pg in enumerate(pages):
            if pg["x"] + w + PAD <= PAGE and pg["y"] + h + PAD <= PAGE and h <= pg["sh"]:
                ok = True
            elif pg["y"] + pg["sh"] + h + PAD <= PAGE and w + PAD <= PAGE:
                pg["y"] += pg["sh"] + PAD
                pg["x"] = 0
                pg["sh"] = h
                ok = True
            if ok:
                break
        if not ok:
            pages.append({"x": 0, "y": 0, "sh": h, "img": np.zeros((PAGE, PAGE, 4), np.uint8), "frames": []})
            pi, pg = len(pages) - 1, pages[-1]
        x, y = pg["x"], pg["y"]
        pg["img"][y:y + h, x:x + w] = t
        pg["x"] += w + PAD
        sw, sh_, PX, PY = src[char]
        pg["frames"].append({
            "filename": name,
            "frame": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": int(round(PX - tpx)), "y": int(round(PY - tpy)), "w": int(w), "h": int(h)},
            "sourceSize": {"w": sw, "h": sh_},
        })
        placed.append((char, name, pi))

    textures = []
    for pi, pg in enumerate(pages):
        used_h = max(f["frame"]["y"] + f["frame"]["h"] for f in pg["frames"])
        used_w = max(f["frame"]["x"] + f["frame"]["w"] for f in pg["frames"])
        img = Image.fromarray(pg["img"][:used_h, :used_w], "RGBA")
        fn = f"characters-{pi}.webp"
        # WebP com alpha: ~8x menor que PNG; alpha sem perdas, cor com qualidade alta
        img.save(os.path.join(OUT, fn), "WEBP", quality=90, alpha_quality=100, method=6)
        textures.append({"image": fn, "format": "RGBA8888", "size": {"w": used_w, "h": used_h}, "scale": 1, "frames": pg["frames"]})
        print(f"página {pi}: {used_w}x{used_h}, {len(pg['frames'])} frames, {os.path.getsize(os.path.join(OUT, fn)) // 1024} KB")

    origins = {c: {"originX": round(PX / sw, 5), "originY": round(PY / sh_, 5), "sourceW": sw, "sourceH": sh_} for c, (sw, sh_, PX, PY) in src.items()}
    run_order = order_cycle([e for e in trimmed if e[1].startswith("atriox_run_")])
    caim_run = [f"caim_move_{i:02d}" for i in range(6)]
    meta = {
        "textures": textures,
        "meta": {"app": "tools/build_atlases.py", "version": "1", "origins": origins, "chars": meta_chars, "atrioxRunOrder": run_order, "caimRunOrder": caim_run},
    }
    with open(os.path.join(OUT, "characters.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, separators=(",", ":"))
    inspect_boards(trimmed, src)


def order_cycle(run_entries):
    """
    Ordena os frames de corrida pela pose das pernas: minimiza a diferença entre
    frames consecutivos (ciclo fechado) usando a silhueta da metade inferior.
    """
    feats = []
    names = []
    for char, name, t, tpx, tpy in run_entries:
        h = t.shape[0]
        canvas = np.zeros((160, 200), np.float32)
        # recorte inferior ancorado no pivô (pés), metade inferior do corpo
        a = t[:, :, 3] > 128
        y0 = int(tpy - 150)
        x0 = int(tpx - 100)
        for yy in range(160):
            sy = y0 + yy
            if 0 <= sy < h:
                row = a[sy]
                for xx in range(0, 200, 2):
                    sx = x0 + xx
                    if 0 <= sx < row.shape[0] and row[sx]:
                        canvas[yy, xx] = 1
        feats.append(ndimage.gaussian_filter(canvas, 3).ravel())
        names.append(name)
    n = len(feats)
    D = np.array([[np.abs(feats[i] - feats[j]).sum() for j in range(n)] for i in range(n)])
    best = None
    for start in range(n):
        tour = [start]
        left = set(range(n)) - {start}
        while left:
            nxt = min(left, key=lambda j: D[tour[-1], j])
            tour.append(nxt)
            left.remove(nxt)
        improved = True
        while improved:
            improved = False
            for i in range(1, n - 1):
                for j in range(i + 1, n):
                    a, b = tour[i - 1], tour[i]
                    c, d = tour[j], tour[(j + 1) % n]
                    if D[a, c] + D[b, d] < D[a, b] + D[c, d] - 1e-6:
                        tour[i:j + 1] = tour[i:j + 1][::-1]
                        improved = True
        cost = sum(D[tour[k], tour[(k + 1) % n]] for k in range(n))
        if best is None or cost < best[0]:
            best = (cost, tour)
    tour = best[1]
    print("ordem da corrida:", [names[k] for k in tour])
    return [names[k] for k in tour]


def inspect_boards(trimmed, src):
    """Pranchas com o pivô marcado (cruz) para conferência visual."""
    by_char = {}
    for char, name, t, tpx, tpy in trimmed:
        by_char.setdefault(char, []).append((name, t, tpx, tpy))
    for char, items in by_char.items():
        items.sort(key=lambda x: x[0])
        cell = 220
        cols = 8
        rows = (len(items) + cols - 1) // cols
        B = Image.new("RGB", (cols * cell, rows * cell), (70, 72, 78))
        d = ImageDraw.Draw(B)
        for k, (name, t, tpx, tpy) in enumerate(items):
            s = min(1.0, (cell - 20) / max(t.shape[0], t.shape[1]))
            im = Image.fromarray(t).resize((max(1, int(t.shape[1] * s)), max(1, int(t.shape[0] * s))))
            cx = (k % cols) * cell + cell // 2
            cy = (k // cols) * cell + cell - 18
            ox = int(cx - tpx * s)
            oy = int(cy - tpy * s)
            B.paste(im, (ox, oy), im)
            d.line((cx - 10, cy, cx + 10, cy), fill=(0, 255, 120), width=2)
            d.line((cx, cy - 10, cx, cy + 10), fill=(0, 255, 120), width=2)
            d.text(((k % cols) * cell + 3, (k // cols) * cell + 3), name.replace("atriox_", "").replace("caim_", ""), fill=(255, 255, 0))
        B.save(os.path.join(INSPECT, f"atlas_{char}.png"))


if __name__ == "__main__":
    build()
