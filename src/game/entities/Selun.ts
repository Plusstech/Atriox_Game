import Phaser from 'phaser';
import { SELUN, type SelunMove } from '../../data/selun';
import { SelunBrain, type SelunEvent } from '../ai/SelunBrain';
import { Health } from '../combat/DamageSystem';
import type { ActiveHitbox, HitboxSystem, Hurtbox } from '../combat/HitboxSystem';
import { angleDiff, length, normalize, type Shape } from '../combat/geometry';
import { SpriteAnimator, type AnimLibrary } from '../animation/SpriteAnimator';
import type { Effects } from '../fx/Effects';
import { DEPTH, FLOOR } from '../config/constants';
import { Sfx } from '../audio/Sfx';
import { newEntityId, type CollideFn, type Combatant, type HitInfo } from './types';

export interface SelunContext {
  hitboxes: HitboxSystem;
  effects: Effects;
  collide: CollideFn;
  playerMaxHp(): number;
  /** multiplicador de dano de postura do jogador (Vontade Inquebrável, Brasa) */
  postureMul(): number;
  /** jogador apto à Última Palavra (fora de recuperação/stun) */
  playerReady(): boolean;
  onPhase(phase: number): void;
  onStagger(): void;
  onFallen(): void;
  onRecomposed(count: number): void;
  onLastWord(): void;
  onExecute(): void;
  onToast(msg: string): void;
}

/** Perigo agendado: aviso (telegrafia) → acerto. Avança só com o tempo de jogo do Sêlun. */
interface Hazard {
  t: number;
  warn: number;
  life: number;
  shape: Shape;
  damage: number;
  group: string;
  tag: string;
  fired: boolean;
  color: number;
  /** área de dano contínuo (zona central da Sentença) */
  rehit?: number;
  /** setor de gravidade (sem dano) */
  slow?: number;
  ghost?: boolean;
  fx?: () => void;
}

