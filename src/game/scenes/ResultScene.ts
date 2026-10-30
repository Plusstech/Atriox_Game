import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { formatTime, makeButton, ornament } from '../ui/widgets';
import { save } from '../services';
import type { RunResult } from './ArenaScene';

/** Tela de vitória ou derrota. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(r: RunResult): void {
    const rec = save.data.records;
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x070405).setOrigin(0);
    const glow = this.add.image(GAME_W / 2, GAME_H / 2 - 60, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(r.victory ? 0xe8b24a : 0x8e1b1f).setAlpha(0.35);
    glow.setDisplaySize(900, 600);
    this.add
      .particles(0, 0, 'p_ember', {
        x: { min: 0, max: GAME_W },
        y: GAME_H + 10,
        speedY: { min: -80, max: -30 },
        lifespan: 7000,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: r.victory ? [0xffd77a, 0xff9b3d] : [0xd0473a, 0x6a1a1a],
        blendMode: 'ADD',
        frequency: 120
      });

    const pose = r.victory ? 'atriox_slash' : 'atriox_hurt';
    if (this.textures.exists(pose)) {
      const img = this.add.image(GAME_W - 250, GAME_H - 40, pose).setOrigin(0.5, 1).setScale(1.6).setAlpha(0);
      if (!r.victory) img.setTint(0x9a8a8a);
      this.tweens.add({ targets: img, alpha: 0.95, duration: 900 });
    }

    const title = r.victory ? 'PROVAÇÃO SUPERADA' : 'ATRIOX CAIU';
    const sub = r.victory ? 'Caim Morvaigne caiu na Arena de Nemeia.' : `Atriox caiu em: ${r.roomName}. A lâmina volta a se erguer.`;
    this.add.text(110, 120, title, { fontFamily: FONT_TITLE, fontSize: '50px', color: r.victory ? COLORS.hex.gold : COLORS.hex.red, stroke: '#0b0607', strokeThickness: 6 });
    this.add.text(112, 186, sub, { fontFamily: FONT_UI, fontSize: '19px', fontStyle: 'italic', color: COLORS.hex.ivory });
    ornament(this, 360, 226, 500);

    const lines = [
      `Tempo:  ${formatTime(r.timeMs)}${r.newBest ? '   ✦ novo recorde' : ''}`,
      `Sala alcançada:  ${r.roomName}`,
      ...(r.endlessWave?[`Eternidade: onda ${r.endlessWave} · recorde ${rec.eternityBest}`]:[]),
      `Inimigos derrotados:  ${r.kills}`,
      `Bênçãos e dons:  ${r.blessings.length ? r.blessings.join(', ') : '—'}`,
      '',
      `Tentativas:  ${rec.attempts}     Vitórias:  ${rec.bossVictories}`,
      `Melhor tempo:  ${rec.bestTime !== null ? formatTime(rec.bestTime) : '—'}`
    ];
    if (r.victory) lines.push('', r.gloryGranted === false ? 'Bênção da Glória: já concedida em uma vitória anterior.' : 'Bênção da Glória concedida: o dash purifica o sangue nas próximas partidas.');
    this.add.text(112, 252, lines.join('\n'), { fontFamily: FONT_UI, fontSize: '18px', color: '#d9c8a6', lineSpacing: 8, wordWrap: { width: 640 } });

    makeButton(this, 260, GAME_H - 110, 'Nova tentativa  (Enter)', () => this.restart());
    makeButton(this, 260, GAME_H - 54, 'Menu principal  (M)', () => this.scene.start('MenuScene'));
    this.input.keyboard!.once('keydown-ENTER', () => this.restart());
    this.input.keyboard!.once('keydown-M', () => this.scene.start('MenuScene'));
  }

  private restart(): void {
    this.scene.start('ArenaScene');
  }
}
