import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { APOLLON_BLESSINGS, BRASA, SELUN, blessingDef, type ApollonBlessingId } from '../../data/selun';
import { APOLLON_LINES } from '../../data/dialogues';
import { save } from '../services';
import { Sfx } from '../audio/Sfx';
import { makeButton } from '../ui/widgets';

type Stage = 'over' | 'apollon' | 'choice' | 'refuge';

const fmt = (ms: number): string => {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Depois de uma derrota para Sêlun: GAME OVER (pesado, nunca uma tela de vitória) →
 * resumo de feitos → Apollon → escolha de UMA bênção (ou a Brasa) → refúgio.
 * Tudo que concede prêmio vem de `save.data.selun.pending` (gravado na morte):
 * recarregar reabre a MESMA escolha; confirmar fecha a etapa na mesma gravação.
 */
export class SelunAftermathScene extends Phaser.Scene {
  private stage: Stage = 'over';
  private layer!: Phaser.GameObjects.Container;
  private selected = 0;
  private result = '';
  private readyAt = 0;

  constructor() {
    super('SelunAftermathScene');
  }

  init(data?: { resume?: boolean }): void {
    this.selected = 0;
    this.result = '';
    this.stage = data?.resume && save.data.selun.pending ? 'choice' : 'over';
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#050304');
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', this.advance, this);
    kb.on('keydown-SPACE', this.advance, this);
    kb.on('keydown-E', this.advance, this);
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-ONE', () => this.pick(0));
    kb.on('keydown-TWO', () => this.pick(1));
    kb.on('keydown-THREE', () => this.pick(2));
    this.input.on('pointerdown', () => {
      if (this.stage === 'over' || this.stage === 'apollon') this.advance();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners();
      this.input.removeAllListeners('pointerdown');
    });
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.render();
  }

  private clear(): void {
    this.layer.removeAll(true);
    this.readyAt = this.time.now + 700;
  }

  private text(x: number, y: number, s: string, size: number, color: string, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, { fontFamily: FONT_UI, fontSize: `${size}px`, color, align: 'center', ...opts }).setOrigin(0.5);
    this.layer.add(t);
    return t;
  }

  private render(): void {
    this.clear();
    const pending = save.data.selun.pending;
    if (this.stage === 'over') this.renderOver(pending);
    else if (this.stage === 'apollon') this.renderApollon(pending?.firstDefeat ?? false);
    else if (this.stage === 'choice') this.renderChoice();
    else this.renderRefuge();
  }

  // ------------------------------------------------------------------ GAME OVER
  private renderOver(pending: typeof save.data.selun.pending): void {
    Sfx.defeat();
    const title = this.text(GAME_W / 2, 150, 'GAME OVER', 96, '#c9c2b6', { fontFamily: FONT_TITLE, stroke: '#000000', strokeThickness: 10 });
    title.setAlpha(0).setScale(1.15);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 1400, ease: 'Cubic.easeOut' });
    this.text(GAME_W / 2, 232, 'SÊLUN — O FIM DO INFINITO', 24, '#ffb35a', { fontFamily: FONT_TITLE });
    const f = pending?.feats;
    const r = save.data.selun.records;
    const lines = f
      ? [
          `Tempo sobrevivido   ${fmt(f.activeMs)}   (recorde ${fmt(r.bestActiveMs)})`,
          `Fase alcançada   ${f.phase}/3   (recorde ${r.bestPhase})`,
          `Quebras de postura   ${f.breaks}   (recorde ${r.bestBreaks})`,
          `Recomposições forçadas   ${f.recompositions}   (recorde ${r.bestRecompositions})`,
          `Esquivas perfeitas   ${f.perfectDodges}   (recorde ${r.bestPerfectDodges})`
        ]
      : ['A tentativa terminou.'];
    lines.forEach((l, i) => this.text(GAME_W / 2, 310 + i * 40, l, 21, COLORS.hex.ivory));
    if (pending && !pending.eligible)
      this.text(
        GAME_W / 2,
        530,
        `Nível permanente exige ${SELUN.grantMinActiveMs / 1000} s de combate ativo ou uma quebra de postura.\nDesta vez, Apollon concede apenas a ${BRASA.name} (temporária).`,
        16,
        COLORS.hex.dim
      );
    this.hint('Enter / clique: continuar');
  }

  // ------------------------------------------------------------------ Apollon
  private renderApollon(first: boolean): void {
    Sfx.blessing();
    const glow = this.add.image(GAME_W / 2, GAME_H / 2 - 40, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd77a).setDisplaySize(900, 700).setAlpha(0);
    this.layer.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.55, duration: 900 });
    if (this.textures.exists('characters') && this.textures.get('characters').has('apollon_avatar_03')) {
      const a = this.add.image(GAME_W / 2, GAME_H / 2 - 60, 'characters', 'apollon_avatar_00').setScale(1.3).setAlpha(0);
      this.layer.add(a);
      this.tweens.add({ targets: a, alpha: 1, duration: 900 });
      this.time.delayedCall(450, () => a.active && a.setFrame('apollon_avatar_02'));
      this.time.delayedCall(900, () => a.active && a.setFrame('apollon_avatar_03'));
    }
    this.text(GAME_W / 2, GAME_H - 180, 'Apollon', 22, COLORS.hex.goldBright, { fontFamily: FONT_TITLE });
    const line = this.text(GAME_W / 2, GAME_H - 138, '', 24, COLORS.hex.ivory, { wordWrap: { width: 900 } });
    const full = `“${first ? APOLLON_LINES.first : APOLLON_LINES.again}”`;
    let n = 0;
    this.time.addEvent({ delay: 24, repeat: full.length - 1, callback: () => line.active && line.setText(full.slice(0, ++n)) });
    this.hint('Enter / clique: continuar');
  }

  // ------------------------------------------------------------------ escolha
  private renderChoice(): void {
    const p = save.data.selun.pending;
    this.text(GAME_W / 2, 70, 'Bênção de Apollon', 34, COLORS.hex.goldBright, { fontFamily: FONT_TITLE });
    if (!p) {
      this.stage = 'refuge';
      return this.render();
    }
    const levels = save.data.selun.blessings;
    if (!p.eligible || !p.options.length) {
      const complete = p.eligible && !p.options.length;
      this.card(GAME_W / 2, 330, 420, BRASA.name, ['+10% de dano de postura na próxima tentativa', 'não acumula consigo mesma'], true, () => this.confirm());
      this.text(
        GAME_W / 2,
        540,
        complete ? 'Você completou o conjunto permanente de bênçãos.' : `Morte antes de ${SELUN.grantMinActiveMs / 1000} s ativos e sem quebra de postura: só a Brasa desta vez.`,
        16,
        COLORS.hex.dim
      );
      this.hint('Enter / clique: aceitar');
      return;
    }
    this.text(GAME_W / 2, 112, p.firstDefeat ? 'Primeira derrota: escolha uma das três centelhas.' : 'Escolha uma bênção. Cada escolha dá um nível.', 17, COLORS.hex.dim);
    const w = 330;
    p.options.forEach((id, i) => {
      const def = blessingDef(id)!;
      const lvl = levels[id] ?? 0;
      const x = GAME_W / 2 + (i - (p.options.length - 1) / 2) * (w + 30);
      this.card(
        x,
        340,
        w,
        def.name,
        [`Nível ${lvl}/${def.max}${lvl ? ` — ${def.effect(lvl)}` : ' — ainda não obtida'}`, `Após escolher: nível ${lvl + 1}`, def.effect(lvl + 1)],
        i === this.selected,
        () => {
          if (this.selected === i) this.confirm();
          else this.pick(i);
        }
      );
    });
    this.hint('← → ou 1·2·3: escolher · Enter: confirmar');
  }

  private card(x: number, y: number, w: number, title: string, lines: string[], active: boolean, onClick: () => void): void {
    const h = 300;
    const bg = this.add.rectangle(x, y, w, h, 0x120c0a, 0.95).setStrokeStyle(active ? 3 : 1.5, active ? COLORS.goldBright : COLORS.gold, active ? 1 : 0.5);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.layer.add(bg);
    this.text(x, y - 110, title, 24, active ? COLORS.hex.goldBright : COLORS.hex.gold, { fontFamily: FONT_TITLE, wordWrap: { width: w - 30 } });
    lines.forEach((l, i) => this.text(x, y - 40 + i * 52, l, i === lines.length - 1 ? 18 : 16, i === lines.length - 1 ? COLORS.hex.ivory : COLORS.hex.dim, { wordWrap: { width: w - 34 } }));
  }

  private pick(i: number): void {
    const p = save.data.selun.pending;
    if (this.stage !== 'choice' || !p || i >= p.options.length) return;
    this.selected = i;
    Sfx.uiMove();
    this.render();
  }

  private move(d: number): void {
    const p = save.data.selun.pending;
    if (this.stage !== 'choice' || !p || !p.options.length) return;
    this.pick((this.selected + d + p.options.length) % p.options.length);
  }

  /** Concede e fecha a etapa pendente numa única gravação (idempotente). */
  private confirm(): void {
    const p = save.data.selun.pending;
    const choice = p?.options[this.selected] as ApollonBlessingId | undefined;
    const r = save.selunConfirm(choice);
    Sfx.uiConfirm();
    if (r?.kind === 'blessing') {
      const def = blessingDef(r.id)!;
      this.result = `${def.name} — nível ${r.level}/${def.max}: ${def.effect(r.level)}`;
    } else if (r?.kind === 'ember') {
      this.result = `${BRASA.name}: +10% de dano de postura na próxima tentativa.${r.complete ? '\nO conjunto permanente está completo.' : ''}`;
    }
    this.stage = 'refuge';
    this.render();
  }

  // ------------------------------------------------------------------ refúgio
  private renderRefuge(): void {
    this.text(GAME_W / 2, 110, 'Refúgio', 40, COLORS.hex.goldBright, { fontFamily: FONT_TITLE });
    this.text(GAME_W / 2, 168, 'Apollon trouxe Atriox de volta. Ele desperta com a vida cheia.', 19, COLORS.hex.ivory);
    if (this.result) this.text(GAME_W / 2, 230, this.result, 19, COLORS.hex.gold, { wordWrap: { width: 900 } });
    const owned = APOLLON_BLESSINGS.filter((b) => (save.data.selun.blessings[b.id] ?? 0) > 0)
      .map((b) => `${b.name} ${save.data.selun.blessings[b.id]}/${b.max}`)
      .join(' · ');
    if (owned) this.text(GAME_W / 2, 300, `Bênçãos permanentes: ${owned}`, 15, COLORS.hex.dim, { wordWrap: { width: 1000 } });
    this.text(GAME_W / 2, 350, `O próximo Infinito começa no nível 1. Sêlun retorna depois do nível ${SELUN.triggerWave}.`, 16, COLORS.hex.dim);
    const go = (eternity: boolean): void => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (eternity) this.scene.start('ArenaScene', { eternity: true });
        else this.scene.start('MenuScene');
      });
    };
    if (save.data.selun.eternityUnlocked) this.layer.add(makeButton(this, GAME_W / 2, 450, 'Provação da Eternidade — nível 1', () => go(true)).container);
    this.layer.add(makeButton(this, GAME_W / 2, 520, 'Voltar ao menu', () => go(false)).container);
  }

  private hint(s: string): void {
    this.text(GAME_W / 2, GAME_H - 40, s, 15, COLORS.hex.dim);
  }

  private advance(): void {
    if (this.time.now < this.readyAt) return;
    if (this.stage === 'over') {
      this.stage = 'apollon';
      this.render();
    } else if (this.stage === 'apollon') {
      this.stage = 'choice';
      this.render();
    } else if (this.stage === 'choice') this.confirm();
  }
}