const seq = (p: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${p}_${String(i).padStart(2, '0')}`);
const AMBER = 0xffa53a;
const STEEL = 0xcfe0d8;

/**
 * Sêlun — O Fim do Infinito. Invencível: a MANIFESTAÇÃO tem vida finita (feedback),
 * cai e se recompõe; a luta termina na Última Palavra. Nunca emite "chefe derrotado".
 */
export class Selun implements Combatant {
  readonly id = newEntityId();
  readonly brain: SelunBrain;
  readonly health = new Health(SELUN.manifestHp);
  readonly hurtbox: Hurtbox;
  readonly name = 'SÊLUN';
  readonly title = 'O Fim do Infinito';
  removed = false;
  facing = -1;
  private aim = Math.PI / 2;
  private target = { x: 0, y: 0 };
  private vx = 0;
  private vy = 0;
  private hurtMs = 0;
  private flash = 0;
  private seqId = 0;
  private group = '';
  private owned: ActiveHitbox[] = [];
  private hazards: Hazard[] = [];
  private movers: { s: Phaser.GameObjects.Sprite; vx: number; vy: number; life: number }[] = [];
  private readonly anim: SpriteAnimator;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly g: Phaser.GameObjects.Graphics;
  private lastPlayer = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    lib: AnimLibrary,
    public x: number,
    public y: number,
    private readonly ctx: SelunContext,
    rng: () => number = Math.random
  ) {
    this.brain = new SelunBrain(rng);
    this.hurtbox = { id: this.id, team: 'enemy', x, y, radius: SELUN.radius, alive: true, invulnerable: true };
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(130, 40);
    this.g = scene.add.graphics().setDepth(DEPTH.telegraph + 10);
    this.anim = new SpriteAnimator(scene, lib, 'selun', x, y, 'selun.idle');
    this.anim.sprite.setScale(SELUN.scale);
  }

  get dead(): boolean {
    return false; // nunca morre definitivamente
  }
  get hpRatio(): number {
    return this.health.ratio;
  }
  get chestY(): number {
    return this.y - 120;
  }
  get frameName(): string {
    return this.anim.sprite.frame.name;
  }
  get hazardCount(): number {
    return this.hazards.length;
  }

  startFight(): void {
    this.brain.start();
  }

  /** Redução de movimento do jogador nos setores de gravidade ativos (máx. 20%). */
  slowAt(x: number, y: number): number {
    let s = 0;
    for (const h of this.hazards)
      if (h.slow && h.t >= h.warn && h.shape.kind === 'circle' && length(x - h.shape.x, y - h.shape.y) <= h.shape.radius) s = Math.max(s, h.slow);
    return Math.min(SELUN.moves.gravity.slow, s);
  }

  // =================================================================== atualização
  update(dt: number, p: { x: number; y: number; dead: boolean }): void {
    if (this.removed) return;
    this.lastPlayer = { x: p.x, y: p.y };
    const b = this.brain;
    const dist = length(p.x - this.x, p.y - this.y);
    const toP = Math.atan2(p.y - this.y, p.x - this.x);
    for (const ev of b.update(dt, { distance: dist, playerReady: this.ctx.playerReady() })) this.onEvent(ev, toP, p);

    // mira: acompanha até travar (justiça de leitura)
    const st = b.state;
    const m = b.move;
    if (st === 'windup' && m) {
      const d = b.durations(m);
      const lockAt = m === 'horizon' ? SELUN.moves.horizon.lockAt : m === 'dash' ? SELUN.moves.dash.lockAt : 0.5;
      if (b.timer < d.windup * lockAt) this.aim += angleDiff(this.aim, toP) * Math.min(1, dt / 140);
      if (m === 'sentence' && b.timer < d.windup - SELUN.moves.sentence.lockBefore) this.setSentenceTarget(p);
    }

    // movimento pesado e deliberado
    let tvx = 0;
    let tvy = 0;
    if (st === 'idle' && dist > 165) {
      const n = normalize(p.x - this.x, p.y - this.y);
      tvx = n.x * SELUN.speed;
      tvy = n.y * SELUN.speed;
    } else if (st === 'active' && m === 'dash') {
      tvx = Math.cos(this.aim) * SELUN.moves.dash.speed;
      tvy = Math.sin(this.aim) * SELUN.moves.dash.speed;
    }
    const k = st === 'active' && m === 'dash' ? 1 : Math.min(1, dt / 180);
    this.vx += (tvx - this.vx) * k;
    this.vy += (tvy - this.vy) * k;
    if (dt > 0) {
      const r = this.ctx.collide(this.x + (this.vx * dt) / 1000, this.y + (this.vy * dt) / 1000, SELUN.radius);
      this.x = r.x;
      this.y = r.y;
      if (st === 'active' && m === 'dash' && r.blocked) {
        this.vx = this.vy = 0;
        this.ctx.effects.atlasFx(this.x + Math.cos(this.aim) * 40, this.y - 30, seq('fxs_ground', 6), { frameMs: 50, scale: 0.7, depth: this.y + 5 });
        this.ctx.effects.shake(140, 0.005);
      }
    }
    if (st === 'windup' || st === 'active' || st === 'channel' || st === 'execution') this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    else if (Math.abs(p.x - this.x) > 12) this.facing = p.x >= this.x ? 1 : -1;

    this.updateHazards(dt);
    this.updateMovers(dt);
    this.animate(dt);
    this.drawTelegraph();
    this.sync(dt);
  }

  private onEvent(ev: SelunEvent, toP: number, p: { x: number; y: number }): void {
    const M = SELUN.moves;
    switch (ev.type) {
      case 'windup':
        this.seqId++;
        this.group = `selun:${this.seqId}`;
        this.aim = toP;
        if (ev.move === 'sentence') this.setSentenceTarget(p);
        Sfx.telegraph(true);
        if (ev.move === 'decree' || ev.move === 'channel') this.ctx.effects.telegraphPulse(this.x, this.chestY, AMBER);
        break;
      case 'strike':
        this.strike(ev.move);
        break;
      case 'decreeSeq':
        this.decreeSequence(ev.index, p);
        break;
      case 'recover':
        this.cancelOwned();
        if (ev.move === 'horizon' || ev.move === 'sentence') this.scheduleEchoes(ev.move);
        break;
      case 'channelComplete':
        this.channelPattern();
        break;
      case 'channelInterrupted':
        this.ctx.onToast('Tributo ao Silêncio interrompido!');
        break;
      case 'staggered':
        this.cancelAll();
        this.ctx.effects.floatingText(this.x, this.chestY - 60, 'POSTURA QUEBRADA', '#80e0d0', 20);
        Sfx.slam();
        this.ctx.onStagger();
        break;
      case 'gravity':
        if (!this.hazards.some((h) => h.tag === 'selun_decree')) this.gravitySectors(p);
        break;
      case 'phase':
        this.cancelAll();
        Sfx.bossRoar();
        this.ctx.effects.shake(500, 0.006);
        this.ctx.onPhase(ev.phase);
        break;
      case 'fallen':
        this.cancelAll();
        this.anim.play('selun.fall', true);
        this.ctx.onFallen();
        break;
      case 'recomposed':
        this.health.current = this.health.max;
        this.ctx.onRecomposed(ev.count);
        break;
      case 'lastWord':
        this.cancelAll();
        this.aim = toP;
        this.ctx.effects.atlasFx(this.x, this.y - 10, seq('fxs_ground', 6), { frameMs: 70, scale: 0.9, depth: this.y + 4 });
        Sfx.slam();
        this.ctx.onLastWord();
        break;
      case 'execute':
        this.ctx.effects.atlasFx(p.x, p.y - 80, seq('fxs_rift', 8), { frameMs: 60, scale: 1.4, depth: p.y + 20, blend: true });
        this.ctx.effects.flash(400, 255, 180, 80);
        this.ctx.onExecute();
        break;
      case 'staggerEnd':
        break;
    }
    void M;
  }

  private setSentenceTarget(p: { x: number; y: number }): void {
    const reach = SELUN.moves.sentence.maxReach;
    const d = length(p.x - this.x, p.y - this.y);
    const n = normalize(p.x - this.x, p.y - this.y);
    const r = Math.min(reach, d);
    this.target = { x: this.x + n.x * r, y: this.y + n.y * r };
  }

  private dmg(v: number): number {
    return Math.min(v, this.ctx.playerMaxHp() * SELUN.maxEventFraction);
  }

  private spawn(shape: Shape, damage: number, duration: number, tag: string, extra: Partial<{ velocity: { x: number; y: number }; grow: number; rehit: number; follow: boolean; knock: { x: number; y: number } }> = {}): void {
    this.owned.push(
      this.ctx.hitboxes.spawn({
        shape,
        team: 'enemy',
        damage: this.dmg(damage),
        knockback: 260,
        duration,
        tag,
        velocity: extra.velocity,
        grow: extra.grow,
        rehitInterval: extra.rehit,
        follow: extra.follow ? () => ({ x: this.x, y: this.y }) : undefined,
        knockbackDir: extra.knock,
        meta: { group: this.group }
      })
    );
  }

  // =================================================================== golpes
  private strike(m: SelunMove): void {
    const M = SELUN.moves;
    const ux = Math.cos(this.aim);
    const uy = Math.sin(this.aim);
    if (m === 'horizon') {
      // corte físico + onda separada em linha (mesmo grupo: no máximo um acerto por lançamento)
      this.spawn({ kind: 'sector', x: this.x, y: this.y, radius: M.horizon.range, angle: this.aim, halfArc: 1.1 }, M.horizon.damage, M.horizon.active, 'selun_horizon', { follow: true });
      const life = (M.horizon.waveRange / M.horizon.waveSpeed) * 1000;
      this.spawn(
        { kind: 'rect', x: this.x + ux * 60, y: this.y + uy * 60, angle: this.aim, length: 90, width: M.horizon.waveWidth },
        M.horizon.waveDamage,
        life,
        'selun_horizon_wave',
        { velocity: { x: ux * M.horizon.waveSpeed, y: uy * M.horizon.waveSpeed }, knock: { x: ux, y: uy } }
      );
      this.ctx.effects.atlasFx(this.x + ux * 90, this.y + uy * 50 - 70, seq('fxs_slash_h', 6), { frameMs: 45, flipX: ux < 0, depth: this.y + 5 });
      this.mover('fxs_slash_h_02', this.x + ux * 80, this.y - 40 + uy * 60, ux * M.horizon.waveSpeed, uy * M.horizon.waveSpeed, life, this.aim);
      Sfx.swing(2);
      this.ctx.effects.shake(140, 0.004);
    } else if (m === 'sentence') {
      const t = { ...this.target };
      this.spawn({ kind: 'circle', x: t.x, y: t.y, radius: M.sentence.radius }, M.sentence.damage, M.sentence.active, 'selun_sentence');
      // anel expansivo: esquivar atravessa
      this.spawn({ kind: 'ring', x: t.x, y: t.y, inner: M.sentence.radius - M.sentence.ringWidth, outer: M.sentence.radius }, M.sentence.ringDamage, M.sentence.ringMs, 'selun_sentence_ring', {
        grow: ((M.sentence.ringMax - M.sentence.radius) / M.sentence.ringMs) * 1000
      });
      // zona perigosa temporária no centro (não preenche a arena)
      this.hazards.push({ t: 0, warn: 120, life: M.sentence.zoneMs, shape: { kind: 'circle', x: t.x, y: t.y, radius: M.sentence.zoneRadius }, damage: M.sentence.zoneDamage, group: `${this.group}:zone`, tag: 'selun_sentence_zone', fired: false, color: AMBER, rehit: 600 });
      this.ctx.effects.atlasFx(t.x, t.y - 20, seq('fxs_ground', 6), { frameMs: 60, scale: 1.05, depth: t.y + 4 });
      this.ctx.effects.atlasFx(this.x + ux * 70, this.y - 70, seq('fxs_slash_d', 6), { frameMs: 45, flipX: ux < 0, depth: this.y + 5 });
      this.ctx.effects.shake(220, 0.009);
      Sfx.slam();
    } else if (m === 'dash') {
      this.spawn({ kind: 'circle', x: this.x, y: this.y, radius: SELUN.radius + 34 }, M.dash.damage, M.dash.active, 'selun_dash', { follow: true, knock: { x: ux, y: uy } });
      Sfx.dash();
    }
  }

  /** Decreto do Fim: fendas paralelas anunciadas; sempre sobra rota de escape (vãos e uma faixa omitida). */
  private decreeSequence(index: number, p: { x: number; y: number }): void {
    const D = SELUN.moves.decree;
    const ang = (this.aim + Math.PI / 2 + index * 0.9) % (Math.PI * 2);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const nx = -uy;
    const ny = ux;
    const slots = [-2, -1, 0, 1, 2];
    const skip = slots[(this.seqId * 3 + index * 2) % slots.length];
    for (const k of slots) {
      if (k === skip) continue;
      const cx = p.x + nx * k * D.spacing;
      const cy = p.y + ny * k * D.spacing;
      const x0 = cx - ux * (D.length / 2);
      const y0 = cy - uy * (D.length / 2);
      this.hazards.push({
        t: 0,
        warn: D.announceMs,
        life: D.strikeMs,
        shape: { kind: 'rect', x: x0, y: y0, angle: ang, length: D.length, width: D.width },
        damage: D.damage,
        group: `${this.group}:d${index}`,
        tag: 'selun_decree',
        fired: false,
        color: AMBER,
        fx: () => {
          for (const f of [0.25, 0.5, 0.75])
            this.ctx.effects.atlasFx(x0 + ux * D.length * f, y0 + uy * D.length * f, seq('fxs_rift', 8), { frameMs: 40, rotation: ang - Math.PI / 2, scale: 0.6, depth: DEPTH.groundFx + 40, blend: true });
        }
      });
    }
  }

  /** Tributo completo: raios a partir de Sêlun com cunhas seguras entre eles. */
  private channelPattern(): void {
    const C = SELUN.moves.channel;
    for (let i = 0; i < C.spokes; i++) {
      const ang = this.aim + (i * Math.PI * 2) / C.spokes + Math.PI / C.spokes;
      this.hazards.push({
        t: 0,
        warn: C.announceMs,
        life: 160,
        shape: { kind: 'rect', x: this.x, y: this.y, angle: ang, length: C.length, width: C.width },
        damage: C.damage,
        group: `${this.group}:spokes`,
        tag: 'selun_channel',
        fired: false,
        color: AMBER,
        fx: () =>
          this.ctx.effects.atlasFx(this.x + Math.cos(ang) * C.length * 0.5, this.y + Math.sin(ang) * C.length * 0.5, seq('fxs_rift', 8), { frameMs: 45, rotation: ang - Math.PI / 2, scale: 0.75, depth: DEPTH.groundFx + 40, blend: true })
      });
    }
  }

  /** Ecos de Execução: repetem a geometria REGISTRADA (sem nova mira), com aviso próprio. */
  private scheduleEchoes(m: 'horizon' | 'sentence'): void {
    const n = Math.min(2, this.brain.phase - 1);
    const E = SELUN.moves.echo;
    for (let i = 0; i < n; i++) {
      const shape: Shape =
        m === 'horizon'
          ? { kind: 'sector', x: this.x, y: this.y, radius: SELUN.moves.horizon.range, angle: this.aim, halfArc: 1.1 }
          : { kind: 'circle', x: this.target.x, y: this.target.y, radius: SELUN.moves.sentence.radius };
      const fxX = shape.x + (m === 'horizon' ? Math.cos(this.aim) * 90 : 0);
      const fxY = shape.y + (m === 'horizon' ? Math.sin(this.aim) * 50 - 70 : -20);
      const flip = Math.cos(this.aim) < 0;
      this.hazards.push({
        t: -E.delay * i,
        warn: E.warnMs + E.delay,
        life: 140,
        shape,
        damage: m === 'horizon' ? 16 : 18,
        group: `${this.group}:echo${i}`,
        tag: 'selun_echo',
        fired: false,
        color: STEEL,
        ghost: true,
        fx: () => this.ctx.effects.atlasFx(fxX, fxY, seq(m === 'horizon' ? 'fxs_slash_h' : 'fxs_ground', 6), { frameMs: 45, flipX: flip, alpha: 0.55, tint: 0x9fc8ff, depth: shape.y + 4 })
      });
    }
  }

  /** Peso do Fim: setores sinalizados com gravidade (−20% de movimento, sem dano). */
  private gravitySectors(p: { x: number; y: number }): void {
    const G = SELUN.moves.gravity;
    const spots = [
      { x: p.x, y: p.y },
      { x: Phaser.Math.Clamp(p.x + (p.x < FLOOR.x + FLOOR.w / 2 ? 420 : -420), FLOOR.x + 200, FLOOR.x + FLOOR.w - 200), y: Phaser.Math.Clamp(p.y - 160, FLOOR.y + 160, FLOOR.y + FLOOR.h - 160) }
    ].slice(0, G.count);
    for (const s of spots)
      this.hazards.push({ t: 0, warn: G.announceMs, life: G.activeMs, shape: { kind: 'circle', x: s.x, y: s.y, radius: G.radius }, damage: 0, group: '', tag: 'selun_gravity', fired: false, color: 0x7fa0b8, slow: G.slow });
    this.ctx.onToast('Peso do Fim: saia dos círculos para mover-se livremente.');
  }

  private updateHazards(dt: number): void {
    if (dt <= 0) return;
    for (const h of this.hazards) {
      h.t += dt;
      if (!h.fired && h.t >= h.warn) {
        h.fired = true;
        if (h.damage > 0)
          this.owned.push(
            this.ctx.hitboxes.spawn({
              shape: { ...h.shape } as Shape,
              team: 'enemy',
              damage: this.dmg(h.damage),
              knockback: 200,
              duration: h.life,
              rehitInterval: h.rehit,
              tag: h.tag,
              meta: { group: h.group }
            })
          );
        h.fx?.();
        if (h.tag === 'selun_decree' || h.tag === 'selun_channel') Sfx.slam();
      }
    }
    this.hazards = this.hazards.filter((h) => h.t < h.warn + h.life);
  }

  private mover(frame: string, x: number, y: number, vx: number, vy: number, life: number, angle: number): void {
    if (!this.scene.textures.get('characters').has(frame)) return;
    const s = this.scene.add.sprite(x, y, 'characters', frame).setRotation(vx < 0 ? angle + Math.PI : angle).setFlipX(vx < 0).setScale(0.7).setAlpha(0.85).setDepth(y + 10);
    this.movers.push({ s, vx, vy, life });
  }

  private updateMovers(dt: number): void {
    for (const m of this.movers) {
      m.life -= dt;
      m.s.x += (m.vx * dt) / 1000;
      m.s.y += (m.vy * dt) / 1000;
      m.s.setAlpha(Math.max(0, Math.min(0.85, m.life / 300)));
      if (m.life <= 0) m.s.destroy();
    }
    this.movers = this.movers.filter((m) => m.life > 0);
  }

  // =================================================================== visual
  private animate(dt: number): void {
    const b = this.brain;
    const st = b.state;
    const m = b.move;
    const a = this.anim;
    if (this.hurtMs > 0) this.hurtMs -= dt;
    if (st === 'fallen') return void a.update(dt);
    if (st === 'recompose') {
      a.play('selun.recompose');
      return void a.update(dt);
    }
    if (st === 'execution' || st === 'done') {
      a.play('selun.plant');
      return void a.update(dt);
    }
    if (st === 'transition') {
      a.play('selun.fury');
      return void a.update(dt);
    }
    if (st === 'stagger') {
      a.play('selun.stagger');
      return void a.update(dt);
    }
    if (st === 'channel') {
      a.play('selun.channel_loop');
      return void a.update(dt);
    }
    if ((st === 'windup' || st === 'active' || st === 'recovery') && m) {
      if (m === 'dash' && st === 'active') {
        a.play('selun.dash_loop');
        return void a.update(dt);
      }
      const d = b.durations(m);
      a.play(`selun.${m}`);
      if (st === 'windup') a.sync('windup', b.timer / d.windup);
      else if (st === 'active') a.sync(m === 'channel' ? 'recovery' : 'active', b.timer / d.active);
      else a.sync('recovery', b.timer / d.recovery);
      return;
    }
    if (this.hurtMs > 0) {
      a.play('selun.hurt');
      return void a.update(dt);
    }
    const moving = Math.hypot(this.vx, this.vy) > 30;
    a.play(moving ? 'selun.run' : 'selun.idle');
    a.update(dt, moving ? Math.max(0.6, Math.hypot(this.vx, this.vy) / SELUN.speed) : 1);
  }

  private drawTelegraph(): void {
    const g = this.g;
    g.clear();
    const b = this.brain;
    const m = b.move;
    const M = SELUN.moves;
    if (b.state === 'windup' && m) {
      const d = b.durations(m);
      const p = Math.min(1, b.timer / d.windup);
      const ux = Math.cos(this.aim);
      const uy = Math.sin(this.aim);
      g.lineStyle(3, p > 0.8 ? 0xfff0d0 : AMBER, 0.85);
      g.fillStyle(AMBER, 0.1 + 0.2 * p);
      if (m === 'horizon') {
        g.slice(this.x, this.y, M.horizon.range, this.aim - 1.1, this.aim + 1.1);
        g.fillPath();
        g.strokePath();
        this.rect(this.x + ux * 60, this.y + uy * 60, this.aim, M.horizon.waveRange * 0.6, M.horizon.waveWidth, 0.08 + 0.12 * p);
      } else if (m === 'sentence') {
        const locked = b.timer >= d.windup - M.sentence.lockBefore;
        g.lineStyle(3, locked ? 0xfff0d0 : AMBER, 0.9);
        g.fillCircle(this.target.x, this.target.y, M.sentence.radius);
        g.strokeCircle(this.target.x, this.target.y, M.sentence.radius);
        g.lineStyle(1.5, AMBER, 0.35);
        g.strokeCircle(this.target.x, this.target.y, M.sentence.ringMax);
      } else if (m === 'dash') {
        this.rect(this.x, this.y, this.aim, (M.dash.speed * M.dash.active) / 1000, M.dash.width, 0.12 + 0.2 * p);
      } else if (m === 'decree' || m === 'channel') {
        g.strokeCircle(this.x, this.y, 60 + 30 * p);
      }
    }
    // perigos agendados: aviso cresce até o acerto; fantasmas em aço frio
    for (const h of this.hazards) {
      const warming = h.t < h.warn;
      const k = Math.max(0, Math.min(1, h.t / h.warn));
      const alpha = h.slow ? (warming ? 0.15 + 0.2 * k : 0.22) : warming ? 0.1 + 0.3 * k : 0.45;
      if (h.t < 0) continue;
      g.fillStyle(h.color, alpha);
      g.lineStyle(2, warming && k > 0.8 ? 0xfff0d0 : h.color, 0.8);
      const s = h.shape;
      if (s.kind === 'circle') {
        g.fillCircle(s.x, s.y, s.radius);
        g.strokeCircle(s.x, s.y, s.radius);
      } else if (s.kind === 'rect') this.rect(s.x, s.y, s.angle, s.length, s.width, alpha, h.color);
      else if (s.kind === 'sector') {
        g.slice(s.x, s.y, s.radius, s.angle - s.halfArc, s.angle + s.halfArc);
        g.fillPath();
        g.strokePath();
      }
    }
  }

  private rect(x: number, y: number, a: number, len: number, w: number, alpha: number, color = AMBER): void {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const px = -uy * (w / 2);
    const py = ux * (w / 2);
    const pts = [
      new Phaser.Geom.Point(x + px, y + py),
      new Phaser.Geom.Point(x + ux * len + px, y + uy * len + py),
      new Phaser.Geom.Point(x + ux * len - px, y + uy * len - py),
      new Phaser.Geom.Point(x - px, y - py)
    ];
    this.g.fillStyle(color, alpha);
    this.g.fillPoints(pts, true);
    this.g.lineStyle(2, color, 0.75);
    this.g.strokePoints(pts, true);
  }

  private sync(dt: number): void {
    const sp = this.anim.sprite;
    sp.setPosition(this.x, this.y).setDepth(this.y).setFlipX(this.facing < 0);
    this.shadow.setPosition(this.x, this.y + 2);
    Object.assign(this.hurtbox, { x: this.x, y: this.y, alive: true, invulnerable: !this.brain.tangible });
    const b = this.brain;
    if (this.flash > 0) {
      this.flash -= dt;
      sp.setTintFill(0xffffff);
    } else if (b.state === 'stagger') sp.setTint(0xc8f0e8);
    else if (b.state === 'windup' && b.move && b.timer > b.durations(b.move).windup * 0.75) sp.setTint(0xffd8a8);
    else if (b.protectMs > 0) sp.setTint(0xdde4ee);
    else sp.clearTint();
  }

  // =================================================================== dano
  receiveHit(hit: HitInfo): number {
    if (this.removed || !this.brain.tangible) return 0;
    const st = this.brain.state;
    const dealt = this.health.damage(hit.damage * (st === 'stagger' ? 1.3 : 1));
    if (dealt <= 0) return 0;
    this.flash = 50;
    if (st === 'idle') this.hurtMs = 260;
    if (hit.tag !== 'burn') {
      const base = hit.posture ?? (hit.tag === 'charged' ? 85 : hit.heavy ? 40 : hit.basic ? 13 : 6);
      for (const ev of this.brain.hitPosture(base * this.ctx.postureMul())) this.onEvent(ev, this.aim, this.lastPlayer);
    }
    if (this.health.dead) for (const ev of this.brain.manifestationBroken()) this.onEvent(ev, this.aim, this.lastPlayer);
    return dealt;
  }

  private cancelOwned(): void {
    this.owned.forEach((h) => h.cancel());
    this.owned = [];
  }

  /** Encerra golpes, perigos agendados, ecos e setores (postura, fase, queda, execução). */
  cancelAll(): void {
    this.cancelOwned();
    this.hazards = [];
    this.g.clear();
  }

  /** Morte do jogador: precedência — para tudo, sem novas transições. */
  halt(): void {
    this.brain.stop();
    this.cancelAll();
  }

  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.cancelAll();
    this.movers.forEach((m) => m.s.destroy());
    this.movers = [];
    this.anim.destroy();
    this.shadow.destroy();
    this.g.destroy();
  }
}
