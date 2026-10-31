import {
  TOKNAR,
  BUFFS,
  ETERNITY,
  FINAL_BOSS,
  SKILLS,
  type AltarBuff,
} from '../../data/v03';
import { Toknar } from '../entities/Toknar';
import { GiftBuild, type GiftOffer } from '../progression/GiftBuild';
import { AdvancedCombat } from '../combat/AdvancedCombat';
import Phaser from 'phaser';
import {
  ARENA_CENTER,
  CAMERA_ZOOM,
  DEPTH,
  DEV_TOOLS,
  FLOOR,
  WORLD_H,
  WORLD_W,
} from '../config/constants';
import { ENEMIES, type EnemyKind } from '../../data/enemies';
import { EXECUTIONER, CAIM } from '../../data/bosses';
import { ROOMS, type RewardKind } from '../../data/rooms';
import type { SpawnKind } from '../../data/waves';
import { BOSS_DIALOGUES, type BossDialogueId } from '../../data/dialogues';
import { JUDGMENT_FLAME } from '../../data/abilities';
import {
  AVATAR,
  BLESSING_OF_GLORY,
  GLORY_BLADE,
  RADIANT_IMPETUS,
  SECOND_SUN,
  getGift,
  type ApollonGiftId,
} from '../../data/apollon';
import {
  getBlessing,
  type BlessingAction,
  type BlessingDef,
} from '../../data/blessings';
import type { ComboStepDef } from '../../data/attacks';
import { Player, type PlayerInput } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Caim } from '../entities/Caim';
import { Wyvern } from '../entities/Wyvern';
import { TrainingDummy } from '../entities/TrainingDummy';
import type { Combatant, HitInfo } from '../entities/types';
import {
  HitboxSystem,
  type HitResult,
  type Hurtbox,
} from '../combat/HitboxSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { StatusSystem } from '../combat/StatusSystem';
import { BloodExposure, BloodPoolSystem } from '../combat/Blood';
import { angleDiff, degToRad, length, normalize } from '../combat/geometry';
import { RunDirector, type RunEvent } from '../systems/RunDirector';
import { BlessingSystem } from '../progression/BlessingSystem';
import { JudgmentFlame } from '../abilities/JudgmentFlame';
import { Effects } from '../fx/Effects';
import { BloodRenderer } from '../fx/BloodRenderer';
import { BlessingCinematic } from '../fx/BlessingCinematic';
import {
  buildArena,
  destroyArena,
  type ArenaLayout,
} from '../systems/ArenaBuilder';
import { pointBlocked, resolveCircle } from '../systems/Collision';
import { inputVector } from '../systems/Movement';
import { Sfx } from '../audio/Sfx';
import { save } from '../services';
import {
  ATLAS_KEY,
  getLibrary,
  type AnimLibrary,
} from '../animation/SpriteAnimator';
import type { UIScene } from './UIScene';

interface Interactable {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  action: () => void;
}

interface Door {
  x: number;
  y: number;
  kind: RewardKind;
  objects: Phaser.GameObjects.GameObject[];
}

export interface RewardOffer {
  id: string;
  name: string;
  description: string;
  color: number;
  glyph: string;
  tag?: string;
}

export interface HudState {
  details: string;
  options: string[];
  buff: string;
  bossExtra: string;
  arrows: { x: number; y: number; angle: number; label: string }[];
  hp: number;
  maxHp: number;
  dashCharges: number;
  dashMax: number;
  dashRecharge: number;
  spellProgress: number;
  sunUnlocked: boolean;
  sunProgress: number;
  avatarUnlocked: boolean;
  glory: number;
  comboIndex: number;
  comboActive: boolean;
  enemies: number;
  roomLabel: string;
  phase: string;
  boss: { name: string; title: string; ratio: number; phase: number } | null;
  blessings: BlessingDef[];
  gifts: { name: string; glyph: string; color: number }[];
  tutorial: {
    moved: boolean;
    attacked: boolean;
    dashed: boolean;
    cast: boolean;
  } | null;
  prompt: string | null;
  timeMs: number;
  resistBuff: boolean;
  exposure: number;
  stunned: boolean;
  stunImmune: boolean;
  cinematic: boolean;
  canSkip: boolean;
  stats: Record<string, number>;
}

export interface RunResult {
  victory: boolean;
  timeMs: number;
  highestWave: number;
  kills: number;
  blessings: string[];
  newBest: boolean;
  roomName: string;
  gloryGranted: boolean | null;
  endlessWave?: number;
}

type Queued = {
  attack: boolean;
  cast: boolean;
  dash: boolean;
  sun: boolean;
  avatar: boolean;
  captive: boolean;
};
const NO_INPUT = (): Queued => ({
  attack: false,
  cast: false,
  dash: false,
  sun: false,
  avatar: false,
  captive: false,
});

