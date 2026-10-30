import Phaser from 'phaser';
import { ARENA_CENTER, DEPTH, FLOOR, WORLD_H, WORLD_W } from '../config/constants';
import type { CircleObstacle } from './Collision';
import { particleScale } from '../services';

export interface ArenaLayout {
  obstacles: CircleObstacle[];
  gate: Phaser.GameObjects.Image;
  gatePos: { x: number; y: number };
  altarPos: { x: number; y: number };
  braziers: { x: number; y: number }[];
}

/**
 * Monta o Campo de Provação: piso, muralhas, pilares, braseiros, estandartes,
 * partículas ambientes. Proposta de adaptação jogável inspirada na atmosfera
 * da Liga Sóbele (não é uma localização canônica).
 */
export function buildArena(scene: Phaser.Scene): ArenaLayout {
  scene.add.image(0, 0, 'arena_bg').setOrigin(0).setDepth(DEPTH.background);

  const obstacles: CircleObstacle[] = [];
  const cx = ARENA_CENTER.x;
  const cy = ARENA_CENTER.y;

  // pilares (alguns quebrados) — longe do círculo central
  const pillars: [number, number, boolean][] = [
    [cx - 640, cy - 330, false],
    [cx + 640, cy - 330, true],
    [cx - 700, cy + 300, true],
    [cx + 700, cy + 300, false],
    [cx - 230, cy - 470, false],
    [cx + 230, cy - 470, false]
  ];
  for (const [x, y, broken] of pillars) {
    const img = scene.add.image(x, y, broken ? 'pillar_broken' : 'pillar').setOrigin(0.5, 0.93).setDepth(y);
    img.setScale(0.9);
    scene.add.image(x + 18, y + 4, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(140, 42).setAlpha(0.8);
    obstacles.push({ x, y: y - 4, r: 36 });
    if (broken) {
      scene.add.image(x + 60, y + 30, 'rubble').setDepth(y + 30).setScale(0.9);
    }
  }

  // entulho decorativo
  for (const [x, y] of [
    [cx - 880, cy - 60],
    [cx + 900, cy + 80],
    [cx - 300, cy + 520],
    [cx + 420, cy - 520]
  ]) {
    scene.add.image(x, y, 'rubble').setDepth(y).setScale(0.8 + Math.random() * 0.4).setFlipX(Math.random() < 0.5);
  }

  // armeiros encostados na muralha
  for (const x of [FLOOR.x + 160, FLOOR.x + 520, FLOOR.x + FLOOR.w - 520, FLOOR.x + FLOOR.w - 160]) {
    scene.add.image(x, FLOOR.y - 2, 'weapon_rack').setOrigin(0.5, 1).setDepth(FLOOR.y - 2).setScale(0.85);
  }

  // estandartes na muralha com leve balanço
  for (const x of [FLOOR.x + 340, FLOOR.x + 700, FLOOR.x + FLOOR.w - 700, FLOOR.x + FLOOR.w - 340]) {
    const b = scene.add.image(x, 112, 'banner').setOrigin(0.5, 0).setDepth(DEPTH.decal);
    scene.tweens.add({ targets: b, angle: { from: -1.2, to: 1.2 }, duration: 2600 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // portão (grade levadiça)
  const gatePos = { x: WORLD_W / 2, y: FLOOR.y - 40 };
  const gate = scene.add.image(gatePos.x, gatePos.y - 262, 'gate').setOrigin(0.5, 0).setDepth(DEPTH.decal + 5).setScale(0.95, 1);

  // braseiros com luz pulsante
  const braziers = [
    { x: cx - 420, y: cy - 280 },
    { x: cx + 420, y: cy - 280 },
    { x: cx - 460, y: cy + 330 },
    { x: cx + 460, y: cy + 330 },
    { x: gatePos.x - 170, y: FLOOR.y + 40 },
    { x: gatePos.x + 170, y: FLOOR.y + 40 }
  ];
  for (const b of braziers) {
    scene.add.image(b.x, b.y, 'brazier').setOrigin(0.5, 0.96).setDepth(b.y).setScale(0.8);
    scene.add.image(b.x, b.y + 2, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(60, 18);
    obstacles.push({ x: b.x, y: b.y, r: 20 });
    const light = scene.add.image(b.x, b.y - 30, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a3a).setDepth(DEPTH.groundFx);
    light.setDisplaySize(560, 380).setAlpha(0.55);
    scene.tweens.add({ targets: light, alpha: { from: 0.45, to: 0.62 }, scaleX: light.scaleX * 1.05, duration: 140 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const fire = scene.add.particles(b.x, b.y - 58, 'p_ember', {
      x: { min: -12, max: 12 },
      speedY: { min: -110, max: -50 },
      speedX: { min: -12, max: 12 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 2.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe0a0, 0xff9b3d, 0xff6a20],
      blendMode: 'ADD',
      frequency: 28 / particleScale(),
      quantity: 1
    });
    fire.setDepth(b.y + 1);
  }

  // altar da Provação (ponto de interação)
  const altarPos = { x: cx, y: cy };
  scene.add.image(altarPos.x, altarPos.y, 'altar').setDepth(DEPTH.decal + 20).setScale(0.9);

  // partículas ambientes: brasas subindo e poeira no ar
  scene.add
    .particles(0, 0, 'p_ember', {
      x: { min: FLOOR.x, max: FLOOR.x + FLOOR.w },
      y: { min: FLOOR.y + 200, max: WORLD_H },
      speedY: { min: -40, max: -15 },
      speedX: { min: -10, max: 20 },
      lifespan: { min: 4000, max: 8000 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffa040, 0xff6a20],
      blendMode: 'ADD',
      frequency: 90 / particleScale()
    })
    .setDepth(DEPTH.overlayFx - 100);
  scene.add
    .particles(0, 0, 'p_dust', {
      x: { min: FLOOR.x, max: FLOOR.x + FLOOR.w },
      y: { min: FLOOR.y, max: FLOOR.y + FLOOR.h },
      speedX: { min: 4, max: 18 },
      speedY: { min: -6, max: 6 },
      lifespan: { min: 5000, max: 9000 },
      scale: { start: 0.3, end: 0.6 },
      alpha: { start: 0, end: 0.25, ease: 'Sine.easeInOut' },
      frequency: 160 / particleScale()
    })
    .setDepth(DEPTH.overlayFx - 110);

  return { obstacles, gate, gatePos, altarPos, braziers };
}
