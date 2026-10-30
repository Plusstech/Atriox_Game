import Phaser from 'phaser';
import { ARENA_CENTER, DEPTH, DEV_TOOLS, FLOOR, GAME_H, GAME_W, WORLD_H, WORLD_W } from '../config/constants';
import { ENEMIES, type EnemyKind } from '../../data/enemies';
import { EXECUTIONER } from '../../data/bosses';
import { WAVES } from '../../data/waves';
import { JUDGMENT_FLAME } from '../../data/abilities';
import { getBlessing, type BlessingAction, type BlessingDef } from '../../data/blessings';
import type { ComboStepDef } from '../../data/attacks';
import { Player, type PlayerInput } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { TrainingDummy } from '../entities/TrainingDummy';
import type { Combatant, HitInfo } from '../entities/types';
import { HitboxSystem, type HitResult, type Hurtbox } from '../combat/HitboxSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { StatusSystem } from '../combat/StatusSystem';
import { angleDiff, degToRad, length, normalize } from '../combat/geometry';
import { WaveDirector, type DirectorEvent } from '../systems/WaveDirector';
import { BlessingSystem } from '../progression/BlessingSystem';
import { JudgmentFlame } from '../abilities/JudgmentFlame';
import { Effects } from '../fx/Effects';
import { buildArena, type ArenaLayout } from '../systems/ArenaBuilder';
import { pointBlocked, resolveCircle } from '../systems/Collision';
import { inputVector } from '../systems/Movement';
import { Sfx } from '../audio/Sfx';
import { save } from '../services';
import type { PoseMeta } from '../animation/AtrioxAnimator';
import type { UIScene } from './UIScene';

interface Interactable {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  action: () => void;
}

export interface HudState {
  hp: number;
  maxHp: number;
  dashProgress: number;
  spellProgress: number;
  comboIndex: number;
  comboActive: boolean;
  enemies: number;
  waveLabel: string;
  phase: string;
  boss: { name: string; title: string; ratio: number; phase: number } | null;
  blessings: BlessingDef[];
  tutorial: { moved: boolean; attacked: boolean; dashed: boolean; cast: boolean } | null;
  prompt: string | null;
  timeMs: number;
  resistBuff: boolean;
  stats: Record<string, number>;
}

export interface RunResult {
  victory: boolean;
  timeMs: number;
  highestWave: number;
  kills: number;
  blessings: string[];
  newBest: boolean;
}

