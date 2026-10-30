import Phaser from 'phaser';
import { ATRIOX_COMBO } from '../../data/attacks';
import { SKILLS } from '../../data/v03';
import { ATRIOX_SCALE, CAIM_SCALE, COLORS, FONT_UI, GAME_H, GAME_W, WYVERN_SCALE } from '../config/constants';
import { SpriteAnimator, getLibrary, type AnimLibrary } from '../animation/SpriteAnimator';
import { FrameTimeline } from '../animation/FrameTimeline';
import { degToRad } from '../combat/geometry';

const CHARS: { id: string; label: string; scale: number; collider: number; flying?: boolean }[] = [
  { id: 'atriox', label: 'Atriox', scale: ATRIOX_SCALE, collider: 16 },
  { id: 'toknar', label: 'Toknar', scale: 0.72, collider: 38 },
  { id: 'caim', label: 'Caim', scale: CAIM_SCALE, collider: 26 },
  { id: 'wyvern', label: 'Wyvern', scale: WYVERN_SCALE, collider: 30, flying: true },
  { id: 'apollon', label: 'Bênção (composto)', scale: ATRIOX_SCALE, collider: 16 }
];

/**
 * Inspetor de animações (desenvolvimento). Acesso: menu (dev) ou ?inspector na URL.
 *
 * Teclas: ←/→ personagem · ↑/↓ animação · Espaço play/pause · . / , quadro
 *         +/- velocidade · B fundo claro/escuro · P pivô · C collider · H hitbox · X espelhar · Esc menu
 * Ataques (modo sincronizado) são tocados com as durações reais do combo.
 */
export class AnimInspectorScene extends Phaser.Scene {
  private lib!: AnimLibrary;
  private anim: SpriteAnimator | null = null;
  private charIdx = 0;
  private animIdx = 0;
  private playing = true;
  private speed = 1;
  private light = false;
  private showPivot = true;
  private showCollider = true;
  private showHitbox = true;
  private flip = false;
  private syncT = 0;
  private bg!: Phaser.GameObjects.Rectangle;
  private g!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private readonly cx = GAME_W / 2 + 120;
  private readonly cy = GAME_H / 2 + 150;

  constructor() {
    super('AnimInspectorScene');
  }

