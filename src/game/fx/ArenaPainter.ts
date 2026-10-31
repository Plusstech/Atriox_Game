import Phaser from 'phaser';
import { FLOOR, WORLD_H, WORLD_W } from '../config/constants';

/**
 * 'trial' e 'nemeia' são pintados proceduralmente; 'toknar' e 'caim' usam as arenas
 * ilustradas (public/assets/arenas) com a paleta de 'nemeia' como base do chão.
 */
export type ArenaTheme = 'trial' | 'nemeia' | 'toknar' | 'caim' | 'selun';

interface Palette {
  stoneL: [number, number];
  warm: number;
  grout: string;
  wallTop: string;
  wallBase: string;
  brick: [number, number];
  ring: string;
  glow: string;
  stain: string;
}

const PALETTES: Record<ArenaTheme, Palette> = {
  trial: {
    stoneL: [30, 44],
    warm: 6,
    grout: '#1b1514',
    wallTop: '#120c0c',
    wallBase: '#2b2220',
    brick: [26, 40],
    ring: 'rgba(200,150,70,',
    glow: 'rgba(255,160,80,0.06)',
    stain: 'rgba(70,12,12,0.32)'
  },
  nemeia: {
    stoneL: [34, 50],
    warm: 14,
    grout: '#1e100c',
    wallTop: '#1a0806',
    wallBase: '#3a1a14',
    brick: [30, 46],
    ring: 'rgba(200,40,40,',
    glow: 'rgba(255,90,40,0.10)',
    stain: 'rgba(110,8,12,0.42)'
  },
  // arenas ilustradas: o painter só gera a base escura sob a imagem
  get toknar(): Palette {
    return PALETTES.nemeia;
  },
  get caim(): Palette {
    return PALETTES.nemeia;
  },
  get selun(): Palette {
    return PALETTES.trial;
  }
};

function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pinta o fundo da arena (piso + muralhas) num canvas, uma vez por tema.
 * Piso: lajes pequenas e irregulares com leve perspectiva (fileiras mais baixas
 * ao fundo), variação de material sutil e sujeira concentrada nas bordas,
 * deixando o centro de combate limpo e legível.
 */
