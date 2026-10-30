import type Phaser from 'phaser';
import { ANIM_STATES, type AnimState } from '../animation/AtrioxAnimator';
import { BLESSINGS } from '../../data/blessings';
import { APOLLON_GIFTS } from '../../data/apollon';
import type { ArenaScene } from '../scenes/ArenaScene';

/**
 * Painel de desenvolvimento (DOM). Só é importado quando DEV_TOOLS = true,
 * portanto não existe no bundle de produção padrão.
 * Atalho: F2 (ou tecla `).
 */
export function attachDevPanel(game: Phaser.Game): void {
  const el = document.createElement('div');
  el.id = 'dev-panel';
  el.hidden = true;
  document.body.appendChild(el);

  const arena = (): ArenaScene | null => {
    const s = game.scene.getScene('ArenaScene') as ArenaScene | null;
    return s && s.sys.isActive() && s.player ? s : null;
  };

  let forced: AnimState | null = null;
  el.innerHTML = `
    <h3>ATRIOX · DEV (F2)</h3>
    <div><b>Animações</b> <small>(força estado)</small></div>
    <div class="row" id="dv-anims"></div>
    <button id="dv-free">liberar animação</button>
    <label>Escala do sprite <input id="dv-scale" type="range" min="0.25" max="0.8" step="0.01"></label>
    <label>Velocidade das animações <span id="dv-speed-v"></span><input id="dv-speed" type="range" min="0.1" max="2" step="0.05" value="1"></label>
    <label><input id="dv-hit" type="checkbox"> hitboxes / origens</label>
    <label><input id="dv-god" type="checkbox"> modo deus</label>
    <div><b>Partida</b></div>
    <div class="row">
      <button id="dv-kill">matar inimigos</button>
      <button id="dv-toknar">ir: Toknar</button><button id="dv-build">build completa</button><button id="dv-eternity">Eternidade</button>
      <button id="dv-exec">ir: Carrasco</button>
      <button id="dv-nemeia">ir: Nemeia (Caim)</button>
      <button id="dv-boss50">chefe −50%</button>
      <button id="dv-heal">curar</button>
      <button id="dv-pool">poça no jogador</button>
      <button id="dv-insp">inspetor de animações</button>
    </div>
    <div><b>Dons de Apollon</b></div>
    <div class="row" id="dv-gifts"></div>
    <div><b>Bênçãos</b></div>
    <div class="row" id="dv-bless"></div>
    <pre id="dv-info" style="white-space:pre-wrap;margin:6px 0 0;color:#a89878"></pre>
  `;
  const $ = <T extends HTMLElement>(id: string): T => el.querySelector(`#${id}`) as T;
  const anims = $('dv-anims');
  for (const s of ANIM_STATES) {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => {
      forced = s;
    };
    anims.appendChild(b);
  }
  const bless = $('dv-bless');
  for (const b of BLESSINGS) {
    const btn = document.createElement('button');
    btn.textContent = b.name;
    btn.onclick = () => arena()?.applyBlessing(b.id);
    bless.appendChild(btn);
  }
  $('dv-free').onclick = () => {
    forced = null;
  };
  const scale = $<HTMLInputElement>('dv-scale');
  scale.oninput = () => {
    const a = arena();
    if (a) a.player.animator.baseScale = Number(scale.value);
  };
  const speed = $<HTMLInputElement>('dv-speed');
  speed.oninput = () => {
    const a = arena();
    if (a) a.player.animator.speed = Number(speed.value);
    $('dv-speed-v').textContent = `×${speed.value}`;
  };
  $<HTMLInputElement>('dv-hit').onchange = (e) => {
    const a = arena();
    if (a) a.showHitboxes = (e.target as HTMLInputElement).checked;
  };
  $<HTMLInputElement>('dv-god').onchange = (e) => {
    const a = arena();
    if (a) a.player.godMode = (e.target as HTMLInputElement).checked;
  };
  $('dv-kill').onclick = () => arena()?.devKillAll();
  $('dv-toknar').onclick = () => arena()?.devGotoRoom('toknar');
  $('dv-build').onclick = () => { const a=arena(); if(a)for(const g of APOLLON_GIFTS.filter(g=>!g.id.startsWith('universal')))a.applyGift(g.id); };
  $('dv-eternity').onclick = () => arena()?.startEndless();
  $('dv-exec').onclick = () => arena()?.devGotoRoom('executioner');
  $('dv-nemeia').onclick = () => arena()?.devGotoRoom('nemeia');
  $('dv-pool').onclick = () => arena()?.devSpawnPoolAtPlayer();
  $('dv-insp').onclick = () => {
    for (const k of ['ArenaScene', 'UIScene', 'MenuScene']) if (game.scene.isActive(k)) game.scene.stop(k);
    game.scene.start('AnimInspectorScene');
  };
  const gifts = $('dv-gifts');
  for (const g of APOLLON_GIFTS) {
    const btn = document.createElement('button');
    btn.textContent = g.name;
    btn.onclick = () => arena()?.applyGift(g.id);
    gifts.appendChild(btn);
  }
  $('dv-boss50').onclick = () => arena()?.devDamageBoss(0.5);
  $('dv-heal').onclick = () => {
    const a = arena();
    a?.player.heal(999);
  };

  const toggle = (e: KeyboardEvent): void => {
    if (e.code === 'F2' || e.code === 'Backquote') {
      e.preventDefault();
      el.hidden = !el.hidden;
      const a = arena();
      if (a) scale.value = String(a.player.animator.baseScale);
    }
  };
  window.addEventListener('keydown', toggle);

  // aplica animação forçada e atualiza informações
  game.events.on('poststep', () => {
    const a = arena();
    if (!a || el.hidden) return;
    if (forced) {
      a.player.animator.set(forced);
      a.player.animator.attackPhase = 'active';
      a.player.animator.phaseT = 0.5;
      a.player.animator.update(0, a.player.x, a.player.y, a.player.y);
    }
    const snap = a.debugSnapshot();
    $('dv-info').textContent = `fps ${Math.round(game.loop.actualFps)}\nanim ${a.player.animator.state}\n${JSON.stringify(snap, null, 1).slice(0, 600)}`;
  });
}
