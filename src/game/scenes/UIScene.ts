import Phaser from 'phaser';
import {
  COLORS,
  FONT_TITLE,
  FONT_UI,
  GAME_H,
  GAME_W,
  DEV_TOOLS,
} from '../config/constants';
import { formatTime, ornament } from '../ui/widgets';
import { flashAllowed } from '../services';
import type { ArenaScene, HudState } from './ArenaScene';

/**
 * HUD em cena paralela (sem zoom). Lê o estado da arena a cada quadro
 * (polling), o que evita listeners acumulados entre partidas.
 * Textos grandes ficam no TOPO e são breves: o centro da arena fica livre.
 */
export class UIScene extends Phaser.Scene {
  private announcements: Phaser.GameObjects.GameObject[] = [];
  private arena!: ArenaScene;
  private g!: Phaser.GameObjects.Graphics;
  private rewards!: Phaser.GameObjects.Text[];
  private detailText!: Phaser.GameObjects.Text;
  private bossExtraText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private arrows: Phaser.GameObjects.Text[] = [];
  private hpText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private bossTitle!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private stunText!: Phaser.GameObjects.Text;
  private skipText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private perfText!: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private iconTexts: Phaser.GameObjects.Text[] = [];
  private infoPanel!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private damageOverlay!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Image;
  private hpTrail = 1;
  private bossTrail = 1;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private tutorialCollapsed = false;
  private showPerf = false;
  private bannerQueue: { title: string; sub: string; color: number }[] = [];
  private bannerBusy = false;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.announcements = [];
    this.arena = this.scene.get('ArenaScene') as ArenaScene;
    this.labels = [];
    this.iconTexts = [];
    this.bannerQueue = [];
    this.bannerBusy = false;
    this.arrows = [];
    this.hpTrail = 1;
    this.bossTrail = 1;

