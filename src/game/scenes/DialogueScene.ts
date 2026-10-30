import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { DialogueState, SPEAKERS, type DialogueLine } from '../../data/dialogues';
import { Sfx } from '../audio/Sfx';

export interface DialogueData {
  lines: DialogueLine[];
  onDone: () => void;
}

const BOX = { x: 40, y: GAME_H - 200, w: GAME_W - 80, h: 172 };
const TEXT_X = 330;
const TEXT_W = GAME_W - 2 * TEXT_X;
/** Ignora confirmações logo ao abrir (a tecla que levou até aqui não pula a 1ª fala). */
const OPEN_GUARD_MS = 260;

/**
 * Conversa pré-chefe estilo RPG antigo. A ArenaScene fica PAUSADA enquanto esta
 * cena está ativa: combate, IA e perigos congelados. A caixa ocupa só a faixa
 * inferior; retratos nas laterais (Atriox à esquerda, o chefe à direita).
 */
export class DialogueScene extends Phaser.Scene {
  private state!: DialogueState;
  private onDone: () => void = () => undefined;
  private finished = false;
  private openedAt = 0;
  private portraits: Partial<Record<'left' | 'right', Phaser.GameObjects.Image>> = {};
  private nameText!: Phaser.GameObjects.Text;
  private namePlate!: Phaser.GameObjects.Rectangle;
  private bodyText!: Phaser.GameObjects.Text;
  private more!: Phaser.GameObjects.Text;

  constructor() {
    super('DialogueScene');
  }

  init(data: DialogueData): void {
    this.state = new DialogueState(data.lines ?? []);
    this.onDone = data.onDone ?? (() => undefined);
    this.finished = false;
    this.portraits = {};
  }

  create(): void {
    this.scene.bringToTop();
    this.openedAt = this.time.now;
    // escurece só a faixa inferior: a arena continua visível em cima
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75);
    shade.fillRect(0, GAME_H - 330, GAME_W, 330);

    // retratos (os dois lados ficam visíveis; quem fala ganha destaque)
    const sides = new Set(this.state.lines.map((l) => SPEAKERS[l.speaker].side));
    for (const side of sides) {
      const who = this.state.lines.find((l) => SPEAKERS[l.speaker].side === side)!.speaker;
      const key = `portrait_${SPEAKERS[who].portraits[0]}`;
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(side === 'left' ? 30 : GAME_W - 30, GAME_H - 28, key).setOrigin(side === 'left' ? 0 : 1, 1);
      img.setScale(Math.min(1, 330 / img.height));
      // retratos voltados para o centro
      if (side === 'right' && who !== 'carrasco') img.setFlipX(true);
      this.portraits[side] = img;
    }

    const g = this.add.graphics();
    g.fillStyle(0x0d0809, 0.92);
    g.fillRoundedRect(BOX.x, BOX.y, BOX.w, BOX.h, 10);
    g.lineStyle(2, COLORS.gold, 0.85);
    g.strokeRoundedRect(BOX.x, BOX.y, BOX.w, BOX.h, 10);
    g.lineStyle(1, COLORS.gold, 0.3);
    g.strokeRoundedRect(BOX.x + 6, BOX.y + 6, BOX.w - 12, BOX.h - 12, 7);