/** Cena principal de combate: Campo de Provação da Liga Sóbele. */
export class ArenaScene extends Phaser.Scene {
  player!: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  dummies: TrainingDummy[] = [];
  hitboxes!: HitboxSystem;
  projectiles!: ProjectileSystem;
  statuses!: StatusSystem;
  effects!: Effects;
  director!: WaveDirector;
  blessings!: BlessingSystem;
  private spell!: JudgmentFlame;
  private layout!: ArenaLayout;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SPACE' | 'E' | 'ESC' | 'SHIFT', Phaser.Input.Keyboard.Key>;
  private queued = { attack: false, cast: false, dash: false };
  private pendingSpawns = 0;
  private hitstopTimer = 0;
  private timeScale = 1;
  private slowmo = { remaining: 0, scale: 1 };
  runTime = 0;
  kills = 0;
  private interactables: Interactable[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private nearInteractable: Interactable | null = null;
  private debugGfx!: Phaser.GameObjects.Graphics;
  showHitboxes = false;
  private ending = false;
  private camTarget: { x: number; y: number } | null = null;
  private introWalk = false;
  private orb: Phaser.GameObjects.Image | null = null;
  private orbLight: Phaser.GameObjects.Image | null = null;
  private altarGlow: Phaser.GameObjects.Image | null = null;
  private lastHurtboxes: Hurtbox[] = [];

  constructor() {
    super('ArenaScene');
  }

  // =================================================================== ciclo de vida
  create(): void {
    // a instância da cena é reaproveitada ao reiniciar: reinicializar TODO o estado aqui
    this.enemies = [];
    this.boss = null;
    this.dummies = [];
    this.queued = { attack: false, cast: false, dash: false };
    this.pendingSpawns = 0;
    this.hitstopTimer = 0;
    this.timeScale = 1;
    this.slowmo = { remaining: 0, scale: 1 };
    this.runTime = 0;
    this.kills = 0;
    this.interactables = [];
    this.nearInteractable = null;
    this.ending = false;
    this.camTarget = null;
    this.introWalk = false;
    this.orb = null;
    this.orbLight = null;
    this.lastHurtboxes = [];
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    save.recordAttempt();

    this.layout = buildArena(this);
    this.effects = new Effects(this);
    this.hitboxes = new HitboxSystem();
    this.statuses = new StatusSystem();
    this.projectiles = new ProjectileSystem(this, (x, y) => pointBlocked(x, y, FLOOR, this.layout.obstacles));
    this.director = new WaveDirector(WAVES);

    const poses = (this.cache.json.get('atriox_poses')?.poses ?? {}) as Record<string, PoseMeta>;
    this.player = new Player(this, ARENA_CENTER.x, ARENA_CENTER.y + 250, poses, {
      onAttackStart: (step, i) => this.onAttackStart(step, i),
      onAttackActive: (step, i, a) => this.onAttackActive(step, i, a),
      onCastStart: (a) => this.spell.charge(this.player.x + Math.cos(a) * 24, this.player.chestY),
      onCastRelease: (a) => this.spell.cast(this.player.x, this.player.y, a),
      onDash: () => {
        Sfx.dash();
        this.effects.dustPuff(this.player.x, this.player.y, 6);
      },
      onDashTick: () => this.effects.afterimage(this.player.sprite),
      onDamaged: (amount, hit) => this.onPlayerDamaged(amount, hit),
      onDeath: () => this.onPlayerDeath(),
      onFootstep: (x, y) => this.effects.dustPuff(x, y, 1),
      aimAssist: (x, y, angle, range) => this.aimAssist(x, y, angle, range)
    });
    this.blessings = new BlessingSystem(this.player.stats);
    this.spell = new JudgmentFlame(JUDGMENT_FLAME, {
      hitboxes: this.hitboxes,
      projectiles: this.projectiles,
      effects: this.effects,
      damageMul: () => this.player.stats.get('damageMul'),
      onImpact: (x, y) => this.fireBlessings('spellImpact', { x, y, angle: 0 })
    });

    // bonecos de treino para o tutorial
    this.dummies = [
      new TrainingDummy(this, ARENA_CENTER.x - 210, ARENA_CENTER.y + 120),
      new TrainingDummy(this, ARENA_CENTER.x + 210, ARENA_CENTER.y + 120)
    ];

    // altar: inicia a provação
    this.altarGlow = this.add.image(this.layout.altarPos.x, this.layout.altarPos.y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xe8b24a).setDepth(DEPTH.groundFx).setDisplaySize(360, 200).setAlpha(0.35);
    this.tweens.add({ targets: this.altarGlow, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.interactables.push({
      id: 'altar',
      x: this.layout.altarPos.x,
      y: this.layout.altarPos.y,
      r: 110,
      label: 'Iniciar a Provação',
      action: () => this.beginTrial()
    });

    this.promptText = this.add
      .text(0, 0, '', { fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffd77a', stroke: '#140a08', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlayFx + 80)
      .setVisible(false);
    this.debugGfx = this.add.graphics().setDepth(DEPTH.overlayFx + 100);
    this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.vignette).setDisplaySize(GAME_W, GAME_H);

    // câmera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.centerOn(this.player.x, this.player.y - 40);
    cam.fadeIn(700, 0, 0, 0);

    // entrada
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      W: 'W', A: 'A', S: 'S', D: 'D', UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT',
      SPACE: 'SPACE', E: 'E', ESC: 'ESC', SHIFT: 'SHIFT'
    }) as typeof this.keys;
    kb.addCapture(['SPACE', 'TAB', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.keys.ESC.on('down', this.openPause, this);
    this.keys.E.on('down', this.interact, this);
    // evento de tecla (e não JustDown) para não perder toques curtos em FPS baixo
    this.keys.SPACE.on('down', this.queueDash, this);
    this.keys.SHIFT.on('down', this.queueDash, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    else this.scene.get('UIScene').scene.restart();
    this.time.delayedCall(400, () => this.ui()?.banner('Campo de Provação', 'Liga Sóbele — prove seu valor, Sentinela'));

    Sfx.startMusic();
    Sfx.setIntensity(0.1);

    if (DEV_TOOLS || new URLSearchParams(location.search).has('test')) {
      (window as unknown as { __ATRIOX__: unknown }).__ATRIOX__ = {
        arena: this,
        snapshot: () => this.debugSnapshot()
      };
    }
  }

  private cleanup(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.keys.ESC.off('down', this.openPause, this);
    this.keys.E.off('down', this.interact, this);
    this.keys.SPACE.off('down', this.queueDash, this);
    this.keys.SHIFT.off('down', this.queueDash, this);
    this.hitboxes.clear();
    this.projectiles.clear();
    this.statuses.clear();
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    this.boss?.destroy();
    this.boss = null;
    this.dummies.forEach((d) => d.destroy());
    this.dummies = [];
    this.player.destroy();
    Sfx.setIntensity(0);
  }

  ui(): UIScene | null {
    const s = this.scene.get('UIScene') as UIScene | undefined;
    return s && s.scene.isActive() ? s : null;
  }

  // =================================================================== entrada
  private onPointerDown(p: Phaser.Input.Pointer): void {
    Sfx.unlock();
    if (p.rightButtonDown()) this.queued.cast = true;
    else if (p.leftButtonDown()) this.queued.attack = true;
  }

  private queueDash(): void {
    this.queued.dash = true;
  }

  private readInput(): PlayerInput {
    const k = this.keys;
    const move = inputVector(k.A.isDown || k.LEFT.isDown, k.D.isDown || k.RIGHT.isDown, k.W.isDown || k.UP.isDown, k.S.isDown || k.DOWN.isDown);
    const p = this.input.activePointer;
    const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const input: PlayerInput = {
      move,
      aimX: wp.x,
      aimY: wp.y,
      attackPressed: this.queued.attack,
      castPressed: this.queued.cast,
      dashPressed: this.queued.dash
    };
    this.queued.attack = false;
    this.queued.cast = false;
    this.queued.dash = false;
    return input;
  }

  private openPause(): void {
    if (this.ending || this.player.dead) return;
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  private interact(): void {
    if (this.nearInteractable && !this.player.locked && !this.player.dead) {
      const it = this.nearInteractable;
      this.interactables = this.interactables.filter((i) => i !== it);
      this.nearInteractable = null;
      Sfx.uiConfirm();
      it.action();
    }
  }

  // =================================================================== loop
  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt);
      return;
    }
    if (this.slowmo.remaining > 0) {
      this.slowmo.remaining -= dt;
      this.timeScale = this.slowmo.remaining > 0 ? this.slowmo.scale : 1;
      this.tweens.timeScale = this.timeScale;
    }
    const sdt = dt * this.timeScale;
    if (!this.director.over) this.runTime += sdt;

    const input = this.readInput();
    const collide = (x: number, y: number, r: number): { x: number; y: number; blocked: boolean } => resolveCircle(x, y, r, FLOOR, this.layout.obstacles);
    this.player.update(sdt, input, collide);

    for (const e of this.enemies) e.update(sdt, this.player);
    if (this.boss) {
      if (this.introWalk) {
        if (this.boss.walkTo(this.layout.gatePos.x, FLOOR.y + 260, sdt, 95)) this.introWalk = false;
      } else {
        this.boss.update(sdt, this.player);
      }
    }
    this.separateBodies();

    const hurtboxes = this.collectHurtboxes();
    this.projectiles.update(sdt, hurtboxes);
    this.resolveHits(this.hitboxes.update(sdt, hurtboxes));
    this.statuses.update(sdt, (target, dmg) => {
      const dealt = target.receiveHit({ damage: dmg, knockback: 0, dirX: 0, dirY: 0, tag: 'burn' });
      if (dealt > 0) {
        const t = target.hurtbox;
        this.effects.damageNumber(t.x, t.y - 90, dealt, '#ff9b3d');
        this.effects.embersAt(t.x, t.y - 50, 4);
        Sfx.burnTick();
      }
    });
    this.blessings.update(sdt);

    this.enemies = this.enemies.filter((e) => !e.removed);

    if (this.director.phase === 'wave') this.handleDirector(this.director.tick(this.aliveEnemies() + this.pendingSpawns));

    this.updateInteractables();
    this.updateCamera(dt);
    if (this.showHitboxes) this.drawDebug(hurtboxes);
    else this.debugGfx.clear();

    const threat = this.aliveEnemies() + (this.boss && !this.boss.dead ? 4 : 0);
    Sfx.setIntensity(this.director.over ? 0 : Math.min(1, 0.1 + threat * 0.15));
  }

  aliveEnemies(): number {
    return this.enemies.filter((e) => !e.dead).length;
  }

  private collectHurtboxes(): Hurtbox[] {
    const list: Hurtbox[] = [this.player.hurtbox];
    for (const e of this.enemies) if (!e.dead) list.push(e.hurtbox);
    if (this.boss && !this.boss.dead) list.push(this.boss.hurtbox);
    for (const d of this.dummies) list.push(d.hurtbox);
    this.lastHurtboxes = list;
    return list;
  }

  private combatantById(id: number): Combatant | undefined {
    if (id === this.player.hurtbox.id) return this.player;
    if (this.boss && this.boss.id === id) return this.boss;
    return this.enemies.find((e) => e.id === id) ?? this.dummies.find((d) => d.id === id);
  }

  private separateBodies(): void {
    const bodies: { x: number; y: number; r: number; ref: Enemy | Boss }[] = this.enemies
      .filter((e) => !e.dead)
      .map((e) => ({ x: e.x, y: e.y, r: e.def.radius, ref: e }));
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = length(dx, dy) || 0.01;
        const min = a.r + b.r + 4;
        if (d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.ref.x -= nx * push;
          a.ref.y -= ny * push;
          b.ref.x += nx * push;
          b.ref.y += ny * push;
        }
      }
    }
    // corpos não atravessam o jogador (exceto durante o dash)
    if (this.player.dash.state !== 'dashing' && !this.player.dead) {
      const solids: (Enemy | Boss)[] = this.enemies.filter((e) => !e.dead);
      if (this.boss && !this.boss.dead && !this.boss.scripted) solids.push(this.boss);
      for (const e of solids) {
        const r = e instanceof Boss ? e.def.radius : e.def.radius;
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const d = length(dx, dy) || 0.01;
        const min = r + this.player.radius;
        if (d < min) {
          const push = min - d;
          if (e instanceof Boss) {
            this.player.x -= (dx / d) * push;
            this.player.y -= (dy / d) * push;
          } else {
            e.x += (dx / d) * push * 0.7;
            e.y += (dy / d) * push * 0.7;
            this.player.x -= (dx / d) * push * 0.3;
            this.player.y -= (dy / d) * push * 0.3;
          }
        }
      }
      const p = resolveCircle(this.player.x, this.player.y, this.player.radius, FLOOR, this.layout.obstacles);
      this.player.x = p.x;
      this.player.y = p.y;
    }
    for (const b of bodies) {
      const p = resolveCircle(b.ref.x, b.ref.y, b.r, FLOOR, this.layout.obstacles);
      b.ref.x = p.x;
      b.ref.y = p.y;
    }
  }

  // =================================================================== combate
  private onAttackStart(step: ComboStepDef, index: number): void {
    Sfx.swing(index);
    if (step.finisher) this.effects.telegraphPulse(this.player.x + this.player.facing * 20, this.player.chestY - 20, 0xffd77a);
  }

  private onAttackActive(step: ComboStepDef, index: number, angle: number): void {
    const p = this.player;
    this.hitboxes.spawn({
      shape: { kind: 'sector', x: p.x, y: p.y, radius: step.range, angle, halfArc: degToRad(step.arcDeg / 2) },
      team: 'player',
      damage: step.damage * p.stats.get('damageMul'),
      knockback: step.knockback,
      duration: step.active,
      tag: step.id,
      follow: () => ({ x: p.x, y: p.y }),
      meta: { hitstop: step.hitstop, heavy: !!step.finisher, basic: true }
    });
    const key = `slash_${index + 1}`;
    const flip = index === 1 ? p.facing > 0 : p.facing < 0;
    this.effects.slash(p.x + Math.cos(angle) * 10, p.y - 34 + Math.sin(angle) * 10, angle, key, step.range * 0.95, {
      flipY: flip,
      duration: step.finisher ? 220 : 150,
      arcSpin: index === 1 ? 0.7 : 0.45,
      tint: step.finisher ? 0xffd890 : 0xffe6b0
    });
    if (step.shake) this.effects.shake(step.finisher ? 160 : 90, step.shake);
    if (step.finisher) {
      this.effects.shockRing(p.x + Math.cos(angle) * 60, p.y + Math.sin(angle) * 60, 80, 0xffc060, 260);
      this.effects.dustPuff(p.x + Math.cos(angle) * 50, p.y + Math.sin(angle) * 50, 6);
      this.fireBlessings('comboFinisher', { x: p.x, y: p.y, angle });
    }
  }

  private aimAssist(x: number, y: number, angle: number, range: number): number {
    let best: { a: number; score: number } | null = null;
    const cands: { x: number; y: number }[] = this.enemies.filter((e) => !e.dead);
    if (this.boss && !this.boss.dead) cands.push(this.boss);
    for (const e of cands) {
      const d = length(e.x - x, e.y - y);
      if (d > range) continue;
      const a = Math.atan2(e.y - y, e.x - x);
      const diff = Math.abs(angleDiff(angle, a));
      if (diff > 0.55) continue;
      const score = diff + d / 600;
      if (!best || score < best.score) best = { a, score };
    }
    if (!best) return angle;
    return angle + angleDiff(angle, best.a) * 0.7;
  }

  private resolveHits(hits: HitResult[]): void {
    for (const { box, target } of hits) {
      const c = this.combatantById(target.id);
      if (!c) continue;
      const s = box.spec;
      let dir = s.knockbackDir ?? normalize(target.x - s.shape.x, target.y - s.shape.y);
      if (dir.x === 0 && dir.y === 0) dir = { x: 1, y: 0 };
      const heavy = !!s.meta?.heavy;
      const basic = !!s.meta?.basic;
      const hit: HitInfo = { damage: s.damage, knockback: s.knockback, dirX: dir.x, dirY: dir.y, tag: s.tag, basic, heavy };
      const dealt = c.receiveHit(hit);
      if (dealt <= 0 || s.team !== 'player') continue;

      const chestY = target.y - (c instanceof Boss ? 100 : 55);
      const hs = (s.meta?.hitstop as number | undefined) ?? (heavy ? 70 : 35);
      this.hitstop(hs);
      this.effects.hitSpark(target.x, chestY, Math.atan2(dir.y, dir.x), heavy);
      this.effects.damageNumber(target.x, chestY - 30, dealt, heavy ? '#ffd77a' : '#f1e3c4', heavy);
      Sfx.hit(heavy);
      if (heavy) this.effects.shake(110, 0.006);
      if (basic && !(c instanceof TrainingDummy)) this.fireBlessings('basicHit', { x: target.x, y: target.y, angle: 0, target: c });
    }
  }

  hitstop(ms: number): void {
    if (ms <= 0) return;
    this.hitstopTimer = Math.max(this.hitstopTimer, ms);
  }

  private slowMotion(scale: number, ms: number): void {
    this.slowmo = { remaining: ms, scale };
    this.timeScale = scale;
    this.tweens.timeScale = scale;
  }

  private onPlayerDamaged(amount: number, hit: HitInfo): void {
    Sfx.playerHurt();
    this.effects.shake(180, 0.011);
    this.effects.flash(120, 140, 20, 20);
    this.effects.damageNumber(this.player.x, this.player.chestY - 40, amount, '#ff5a4a', true);
    this.effects.hitSpark(this.player.x, this.player.chestY, Math.atan2(hit.dirY, hit.dirX), true, 0xff6a50);
    this.hitstop(60);
    this.ui()?.damagePulse();
    this.fireBlessings('damaged', { x: this.player.x, y: this.player.y, angle: 0 });
  }

  // =================================================================== bênçãos (executor único)
  private fireBlessings(on: Parameters<BlessingSystem['trigger']>[0], ctx: { x: number; y: number; angle: number; target?: Combatant }): void {
    for (const { action } of this.blessings.trigger(on)) this.runBlessingAction(action, ctx);
  }

  private runBlessingAction(a: BlessingAction, ctx: { x: number; y: number; angle: number; target?: Combatant }): void {
    const p = this.player;
    switch (a.kind) {
      case 'burn':
        if (ctx.target && ctx.target.hurtbox.alive) this.statuses.applyBurn(ctx.target, a.dps, a.duration);
        break;
      case 'heal': {
        const healed = p.heal(a.amount);
        if (healed > 0) {
          this.effects.damageNumber(p.x, p.chestY - 50, healed, '#8fe07a');
          Sfx.heal();
        }
        break;
      }
      case 'groundFire':
        this.hitboxes.spawn({
          shape: { kind: 'circle', x: ctx.x, y: ctx.y, radius: a.radius },
          team: 'player',
          damage: Math.max(1, Math.round((a.dps * 500) / 1000)),
          knockback: 0,
          duration: a.duration,
          rehitInterval: 500,
          tag: 'ground_fire',
          meta: { hitstop: 0 }
        });
        this.effects.groundFire(ctx.x, ctx.y, a.radius, a.duration);
        break;
      case 'timedStat': {
        const had = p.stats.hasTimed(a.stat);
        p.stats.addTimed(a.stat, a.add, a.duration);
        if (!had) this.effects.floatingText(p.x, p.chestY - 60, 'Vontade Inquebrável', '#cfe0ec', 16);
        break;
      }
      case 'wave': {
        const speed = a.speed;
        const dur = (a.range / speed) * 1000;
        const vx = Math.cos(ctx.angle) * speed;
        const vy = Math.sin(ctx.angle) * speed;
        this.hitboxes.spawn({
          shape: { kind: 'circle', x: ctx.x + Math.cos(ctx.angle) * 40, y: ctx.y + Math.sin(ctx.angle) * 40, radius: a.width / 2 },
          team: 'player',
          damage: a.damage * p.stats.get('damageMul'),
          knockback: 200,
          duration: dur,
          velocity: { x: vx, y: vy },
          tag: 'consecrated_wave',
          knockbackDir: { x: Math.cos(ctx.angle), y: Math.sin(ctx.angle) },
          meta: { hitstop: 20 }
        });
        const img = this.add.image(ctx.x, ctx.y - 34, 'slash_3').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlayFx - 4).setTint(0xfff1b0);
        img.setRotation(ctx.angle).setScale(0.5);
        this.tweens.add({
          targets: img,
          x: ctx.x + (vx * dur) / 1000,
          y: ctx.y - 34 + (vy * dur) / 1000,
          alpha: { from: 1, to: 0.1 },
          scale: 0.75,
          duration: dur,
          onComplete: () => img.destroy()
        });
        break;
      }
    }
  }

