import Phaser from 'phaser';
import { makeButton } from '../ui/widgets';
import type { ArenaScene } from './ArenaScene';
/** The arena stays alive beneath this choice, preserving the entire campaign build. */
export class VictoryChoiceScene extends Phaser.Scene {
  constructor() {
    super('VictoryChoiceScene');
  }
  create(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x080508, 0.94);
    this.add
      .text(640, 210, 'A PROVAÇÃO FOI SUPERADA', {
        fontFamily: 'Georgia',
        fontSize: '36px',
        color: '#ffd77a',
      })
      .setOrigin(0.5);
    this.add
      .text(640, 280, 'A bênção permanece. Até onde sua lâmina chegará?', {
        fontFamily: 'Georgia',
        fontSize: '19px',
        color: '#e1d2b8',
      })
      .setOrigin(0.5);
    let chosen = false;
    const choose = (endless: boolean): void => {
      if (chosen) return;
      chosen = true;
      const a = this.scene.get('ArenaScene') as ArenaScene;
      this.scene.resume('ArenaScene');
      this.scene.stop();
      if (endless) a.startEndless();
      else a.finishCampaign();
    };
    makeButton(
      this,
      640,
      390,
      'Provação da Eternidade (I)',
      () => choose(true),
      { width: 420 },
    );
    makeButton(
      this,
      640,
      465,
      'Encerrar com vitória (Enter)',
      () => choose(false),
      { width: 420 },
    );
    this.input.keyboard!.once('keydown-I', () => choose(true));
    this.input.keyboard!.once('keydown-ENTER', () => choose(false));
  }
}
