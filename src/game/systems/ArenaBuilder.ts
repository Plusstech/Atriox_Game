import Phaser from 'phaser';
import { ARENA_CENTER, DEPTH, FLOOR, WORLD_H, WORLD_W } from '../config/constants';
import type { CircleObstacle } from './Collision';
import { particleScale } from '../services';
import { paintArena, type ArenaTheme } from '../fx/ArenaPainter';

export interface ArenaLayout {
  theme: ArenaTheme;
  /** todos os objetos da sala (destruídos ao trocar de sala) */
  objects: Phaser.GameObjects.GameObject[];
  obstacles: CircleObstacle[];
  gate: Phaser.GameObjects.Image;
  gatePos: { x: number; y: number };
  altarPos: { x: number; y: number };
  /** posições das portas de saída (na muralha superior) */
  doorSlots: { x: number; y: number }[];
}

/**
 * Monta uma sala da arena. Decoração concentrada nas bordas; centro livre.
 * - 'trial': Campo de Provação da Liga Sóbele (adaptação jogável, não canônica).
 * - 'nemeia': Arena de Nemeia, cidade em chamas (cenário do confronto com Caim).
 */
export function buildArena(scene: Phaser.Scene, theme: ArenaTheme): ArenaLayout {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objects.push(o);
    return o;
  };
  add(scene.add.image(0, 0, paintArena(scene, theme)).setOrigin(0).setDepth(DEPTH.background));

  const obstacles: CircleObstacle[] = [];
  const cx = ARENA_CENTER.x;
  const cy = ARENA_CENTER.y;
  const nemeia = theme === 'nemeia';

  // pilares nas bordas (centro livre para o combate)
  const pillars: [number, number, boolean][] = [
    [cx - 760, cy - 340, nemeia],
    [cx + 760, cy - 340, true],
    [cx - 800, cy + 330, true],
    [cx + 800, cy + 330, nemeia],
    [cx - 640, cy - 470, false],
    [cx + 640, cy - 470, nemeia]
  ];
  for (const [x, y, broken] of pillars) {
    const img = add(scene.add.image(x, y, broken ? 'pillar_broken' : 'pillar').setOrigin(0.5, 0.93).setDepth(y).setScale(0.9));
    if (nemeia) img.setTint(0xd8b0a0);
    add(scene.add.image(x + 18, y + 4, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(140, 42).setAlpha(0.8));
    obstacles.push({ x, y: y - 4, r: 36 });
    if (broken) add(scene.add.image(x + 60, y + 30, 'rubble').setDepth(y + 30).setScale(0.9));
  }
  for (const [x, y] of [
    [FLOOR.x + 60, cy - 60],
    [FLOOR.x + FLOOR.w - 60, cy + 80],
    [cx - 360, FLOOR.y + FLOOR.h - 30],
    [cx + 460, FLOOR.y + FLOOR.h - 40]
  ]) {
    add(scene.add.image(x, y, 'rubble').setDepth(y).setScale(0.8 + Math.random() * 0.4).setFlipX(Math.random() < 0.5));
  }

  if (!nemeia) {
    for (const x of [FLOOR.x + 160, FLOOR.x + FLOOR.w - 160]) {
      add(scene.add.image(x, FLOOR.y - 2, 'weapon_rack').setOrigin(0.5, 1).setDepth(FLOOR.y - 2).setScale(0.85));
    }
  }
  for (const x of [FLOOR.x + 340, FLOOR.x + 700, FLOOR.x + FLOOR.w - 700, FLOOR.x + FLOOR.w - 340]) {
    const b = add(scene.add.image(x, 112, 'banner').setOrigin(0.5, 0).setDepth(DEPTH.decal));
    if (nemeia) b.setTint(0x9a6a6a).setAngle(Math.random() * 6 - 3);
    scene.tweens.add({ targets: b, angle: { from: -1.2, to: 1.2 }, duration: 2600 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const gatePos = { x: WORLD_W / 2, y: FLOOR.y - 40 };
  const gate = add(scene.add.image(gatePos.x, gatePos.y - 262, 'gate').setOrigin(0.5, 0).setDepth(DEPTH.decal + 5).setScale(0.95, 1));

  // braseiros nas bordas
  const braziers = [
    { x: cx - 520, y: cy - 300 },
    { x: cx + 520, y: cy - 300 },
    { x: cx - 560, y: cy + 340 },
    { x: cx + 560, y: cy + 340 },
    { x: gatePos.x - 170, y: FLOOR.y + 40 },
    { x: gatePos.x + 170, y: FLOOR.y + 40 }
  ];
  for (const b of braziers) {
    add(scene.add.image(b.x, b.y, 'brazier').setOrigin(0.5, 0.96).setDepth(b.y).setScale(0.8));
    add(scene.add.image(b.x, b.y + 2, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(60, 18));
    obstacles.push({ x: b.x, y: b.y, r: 20 });
    const light = add(scene.add.image(b.x, b.y - 30, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(nemeia ? 0xff5a2a : 0xff8a3a).setDepth(DEPTH.groundFx));
    light.setDisplaySize(560, 380).setAlpha(0.5);
    scene.tweens.add({ targets: light, alpha: { from: 0.42, to: 0.6 }, duration: 140 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const fire = add(
      scene.add.particles(b.x, b.y - 58, 'p_ember', {
        x: { min: -12, max: 12 },
        speedY: { min: -110, max: -50 },
        speedX: { min: -12, max: 12 },
        lifespan: { min: 300, max: 650 },
        scale: { start: 2.6, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffe0a0, 0xff9b3d, 0xff6a20],
        blendMode: 'ADD',
        frequency: 32 / particleScale(),
        quantity: 1
      })
    );
    fire.setDepth(b.y + 1);
  }

  const altarPos = { x: cx, y: cy };
  if (!nemeia) add(scene.add.image(altarPos.x, altarPos.y, 'altar').setDepth(DEPTH.decal + 20).setScale(0.9));

  // partículas ambientes (limitadas)
  add(
    scene.add
      .particles(0, 0, 'p_ember', {
        x: { min: FLOOR.x, max: FLOOR.x + FLOOR.w },
        y: { min: FLOOR.y + 200, max: WORLD_H },
        speedY: { min: -40, max: -15 },
        speedX: { min: -10, max: 20 },
        lifespan: { min: 4000, max: 8000 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: nemeia ? [0xff6a20, 0xff3010] : [0xffa040, 0xff6a20],
        blendMode: 'ADD',
        frequency: (nemeia ? 45 : 90) / particleScale(),
        maxParticles: 120
      })
      .setDepth(DEPTH.overlayFx - 100)
  );

  const doorSlots = [
    { x: cx - 460, y: FLOOR.y - 6 },
    { x: cx + 460, y: FLOOR.y - 6 }
  ];
  return { theme, objects, obstacles, gate, gatePos, altarPos, doorSlots };
}

export function destroyArena(scene: Phaser.Scene, layout: ArenaLayout): void {
  for (const o of layout.objects) {
    scene.tweens.killTweensOf(o);
    o.destroy();
  }
  layout.objects.length = 0;
}