    this.add
      .image(0, 0, 'vignette')
      .setOrigin(0)
      .setDisplaySize(GAME_W, GAME_H);
    this.damageOverlay = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x8e1b1f, 0)
      .setOrigin(0);
    this.g = this.add.graphics();

    // retrato: recorte da cabeça da pose idle (concept original)
    const tex = this.textures
      .get('atriox_idle')
      .getSourceImage() as HTMLImageElement;
    const cw = Math.min(64, tex.width);
    const ch = 62;
    const ccx = tex.width * 0.5;
    const ps = 1.3;
    this.portrait = this.add
      .image(0, 0, 'atriox_idle')
      .setOrigin(0, 0)
      .setScale(ps);
    this.portrait.setCrop(ccx - cw / 2, 2, cw, ch);
    this.portrait.setPosition(70 - ccx * ps, GAME_H - 76 - (2 + ch / 2) * ps);

    const txt = (
      x: number,
      y: number,
      s: string,
      size: number,
      color: string = COLORS.hex.ivory,
      italic = false,
    ): Phaser.GameObjects.Text =>
      this.add.text(x, y, s, {
        fontFamily: FONT_UI,
        fontSize: `${size}px`,
        color,
        fontStyle: italic ? 'italic' : 'normal',
        stroke: '#0b0607',
        strokeThickness: 4,
      });

    this.rewards = [
      txt(22, 140, '', 14, '#ffe0a0'),
      txt(GAME_W - 22, 140, '', 14, '#ffe0a0').setOrigin(1, 0),
    ];
    for (const r of this.rewards)
      r.setWordWrapWidth(340).setPadding(10).setBackgroundColor('#100c09e8');
    this.detailText = txt(22, GAME_H - 162, '', 13, '#bfe8d4');
    this.bossExtraText = txt(GAME_W / 2, 116, '', 14, '#f0c4aa').setOrigin(0.5);
    // Última Palavra do Sêlun: contagem inequívoca no centro (não cobre o chão)
    this.countdownText = this.add
      .text(GAME_W / 2, 200, '', { fontFamily: FONT_TITLE, fontSize: '46px', color: '#ffb35a', stroke: '#0b0607', strokeThickness: 8 })
      .setOrigin(0.5)
      .setVisible(false);
    this.hpText = txt(132, GAME_H - 90, '', 15).setOrigin(0, 0.5);
    this.roomText = txt(GAME_W / 2, 14, '', 16, COLORS.hex.gold).setOrigin(
      0.5,
      0,
    );
    this.enemyText = txt(
      GAME_W / 2,
      36,
      '',
      13,
      COLORS.hex.dim,
      true,
    ).setOrigin(0.5, 0);
    this.timeText = txt(GAME_W - 18, 14, '', 13, COLORS.hex.dim).setOrigin(
      1,
      0,
    );
    this.bossName = txt(GAME_W / 2, 70, '', 20)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.bossTitle = txt(GAME_W / 2, 86, '', 12, COLORS.hex.dim, true)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.hintText = txt(
      GAME_W - 14,
      GAME_H - 12,
      'Clique atacar · Botão dir. magia · Espaço dash · E interagir · Tab info · Esc pausa',
      12,
      '#8a7a62',
    )
      .setOrigin(1, 1)
      .setAlpha(0.7);
    this.tutorialText = txt(22, 122, '', 14, COLORS.hex.ivory).setLineSpacing(
      5,
    );
    this.stunText = txt(GAME_W / 2, GAME_H - 150, '', 20, '#ff4050')
      .setOrigin(0.5)
      .setVisible(false);
    this.skipText = txt(
      GAME_W - 20,
      GAME_H - 40,
      '[E] / [Espaço] pular',
      14,
      COLORS.hex.dim,
    )
      .setOrigin(1, 1)
      .setVisible(false);
    this.toastText = txt(
      GAME_W / 2,
      GAME_H - 182,
      '',
      15,
      COLORS.hex.ivory,
      true,
    )
      .setOrigin(0.5)
      .setAlpha(0);
    this.perfText = this.add
      .text(8, 8, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '11px',
        color: '#9fe0a0',
        backgroundColor: '#000000aa',
      })
      .setVisible(false);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0b0607, 0.9);
    panelBg.fillRect(-540, -310, 1080, 620);
    panelBg.lineStyle(1.5, COLORS.gold, 0.8);
    panelBg.strokeRect(-540, -310, 1080, 620);
    const title = this.add
      .text(0, -286, 'ATRIOX CINDER', {
        fontFamily: FONT_TITLE,
        fontSize: '24px',
        color: COLORS.hex.gold,
      })
      .setOrigin(0.5, 0);
    this.infoText = this.add.text(-510, -250, '', {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: COLORS.hex.ivory,
      wordWrap: { width: 1000 },
      lineSpacing: 2,
    });
    this.infoPanel = this.add
      .container(GAME_W / 2, GAME_H / 2, [
        panelBg,
        title,
        ornament(this, 0, -260, 400),
        this.infoText,
      ])
      .setVisible(false);

    const kb = this.input.keyboard!;
    this.tabKey = kb.addKey('TAB');
    kb.addCapture('TAB');
    kb.on(
      'keydown-H',
      () => (this.tutorialCollapsed = !this.tutorialCollapsed),
    );
    kb.on('keydown-F3', () => {
      if (DEV_TOOLS || new URLSearchParams(location.search).has('perf'))
        this.showPerf = !this.showPerf;
    });
  }

  update(_t: number, delta: number): void {
    if (!this.arena || !this.arena.player) return;
    if (!this.arena.scene.isActive() && !this.arena.scene.isPaused()) return;
    const h = this.arena.getHud();
    this.draw(h, delta);
    this.rewards.forEach((t, i) =>
      t
        .setText(
          h.options[i] ? `${h.options[i]}\nE na porta: escolher e avançar` : '',
        )
        .setVisible(!!h.options[i]),
    );
    this.detailText.setText([h.buff, h.details].filter(Boolean).join('\n'));
    this.bossExtraText.setText(h.bossExtra).setVisible(!!h.boss);
    this.countdownText.setText(h.countdown).setVisible(!!h.countdown);
    if (h.countdown) this.countdownText.setScale(1 + 0.06 * Math.sin(this.time.now / 90));
    this.arrows.forEach((t) => t.setVisible(false));
    h.arrows.forEach((a, i) => {
      if (!this.arrows[i])
        this.arrows[i] = this.add
          .text(0, 0, '', {
            fontFamily: 'Georgia',
            fontSize: '15px',
            color: '#ffda88',
            backgroundColor: '#100908dd',
            padding: { x: 8, y: 6 },
          })
          .setOrigin(0.5);
      const symbol =
        Math.abs(Math.cos(a.angle)) > 0.65
          ? Math.cos(a.angle) > 0
            ? '→'
            : '←'
          : Math.sin(a.angle) > 0
            ? '↓'
            : '↑';
      this.arrows[i]
        .setText(`${symbol} ${a.label}`)
        .setPosition(a.x, a.y)
        .setVisible(true);
    });
    this.infoPanel.setVisible(this.tabKey.isDown);
    if (this.tabKey.isDown) this.fillInfo(h);
    this.perfText.setVisible(this.showPerf);
    if (this.showPerf) {
      const s = this.arena.debugSnapshot();
      this.perfText.setText(
        `fps ${s.fps}  frame ${s.frameMs} ms  dpr ${window.devicePixelRatio}\nobjetos ${s.displayObjects}  partículas ${s.particles}  tweens ${s.tweens}\ninimigos ${s.enemies}  wyverns ${s.wyverns}  hitboxes ${s.hitboxes}  projéteis ${s.projectiles}\nsimulação ${JSON.stringify(s.metrics)}`,
      );
    }
  }

  private label(
    i: number,
    x: number,
    y: number,
    s: string,
    color: string = COLORS.hex.dim,
  ): void {
    while (this.labels.length <= i)
      this.labels.push(
        this.add
          .text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color,
            stroke: '#0b0607',
            strokeThickness: 3,
          })
          .setOrigin(0.5),
      );
    this.labels[i]
      .setText(s)
      .setPosition(x, y)
      .setColor(color)
      .setVisible(true);
  }

  private icon(
    i: number,
    x: number,
    y: number,
    s: string,
    color: string,
  ): void {
    while (this.iconTexts.length <= i)
      this.iconTexts.push(
        this.add
          .text(0, 0, '', {
            fontFamily: 'Segoe UI Symbol, Georgia, serif',
            fontSize: '15px',
            color,
            stroke: '#0b0607',
            strokeThickness: 3,
          })
          .setOrigin(0.5),
      );
    this.iconTexts[i]
      .setText(s)
      .setPosition(x, y)
      .setColor(color)
      .setVisible(true);
  }

  private draw(h: HudState, dt: number): void {
    const g = this.g;
    g.clear();
    for (const l of this.labels) l.setVisible(false);
    for (const t of this.iconTexts) t.setVisible(false);
    const hud = !h.cinematic;

    // ---------------- vida
    const x0 = 128;
    const y0 = GAME_H - 74;
    const w = 300;
    const ratio = h.maxHp > 0 ? h.hp / h.maxHp : 0;
    this.hpTrail =
      this.hpTrail > ratio ? Math.max(ratio, this.hpTrail - dt / 900) : ratio;
    this.portrait.setVisible(hud);
    this.hpText.setVisible(hud);
    if (hud) {
      g.fillStyle(0x0b0607, 0.85);
      g.fillCircle(70, GAME_H - 76, 46);
      g.lineStyle(3, h.stunned ? 0xff3040 : COLORS.gold, 1);
      g.strokeCircle(70, GAME_H - 76, 46);
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
      this.hpText.setText(`${h.hp} / ${h.maxHp}`).setPosition(x0, y0 - 16);

      // combo
      for (let i = 0; i < 3; i++) {
        const cx = x0 + w - 50 + i * 20;
        const cy = y0 - 14;
        const lit = h.comboActive && i <= h.comboIndex;
        const pts = [
          new Phaser.Geom.Point(cx, cy - 7),
          new Phaser.Geom.Point(cx + 6, cy),
          new Phaser.Geom.Point(cx, cy + 7),
          new Phaser.Geom.Point(cx - 6, cy),
        ];
        g.fillStyle(lit ? (i === 2 ? 0xffd77a : COLORS.gold) : 0x2a1d16, 1);
        g.fillPoints(pts, true);
        g.lineStyle(1, 0x7a5a2a, 1);
        g.strokePoints(pts, true);
      }

      // glória (avatar)
      if (h.avatarUnlocked) {
        g.fillStyle(0x0b0607, 0.85);
        g.fillRect(x0 - 2, y0 + 22, w + 4, 7);
        g.fillStyle(h.glory >= 1 ? 0xfff1b0 : 0xc8a050, 1);
        g.fillRect(x0, y0 + 23, w * h.glory, 5);
      }

      // habilidades: dash (2 cargas), magia, Juízo (Q), Avatar (F)
      let ix = x0 + w + 40;
      const slot = (
        progress: number,
        color: number,
        ready: boolean,
        locked: boolean,
      ): void => {
        const r = 19;
        g.fillStyle(0x0b0607, 0.9);
        g.fillCircle(ix, y0 + 3, r + 3);
        if (locked) {
          g.lineStyle(1.5, 0x3a2c22, 1);
          g.strokeCircle(ix, y0 + 3, r + 3);
          return;
        }
        if (!ready) {
          g.fillStyle(color, 0.35);
          g.slice(
            ix,
            y0 + 3,
            r,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * progress,
            false,
          );
          g.fillPath();
        } else {
          g.fillStyle(color, 0.92);
          g.fillCircle(ix, y0 + 3, r);
        }
        g.lineStyle(2, ready ? COLORS.goldBright : 0x5a4026, 1);
        g.strokeCircle(ix, y0 + 3, r + 3);
      };
      for (let c = 0; c < h.dashMax; c++) {
        const cx = ix - 10 + c * 20;
        const full = c < h.dashCharges;
        g.fillStyle(0x0b0607, 0.9);
        g.fillCircle(cx, y0 + 3, 11);
        if (full) {
          g.fillStyle(0xe8c070, 1);
          g.fillCircle(cx, y0 + 3, 8);
        } else if (c === h.dashCharges) {
          g.fillStyle(0xe8c070, 0.45);
          g.slice(
            cx,
            y0 + 3,
            8,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * h.dashRecharge,
            false,
          );
          g.fillPath();
        }
        g.lineStyle(1.5, full ? COLORS.goldBright : 0x5a4026, 1);
        g.strokeCircle(cx, y0 + 3, 11);
      }
      this.label(0, ix, y0 + 30, 'Espaço');
      ix += 56;
      slot(h.spellProgress, 0xff8a3a, h.spellProgress >= 1, false);
      this.icon(
        0,
        ix,
        y0 + 3,
        '☀',
        h.spellProgress >= 1 ? '#2a1205' : '#e8d0a0',
      );
      this.label(1, ix, y0 + 30, 'Botão dir.');
      ix += 52;
      slot(h.sunProgress, 0xfff1b0, h.sunProgress >= 1, !h.sunUnlocked);
      this.icon(
        1,
        ix,
        y0 + 3,
        '✷',
        h.sunUnlocked
          ? h.sunProgress >= 1
            ? '#3a2a08'
            : '#e8d0a0'
          : '#4a3a2a',
      );
      this.label(
        2,
        ix,
        y0 + 30,
        'Q',
        h.sunUnlocked ? COLORS.hex.dim : '#4a3a2a',
      );
      ix += 52;
      slot(h.glory, 0xf5e6ff, h.glory >= 1, !h.avatarUnlocked);
      this.icon(
        2,
        ix,
        y0 + 3,
        '❂',
        h.avatarUnlocked ? (h.glory >= 1 ? '#3a2a40' : '#e8d0a0') : '#4a3a2a',
      );
      this.label(
        3,
        ix,
        y0 + 30,
        'F',
        h.avatarUnlocked ? COLORS.hex.dim : '#4a3a2a',
      );

      const all = [
        ...h.blessings.map((b) => ({ glyph: b.glyph, color: b.color })),
        ...h.gifts,
      ];
      all.forEach((b, i) => {
        const cx = x0 + 10 + i * 28;
        const cy = y0 - 42;
        g.fillStyle(0x0b0607, 0.85);
        g.fillCircle(cx, cy, 11);
        g.lineStyle(1.5, b.color, 1);
        g.strokeCircle(cx, cy, 11);
        this.icon(
          3 + i,
          cx,
          cy,
          b.glyph,
          '#' + b.color.toString(16).padStart(6, '0'),
        );
      });
    }

    // ---------------- sangue: exposição e dominação
    const showBlood = hud && (h.stunned || h.exposure > 0.05);
    this.stunText.setVisible(showBlood);
    if (h.stunned)
      this.stunText
        .setText('DOMINADO PELO SANGUE')
        .setColor('#ff4050')
        .setAlpha(0.7 + 0.3 * Math.sin(this.time.now / 80));
    else if (h.exposure > 0.05)
      this.stunText
        .setText(`Exposição ao sangue ${Math.round(h.exposure * 100)}%`)
        .setColor('#ff8a90')
        .setAlpha(0.95);
    if (showBlood && !h.stunned) {
      g.fillStyle(0x200004, 0.8);
      g.fillRect(GAME_W / 2 - 100, GAME_H - 132, 200, 6);
      g.fillStyle(h.exposure > 0.7 ? 0xff3040 : 0xc0101a, 1);
      g.fillRect(GAME_W / 2 - 100, GAME_H - 132, 200 * h.exposure, 6);
    }

    // ---------------- topo
    this.roomText.setText(hud ? h.roomLabel : '');
    this.enemyText.setText(
      hud && h.phase === 'combat'
        ? `Inimigos: ${h.enemies}`
        : hud && h.phase === 'boss' && h.enemies > 0
          ? `Invocações: ${h.enemies}`
          : '',
    );
    this.enemyText.setY(h.boss ? 116 : 36);
    this.timeText.setText(formatTime(h.timeMs));

    // ---------------- chefe
    const b = h.boss;
    this.bossName.setVisible(!!b && hud);
    this.bossTitle.setVisible(!!b && hud);
    if (b && hud) {
      const bw = 560;
      const bx = GAME_W / 2 - bw / 2;
      const by = 92;
      this.bossTrail =
        this.bossTrail > b.ratio
          ? Math.max(b.ratio, this.bossTrail - dt / 1100)
          : b.ratio;
      g.fillStyle(0x0b0607, 0.88);
      g.fillRect(bx - 5, by - 5, bw + 10, 20);
      g.fillStyle(0x2a0809, 1);
      g.fillRect(bx, by, bw, 10);
      g.fillStyle(0xffc080, 0.7);
      g.fillRect(bx, by, bw * this.bossTrail, 10);
      g.fillStyle(b.phase === 2 ? 0xe0501f : 0xa01c22, 1);
      g.fillRect(bx, by, bw * b.ratio, 10);
      g.lineStyle(1.5, COLORS.gold, 1);
      g.strokeRect(bx - 5, by - 5, bw + 10, 20);
      g.lineStyle(2, COLORS.goldBright, 0.9);
      g.lineBetween(bx + bw / 2, by - 6, bx + bw / 2, by + 16);
      this.bossName
        .setText(b.name.toUpperCase())
        .setPosition(GAME_W / 2, by - 20);
      this.bossTitle.setText(b.title).setPosition(GAME_W / 2, by - 6);
    }

    // ---------------- tutorial compacto e recolhível (H)
    const tut = h.tutorial;
    this.tutorialText.setVisible(!!tut && hud);
    if (tut && hud) {
      const ck = (v: boolean): string => (v ? '✓' : '○');
      this.tutorialText.setText(
        this.tutorialCollapsed
          ? 'Treinamento  [H] expandir'
          : [
              'TREINAMENTO  [H] recolher',
              `${ck(tut.moved)} WASD mover`,
              `${ck(tut.attacked)} Clique: combo de 3 golpes`,
              `${ck(tut.dashed)} Espaço: dash (2 cargas)`,
              `${ck(tut.cast)} Botão dir.: Chama do Julgamento`,
              'Golpeie os bonecos · E no altar inicia',
            ].join('\n'),
      );
      const tb = this.tutorialText.getBounds();
      g.fillStyle(0x0b0607, 0.62);
      g.fillRect(tb.x - 10, tb.y - 8, tb.width + 20, tb.height + 16);
      g.lineStyle(1, 0x7a5a2a, 0.8);
      g.strokeRect(tb.x - 10, tb.y - 8, tb.width + 20, tb.height + 16);
    }
    this.hintText.setVisible(!tut && hud);
    this.skipText.setVisible(h.canSkip);
  }

  private fillInfo(h: HudState): void {
    const s = h.stats;
    const lines: string[] = [];
    lines.push(
      `Vida ${h.hp}/${h.maxHp}    Velocidade ${Math.round(s.moveSpeed)}    Dano ×${s.damageMul.toFixed(2)}    Tempo ${formatTime(h.timeMs)}`,
    );
    lines.push(
      `Dash: ${h.dashCharges}/${h.dashMax} cargas · recarga ×${s.dashCooldownMul.toFixed(2)}    Resistência ${Math.round(s.resist * 100)}%`,
    );
    lines.push('');
    lines.push(
      'BUILD · Clique: combo · Segure/solte: Sentença · R: Sol Cativo',
    );
    if (h.gifts.length === 0)
      lines.push('  Nenhum. Escolha portas com ☀ para recebê-los.');
    for (const g of h.gifts) lines.push(`  ${g.glyph}  ${g.name}`);
    lines.push('');
    lines.push(`BUFF DO ALTAR: ${h.buff || 'nenhum'}`);
    lines.push(h.details);
    lines.push('BÊNÇÃOS');
    if (h.blessings.length === 0) lines.push('  Nenhuma ainda.');
    for (const b of h.blessings)
      lines.push(`  ${b.glyph}  ${b.name} — ${b.description}`);
    lines.push('');
    lines.push(
      'Sangue de Caim: permanecer na poça enche a exposição e domina Atriox.',
    );
    lines.push('O dash atravessa a poça sem acumular exposição.');
    this.infoText.setText(lines.join('\n'));
  }

  // ---------------------------------------------------------------- chamadas da arena
  /** Título da sala: aparece no topo e some rapidamente. */
  roomTitle(name: string, sub: string): void {
    this.clearAnnouncements();
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setAlpha(0);
    const t = this.add
      .text(GAME_W / 2, 64, name.toUpperCase(), {
        fontFamily: FONT_TITLE,
        fontSize: '30px',
        color: COLORS.hex.gold,
        stroke: '#0b0607',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const s = this.add
      .text(GAME_W / 2, 94, sub, {
        fontFamily: FONT_UI,
        fontSize: '15px',
        fontStyle: 'italic',
        color: COLORS.hex.ivory,
        stroke: '#0b0607',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.announcements.push(t, s);
    this.tweens.add({ targets: [t, s], alpha: 1, duration: 300 });
    this.tweens.add({
      targets: [t, s],
      alpha: 0,
      delay: 1700,
      duration: 500,
      onComplete: () => [t, s].forEach((o) => o.destroy()),
    });
  }

  toast(msg: string): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(msg).setAlpha(0);
    this.tweens.add({ targets: this.toastText, alpha: 1, duration: 200 });
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      delay: 2600,
      duration: 500,
    });
  }

  /** Banner de evento: no terço superior, curto, em fila. */
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
    const y = 150;
    const t = this.add
      .text(GAME_W / 2, y, b.title.toUpperCase(), {
        fontFamily: FONT_TITLE,
        fontSize: '28px',
        color: hex,
        stroke: '#0b0607',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const s = this.add
      .text(GAME_W / 2, y + 22, b.sub, {
        fontFamily: FONT_UI,
        fontSize: '15px',
        fontStyle: 'italic',
        color: COLORS.hex.ivory,
        stroke: '#0b0607',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: 720 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    const all = [t, s];
    this.announcements.push(...all);
    this.tweens.add({ targets: all, alpha: 1, duration: 220 });
    this.tweens.add({
      targets: all,
      alpha: 0,
      delay: 1700,
      duration: 380,
      onComplete: () => {
        all.forEach((x) => x.destroy());
        this.nextBanner();
      },
    });
  }

  bossIntro(name: string, title: string): void {
    this.clearAnnouncements();
    const bar = this.add
      .rectangle(0, 150, GAME_W, 96, 0x000000, 0.6)
      .setOrigin(0, 0.5)
      .setAlpha(0);
    const n = this.add
      .text(GAME_W / 2, 136, name.toUpperCase(), {
        fontFamily: FONT_TITLE,
        fontSize: '40px',
        color: '#e8d8b8',
        stroke: '#0b0607',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const t = this.add
      .text(GAME_W / 2, 176, title, {
        fontFamily: FONT_UI,
        fontSize: '17px',
        fontStyle: 'italic',
        color: '#d0473a',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const all = [bar, n, t];
    this.announcements.push(...all);
    this.tweens.add({ targets: all, alpha: 1, duration: 300 });
    this.tweens.add({
      targets: n,
      x: { from: GAME_W / 2 - 30, to: GAME_W / 2 },
      duration: 1600,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: all,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => all.forEach((x) => x.destroy()),
    });
  }

  /** Citação da cena final. */
  quote(text: string): void {
    const q = this.add
      .text(GAME_W / 2, GAME_H - 110, `“${text}”`, {
        fontFamily: FONT_TITLE,
        fontSize: '26px',
        fontStyle: 'italic',
        color: '#fff1c8',
        stroke: '#0b0607',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: q, alpha: 1, duration: 900 });
    this.tweens.add({
      targets: q,
      alpha: 0,
      delay: 5200,
      duration: 900,
      onComplete: () => q.destroy(),
    });
  }

  damagePulse(): void {
    this.damageOverlay.setAlpha(flashAllowed() ? 0.26 : 0.08);
    this.tweens.killTweensOf(this.damageOverlay);
    this.tweens.add({ targets: this.damageOverlay, alpha: 0, duration: 380 });
  }

  private clearAnnouncements(): void {
    for (const o of this.announcements) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.announcements = [];
    this.bannerQueue = [];
    this.bannerBusy = false;
  }
}
