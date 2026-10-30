import Phaser from 'phaser';
import { COLORS, FONT_UI } from '../config/constants';
import { Sfx } from '../audio/Sfx';
import { save } from '../services';
import type { Settings } from '../systems/SaveSystem';

export interface Button {
  container: Phaser.GameObjects.Container;
  setLabel(s: string): void;
}

/** Botão no estilo fantasia sombria (moldura dourada fina). */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { width?: number; height?: number; size?: number } = {}
): Button {
  const w = opts.width ?? 300;
  const h = opts.height ?? 46;
  const bg = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT_UI, fontSize: `${opts.size ?? 20}px`, color: COLORS.hex.ivory })
    .setOrigin(0.5);
  const draw = (hover: boolean): void => {
    bg.clear();
    bg.fillStyle(hover ? 0x2a1a12 : 0x140c0a, hover ? 0.95 : 0.8);
    bg.fillRect(-w / 2, -h / 2, w, h);
    bg.lineStyle(1.5, hover ? COLORS.goldBright : 0x7a5a2a, 1);
    bg.strokeRect(-w / 2, -h / 2, w, h);
    if (hover) {
      bg.fillStyle(COLORS.gold, 1);
      bg.fillTriangle(-w / 2 + 12, -6, -w / 2 + 12, 6, -w / 2 + 20, 0);
      bg.fillTriangle(w / 2 - 12, -6, w / 2 - 12, 6, w / 2 - 20, 0);
    }
    text.setColor(hover ? COLORS.hex.goldBright : COLORS.hex.ivory);
  };
  draw(false);
  const c = scene.add.container(x, y, [bg, text]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => {
    draw(true);
    Sfx.uiMove();
  });
  c.on('pointerout', () => draw(false));
  c.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (!p.leftButtonDown()) return;
    Sfx.unlock();
    Sfx.uiConfirm();
    onClick();
  });
  return { container: c, setLabel: (s) => text.setText(s) };
}

/** Lista de opções persistidas (usada no menu e na pausa). */
export function makeOptions(scene: Phaser.Scene, x: number, y: number, spacing = 52): Phaser.GameObjects.GameObject[] {
  const s = (): Settings => save.data.settings;
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  const items: { label: () => string; act: () => void }[] = [
    {
      label: () => `Volume geral: ${pct(s().masterVolume)}`,
      act: () => save.updateSettings({ masterVolume: s().masterVolume >= 1 ? 0 : Math.round((s().masterVolume + 0.2) * 10) / 10 })
    },
    {
      label: () => `Música: ${pct(s().musicVolume)}`,
      act: () => save.updateSettings({ musicVolume: s().musicVolume >= 1 ? 0 : Math.round((s().musicVolume + 0.25) * 100) / 100 })
    },
    { label: () => `Tremor de câmera: ${s().reduceShake ? 'Reduzido' : 'Normal'}`, act: () => save.updateSettings({ reduceShake: !s().reduceShake }) },
    { label: () => `Flashes: ${s().reduceFlash ? 'Reduzidos' : 'Normais'}`, act: () => save.updateSettings({ reduceFlash: !s().reduceFlash }) },
    { label: () => `Números de dano: ${s().damageNumbers ? 'Sim' : 'Não'}`, act: () => save.updateSettings({ damageNumbers: !s().damageNumbers }) },
    { label: () => `Partículas: ${s().graphics === 'high' ? 'Completas' : 'Reduzidas'}`, act: () => save.updateSettings({ graphics: s().graphics === 'high' ? 'low' : 'high' }) }
  ];
  const out: Phaser.GameObjects.GameObject[] = [];
  items.forEach((it, i) => {
    const b = makeButton(
      scene,
      x,
      y + i * spacing,
      it.label(),
      () => {
        it.act();
        b.setLabel(it.label());
        const st = s();
        Sfx.setVolumes(st.masterVolume, st.musicVolume, st.sfxVolume);
      },
      { width: 380, height: 42, size: 18 }
    );
    out.push(b.container);
  });
  return out;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Ornamento horizontal (linha dourada com losango central). */
export function ornament(scene: Phaser.Scene, x: number, y: number, w: number, color: number = COLORS.gold, alpha = 0.8): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1.5, color, alpha);
  g.lineBetween(x - w / 2, y, x - 10, y);
  g.lineBetween(x + 10, y, x + w / 2, y);
  g.fillStyle(color, alpha);
  g.fillPoints([new Phaser.Geom.Point(x, y - 5), new Phaser.Geom.Point(x + 6, y), new Phaser.Geom.Point(x, y + 5), new Phaser.Geom.Point(x - 6, y)], true);
  return g;
}
