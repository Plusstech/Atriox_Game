/**
 * Integração do Sêlun — O Fim do Infinito (headless, build de produção).
 * Uso: npm run build && node tests/e2e/selun.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4325;
const URL0 = `http://127.0.0.1:${PORT}/?test`;
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(page, fn, arg, timeout = 15000, step = 60) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await sleep(step);
  }
  return false;
}

const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()));
const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const A = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `selun-${n}.png`) });
const sel = () => A(() => window.__ATRIOX__.snapshot().selun);
const active = (k) => A((k) => window.__ATRIOX_GAME__.scene.isActive(k), k);

async function toArena() {
  await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'), null, 20000);
  await page.keyboard.press('Enter');
  return waitFor(page, () => !!window.__ATRIOX__?.arena?.player);
}

try {
  await page.goto(URL0);
  await A(() => localStorage.clear());
  await page.goto(URL0);
  check('jogo abre com save limpo', await toArena());
  await sleep(500);

  // ------------------------------------------------ gatilho: nível 9 não chama; 10 chama uma vez e impede o 11
  const trig = await A(() => {
    const a = window.__ATRIOX__.arena;
    a.player.godMode = true;
    a.dummies.forEach((d) => d.destroy());
    a.dummies = [];
    a.endless = true;
    a.campaignRecorded = true;
    a.endlessWave = 9;
    a.endlessWaiting = false;
    a.endlessCleared();
    const at9 = !!a.selun;
    a.endlessWaiting = false;
    a.endlessWave = 10;
    a.endlessCleared();
    const at10 = !!a.selun;
    const first = a.selun;
    a.endlessWaiting = false;
    a.endlessCleared();
    return { at9, at10, same: a.selun === first, wave: a.endlessWave };
  });
  check('nível 9 concluído não chama Sêlun', !trig.at9, JSON.stringify(trig));
  check('nível 10 concluído chama Sêlun uma vez, sem nível 11', trig.at10 && trig.same && trig.wave === 10);
  check('conversa de entrada abre', await waitFor(page, () => window.__ATRIOX__.snapshot().dialogue, null, 15000));
  await sleep(1300);
  await shot('dialogo');
  const port = await A(() => window.__ATRIOX_GAME__.scene.getScene('DialogueScene').state.line?.speaker);
  check('Sêlun fala primeiro (retrato à direita)', port === 'selun', port);
  await page.keyboard.press('Escape');
  check('luta começa após a conversa', await waitFor(page, () => window.__ATRIOX__.snapshot().selun?.state && window.__ATRIOX__.snapshot().selun.state !== 'intro', null, 8000));
  check('arena própria do Sêlun', await A(() => window.__ATRIOX__.arena.layout.objects.some((o) => o.texture?.key === 'arena_selun')));
  const hud = await A(() => window.__ATRIOX__.arena.getHud());
  check('HUD: nome, manifestação, postura, fase e tempo', hud.boss?.name === 'SÊLUN' && /Manifestação .* Postura .* Fase 1 · 0:0/.test(hud.bossExtra), hud.bossExtra);

  // ------------------------------------------------ golpe com aviso e quadros
  const frames = new Set();
  const t0 = Date.now();
  let warned = false;
  while (Date.now() - t0 < 12000) {
    const s = await sel();
    if (s.state === 'windup') {
      frames.add(s.frame);
      warned = true;
    }
    if (warned && frames.size >= 2 && s.state !== 'windup') break;
    await sleep(40);
  }
  check('golpe anunciado com vários quadros de preparação', frames.size >= 2 && [...frames].every((f) => f.startsWith('selun_')), [...frames].join(' '));
  await shot('luta');

  // ------------------------------------------------ manifestação zerada → queda → recomposição (sem vitória)
  await A(() => {
    const s = window.__ATRIOX__.arena.selun;
    s.receiveHit({ damage: 99999, knockback: 0, dirX: 0, dirY: 0, tag: 'test' });
  });
  const fallen = await sel();
  check('manifestação zera → queda aparente (intangível)', fallen.state === 'fallen', fallen.state);
  await shot('queda');
  check('recompõe com manifestação cheia', await waitFor(page, () => window.__ATRIOX__.snapshot().selun?.recompositions === 1, null, 12000));
  const after = await A(() => ({ s: window.__ATRIOX__.snapshot().selun, phase: window.__ATRIOX__.arena.run.phase, doors: window.__ATRIOX__.arena.giftOffers.length, wave: window.__ATRIOX__.arena.endlessWave }));
  check('sem vitória, loot ou avanço; fase temporal mantida', after.s.hp === 900 && after.phase === 'boss' && after.doors === 0 && after.wave === 10 && after.s.phase === 1, JSON.stringify(after));

  // ------------------------------------------------ postura
  await waitFor(page, () => ['idle', 'windup', 'active', 'recovery'].includes(window.__ATRIOX__.snapshot().selun.state), null, 5000, 30);
  const br = await A(() => {
    const s = window.__ATRIOX__.arena.selun;
    s.receiveHit({ damage: 1, knockback: 0, dirX: 0, dirY: 0, tag: 'charged', posture: 999 });
    return { st: s.brain.state, hazards: s.hazardCount, attacking: s.brain.attacking };
  });
  check('postura quebrada: janela real, sem ataque pendente', br.st === 'stagger' && br.hazards === 0 && !br.attacking, JSON.stringify(br));

  // ------------------------------------------------ fase 2: Decreto do Fim com rotas de escape
  await A(() => {
    const b = window.__ATRIOX__.arena.selun.brain;
    b.activeMs = 46_000;
  });
  check('fase 2 pelo tempo', await waitFor(page, () => window.__ATRIOX__.snapshot().selun.phase === 2, null, 8000));
  await waitFor(page, () => window.__ATRIOX__.snapshot().selun.state === 'idle', null, 6000, 30);
  await A(() => {
    const b = window.__ATRIOX__.arena.selun.brain;
    b.queue = ['decree'];
    b.timer = 99999;
  });
  check('Decreto do Fim anuncia fendas', await waitFor(page, () => window.__ATRIOX__.snapshot().selun.hazards >= 4, null, 8000, 30));
  await sleep(250);
  await shot('decreto');

  // ------------------------------------------------ Última Palavra → GAME OVER → Apollon
  await waitFor(page, () => ['idle', 'recovery'].includes(window.__ATRIOX__.snapshot().selun.state), null, 10000, 30);
  await A(() => {
    const a = window.__ATRIOX__.arena;
    a.selun.brain.activeMs = 180_000;
  });
  check('Última Palavra começa com contagem', await waitFor(page, () => /ÚLTIMA PALAVRA/.test(window.__ATRIOX__.arena.getHud().countdown), null, 10000, 30));
  await shot('ultima-palavra');
  check('execução inevitável (ignora o modo deus) → GAME OVER', await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('SelunAftermathScene'), null, 15000));
  const pend = await A(() => JSON.parse(localStorage.getItem('atriox-cinder.save.v1')).selun.pending);
  check('derrota elegível gravada com as três bênçãos fixas', pend?.eligible && JSON.stringify(pend.options) === JSON.stringify(['solar_heart', 'dawn_blade', 'aurora_step']), JSON.stringify(pend?.options));
  await sleep(900);
  await shot('game-over');
  await page.keyboard.press('Enter');
  await sleep(1200);
  await shot('apollon');
  await page.keyboard.press('Enter');
  await sleep(900);
  await shot('escolha');

  // recarregar durante a escolha reabre a MESMA escolha
  await page.goto(URL0);
  check('recarregar reabre a escolha pendente', await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('SelunAftermathScene'), null, 20000));
  const same = await A(() => JSON.parse(localStorage.getItem('atriox-cinder.save.v1')).selun.pending.options);
  check('mesmas opções depois de recarregar', JSON.stringify(same) === JSON.stringify(pend.options));
  await sleep(900);
  await page.keyboard.press('Enter');
  await sleep(400);
  const granted = await A(() => JSON.parse(localStorage.getItem('atriox-cinder.save.v1')).selun);
  check('uma bênção concedida e etapa fechada juntas', granted.blessings.solar_heart === 1 && granted.pending === null && granted.lastGrantedAttempt, JSON.stringify(granted.blessings));
  await shot('refugio');
  await page.goto(URL0);
  check('recarregar após confirmar não reabre a escolha', await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'), null, 20000));
  const again = await A(() => JSON.parse(localStorage.getItem('atriox-cinder.save.v1')).selun.blessings.solar_heart);
  check('sem concessão duplicada', again === 1);

  // ------------------------------------------------ bênção aplicada a partir da base; Infinito do nível 1
  await page.keyboard.press('Enter');
  await waitFor(page, () => !!window.__ATRIOX__?.arena?.player);
  const hp = await A(() => window.__ATRIOX__.arena.player.health.max);
  check('Coração Solar 1: +8% de vida máxima (base 100)', Math.round(hp) === 108, String(hp));
} finally {
  check('sem erros no console', errors.length === 0, errors.slice(0, 3).join(' | '));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações do Sêlun passaram.`);
  await browser.close();
  server.kill();
  process.exitCode = failed ? 1 : 0;
}
