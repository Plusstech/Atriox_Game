import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config/constants';

/**
 * Texturas ORIGINAIS geradas proceduralmente em Canvas 2D.
 * Servem de placeholders coerentes até a chegada da arte definitiva:
 * basta carregar um PNG com a mesma chave no BootScene para substituí-las.
 */
type Ctx = CanvasRenderingContext2D;

const INK = '#0c0909';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  const ctx = t.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  t.refresh();
}

function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function shape(ctx: Ctx, pts: number[], fill: string | CanvasGradient, stroke: string | null = INK, lw = 2.5): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke: string | null = INK, lw = 2.5): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke: string | null = INK, lw = 2.5): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Pinceladas sutis para quebrar áreas chapadas (aspecto pintado). */
function brushNoise(ctx: Ctx, x: number, y: number, w: number, h: number, rng: () => number, n: number, light: string, dark: string): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rng() < 0.5 ? light : dark;
    const px = x + rng() * w;
    const py = y + rng() * h;
    ctx.fillRect(px, py, 1 + rng() * 3, 1 + rng() * 2);
  }
}

// =====================================================================================
// Partículas e efeitos
// =====================================================================================
function makeFxTextures(scene: Phaser.Scene): void {
  canvasTex(scene, 'px', 4, 4, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 4, 4);
  });
  canvasTex(scene, 'p_spark', 16, 16, (c) => {
    c.fillStyle = radial(c, 8, 8, 8, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,230,160,0.9)'], [1, 'rgba(255,160,60,0)']]);
    c.fillRect(0, 0, 16, 16);
  });
  canvasTex(scene, 'p_ember', 8, 8, (c) => {
    c.fillStyle = radial(c, 4, 4, 4, [[0, 'rgba(255,240,200,1)'], [0.5, 'rgba(255,150,60,0.9)'], [1, 'rgba(255,80,20,0)']]);
    c.fillRect(0, 0, 8, 8);
  });
  canvasTex(scene, 'p_glow', 64, 64, (c) => {
    c.fillStyle = radial(c, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'p_smoke', 64, 64, (c) => {
    c.fillStyle = radial(c, 32, 32, 32, [[0, 'rgba(60,52,50,0.55)'], [0.6, 'rgba(40,34,34,0.25)'], [1, 'rgba(30,26,26,0)']]);
    c.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'p_dust', 24, 24, (c) => {
    c.fillStyle = radial(c, 12, 12, 12, [[0, 'rgba(150,130,110,0.6)'], [1, 'rgba(120,100,90,0)']]);
    c.fillRect(0, 0, 24, 24);
  });
  canvasTex(scene, 'p_streak', 36, 8, (c) => {
    c.fillStyle = linear(c, 0, 0, 36, 0, [[0, 'rgba(255,200,120,0)'], [0.7, 'rgba(255,240,200,1)'], [1, 'rgba(255,255,255,1)']]);
    c.beginPath();
    c.ellipse(18, 4, 18, 3, 0, 0, Math.PI * 2);
    c.fill();
  });
  canvasTex(scene, 'p_blood', 10, 10, (c) => {
    c.fillStyle = radial(c, 5, 5, 5, [[0, 'rgba(120,20,20,1)'], [1, 'rgba(80,10,10,0)']]);
    c.fillRect(0, 0, 10, 10);
  });
  canvasTex(scene, 'light', 256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, 'rgba(255,255,255,0.9)'], [0.25, 'rgba(255,255,255,0.4)'], [0.6, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 256, 256);
  });
  canvasTex(scene, 'shadow', 128, 48, (c) => {
    c.fillStyle = radial(c, 64, 24, 64, [[0, 'rgba(0,0,0,0.7)'], [0.55, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
    c.save();
    c.scale(1, 48 / 128);
    c.fillStyle = radial(c, 64, 64, 64, [[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(0, 0, 128, 128);
    c.restore();
  });
  canvasTex(scene, 'ring', 256, 256, (c) => {
    c.strokeStyle = 'rgba(255,255,255,1)';
    for (let i = 0; i < 6; i++) {
      c.globalAlpha = 0.18 + i * 0.12;
      c.lineWidth = 14 - i * 2;
      c.beginPath();
      c.arc(128, 128, 118 - i * 0.5, 0, Math.PI * 2);
      c.stroke();
    }
  });
  canvasTex(scene, 'fireball', 80, 80, (c) => {
    const rng = mulberry32(7);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 24 + rng() * 10;
      c.fillStyle = radial(c, 40 + Math.cos(a) * 10, 40 + Math.sin(a) * 10, r, [[0, 'rgba(255,170,60,0.6)'], [1, 'rgba(255,90,20,0)']]);
      c.fillRect(0, 0, 80, 80);
    }
    c.fillStyle = radial(c, 40, 40, 30, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,240,170,1)'], [0.6, 'rgba(255,170,50,0.85)'], [1, 'rgba(255,90,20,0)']]);
    c.fillRect(0, 0, 80, 80);
  });
  canvasTex(scene, 'arrow', 46, 10, (c) => {
    c.strokeStyle = '#3a2618';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(4, 5);
    c.lineTo(36, 5);
    c.stroke();
    shape(c, [34, 1, 45, 5, 34, 9], '#c9c2b8', INK, 1.2);
    shape(c, [2, 1, 10, 5, 2, 9], '#b03a2e', null);
  });

  // Arcos de corte (direção 0 rad = para a direita)
  const crescent = (key: string, R: number, thick: number, arcDeg: number, core: string, mid: string, edge: string): void =>
    canvasTex(scene, key, 300, 300, (c) => {
      const cx = 150;
      const cy = 150;
      const half = (arcDeg / 2) * (Math.PI / 180);
      const steps = 60;
      const path = (thickMul: number): void => {
        c.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = -half + (2 * half * i) / steps;
          c.lineTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
        }
        for (let i = steps; i >= 0; i--) {
          const t = -half + (2 * half * i) / steps;
          const u = i / steps;
          // mais grosso perto da "ponta de ataque" (u alto), fino na cauda
          const taper = Math.pow(Math.sin(Math.PI * u), 0.7) * (0.35 + 0.65 * u);
          const r = R - thick * thickMul * taper;
          c.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
        }
        c.closePath();
      };
      c.shadowColor = edge;
      c.shadowBlur = 18;
      path(1.25);
      c.fillStyle = radial(c, cx, cy, R + 6, [[0, 'rgba(0,0,0,0)'], [Math.max(0, (R - thick * 1.4) / (R + 6)), 'rgba(0,0,0,0)'], [0.82, mid], [1, edge]]);
      c.globalAlpha = 0.55;
      c.fill();
      c.shadowBlur = 0;
      c.globalAlpha = 1;
      path(0.75);
      c.fillStyle = radial(c, cx, cy, R, [[0, 'rgba(0,0,0,0)'], [Math.max(0, (R - thick) / R), mid], [0.92, core], [1, core]]);
      c.fill();
    });
  crescent('slash_1', 118, 30, 130, 'rgba(255,252,235,1)', 'rgba(255,214,120,0.85)', 'rgba(255,170,60,0.6)');
  crescent('slash_2', 126, 40, 200, 'rgba(255,248,225,1)', 'rgba(255,190,90,0.85)', 'rgba(255,120,40,0.6)');
  crescent('slash_3', 132, 56, 160, 'rgba(255,255,255,1)', 'rgba(255,200,90,0.95)', 'rgba(255,100,30,0.75)');
  crescent('slash_enemy', 118, 34, 120, 'rgba(255,235,225,1)', 'rgba(255,120,90,0.8)', 'rgba(200,40,30,0.6)');

  canvasTex(scene, 'sigil', 256, 256, (c) => {
    c.translate(128, 128);
    c.strokeStyle = 'rgba(255,255,255,1)';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, 0, 118, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 96, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 16; i++) {
      c.save();
      c.rotate((i / 16) * Math.PI * 2);
      c.beginPath();
      c.moveTo(0, -100);
      c.lineTo(i % 2 ? 6 : -6, -112);
      c.lineTo(0, -114);
      c.stroke();
      c.restore();
    }
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      c.lineTo(Math.cos(a) * 92, Math.sin(a) * 92);
    }
    c.closePath();
    c.stroke();
  });

  canvasTex(scene, 'vignette', GAME_W, GAME_H, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, w * 0.66);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(8,4,4,0.38)');
    g.addColorStop(1, 'rgba(4,2,2,0.82)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  canvasTex(scene, 'blessing_orb', 96, 96, (c) => {
    c.fillStyle = radial(c, 48, 48, 48, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,240,180,1)'], [0.4, 'rgba(255,190,80,0.7)'], [1, 'rgba(255,120,30,0)']]);
    c.fillRect(0, 0, 96, 96);
    c.strokeStyle = 'rgba(255,240,200,0.9)';
    c.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(48 + Math.cos(a) * 16, 48 + Math.sin(a) * 16);
      c.lineTo(48 + Math.cos(a) * (i % 2 ? 30 : 40), 48 + Math.sin(a) * (i % 2 ? 30 : 40));
      c.stroke();
    }
  });
}

