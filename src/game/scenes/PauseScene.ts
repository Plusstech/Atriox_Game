import Phaser from 'phaser';
import { COLORS, FONT_TITLE, GAME_H, GAME_W } from '../config/constants';
import { makeButton, makeOptions, ornament } from '../ui/widgets';

/** Pausa (Esc) com opções de acessibilidade e áudio. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x050203, 0.8).setOrigin(0);
    this.add.text(GAME_W / 2, 70, 'PAUSA', { fontFamily: FONT_TITLE, fontSize: '40px', color: COLORS.hex.gold }).setOrigin(0.5);
    ornament(this, GAME_W / 2, 104, 360);
    makeButton(this, GAME_W / 2, 150, 'Continuar  (Esc)', () => this.resume());
    makeOptions(this, GAME_W / 2, 220, 48);
    makeButton(this, GAME_W / 2, 540, 'Reiniciar provação', () => {
      this.scene.stop('UIScene');
      this.scene.stop();
      this.scene.start('ArenaScene');
    });
    makeButton(this, GAME_W / 2, 596, 'Abandonar e voltar ao menu', () => {
      this.scene.stop('UIScene');
      this.scene.stop('ArenaScene');
      this.scene.start('MenuScene');
    });
    this.input.keyboard!.once('keydown-ESC', () => this.resume());
  }

  private resume(): void {
    this.scene.resume('ArenaScene');
    this.scene.stop();
  }
}