/** Cena principal: sequência de salas do Campo de Provação até a Arena de Nemeia. */
export class ArenaScene extends Phaser.Scene {
  build!: GiftBuild;
  skills!: AdvancedCombat;
  toknar: Toknar | null = null;
  giftOffers: GiftOffer[] = [];
  altarBuff: AltarBuff | null = null;
  buffActive: AltarBuff | null = null;
  private buffRooms = 0;
  private buffTaken = false;
  infection = 0;
  infectionMs = 0;
  endless = false;
  endlessWave = 0;
  private endlessWaiting = false;
  private campaignRecorded = false;
  private roomEpoch = 0;
  private metrics = { realMs: 0, simulationMs: 0, updates: 0, maxDelta: 0 };
  player!: Player;
  enemies: Enemy[] = [];
  wyverns: Wyvern[] = [];
  boss: Boss | null = null;
  caim: Caim | null = null;
  dummies: TrainingDummy[] = [];
  hitboxes!: HitboxSystem;
  projectiles!: ProjectileSystem;
  statuses!: StatusSystem;
  pools!: BloodPoolSystem;
  exposure!: BloodExposure;
  effects!: Effects;
  run!: RunDirector;
  blessings!: BlessingSystem;
  private lib!: AnimLibrary;
  private bloodRenderer!: BloodRenderer;
  private spell!: JudgmentFlame;
  private layout!: ArenaLayout;
  private keys!: Record<
    | 'W'
    | 'A'
    | 'S'
    | 'D'
    | 'UP'
    | 'DOWN'
    | 'LEFT'
    | 'RIGHT'
    | 'SPACE'
    | 'E'
    | 'ESC'
    | 'SHIFT'
    | 'Q'
    | 'F'
    | 'R',
    Phaser.Input.Keyboard.Key
  >;
  private queued: Queued = NO_INPUT();
  private pendingSpawns = 0;
  private hitstopTimer = 0;
  private timeScale = 1;
  private slowmo = { remaining: 0, scale: 1 };
  runTime = 0;
  kills = 0;
  private interactables: Interactable[] = [];
  private lastHintAt = -Infinity;
  private doors: Door[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private nearInteractable: Interactable | null = null;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private exposureGfx!: Phaser.GameObjects.Graphics;
  showHitboxes = false;
  private ending = false;
  private transitioning = false;
  private camTarget: { x: number; y: number } | null = null;
  private introWalk: 'executioner' | 'caim' | null = null;
  /** conversa pré-chefe aberta (arena pausada) */
  dialogueActive = false;
  private orbObjects: Phaser.GameObjects.GameObject[] = [];
  private cinematic: BlessingCinematic | null = null;
  private gloryGranted: boolean | null = null;
  private lastHurtboxes: Hurtbox[] = [];
  private highestRoom = 0;

  constructor() {
    super('ArenaScene');
  }

  // =================================================================== ciclo de vida
  create(): void {
    // a instância é reaproveitada ao reiniciar: reinicializar TODO o estado aqui
    this.toknar = null;
    this.giftOffers = [];
    this.altarBuff = null;
    this.buffActive = null;
    this.buffRooms = 0;
    this.buffTaken = false;
    this.infection = 0;
    this.infectionMs = 0;
    this.endless = false;
    this.endlessWave = 0;
    this.endlessWaiting = false;
    this.campaignRecorded = false;
    this.roomEpoch = 0;
    this.metrics = { realMs: 0, simulationMs: 0, updates: 0, maxDelta: 0 };
    this.enemies = [];
    this.wyverns = [];
    this.boss = null;
    this.caim = null;
    this.dummies = [];
    this.queued = NO_INPUT();
    this.attackHeld = false;
    this.attackReleased = false;
    this.pendingSpawns = 0;
    this.hitstopTimer = 0;
    this.timeScale = 1;
    this.slowmo = { remaining: 0, scale: 1 };
    this.runTime = 0;
    this.kills = 0;
    this.interactables = [];
    this.lastHintAt = -Infinity;
    this.doors = [];
    this.nearInteractable = null;
    this.ending = false;
    this.transitioning = false;
    this.camTarget = null;
    this.introWalk = null;
    this.dialogueActive = false;
    this.orbObjects = [];
    this.cinematic = null;
    this.gloryGranted = null;
    this.lastHurtboxes = [];
    this.highestRoom = 0;
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    save.recordAttempt();
    this.lib = getLibrary(this);

    this.effects = new Effects(this);
    this.hitboxes = new HitboxSystem();
    this.statuses = new StatusSystem();
    this.pools = new BloodPoolSystem();
    this.exposure = new BloodExposure();
    this.bloodRenderer = new BloodRenderer(this);
    this.projectiles = new ProjectileSystem(this, (x, y) =>
      pointBlocked(x, y, FLOOR, this.layout.obstacles),
    );
    this.run = new RunDirector(ROOMS);

    this.player = new Player(
      this,
      ARENA_CENTER.x,
      ARENA_CENTER.y + 250,
      this.lib,
      {
        onAttackStart: (step) => this.onAttackStart(step),
        onAttackActive: (step, _i, a) => this.onAttackActive(step, a),
        onCastStart: (a) =>
          this.spell.charge(
            this.player.x + Math.cos(a) * 24,
            this.player.chestY,
          ),
        onCastRelease: (a) => {
          this.spell.cast(this.player.x, this.player.y, a);
          this.skills.cast();
        },
        onAdvanced: (kind, angle, perfect) =>
          this.onAdvanced(kind, angle, perfect),
        onCaptive: () => this.skills.captive(),
        onSunStart: (x, y) => this.onSunStart(x, y),
        onSunRelease: (x, y) => this.onSunRelease(x, y),
        onAvatarStart: () => this.onAvatarStart(),
        onAvatarBeam: (facing) => this.onAvatarBeam(facing),
        onAvatarNova: () => this.onAvatarNova(),
        onDash: (dir, radiant) => this.onDash(dir, radiant),
        onDashTick: (x0, y0, x1, y1) => this.onDashTick(x0, y0, x1, y1),
        onDamaged: (amount, hit) => this.onPlayerDamaged(amount, hit),
        onDeath: () => this.onPlayerDeath(),
        onFootstep: (x, y) => this.effects.dustPuff(x, y, 1),
        aimAssist: (x, y, angle, range) => this.aimAssist(x, y, angle, range),
      },
    );
    if (save.data.unlocks.blessingOfGlory)
      this.player.dashPurifyMs = BLESSING_OF_GLORY.purifyMs;
    this.build = new GiftBuild(this.player.gifts);
    this.skills = new AdvancedCombat(this);
    this.blessings = new BlessingSystem(this.player.stats);
    this.spell = new JudgmentFlame(JUDGMENT_FLAME, {
      hitboxes: this.hitboxes,
      projectiles: this.projectiles,
      effects: this.effects,
      damageMul: () => this.player.stats.get('damageMul'),
      onImpact: (x, y) => this.fireBlessings('spellImpact', { x, y, angle: 0 }),
    });

    this.promptText = this.add
      .text(0, 0, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#ffd77a',
        stroke: '#140a08',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlayFx + 80)
      .setVisible(false);
    this.debugGfx = this.add.graphics().setDepth(DEPTH.overlayFx + 100);
    this.exposureGfx = this.add.graphics().setDepth(DEPTH.overlayFx - 40);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(CAMERA_ZOOM);
    cam.centerOn(this.player.x, this.player.y - 40);
    cam.fadeIn(700, 0, 0, 0);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      W: 'W',
      A: 'A',
      S: 'S',
      D: 'D',
      UP: 'UP',
      DOWN: 'DOWN',
      LEFT: 'LEFT',
      RIGHT: 'RIGHT',
      SPACE: 'SPACE',
      E: 'E',
      ESC: 'ESC',
      SHIFT: 'SHIFT',
      Q: 'Q',
      F: 'F',
      R: 'R',
    }) as typeof this.keys;
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    kb.addCapture(['SPACE', 'TAB', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.keys.ESC.on('down', this.openPause, this);
    this.keys.E.on('down', this.interact, this);
    // eventos de tecla (não JustDown): toques curtos não se perdem em FPS baixo
    this.keys.SPACE.on('down', this.queueDash, this);
    this.keys.SHIFT.on('down', this.queueDash, this);
    this.keys.Q.on('down', this.queueSun, this);
    this.keys.F.on('down', this.queueAvatar, this);
    this.keys.R.on('down', this.queueCaptive, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    else this.scene.get('UIScene').scene.restart();

    this.handleRun(this.run.begin());
    Sfx.startMusic();
    Sfx.setIntensity(0.1);

    if (
      DEV_TOOLS ||
      (['localhost', '127.0.0.1'].includes(location.hostname) &&
        new URLSearchParams(location.search).has('test'))
    ) {
      (window as unknown as { __ATRIOX__: unknown }).__ATRIOX__ = {
        arena: this,
        snapshot: () => this.debugSnapshot(),
      };
    }
  }

  private cleanup(): void {
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.onPointerUp, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.keys.ESC.off('down', this.openPause, this);
    this.keys.E.off('down', this.interact, this);
    this.keys.SPACE.off('down', this.queueDash, this);
    this.keys.SHIFT.off('down', this.queueDash, this);
    this.keys.Q.off('down', this.queueSun, this);
    this.keys.F.off('down', this.queueAvatar, this);
    this.keys.R.off('down', this.queueCaptive, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.clearRoomEntities();
    this.dummies.forEach((d) => d.destroy());
    this.dummies = [];
    this.cinematic?.destroy();
    this.cinematic = null;
    this.bloodRenderer.destroy();
    this.skills.destroy();
    this.player.destroy();
    Sfx.setIntensity(0);
  }

  ui(): UIScene | null {
    const s = this.scene.get('UIScene') as UIScene | undefined;
    return s && s.scene.isActive() ? s : null;
  }

  // =================================================================== entrada
  private trySkipCinematic(): boolean {
    if (!this.cinematic) return false;
    if (this.cinematic.canSkip) this.cinematic.skip();
    return true;
  }

  private attackReleased = false;
  private attackHeld = false;
  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (p.button === 0) {
      this.attackHeld = false;
      this.attackReleased = true;
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    Sfx.unlock();
    if (this.trySkipCinematic()) return;
    if (p.rightButtonDown()) this.queued.cast = true;
    else if (p.leftButtonDown()) {
      this.attackHeld = true;
      this.queued.attack = true;
    }
  }

  private queueDash(): void {
    if (this.trySkipCinematic()) return;
    this.queued.dash = true;
  }

  private queueSun(): void {
    this.queued.sun = true;
    if (!this.player.gifts.has('second_sun'))
      this.hint(
        'Q bloqueado: ganhe o dom Juízo do Segundo Sol numa porta ☀ (Dom de Apollon).',
      );
  }

  private queueAvatar(): void {
    this.queued.avatar = true;
    if (!this.player.gifts.has('avatar'))
      this.hint(
        'F bloqueado: ganhe o dom Avatar de Apollon numa porta ☀ (Dom de Apollon).',
      );
    else if (this.player.glory < AVATAR.gloryMax)
      this.hint(
        `Glória em ${Math.floor((this.player.glory / AVATAR.gloryMax) * 100)}%: acerte inimigos para encher a barra.`,
      );
  }

  private queueCaptive(): void {
    this.queued.captive = true;
    if (!this.player.gifts.has('captive_sun'))
      this.hint('R: receba o dom Sol Cativo em uma porta.');
  }

  /** Aviso curto quando uma tecla não tem efeito (no máximo 1 a cada 1,2 s). */
  private hint(msg: string): void {
    if (this.cinematic || this.ending || this.player.dead) return;
    const now = this.time.now;
    if (now - this.lastHintAt < 1200) return;
    this.lastHintAt = now;
    this.ui()?.toast(msg);
  }

  /** Perda de foco: limpa teclas pressionadas e pausa. */
  private onBlur(): void {
    this.input.keyboard?.resetKeys();
    this.queued = NO_INPUT();
    this.cancelAdvancedInput();
    if (
      this.scene.isActive() &&
      !this.ending &&
      !this.player.dead &&
      !this.cinematic &&
      !this.transitioning
    )
      this.openPause();
  }

  private readInput(): PlayerInput {
    const k = this.keys;
    const move = inputVector(
      k.A.isDown || k.LEFT.isDown,
      k.D.isDown || k.RIGHT.isDown,
      k.W.isDown || k.UP.isDown,
      k.S.isDown || k.DOWN.isDown,
    );
    // conversão tela → mundo respeita zoom, rolagem e escala do canvas
    const wp = this.input.activePointer.positionToCamera(
      this.cameras.main,
    ) as Phaser.Math.Vector2;
    const q = this.queued;
    this.queued = NO_INPUT();
    const released = this.attackReleased;
    this.attackReleased = false;
    const captive = q.captive;
    return {
      attackHeld: this.attackHeld,
      attackReleased: released,
      captivePressed: captive,
      move,
      aimX: wp.x,
      aimY: wp.y,
      attackPressed: q.attack,
      castPressed: q.cast,
      dashPressed: q.dash,
      sunPressed: q.sun,
      avatarPressed: q.avatar,
    };
  }

  private openPause(): void {
    if (this.ending || this.player.dead || this.transitioning) return;
    if (this.trySkipCinematic()) return;
    this.cancelAdvancedInput();
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  private cancelAdvancedInput(): void {
    this.attackHeld = false;
    this.attackReleased = false;
    this.queued.attack = false;
    this.player?.clearInput();
    for (const box of this.hitboxes.all)
      if (
        box.spec.team === 'player' &&
        ['charged', 'counter'].includes(box.spec.tag)
      )
        box.cancel();
  }

  private interact(): void {
    if (this.trySkipCinematic()) return;
    if (
      this.nearInteractable &&
      (this.run.phase === 'doors' || this.run.room?.kind === 'prep') &&
      !this.player.locked &&
      !this.player.dead &&
      !this.player.stunned &&
      !this.transitioning
    ) {
      const it = this.nearInteractable;
      this.interactables = this.interactables.filter((i) => i !== it);
      this.nearInteractable = null;
      Sfx.uiConfirm();
      it.action();
    } else if (!this.nearInteractable && !this.transitioning) {
      const target = this.interactables[0];
      if (!target)
        this.hint('E: nada para interagir agora. Termine o combate da sala.');
      else if (target.id === 'altar')
        this.hint('E: aproxime-se do altar no centro para iniciar a Provação.');
      else if (target.id.startsWith('door'))
        this.hint('E: aproxime-se de uma porta para escolher a próxima sala.');
      else this.hint('E: aproxime-se da recompensa para recolhê-la.');
    }
  }

  // =================================================================== loop
  update(_time: number, delta: number): void {
    // delta limitado (volta de aba) e aplicado uma única vez
    const dt = Math.min(delta, 50);
    this.metrics.realMs += delta;
    this.metrics.maxDelta = Math.max(this.metrics.maxDelta, delta);
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
    this.metrics.simulationMs += sdt;
    this.metrics.updates++;
    this.infectionMs = Math.max(0, this.infectionMs - sdt);
    if (!this.infectionMs) this.infection = 0;
    this.exposure.rules.fillMs =
      1150 / (1 + this.infection * FINAL_BOSS.infectionRate);
    if (!this.run.over && !this.cinematic) this.runTime += sdt;

    // sangue: poças, exposição e dominação — antes do jogador, para o stun valer no mesmo quadro
    const frozen = this.timeStopped;
    const edt = frozen || this.player.dead ? 0 : sdt;
    this.pools.update(edt);
    const inBlood =
      !this.player.dead &&
      !!this.pools.activeAt(this.player.x, this.player.y, this.player.radius);
    const protectedNow =
      this.player.dead ||
      this.player.dash.invulnerable ||
      this.player.avatarT >= 0 ||
      this.player.cinematic;
    for (const ev of this.exposure.update(sdt, inBlood, protectedNow)) {
      if (ev === 'stunStart') this.onDominated();
      else this.onDominationEnd();
    }

    const input = this.readInput();
    const collide = (
      x: number,
      y: number,
      r: number,
    ): { x: number; y: number; blocked: boolean } =>
      resolveCircle(x, y, r, FLOOR, [
        ...this.layout.obstacles,
        ...(this.toknar && !this.toknar.dead
          ? [{ x: this.toknar.x, y: this.toknar.y, r: TOKNAR.radius }]
          : []),
        ...(this.caim && !this.caim.dead
          ? [{ x: this.caim.x, y: this.caim.y, r: CAIM.radius }]
          : []),
        ...(this.boss && !this.boss.dead
          ? [{ x: this.boss.x, y: this.boss.y, r: this.boss.def.radius }]
          : []),
      ]);
    this.player.update(sdt, input, collide);

    // durante o Avatar a IA não roda (dt 0 mantém sprites e barras sincronizados)
    for (const e of this.enemies) e.update(edt, this.player);
    for (const w of this.wyverns) w.update(edt, this.player);
    if (this.boss) {
      if (this.introWalk === 'executioner') {
        if (
          !frozen &&
          this.boss.walkTo(this.layout.gatePos.x, FLOOR.y + 420, sdt, 110)
        )
          this.introWalk = null;
      } else if (this.boss.scripted && !this.boss.dead) this.boss.idle(sdt, this.player);
      else this.boss.update(edt, this.player);
    }
    if (this.caim) {
      if (this.introWalk === 'caim') {
        if (
          !frozen &&
          this.caim.walkTo(this.layout.gatePos.x, FLOOR.y + 420, sdt)
        )
          this.introWalk = null;
      } else this.caim.update(edt, this.player);
    }
    this.toknar?.update(edt, this.player);
    this.skills.update(this.player.dead ? 0 : sdt);
    this.separateBodies();
    this.bloodRenderer.draw(this.pools, edt);
    this.drawExposure();

    const hurtboxes = this.collectHurtboxes();
    this.projectiles.update(sdt, hurtboxes);
    this.resolveHits(this.hitboxes.update(sdt, hurtboxes));
    this.statuses.update(sdt, (target, dmg) => {
      const dealt = target.receiveHit({
        damage: dmg,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'burn',
      });
      if (dealt > 0) {
        const t = target.hurtbox;
        this.effects.damageNumber(t.x, t.y - 100, dealt, '#ff9b3d');
        this.effects.embersAt(t.x, t.y - 60, 3);
        Sfx.burnTick();
      }
    });
    this.blessings.update(sdt);
    this.cinematic?.update(sdt);

    this.enemies = this.enemies.filter((e) => !e.removed);
    this.wyverns = this.wyverns.filter((w) => !w.removed);

    if (!this.endless && this.run.phase === 'combat')
      this.handleRun(this.run.tick(this.aliveEnemies() + this.pendingSpawns));
    if (
      this.endless &&
      !this.endlessWaiting &&
      !this.player.dead &&
      this.aliveEnemies() + this.pendingSpawns === 0 &&
      !this.toknar &&
      !this.caim
    )
      this.endlessCleared();

    this.updateInteractables();
    this.updateCamera(dt);
    let particles = 0;
    for (const child of this.children.list) {
      if (child instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
        const n = child.getAliveParticleCount();
        if (particles + n > ETERNITY.particleCap) child.killAll();
        else particles += n;
      }
    }
    if (this.showHitboxes) this.drawDebug(hurtboxes);
    else this.debugGfx.clear();

    const threat =
      this.aliveEnemies() +
      this.wyverns.length +
      (this.boss && !this.boss.dead ? 4 : 0) +
      (this.caim && !this.caim.dead ? 4 : 0);
    Sfx.setIntensity(this.run.over ? 0 : Math.min(1, 0.1 + threat * 0.15));
  }

  aliveEnemies(): number {
    return (
      this.enemies.filter((e) => !e.dead).length +
      this.wyverns.filter((w) => !w.dead && w.variant === 'wild').length
    );
  }

  private collectHurtboxes(): Hurtbox[] {
    const list: Hurtbox[] = [this.player.hurtbox];
    for (const e of this.enemies) if (!e.dead) list.push(e.hurtbox);
    for (const w of this.wyverns) if (!w.dead) list.push(w.hurtbox);
    if (this.toknar && !this.toknar.dead) list.push(this.toknar.hurtbox);
    if (this.boss && !this.boss.dead) list.push(this.boss.hurtbox);
    if (this.caim && !this.caim.dead) list.push(this.caim.hurtbox);
    for (const d of this.dummies) list.push(d.hurtbox);
    this.lastHurtboxes = list;
    return list;
  }

  private combatantById(id: number): Combatant | undefined {
    if (id === this.player.hurtbox.id) return this.player;
    if (this.toknar && this.toknar.id === id) return this.toknar;
    if (this.boss && this.boss.id === id) return this.boss;
    if (this.caim && this.caim.id === id) return this.caim;
    return (
      this.enemies.find((e) => e.id === id) ??
      this.wyverns.find((w) => w.id === id) ??
      this.dummies.find((d) => d.id === id)
    );
  }

  private separateBodies(): void {
    const bodies: { r: number; ref: { x: number; y: number } }[] = this.enemies
      .filter((e) => !e.dead)
      .map((e) => ({ r: e.def.radius, ref: e }));
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.ref.x - a.ref.x;
        const dy = b.ref.y - a.ref.y;
        const d = length(dx, dy) || 0.01;
        const min = a.r + b.r + 4;
        if (d < min) {
          const push = (min - d) / 2;
          a.ref.x -= (dx / d) * push;
          a.ref.y -= (dy / d) * push;
          b.ref.x += (dx / d) * push;
          b.ref.y += (dy / d) * push;
        }
      }
    }
    if (this.player.dash.state !== 'dashing' && !this.player.dead) {
      const solids: {
        r: number;
        heavy: boolean;
        ref: { x: number; y: number };
      }[] = this.enemies
        .filter((e) => !e.dead)
        .map((e) => ({ r: e.def.radius, heavy: false, ref: e }));
      if (this.toknar && !this.toknar.dead)
        solids.push({ r: TOKNAR.radius, heavy: true, ref: this.toknar });
      if (this.boss && !this.boss.dead && !this.boss.scripted)
        solids.push({ r: this.boss.def.radius, heavy: true, ref: this.boss });
      if (this.caim && !this.caim.dead && !this.caim.scripted)
        solids.push({ r: CAIM.radius, heavy: true, ref: this.caim });
      for (const s of solids) {
        const dx = s.ref.x - this.player.x;
        const dy = s.ref.y - this.player.y;
        const d = length(dx, dy) || 0.01;
        const min = s.r + this.player.radius;
        if (d < min) {
          const push = min - d;
          if (s.heavy) {
            this.player.x -= (dx / d) * push;
            this.player.y -= (dy / d) * push;
          } else {
            s.ref.x += (dx / d) * push * 0.7;
            s.ref.y += (dy / d) * push * 0.7;
            this.player.x -= (dx / d) * push * 0.3;
            this.player.y -= (dy / d) * push * 0.3;
          }
        }
      }
      const p = resolveCircle(
        this.player.x,
        this.player.y,
        this.player.radius,
        FLOOR,
        this.layout.obstacles,
      );
      this.player.x = p.x;
      this.player.y = p.y;
    }
    for (const b of bodies) {
      const p = resolveCircle(
        b.ref.x,
        b.ref.y,
        b.r,
        FLOOR,
        this.layout.obstacles,
      );
      b.ref.x = p.x;
      b.ref.y = p.y;
    }
  }

  // =================================================================== combate do jogador
  private onAdvanced(
    kind: 'charged' | 'counter',
    angle: number,
    perfect: boolean,
  ): void {
    const p = this.player;
    const base =
      kind === 'charged' ? SKILLS.chargedDamage : SKILLS.counterDamage;
    const mul =
      this.skills.power(kind === 'charged' ? 'ascending' : 'return_cut') *
      (perfect ? 1.25 : 1) *
      (kind === 'counter' && this.skills.precise ? 1.3 : 1);
    if (kind === 'counter') this.skills.precise = false;
    this.hitboxes.spawn({
      shape: {
        kind: 'sector',
        x: p.x,
        y: p.y,
        radius: kind === 'charged' ? 158 : 138,
        angle,
        halfArc: 1.2,
      },
      team: 'player',
      damage: base * mul * p.stats.get('damageMul'),
      knockback: 300,
      duration: SKILLS.chargeActive,
      tag: kind,
      follow: () => ({ x: p.x, y: p.y }),
      meta: {
        heavy: true,
        hitstop: 65,
        posture: (kind === 'charged' ? SKILLS.chargedPosture : 32) * mul,
      },
    });
    this.meleeTrace(
      angle,
      kind === 'charged' ? 158 : 138,
      138,
      SKILLS.chargeActive,
      false,
    );
    Sfx.swing(2);
  }

  private onAttackStart(step: ComboStepDef): void {
    Sfx.swing(step.finisher ? 2 : 0);
  }

  private onAttackActive(step: ComboStepDef, angle: number): void {
    const p = this.player;
    const transformed = this.skills.attack(step, angle);
    this.hitboxes.spawn({
      shape: {
        kind: 'sector',
        x: p.x,
        y: p.y,
        radius: transformed.range,
        angle,
        halfArc: degToRad(step.arcDeg / 2),
      },
      team: 'player',
      damage: transformed.damage * p.stats.get('damageMul'),
      knockback: step.knockback,
      duration: step.active,
      tag: step.id,
      follow: () => ({ x: p.x, y: p.y }),
      meta: { hitstop: step.hitstop, heavy: !!step.finisher, basic: true },
    });
    // The new body frames contain no painted arcs. Render the actual reach as
    // a separate, short trail; solar forging never substitutes the body sprite.
    this.meleeTrace(
      angle,
      transformed.range,
      step.arcDeg,
      step.active,
      transformed.damage > step.damage,
    );
    if (step.shake) this.effects.shake(step.finisher ? 150 : 80, step.shake);
    if (step.finisher) {
      this.effects.dustPuff(
        p.x + Math.cos(angle) * 50,
        p.y + Math.sin(angle) * 50,
        5,
      );
      this.fireBlessings('comboFinisher', { x: p.x, y: p.y, angle });
      if (p.gifts.has('glory_blade')) this.launchGloryCrescent(angle);
    }
  }

  private meleeTrace(
    angle: number,
    range: number,
    arcDeg: number,
    duration: number,
    solar: boolean,
  ): void {
    const p = this.player;
    const g = this.add
      .graphics()
      .setPosition(p.x, p.y - 40)
      .setDepth(p.y + 2);
    g.lineStyle(
      solar ? 3 : 1.5,
      solar ? 0xffd77a : 0xd7dce0,
      solar ? 0.65 : 0.38,
    );
    const half = degToRad(arcDeg / 2);
    g.beginPath();
    g.arc(0, 0, range, angle - half, angle + half);
    g.strokePath();
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration,
      onComplete: () => g.destroy(),
    });
  }