// =====================================================================================
// Inimigos (olhando para a direita, pés na base do canvas)
// =====================================================================================
interface SoldierStyle {
  w: number;
  h: number;
  seed: number;
  metalLight: string;
  metalDark: string;
  cloth: string;
  clothDark: string;
  trim: string;
  bulk: number;
  helmet: 'kettle' | 'hood' | 'great' | 'executioner';
  shield?: boolean;
  quiver?: boolean;
}

function drawSoldier(c: Ctx, s: SoldierStyle): void {
  const rng = mulberry32(s.seed);
  const cx = s.w / 2;
  const foot = s.h - 4;
  const k = s.bulk;
  const torsoTop = foot - 92 * k;
  const waist = foot - 50 * k;
  const hem = foot - 24 * k;

  // capa traseira
  if (s.helmet === 'executioner' || s.helmet === 'hood') {
    shape(c, [cx - 18 * k, torsoTop + 6, cx - 34 * k, hem + 8 * k, cx - 22 * k, hem + 4, cx - 10 * k, hem + 12 * k, cx - 2, waist], linear(c, 0, torsoTop, 0, hem, [[0, s.clothDark], [1, '#120809']]));
  }
  if (s.quiver) {
    rrect(c, cx - 26 * k, torsoTop - 6, 12 * k, 44 * k, 3, linear(c, 0, torsoTop, 0, torsoTop + 40, [[0, '#5a3b22'], [1, '#2b1a10']]));
    for (let i = 0; i < 3; i++) shape(c, [cx - 24 * k + i * 4, torsoTop - 6, cx - 22 * k + i * 4, torsoTop - 18, cx - 20 * k + i * 4, torsoTop - 6], '#c9b79a', INK, 1);
  }

  // pernas (traseira mais escura)
  const legW = 14 * k;
  rrect(c, cx - 2 * k, waist, legW, foot - waist - 8, 4, '#1c1517');
  rrect(c, cx - 14 * k, waist, legW, foot - waist - 8, 4, '#2a2024');
  // grevas
  rrect(c, cx - 1 * k, foot - 30 * k, legW - 1, 22 * k, 4, linear(c, cx, 0, cx + legW, 0, [[0, s.metalDark], [0.5, s.metalLight], [1, s.metalDark]]));
  rrect(c, cx - 13 * k, foot - 30 * k, legW - 1, 22 * k, 4, linear(c, cx - 13 * k, 0, cx, 0, [[0, s.metalDark], [0.5, s.metalLight], [1, s.metalDark]]));
  // botas
  shape(c, [cx - 2 * k, foot - 10, cx + 16 * k, foot - 8, cx + 18 * k, foot, cx - 2 * k, foot], '#181012');
  shape(c, [cx - 15 * k, foot - 10, cx + 3 * k, foot - 8, cx + 5 * k, foot, cx - 15 * k, foot], '#20161a');

  // saia do tabardo (barra rasgada)
  const skirt: number[] = [cx - 20 * k, waist - 4];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const x = cx - 20 * k + (40 * k * i) / n;
    skirt.push(x, hem + (i % 2 ? 6 : -2) * k + rng() * 4);
  }
  skirt.push(cx + 20 * k, waist - 4);
  shape(c, skirt, linear(c, 0, waist, 0, hem, [[0, s.cloth], [1, s.clothDark]]));

  // torso
  const sh = 26 * k;
  const torsoGrad = linear(c, cx - sh, 0, cx + sh, 0, [[0, s.metalDark], [0.55, s.metalLight], [1, s.metalDark]]);
  shape(c, [cx - sh, torsoTop + 6, cx + sh, torsoTop + 6, cx + 18 * k, waist, cx - 18 * k, waist], torsoGrad);
  // malha (textura)
  c.save();
  c.globalAlpha = 0.25;
  c.strokeStyle = '#000';
  c.lineWidth = 1;
  for (let y = torsoTop + 10; y < waist; y += 4) {
    c.beginPath();
    c.moveTo(cx - 20 * k, y);
    c.lineTo(cx + 20 * k, y);
    c.stroke();
  }
  c.restore();
  // painel do tabardo
  shape(c, [cx - 9 * k, torsoTop + 10, cx + 13 * k, torsoTop + 10, cx + 12 * k, hem - 2, cx - 8 * k, hem - 2], linear(c, 0, torsoTop, 0, hem, [[0, s.cloth], [1, s.clothDark]]), INK, 2);
  c.strokeStyle = s.trim;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx - 6 * k, torsoTop + 13);
  c.lineTo(cx - 5 * k, hem - 5);
  c.moveTo(cx + 10 * k, torsoTop + 13);
  c.lineTo(cx + 9 * k, hem - 5);
  c.stroke();
  // emblema: anel com espadas cruzadas
  const ey = torsoTop + 30 * k;
  c.beginPath();
  c.arc(cx + 2 * k, ey, 6 * k, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(cx - 3 * k, ey - 5 * k);
  c.lineTo(cx + 7 * k, ey + 5 * k);
  c.moveTo(cx + 7 * k, ey - 5 * k);
  c.lineTo(cx - 3 * k, ey + 5 * k);
  c.stroke();
  // cinto
  rrect(c, cx - 19 * k, waist - 8, 38 * k, 7, 2, '#3b2414', INK, 2);
  rrect(c, cx + 2 * k, waist - 9, 8, 9, 1, s.trim, INK, 1.5);

  brushNoise(c, cx - sh, torsoTop, sh * 2, hem - torsoTop, rng, 160 * k, 'rgba(255,240,220,0.08)', 'rgba(0,0,0,0.12)');

  // braço traseiro
  rrect(c, cx - sh - 4, torsoTop + 10, 11 * k, 40 * k, 5, linear(c, 0, torsoTop, 0, torsoTop + 50, [[0, s.metalDark], [1, '#1c1a1d']]));
  ellipse(c, cx - sh + 1, torsoTop + 52 * k, 6 * k, 6 * k, '#2a1d17');

  // escudo (guardião)
  if (s.shield) {
    const sx = cx + 10 * k;
    const sy = torsoTop + 4;
    shape(c, [sx, sy, sx + 34 * k, sy + 4, sx + 36 * k, sy + 70 * k, sx + 18 * k, sy + 92 * k, sx, sy + 72 * k], linear(c, sx, 0, sx + 36 * k, 0, [[0, '#3a3d43'], [0.5, '#5d626a'], [1, '#2a2c31']]), INK, 3);
    shape(c, [sx + 5 * k, sy + 8, sx + 30 * k, sy + 11, sx + 31 * k, sy + 66 * k, sx + 18 * k, sy + 84 * k, sx + 5 * k, sy + 68 * k], linear(c, 0, sy, 0, sy + 80, [[0, s.cloth], [1, s.clothDark]]), null);
    c.strokeStyle = s.trim;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(sx + 18 * k, sy + 38 * k, 10 * k, 0, Math.PI * 2);
    c.moveTo(sx + 18 * k, sy + 22 * k);
    c.lineTo(sx + 18 * k, sy + 56 * k);
    c.stroke();
    ellipse(c, sx + 18 * k, sy + 38 * k, 3 * k, 3 * k, s.trim, INK, 1);
  }

  // ombreiras
  ellipse(c, cx - sh + 6 * k, torsoTop + 10, 12 * k, 9 * k, linear(c, 0, torsoTop, 0, torsoTop + 18, [[0, s.metalLight], [1, s.metalDark]]));
  ellipse(c, cx + sh - 4 * k, torsoTop + 10, 12 * k, 9 * k, linear(c, 0, torsoTop, 0, torsoTop + 18, [[0, s.metalLight], [1, s.metalDark]]));

  // cabeça
  const hy = torsoTop - 12 * k;
  const hx = cx + 3 * k;
  rrect(c, hx - 6 * k, hy + 4, 12 * k, 12 * k, 3, '#2a1d1a');
  switch (s.helmet) {
    case 'kettle': {
      ellipse(c, hx, hy, 15 * k, 15 * k, linear(c, hx - 15, hy - 15, hx + 15, hy + 15, [[0, s.metalLight], [1, s.metalDark]]));
      ellipse(c, hx, hy + 4, 23 * k, 6 * k, linear(c, hx - 23, 0, hx + 23, 0, [[0, s.metalDark], [0.6, s.metalLight], [1, s.metalDark]]));
      ellipse(c, hx + 4 * k, hy + 10, 9 * k, 5 * k, '#0d0809', null);
      ellipse(c, hx + 2 * k, hy + 10, 1.8, 1.4, '#ff5a3a', null);
      ellipse(c, hx + 8 * k, hy + 10, 1.8, 1.4, '#ff5a3a', null);
      break;
    }
    case 'hood': {
      shape(c, [hx - 16 * k, hy + 14, hx - 14 * k, hy - 10, hx + 2, hy - 20 * k, hx + 16 * k, hy - 6, hx + 18 * k, hy + 14], linear(c, 0, hy - 20, 0, hy + 14, [[0, s.cloth], [1, s.clothDark]]));
      ellipse(c, hx + 6 * k, hy + 4, 9 * k, 9 * k, '#0d0809', null);
      ellipse(c, hx + 8 * k, hy + 3, 1.6, 1.3, '#ffcf6a', null);
      // lenço
      shape(c, [hx - 12 * k, hy + 12, hx + 16 * k, hy + 10, hx + 14 * k, hy + 20, hx - 10 * k, hy + 20], s.clothDark, INK, 2);
      break;
    }
    case 'great': {
      rrect(c, hx - 16 * k, hy - 16 * k, 32 * k, 34 * k, 8, linear(c, hx - 16, 0, hx + 16, 0, [[0, s.metalDark], [0.55, s.metalLight], [1, s.metalDark]]), INK, 3);
      rrect(c, hx - 2 * k, hy - 2, 18 * k, 4, 1, '#0d0809', null);
      ellipse(c, hx + 8 * k, hy, 2, 1.5, '#ff6a3a', null);
      // crista
      shape(c, [hx - 4, hy - 16 * k, hx + 4, hy - 16 * k, hx + 2, hy - 30 * k, hx - 10, hy - 26 * k], s.cloth, INK, 2);
      break;
    }
    case 'executioner': {
      // capuz de carrasco sobre elmo
      shape(c, [hx - 20 * k, hy + 18, hx - 18 * k, hy - 10, hx - 4, hy - 26 * k, hx + 4, hy - 34 * k, hx + 10, hy - 22 * k, hx + 20 * k, hy - 4, hx + 20 * k, hy + 18], linear(c, 0, hy - 30, 0, hy + 18, [[0, s.cloth], [1, s.clothDark]]), INK, 3);
      ellipse(c, hx + 1 * k, hy - 2, 4 * k, 2.6 * k, '#060304', null);
      ellipse(c, hx + 11 * k, hy - 2, 4 * k, 2.6 * k, '#060304', null);
      ellipse(c, hx + 1 * k, hy - 2, 1.8 * k, 1.2 * k, '#ff8a3a', null);
      ellipse(c, hx + 11 * k, hy - 2, 1.8 * k, 1.2 * k, '#ff8a3a', null);
      // gola de placas
      shape(c, [hx - 26 * k, hy + 14, hx + 26 * k, hy + 14, hx + 22 * k, hy + 26, hx - 22 * k, hy + 26], linear(c, hx - 26, 0, hx + 26, 0, [[0, s.metalDark], [0.5, s.metalLight], [1, s.metalDark]]), INK, 2.5);
      // correntes
      c.strokeStyle = '#8a8378';
      c.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.ellipse(cx - 18 * k + i * 7 * k, waist + 6 + (i % 2) * 2, 3.5 * k, 2.2 * k, 0, 0, Math.PI * 2);
        c.stroke();
      }
      break;
    }
  }
  // cicatrizes/arranhões no metal
  c.strokeStyle = 'rgba(255,240,220,0.18)';
  c.lineWidth = 1;
  for (let i = 0; i < 6 * k; i++) {
    const x = cx - sh + rng() * sh * 2;
    const y = torsoTop + rng() * (waist - torsoTop);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 4 + rng() * 6, y + 1 + rng() * 3);
    c.stroke();
  }
}