  create(): void {
    this.lib = getLibrary(this);
    this.bg = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x24262c).setOrigin(0);
    this.add.rectangle(0, 0, 360, GAME_H, 0x0b0607, 0.85).setOrigin(0);
    this.g = this.add.graphics().setDepth(10);
    this.info = this.add.text(16, 16, '', { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#e9dcc0', lineSpacing: 3, wordWrap: { width: 330 } });
    this.add
      .text(GAME_W - 16, GAME_H - 14, '←/→ personagem  ↑/↓ animação  Espaço play  , . quadro  +/- velocidade  B fundo  P pivô  C collider  H hitbox  X espelhar  Esc sair', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: COLORS.hex.dim
      })
      .setOrigin(1, 1);
    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => this.key(e));
    this.select();
  }

  private animsFor(char: string): string[] {
    return Object.keys(this.lib.anims).filter((k) => k.startsWith(`${char}.`));
  }

  private get char(): (typeof CHARS)[number] {
    return CHARS[this.charIdx];
  }

  private get animKey(): string {
    const list = this.animsFor(this.char.id);
    return list[Math.min(this.animIdx, list.length - 1)];
  }

  private select(): void {
    this.anim?.destroy();
    const c = this.char;
    const key = this.animKey;
    if (!key) return;
    this.anim = new SpriteAnimator(this, this.lib, c.id, this.cx, this.cy - (c.flying ? 90 : 0), key);
    this.anim.sprite.setScale(c.scale).setDepth(5);
    this.anim.play(key, true);
    this.syncT = 0;
  }

  private key(e: KeyboardEvent): void {
    const n = this.animsFor(this.char.id).length;
    switch (e.code) {
      case 'ArrowRight':
        this.charIdx = (this.charIdx + 1) % CHARS.length;
        this.animIdx = 0;
        this.select();
        break;
      case 'ArrowLeft':
        this.charIdx = (this.charIdx + CHARS.length - 1) % CHARS.length;
        this.animIdx = 0;
        this.select();
        break;
      case 'ArrowDown':
        this.animIdx = (this.animIdx + 1) % n;
        this.select();
        break;
      case 'ArrowUp':
        this.animIdx = (this.animIdx + n - 1) % n;
        this.select();
        break;
      case 'Space':
        this.playing = !this.playing;
        break;
      case 'Period':
        this.step(1);
        break;
      case 'Comma':
        this.step(-1);
        break;
      case 'Equal':
      case 'NumpadAdd':
        this.speed = Math.min(3, this.speed + 0.1);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        this.speed = Math.max(0.1, this.speed - 0.1);
        break;
      case 'KeyB':
        this.light = !this.light;
        this.bg.setFillStyle(this.light ? 0xd8d4cc : 0x24262c);
        break;
      case 'KeyP':
        this.showPivot = !this.showPivot;
        break;
      case 'KeyC':
        this.showCollider = !this.showCollider;
        break;
      case 'KeyH':
        this.showHitbox = !this.showHitbox;
        break;
      case 'KeyX':
        this.flip = !this.flip;
        break;
      case 'Escape':
        this.scene.start('MenuScene');
        break;
    }
  }

  private step(d: number): void {
    if (!this.anim) return;
    this.playing = false;
    const len = this.anim.timeline.def?.frames.length ?? 1;
    this.anim.showIndex((this.anim.timeline.index + d + len) % len);
  }

  /** duração real (ms) por fase para animações sincronizadas com o combo */
  private syncedTiming(key: string): { windup: number; active: number; recovery: number } | null {
    const step = ATRIOX_COMBO.find((s) => key === `atriox.${s.id}` || (key === 'atriox.attack_3_glory' && s.id === 'attack_3'));
    if (step) return { windup: step.windup, active: step.active, recovery: step.recovery };
    if(key==='atriox.ascending'||key==='atriox.return_cut')return {windup:SKILLS.chargeWindup,active:SKILLS.chargeActive,recovery:key==='atriox.return_cut'?270:SKILLS.chargeRecovery};
    if (key === 'atriox.cast' || key === 'atriox.cast_sun' || key.startsWith('caim.')) {
      const d = this.anim?.timeline.def;
      if (d?.frames.some((f) => f.phase)) return { windup: 420, active: 160, recovery: 380 };
    }
    return null;
  }

  update(_t: number, dt: number): void {
    const a = this.anim;
    if (!a) return;
    const key = this.animKey;
    const timing = this.syncedTiming(key);
    if (this.playing) {
      if (timing) {
        const total = timing.windup + timing.active + timing.recovery;
        this.syncT = (this.syncT + dt * this.speed) % (total + 300);
        const t = this.syncT;
        if (t < timing.windup) a.sync('windup', t / timing.windup);
        else if (t < timing.windup + timing.active) a.sync('active', (t - timing.windup) / timing.active);
        else a.sync('recovery', Math.min(1, (t - timing.windup - timing.active) / timing.recovery));
      } else {
        a.update(dt * this.speed);
        if (a.timeline.done) a.play(key, true);
      }
    }
    a.sprite.setFlipX(this.flip);

    const g = this.g;
    g.clear();
    g.lineStyle(1, this.light ? 0x888888 : 0x444650, 1);
    g.lineBetween(380, this.cy, GAME_W, this.cy);
    const c = this.char;
    if (this.showCollider) {
      g.lineStyle(2, 0x40ff70, 0.9);
      g.strokeEllipse(this.cx, this.cy, c.collider * 2, c.collider * 2);
    }
    if (this.showHitbox) {
      const step = ATRIOX_COMBO.find((s) => key === `atriox.${s.id}` || (key === 'atriox.attack_3_glory' && s.id === 'attack_3'));
      const f = a.timeline.frame;
      if (step && f?.phase === 'active') {
        const ang = this.flip ? Math.PI : 0;
        const half = degToRad(step.arcDeg / 2);
        g.fillStyle(0xff3030, 0.18);
        g.slice(this.cx, this.cy, step.range, ang - half, ang + half, false);
        g.fillPath();
        g.lineStyle(2, 0xff3030, 0.9);
        g.slice(this.cx, this.cy, step.range, ang - half, ang + half, false);
        g.strokePath();
      }
    }
    if (this.showPivot) {
      const sp = a.sprite;
      g.lineStyle(2, 0xff40ff, 1);
      g.lineBetween(sp.x - 12, sp.y, sp.x + 12, sp.y);
      g.lineBetween(sp.x, sp.y - 12, sp.x, sp.y + 12);
      const b = sp.getBounds();
      g.lineStyle(1, 0xffd77a, 0.5);
      g.strokeRect(b.x, b.y, b.width, b.height);
    }

    const d = a.timeline.def;
    const f = a.timeline.frame;
    const list = this.animsFor(c.id);
    this.info.setText(
      [
        'INSPETOR DE ANIMAÇÕES',
        '',
        `Personagem: ${c.label}  (${this.charIdx + 1}/${CHARS.length})`,
        `Animação:   ${key}  (${this.animIdx + 1}/${list.length})`,
        `Quadro:     ${a.timeline.index + 1}/${d?.frames.length ?? 0}  ${f?.name ?? ''}`,
        `Fase/evento: ${f?.phase ?? '—'} / ${f?.event ?? '—'}`,
        `Modo:       ${timing ? 'sincronizado com o combate' : `livre (${d ? FrameTimeline.duration(d) : 0} ms, ${d?.loop ? 'loop' : 'uma vez'})`}`,
        `Estado:     ${this.playing ? 'tocando' : 'pausado'}   velocidade ×${this.speed.toFixed(1)}`,
        `Escala:     ${c.scale}   espelhado: ${this.flip ? 'sim' : 'não'}`,
        `Fundo:      ${this.light ? 'claro' : 'escuro'}`,
        '',
        'Animações:',
        ...list.map((k, i) => `${i === this.animIdx ? '▶' : ' '} ${k}`)
      ].join('\n')
    );
  }
}