  applyBlessing(id: string): void {
    const def = getBlessing(id);
    if (!def) return;
    if (this.blessings.grant(def)) {
      Sfx.blessing();
      this.effects.shockRing(this.player.x, this.player.y, 160, def.color, 600);
      this.effects.embersAt(this.player.x, this.player.chestY, 18);
      this.ui()?.banner(def.name, 'Bênção concedida', def.color);
    }
  }

  // =================================================================== fluxo da partida
  private beginTrial(): void {
    this.altarGlow?.destroy();
    this.altarGlow = null;
    for (const d of this.dummies) {
      this.effects.deathBurst(d.x, d.y, 0xd0b080);
      d.destroy();
    }
    this.dummies = [];
    this.handleDirector(this.director.startNextWave());
  }

  private handleDirector(events: DirectorEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'waveStart':
          Sfx.waveStart();
          this.effects.shake(400, 0.004);
          this.ui()?.banner(ev.wave.name, `Onda ${ev.index + 1} de ${this.director.totalWaves}`);
          break;
        case 'spawnGroup': {
          let delay = 0;
          for (const s of ev.group.spawns) {
            for (let i = 0; i < s.count; i++) {
              this.queueSpawn(s.kind, delay);
              delay += 160;
            }
          }
          break;
        }
        case 'waveCleared':
          this.onWaveCleared();
          break;
        case 'bossIntro':
          this.startBossIntro();
          break;
        default:
          break;
      }
    }
  }

  private pickSpawnPoint(): { x: number; y: number } {
    for (let tries = 0; tries < 40; tries++) {
      const x = FLOOR.x + 80 + Math.random() * (FLOOR.w - 160);
      const y = FLOOR.y + 60 + Math.random() * (FLOOR.h - 120);
      if (length(x - this.player.x, y - this.player.y) < 360) continue;
      if (this.layout.obstacles.some((o) => length(x - o.x, y - o.y) < o.r + 50)) continue;
      return { x, y };
    }
    return { x: ARENA_CENTER.x, y: FLOOR.y + 120 };
  }

  private queueSpawn(kind: EnemyKind, delay: number): void {
    this.pendingSpawns++;
    const pt = this.pickSpawnPoint();
    this.time.delayedCall(delay, () => {
      if (this.director.over) {
        this.pendingSpawns--;
        return;
      }
      this.effects.spawnSigil(pt.x, pt.y, 850);
      this.time.delayedCall(800, () => {
        this.pendingSpawns--;
        if (this.director.over) return;
        this.spawnEnemy(kind, pt.x, pt.y);
      });
    });
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const e = new Enemy(this, ENEMIES[kind], x, y, {
      hitboxes: this.hitboxes,
      projectiles: this.projectiles,
      effects: this.effects,
      collide: (px, py, r) => resolveCircle(px, py, r, FLOOR, this.layout.obstacles),
      onDeath: (en) => this.onEnemyDeath(en),
      onDamaged: () => undefined
    });
    this.enemies.push(e);
    this.effects.spawnBurst(x, y);
    return e;
  }

  private onEnemyDeath(e: Enemy): void {
    this.kills++;
    this.hitstop(55);
    this.effects.shake(120, 0.005);
    this.fireBlessings('kill', { x: e.x, y: e.y, angle: 0, target: e });
  }

  private onWaveCleared(): void {
    this.slowMotion(0.35, 450);
    this.projectiles.clearTeam('enemy');
    this.time.delayedCall(500, () => {
      this.ui()?.banner('Provação superada', 'Uma brasa de bênção surge no altar');
      Sfx.blessing();
      this.spawnBlessingOrb();
    });
  }

  private spawnBlessingOrb(): void {
    const { x, y } = this.layout.altarPos;
    this.orbLight = this.add.image(x, y - 10, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc060).setDepth(DEPTH.groundFx).setDisplaySize(420, 260).setAlpha(0);
    this.tweens.add({ targets: this.orbLight, alpha: 0.7, duration: 600 });
    this.orb = this.add.image(x, y - 60, 'blessing_orb').setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 1).setScale(0.2);
    this.tweens.add({ targets: this.orb, scale: 0.9, duration: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.orb, y: y - 72, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.orb, angle: 360, duration: 6000, repeat: -1 });
    this.effects.shockRing(x, y, 140, 0xffc060, 600);
    this.interactables.push({ id: 'orb', x, y, r: 120, label: 'Receber Bênção', action: () => this.openReward() });
  }

  private openReward(): void {
    this.director.beginReward();
    const offer = this.blessings.rollOffer();
    if (this.orb) {
      const o = this.orb;
      this.tweens.killTweensOf(o);
      this.tweens.add({ targets: o, scale: 1.6, alpha: 0, duration: 300, onComplete: () => o.destroy() });
      this.orb = null;
    }
    if (this.orbLight) {
      const l = this.orbLight;
      this.tweens.add({ targets: l, alpha: 0, duration: 500, onComplete: () => l.destroy() });
      this.orbLight = null;
    }
    this.effects.explosion(this.layout.altarPos.x, this.layout.altarPos.y, 60);
    if (offer.length === 0) {
      this.afterReward();
      return;
    }
    this.scene.pause();
    this.scene.launch('RewardScene', {
      offer: offer.map((b) => b.id),
      onChoose: (id: string) => {
        this.applyBlessing(id);
        this.afterReward();
      }
    });
  }

  private afterReward(): void {
    this.time.delayedCall(1300, () => {
      if (this.director.over) return;
      this.handleDirector(this.director.startNextWave());
    });
  }

  private startBossIntro(): void {
    const { gate, gatePos } = this.layout;
    this.player.locked = true;
    this.ui()?.banner('Os portões se abrem', 'Algo pesado se aproxima...', 0xd0473a);
    Sfx.slam();
    this.effects.shake(1300, 0.004);
    this.tweens.add({ targets: gate, y: gate.y - 230, duration: 1400, ease: 'Sine.easeInOut' });
    this.camTarget = { x: gatePos.x, y: FLOOR.y + 120 };
    this.time.delayedCall(1000, () => {
      this.boss = new Boss(this, EXECUTIONER, gatePos.x, FLOOR.y - 10, {
        hitboxes: this.hitboxes,
        effects: this.effects,
        collide: (px, py, r) => resolveCircle(px, py, r, FLOOR, this.layout.obstacles),
        onDamaged: () => undefined,
        onPhaseChange: () => this.onBossPhase2(),
        onDeath: () => this.onBossDeath()
      });
      this.introWalk = true;
    });
    this.time.delayedCall(2700, () => {
      if (!this.boss) return;
      Sfx.bossRoar();
      this.effects.shake(700, 0.007);
      this.effects.shockRing(this.boss.x, this.boss.y, 220, 0xd0473a, 600);
      this.ui()?.bossIntro(EXECUTIONER.name, EXECUTIONER.title);
    });
    this.time.delayedCall(4600, () => {
      if (!this.boss || this.director.over) return;
      this.introWalk = false;
      this.camTarget = null;
      this.player.locked = false;
      this.handleDirector(this.director.bossStart());
      this.boss.startFight();
    });
  }

  private onBossPhase2(): void {
    this.ui()?.banner('Fúria do Carrasco', 'Ele não recua mais', 0xff6a30);
    this.projectiles.clearTeam('enemy');
    this.time.delayedCall(900, () => {
      if (this.director.over || !this.boss || this.boss.dead) return;
      this.queueSpawn('recruit', 0);
      this.queueSpawn('recruit', 200);
    });
  }

  private onBossDeath(): void {
    if (!this.boss) return;
    const b = this.boss;
    this.slowMotion(0.25, 1600);
    this.effects.flash(400, 255, 230, 180);
    this.effects.shake(900, 0.014);
    this.effects.explosion(b.x, b.y, 180);
    this.effects.deathBurst(b.x, b.y, 0xffd77a);
    Sfx.explosion();
    Sfx.bossRoar();
    this.handleDirector(this.director.bossDefeated());
    this.hitboxes.clear();
    this.projectiles.clear();
    for (const e of this.enemies) if (!e.dead) e.receiveHit({ damage: 9999, knockback: 300, dirX: 0, dirY: -1, tag: 'victory' });
    this.time.delayedCall(1700, () => {
      this.ui()?.banner('O Carrasco caiu', 'Recompensa: Fragmento da Provação', 0xffd77a);
      Sfx.victory();
      this.effects.embersAt(b.x, b.y - 40, 40);
    });
    this.time.delayedCall(4800, () => this.endRun(true));
  }

  private onPlayerDeath(): void {
    this.handleDirector(this.director.playerDied());
    this.slowMotion(0.3, 1400);
    this.effects.flash(300, 120, 0, 0);
    this.effects.shake(500, 0.01);
    Sfx.defeat();
    this.ui()?.banner('Atriox caiu', 'A provação não perdoa', 0xd0473a);
    try {
      this.cameras.main.postFX?.addColorMatrix().grayscale(0.85);
    } catch {
      /* Canvas renderer: sem pós-processamento */
    }
    this.time.delayedCall(3200, () => this.endRun(false));
  }

  private endRun(victory: boolean): void {
    if (this.ending) return;
    this.ending = true;
    const { newBest } = save.recordRun({ victory, timeMs: this.runTime, highestWave: this.director.highestWave });
    const result: RunResult = {
      victory,
      timeMs: this.runTime,
      highestWave: this.director.highestWave,
      kills: this.kills,
      blessings: this.blessings.owned.map((b) => b.name),
      newBest
    };
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.postFX?.clear();
      this.scene.stop('UIScene');
      this.scene.start('ResultScene', result);
    });
  }

  // =================================================================== interação e câmera
  private updateInteractables(): void {
    let near: Interactable | null = null;
    for (const it of this.interactables) {
      if (length(it.x - this.player.x, it.y - this.player.y) <= it.r) near = it;
    }
    this.nearInteractable = this.player.locked || this.player.dead ? null : near;
    if (this.nearInteractable) {
      this.promptText.setText(`[E]  ${this.nearInteractable.label}`);
      this.promptText.setPosition(this.nearInteractable.x, this.nearInteractable.y - 120);
      this.promptText.setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    let tx: number;
    let ty: number;
    if (this.camTarget) {
      tx = this.camTarget.x;
      ty = this.camTarget.y;
    } else {
      const p = this.input.activePointer;
      const wp = p.positionToCamera(cam) as Phaser.Math.Vector2;
      const lx = Phaser.Math.Clamp((wp.x - this.player.x) * 0.15, -110, 110);
      const ly = Phaser.Math.Clamp((wp.y - this.player.chestY) * 0.15, -80, 80);
      tx = this.player.x + lx;
      ty = this.player.y - 40 + ly;
    }
    const k = 1 - Math.exp(-dt / (this.camTarget ? 260 : 110));
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    cam.centerOn(cx + (tx - cx) * k, cy + (ty - cy) * k);
  }

  private drawDebug(hurtboxes: Hurtbox[]): void {
    const g = this.debugGfx;
    g.clear();
    for (const h of hurtboxes) {
      g.lineStyle(1.5, h.invulnerable ? 0x60a0ff : 0x40ff70, 0.9);
      g.strokeCircle(h.x, h.y, h.radius);
    }
    for (const b of this.hitboxes.all) {
      const s = b.spec.shape;
      g.lineStyle(2, b.active ? 0xff3030 : 0xffd040, 0.9);
      if (s.kind === 'circle') g.strokeCircle(s.x, s.y, s.radius);
      else if (s.kind === 'ring') {
        g.strokeCircle(s.x, s.y, s.inner);
        g.strokeCircle(s.x, s.y, s.outer);
      } else if (s.kind === 'sector') {
        g.slice(s.x, s.y, s.radius, s.angle - s.halfArc, s.angle + s.halfArc, false);
        g.strokePath();
      } else {
        const ux = Math.cos(s.angle);
        const uy = Math.sin(s.angle);
        const px = -uy * (s.width / 2);
        const py = ux * (s.width / 2);
        g.strokePoints(
          [
            new Phaser.Geom.Point(s.x + px, s.y + py),
            new Phaser.Geom.Point(s.x + ux * s.length + px, s.y + uy * s.length + py),
            new Phaser.Geom.Point(s.x + ux * s.length - px, s.y + uy * s.length - py),
            new Phaser.Geom.Point(s.x - px, s.y - py)
          ],
          true
        );
      }
    }
    // origem do sprite do Atriox
    const sp = this.player.sprite;
    g.lineStyle(1, 0xffffff, 1);
    g.lineBetween(sp.x - 8, sp.y, sp.x + 8, sp.y);
    g.lineBetween(sp.x, sp.y - 8, sp.x, sp.y + 8);
    g.lineStyle(1, 0xffd77a, 0.6);
    g.strokeRect(sp.getBounds().x, sp.getBounds().y, sp.getBounds().width, sp.getBounds().height);
    for (const o of this.layout.obstacles) {
      g.lineStyle(1, 0x8080ff, 0.6);
      g.strokeCircle(o.x, o.y, o.r);
    }
  }

  // =================================================================== HUD e depuração
  getHud(): HudState {
    const p = this.player;
    const b = this.boss;
    const phase = this.director.phase;
    const wave = this.director.currentWave;
    let waveLabel = '';
    if (phase === 'tutorial') waveLabel = 'Preparação';
    else if (phase === 'wave' || phase === 'waveCleared' || phase === 'reward') waveLabel = wave ? `${wave.name}  ·  ${this.director.waveIndex + 1}/${this.director.totalWaves}` : '';
    else if (phase === 'bossIntro' || phase === 'boss') waveLabel = 'Provação Final';
    else waveLabel = phase === 'victory' ? 'Vitória' : 'Derrota';
    return {
      hp: Math.max(0, Math.ceil(p.health.current)),
      maxHp: p.health.max,
      dashProgress: p.dash.cooldown.progress,
      spellProgress: p.spell.cooldown.progress,
      comboIndex: p.combo.displayIndex,
      comboActive: p.combo.attacking || p.combo.nextIndex > 0,
      enemies: this.aliveEnemies() + this.pendingSpawns + (b && !b.dead ? 1 : 0),
      waveLabel,
      phase,
      boss: b && (phase === 'boss' || phase === 'victory') ? { name: b.def.name, title: b.def.title, ratio: b.hpRatio, phase: b.brain.phase } : null,
      blessings: this.blessings.owned,
      tutorial: phase === 'tutorial' ? { ...p.usage } : null,
      prompt: this.nearInteractable ? this.nearInteractable.label : null,
      timeMs: this.runTime,
      resistBuff: p.stats.hasTimed('resist'),
      stats: p.stats.snapshot()
    };
  }

  debugSnapshot(): Record<string, unknown> {
    return {
      phase: this.director.phase,
      wave: this.director.waveIndex,
      enemies: this.enemies.length,
      alive: this.aliveEnemies(),
      pendingSpawns: this.pendingSpawns,
      hitboxes: this.hitboxes.all.length,
      projectiles: this.projectiles.count,
      hp: this.player.health.current,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), anim: this.player.animator.state, dead: this.player.dead },
      boss: this.boss ? { hp: this.boss.health.current, phase: this.boss.brain.phase, state: this.boss.brain.state } : null,
      blessings: this.blessings.owned.map((b) => b.id),
      kills: this.kills,
      listeners: {
        pointerdown: this.input.listenerCount('pointerdown'),
        escDown: this.keys.ESC.listenerCount('down'),
        eDown: this.keys.E.listenerCount('down'),
        spaceDown: this.keys.SPACE.listenerCount('down'),
        sceneShutdown: this.events.listenerCount(Phaser.Scenes.Events.SHUTDOWN)
      },
      displayObjects: this.children.length,
      hurtboxes: this.lastHurtboxes.length
    };
  }

  // ------------------------------------------------------------- comandos do painel de desenvolvimento
  devKillAll(): void {
    for (const e of this.enemies) if (!e.dead) e.receiveHit({ damage: 9999, knockback: 200, dirX: 0, dirY: -1, tag: 'dev' });
  }

  devSkipToBoss(): void {
    if (this.director.phase === 'tutorial') this.beginTrial();
    this.devKillAll();
    // força as ondas restantes a terminarem
    const guard = 10;
    for (let i = 0; i < guard && this.director.phase !== 'bossIntro' && this.director.phase !== 'boss'; i++) {
      if (this.director.phase === 'wave') this.director.tick(0);
      if (this.director.phase === 'waveCleared') {
        this.director.beginReward();
        this.handleDirector(this.director.startNextWave());
      }
    }
  }

  devDamageBoss(ratio: number): void {
    if (this.boss && !this.boss.dead) this.boss.receiveHit({ damage: this.boss.def.hp * ratio, knockback: 0, dirX: 0, dirY: 0, tag: 'dev' });
  }
}