/** Braço + arma, desenhado apontando para a direita a partir do ombro (origem). */
function drawArmWeapon(c: Ctx, kind: 'sword' | 'bow' | 'mace' | 'axe', metalLight: string, metalDark: string): void {
  const oy = c.canvas.height / 2;
  const arm = kind === 'axe' ? 40 : 26;
  const thick = kind === 'axe' ? 13 : 9;
  // manga + manopla
  rrect(c, 2, oy - thick / 2, arm, thick, thick / 2, linear(c, 0, oy - thick / 2, 0, oy + thick / 2, [[0, metalLight], [1, metalDark]]));
  ellipse(c, arm + 2, oy, thick * 0.7, thick * 0.7, '#3b2a22');
  const hx = arm + 2;
  if (kind === 'sword') {
    rrect(c, hx - 4, oy - 2.5, 14, 5, 2, '#3b2414', INK, 1.5);
    rrect(c, hx + 8, oy - 9, 4, 18, 1, '#8a7a5a', INK, 1.5);
    shape(c, [hx + 12, oy - 4, hx + 66, oy - 3, hx + 74, oy, hx + 66, oy + 3, hx + 12, oy + 4], linear(c, 0, oy - 4, 0, oy + 4, [[0, '#e8e6e2'], [0.5, '#9aa0a8'], [1, '#5a6068']]), INK, 1.6);
  } else if (kind === 'bow') {
    c.strokeStyle = '#4a2e1a';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(hx - 18, oy, 40, -0.95, 0.95);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(hx - 18, oy, 40, -0.95, 0.95);
    c.stroke();
    c.strokeStyle = 'rgba(230,220,200,0.8)';
    c.lineWidth = 1;
    const a = 0.95;
    c.beginPath();
    c.moveTo(hx - 18 + Math.cos(-a) * 40, oy + Math.sin(-a) * 40);
    c.lineTo(hx - 18 + Math.cos(a) * 40, oy + Math.sin(a) * 40);
    c.stroke();
  } else if (kind === 'mace') {
    rrect(c, hx - 4, oy - 3, 52, 6, 2, '#3b2414', INK, 1.5);
    ellipse(c, hx + 54, oy, 13, 13, linear(c, hx + 40, oy - 13, hx + 66, oy + 13, [[0, metalLight], [1, metalDark]]), INK, 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      shape(c, [hx + 54 + Math.cos(a) * 10, oy + Math.sin(a) * 10 - 3, hx + 54 + Math.cos(a) * 19, oy + Math.sin(a) * 19, hx + 54 + Math.cos(a) * 10, oy + Math.sin(a) * 10 + 3], metalDark, INK, 1.2);
    }
  } else {
    // machado de carrasco
    rrect(c, hx - 10, oy - 4, 150, 8, 3, linear(c, 0, oy - 4, 0, oy + 4, [[0, '#5a3a22'], [1, '#2a180c']]), INK, 2);
    for (let i = 0; i < 4; i++) rrect(c, hx + 6 + i * 10, oy - 5, 4, 10, 1, '#1a1210', null);
    const bx = hx + 118;
    shape(c, [bx, oy - 6, bx + 20, oy - 46, bx + 44, oy - 40, bx + 52, oy - 4, bx + 50, oy + 26, bx + 34, oy + 44, bx + 14, oy + 30, bx, oy + 6], linear(c, bx, oy - 46, bx + 52, oy + 44, [[0, metalLight], [0.5, '#7a7f87'], [1, metalDark]]), INK, 3);
    c.strokeStyle = 'rgba(255,240,220,0.7)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bx + 44, oy - 38);
    c.quadraticCurveTo(bx + 56, oy, bx + 34, oy + 42);
    c.stroke();
    // sangue seco
    c.fillStyle = 'rgba(90,16,16,0.7)';
    c.beginPath();
    c.ellipse(bx + 40, oy + 18, 8, 5, 0.6, 0, Math.PI * 2);
    c.fill();
    ellipse(c, bx + 10, oy, 6, 6, '#2a2626');
  }
}

