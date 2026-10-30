import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { formatTime, ornament } from '../ui/widgets';
import { flashAllowed } from '../services';
import type { ArenaScene, HudState } from './ArenaScene';

/**
 * HUD em cena paralela. Lê o estado da arena a cada quadro (polling),
 * o que evita listeners acumulados entre partidas.
 */
export class UIScene extends Phaser.Scene {
  private arena!: ArenaScene;
  private g!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private bossTitle!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private tutorialTitle!: Phaser.GameObjects.Text;
  private dashLabel!: Phaser.GameObjects.Text;
  private spellLabel!: Phaser.GameObjects.Text;
  private blessingIcons: Phaser.GameObjects.Text[] = [];
  private infoPanel!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private damageOverlay!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Image;
  private hpTrail = 1;
  private bossTrail = 1;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private bannerQueue: { title: string; sub: string; color: number }[] = [];
  private bannerBusy = false;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.arena = this.scene.get('ArenaScene') as ArenaScene;
    this.blessingIcons = [];
    this.bannerQueue = [];
    this.bannerBusy = false;
    this.hpTrail = 1;
    this.bossTrail = 1;

    this.damageOverlay = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x8e1b1f, 0).setOrigin(0);
    this.g = this.add.graphics();

    // retrato (recorte da cabeça da pose idle)
    const tex = this.textures.get('atriox_idle').getSourceImage() as HTMLImageElement;
    const cw = Math.min(64, tex.width);
    const ch = 62;
    const ccx = tex.width * 0.5;
    const ps = 1.3;
    this.portrait = this.add.image(0, 0, 'atriox_idle').setOrigin(0, 0).setScale(ps);
    this.portrait.setCrop(ccx - cw / 2, 2, cw, ch);
    this.portrait.setPosition(70 - ccx * ps, GAME_H - 76 - (2 + ch / 2) * ps);

    const txt = (x: number, y: number, s: string, size: number, color: string = COLORS.hex.ivory, italic = false): Phaser.GameObjects.Text =>
      this.add.text(x, y, s, { fontFamily: FONT_UI, fontSize: `${size}px`, color, fontStyle: italic ? 'italic' : 'normal', stroke: '#0b0607', strokeThickness: 4 });

    this.hpText = txt(132, GAME_H - 86, '', 15).setOrigin(0, 0.5);
    this.dashLabel = txt(0, 0, 'Espaço', 11, COLORS.hex.dim).setOrigin(0.5);
    this.spellLabel = txt(0, 0, 'Botão dir.', 11, COLORS.hex.dim).setOrigin(0.5);
    this.waveText = txt(GAME_W / 2, 18, '', 18, COLORS.hex.gold).setOrigin(0.5, 0);
    this.enemyText = txt(GAME_W / 2, 42, '', 14, COLORS.hex.dim, true).setOrigin(0.5, 0);
    this.timeText = txt(GAME_W - 20, 18, '', 14, COLORS.hex.dim).setOrigin(1, 0);
    this.bossName = txt(GAME_W / 2, GAME_H - 92, '', 22, COLORS.hex.ivory).setOrigin(0.5, 1).setVisible(false);
    this.bossTitle = txt(GAME_W / 2, GAME_H - 72, '', 13, COLORS.hex.dim, true).setOrigin(0.5, 1).setVisible(false);
    this.hintText = txt(GAME_W - 16, GAME_H - 14, 'WASD mover  ·  Clique atacar  ·  Botão dir. magia  ·  Espaço dash  ·  E interagir  ·  Tab info  ·  Esc pausa', 12, '#8a7a62')
      .setOrigin(1, 1)
      .setAlpha(0.75);
    this.tutorialTitle = txt(24, 150, 'TREINAMENTO', 15, COLORS.hex.gold).setVisible(false);
    this.tutorialText = txt(24, 174, '', 15, COLORS.hex.ivory).setLineSpacing(6).setVisible(false);

    // painel Tab
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0b0607, 0.88);
    panelBg.fillRect(-320, -220, 640, 440);
    panelBg.lineStyle(1.5, COLORS.gold, 0.8);
    panelBg.strokeRect(-320, -220, 640, 440);
    const title = this.add.text(0, -196, 'ATRIOX CINDER', { fontFamily: FONT_TITLE, fontSize: '24px', color: COLORS.hex.gold }).setOrigin(0.5, 0);
    this.infoText = this.add.text(-290, -146, '', { fontFamily: FONT_UI, fontSize: '15px', color: COLORS.hex.ivory, wordWrap: { width: 580 }, lineSpacing: 5 });
    this.infoPanel = this.add.container(GAME_W / 2, GAME_H / 2, [panelBg, title, ornament(this, 0, -158, 400), this.infoText]).setVisible(false);

    this.tabKey = this.input.keyboard!.addKey('TAB');
    this.input.keyboard!.addCapture('TAB');
  }

  update(_t: number, delta: number): void {
    if (!this.arena || !this.arena.scene.isActive() && !this.arena.scene.isPaused()) return;
    if (!this.arena.player) return;
    const h = this.arena.getHud();
    this.draw(h, delta);
    this.infoPanel.setVisible(this.tabKey.isDown);
    if (this.tabKey.isDown) this.fillInfo(h);
  }

  private draw(h: HudState, dt: number): void {
    const g = this.g;
    g.clear();

    // ---------------- vida
    const x0 = 128;
    const y0 = GAME_H - 72;
    const w = 300;
    const ratio = h.maxHp > 0 ? h.hp / h.maxHp : 0;
    this.hpTrail = this.hpTrail > ratio ? Math.max(ratio, this.hpTrail - dt / 900) : ratio;
    // medalhão do retrato
    g.fillStyle(0x0b0607, 0.85);
    g.fillCircle(70, GAME_H - 76, 46);
    g.lineStyle(3, COLORS.gold, 1);
    g.strokeCircle(70, GAME_H - 76, 46);
    g.lineStyle(1, 0x7a5a2a, 1);
    g.strokeCircle(70, GAME_H - 76, 40);

    g.fillStyle(0x0b0607, 0.85);
    g.fillRect(x0 - 4, y0 - 4, w + 8, 22);
    g.fillStyle(0x3a0c10, 1);
    g.fillRect(x0, y0, w, 14);
    g.fillStyle(0xffb070, 0.8);
    g.fillRect(x0, y0, w * this.hpTrail, 14);
    g.fillStyle(ratio < 0.3 ? 0xd0302a : 0xa82228, 1);
    g.fillRect(x0, y0, w * ratio, 14);
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(x0, y0, w * ratio, 4);
    g.lineStyle(1.5, COLORS.gold, 1);
    g.strokeRect(x0 - 4, y0 - 4, w + 8, 22);
    if (h.resistBuff) {
      g.lineStyle(2, 0xcfe0ec, 0.9);
      g.strokeRect(x0 - 7, y0 - 7, w + 14, 28);
    }
    this.hpText.setText(`${h.hp} / ${h.maxHp}`);
    this.hpText.setPosition(x0, y0 - 16);

    // ---------------- combo (3 losangos)
    for (let i = 0; i < 3; i++) {
      const cx = x0 + w - 50 + i * 20;
      const cy = y0 - 14;
      const lit = h.comboActive && i <= h.comboIndex;
      g.fillStyle(lit ? (i === 2 ? 0xffd77a : COLORS.gold) : 0x2a1d16, 1);
      g.fillPoints([new Phaser.Geom.Point(cx, cy - 7), new Phaser.Geom.Point(cx + 6, cy), new Phaser.Geom.Point(cx, cy + 7), new Phaser.Geom.Point(cx - 6, cy)], true);
      g.lineStyle(1, 0x7a5a2a, 1);
      g.strokePoints([new Phaser.Geom.Point(cx, cy - 7), new Phaser.Geom.Point(cx + 6, cy), new Phaser.Geom.Point(cx, cy + 7), new Phaser.Geom.Point(cx - 6, cy)], true);
    }

    // ---------------- habilidades
    const icon = (cx: number, cy: number, progress: number, color: number, glyph: 'dash' | 'flame', label: Phaser.GameObjects.Text): void => {
      const r = 20;
      g.fillStyle(0x0b0607, 0.9);
      g.fillCircle(cx, cy, r + 3);
      if (progress < 1) {
        g.fillStyle(color, 0.35);
        g.slice(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
        g.fillPath();
      } else {
        g.fillStyle(color, 0.9);
        g.fillCircle(cx, cy, r);
      }
      g.lineStyle(2, progress >= 1 ? COLORS.goldBright : 0x5a4026, 1);
      g.strokeCircle(cx, cy, r + 3);
      g.fillStyle(progress >= 1 ? 0x1a0d08 : 0xe8d0a0, 1);
      if (glyph === 'dash') {
        g.fillTriangle(cx - 9, cy - 8, cx - 9, cy + 8, cx + 1, cy);
        g.fillTriangle(cx - 1, cy - 8, cx - 1, cy + 8, cx + 9, cy);
      } else {
        g.fillTriangle(cx - 7, cy + 8, cx + 7, cy + 8, cx, cy - 10);
        g.fillStyle(progress >= 1 ? 0xffe0a0 : 0x8a6a40, 1);
        g.fillCircle(cx, cy + 3, 4);
      }
      label.setPosition(cx, cy + r + 11);
    };
    icon(x0 + w + 40, y0 + 2, h.dashProgress, 0xe8c070, 'dash', this.dashLabel);
    icon(x0 + w + 92, y0 + 2, h.spellProgress, 0xff8a3a, 'flame', this.spellLabel);

    // ---------------- bênçãos possuídas
    while (this.blessingIcons.length < h.blessings.length) {
      const b = h.blessings[this.blessingIcons.length];
      const t = this.add
        .text(0, 0, b.glyph, { fontFamily: 'Segoe UI Symbol, Georgia, serif', fontSize: '16px', color: '#' + b.color.toString(16).padStart(6, '0'), stroke: '#0b0607', strokeThickness: 3 })
        .setOrigin(0.5);
      this.blessingIcons.push(t);
    }
    h.blessings.forEach((b, i) => {
      const cx = x0 + 10 + i * 30;
      const cy = y0 - 40;
      g.fillStyle(0x0b0607, 0.85);
      g.fillCircle(cx, cy, 12);
      g.lineStyle(1.5, b.color, 1);
      g.strokeCircle(cx, cy, 12);
      this.blessingIcons[i].setPosition(cx, cy);
    });

    // ---------------- topo
    this.waveText.setText(h.waveLabel);
    this.enemyText.setText(h.phase === 'wave' ? `Inimigos restantes: ${h.enemies}` : h.phase === 'boss' && h.enemies > 1 ? `Reforços: ${h.enemies - 1}` : '');
    this.timeText.setText(formatTime(h.timeMs));
    if (h.waveLabel) {
      const tw = this.waveText.width;
      g.lineStyle(1, COLORS.gold, 0.5);
      g.lineBetween(GAME_W / 2 - tw / 2 - 40, 30, GAME_W / 2 - tw / 2 - 10, 30);
      g.lineBetween(GAME_W / 2 + tw / 2 + 10, 30, GAME_W / 2 + tw / 2 + 40, 30);
    }

    // ---------------- chefe
    const b = h.boss;
    this.bossName.setVisible(!!b);
    this.bossTitle.setVisible(!!b);
    if (b) {
      const bw = 620;
      const bx = GAME_W / 2 - bw / 2;
      const by = 112;
      this.bossTrail = this.bossTrail > b.ratio ? Math.max(b.ratio, this.bossTrail - dt / 1100) : b.ratio;
      g.fillStyle(0x0b0607, 0.88);
      g.fillRect(bx - 5, by - 5, bw + 10, 22);
      g.fillStyle(0x2a0809, 1);
      g.fillRect(bx, by, bw, 12);
      g.fillStyle(0xffc080, 0.7);
      g.fillRect(bx, by, bw * this.bossTrail, 12);
      g.fillStyle(b.phase === 2 ? 0xe0501f : 0xa01c22, 1);
      g.fillRect(bx, by, bw * b.ratio, 12);
      g.fillStyle(0xffffff, 0.15);
      g.fillRect(bx, by, bw * b.ratio, 3);
      g.lineStyle(1.5, COLORS.gold, 1);
      g.strokeRect(bx - 5, by - 5, bw + 10, 22);
      // marcador de fase em 50%
      g.lineStyle(2, COLORS.goldBright, 0.9);
      g.lineBetween(bx + bw / 2, by - 6, bx + bw / 2, by + 18);
      this.bossName.setText(b.name.toUpperCase());
      this.bossTitle.setText(b.phase === 2 ? 'Fúria do Carrasco' : b.title);
      this.bossName.setPosition(GAME_W / 2, by - 22);
      this.bossTitle.setPosition(GAME_W / 2, by - 8);
    }

    // ---------------- tutorial
    const tut = h.tutorial;
    this.tutorialTitle.setVisible(!!tut);
    this.tutorialText.setVisible(!!tut);
    if (tut) {
      const ck = (v: boolean): string => (v ? '✓' : '○');
      this.tutorialText.setText(
        [
          `${ck(tut.moved)}  WASD — mover`,
          `${ck(tut.attacked)}  Clique esquerdo — combo (3 golpes)`,
          `${ck(tut.dashed)}  Espaço — dash (atravessa ataques)`,
          `${ck(tut.cast)}  Botão direito — Chama do Julgamento`,
          '',
          'Golpeie os bonecos para treinar.',
          'Vá ao altar central e pressione E',
          'para iniciar a Provação.'
        ].join('\n')
      );
      g.fillStyle(0x0b0607, 0.7);
      g.fillRect(14, 140, 330, 228);
      g.lineStyle(1, 0x7a5a2a, 0.9);
      g.strokeRect(14, 140, 330, 228);
    }
    this.hintText.setVisible(!tut);
  }

  private fillInfo(h: HudState): void {
    const s = h.stats;
    const lines: string[] = [];
    lines.push(`Vida ${h.hp}/${h.maxHp}    Velocidade ${Math.round(s.moveSpeed)}    Dano ×${s.damageMul.toFixed(2)}`);
    lines.push(`Recarga do dash ×${s.dashCooldownMul.toFixed(2)}    Resistência ${Math.round(s.resist * 100)}%    Tempo ${formatTime(h.timeMs)}`);
    lines.push('');
    lines.push('BÊNÇÃOS');
    if (h.blessings.length === 0) lines.push('  Nenhuma ainda. Supere uma onda para receber uma bênção.');
    for (const b of h.blessings) lines.push(`  ${b.glyph}  ${b.name} — ${b.description}`);
    lines.push('');
    lines.push('COMBO: Corte Ascendente → Corte Cruzado → Julgamento da Lâmina');
    lines.push('Clique no ritmo para encadear. Dash cancela a preparação e a recuperação.');
    this.infoText.setText(lines.join('\n'));
  }

  // ---------------------------------------------------------------- chamadas da arena
  banner(title: string, sub = '', color: number = COLORS.gold): void {
    this.bannerQueue.push({ title, sub, color });
    if (!this.bannerBusy) this.nextBanner();
  }

  private nextBanner(): void {
    const b = this.bannerQueue.shift();
    if (!b) {
      this.bannerBusy = false;
      return;
    }
    this.bannerBusy = true;
    const hex = '#' + b.color.toString(16).padStart(6, '0');
    const y = 214;
    const t = this.add.text(GAME_W / 2, y, b.title.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '40px', color: hex, stroke: '#0b0607', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    t.setLetterSpacing?.(4);
    const s = this.add.text(GAME_W / 2, y + 40, b.sub, { fontFamily: FONT_UI, fontSize: '17px', fontStyle: 'italic', color: COLORS.hex.ivory, stroke: '#0b0607', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
    const o = ornament(this, GAME_W / 2, y + 22, Math.max(260, t.width + 60), b.color).setAlpha(0);
    const all = [t, s, o];
    this.tweens.add({ targets: all, alpha: 1, duration: 280 });
    this.tweens.add({ targets: t, scale: { from: 1.15, to: 1 }, duration: 380, ease: 'Cubic.easeOut' });
    this.tweens.add({
      targets: all,
      alpha: 0,
      delay: 1900,
      duration: 450,
      onComplete: () => {
        all.forEach((x) => x.destroy());
        this.nextBanner();
      }
    });
  }

  bossIntro(name: string, title: string): void {
    const bar = this.add.rectangle(0, GAME_H / 2 - 20, GAME_W, 130, 0x000000, 0.65).setOrigin(0, 0.5).setAlpha(0);
    const n = this.add.text(GAME_W / 2, GAME_H / 2 - 36, name.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '46px', color: '#e8d8b8', stroke: '#0b0607', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    const t = this.add.text(GAME_W / 2, GAME_H / 2 + 14, title, { fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'italic', color: '#d0473a' }).setOrigin(0.5).setAlpha(0);
    const o = ornament(this, GAME_W / 2, GAME_H / 2 - 4, 520, 0xd0473a).setAlpha(0);
    const all = [bar, n, t, o];
    this.tweens.add({ targets: all, alpha: 1, duration: 300 });
    this.tweens.add({ targets: n, x: { from: GAME_W / 2 - 40, to: GAME_W / 2 }, duration: 1800, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: all, alpha: 0, delay: 1700, duration: 400, onComplete: () => all.forEach((x) => x.destroy()) });
  }

  damagePulse(): void {
    this.damageOverlay.setAlpha(flashAllowed() ? 0.28 : 0.1);
    this.tweens.killTweensOf(this.damageOverlay);
    this.tweens.add({ targets: this.damageOverlay, alpha: 0, duration: 380 });
  }
}