    this.namePlate = this.add.rectangle(0, BOX.y - 2, 10, 34, 0x0d0809, 0.96).setStrokeStyle(2, COLORS.gold, 0.85);
    this.nameText = this.add.text(0, BOX.y - 2, '', { fontFamily: FONT_TITLE, fontSize: '20px', color: COLORS.hex.goldBright }).setOrigin(0.5);
    this.bodyText = this.add.text(TEXT_X, BOX.y + 34, '', {
      fontFamily: FONT_UI,
      fontSize: '23px',
      color: COLORS.hex.ivory,
      lineSpacing: 6,
      wordWrap: { width: TEXT_W, useAdvancedWrap: true }
    });
    this.more = this.add.text(GAME_W - TEXT_X, BOX.y + BOX.h - 26, '▼', { fontFamily: FONT_UI, fontSize: '16px', color: COLORS.hex.gold }).setOrigin(1, 0.5);
    this.tweens.add({ targets: this.more, alpha: 0.2, duration: 420, yoyo: true, repeat: -1 });
    this.add
      .text(BOX.x + BOX.w - 14, BOX.y + BOX.h - 12, 'Enter / Espaço / clique: continuar', { fontFamily: FONT_UI, fontSize: '13px', color: COLORS.hex.dim })
      .setOrigin(1, 1)
      .setAlpha(0.8);
    const skip = this.add
      .text(GAME_W - 24, 22, 'Pular conversa  (Esc)', { fontFamily: FONT_UI, fontSize: '16px', color: COLORS.hex.ivory, backgroundColor: '#140c0dcc', padding: { x: 10, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.finish(true);
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', this.confirm, this);
    kb.on('keydown-SPACE', this.confirm, this);
    kb.on('keydown-E', this.confirm, this);
    kb.on('keydown-ESC', this.skipAll, this);
    this.input.on('pointerdown', this.confirm, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown-ENTER', this.confirm, this);
      kb.off('keydown-SPACE', this.confirm, this);
      kb.off('keydown-E', this.confirm, this);
      kb.off('keydown-ESC', this.skipAll, this);
      this.input.off('pointerdown', this.confirm, this);
    });

    // testes automatizados podem dispensar todas as conversas
    if ((window as unknown as { __ATRIOX_SKIP_DIALOGUE__?: boolean }).__ATRIOX_SKIP_DIALOGUE__) {
      this.time.delayedCall(0, () => this.finish(true));
      return;
    }
    this.refresh();
  }

  update(_t: number, dt: number): void {
    if (this.finished) return;
    // delta limitado: um quadro lento não revela a fala inteira de uma vez
    if (this.state.tick(Math.min(dt, 50)) > 0) Sfx.blip();
    this.bodyText.setText(this.state.visibleText);
    this.more.setVisible(this.state.complete);
  }

  private confirm(): void {
    if (this.finished || this.time.now - this.openedAt < OPEN_GUARD_MS) return;
    const r = this.state.confirm();
    if (r === 'end') this.finish(false);
    else {
      if (r === 'next') Sfx.uiMove();
      this.refresh();
    }
  }

  /** Destaca quem fala: nome, lado do nome e brilho do retrato. */
  private refresh(): void {
    const line = this.state.line;
    if (!line) return;
    const info = SPEAKERS[line.speaker];
    this.nameText.setText(info.name).setColor(info.color);
    const w = this.nameText.width + 36;
    const x = info.side === 'left' ? TEXT_X + w / 2 - 10 : GAME_W - TEXT_X - w / 2 + 10;
    this.nameText.setX(x);
    this.namePlate.setX(x).setSize(w, 34);
    this.namePlate.setOrigin(0.5);
    for (const side of ['left', 'right'] as const) {
      const img = this.portraits[side];
      if (!img) continue;
      const active = side === info.side;
      if (active) {
        const key = `portrait_${line.portrait ?? info.portraits[0]}`;
        if (this.textures.exists(key) && img.texture.key !== key) img.setTexture(key);
        img.clearTint().setAlpha(1);
      } else img.setTint(0x6a6a6a).setAlpha(0.75);
      this.tweens.add({ targets: img, y: GAME_H - (active ? 34 : 22), duration: 160, ease: 'Sine.easeOut' });
    }
    this.bodyText.setText('');
  }

  private skipAll(): void {
    this.finish(true);
  }

  private finish(skipped: boolean): void {
    if (this.finished) return;
    this.finished = true;
    if (skipped) this.state.skip();
    Sfx.uiConfirm();
    const done = this.onDone;
    this.scene.stop();
    done();
  }
}