function makeEnemyTextures(scene: Phaser.Scene): void {
  canvasTex(scene, 'enemy_recruit', 120, 150, (c, w, h) =>
    drawSoldier(c, { w, h, seed: 11, metalLight: '#9aa0a8', metalDark: '#3e4148', cloth: '#7a1c22', clothDark: '#3a0c10', trim: '#c9a14a', bulk: 1, helmet: 'kettle' })
  );
  canvasTex(scene, 'enemy_archer', 120, 150, (c, w, h) =>
    drawSoldier(c, { w, h, seed: 23, metalLight: '#7d6a58', metalDark: '#3a2c22', cloth: '#4a2a2c', clothDark: '#22120f', trim: '#b88a3a', bulk: 0.92, helmet: 'hood', quiver: true })
  );
  canvasTex(scene, 'enemy_guardian', 170, 190, (c, w, h) =>
    drawSoldier(c, { w, h, seed: 37, metalLight: '#8a9098', metalDark: '#2a2d33', cloth: '#5a1418', clothDark: '#260709', trim: '#d4a548', bulk: 1.32, helmet: 'great', shield: true })
  );
  canvasTex(scene, 'boss_executioner', 240, 270, (c, w, h) =>
    drawSoldier(c, { w, h, seed: 53, metalLight: '#6c6f76', metalDark: '#1c1d22', cloth: '#6a0f12', clothDark: '#2a0406', trim: '#e0a040', bulk: 1.95, helmet: 'executioner' })
  );
  canvasTex(scene, 'weapon_sword', 112, 24, (c) => drawArmWeapon(c, 'sword', '#9aa0a8', '#3e4148'));
  canvasTex(scene, 'weapon_bow', 80, 96, (c) => drawArmWeapon(c, 'bow', '#7d6a58', '#3a2c22'));
  canvasTex(scene, 'weapon_mace', 104, 44, (c) => drawArmWeapon(c, 'mace', '#8a9098', '#2a2d33'));
  canvasTex(scene, 'weapon_axe', 230, 110, (c) => drawArmWeapon(c, 'axe', '#9a9ea6', '#2a2c31'));

  // Boneco de treino
  canvasTex(scene, 'dummy', 90, 140, (c) => {
    const cx = 45;
    rrect(c, cx - 5, 40, 10, 96, 3, linear(c, cx - 5, 0, cx + 5, 0, [[0, '#4a3020'], [0.5, '#7a5434'], [1, '#3a2416']]));
    rrect(c, cx - 34, 56, 68, 9, 3, '#6a4428');
    shape(c, [cx - 22, 52, cx + 22, 52, cx + 18, 100, cx - 18, 100], linear(c, 0, 52, 0, 100, [[0, '#b39a62'], [1, '#7a6438']]));
    c.strokeStyle = 'rgba(60,40,20,0.6)';
    c.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.moveTo(cx - 18 + i * 5, 54);
      c.lineTo(cx - 16 + i * 4.5, 98);
      c.stroke();
    }
    rrect(c, cx - 22, 70, 44, 6, 2, '#3a2416');
    ellipse(c, cx, 36, 16, 17, linear(c, 0, 20, 0, 52, [[0, '#c4ab74'], [1, '#8a7244']]));
    c.strokeStyle = '#7a1c22';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx - 7, 29);
    c.lineTo(cx + 7, 43);
    c.moveTo(cx + 7, 29);
    c.lineTo(cx - 7, 43);
    c.stroke();
    // alvo pintado
    c.strokeStyle = 'rgba(122,28,34,0.8)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, 82, 9, 0, Math.PI * 2);
    c.stroke();
  });
}