export function paintArena(scene: Phaser.Scene, theme: ArenaTheme): string {
  const key = `arena_bg_${theme}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, WORLD_W, WORLD_H);
  if (!tex) return key;
  const c = tex.getContext();
  const P = PALETTES[theme];
  const rng = rngFor(theme === 'trial' ? 1337 : 4242);
  const cx = FLOOR.x + FLOOR.w / 2;
  const cy = FLOOR.y + FLOOR.h / 2 + 20;

  c.fillStyle = '#050304';
  c.fillRect(0, 0, WORLD_W, WORLD_H);

  // ---------------- piso
  const fx = FLOOR.x - 30;
  const fy = FLOOR.y - 50;
  const fw = FLOOR.w + 60;
  const fh = FLOOR.h + 80;
  c.fillStyle = P.grout;
  c.fillRect(fx, fy, fw, fh);
  // Ladrilhos ALINHADOS em grade (sem fileiras deslocadas → não lê como parede).
  // Perspectiva: as linhas ficam mais baixas e estreitas em direção ao fundo.
  // Rejunte fino e próximo da cor da pedra; variação de material sutil.
  const rows: number[] = [];
  {
    let yy = fy;
    while (yy < fy + fh) {
      rows.push(yy);
      const k = 0.8 + 0.3 * ((yy - fy) / fh);
      yy += 40 * k;
    }
    rows.push(fy + fh);
  }
  const colW = 58;
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r];
    const rh = rows[r + 1] - y0;
    const k = 0.85 + 0.2 * ((y0 - fy) / fh);
    const cw = colW * k;
    // laje dupla ocasional (une duas células) quebra a regularidade sem virar "tijolo"
    let x = fx - ((fx - (FLOOR.x + FLOOR.w / 2)) % cw) - cw;
    while (x < fx + fw) {
      const span = rng() < 0.12 ? 2 : 1;
      const w = cw * span;
      const [l0, l1] = P.stoneL;
      const l = l0 + 4 + rng() * (l1 - l0 - 6);
      const warm = rng() * P.warm;
      c.fillStyle = `rgb(${Math.round(l + warm + 3)},${Math.round(l)},${Math.round(l - 3)})`;
      c.fillRect(x + 1, y0 + 1, w - 2, rh - 2);
      // leve gradiente interno (luz de cima)
      const g = c.createLinearGradient(0, y0, 0, y0 + rh);
      g.addColorStop(0, 'rgba(255,230,200,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.10)');
      c.fillStyle = g;
      c.fillRect(x + 1, y0 + 1, w - 2, rh - 2);
      for (let i = 0; i < 5 * span; i++) {
        c.fillStyle = rng() < 0.5 ? 'rgba(255,235,210,0.03)' : 'rgba(0,0,0,0.10)';
        c.fillRect(x + 2 + rng() * (w - 4), y0 + 2 + rng() * (rh - 4), 1 + rng() * 2.5, 1 + rng() * 1.5);
      }
      if (rng() < 0.05) {
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + rng() * w, y0 + 1);
        c.lineTo(x + rng() * w, y0 + rh - 1);
        c.stroke();
      }
      x += w;
    }
  }

  // ---------------- desgaste concentrado nas bordas (centro limpo)
  const edgeWeight = (px: number, py: number): number => {
    const nx = Math.abs(px - cx) / (FLOOR.w / 2);
    const ny = Math.abs(py - cy) / (FLOOR.h / 2);
    return Math.max(nx, ny);
  };
  for (let i = 0; i < 160; i++) {
    const px = FLOOR.x + rng() * FLOOR.w;
    const py = FLOOR.y + rng() * FLOOR.h;
    const e = edgeWeight(px, py);
    if (e < 0.55 && rng() > 0.15) continue;
    const r = 30 + rng() * 120 * e;
    c.save();
    c.translate(px, py);
    c.scale(1, 0.55);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(0,0,0,${0.12 + 0.22 * e})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // manchas (sangue antigo / brasa)
  for (let i = 0; i < (theme === 'nemeia' ? 30 : 12); i++) {
    const px = FLOOR.x + 60 + rng() * (FLOOR.w - 120);
    const py = FLOOR.y + 60 + rng() * (FLOOR.h - 120);
    if (edgeWeight(px, py) < 0.4 && rng() > 0.3) continue;
    c.fillStyle = P.stain;
    for (let j = 0; j < 6; j++) {
      c.beginPath();
      c.ellipse(px + (rng() - 0.5) * 40, py + (rng() - 0.5) * 18, 3 + rng() * 11, 2 + rng() * 5, rng() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (theme === 'nemeia') {
    // rachaduras incandescentes da cidade em chamas
    for (let i = 0; i < 26; i++) {
      let px = FLOOR.x + rng() * FLOOR.w;
      let py = FLOOR.y + rng() * FLOOR.h;
      if (edgeWeight(px, py) < 0.45) continue;
      c.strokeStyle = 'rgba(255,110,40,0.35)';
      c.lineWidth = 1.6;
      c.shadowColor = 'rgba(255,90,30,0.8)';
      c.shadowBlur = 6;
      c.beginPath();
      c.moveTo(px, py);
      for (let k = 0; k < 6; k++) {
        px += (rng() - 0.5) * 50;
        py += (rng() - 0.5) * 22;
        c.lineTo(px, py);
      }
      c.stroke();
      c.shadowBlur = 0;
    }
  }

  // ---------------- círculo central discreto (orientação, sem poluir)
  c.save();
  c.translate(cx, cy);
  c.scale(1, 0.62);
  c.strokeStyle = `${P.ring}0.16)`;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(0, 0, 430, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, 405, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 36; i++) {
    c.save();
    c.rotate((i / 36) * Math.PI * 2);
    c.fillStyle = `${P.ring}0.14)`;
    c.fillRect(-2, -424, 4, i % 3 === 0 ? 14 : 7);
    c.restore();
  }
  c.restore();

  // iluminação geral: centro levemente mais claro, bordas escuras
  const lg = c.createRadialGradient(cx, cy, 0, cx, cy, 1150);
  lg.addColorStop(0, P.glow);
  lg.addColorStop(0.45, 'rgba(0,0,0,0.16)');
  lg.addColorStop(1, 'rgba(0,0,0,0.72)');
  c.fillStyle = lg;
  c.fillRect(0, 0, WORLD_W, WORLD_H);

  // ---------------- muralha superior (separação clara chão × parede)
  const wallTop = 70;
  const wallBase = FLOOR.y - 40;
  const wg = c.createLinearGradient(0, wallTop, 0, wallBase);
  wg.addColorStop(0, P.wallTop);
  wg.addColorStop(1, P.wallBase);
  c.fillStyle = wg;
  c.fillRect(0, wallTop, WORLD_W, wallBase - wallTop);
  for (let by = wallTop; by < wallBase; by += 30) {
    const off = ((by / 30) % 2) * 38;
    for (let bx = -off; bx < WORLD_W; bx += 76) {
      const [b0, b1] = P.brick;
      const l = b0 + rng() * (b1 - b0) + ((by - wallTop) / (wallBase - wallTop)) * 14;
      c.fillStyle = theme === 'nemeia' ? `rgb(${l + 10},${l - 6},${l - 10})` : `rgb(${l + 4},${l - 2},${l - 4})`;
      c.fillRect(bx + 2, by + 2, 72, 26);
      c.fillStyle = 'rgba(255,220,180,0.05)';
      c.fillRect(bx + 2, by + 2, 72, 3);
    }
  }
  // ameias
  c.fillStyle = '#1a1312';
  c.fillRect(0, wallTop - 14, WORLD_W, 18);
  for (let mx = 0; mx < WORLD_W; mx += 70) {
    c.fillStyle = '#211918';
    c.fillRect(mx + 6, wallTop - 46, 40, 34);
  }
  // rodapé e sombra da muralha no chão
  c.fillStyle = theme === 'nemeia' ? '#4a2a22' : '#3a2f2b';
  c.fillRect(0, wallBase - 8, WORLD_W, 14);
  const sg = c.createLinearGradient(0, wallBase, 0, wallBase + 110);
  sg.addColorStop(0, 'rgba(0,0,0,0.75)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg;
  c.fillRect(0, wallBase, WORLD_W, 110);

  // muros laterais
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : FLOOR.x + FLOOR.w + 10;
    const w = side === 0 ? FLOOR.x - 10 : WORLD_W - x0;
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    if (side === 0) {
      g.addColorStop(0, '#030202');
      g.addColorStop(1, '#231b19');
    } else {
      g.addColorStop(0, '#231b19');
      g.addColorStop(1, '#030202');
    }
    c.fillStyle = g;
    c.fillRect(x0, wallBase - 20, w, WORLD_H);
    c.fillStyle = '#3a302c';
    c.fillRect(side === 0 ? FLOOR.x - 14 : FLOOR.x + FLOOR.w + 8, wallBase - 10, 8, WORLD_H);
  }
  // borda inferior: parapeito e abismo
  const by0 = FLOOR.y + FLOOR.h + 20;
  const bg = c.createLinearGradient(0, by0, 0, WORLD_H);
  bg.addColorStop(0, '#1d1615');
  bg.addColorStop(0.25, '#0a0606');
  bg.addColorStop(1, theme === 'nemeia' ? '#1a0402' : '#020101');
  c.fillStyle = bg;
  c.fillRect(0, by0, WORLD_W, WORLD_H - by0);
  c.fillStyle = '#4a3c36';
  c.fillRect(FLOOR.x - 14, by0 - 6, FLOOR.w + 28, 12);
  tex.refresh();
  return key;
}
