import Phaser from 'phaser';
import { flashAllowed } from '../services';

export type AnimState = 'idle' | 'run' | 'attack_1' | 'attack_2' | 'attack_3' | 'dash' | 'cast' | 'hurt' | 'death';
export type PoseKey = 'idle' | 'lunge' | 'slash' | 'cast' | 'dash' | 'hurt';
export type AttackPhase = 'windup' | 'active' | 'recovery';

export const ANIM_STATES: AnimState[] = ['idle', 'run', 'attack_1', 'attack_2', 'attack_3', 'dash', 'cast', 'hurt', 'death'];

/** Prioridade: estados de maior prioridade não são sobrescritos por menores via play(). */
export const ANIM_PRIORITY: Record<AnimState, number> = {
  idle: 0,
  run: 1,
  attack_1: 5,
  attack_2: 5,
  attack_3: 5,
  cast: 6,
  dash: 7,
  hurt: 8,
  death: 10
};

export interface PoseMeta {
  originX: number;
  originY: number;
}

interface Frame {
  pose: PoseKey;
  rot: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  alpha: number;
}

const ease = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * AnimationController do Atriox.
 *
 * O concept sheet fornece 6 poses estáticas (idle, lunge, slash, cast, dash, hurt).
 * Cada estado de animação combina uma pose com transformações procedurais
 * (rotação, squash & stretch, deslocamento) e crossfade entre poses.
 * Quando houver spritesheets definitivos, `poseFor()` pode ser substituído por
 * animações por quadros do Phaser mantendo a mesma interface de estados.
 */
export class AtrioxAnimator {
  readonly sprite: Phaser.GameObjects.Sprite;
  private ghost: Phaser.GameObjects.Sprite;
  state: AnimState = 'idle';
  /** tempo no estado atual (ms) */
  t = 0;
  /** multiplicador de velocidade (painel de desenvolvimento) */
  speed = 1;
  baseScale: number;
  facing = 1;
  attackPhase: AttackPhase = 'windup';
  /** progresso 0..1 dentro da fase de ataque/conjuração */
  phaseT = 0;
  private currentPose: PoseKey | null = null;
  private ghostAlpha = 0;
  private flashTimer = 0;
  private blend = { rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, t: 1 };
  private last: Frame = { pose: 'idle', rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, alpha: 1 };
  private listeners: ((ev: 'start', state: AnimState) => void)[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly poses: Record<string, PoseMeta>,
    scale: number,
    private readonly texturePrefix = 'atriox_'
  ) {
    this.baseScale = scale;
    this.ghost = scene.add.sprite(x, y, `${texturePrefix}idle`).setAlpha(0);
    this.sprite = scene.add.sprite(x, y, `${texturePrefix}idle`);
    this.setPose('idle');
  }

  onStart(fn: (ev: 'start', state: AnimState) => void): void {
    this.listeners.push(fn);
  }

  /** Troca de estado respeitando prioridade (a menos que force). */
  play(state: AnimState, force = false): boolean {
    if (state === this.state) return true;
    if (!force && ANIM_PRIORITY[state] < ANIM_PRIORITY[this.state] && this.state !== 'idle' && this.state !== 'run') return false;
    this.blend = { rot: this.last.rot, sx: this.last.sx, sy: this.last.sy, ox: this.last.ox, oy: this.last.oy, t: 0 };
    this.state = state;
    this.t = 0;
    this.listeners.forEach((l) => l('start', state));
    return true;
  }

  /** Usado pelo Player: define o estado a cada quadro, sem checar prioridade. */
  set(state: AnimState): void {
    if (state !== this.state) this.play(state, true);
  }

  flash(ms = 70): void {
    this.flashTimer = ms;
  }

  private setPose(pose: PoseKey): void {
    if (pose === this.currentPose) return;
    const key = `${this.texturePrefix}${pose}`;
    if (this.currentPose) {
      // crossfade: o fantasma mantém a pose anterior por alguns ms
      this.ghost.setTexture(this.sprite.texture.key);
      this.ghost.setOrigin(this.sprite.originX, this.sprite.originY);
      this.ghostAlpha = 0.85;
    }
    this.currentPose = pose;
    this.sprite.setTexture(this.sprite.scene.textures.exists(key) ? key : `${this.texturePrefix}idle`);
    const m = this.poses[pose] ?? { originX: 0.5, originY: 0.98 };
    this.sprite.setOrigin(m.originX, m.originY);
  }