// =====================================================================================
// Ambiente
// =====================================================================================
function makeEnvironment(scene: Phaser.Scene): void {

  // porta de saída (arco + folhas de ferro); o ícone da recompensa é desenhado à parte
  canvasTex(scene, 'door', 170, 230, (c) => {
    c.fillStyle = '#050304';
    c.beginPath();
    c.moveTo(14, 230);
    c.lineTo(14, 85);
    c.arc(85, 85, 71, Math.PI, 0);
    c.lineTo(156, 230);
    c.closePath();
    c.fill();
    c.strokeStyle = '#4a3a30';
    c.lineWidth = 12;
    c.stroke();
    c.strokeStyle = '#8a6a3a';
    c.lineWidth = 2;
    c.stroke();
    for (const [x0, x1] of [[22, 84], [86, 148]]) {
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#24201e');
      g.addColorStop(0.5, '#3e3632');
      g.addColorStop(1, '#1c1816');
      c.fillStyle = g;
      c.fillRect(x0, 92, x1 - x0, 138);
      c.strokeStyle = '#0c0909';
      c.lineWidth = 2;
      c.strokeRect(x0, 92, x1 - x0, 138);
      for (let yy = 112; yy < 226; yy += 30) {
        c.fillStyle = '#5a4a3a';
        c.fillRect(x0 + 4, yy, x1 - x0 - 8, 4);
      }
    }
  });
  // feixe vertical de luz (Juízo do Segundo Sol / pilar)
  canvasTex(scene, 'beam', 96, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 96, 0);
    g.addColorStop(0, 'rgba(255,220,140,0)');
    g.addColorStop(0.3, 'rgba(255,230,160,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,240,1)');
    g.addColorStop(0.7, 'rgba(255,230,160,0.55)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 96, 512);
    const v = c.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, 'rgba(0,0,0,1)');
    v.addColorStop(0.25, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = v;
    c.fillRect(0, 0, 96, 512);
    c.globalCompositeOperation = 'source-over';
  });
  canvasTex(scene, 'pillar', 110, 270, (c) => drawPillar(c, false));
  canvasTex(scene, 'pillar_broken', 110, 270, (c) => drawPillar(c, true));

  canvasTex(scene, 'brazier', 80, 110, (c) => {
    const cx = 40;
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(cx - 20, 106);
    c.lineTo(cx - 6, 52);
    c.moveTo(cx + 20, 106);
    c.lineTo(cx + 6, 52);
    c.moveTo(cx, 106);
    c.lineTo(cx, 52);
    c.stroke();
    c.strokeStyle = '#3a3230';
    c.lineWidth = 3;
    c.stroke();
    shape(c, [cx - 30, 36, cx + 30, 36, cx + 22, 58, cx - 22, 58], linear(c, cx - 30, 0, cx + 30, 0, [[0, '#2a2422'], [0.5, '#5a4e48'], [1, '#1e1a19']]), INK, 3);
    ellipse(c, cx, 36, 30, 7, radial(c, cx, 36, 30, [[0, '#ffe7a0'], [0.4, '#ff9b3d'], [1, '#6a1a08']]), INK, 2.5);
  });

  canvasTex(scene, 'banner', 96, 220, (c) => {
    const rng = mulberry32(99);
    rrect(c, 4, 6, 88, 10, 3, '#3a2a20');
    const pts = [12, 14, 84, 14, 84, 190];
    for (let i = 0; i <= 6; i++) pts.push(84 - i * 12, 190 + (i % 2 ? 22 : 4) + rng() * 6);
    pts.push(12, 190);
    shape(c, pts, linear(c, 0, 14, 0, 210, [[0, '#5e1418'], [1, '#22060a']]), INK, 2.5);
    c.strokeStyle = '#c99a44';
    c.lineWidth = 2;
    c.strokeRect(18, 20, 60, 160);
    c.beginPath();
    c.arc(48, 90, 20, 0, Math.PI * 2);
    c.moveTo(34, 76);
    c.lineTo(62, 104);
    c.moveTo(62, 76);
    c.lineTo(34, 104);
    c.stroke();
    brushNoise(c, 12, 14, 72, 190, rng, 260, 'rgba(255,220,200,0.05)', 'rgba(0,0,0,0.2)');
  });

  canvasTex(scene, 'gate', 220, 270, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 9;
    for (let x = 14; x < 220; x += 26) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 262);
      c.stroke();
    }
    for (let y = 20; y < 262; y += 34) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(220, y);
      c.stroke();
    }
    c.strokeStyle = '#4a4440';
    c.lineWidth = 4;
    for (let x = 14; x < 220; x += 26) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 262);
      c.stroke();
      shape(c, [x - 5, 258, x + 5, 258, x, 270], '#5a524c', INK, 1.5);
    }
    for (let y = 20; y < 262; y += 34) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(220, y);
      c.stroke();
    }
  });

  canvasTex(scene, 'weapon_rack', 140, 100, (c) => {
    rrect(c, 8, 20, 124, 8, 2, '#4a2e1a');
    rrect(c, 8, 70, 124, 8, 2, '#4a2e1a');
    rrect(c, 10, 14, 8, 84, 2, '#3a2416');
    rrect(c, 122, 14, 8, 84, 2, '#3a2416');
    for (let i = 0; i < 4; i++) {
      const x = 32 + i * 24;
      shape(c, [x - 3, 6, x + 3, 6, x + 3, 86, x, 94, x - 3, 86], linear(c, x - 3, 0, x + 3, 0, [[0, '#cfcac2'], [1, '#5a5f66']]), INK, 1.5);
      rrect(c, x - 8, 60, 16, 4, 1, '#8a6a3a', INK, 1);
    }
  });

  canvasTex(scene, 'rubble', 90, 44, (c) => {
    const rng = mulberry32(5);
    for (let i = 0; i < 7; i++) {
      const x = 10 + rng() * 70;
      const y = 14 + rng() * 22;
      const r = 6 + rng() * 10;
      shape(c, [x - r, y, x - r * 0.4, y - r * 0.8, x + r * 0.6, y - r * 0.6, x + r, y + r * 0.2, x, y + r * 0.6], linear(c, 0, y - r, 0, y + r, [[0, '#5a4e48'], [1, '#241c1a']]), INK, 1.5);
    }
  });

  canvasTex(scene, 'altar', 240, 130, (c) => {
    const cx = 120;
    ellipse(c, cx, 74, 112, 48, linear(c, 0, 26, 0, 122, [[0, '#4a3e38'], [1, '#1c1514']]), INK, 3);
    ellipse(c, cx, 64, 104, 42, linear(c, 0, 22, 0, 106, [[0, '#5e504a'], [1, '#2e2624']]), INK, 2);
    c.strokeStyle = 'rgba(232,178,74,0.75)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(cx, 64, 86, 32, 0, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(cx, 64, 40, 15, 0, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 46, 64 + Math.sin(a) * 17);
      c.lineTo(cx + Math.cos(a) * 80, 64 + Math.sin(a) * 30);
      c.stroke();
    }
  });
}

