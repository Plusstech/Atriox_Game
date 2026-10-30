import Phaser from 'phaser';
import { flashAllowed } from '../services';
import { SpriteAnimator, type AnimLibrary } from './SpriteAnimator';
import type { AnimPhase, TimelineEvent } from './FrameTimeline';

export type AnimState =
  | 'return_cut' | 'ascending' | 'charge_hold' | 'execution_mark' | 'orbit' | 'second_step' | 'captive_sun'
  | 'idle'
  | 'run'
  | 'attack_1'
  | 'attack_2'
  | 'attack_3'
  | 'attack_3_glory'
  | 'dash'
  | 'dash_radiant'
  | 'cast'
  | 'cast_sun'
  | 'avatar'
  | 'hurt'
  | 'bloodStunned'
  | 'dead'
  | 'cinematic';
export type AttackPhase = AnimPhase;

export const ANIM_STATES: AnimState[] = [
  'idle', 'run', 'attack_1', 'attack_2', 'attack_3', 'attack_3_glory', 'charge_hold', 'ascending', 'return_cut', 'dash', 'dash_radiant', 'cast', 'cast_sun', 'avatar', 'hurt', 'bloodStunned', 'dead'
];

/**
 * Prioridade (play() sem force respeita): ações não são interrompidas por locomoção.
 * O Player decide o estado a cada quadro (set), então a prioridade protege chamadas externas.
 */
export const ANIM_PRIORITY: Record<AnimState, number> = {
  return_cut: 5, ascending: 5, charge_hold: 4, execution_mark: 5, orbit: 5, second_step: 5, captive_sun: 6,
  idle: 0,
  run: 1,
  attack_1: 5,
  attack_2: 5,
  attack_3: 5,
  attack_3_glory: 5,
  cast: 6,
  cast_sun: 6,
  dash: 7,
  dash_radiant: 7,
  avatar: 8,
  hurt: 8,
  bloodStunned: 9,
  dead: 10,
  cinematic: 11
};

/** Estados cujos quadros são escolhidos pela fase do combate (sincronizados). */
const SYNCED: Partial<Record<AnimState, true>> = { return_cut: true, ascending: true, attack_1: true, attack_2: true, attack_3: true, attack_3_glory: true, cast: true, cast_sun: true };

/**
 * AnimationController do Atriox (quadros reais do atlas).
 *
 * - Corrida: ciclo de 12 quadros, cadência proporcional à velocidade real,
 *   nunca reiniciado enquanto o estado continua 'run'.
 * - Golpes e magias: quadro escolhido pela fase/progresso informados pelo
 *   ComboController/SpellController (dano no marcador 'hit' = início da fase ativa).
 * - Nenhuma rotação ou squash substitui a animação. Só existem dois movimentos
 *   secundários discretos: respiração no idle (±1%) e queda na morte.
 */
export class AtrioxAnimator {
  private readonly anim: SpriteAnimator;
  state: AnimState = 'idle';
  baseScale: number;
  facing = 1;
  attackPhase: AttackPhase = 'windup';
  phaseT = 0;
  /** razão velocidade atual / velocidade máxima (cadência da corrida) */
  runRate = 1;
  /** multiplicador global (inspetor/painel) */
  speed = 1;
  /** eventos de quadro do último update (ex.: 'step', 'hit', 'beam') */
  events: TimelineEvent[] = [];
  private t = 0;
  private flashTimer = 0;
  private listeners: ((ev: 'start', state: AnimState) => void)[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, lib: AnimLibrary, scale: number) {
    this.baseScale = scale;
    this.anim = new SpriteAnimator(scene, lib, 'atriox', x, y, 'atriox.idle');
  }

  get sprite(): Phaser.GameObjects.Sprite {
    return this.anim.sprite;
  }

  get frameName(): string {
    return this.anim.timeline.frame?.name ?? '';
  }

  onStart(fn: (ev: 'start', state: AnimState) => void): void {
    this.listeners.push(fn);
  }

  play(state: AnimState, force = false): boolean {
    if (state === this.state) return true;
    if (!force && ANIM_PRIORITY[state] < ANIM_PRIORITY[this.state] && this.state !== 'idle' && this.state !== 'run') return false;
    this.state = state;
    this.t = 0;
    if (state !== 'cinematic') this.events.push(...this.anim.play(`atriox.${state}`, true));
    this.listeners.forEach((l) => l('start', state));
    return true;
  }

  /** Chamado pelo Player a cada quadro: não reinicia o estado atual. */
  set(state: AnimState): void {
    if (state !== this.state) this.play(state, true);
  }

  flash(ms = 70): void {
    this.flashTimer = ms;
  }

  update(dt: number, x: number, y: number, depth: number): void {
    this.events = [];
    const sdt = dt * this.speed;
    this.t += sdt;
    if (SYNCED[this.state]) {
      this.events.push(...this.anim.sync(this.attackPhase, this.phaseT));
    } else if (this.state === 'run') {
      this.events.push(...this.anim.update(sdt, Math.max(0.55, Math.min(1.25, this.runRate))));
    } else if (this.state !== 'cinematic') {
      this.events.push(...this.anim.update(sdt));
    }

    const s = this.baseScale;
    let sy = 1;
    let rot = 0;
    let oy = 0;
    if (this.state === 'idle') sy = 1 + 0.01 * Math.sin((this.t / 1700) * Math.PI * 2);
    if (this.state === 'dead') {
      const k = Math.min(1, this.t / 700);
      const e = 1 - Math.pow(1 - k, 3);
      rot = -0.5 * e;
      oy = 6 * e;
    }
    const sp = this.anim.sprite;
    sp.setFlipX(this.facing < 0);
    sp.setPosition(x, y + oy);
    sp.setScale(s, s * sy);
    sp.setRotation(rot * this.facing);
    sp.setDepth(depth);

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (flashAllowed()) sp.setTintFill(0xffffff);
      else sp.setTint(0xffb0a0);
    } else if (this.state === 'dead') {
      const k = Math.min(1, this.t / 900);
      const c = Math.round(255 - 130 * k);
      sp.setTint(Phaser.Display.Color.GetColor(c, Math.round(c * 0.85), Math.round(c * 0.85)));
    } else {
      sp.clearTint();
    }
  }

  setAlpha(a: number): void {
    this.anim.sprite.setAlpha(a);
  }

  setVisible(v: boolean): void {
    this.anim.sprite.setVisible(v);
  }

  destroy(): void {
    this.anim.destroy();
    this.listeners.length = 0;
  }
}