  private frame(): Frame {
    const t = this.t;
    const p = this.phaseT;
    const f: Frame = { pose: 'idle', rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, alpha: 1 };
    switch (this.state) {
      case 'idle': {
        const b = Math.sin((t / 1700) * Math.PI * 2);
        f.sy = 1 + 0.014 * b;
        f.sx = 1 - 0.006 * b;
        break;
      }
      case 'run': {
        const ph = (t / 400) * Math.PI * 2;
        f.pose = 'lunge';
        f.oy = -Math.abs(Math.sin(ph)) * 6;
        f.rot = 0.03 * Math.sin(ph) + 0.03;
        f.sx = 1 + 0.025 * Math.cos(ph * 2);
        f.sy = 1 - 0.025 * Math.cos(ph * 2);
        break;
      }
      case 'attack_1': {
        f.pose = 'lunge';
        if (this.attackPhase === 'windup') {
          f.rot = -0.14 * ease(p);
          f.ox = -5 * ease(p);
          f.sy = 1 + 0.03 * ease(p);
        } else if (this.attackPhase === 'active') {
          f.rot = -0.14 + 0.28 * ease(p);
          f.ox = 10 * ease(p);
          f.sx = 1.05;
          f.sy = 0.97;
        } else {
          f.rot = 0.14 * (1 - ease(p));
          f.ox = 10 * (1 - ease(p));
        }
        break;
      }
      case 'attack_2': {
        if (this.attackPhase === 'windup') {
          f.pose = 'lunge';
          f.rot = -0.08 * ease(p);
          f.sx = 1 - 0.05 * ease(p);
          f.ox = -4 * ease(p);
        } else if (this.attackPhase === 'active') {
          f.pose = 'slash';
          f.sx = 1.06 - 0.04 * p;
          f.ox = 12 * ease(p);
        } else {
          f.pose = 'slash';
          f.ox = 12 * (1 - ease(p));
          f.sx = 1.02 - 0.02 * p;
        }
        break;
      }
      case 'attack_3': {
        if (this.attackPhase === 'windup') {
          f.pose = 'lunge';
          f.rot = -0.22 * ease(p);
          f.sx = 1 + 0.07 * ease(p);
          f.sy = 1 - 0.09 * ease(p);
          f.ox = -8 * ease(p);
          f.oy = 2 * ease(p);
        } else if (this.attackPhase === 'active') {
          f.pose = 'slash';
          f.sx = 1.14 - 0.04 * p;
          f.sy = 1.1 - 0.04 * p;
          f.ox = 16;
          f.rot = 0.04;
        } else {
          f.pose = 'slash';
          f.sx = 1.1 - 0.1 * ease(p);
          f.sy = 1.06 - 0.06 * ease(p);
          f.ox = 16 * (1 - ease(p));
        }
        break;
      }
      case 'dash':
        f.pose = 'dash';
        f.sx = 1.1;
        f.sy = 0.94;
        f.oy = -3;
        f.alpha = 0.92;
        break;
      case 'cast': {
        f.pose = 'cast';
        const e = ease(p);
        f.sy = 1 + 0.03 * e;
        f.sx = 1 - 0.01 * e;
        f.rot = -0.03 * e;
        break;
      }
      case 'hurt':
        f.pose = 'hurt';
        f.ox = -8 * (1 - ease(t / 200));
        f.rot = -0.08 * (1 - ease(t / 220));
        break;
      case 'death': {
        f.pose = 'hurt';
        const e = ease(t / 750);
        f.rot = -1.35 * e;
        f.oy = 14 * e;
        f.ox = -18 * e;
        f.alpha = 1 - 0.25 * e;
        break;
      }
    }
    return f;
  }

  update(dt: number, x: number, y: number, depth: number): void {
    const sdt = dt * this.speed;
    this.t += sdt;
    if (this.blend.t < 1) this.blend.t = Math.min(1, this.blend.t + sdt / 90);
    const f = this.frame();
    const b = ease(this.blend.t);
    const lerp = (a: number, c: number): number => a + (c - a) * b;
    const rot = lerp(this.blend.rot, f.rot);
    const sx = lerp(this.blend.sx, f.sx);
    const sy = lerp(this.blend.sy, f.sy);
    const ox = lerp(this.blend.ox, f.ox);
    const oy = lerp(this.blend.oy, f.oy);
    this.last = { pose: f.pose, rot, sx, sy, ox, oy, alpha: f.alpha };

    this.setPose(f.pose);
    const s = this.baseScale;
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(x + ox * this.facing, y + oy);
    this.sprite.setScale(s * sx, s * sy);
    this.sprite.setRotation(rot * this.facing);
    this.sprite.setDepth(depth);

    if (this.ghostAlpha > 0) {
      this.ghostAlpha = Math.max(0, this.ghostAlpha - sdt / 110);
      this.ghost.setAlpha(this.ghostAlpha * this.sprite.alpha);
      this.ghost.setFlipX(this.sprite.flipX);
      this.ghost.setPosition(this.sprite.x, this.sprite.y);
      this.ghost.setScale(this.sprite.scaleX, this.sprite.scaleY);
      this.ghost.setRotation(this.sprite.rotation);
      this.ghost.setDepth(depth - 0.5);
    } else if (this.ghost.alpha !== 0) {
      this.ghost.setAlpha(0);
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (flashAllowed()) this.sprite.setTintFill(0xffffff);
      else this.sprite.setTint(0xffb0a0);
    } else if (this.state === 'death') {
      const k = Math.min(1, this.t / 900);
      const c = Math.round(255 - 140 * k);
      this.sprite.setTint(Phaser.Display.Color.GetColor(c, Math.round(c * 0.85), Math.round(c * 0.85)));
    } else {
      this.sprite.clearTint();
    }
  }

  setAlpha(a: number): void {
    this.sprite.setAlpha(a);
  }

  destroy(): void {
    this.sprite.destroy();
    this.ghost.destroy();
    this.listeners.length = 0;
  }
}