  /** Lâmina da Glória: meia-lua solar que atravessa inimigos (1 acerto por alvo). */
  private launchGloryCrescent(angle: number): void {
    const p = this.player;
    const G = GLORY_BLADE;
    const dur = (G.range / G.speed) * 1000;
    const vx = Math.cos(angle) * G.speed;
    const vy = Math.sin(angle) * G.speed;
    const sx = p.x + Math.cos(angle) * 40;
    const sy = p.y + Math.sin(angle) * 40;
    this.hitboxes.spawn({
      shape: { kind: 'circle', x: sx, y: sy, radius: G.radius },
      team: 'player',
      damage:
        G.damage * this.skills.power('glory_blade') * p.stats.get('damageMul'),
      knockback: 220,
      duration: dur,
      velocity: { x: vx, y: vy },
      tag: 'glory_blade',
      knockbackDir: { x: Math.cos(angle), y: Math.sin(angle) },
      meta: { hitstop: 25 },
    });
    if (
      this.textures.exists(ATLAS_KEY) &&
      this.textures.get(ATLAS_KEY).has('fx_solar_crescent')
    ) {
      const img = this.add
        .image(sx, sy - 50, ATLAS_KEY, 'fx_solar_crescent')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.overlayFx - 6);
      img
        .setScale(0.45)
        .setRotation(angle)
        .setFlipY(Math.cos(angle) < 0);
      this.tweens.add({
        targets: img,
        x: sx + (vx * dur) / 1000,
        y: sy - 50 + (vy * dur) / 1000,
        duration: dur,
        onComplete: () => img.destroy(),
      });
      this.tweens.add({
        targets: img,
        alpha: 0.2,
        delay: dur * 0.6,
        duration: dur * 0.4,
      });
    }
    Sfx.fireball();
  }

  private onSunStart(x: number, y: number): void {
    Sfx.castCharge();
    this.effects.telegraphPulse(
      this.player.x,
      this.player.chestY - 40,
      0xfff1b0,
    );
    // marca a área imediatamente: o indicador é exatamente a área de dano
    const g = this.add.graphics().setDepth(DEPTH.telegraph + 5);
    const r = SECOND_SUN.radius;
    const total = SECOND_SUN.castMs + SECOND_SUN.delay;
    let t = 0;
    const ev = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        t += 16;
        const k = Math.min(1, t / total);
        g.clear();
        g.fillStyle(0xffe08a, 0.12);
        g.fillCircle(x, y, r);
        g.fillStyle(0xffe08a, 0.28);
        g.fillCircle(x, y, r * k);
        g.lineStyle(3, 0xfff1b0, 0.9);
        g.strokeCircle(x, y, r);
      },
    });
    this.time.delayedCall(total, () => {
      ev.remove();
      g.destroy();
    });
  }

  private onSunRelease(x: number, y: number): void {
    const epoch = this.roomEpoch;
    // o pilar cai após o atraso; dano exatamente no círculo anunciado
    this.time.delayedCall(SECOND_SUN.delay, () => {
      if (this.run.over || epoch !== this.roomEpoch || this.transitioning)
        return;
      this.hitboxes.spawn({
        shape: { kind: 'circle', x, y, radius: SECOND_SUN.radius },
        team: 'player',
        damage:
          SECOND_SUN.damage *
          this.skills.power('second_sun') *
          this.player.stats.get('damageMul'),
        knockback: 260,
        duration: 80,
        tag: 'second_sun',
        meta: { hitstop: 60, heavy: true },
      });
      // pilar desenhado (apollon_feixe_solar); sem o atlas, o feixe procedural antigo
      const drawn = this.effects.atlasFx(x, y + 10 - 260, Array.from({ length: 6 }, (_, i) => `apollon_beam_0${i}`), {
        frameMs: 85,
        scale: 1.3,
        blend: true,
        depth: y + 2,
      });
      if (!drawn) {
        const beam = this.add
          .image(x, y + 10, 'beam')
          .setOrigin(0.5, 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(y + 2);
        beam.setDisplaySize(SECOND_SUN.radius * 1.3, 520);
        this.tweens.add({
          targets: beam,
          alpha: { from: 1, to: 0 },
          scaleX: beam.scaleX * 0.4,
          duration: 520,
          ease: 'Cubic.easeIn',
          onComplete: () => beam.destroy(),
        });
      }
      this.effects.explosion(x, y, SECOND_SUN.radius);
      this.effects.shake(200, 0.008);
      Sfx.explosion();
    });
  }

  private onAvatarStart(): void {
    this.cancelAdvancedInput();
    Sfx.blessing();
    this.effects.flash(200, 255, 230, 160);
    // o tempo dos inimigos para: golpes em andamento e projéteis inimigos são anulados
    for (const box of this.hitboxes.all)
      if (box.spec.team === 'enemy') box.cancel();
    this.projectiles.clearTeam('enemy');
    const cam = this.cameras.main;
    const veil = this.add
      .rectangle(
        cam.width / 2,
        cam.height / 2,
        cam.width * 2,
        cam.height * 2,
        0xffd77a,
        1,
      )
      .setScrollFactor(0)
      .setDepth(DEPTH.overlayFx - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.tweens.add({ targets: veil, alpha: 0.13, duration: 220 });
    this.tweens.add({
      targets: veil,
      alpha: 0,
      delay: AVATAR.castMs - 350,
      duration: 350,
      onComplete: () => veil.destroy(),
    });
    this.summonApollon();
  }

  /**
   * Emanação de Apollon atrás de Atriox (apollon_avatar_isolado, 8 quadros):
   * surge da luz, ergue a mão no feixe e se dissipa no fim do especial.
   * Separada do sprite do Atriox; some sozinha se a sala mudar.
   */
  private summonApollon(): void {
    const p = this.player;
    const tex = this.textures.get('characters');
    if (!tex || !tex.has('apollon_avatar_00')) return;
    const f = p.facing >= 0 ? 1 : -1;
    const s = this.add
      .sprite(p.x - f * 70, p.y - 150, 'characters', 'apollon_avatar_00')
      .setFlipX(f < 0)
      .setDepth(p.y - 2)
      .setAlpha(0.95);
    const A = AVATAR;
    const plan: [number, number][] = [
      [0, 0], [1, 200], [2, 420], [3, A.beamFrom - 250], [4, A.beamFrom], [5, A.beamFrom + 450], [6, A.castMs - 480], [7, A.castMs - 240],
    ];
    const epoch = this.roomEpoch;
    for (const [i, at] of plan)
      this.time.delayedCall(at, () => {
        if (s.active && epoch === this.roomEpoch) s.setFrame(`apollon_avatar_0${i}`);
      });
    this.time.delayedCall(A.castMs, () => s.destroy());
  }

  private onAvatarNova(): void {
    const p = this.player;
    this.hitboxes.spawn({
      shape: { kind: 'circle', x: p.x, y: p.y - 10, radius: AVATAR.novaRadius },
      team: 'player',
      damage:
        AVATAR.novaDamage *
        this.skills.power('avatar') *
        p.stats.get('damageMul'),
      knockback: 320,
      duration: 120,
      tag: 'avatar_nova',
      meta: { hitstop: 70 },
    });
    this.effects.explosion(p.x, p.y - 10, AVATAR.novaRadius);
    this.effects.flash(160, 255, 240, 190);
    this.effects.shake(260, 0.012);
    Sfx.explosion();
  }

  /** Avatar ativo: inimigos, wyverns, chefes, projéteis inimigos e poças ficam congelados. */
  private get timeStopped(): boolean {
    return this.player.avatarT >= 0 && !this.player.dead;
  }

  private onAvatarBeam(facing: number): void {
    const p = this.player;
    const A = AVATAR;
    // o feixe está pintado nos quadros (direção horizontal); a hitbox o acompanha
    this.hitboxes.spawn({
      shape: {
        kind: 'rect',
        x: p.x + facing * 30,
        y: p.y - 10,
        angle: facing >= 0 ? 0 : Math.PI,
        length: A.beamLength,
        width: A.beamWidth,
      },
      team: 'player',
      damage:
        A.tickDamage * this.skills.power('avatar') * p.stats.get('damageMul'),
      knockback: 140,
      duration: A.beamTo - A.beamFrom,
      rehitInterval: A.tickMs,
      tag: 'avatar_beam',
      knockbackDir: { x: facing, y: 0 },
      meta: { hitstop: 0 },
    });
    // feixe desenhado (apollon_feixe_solar) girado para a horizontal
    const frames = Array.from({ length: 6 }, (_, i) => `apollon_beam_0${i}`);
    const len = A.beamLength;
    this.effects.atlasFx(p.x + facing * (len / 2 + 30), p.y - 60, frames, {
      frameMs: (A.beamTo - A.beamFrom) / frames.length,
      rotation: facing >= 0 ? Math.PI / 2 : -Math.PI / 2,
      scaleX: 0.95,
      scaleY: len / 390,
      blend: true,
      depth: p.y + 6,
    });
    this.effects.shake(A.beamTo - A.beamFrom, 0.004);
    Sfx.explosion();
  }

  private onDash(dir: { x: number; y: number }, radiant: boolean): void {
    this.skills.onDash();
    Sfx.dash();
    this.effects.dustPuff(this.player.x, this.player.y, 4);
    if (radiant) {
      this.hitboxes.spawn({
        shape: {
          kind: 'rect',
          x: this.player.x,
          y: this.player.y,
          angle: Math.atan2(dir.y, dir.x),
          length: 210,
          width: RADIANT_IMPETUS.width * 2,
        },
        team: 'player',
        damage:
          RADIANT_IMPETUS.damage *
          this.skills.power('radiant_impetus') *
          this.player.stats.get('damageMul'),
        knockback: 120,
        duration: 170,
        tag: 'radiant_trail',
        meta: { hitstop: 0 },
      });
    }
  }

  private onDashTick(x0: number, y0: number, x1: number, y1: number): void {
    const p = this.player;
    const purify = Math.max(
      p.radiant ? RADIANT_IMPETUS.purifyMs : 0,
      p.dashPurifyMs,
    );
    if (
      purify > 0 &&
      this.pools.purifySegment(x0, y0, x1, y1, RADIANT_IMPETUS.width, purify) >
        0
    )
      this.effects.embersAt(x1, y1, 2);
    // afterimages discretos
    if (Math.random() < 0.4)
      this.effects.afterimage(p.sprite, p.radiant ? 0xffc860 : 0xb89060);
  }

  private aimAssist(
    x: number,
    y: number,
    angle: number,
    range: number,
  ): number {
    let best: { a: number; score: number } | null = null;
    const cands: { x: number; y: number }[] = this.enemies.filter(
      (e) => !e.dead,
    );
    for (const w of this.wyverns) if (!w.dead) cands.push(w);
    if (this.boss && !this.boss.dead) cands.push(this.boss);
    if (this.caim && !this.caim.dead) cands.push(this.caim);
    if (this.toknar && !this.toknar.dead) cands.push(this.toknar);
    for (const e of cands) {
      const d = length(e.x - x, e.y - y);
      if (d > range) continue;
      const a = Math.atan2(e.y - y, e.x - x);
      const diff = Math.abs(angleDiff(angle, a));
      if (diff > 0.55) continue;
      const score = diff + d / 600;
      if (!best || score < best.score) best = { a, score };
    }
    return best ? angle + angleDiff(angle, best.a) * 0.7 : angle;
  }

  private resolveHits(hits: HitResult[]): void {
    for (const { box, target } of hits) {
      const c = this.combatantById(target.id);
      if (!c) continue;
      const s = box.spec;
      let dir =
        s.knockbackDir ?? normalize(target.x - s.shape.x, target.y - s.shape.y);
      if (dir.x === 0 && dir.y === 0) dir = { x: 1, y: 0 };
      const heavy = !!s.meta?.heavy;
      const basic = !!s.meta?.basic;
      const dealt = c.receiveHit({
        damage: s.damage,
        knockback: s.knockback,
        dirX: dir.x,
        dirY: dir.y,
        tag: s.tag,
        basic,
        heavy,
        posture: s.meta?.posture as number | undefined,
      });
      if (dealt > 0 && s.team === 'enemy' && s.tag.startsWith('toknar_'))
        this.toknar?.confirmedDrain(dealt);
      if (dealt <= 0 || s.team !== 'player') continue;
      if (!(c instanceof TrainingDummy)) this.skills.confirmed(c, s.tag, dealt);

      const tall = c instanceof Boss ? 100 : c instanceof Wyvern ? 80 : 60;
      const chestY = target.y - tall;
      // hitstop apenas no impacto confirmado
      this.hitstop(
        (s.meta?.hitstop as number | undefined) ?? (heavy ? 70 : 35),
      );
      this.effects.hitSpark(target.x, chestY, Math.atan2(dir.y, dir.x), heavy);
      this.effects.damageNumber(
        target.x,
        chestY - 30,
        dealt,
        heavy ? '#ffd77a' : '#f1e3c4',
        heavy,
      );
      Sfx.hit(heavy);
      if (heavy) this.effects.shake(110, 0.005);
      if (!(c instanceof TrainingDummy)) {
        if (basic)
          this.fireBlessings('basicHit', {
            x: target.x,
            y: target.y,
            angle: 0,
            target: c,
          });
      }
    }
  }

  hitstop(ms: number): void {
    if (ms > 0) this.hitstopTimer = Math.max(this.hitstopTimer, ms);
  }

  private slowMotion(scale: number, ms: number): void {
    this.slowmo = { remaining: ms, scale };
    this.timeScale = scale;
    this.tweens.timeScale = scale;
  }

  private onPlayerDamaged(amount: number, hit: HitInfo): void {
    for (const box of this.hitboxes.all)
      if (
        box.spec.team === 'player' &&
        ['charged', 'counter'].includes(box.spec.tag)
      )
        box.cancel();
    if (amount > 0 && hit.tag === 'caim_servitude')
      this.exposure.value = Math.min(0.85, this.exposure.value + 0.28);
    if (
      amount > 0 &&
      ['caim_infected', 'caim_claw', 'caim_servitude'].includes(hit.tag) &&
      this.caim &&
      this.caim.brain.phase >= 2
    ) {
      if (this.player.infectionWard > 0) this.player.infectionWard--;
      else {
        this.infection = Math.min(FINAL_BOSS.infectionMax, this.infection + 1);
        this.infectionMs = FINAL_BOSS.infectionMs;
      }
    }
    Sfx.playerHurt();
    this.effects.shake(170, 0.01);
    this.effects.flash(110, 140, 20, 20);
    this.effects.damageNumber(
      this.player.x,
      this.player.chestY - 40,
      amount,
      '#ff5a4a',
      true,
    );
    this.effects.hitSpark(
      this.player.x,
      this.player.chestY,
      Math.atan2(hit.dirY, hit.dirX),
      true,
      0xff6a50,
    );
    this.hitstop(55);
    this.ui()?.damagePulse();
    this.fireBlessings('damaged', {
      x: this.player.x,
      y: this.player.y,
      angle: 0,
    });
  }

  // ------------------------------------------------------------------ sangue
  private onDominated(): void {
    this.cancelAdvancedInput();
    for (const box of this.hitboxes.all) if (box.spec.meta?.basic) box.cancel();
    this.player.setStunned(true);
    this.queued = NO_INPUT();
    Sfx.bossRoar();
    this.effects.bloodSpray(this.player.x, this.player.chestY);
    this.effects.shockRing(this.player.x, this.player.y, 90, 0xc0101a, 400);
    this.ui()?.toast('Dominado pelo sangue de Caim!');
  }

  private onDominationEnd(): void {
    this.player.setStunned(false);
    this.queued = NO_INPUT();
    this.effects.embersAt(this.player.x, this.player.chestY, 8);
  }

  private drawExposure(): void {
    const g = this.exposureGfx;
    g.clear();
    const v = this.exposure.value;
    const p = this.player;
    if (p.dead || (v <= 0.01 && !this.exposure.stunned)) return;
    const r = 30;
    g.lineStyle(5, 0x200004, 0.7);
    g.strokeCircle(p.x, p.y, r);
    const k = this.exposure.stunned
      ? this.exposure.stun / this.exposure.rules.stunMs
      : v;
    g.lineStyle(
      5,
      this.exposure.stunned || v > 0.7 ? 0xff2a3a : 0xc0101a,
      0.95,
    );
    g.beginPath();
    g.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
    g.strokePath();
  }

  // =================================================================== bênçãos (executor único)
  private fireBlessings(
    on: Parameters<BlessingSystem['trigger']>[0],
    ctx: { x: number; y: number; angle: number; target?: Combatant },
  ): void {
    for (const { action } of this.blessings.trigger(on))
      this.runBlessingAction(action, ctx);
  }

  private runBlessingAction(
    a: BlessingAction,
    ctx: { x: number; y: number; angle: number; target?: Combatant },
  ): void {
    const p = this.player;
    switch (a.kind) {
      case 'burn':
        if (ctx.target && ctx.target.hurtbox.alive)
          this.statuses.applyBurn(ctx.target, a.dps, a.duration);
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
          meta: { hitstop: 0 },
        });
        this.effects.groundFire(ctx.x, ctx.y, a.radius, a.duration);
        break;
      case 'timedStat': {
        const had = p.stats.hasTimed(a.stat);
        p.stats.addTimed(a.stat, a.add, a.duration);
        if (!had)
          this.effects.floatingText(
            p.x,
            p.chestY - 60,
            'Vontade Inquebrável',
            '#cfe0ec',
            16,
          );
        break;
      }
      case 'wave': {
        const dur = (a.range / a.speed) * 1000;
        const vx = Math.cos(ctx.angle) * a.speed;
        const vy = Math.sin(ctx.angle) * a.speed;
        this.hitboxes.spawn({
          shape: {
            kind: 'circle',
            x: ctx.x + Math.cos(ctx.angle) * 40,
            y: ctx.y + Math.sin(ctx.angle) * 40,
            radius: a.width / 2,
          },
          team: 'player',
          damage: a.damage * p.stats.get('damageMul'),
          knockback: 200,
          duration: dur,
          velocity: { x: vx, y: vy },
          tag: 'consecrated_wave',
          knockbackDir: { x: Math.cos(ctx.angle), y: Math.sin(ctx.angle) },
          meta: { hitstop: 20 },
        });
        const img = this.add
          .image(ctx.x, ctx.y - 34, 'slash_3')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.overlayFx - 4)
          .setTint(0xfff1b0);
        img.setRotation(ctx.angle).setScale(0.45);
        this.tweens.add({
          targets: img,
          x: ctx.x + (vx * dur) / 1000,
          y: ctx.y - 34 + (vy * dur) / 1000,
          alpha: { from: 0.9, to: 0.1 },
          duration: dur,
          onComplete: () => img.destroy(),
        });
        break;
      }
    }
  }

  applyBlessing(id: string): void {
    const def = getBlessing(id);
    if (def && this.blessings.grant(def)) {
      Sfx.blessing();
      this.effects.shockRing(this.player.x, this.player.y, 160, def.color, 600);
      this.ui()?.banner(def.name, 'Bênção concedida', def.color);
    }
  }

  applyGift(id: ApollonGiftId): void {
    const g = getGift(id);
    if (!g || !this.build.grant(id)) return;
    const level = this.build.level(id);
    if (id === 'universal_power') {
      if (level <= 10)
        this.player.stats.addPermanent('damageMul', { add: 0.05 });
      else this.player.heal(30);
    }
    if (id === 'universal_vitality') {
      if (level <= 20)
        this.player.health.setMax(this.player.health.max + 5, true);
      this.player.heal(25);
    }
    Sfx.blessing();
    this.effects.shockRing(this.player.x, this.player.y, 180, g.color, 650);
    this.effects.embersAt(this.player.x, this.player.chestY, 16);
    this.ui()?.banner(
      g.name,
      `Dom de Apollon · ${g.category}${g.key ? ` · tecla ${g.key}` : ''}`,
      g.color,
    );
  }

  // =================================================================== salas e portas
  private handleRun(events: RunEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'enterRoom') this.enterRoom(ev.index);
      else if (ev.type === 'spawnGroup') {
        let delay = 0;
        for (const s of ev.group.spawns) {
          for (let i = 0; i < s.count; i++) {
            this.queueSpawn(s.kind, delay);
            delay += 160;
          }
        }
      } else if (ev.type === 'roomCleared') this.onRoomCleared();
      else if (ev.type === 'doorsOpen') this.openDoors(ev.options);
    }
  }

  private enterRoom(index: number): void {
    const room = ROOMS[index];
    this.advanceBuffRoom();
    this.buffTaken = false;
    this.altarBuff = null;
    this.highestRoom = Math.max(this.highestRoom, index);
    if (this.layout) destroyArena(this, this.layout);
    this.layout = buildArena(this, room.theme);
    this.player.x = ARENA_CENTER.x;
    this.player.y =
      room.kind === 'prep'
        ? ARENA_CENTER.y + 250
        : room.kind === 'boss'
          ? FLOOR.y + FLOOR.h - 300
          : FLOOR.y + FLOOR.h - 120;
    this.player.vx = this.player.vy = 0;
    this.cameras.main.centerOn(this.player.x, this.player.y - 40);
    this.ui()?.roomTitle(room.name, room.subtitle);

    if (room.kind === 'prep') {
      this.dummies = [
        new TrainingDummy(this, ARENA_CENTER.x - 230, ARENA_CENTER.y + 130),
        new TrainingDummy(this, ARENA_CENTER.x + 230, ARENA_CENTER.y + 130),
      ];
      const glow = this.add
        .image(this.layout.altarPos.x, this.layout.altarPos.y, 'light')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xe8b24a)
        .setDepth(DEPTH.groundFx)
        .setDisplaySize(360, 200)
        .setAlpha(0.35);
      this.layout.objects.push(glow);
      this.tweens.add({
        targets: glow,
        alpha: 0.6,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
      this.interactables.push({
        id: 'altar',
        x: this.layout.altarPos.x,
        y: this.layout.altarPos.y,
        r: 120,
        label: 'Iniciar a Provação',
        action: () => this.beginTrial(),
      });
      return;
    }
    // salas seguintes: pequena pausa antes do combate começar
    const at = index;
    this.time.delayedCall(900, () => {
      if (this.run.over || this.run.index !== at || this.endless) return;
      this.handleRun(this.run.startCombat());
      if (room.boss === 'executioner') this.startExecutionerIntro();
      else if (room.boss === 'toknar') this.startToknarIntro();
      else if (room.boss === 'caim') this.startCaimIntro();
      else Sfx.waveStart();
    });
  }

  beginTrial(): void {
    // bonecos se quebram (quadros desenhados) quando a Provação começa
    for (const d of this.dummies) d.shatter();
    this.dummies = [];
    this.handleRun(this.run.startCombat());
  }

  private openDoors(_options: RewardKind[]): void {
    this.clearDoors();
    this.giftOffers = this.build.offers();
    const slots = this.layout.doorSlots;
    this.giftOffers.forEach((offer, i) => {
      const { gift: g } = offer,
        pos = slots[i % slots.length];
      const door = this.add
        .image(pos.x, pos.y, 'door')
        .setOrigin(0.5, 1)
        .setDepth(pos.y)
        .setScale(0.85);
      const glow = this.add
        .image(pos.x, pos.y - 60, 'light')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(g.color)
        .setDepth(DEPTH.groundFx)
        .setDisplaySize(260, 200)
        .setAlpha(0.5);
      const label = this.add
        .text(
          pos.x,
          pos.y - 252,
          `${g.glyph} ${g.name}\n${offer.evolution ? 'EVOLUÇÃO' : 'NOVO'} · Nível ${offer.level} · Disponível\n${offer.description}`,
          {
            fontFamily: 'Georgia',
            fontSize: '15px',
            color: '#ffe0a0',
            align: 'center',
            wordWrap: { width: 285 },
            stroke: '#100808',
            strokeThickness: 4,
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(pos.y + 1);
      this.tweens.add({
        targets: glow,
        alpha: 0.72,
        duration: 1100,
        yoyo: true,
        repeat: -1,
      });
      this.doors.push({
        x: pos.x,
        y: pos.y,
        kind: 'apollon',
        objects: [door, glow, label],
      });
      this.interactables.push({
        id: `door${i}`,
        x: pos.x,
        y: pos.y + 40,
        r: 110,
        label: `Escolher e avançar — ${g.name}`,
        action: () => this.takeDoor(i),
      });
    });
    this.ui()?.toast(
      'Portas disponíveis: escolha seu próximo dom. O buff do altar é opcional.',
    );
  }

  private clearDoors(): void {
    for (const d of this.doors)
      for (const o of d.objects) {
        this.tweens.killTweensOf(o);
        o.destroy();
      }
    this.doors = [];
    this.interactables = this.interactables.filter(
      (i) => !i.id.startsWith('door'),
    );
  }

  private takeDoor(i: number): void {
    if (
      this.transitioning ||
      this.player.dead ||
      this.player.locked ||
      this.run.phase !== 'doors' ||
      !this.giftOffers[i]
    )
      return;
    this.transitioning = true;
    this.applyGift(this.giftOffers[i].gift.id);
    this.giftOffers = [];
    this.interactables = [];
    this.player.locked = true;
    const cam = this.cameras.main;
    cam.fadeOut(420, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.clearDoors();
      this.clearRoomEntities();
      this.interactables = [];
      if (this.player.dead) return;
      if (this.endless) this.nextEndlessWave();
      else this.handleRun(this.run.chooseDoor(i));
      this.player.locked = false;
      this.transitioning = false;
      cam.fadeIn(420, 0, 0, 0);
    });
  }

  /** Remove inimigos, perigos e efeitos temporários da sala. */
  private clearRoomEntities(): void {
    this.attackHeld = false;
    this.attackReleased = false;
    this.roomEpoch++;
    this.skills?.reset();
    this.toknar?.destroy();
    this.toknar = null;
    this.hitboxes.clear();
    this.projectiles.clear();
    this.statuses.clear();
    this.pools.clear();
    this.exposure.reset();
    this.player.setStunned(false);
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    for (const w of this.wyverns) w.destroy();
    this.wyverns = [];
    this.boss?.destroy();
    this.boss = null;
    this.caim?.destroy();
    this.caim = null;
    for (const o of this.orbObjects) o.destroy();
    this.orbObjects = [];
    this.pendingSpawns = 0;
  }

  private pickSpawnPoint(): { x: number; y: number } {
    for (let tries = 0; tries < 40; tries++) {
      const x = FLOOR.x + 80 + Math.random() * (FLOOR.w - 160);
      const y = FLOOR.y + 60 + Math.random() * (FLOOR.h - 120);
      if (length(x - this.player.x, y - this.player.y) < 380) continue;
      if (
        this.layout.obstacles.some((o) => length(x - o.x, y - o.y) < o.r + 50)
      )
        continue;
      return { x, y };
    }
    return { x: ARENA_CENTER.x, y: FLOOR.y + 120 };
  }

  private queueSpawn(kind: SpawnKind, delay: number): void {
    this.pendingSpawns++;
    const pt = this.pickSpawnPoint();
    const roomAt = this.run.index;
    const epoch = this.roomEpoch;
    this.time.delayedCall(delay, () => {
      if (
        this.run.over ||
        this.run.index !== roomAt ||
        epoch !== this.roomEpoch
      ) {
        if (epoch === this.roomEpoch)
          this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
        return;
      }
      // wyvern selvagem: anuncia pela sombra que cresce (não por um selo)
      if (kind !== 'wyvern_wild') this.effects.spawnSigil(pt.x, pt.y, 850);
      this.time.delayedCall(800, () => {
        if (epoch !== this.roomEpoch) return;
        this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
        if (
          this.run.over ||
          this.run.index !== roomAt ||
          epoch !== this.roomEpoch
        )
          return;
        if (kind === 'wyvern_wild') this.spawnWyvern(pt.x, pt.y, 'wild');
        else if (this.aliveEnemies() < ETERNITY.activeCap)
          this.spawnEnemy(kind, pt.x, pt.y);
      });
    });
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const base = ENEMIES[kind];
    const wave = this.endlessWave,
      elite = this.endless && wave % ETERNITY.eliteEvery === 0;
    const def = this.endless
      ? {
          ...base,
          hp: Math.round(
            base.hp *
              Math.min(ETERNITY.hpCap, 1 + wave * 0.045 + (elite ? 0.35 : 0)),
          ),
          damage: Math.round(
            base.damage * Math.min(ETERNITY.damageCap, 1 + wave * 0.018),
          ),
          speed: base.speed * Math.min(ETERNITY.speedCap, 1 + wave * 0.004),
          windup: Math.max(360, base.windup - wave * 2),
          detectRange: 2500,
          name: elite ? `Elite — ${base.name}` : base.name,
          hitArcDeg:
            elite && base.hitArcDeg ? base.hitArcDeg + 15 : base.hitArcDeg,
          lunge: elite && base.lunge ? base.lunge * 1.35 : base.lunge,
        }
      : base;
    const e = new Enemy(this, def, x, y, {
      hitboxes: this.hitboxes,
      projectiles: this.projectiles,
      effects: this.effects,
      collide: (px, py, r) =>
        resolveCircle(px, py, r, FLOOR, this.layout.obstacles),
      onDeath: (en) => this.onEnemyDeath(en),
      onDamaged: () => undefined,
    });
    this.enemies.push(e);
    this.effects.spawnBurst(x, y);
    return e;
  }

  spawnWyvern(x: number, y: number, variant: 'blood' | 'wild' = 'blood'): void {
    if (this.wyverns.filter((w) => !w.dead).length >= 3) return;
    const w = new Wyvern(this, this.lib, x, y, {
      hitboxes: this.hitboxes,
      effects: this.effects,
      collide: (px, py, r) =>
        resolveCircle(px, py, r, FLOOR, this.layout.obstacles),
      onDeath: () => {
        this.kills++;
        this.skills.glory('kill', AVATAR.gloryPerKill);
        this.fireBlessings('kill', { x: w.x, y: w.y, angle: 0 });
      },
    }, variant);
    this.wyverns.push(w);
  }

  private onEnemyDeath(e: Enemy): void {
    this.kills++;
    this.hitstop(50);
    this.effects.shake(110, 0.004);
    this.skills.glory('kill', AVATAR.gloryPerKill);
    this.fireBlessings('kill', { x: e.x, y: e.y, angle: 0, target: e });
  }

  private onRoomCleared(): void {
    if (this.player.dead || this.run.over) return;
    this.hitboxes.clear();
    this.projectiles.clear();
    this.pools.clear();
    this.statuses.clear();
    this.skills.reset();
    this.exposure.reset();
    this.player.setStunned(false);
    for (const w of this.wyverns) w.dissolve();
    this.ui()?.toast(
      'Sala concluída. Receba o buff do altar e escolha seu próximo dom.',
    );
    this.spawnAltarBuff();
    this.handleRun(this.run.rewardTaken());
  }

  private spawnAltarBuff(): void {
    this.buffTaken = false;
    this.altarBuff = BUFFS[Math.floor(Math.random() * BUFFS.length)];
    const b = this.altarBuff,
      { x, y } = ARENA_CENTER;
    const glow = this.add
      .image(x, y, 'light')
      .setDisplaySize(270, 160)
      .setTint(0x80d8c0)
      .setAlpha(0.45)
      .setDepth(DEPTH.groundFx);
    const orb = this.add
      .image(x, y - 60, 'blessing_orb')
      .setScale(0.5)
      .setTint(0x80d8c0)
      .setDepth(y);
    const label = this.add
      .text(x, y - 110, `✚ BUFF OPCIONAL\n${b.name}\n${b.description}`, {
        fontFamily: 'Georgia',
        fontSize: '15px',
        color: '#90e4c8',
        align: 'center',
        stroke: '#081410',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(y + 1);
    this.orbObjects.push(glow, orb, label);
    this.interactables.push({
      id: 'buff',
      x,
      y,
      r: 105,
      label: `Receber buff — ${b.name} (opcional)`,
      action: () => this.takeAltarBuff(),
    });
  }

  private takeAltarBuff(): void {
    if (
      this.buffTaken ||
      this.player.dead ||
      this.transitioning ||
      this.run.phase !== 'doors' ||
      !this.altarBuff
    )
      return;
    this.buffTaken = true;
    this.nearInteractable = null;
    // Replacing a buff clears its old charges. Instant healing does not replace a room buff.
    const b = this.altarBuff,
      p = this.player;
    if (b.id === 'heal') p.heal(b.amount);
    else {
      this.buffActive = b;
      this.buffRooms = 2;
      p.barrier = 0;
      p.barrierHits = 0;
      p.infectionWard = 0;
      p.altarGlory = 0;
      p.altarDash = 0;
      if (b.id === 'barrier') {
        p.barrier = b.amount;
        p.barrierHits = 3;
      }
      if (b.id === 'glory') p.altarGlory = b.amount;
      if (b.id === 'dash') p.altarDash = b.amount;
      if (b.id === 'ward') p.infectionWard = b.amount;
    }
    this.orbObjects.forEach((o) => o.destroy());
    this.orbObjects = [];
    this.interactables = this.interactables.filter((i) => i.id !== 'buff');
    this.ui()?.toast(`${b.name}: ${b.description} Agora escolha uma porta.`);
  }

  private advanceBuffRoom(): void {
    if (this.buffRooms > 0 && --this.buffRooms === 0) {
      this.buffActive = null;
      this.player.barrier = 0;
      this.player.barrierHits = 0;
      this.player.infectionWard = 0;
      this.player.altarGlory = 0;
      this.player.altarDash = 0;
    }
  }

  // =================================================================== chefes
  /**
   * Conversa antes do chefe: a arena PAUSA (combate e perigos congelados), a
   * DialogueScene assume a entrada e, ao terminar, nenhuma tecla ou clique vaza
   * para o primeiro quadro da luta. `done` roda uma única vez.
   */
  private bossDialogue(id: BossDialogueId, done: () => void): void {
    if (this.endless || this.run.over || this.player.dead) {
      done();
      return;
    }
    const epoch = this.roomEpoch;
    let finished = false;
    this.dialogueActive = true;
    this.queued = NO_INPUT();
    this.player.clearInput();
    this.scene.launch('DialogueScene', {
      lines: BOSS_DIALOGUES[id],
      onDone: () => {
        if (finished) return;
        finished = true;
        this.dialogueActive = false;
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        this.queued = NO_INPUT();
        this.player.clearInput();
        if (epoch !== this.roomEpoch || this.run.over || this.player.dead) return;
        done();
      },
    });
    this.scene.pause();
  }

  private startToknarIntro(): void {
    this.player.locked = !this.endless;
    this.toknar = new Toknar(this, this.lib, ARENA_CENTER.x, FLOOR.y + 360, {
      hitboxes: this.hitboxes,
      effects: this.effects,
      collide: (x, y, r) =>
        resolveCircle(x, y, r, FLOOR, this.layout.obstacles),
      onPhase: () => {
        this.ui()?.toast(
          'Rhaesis desperta! Observe o golpe atrasado e a canalização.',
        );
        this.toknarReinforcements(this.toknar?.brain.phase ?? 2);
      },
      onDeath: () => {
        this.hitboxes.clear();
        this.projectiles.clear();
        this.pools.clear();
        this.enemies.forEach((e) => {
          if (!e.dead)
            e.receiveHit({
              damage: 99999,
              knockback: 0,
              dirX: 0,
              dirY: 0,
              tag: 'victory',
            });
        });
        if (this.endless) {
          this.toknar?.destroy();
          this.toknar = null;
          this.endlessCleared();
        } else this.handleRun(this.run.bossDefeated());
      },
    });
    this.camTarget = { x: ARENA_CENTER.x, y: FLOOR.y + 260 };
    const epoch = this.roomEpoch;
    Sfx.bossRoar();
    this.effects.shake(500, 0.005);
    this.time.delayedCall(900, () => {
      if (epoch !== this.roomEpoch || !this.toknar) return;
      this.bossDialogue('toknar', () => {
        this.ui()?.bossIntro(
          'TOKNAR',
          'Rhaesis drena sangue. Ataque a postura durante o Banquete.',
        );
        Sfx.bossRoar();
        this.time.delayedCall(700, () => {
          if (epoch !== this.roomEpoch || !this.toknar || this.run.over) return;
          this.camTarget = null;
          this.player.locked = false;
          this.toknar.startFight();
        });
      });
    });
  }

  /**
   * Reforços reais na troca de fase: entram pelos acessos superiores laterais
   * da arena do clã e caminham para o chão. A plateia pintada não se move.
   */
  private toknarReinforcements(phase: number): void {
    const kinds = TOKNAR.reinforcements[phase] ?? [];
    const epoch = this.roomEpoch;
    const gates = [
      { x: FLOOR.x + 180, y: FLOOR.y + 30 },
      { x: FLOOR.x + FLOOR.w - 180, y: FLOOR.y + 30 },
    ];
    kinds.forEach((kind, i) => {
      this.time.delayedCall(700 + i * 450, () => {
        if (epoch !== this.roomEpoch || this.run.over || !this.toknar || this.toknar.dead) return;
        if (this.aliveEnemies() >= ETERNITY.activeCap) return;
        const g = gates[i % gates.length];
        this.effects.dustPuff(g.x, g.y, 8);
        this.spawnEnemy(kind, g.x, g.y);
      });
    });
    if (kinds.length) this.ui()?.banner('O clã responde', `${kinds.length} guerreiros descem pelos acessos`, 0xa8e070);
  }

  private startExecutionerIntro(): void {
    const { gate, gatePos } = this.layout;
    this.player.locked = true;
    Sfx.slam();
    this.effects.shake(1300, 0.004);
    this.tweens.add({
      targets: gate,
      y: gate.y - 230,
      duration: 1400,
      ease: 'Sine.easeInOut',
    });
    this.camTarget = { x: gatePos.x, y: FLOOR.y + 140 };
    this.time.delayedCall(900, () => {
      if (this.run.over) return;
      this.boss = new Boss(this, EXECUTIONER, gatePos.x, FLOOR.y - 10, {
        hitboxes: this.hitboxes,
        effects: this.effects,
        collide: (px, py, r) =>
          resolveCircle(px, py, r, FLOOR, this.layout.obstacles),
        onDamaged: () => undefined,
        onPhaseChange: () => {
          this.ui()?.banner(
            'Fúria do Carrasco',
            'Ele não recua mais',
            0xff6a30,
          );
          this.projectiles.clearTeam('enemy');
          this.time.delayedCall(900, () => {
            if (this.run.over || !this.boss || this.boss.dead) return;
            this.queueSpawn('recruit', 0);
            this.queueSpawn('recruit', 200);
          });
        },
        onDeath: () => this.onExecutionerDeath(),
      });
      this.introWalk = 'executioner';
    });
    const epoch = this.roomEpoch;
    this.time.delayedCall(4500, () => {
      if (!this.boss || this.run.over || epoch !== this.roomEpoch) return;
      this.introWalk = null;
      this.bossDialogue('executioner', () => {
        if (!this.boss) return;
        Sfx.bossRoar();
        this.ui()?.bossIntro(EXECUTIONER.name, EXECUTIONER.title);
        this.time.delayedCall(700, () => {
          if (!this.boss || this.run.over || epoch !== this.roomEpoch) return;
          this.camTarget = null;
          this.player.locked = false;
          this.boss.startFight();
        });
      });
    });
  }

  private onExecutionerDeath(): void {
    const b = this.boss;
    if (!b) return;
    this.slowMotion(0.3, 1200);
    this.effects.flash(300, 255, 230, 180);
    this.effects.shake(700, 0.012);
    this.effects.explosion(b.x, b.y, 160);
    Sfx.explosion();
    this.hitboxes.clear();
    this.projectiles.clear();
    for (const e of this.enemies)
      if (!e.dead)
        e.receiveHit({
          damage: 9999,
          knockback: 300,
          dirX: 0,
          dirY: -1,
          tag: 'victory',
        });
    this.time.delayedCall(1200, () => {
      this.ui()?.banner(
        'O Carrasco caiu',
        'O caminho para Nemeia se abre',
        0xffd77a,
      );
      this.handleRun(this.run.bossDefeated());
    });
  }

  private startCaimIntro(): void {
    const { gate, gatePos } = this.layout;
    this.player.locked = true;
    this.effects.shake(1000, 0.004);
    this.tweens.add({
      targets: gate,
      y: gate.y - 230,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });
    this.camTarget = { x: gatePos.x, y: FLOOR.y + 160 };
    this.time.delayedCall(700, () => {
      if (this.run.over) return;
      this.caim = new Caim(this, this.lib, gatePos.x, FLOOR.y - 10, {
        hitboxes: this.hitboxes,
        effects: this.effects,
        collide: (px, py, r) =>
          resolveCircle(px, py, r, FLOOR, this.layout.obstacles),
        pools: this.pools,
        wyvernCount: () => this.wyverns.filter((w) => !w.dead).length,
        spawnWyvern: (x, y) => this.spawnWyvern(x, y),
        onPhase2: () => {
          this.pools.rules.maxActive =
            FINAL_BOSS.poolMax[this.caim!.brain.phase - 1];
          this.pools.rules.radius = FINAL_BOSS.poolRadius;
          this.ui()?.banner(
            'O sangue de Drevagna ferve',
            'Caim invoca mais wyverns',
            0xc0101a,
          );
        },
        onDeath: () => this.onCaimDeath(),
        onDamaged: () => undefined,
      });
      this.introWalk = 'caim';
    });
    const epoch = this.roomEpoch;
    this.time.delayedCall(4300, () => {
      if (!this.caim || this.run.over || epoch !== this.roomEpoch) return;
      this.introWalk = null;
      this.bossDialogue('caim', () => {
        if (!this.caim) return;
        Sfx.bossRoar();
        this.effects.shockRing(this.caim.x, this.caim.y, 200, 0xc0101a, 600);
        this.ui()?.bossIntro(CAIM.name, CAIM.title);
        this.time.delayedCall(700, () => {
          if (!this.caim || this.run.over || epoch !== this.roomEpoch) return;
          this.camTarget = null;
          this.player.locked = false;
          this.caim.startFight();
        });
      });
    });
  }

  /** Vitória sobre Caim: encerra perigos, confirma a morte e inicia a bênção. */
  private onCaimDeath(): void {
    const c = this.caim;
    if (!c) return;
    this.slowMotion(0.25, 1500);
    this.effects.flash(300, 200, 30, 30);
    this.effects.shake(800, 0.012);
    this.effects.bloodSpray(c.x, c.chestY);
    this.effects.deathBurst(c.x, c.y, 0xc0101a);
    Sfx.bossRoar();
    // encerra ataques e perigos (inclusive projéteis ainda ativos)
    this.hitboxes.clear();
    this.projectiles.clear();
    this.pools.fadeAll();
    this.exposure.reset();
    this.player.setStunned(false);
    for (const w of this.wyverns) w.dissolve();
    for (const e of this.enemies)
      if (!e.dead)
        e.receiveHit({
          damage: 9999,
          knockback: 300,
          dirX: 0,
          dirY: -1,
          tag: 'victory',
        });
    if (this.endless) {
      this.caim?.destroy();
      this.caim = null;
      this.endlessCleared();
      return;
    }
    this.handleRun(this.run.bossDefeated());
    this.time.delayedCall(2600, () => this.startBlessingCinematic());
  }

  private startBlessingCinematic(): void {
    if (this.cinematic || this.player.dead || this.ending) return;
    const p = this.player;
    // trava só o necessário: o personagem fica sob a cena, sem ações
    p.cinematic = true;
    p.clearInput();
    p.vx = p.vy = 0;
    p.setVisible(false);
    this.camTarget = { x: p.x + p.facing * 60, y: p.y - 90 };
    this.cameras.main.zoomTo(1.6, 900, 'Sine.easeInOut');
    Sfx.blessing();
    this.cinematic = new BlessingCinematic(this, this.lib, p.x, p.y, p.facing, {
      onQuote: () => this.ui()?.quote(BLESSING_OF_GLORY.quote),
      onEnd: () => this.endBlessingCinematic(),
    });
  }

  private endBlessingCinematic(): void {
    const p = this.player;
    p.setVisible(true);
    p.cinematic = false;
    this.camTarget = null;
    this.cameras.main.zoomTo(CAMERA_ZOOM, 700, 'Sine.easeInOut');
    // concedida uma única vez, mesmo pulando ou repetindo a cena
    if (this.gloryGranted === null)
      this.gloryGranted = save.grantBlessingOfGlory();
    p.dashPurifyMs = BLESSING_OF_GLORY.purifyMs;
    this.effects.shockRing(p.x, p.y, 220, 0xffd77a, 700);
    this.ui()?.banner(
      BLESSING_OF_GLORY.name,
      this.gloryGranted
        ? BLESSING_OF_GLORY.description
        : 'Já concedida — a luz permanece contigo.',
      0xffd77a,
    );
    this.time.delayedCall(3600, () => {
      this.cinematic = null;
      this.scene.pause();
      this.scene.launch('VictoryChoiceScene');
    });
  }

  private onPlayerDeath(): void {
    this.giftOffers = [];
    this.interactables = [];
    this.clearDoors();
    this.skills.reset();
    this.hitboxes.clear();
    this.projectiles.clear();
    this.pools.clear();
    this.handleRun(this.run.playerDied());
    this.slowMotion(0.3, 1400);
    this.effects.flash(300, 120, 0, 0);
    this.effects.shake(500, 0.01);
    this.exposure.reset();
    Sfx.defeat();
    this.ui()?.banner('Atriox caiu', 'A provação não perdoa', 0xd0473a);
    try {
      this.cameras.main.postFX?.addColorMatrix().grayscale(0.85);
    } catch {
      /* renderer Canvas: sem pós-processamento */
    }
    this.time.delayedCall(3000, () => this.endRun(false));
  }

  private endRun(victory: boolean): void {
    if (this.ending) return;
    this.ending = true;
    const highestWave = this.highestRoom;
    if (this.endless) {
      save.recordEternity(this.endlessWave, victory);
    }
    const { newBest } = this.campaignRecorded
      ? { newBest: false }
      : save.recordRun({ victory, timeMs: this.runTime, highestWave });
    const result: RunResult = {
      victory,
      timeMs: this.runTime,
      highestWave,
      kills: this.kills,
      blessings: [
        ...this.blessings.owned.map((b) => b.name),
        ...[...this.player.gifts].map((g) => getGift(g)?.name ?? g),
      ],
      newBest,
      roomName: ROOMS[this.run.index]?.name ?? '',
      endlessWave: this.endless ? this.endlessWave : undefined,
      gloryGranted: this.gloryGranted,
    };
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.cameras.main.postFX?.clear();
        this.scene.stop('UIScene');
        this.scene.start('ResultScene', result);
      },
    );
  }

  finishCampaign(): void {
    this.endRun(true);
  }

  startEndless(): void {
    if (this.endless || this.player.dead) return;
    save.recordRun({
      victory: true,
      timeMs: this.runTime,
      highestWave: this.highestRoom,
    });
    this.campaignRecorded = true;
    this.endless = true;
    this.endlessWave = 0;
    this.clearRoomEntities();
    this.interactables = [];
    this.clearDoors();
    this.player.locked = false;
    this.player.cinematic = false;
    this.player.heal(this.player.health.max);
    this.nextEndlessWave();
  }

  private nextEndlessWave(): void {
    this.clearRoomEntities();
    this.interactables = [];
    this.clearDoors();
    this.giftOffers = [];
    this.advanceBuffRoom();
    this.endlessWave++;
    this.endlessWaiting = false;
    this.run.phase = 'combat';
    this.player.x = ARENA_CENTER.x;
    this.player.y = ARENA_CENTER.y + 240;
    this.ui()?.roomTitle(
      `Provação da Eternidade — ${this.endlessWave}`,
      this.endlessWave % 10 === 0
        ? 'Chefe'
        : this.endlessWave % 5 === 0
          ? 'Elite: guardiões reforçados'
          : 'Pressão alternada: cercos e atiradores',
    );
    if (this.endlessWave % ETERNITY.bossEvery === 0) {
      this.run.phase = 'boss';
      if (this.endlessWave % 20 === 0) this.startCaimIntro();
      else this.startToknarIntro();
      return;
    }
    const count = Math.min(
      ETERNITY.activeCap,
      4 + Math.floor(this.endlessWave / 2),
    );
    // formações alternadas (não só inflação de vida): enxame, muralha, céu, misto
    const formations: SpawnKind[][] = [
      ['goblin', 'goblin', 'archer'],
      ['orc', 'recruit', 'goblin'],
      ['wyvern_wild', 'goblin', 'recruit'],
      ['guardian', 'archer', 'orc', 'goblin'],
    ];
    const elite: SpawnKind[] = ['orc', 'guardian', 'orc', 'archer'];
    const pattern =
      this.endlessWave % ETERNITY.eliteEvery === 0
        ? elite
        : formations[this.endlessWave % formations.length];
    let wild = 0;
    for (let i = 0; i < count; i++) {
      let kind = pattern[i % pattern.length];
      if (kind === 'wyvern_wild' && ++wild > 2) kind = 'goblin';
      this.queueSpawn(kind, i * 180);
    }
  }

  private endlessCleared(): void {
    if (this.endlessWaiting || this.player.dead) return;
    this.endlessWaiting = true;
    this.hitboxes.clear();
    this.projectiles.clear();
    this.pools.clear();
    save.recordEternity(this.endlessWave, true);
    if (this.endlessWave % ETERNITY.rewardEvery === 0) {
      this.run.phase = 'doors';
      this.spawnAltarBuff();
      this.openDoors(['apollon', 'blessing']);
    } else {
      const epoch = this.roomEpoch;
      this.time.delayedCall(1700, () => {
        if (!this.player.dead && epoch === this.roomEpoch)
          this.nextEndlessWave();
      });
    }
  }

  private doorArrows(): {
    x: number;
    y: number;
    angle: number;
    label: string;
  }[] {
    if (this.run.phase !== 'doors' || this.player.dead || this.transitioning)
      return [];
    const cam = this.cameras.main,
      view = cam.worldView;
    return this.doors.flatMap((d, i) => {
      if (view.contains(d.x, d.y - 100)) return [];
      const dx = d.x - view.centerX,
        dy = d.y - view.centerY,
        angle = Math.atan2(dy, dx);
      const sx = dx * cam.zoom,
        sy = dy * cam.zoom;
      const scale = Math.min(
        (cam.width / 2 - 90) / Math.max(1, Math.abs(sx)),
        (cam.height / 2 - 125) / Math.max(1, Math.abs(sy)),
      );
      return [
        {
          x: cam.width / 2 + sx * scale,
          y: cam.height / 2 + sy * scale,
          angle,
          label: this.giftOffers[i]?.gift.name ?? 'Dom',
        },
      ];
    });
  }

  // =================================================================== interação e câmera
  private updateInteractables(): void {
    let near: Interactable | null = null;
    let best = Infinity;
    for (const it of this.interactables) {
      const d = length(it.x - this.player.x, it.y - this.player.y);
      if (d <= it.r && d < best) {
        best = d;
        near = it;
      }
    }
    const blocked =
      this.player.locked ||
      this.player.dead ||
      this.player.stunned ||
      this.transitioning ||
      !!this.cinematic;
    this.nearInteractable = blocked ? null : near;
    if (this.nearInteractable) {
      this.promptText.setText(`[E]  ${this.nearInteractable.label}`);
      this.promptText.setPosition(
        this.nearInteractable.x,
        this.nearInteractable.y +
          (this.nearInteractable.id.startsWith('door') ? 46 : -130),
      );
      this.promptText.setVisible(true);
    } else this.promptText.setVisible(false);
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    let tx: number;
    let ty: number;
    if (this.camTarget) {
      tx = this.camTarget.x;
      ty = this.camTarget.y;
    } else {
      const wp = this.input.activePointer.positionToCamera(
        cam,
      ) as Phaser.Math.Vector2;
      tx =
        this.player.x +
        Phaser.Math.Clamp((wp.x - this.player.x) * 0.1, -80, 80);
      ty =
        this.player.y -
        50 +
        Phaser.Math.Clamp((wp.y - this.player.chestY) * 0.1, -60, 60);
      // enquadra o chefe ativo junto com o jogador (para os ataques serem antecipáveis)
      const foe =
        this.toknar && !this.toknar.dead
          ? this.toknar
          : this.caim && !this.caim.dead && !this.caim.scripted
            ? this.caim
            : this.boss && !this.boss.dead && !this.boss.scripted
              ? this.boss
              : null;
      if (foe) {
        tx += Phaser.Math.Clamp((foe.x - this.player.x) * 0.42, -260, 260);
        ty += Phaser.Math.Clamp((foe.y - this.player.y) * 0.42, -230, 230);
      }
    }
    // seguimento suave; o tremor do Phaser é um deslocamento de render, desacoplado daqui
    const k = 1 - Math.exp(-dt / (this.camTarget ? 260 : 95));
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
        g.slice(
          s.x,
          s.y,
          s.radius,
          s.angle - s.halfArc,
          s.angle + s.halfArc,
          false,
        );
        g.strokePath();
      } else {
        const ux = Math.cos(s.angle);
        const uy = Math.sin(s.angle);
        const px = -uy * (s.width / 2);
        const py = ux * (s.width / 2);
        g.strokePoints(
          [
            new Phaser.Geom.Point(s.x + px, s.y + py),
            new Phaser.Geom.Point(
              s.x + ux * s.length + px,
              s.y + uy * s.length + py,
            ),
            new Phaser.Geom.Point(
              s.x + ux * s.length - px,
              s.y + uy * s.length - py,
            ),
            new Phaser.Geom.Point(s.x - px, s.y - py),
          ],
          true,
        );
      }
    }
    const sp = this.player.sprite;
    g.lineStyle(1, 0xffffff, 1);
    g.lineBetween(sp.x - 8, sp.y, sp.x + 8, sp.y);
    g.lineBetween(sp.x, sp.y - 8, sp.x, sp.y + 8);
    for (const o of this.layout.obstacles) {
      g.lineStyle(1, 0x8080ff, 0.6);
      g.strokeCircle(o.x, o.y, o.r);
    }
    for (const p of this.pools.pools) {
      g.lineStyle(1, 0xff00ff, 0.8);
      g.strokeCircle(p.x, p.y, p.r);
    }
  }

  // =================================================================== HUD e depuração
  getHud(): HudState {
    const p = this.player;
    const room = this.run.room;
    const phase = this.run.phase;
    let boss: HudState['boss'] = null;
    if (this.boss && !this.boss.scripted)
      boss = {
        name: this.boss.def.name,
        title: this.boss.def.title,
        ratio: this.boss.hpRatio,
        phase: this.boss.brain.phase,
      };
    if (this.caim && !this.caim.scripted)
      boss = {
        name: this.caim.name,
        title: this.caim.title,
        ratio: this.caim.hpRatio,
        phase: this.caim.brain.phase,
      };
    // a barra só entra depois da conversa (ordem: diálogo → rugido/título → barra)
    if (this.toknar && !this.toknar.dead && this.toknar.brain.state !== 'intro')
      boss = {
        name: this.toknar.name,
        title: this.toknar.title,
        ratio: this.toknar.hpRatio,
        phase: this.toknar.brain.phase,
      };
    return {
      details: [
        this.skills.summary(),
        this.infection
          ? `Infecção ${this.infection}/3 · exposição +${Math.round(this.infection * FINAL_BOSS.infectionRate * 100)}% · ${Math.ceil(this.infectionMs / 1000)}s`
          : '',
        p.avatarCooldown > 0
          ? `F recarga ${Math.ceil(p.avatarCooldown / 1000)}s`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      options: this.giftOffers.map(
        (o, i) =>
          `${i === 0 ? '←' : '→'} ${o.gift.glyph} ${o.gift.name} · ${o.evolution ? 'Evolução' : 'Novo'} ${o.level}\n${o.description}`,
      ),
      buff: this.buffActive
        ? `${this.buffActive.name} · ${this.buffRooms === 1 ? 'sala atual' : 'próxima sala'}${this.buffActive.id === 'barrier' ? ` · ${p.barrier} barreira / ${p.barrierHits} acertos` : this.buffActive.id === 'ward' ? ` · ${p.infectionWard} proteções` : ''}`
        : '',
      bossExtra: this.boss && !this.boss.scripted && !this.boss.dead && !this.toknar && !this.caim
        ? `Postura ${Math.ceil(this.boss.brain.posture)}/${EXECUTIONER.posture}${this.boss.brain.state === 'broken' ? ' · VULNERÁVEL' : ''}`
        : this.toknar
        ? `${TOKNAR.moves[this.toknar.brain.move].name} · Postura ${Math.ceil(this.toknar.brain.posture)}/${TOKNAR.posture}${this.toknar.brain.state === 'broken' ? ' · VULNERÁVEL' : ''}`
        : this.caim
          ? `Manto ${Math.ceil(this.caim.defense.shield)}/${FINAL_BOSS.shieldHp} · ${this.caim.defense.mode === 'ritual' ? `COLHEITA: quebre ${Math.ceil(this.caim.defense.posture)} de postura` : this.caim.defense.mode === 'rupture' ? 'ONDA DE SERVIDÃO — recue ou esquive' : this.caim.defense.mode === 'shieldWarning' ? 'MANTO DA SERVIDÃO — preparando escudo' : this.caim.defense.mode === 'punish' ? 'VULNERÁVEL' : ''}`
          : '',
      arrows: this.doorArrows(),
      hp: Math.max(0, Math.ceil(p.health.current)),
      maxHp: p.health.max,
      dashCharges: p.dash.charges,
      dashMax: p.dash.maxCharges,
      dashRecharge: p.dash.rechargeProgress,
      spellProgress: p.spell.cooldown.progress,
      sunUnlocked: p.gifts.has('second_sun'),
      sunProgress: p.sun.cooldown.progress,
      avatarUnlocked: p.gifts.has('avatar'),
      glory: p.glory / AVATAR.gloryMax,
      comboIndex: p.combo.displayIndex,
      comboActive: p.combo.attacking || p.combo.nextIndex > 0,
      enemies:
        this.aliveEnemies() +
        this.pendingSpawns +
        this.wyverns.filter((w) => !w.dead).length,
      roomLabel: this.endless
        ? `Provação da Eternidade · Onda ${this.endlessWave}`
        : room
          ? room.name
          : '',
      phase,
      boss,
      blessings: this.blessings.owned,
      gifts: [...p.gifts]
        .map((id) => getGift(id))
        .filter((g) => !!g)
        .map((g) => ({
          name: `${g.name} ${this.build.level(g.id)} — ${g.description}`,
          glyph: g.glyph,
          color: g.color,
        })),
      tutorial:
        room?.kind === 'prep' && phase === 'prep' ? { ...p.usage } : null,
      prompt: this.nearInteractable ? this.nearInteractable.label : null,
      timeMs: this.runTime,
      resistBuff: p.stats.hasTimed('resist'),
      exposure: this.exposure.value,
      stunned: this.exposure.stunned,
      stunImmune: this.exposure.immunity > 0,
      cinematic: !!this.cinematic,
      canSkip: !!this.cinematic?.canSkip,
      stats: p.stats.snapshot(),
    };
  }

  debugSnapshot(): Record<string, unknown> {
    let particles = 0;
    for (const c of this.children.list) {
      if (c instanceof Phaser.GameObjects.Particles.ParticleEmitter)
        particles += c.getAliveParticleCount();
    }
    return {
      metrics: {
        ...this.metrics,
        ratio: this.metrics.simulationMs / Math.max(1, this.metrics.realMs),
      },
      offers: this.giftOffers.map((o) => ({ id: o.gift.id, level: o.level })),
      buffTaken: this.buffTaken,
      toknar: this.toknar
        ? {
            hp: this.toknar.health.current,
            phase: this.toknar.brain.phase,
            state: this.toknar.brain.state,
            posture: this.toknar.brain.posture,
          }
        : null,
      dialogue: this.dialogueActive,
      kinds: this.enemies.filter((e) => !e.dead).map((e) => e.def.kind),
      wildWyverns: this.wyverns.filter((w) => !w.dead && w.variant === 'wild').length,
      endlessWave: this.endlessWave,
      room: this.run.room?.id,
      roomIndex: this.run.index,
      phase: this.run.phase,
      doors: this.doors.map((d) => d.kind),
      enemies: this.enemies.length,
      alive: this.aliveEnemies(),
      wyverns: this.wyverns.length,
      pools: this.pools.pools.length,
      exposure: Math.round(this.exposure.value * 100) / 100,
      stunned: this.exposure.stunned,
      pendingSpawns: this.pendingSpawns,
      hitboxes: this.hitboxes.all.length,
      projectiles: this.projectiles.count,
      hp: this.player.health.current,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        anim: this.player.animator.state,
        frame: this.player.animator.frameName,
        dead: this.player.dead,
        charges: this.player.dash.charges,
        gifts: [...this.player.gifts],
        glory: this.player.glory,
      },
      boss: this.boss
        ? {
            hp: this.boss.health.current,
            phase: this.boss.brain.phase,
            state: this.boss.brain.state,
            posture: this.boss.brain.posture,
            frame: this.boss.frameName,
          }
        : null,
      caim: this.caim
        ? {
            hp: this.caim.health.current,
            phase: this.caim.brain.phase,
            state: this.caim.brain.state,
            action: this.caim.brain.action,
          }
        : null,
      cinematic: !!this.cinematic,
      gloryGranted: this.gloryGranted,
      blessings: this.blessings.owned.map((b) => b.id),
      kills: this.kills,
      listeners: {
        pointerdown: this.input.listenerCount('pointerdown'),
        escDown: this.keys.ESC.listenerCount('down'),
        eDown: this.keys.E.listenerCount('down'),
        spaceDown: this.keys.SPACE.listenerCount('down'),
        qDown: this.keys.Q.listenerCount('down'),
        blur: this.game.events.listenerCount(Phaser.Core.Events.BLUR),
        sceneShutdown: this.events.listenerCount(Phaser.Scenes.Events.SHUTDOWN),
      },
      displayObjects: this.children.length,
      particles,
      tweens: this.tweens.getTweens().length,
      hurtboxes: this.lastHurtboxes.length,
      fps: Math.round(this.game.loop.actualFps),
      frameMs: Math.round(this.game.loop.delta * 10) / 10,
    };
  }

  // ------------------------------------------------------------- comandos de desenvolvimento / testes
  devKillAll(): void {
    for (const e of this.enemies)
      if (!e.dead)
        e.receiveHit({
          damage: 9999,
          knockback: 200,
          dirX: 0,
          dirY: -1,
          tag: 'dev',
        });
    for (const w of this.wyverns)
      if (!w.dead && w.brain.tangible)
        w.receiveHit({
          damage: 9999,
          knockback: 0,
          dirX: 0,
          dirY: -1,
          tag: 'dev',
        });
  }

  /** Avança direto até a sala indicada (testes/painel de desenvolvimento). */
  devGotoRoom(roomId: string): void {
    const target = ROOMS.findIndex((r) => r.id === roomId);
    if (target <= this.run.index || this.run.over) return;
    for (let guard = 0; guard < 30 && !this.run.over; guard++) {
      if (this.run.phase === 'prep') {
        if (this.run.room?.kind === 'prep') {
          this.dummies.forEach((d) => d.destroy());
          this.dummies = [];
        }
        this.run.startCombat();
      }
      while (this.run.phase === 'combat') this.run.tick(0);
      if (this.run.phase === 'boss') this.run.bossDefeated();
      if (this.run.phase === 'cleared' || this.run.phase === 'reward')
        this.run.rewardTaken();
      if (this.run.phase === 'doors') {
        if (this.run.index + 1 === target) {
          this.clearDoors();
          this.clearRoomEntities();
          this.interactables = [];
          this.handleRun(this.run.chooseDoor(0));
          return;
        }
        this.run.chooseDoor(0);
      }
    }
  }

  devDamageBoss(ratio: number): void {
    if (this.toknar && !this.toknar.dead)
      this.toknar.receiveHit({
        damage: TOKNAR.hp * ratio,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'dev',
      });
    if (this.boss && !this.boss.dead)
      this.boss.receiveHit({
        damage: this.boss.def.hp * ratio,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'dev',
      });
    if (this.caim && !this.caim.dead && !this.caim.hurtbox.invulnerable)
      this.caim.receiveHit({
        damage: CAIM.hp * ratio,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'dev',
      });
  }

  devSpawnPoolAtPlayer(): void {
    this.pools.spawn(this.player.x, this.player.y);
  }
}
