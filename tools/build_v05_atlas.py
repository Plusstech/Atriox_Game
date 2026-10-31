"""v0.5: append the PROMPT_MASTER asset pack to the existing multi-atlas.

Sources: art_source/v05/*.png (originals, untouched). Re-running replaces only
the `v05-*.webp` pages, the v05 metadata and the files it exports.

- Cutting: nominal grid refined by density valleys + connected-component
  ownership (tools/sheet_frames.py). Each sheet's real frame count is checked.
- Scale by BODY, never by axe/effect extent:
  * Toknar and Caim reuse the v0.2/v0.3 measure (body_height: no metal, no
    saturated effects) so new frames match the frames already in the atlas.
  * New characters (Carrasco, goblin, orc, wild wyvern) are mostly steel or
    leather, so they use the opaque silhouette height of standing frames.
- Pivot at the feet (torso median x, 99.6th percentile y); flying wyvern and
  VFX use the cell centre so an effect stays where it was drawn.
- One fixed sourceSize per character: frames are trimmed, origin is constant.
  Appending to an existing character grows its canvas for every frame.

Also exports dialogue portraits (public/assets/portraits) and arena
backgrounds (public/assets/arenas) as WebP.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import sheet_frames as sf
from build_atlases import body_height, pivot_feet, drop_far_fragments

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art_source/v05'
OUT = ROOT / 'public/assets/atlas'
INSPECT = SRC / '_inspect'
PORTRAITS = ROOT / 'public/assets/portraits'
ARENAS = ROOT / 'public/assets/arenas'
PAGE = 2048
PAD = 2
ALPHA_MIN = 10


def seq(prefix, n, start=0):
    return [f'{prefix}_{i:02d}' for i in range(start, start + n)]


# char: atlas character (origin group). names: one per grid cell, None = skip.
# measure: 'body' (existing characters) | 'silhouette'. refs: standing frames.
SHEETS = {
    'carrasco_movimento': dict(char='carrasco', cols=[4, 4, 4, 4], measure='silhouette', target=210, refs=[0, 1, 2, 3],
                               names=seq('carrasco_idle', 4) + seq('carrasco_run', 8) + seq('carrasco_broken', 4)),
    'carrasco_golpes': dict(char='carrasco', cols=[4, 4, 4, 4], measure='silhouette', target=210, refs=[0, 7, 8],
                            names=seq('carrasco_sweep', 8) + seq('carrasco_execute', 8)),
    'carrasco_investida_dano_morte': dict(char='carrasco', cols=[4, 4, 4, 4], measure='silhouette', target=210, refs=[7, 11],
                                          names=seq('carrasco_charge', 8) + seq('carrasco_hurt', 4) + seq('carrasco_death', 4)),
    'toknar_ceifa_revisao': dict(char='toknar', cols=[4, 4], measure='body', target=280, refs=[0, 7], names=seq('toknar_ceifa', 8)),
    'toknar_fome_revisao': dict(char='toknar', cols=[4, 4], measure='body', target=280, refs=[0, 7], names=seq('toknar_fome', 8)),
    'caim_poca_revisao': dict(char='caim', cols=[3, 3], measure='body', target=238, refs=[0, 5], names=seq('caim_pool3q', 6)),
    'caim_erupcao': dict(char='caim', cols=[3, 3], measure='body', target=238, refs=[0, 5], names=seq('caim_erupt3q', 6)),
    'goblin': dict(char='goblin', cols=[4, 4, 4], measure='silhouette', target=150, refs=[4, 7],
                   names=seq('goblin_run', 4) + seq('goblin_attack', 4) + seq('goblin_fall', 4)),
    'orc_saqueador': dict(char='orc', cols=[4, 4, 4], measure='silhouette', target=205, refs=[4, 7],
                          names=seq('orc_run', 4) + seq('orc_attack', 4) + seq('orc_fall', 4)),
    'wyvern_selvagem': dict(char='wyvern_wild', cols=[4, 4, 4], measure='silhouette', target=175, refs=[0, 1, 3], flying=True,
                            names=seq('wyvwild_fly', 4) + seq('wyvwild_attack', 4) + seq('wyvwild_fall', 4)),
    'toknar_vfx': dict(char='fx_toknar', cols=[6, 6, 6], fx=True, scale=0.62,
                       names=seq('fxt_slash_h', 5) + [None] + seq('fxt_slash_d', 5) + [None] + seq('fxt_fissure', 6)),
    'carrasco_vfx': dict(char='fx_carrasco', cols=[6, 6, 6], fx=True, scale=0.62,
                         names=seq('fxc_slash_h', 6) + seq('fxc_slash_d', 6) + seq('fxc_impact', 6)),
    # ---- complementos (pacote Atriox_Hades_Sprites_e_Guia): inimigos da Provação, boneco, Apollon, ambientação
    'complementos/recruta_combate_v2': dict(char='recruit', cols=[6, 6, 6], measure='silhouette', target=200, refs=[10, 11],
                                            names=seq('recruit_run', 4) + seq('recruit_atk', 8) + seq('recruit_fall', 6)),
    'complementos/atirador_combate_v2': dict(char='archer', cols=[6, 6, 6], measure='silhouette', target=205, refs=[6, 7],
                                             names=seq('archer_run', 4) + seq('archer_shot', 6) + seq('archer_fall', 8)),
    'complementos/guardiao_combate': dict(char='guardian', cols=[7, 7], measure='silhouette', target=235, refs=[9],
                                          names=seq('guardian_run', 4) + seq('guardian_slam', 6) + seq('guardian_fall', 4)),
    'complementos/boneco_treino_quebra_v2': dict(char='dummy', cols=[3, 3], measure='silhouette', target=150, refs=[0],
                                                 names=seq('dummy', 6)),
    'complementos/guardiao_impacto': dict(char='fx_guardian', cols=[3, 3], fx=True, scale=0.5, names=seq('fxg_impact', 6)),
    'complementos/apollon_avatar_isolado': dict(char='fx_apollon', cols=[4, 4], fx=True, scale=0.62, names=seq('apollon_avatar', 8)),
    'complementos/apollon_feixe_solar': dict(char='fx_beam', cols=[3, 3], fx=True, scale=0.8, names=seq('apollon_beam', 6)),
    'complementos/plateia_orcs_animada': dict(char='fx_crowd', cols=[4, 4, 4], fx=True, scale=0.42, names=seq('crowd_orc', 12)),
    'complementos/wyvern_idle_separado': dict(char='fx_perch', cols=[3, 3], fx=True, scale=0.5, names=seq('wyvern_perch', 6)),
    # ---- Sêlun (pacote Selun_Artes_e_Prompt_Game_Over). Fontes: revisões *_alpha_revision quando existem
    # (as originais de recomposição, canalização e Decreto têm linhas de grade semitransparentes).
    # Medida 'thick': a espada passa abaixo dos pés em várias poses; altura e pivô ignoram partes finas.
    'selun/selun_idle': dict(char='selun', cols=[4], measure='thick', target=240, refs=[0, 1, 2, 3], names=seq('selun_idle', 4)),
    'selun/selun_run': dict(char='selun', cols=[4, 4], measure='thick', target=228, refs=list(range(8)), names=seq('selun_run', 8)),
    'selun/selun_attack_01_horizon': dict(char='selun', cols=[4, 4], measure='thick', target=240, refs=[7], names=seq('selun_horizon', 8)),
    'selun/selun_attack_02_sentence': dict(char='selun', cols=[4, 4], measure='thick', target=240, refs=[0], names=seq('selun_sentence', 8)),
    'selun/selun_attack_03_end': dict(char='selun', cols=[4, 4], measure='thick', target=240, refs=[0, 7], names=seq('selun_decree', 8)),
    'selun/selun_dash': dict(char='selun', cols=[5, 5], measure='thick', target=226, refs=[7, 8, 9], names=seq('selun_dash', 10)),
    'selun/selun_channel': dict(char='selun', cols=[5, 5], measure='thick', target=240, refs=[0, 9], names=seq('selun_channel', 10)),
    'selun/selun_apparent_death': dict(char='selun', cols=[4, 4], measure='thick', target=240, refs=[0], names=seq('selun_fall', 8)),
    'selun/selun_recompose': dict(char='selun', cols=[4, 4], measure='thick', target=240, refs=[7], names=seq('selun_recompose', 8)),
    'selun/selun_stagger': dict(char='selun', cols=[4], measure='thick', target=212, refs=[0, 1, 2, 3], names=seq('selun_stagger', 4)),
    'selun/selun_hurt': dict(char='selun', cols=[4], measure='thick', target=240, refs=[0, 3], names=seq('selun_hurt', 4)),
    'selun/selun_phase_change': dict(char='selun', cols=[4], measure='thick', target=240, refs=[0, 3], names=seq('selun_fury', 4)),
    'selun/fx_selun_horizontal': dict(char='fx_selun', cols=[3, 3], fx=True, scale=0.62, names=seq('fxs_slash_h', 6)),
    'selun/fx_selun_diagonal': dict(char='fx_selun', cols=[3, 3], fx=True, scale=0.62, names=seq('fxs_slash_d', 6)),
    'selun/fx_selun_ground_impact': dict(char='fx_selun', cols=[3, 3], fx=True, scale=0.62, names=seq('fxs_ground', 6)),
    'selun/fx_selun_end': dict(char='fx_selun_rift', cols=[4, 4], fx=True, scale=0.55, names=seq('fxs_rift', 8)),
}

# Frames that already live in the atlas, per character (canvas growth must shift them too).
EXISTING_PREFIX = {'toknar': ('toknar_',), 'caim': ('caim_',)}


def clean(a):
    a = a.copy()
    a[a[:, :, 3] < ALPHA_MIN] = 0
    return a


def silhouette(a):
    m = a[:, :, 3] >= 160
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 0.03 * sizes.max()])


def silhouette_height(a):
    ys = np.nonzero(silhouette(a))[0]
    return float(np.percentile(ys, 99.6) - np.percentile(ys, 0.4))


def silhouette_feet(a):
    m = silhouette(a)
    ys, xs = np.nonzero(m)
    top, bot = np.percentile(ys, 0.4), np.percentile(ys, 99.6)
    band = (ys > top + (bot - top) * 0.25) & (ys < top + (bot - top) * 0.65)
    return float(np.median(xs[band] if band.any() else xs)), float(bot)


def thick_rows(a):
    """Linhas da silhueta largas o bastante para serem corpo (lâmina e pontas finas ficam de fora)."""
    m = silhouette(a)
    w = m.sum(1)
    body = w[w > 0]
    thr = max(18, 0.2 * float(np.median(body))) if len(body) else 18
    rows = np.nonzero(w >= thr)[0]
    return m, rows


def thick_height(a):
    _, rows = thick_rows(a)
    return float(rows.max() - rows.min()) if len(rows) else float(a.shape[0])


def thick_feet(a):
    m, rows = thick_rows(a)
    if not len(rows):
        return silhouette_feet(a)
    top, bot = float(rows.min()), float(rows.max())
    band = m[int(top + (bot - top) * 0.25):int(top + (bot - top) * 0.65)]
    ys, xs = np.nonzero(band)
    return (float(np.median(xs)) if len(xs) else a.shape[1] / 2), bot


def resize(a, s):
    im = Image.fromarray(a, 'RGBA')
    return np.array(im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.Resampling.LANCZOS))


def trim(a):
    ys, xs = np.nonzero(a[:, :, 3] > 0)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return a[y0:y1, x0:x1], int(x0), int(y0)


def extract(name, cfg):
    rgba = clean(np.array(Image.open(SRC / f'{name}.png').convert('RGBA')))
    sf.SHEETS[name] = {'cols': cfg['cols'], 'expected': sum(cfg['cols']), 'split_all': True}
    frames = sf.extract(name, rgba)
    if len(frames) != len(cfg['names']):
        raise ValueError(f'{name}: {len(frames)} cells, expected {len(cfg["names"])}')
    return frames, sf.cells(name, rgba)


def build():
    data = json.loads((OUT / 'characters.json').read_text(encoding='utf-8'))
    data['textures'] = [t for t in data['textures'] if not t['image'].startswith('v05-')]
    origins = data['meta']['origins']
    # idempotent: undo a previous v05 run (canvas growth of existing characters, new origins)
    prev = data['meta'].pop('v05Base', None)
    if prev:
        for char, sh in prev['shift'].items():
            for tex in data['textures']:
                for f in tex['frames']:
                    if f['filename'].startswith(EXISTING_PREFIX[char]):
                        f['spriteSourceSize']['x'] -= sh['dx']
                        f['spriteSourceSize']['y'] -= sh['dy']
                        f['sourceSize'] = {'w': sh['w'], 'h': sh['h']}
        for char in prev['added']:
            origins.pop(char, None)
        origins.update(prev['origins'])
    base = {'origins': {}, 'shift': {}, 'added': []}
    INSPECT.mkdir(parents=True, exist_ok=True)

    entries = []  # (char, name, trimmed rgba, pivot x, pivot y within trimmed)
    manifest = {}
    for sheet, cfg in SHEETS.items():
        frames, cells = extract(sheet, cfg)
        if cfg.get('fx'):
            # VFX: pivot = centre of its grid cell, so the drawing keeps its place in the cell
            s = cfg['scale']
            for (a, bounds), cell, name in zip(frames, cells, cfg['names']):
                if name is None or a is None:
                    continue
                t, ox, oy = trim(resize(a, s))
                ccx, ccy = (cell[0] + cell[2]) / 2, (cell[1] + cell[3]) / 2
                entries.append((cfg['char'], name, t, (ccx - bounds[0]) * s - ox, (ccy - bounds[1]) * s - oy))
                manifest[name] = {'sheet': sheet, 'scale': s, 'cell': list(map(int, cell))}
            continue
        if cfg['measure'] == 'body':
            ref = float(np.median([body_height(frames[i][0]) for i in cfg['refs']]))
        elif cfg['measure'] == 'thick':
            ref = float(np.median([thick_height(frames[i][0]) for i in cfg['refs']]))
        else:
            ref = float(np.median([silhouette_height(frames[i][0]) for i in cfg['refs']]))
        s = cfg['target'] / ref
        for (a, bounds), name in zip(frames, cfg['names']):
            if name is None:
                continue
            if a is None:
                raise ValueError(f'{sheet}: empty frame {name}')
            a = resize(drop_far_fragments(a), s)
            if cfg.get('flying'):
                ys, xs = np.nonzero(silhouette(a))
                px, py = float(np.median(xs)), float(np.median(ys))
            elif cfg['measure'] == 'body':
                px, py = pivot_feet(a)
            elif cfg['measure'] == 'thick':
                px, py = thick_feet(a)
            else:
                px, py = silhouette_feet(a)
            t, ox, oy = trim(a)
            entries.append((cfg['char'], name, t, px - ox, py - oy))
            manifest[name] = {'sheet': sheet, 'sourceBounds': list(map(int, bounds)), 'scale': round(s, 5), 'pivot': [round(px, 1), round(py, 1)]}
        print(f'{sheet}: scale {s:.4f} ({cfg["measure"]}, ref {ref:.1f}px -> {cfg.get("target")})')

    # ---- canvas per character (existing ones may grow; their frames shift accordingly)
    ext = {}
    for char, _, t, px, py in entries:
        e = ext.setdefault(char, [0.0, 0.0, 0.0, 0.0])
        e[0] = max(e[0], px); e[1] = max(e[1], t.shape[1] - px)
        e[2] = max(e[2], py); e[3] = max(e[3], t.shape[0] - py)
    canvas = {}
    for char, e in ext.items():
        if char in origins:
            o = origins[char]
            PX, PY = o['originX'] * o['sourceW'], o['originY'] * o['sourceH']
            left, right, up, down = PX, o['sourceW'] - PX, PY, o['sourceH'] - PY
            nl, nr, nu, nd = max(left, e[0] + 2), max(right, e[1] + 2), max(up, e[2] + 2), max(down, e[3] + 2)
            sw, sh = int(np.ceil(nl + nr)), int(np.ceil(nu + nd))
            dx, dy = round(nl - left), round(nu - up)
            if (sw, sh) != (o['sourceW'], o['sourceH']):
                base['origins'][char] = dict(o)
                base['shift'][char] = {'dx': dx, 'dy': dy, 'w': o['sourceW'], 'h': o['sourceH']}
                for tex in data['textures']:
                    for f in tex['frames']:
                        if f['filename'].startswith(EXISTING_PREFIX[char]):
                            f['spriteSourceSize']['x'] += dx
                            f['spriteSourceSize']['y'] += dy
                            f['sourceSize'] = {'w': sw, 'h': sh}
                print(f'{char}: canvas {o["sourceW"]}x{o["sourceH"]} -> {sw}x{sh}')
            PX, PY = PX + dx, PY + dy
        else:
            sw, sh = int(np.ceil(e[0] + e[1])) + 4, int(np.ceil(e[2] + e[3])) + 4
            PX, PY = e[0] + 2, e[2] + 2
            base['added'].append(char)
        canvas[char] = (sw, sh, PX, PY)
        origins[char] = {'originX': round(PX / sw, 5), 'originY': round(PY / sh, 5), 'sourceW': sw, 'sourceH': sh}

    # ---- shelf packing
    pages = []
    for char, name, t, px, py in sorted(entries, key=lambda e: (-e[2].shape[0], e[1])):
        h, w = t.shape[:2]
        if w + PAD > PAGE or h + PAD > PAGE:
            raise ValueError(f'{name} too large: {w}x{h}')
        p = pages[-1] if pages else None
        if p and p['x'] + w + PAD > PAGE:
            p['x'] = 0; p['y'] += p['row'] + PAD; p['row'] = 0
        if not p or p['y'] + h + PAD > PAGE:
            p = {'img': Image.new('RGBA', (PAGE, PAGE)), 'frames': [], 'x': 0, 'y': 0, 'row': 0}
            pages.append(p)
        x, y = p['x'], p['y']
        p['img'].paste(Image.fromarray(t, 'RGBA'), (x, y))
        p['x'] += w + PAD; p['row'] = max(p['row'], h)
        sw, sh, PX, PY = canvas[char]
        p['frames'].append({'filename': name, 'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                            'spriteSourceSize': {'x': int(round(PX - px)), 'y': int(round(PY - py)), 'w': w, 'h': h},
                            'sourceSize': {'w': sw, 'h': sh}})
    for old in OUT.glob('v05-*.webp'):
        old.unlink()  # páginas de uma execução anterior (pode ter tido mais páginas)
    for i, p in enumerate(pages):
        fn = f'v05-{i}.webp'
        used_h = max(f['frame']['y'] + f['frame']['h'] for f in p['frames'])
        p['img'].crop((0, 0, PAGE, used_h)).save(OUT / fn, 'WEBP', quality=90, alpha_quality=100, method=6)
        data['textures'].append({'image': fn, 'format': 'RGBA8888', 'size': {'w': PAGE, 'h': used_h}, 'scale': 1, 'frames': p['frames']})
        print(f'{fn}: {len(p["frames"])} frames, {(OUT / fn).stat().st_size // 1024} KB')

    data['meta']['v05Frames'] = manifest
    data['meta']['v05Base'] = base
    (OUT / 'characters.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    (SRC / 'frames.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')
    boards(entries, canvas)
    export_portraits()
    export_arenas()
    export_arrow()
    print(f'v0.5: {len(entries)} frames on {len(pages)} page(s)')


def boards(entries, canvas):
    """Inspection boards: every frame on its fixed canvas, pivot cross in green."""
    by_char = {}
    for e in entries:
        by_char.setdefault(e[0], []).append(e)
    for char, items in by_char.items():
        sw, sh, PX, PY = canvas[char]
        k = min(1.0, 220 / max(sw, sh))
        cw, ch = int(sw * k), int(sh * k) + 16
        cols = 6
        board = Image.new('RGB', (cols * cw, ((len(items) + cols - 1) // cols) * ch), (60, 64, 72))
        d = ImageDraw.Draw(board)
        for i, (_, name, t, px, py) in enumerate(items):
            cv = Image.new('RGBA', (sw, sh))
            cv.paste(Image.fromarray(t, 'RGBA'), (int(round(PX - px)), int(round(PY - py))))
            cv = cv.resize((cw, int(sh * k)))
            x, y = (i % cols) * cw, (i // cols) * ch
            board.paste(cv, (x, y + 16), cv)
            d.text((x + 3, y + 2), name, fill='white')
            gx, gy = x + PX * k, y + 16 + PY * k
            d.line((gx - 6, gy, gx + 6, gy), fill='#60ff90'); d.line((gx, gy - 6, gx, gy + 6), fill='#60ff90')
        board.save(INSPECT / f'atlas_{char}.png')  # um quadro por personagem


def export_portraits():
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    sheet = clean(np.array(Image.open(SRC / 'retratos_atriox_toknar_caim.png').convert('RGBA')))
    sf.SHEETS['retratos'] = {'cols': [3, 3], 'expected': 6}
    names = ['atriox_calm', 'toknar_calm', 'caim_calm', 'atriox_angry', 'toknar_roar', 'caim_sly']
    for (a, _), name in zip(sf.extract('retratos', sheet), names):
        save_portrait(a, name)
    save_portrait(clean(np.array(Image.open(SRC / 'carrasco_retrato.png').convert('RGBA'))), 'carrasco')
    # Sêlun: bustos já olham para a esquerda (ficam à direita da caixa de diálogo)
    for mood in ('calm', 'angry'):
        save_portrait(clean(np.array(Image.open(SRC / f'selun/selun_portrait_{mood}.png').convert('RGBA'))), f'selun_{mood}')


def save_portrait(a, name, height=440):
    im = Image.fromarray(trim(a)[0], 'RGBA')
    im = im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)
    im.save(PORTRAITS / f'{name}.webp', 'WEBP', quality=88, alpha_quality=100, method=6)


def export_arrow():
    """Flecha do Atirador: imagem única (o jogo controla o movimento)."""
    fx = ROOT / 'public/assets/fx'
    fx.mkdir(parents=True, exist_ok=True)
    a = clean(np.array(Image.open(SRC / 'complementos/atirador_flecha.png').convert('RGBA')))
    im = Image.fromarray(trim(a)[0])
    im = im.resize((96, max(1, round(im.height * 96 / im.width))), Image.Resampling.LANCZOS)
    im.save(fx / 'arrow.webp', 'WEBP', quality=90, alpha_quality=100, method=6)


def export_arenas():
    ARENAS.mkdir(parents=True, exist_ok=True)
    for f in (SRC / 'arenas').glob('*.png'):
        Image.open(f).convert('RGB').save(ARENAS / f'{f.stem}.webp', 'WEBP', quality=86, method=6)


if __name__ == '__main__':
    build()
