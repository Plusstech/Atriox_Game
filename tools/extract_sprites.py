"""
Pipeline de extração de poses do concept sheet do Atriox.

Entrada : art_source/atriox_concept_sheet.png  (1536x1024, RGB, fundo ~#F7F7F7, grade 3x2)
Saída   : public/assets/atriox/<pose>.png  (RGBA, recortado, escala única)
          public/assets/atriox/atriox_poses.json (origem dos pés, dimensões, direção)

Uso: python tools/extract_sprites.py
Requer: Pillow, numpy, scipy.

Todas as poses usam O MESMO fator de escala, para manter proporções consistentes.
Todas são normalizadas para "olhando para a direita" (flip horizontal quando necessário);
o jogo espelha o sprite conforme a direção da mira.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art_source", "atriox_concept_sheet.png")
OUT = os.path.join(ROOT, "public", "assets", "atriox")

SCALE = 0.5          # fator único para todas as poses
BG_THRESHOLD = 16    # diferença máxima por canal p/ considerar fundo
HOLE_MIN_PX = 120   # buracos fechados maiores que isso viram transparência
FEATHER_PX = 3       # faixa de borda onde aplicamos color-to-alpha

# (nome, coluna, linha, flip para olhar para a direita, descrição)
# HOLES: poses cujos espaços brancos fechados são fundo (no "slash", o branco é o núcleo do fogo)
HOLES = {"cast", "dash", "hurt", "idle", "lunge"}
POSES = [
    ("idle",  0, 0, True,  "Em pé, espada baixa, mão com brilho vermelho (anel)"),
    ("lunge", 1, 0, True,  "Avanço/corrida com espada estendida à frente"),
    ("slash", 2, 0, False, "Corte horizontal com arco de fogo solar"),
    ("cast",  0, 1, True,  "Conjuração: esfera de luz/fogo na mão"),
    ("dash",  1, 1, True,  "Investida baixa com afterimages douradas"),
    ("hurt",  2, 1, False, "Recebendo golpe, recuo"),
]


def color_to_alpha(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Alpha mínimo que explica a cor como mistura com o fundo claro."""
    diff = (bg[None, None, :] - rgb) / np.maximum(bg[None, None, :], 1)
    return np.clip(diff.max(axis=2), 0.0, 1.0)


def extract(cell: np.ndarray, remove_holes: bool):
    rgb = cell[:, :, :3].astype(np.float32)
    # cor de fundo estimada pelas bordas da célula
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)

    near_bg = np.abs(rgb - bg[None, None, :]).max(axis=2) < BG_THRESHOLD
    labels, _ = ndimage.label(near_bg)
    edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    edge_labels.discard(0)
    # "buracos" de fundo grandes, fechados por efeitos de luz, também são fundo
    sizes = ndimage.sum(near_bg, labels, range(1, labels.max() + 1))
    big_holes = {i for i, s in enumerate(sizes, start=1) if s > HOLE_MIN_PX} if remove_holes else set()
    background = np.isin(labels, list(edge_labels | big_holes))

    alpha = np.where(background, 0.0, 1.0).astype(np.float32)

    # suaviza a borda: pixels a até FEATHER_PX do fundo recebem color-to-alpha
    dist = ndimage.distance_transform_edt(~background)
    band = (dist > 0) & (dist <= FEATHER_PX)
    c2a = color_to_alpha(rgb, bg)
    alpha[band] = np.clip(c2a[band] * 2.2, 0.0, 1.0)

    # recupera cor "pré-mistura" na banda para não deixar halo branco
    a3 = np.maximum(alpha[:, :, None], 1e-3)
    unmixed = (rgb - bg[None, None, :] * (1 - a3)) / a3
    out_rgb = np.where(band[:, :, None], np.clip(unmixed, 0, 255), rgb)

    rgba = np.dstack([out_rgb, alpha * 255]).astype(np.uint8)

    # remove ilhas minúsculas e fragmentos de células vizinhas (tocam a borda da célula)
    solid = alpha > 0.05
    lab2, n2 = ndimage.label(solid)
    if n2 > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n2 + 1))
        largest = int(np.argmax(sizes)) + 1
        touching = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]])))
        for i, s in enumerate(sizes, start=1):
            if i == largest:
                continue
            if s < 30 or i in touching:
                rgba[lab2 == i, 3] = 0
    return rgba


def main():
    if not os.path.exists(SRC):
        print(f"[extract] arquivo de origem ausente: {SRC}")
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    sheet = np.array(Image.open(SRC).convert("RGB"))
    h, w, _ = sheet.shape
    cw, ch = w // 3, h // 2
    meta = {"source": "art_source/atriox_concept_sheet.png", "scale": SCALE, "facing": "right", "poses": {}}

    for name, col, row, flip, desc in POSES:
        cell = sheet[row * ch:(row + 1) * ch, col * cw:(col + 1) * cw]
        rgba = extract(cell, name in HOLES)
        if flip:
            rgba = rgba[:, ::-1]
        ys, xs = np.nonzero(rgba[:, :, 3] > 10)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = 4
        y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
        y1, x1 = min(rgba.shape[0], y1 + pad), min(rgba.shape[1], x1 + pad)
        crop = rgba[y0:y1, x0:x1]

        # âncora: pés = linha mais baixa opaca; centro do corpo = média x dos pixels escuros (roupa/armadura)
        a = crop[:, :, 3] > 128
        lum = crop[:, :, :3].astype(np.float32).mean(axis=2)
        dark = a & (lum < 110)
        ys2, xs2 = np.nonzero(a)
        foot_y = ys2.max()
        body_x = np.nonzero(dark)[1].mean() if dark.any() else xs2.mean()

        img = Image.fromarray(crop, "RGBA")
        new_size = (max(1, round(img.width * SCALE)), max(1, round(img.height * SCALE)))
        img = img.resize(new_size, Image.LANCZOS)
        img.save(os.path.join(OUT, f"{name}.png"), optimize=True)

        meta["poses"][name] = {
            "file": f"{name}.png",
            "width": new_size[0],
            "height": new_size[1],
            "originX": round(float(body_x) / crop.shape[1], 4),
            "originY": round(float(foot_y) / crop.shape[0], 4),
            "flipped": flip,
            "description": desc,
            "sourceCell": [col, row],
        }
        print(f"[extract] {name:6s} -> {new_size[0]}x{new_size[1]}  origin=({meta['poses'][name]['originX']}, {meta['poses'][name]['originY']})")

    with open(os.path.join(OUT, "atriox_poses.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
