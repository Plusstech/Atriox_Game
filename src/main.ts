import { VictoryChoiceScene } from './game/scenes/VictoryChoiceScene';
import Phaser from 'phaser';
import './styles/main.css';
import { DEV_TOOLS, GAME_H, GAME_W } from './game/config/constants';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { ArenaScene } from './game/scenes/ArenaScene';
import { UIScene } from './game/scenes/UIScene';
import { RewardScene } from './game/scenes/RewardScene';
import { PauseScene } from './game/scenes/PauseScene';
import { ResultScene } from './game/scenes/ResultScene';
import { AnimInspectorScene } from './game/scenes/AnimInspectorScene';
import { save } from './game/services';
import { Sfx } from './game/audio/Sfx';

/** Mostra erros fatais na tela em vez de uma tela preta silenciosa. */
function showFatal(message: string): void {
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.hidden = false;
  el.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = 'A chama vacilou — ocorreu um erro';
  const pre = document.createElement('pre');
  pre.textContent = message;
  const btn = document.createElement('button');
  btn.textContent = 'Recarregar';
  btn.onclick = () => location.reload();
  el.append(h, pre, btn);
}

window.addEventListener('error', (e) => showFatal(`${e.message}\n${e.filename ?? ''}:${e.lineno ?? ''}`));
window.addEventListener('unhandledrejection', (e) => showFatal(String((e as PromiseRejectionEvent).reason)));

const s = save.data.settings;
Sfx.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);

try {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#070506',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60 },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, MenuScene, ArenaScene, UIScene, RewardScene, PauseScene, ResultScene, AnimInspectorScene, VictoryChoiceScene]
  });
  if (DEV_TOOLS || (['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('test'))) {
    (window as unknown as { __ATRIOX_GAME__: Phaser.Game }).__ATRIOX_GAME__ = game;
  }
  if (DEV_TOOLS) {
    void import('./game/dev/DevPanel').then((m) => m.attachDevPanel(game));
  }
} catch (err) {
  showFatal((err as Error).stack ?? String(err));
}
