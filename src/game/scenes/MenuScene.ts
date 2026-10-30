import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { formatTime, makeButton, makeOptions, ornament } from '../ui/widgets';
import { DEV_TOOLS } from '../config/constants';
import { save } from '../services';
import { Sfx } from '../audio/Sfx';

/** Menu principal. */
export class MenuScene extends Phaser.Scene {
  private page: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.page = [];
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x080506).setOrigin(0);

    // fundo: brilho, brasas e Atriox
    const glow = this.add.image(GAME_W - 330, GAME_H / 2 + 40, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9b3d).setAlpha(0.35);
    glow.setDisplaySize(900, 800);
    this.tweens.add({ targets: glow, alpha: 0.45, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.particles(0, 0, 'p_ember', {
      x: { min: 0, max: GAME_W },
      y: GAME_H + 10,
      speedY: { min: -90, max: -30 },
      speedX: { min: -10, max: 25 },
      lifespan: 8000,
      scale: { start: 1.3, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffd77a, 0xff9b3d, 0xff6a20],
      blendMode: 'ADD',
      frequency: 70
    });
    if (this.textures.exists('atriox_idle')) {
      const hero = this.add.image(GAME_W - 320, GAME_H + 20, 'atriox_idle').setOrigin(0.5, 1).setScale(2.55).setFlipX(true).setAlpha(0);
      this.tweens.add({ targets: hero, alpha: 1, duration: 1200 });
      this.tweens.add({ targets: hero, scaleY: 2.58, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(GAME_W, GAME_H);

    this.add.text(96, 104, 'ATRIOX CINDER', { fontFamily: FONT_TITLE, fontSize: '68px', color: COLORS.hex.gold, stroke: '#0b0607', strokeThickness: 8 });
    this.add.text(100, 184, 'Lâmina sem Deus', { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: 'italic', color: COLORS.hex.ivory, stroke: '#0b0607', strokeThickness: 5 });
    ornament(this, 330, 236, 470);
    this.add.text(100, 250, 'v0.3 — Do Campo de Provação à Arena de Nemeia', { fontFamily: FONT_UI, fontSize: '15px', color: COLORS.hex.dim });

    this.showMain();

    const missing = (this.registry.get('missingAssets') as string[] | undefined) ?? [];
    if (missing.length) {
      this.add.text(16, GAME_H - 20, `Aviso: ${missing.length} asset(s) ausente(s) — usando substitutos procedurais. Veja o console.`, {
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: '#d0473a'
      }).setOrigin(0, 1);
    }
    if (save.lastError) console.warn('[save]', save.lastError);

    this.input.keyboard!.on('keydown-ENTER', this.start, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard!.off('keydown-ENTER', this.start, this));
    this.input.once('pointerdown', () => Sfx.unlock());
  }

  private clearPage(): void {
    this.page.forEach((o) => o.destroy());
    this.page = [];
  }

  private showMain(): void {
    this.clearPage();
    const x = 260;
    this.page.push(makeButton(this, x, 330, 'Iniciar Provação  (Enter)', () => this.start()).container);
    this.page.push(makeButton(this, x, 388, 'Opções', () => this.showOptions()).container);
    this.page.push(makeButton(this, x, 446, 'Controles', () => this.showControls()).container);
    if (DEV_TOOLS) this.page.push(makeButton(this, x + 330, 446, 'Inspetor de animações', () => this.scene.start('AnimInspectorScene'), { width: 280, size: 16 }).container);
    const r = save.data.records;
    this.page.push(
      this.add.text(
        x - 150,
        500,
        `Tentativas: ${r.attempts}    Vitórias: ${r.bossVictories}\nMaior sala: ${r.highestWave} · Eternidade: ${r.eternityBest}    Melhor tempo: ${r.bestTime !== null ? formatTime(r.bestTime) : '—'}${save.volatile ? '\n(armazenamento local indisponível: progresso não será salvo)' : ''}`,
        { fontFamily: FONT_UI, fontSize: '14px', color: COLORS.hex.dim, lineSpacing: 6 }
      )
    );
  }

  private showOptions(): void {
    this.clearPage();
    this.page.push(...makeOptions(this, 290, 310, 50));
    this.page.push(makeButton(this, 290, 310 + 6 * 50 + 10, 'Voltar', () => this.showMain()).container);
  }

  private showControls(): void {
    this.clearPage();
    const rows = [
      ['WASD', 'Mover'],
      ['Mouse', 'Mirar'],
      ['Clique esquerdo', 'Combo de 3 golpes'],
      ['Clique direito', 'Chama do Julgamento'],
      ['Espaço / Shift', 'Dash (2 cargas)'],
      ['Q', 'Juízo do Segundo Sol (dom de porta ☀)'],
      ['F', 'Avatar de Apollon (dom de porta ☀)'],
      ['H', 'Recolher tutorial'],
      ['E', 'Interagir (altar, portas, recompensa)'],
      ['Tab (segurar)', 'Informações e bênçãos'],
      ['Esc', 'Pausar']
    ];
    this.page.push(
      this.add.text(110, 300, rows.map(([k, v]) => `${k.padEnd(18, ' ')}${v}`).join('\n'), {
        fontFamily: 'Consolas, monospace',
        fontSize: '17px',
        color: COLORS.hex.ivory,
        lineSpacing: 9
      })
    );
    this.page.push(makeButton(this, 260, 620, 'Voltar', () => this.showMain()).container);
  }

  private start(): void {
    Sfx.unlock();
    const s = save.data.settings;
    Sfx.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('ArenaScene'));
  }
}
