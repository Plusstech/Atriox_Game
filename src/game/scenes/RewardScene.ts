import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { getBlessing } from '../../data/blessings';
import { ornament } from '../ui/widgets';
import { Sfx } from '../audio/Sfx';

interface RewardData {
  offer: string[];
  onChoose: (id: string) => void;
}

/** Escolha de 1 entre 3 bênçãos (mouse ou teclas 1/2/3). A arena fica pausada. */
export class RewardScene extends Phaser.Scene {
  private chosen = false;
  private data0!: RewardData;

  constructor() {
    super('RewardScene');
  }

  create(data: RewardData): void {
    this.data0 = data;
    this.chosen = false;
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x050203, 0.78).setOrigin(0).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 250 });
    this.add.text(GAME_W / 2, 92, 'ESCOLHA UMA BÊNÇÃO', { fontFamily: FONT_TITLE, fontSize: '36px', color: COLORS.hex.gold, stroke: '#0b0607', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 132, 'A brasa da provação responde à sua vontade.', { fontFamily: FONT_UI, fontSize: '16px', fontStyle: 'italic', color: COLORS.hex.dim }).setOrigin(0.5);
    ornament(this, GAME_W / 2, 112, 520);

    const defs = data.offer.map((id) => getBlessing(id)).filter((b) => !!b);
    const cw = 320;
    const ch = 380;
    const gap = 34;
    const total = defs.length * cw + (defs.length - 1) * gap;
    defs.forEach((b, i) => {
      const x = GAME_W / 2 - total / 2 + cw / 2 + i * (cw + gap);
      const y = GAME_H / 2 + 50;
      const bg = this.add.graphics();
      const hex = '#' + b.color.toString(16).padStart(6, '0');
      const draw = (hover: boolean): void => {
        bg.clear();
        bg.fillStyle(hover ? 0x22140f : 0x140b09, 0.96);
        bg.fillRect(-cw / 2, -ch / 2, cw, ch);
        bg.lineStyle(hover ? 3 : 1.5, hover ? b.color : 0x7a5a2a, 1);
        bg.strokeRect(-cw / 2, -ch / 2, cw, ch);
        bg.lineStyle(1, b.color, 0.35);
        bg.strokeRect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16);
        bg.fillStyle(b.color, hover ? 0.3 : 0.16);
        bg.fillCircle(0, -ch / 2 + 92, 52);
        bg.lineStyle(2, b.color, 1);
        bg.strokeCircle(0, -ch / 2 + 92, 52);
      };
      draw(false);
      const glyph = this.add.text(0, -ch / 2 + 92, b.glyph, { fontFamily: 'Segoe UI Symbol, Georgia, serif', fontSize: '46px', color: hex }).setOrigin(0.5);
      const name = this.add.text(0, -ch / 2 + 176, b.name, { fontFamily: FONT_TITLE, fontSize: '24px', color: COLORS.hex.ivory, align: 'center', wordWrap: { width: cw - 40 } }).setOrigin(0.5, 0);
      const desc = this.add
        .text(0, -ch / 2 + 226, b.description, { fontFamily: FONT_UI, fontSize: '16px', color: '#cdbb9a', align: 'center', wordWrap: { width: cw - 50 }, lineSpacing: 4 })
        .setOrigin(0.5, 0);
      const key = this.add.text(0, ch / 2 - 30, `[${i + 1}]`, { fontFamily: FONT_UI, fontSize: '15px', color: COLORS.hex.dim }).setOrigin(0.5);
      const card = this.add.container(x, y + 40, [bg, glyph, name, desc, key]).setAlpha(0);
      card.setSize(cw, ch);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => {
        draw(true);
        Sfx.uiMove();
        this.tweens.add({ targets: card, scale: 1.04, duration: 120 });
      });
      card.on('pointerout', () => {
        draw(false);
        this.tweens.add({ targets: card, scale: 1, duration: 120 });
      });
      card.on('pointerdown', () => this.choose(b.id, card));
      this.tweens.add({ targets: card, alpha: 1, y, duration: 320, delay: 120 + i * 90, ease: 'Cubic.easeOut' });
      this.input.keyboard!.on(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => this.choose(b.id, card));
    });
  }

  private choose(id: string, card: Phaser.GameObjects.Container): void {
    if (this.chosen) return;
    this.chosen = true;
    Sfx.uiConfirm();
    this.tweens.add({
      targets: card,
      scale: 1.12,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.scene.resume('ArenaScene');
        this.data0.onChoose(id);
        this.scene.stop();
      }
    });
  }
}