function drawPillar(c: Ctx, broken: boolean): void {
  const rng = mulberry32(broken ? 77 : 41);
  const cx = 55;
  const base = 252;
  // plinto
  shape(c, [cx - 46, base, cx - 46, base - 22, cx + 46, base - 22, cx + 46, base], linear(c, cx - 46, 0, cx + 46, 0, [[0, '#2a221f'], [0.4, '#6a5c54'], [1, '#1e1816']]), INK, 3);
  shape(c, [cx - 40, base - 22, cx - 40, base - 34, cx + 40, base - 34, cx + 40, base - 22], linear(c, cx - 40, 0, cx + 40, 0, [[0, '#2e2622'], [0.45, '#78685e'], [1, '#221b19']]), INK, 2.5);
  const top = broken ? 70 : 30;
  // fuste
  const shaft = (): void => {
    c.beginPath();
    c.moveTo(cx - 30, base - 34);
    c.lineTo(cx - 30, top + 10);
    if (broken) {
      const pts = [cx - 30, top + 10, cx - 18, top - 8, cx - 8, top + 6, cx + 4, top - 20, cx + 14, top + 2, cx + 22, top - 6, cx + 30, top + 14];
      for (let i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    } else {
      c.lineTo(cx + 30, top + 10);
    }
    c.lineTo(cx + 30, base - 34);
    c.closePath();
  };
  shaft();
  c.fillStyle = linear(c, cx - 30, 0, cx + 30, 0, [[0, '#231c1a'], [0.35, '#6e6058'], [0.55, '#837368'], [1, '#1c1615']]);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.stroke();
  // caneluras
  c.strokeStyle = 'rgba(0,0,0,0.3)';
  c.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(cx + i * 11, base - 36);
    c.lineTo(cx + i * 11, top + (broken ? 18 : 14));
    c.stroke();
  }
  brushNoise(c, cx - 30, top, 60, base - top - 34, rng, 260, 'rgba(255,230,200,0.06)', 'rgba(0,0,0,0.18)');
  if (!broken) {
    shape(c, [cx - 42, top + 14, cx - 42, top - 2, cx + 42, top - 2, cx + 42, top + 14], linear(c, cx - 42, 0, cx + 42, 0, [[0, '#2a221f'], [0.45, '#7a6a60'], [1, '#1e1816']]), INK, 3);
    shape(c, [cx - 36, top - 2, cx - 36, top - 16, cx + 36, top - 16, cx + 36, top - 2], linear(c, cx - 36, 0, cx + 36, 0, [[0, '#2e2622'], [0.45, '#86766a'], [1, '#221b19']]), INK, 2.5);
  }
  // rachaduras
  c.strokeStyle = 'rgba(0,0,0,0.65)';
  c.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    let x = cx - 20 + rng() * 40;
    let y = top + 30 + rng() * 80;
    c.beginPath();
    c.moveTo(x, y);
    for (let i = 0; i < 5; i++) {
      x += (rng() - 0.5) * 14;
      y += 10 + rng() * 10;
      c.lineTo(x, y);
    }
    c.stroke();
  }
}

/** Placeholder do Atriox caso as poses extraídas não carreguem. */
export function makeAtrioxFallback(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  canvasTex(scene, key, 120, 250, (c, w, h) =>
    drawSoldier(c, { w, h, seed: 3, metalLight: '#e2c98a', metalDark: '#6a5530', cloth: '#3a2448', clothDark: '#170c1e', trim: '#e8b24a', bulk: 1.5, helmet: 'kettle' })
  );
}

export function generateAllTextures(scene: Phaser.Scene): void {
  makeFxTextures(scene);
  makeEnemyTextures(scene);
  makeEnvironment(scene);
}
