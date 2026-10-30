/**
 * Integração v0.5 (headless) contra o BUILD DE PRODUÇÃO:
 * conversas pré-chefe, Carrasco novo (quadros + postura), Toknar (antecipação em
 * vários quadros, reforços pelos acessos, limites da arena ilustrada), orc com
 * escudo frontal, goblins animados e wyverns selvagens.
 * Uso: npm run build && node tests/e2e/v05.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4323;
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
const snap = () => A(() => window.__ATRIOX__.snapshot());

async function fresh(room, skipDialogue) {
  await page.goto(`http://127.0.0.1:${PORT}/?test`);
  await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await A((v) => {
    window.__ATRIOX_SKIP_DIALOGUE__ = v;
  }, skipDialogue);
  await page.keyboard.press('Enter');
  await waitFor(page, () => !!window.__ATRIOX__?.arena?.player);
  await sleep(400);
  await A((r) => {
    const a = window.__ATRIOX__.arena;
    a.player.godMode = true;
    a.devGotoRoom(r);
  }, room);
  return waitFor(page, (r) => window.__ATRIOX__.snapshot().room === r, room);
}

try {
  // ------------------------------------------------------------ Carrasco: conversa + quadros + postura
  check('sala do Carrasco carregada', await fresh('executioner', false));
  check('conversa abre antes da luta', await waitFor(page, () => window.__ATRIOX__.snapshot().dialogue, null, 15000));
  await waitFor(page, () => window.__ATRIOX_GAME__.scene.isPaused('ArenaScene') && window.__ATRIOX_GAME__.scene.isActive('DialogueScene'), null, 3000);
  const paused = await A(() => ({
    arenaPaused: window.__ATRIOX_GAME__.scene.isPaused('ArenaScene'),
    dialogue: window.__ATRIOX_GAME__.scene.isActive('DialogueScene'),
    scripted: window.__ATRIOX__.arena.boss.scripted,
    bar: window.__ATRIOX__.arena.getHud().boss
  }));
  check('combate congelado e chefe ainda sem barra durante a conversa', paused.arenaPaused && paused.dialogue && paused.scripted && paused.bar === null, JSON.stringify(paused));
  await sleep(250);
  const dlg = () => A(() => {
    const d = window.__ATRIOX_GAME__.scene.getScene('DialogueScene');
    return { index: d.state.index, shown: Math.floor(d.state.shown), len: d.state.line?.text.length ?? 0, complete: d.state.complete };
  });
  const d0 = await dlg();
  check('texto revelado gradualmente', d0.shown < d0.len, JSON.stringify(d0));
  await page.keyboard.press('Enter');
  await sleep(200);
  const d1 = await dlg();
  check('Enter completa a fala antes de avançar', d1.index === 0 && d1.complete, JSON.stringify(d1));
  await page.keyboard.press('Enter');
  await sleep(200);
  const d2 = await dlg();
  check('Enter com a fala completa avança uma fala', d2.index === 1 && d2.shown < d2.len, JSON.stringify(d2));
  await page.keyboard.press('Escape');
  check('Esc pula a conversa e a arena volta', await waitFor(page, () => !window.__ATRIOX__.snapshot().dialogue && window.__ATRIOX_GAME__.scene.isActive('ArenaScene'), null, 4000));
  const leak = await A(() => ({ attacking: window.__ATRIOX__.arena.player.combo.attacking, paused: window.__ATRIOX_GAME__.scene.isPaused('ArenaScene'), dialogue: window.__ATRIOX_GAME__.scene.isActive('DialogueScene') }));
  check('nenhuma tecla da conversa vaza para o primeiro quadro da luta', !leak.attacking && !leak.paused && !leak.dialogue, JSON.stringify(leak));
  check('luta começa uma vez depois da conversa', await waitFor(page, () => !window.__ATRIOX__.arena.boss.scripted, null, 5000));
  const bossFrames = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const b = (await snap()).boss;
    if (b?.state === 'windup') bossFrames.add(b.frame);
    if (bossFrames.size >= 2 && b?.state !== 'windup') break;
    await sleep(40);
  }
  check('Carrasco novo: antecipação usa vários quadros do atlas', bossFrames.size >= 2 && [...bossFrames].every((f) => f.startsWith('carrasco_')), [...bossFrames].join(' '));
  await page.screenshot({ path: path.join(SHOTS, 'v05-e2e-carrasco.png') });
  const broke = await A(() => {
    const b = window.__ATRIOX__.arena.boss;
    b.receiveHit({ damage: 5, knockback: 0, dirX: 0, dirY: 0, tag: 'charged', posture: 999 });
    return b.brain.state;
  });
  check('postura do Carrasco quebra com golpe carregado', broke === 'broken', broke);
  check('quebra mostra quadros de postura quebrada', await waitFor(page, () => window.__ATRIOX__.snapshot().boss.frame.startsWith('carrasco_broken'), null, 2000));
  const again = await A(() => window.__ATRIOX__.arena.boss.brain.hitPosture(999));
  check('sem stagger infinito: imune a nova quebra', again === false);
  check('Carrasco volta a lutar depois da quebra', await waitFor(page, () => window.__ATRIOX__.snapshot().boss.state !== 'broken', null, 6000));

  // ------------------------------------------------------------ Toknar
  check('Fosso de Rhaesis carregado (arena ilustrada)', await fresh('toknar', true));
  check('Toknar começa após a conversa (dispensada no teste)', await waitFor(page, () => window.__ATRIOX__.snapshot().toknar?.state && window.__ATRIOX__.snapshot().toknar.state !== 'intro', null, 8000));
  const arenaImg = await A(() => window.__ATRIOX__.arena.layout.objects.some((o) => o.texture?.key === 'arena_toknar'));
  check('arena do clã desenhada a partir da ilustração', arenaImg);
  const tkFrames = new Set();
  const t1 = Date.now();
  while (Date.now() - t1 < 12000) {
    const s = await A(() => ({ st: window.__ATRIOX__.arena.toknar.brain.state, f: window.__ATRIOX__.arena.toknar.anim.sprite.frame.name }));
    if (s.st === 'windup') tkFrames.add(s.f);
    if (tkFrames.size >= 2 && s.st !== 'windup') break;
    await sleep(40);
  }
  check('Toknar: antecipação distribuída em vários quadros (sem pose congelada)', tkFrames.size >= 2, [...tkFrames].join(' '));
  await A(() => {
    const t = window.__ATRIOX__.arena.toknar;
    t.receiveHit({ damage: t.health.max * 0.33, knockback: 0, dirX: 0, dirY: 0, tag: 'test' });
  });
  check('fase 2 traz reforços reais (orc e goblin)', await waitFor(page, () => {
    const k = window.__ATRIOX__.snapshot().kinds;
    return k.includes('orc') && k.includes('goblin');
  }, null, 8000));
  const entry = await A(() => window.__ATRIOX__.arena.enemies.map((e) => Math.round(e.y)));
  check('reforços entram pelos acessos superiores', entry.length > 0 && Math.min(...entry) < 620, entry.join(','));
  const bound = await A(() => {
    const a = window.__ATRIOX__.arena;
    a.player.x = 175;
    a.player.y = 335;
    return true;
  });
  await sleep(500);
  const pos = await A(() => ({ x: window.__ATRIOX__.arena.player.x, y: window.__ATRIOX__.arena.player.y }));
  check('canto da plateia pintada é obstáculo', bound && Math.hypot(pos.x - 170, pos.y - 330) >= 225, JSON.stringify(pos));
  await page.screenshot({ path: path.join(SHOTS, 'v05-e2e-toknar.png') });

  // ------------------------------------------------------------ orc: escudo frontal / goblin animado
  check('Segunda Provação carregada', await fresh('trial-2', true));
  const orcReady = await waitFor(page, () => window.__ATRIOX__.arena.enemies.some((e) => e.def.kind === 'orc' && !e.dead), null, 8000);
  const block = await A(() => {
    const a = window.__ATRIOX__.arena;
    const o = a.enemies.find((e) => e.def.kind === 'orc');
    o.guardAngle = Math.atan2(a.player.y - o.y, a.player.x - o.x);
    o.brain.state = 'chase';
    const ang = Math.atan2(o.y - a.player.y, o.x - a.player.x);
    const front = o.receiveHit({ damage: 20, knockback: 100, dirX: Math.cos(ang), dirY: Math.sin(ang), tag: 'test', basic: true });
    o.brain.state = 'chase';
    const back = o.receiveHit({ damage: 20, knockback: 100, dirX: -Math.cos(ang), dirY: -Math.sin(ang), tag: 'test', basic: true });
    return { front, back, frame: o.anim.sprite.frame.name };
  });
  check('orc bloqueia golpe frontal e sofre dano pelas costas', orcReady && block.front < 8 && block.back === 20, JSON.stringify(block));
  check('orc animado por quadros do atlas', block.frame.startsWith('orc_'), block.frame);

  // ------------------------------------------------------------ wyverns selvagens
  check('Ninho das Wyverns carregado', await fresh('build-2', true));
  check('wyvern selvagem surge', await waitFor(page, () => window.__ATRIOX__.snapshot().wildWyverns >= 1, null, 8000));
  const desc = await A(() => {
    const w = window.__ATRIOX__.arena.wyverns[0];
    return { inv: w.hurtbox.invulnerable, frame: w.anim.sprite.frame.name };
  });
  check('wyvern selvagem desce intangível, com quadros próprios', desc.inv && desc.frame.startsWith('wyvwild_'), JSON.stringify(desc));
  check('wyvern selvagem conta para liberar a sala', (await snap()).alive >= 1);
  check('wyvern fica vulnerável após pousar no voo', await waitFor(page, () => !window.__ATRIOX__.arena.wyverns[0].hurtbox.invulnerable, null, 5000));
  await A(() => {
    const a = window.__ATRIOX__.arena;
    for (const w of a.wyverns) if (!w.dead) w.receiveHit({ damage: 999, knockback: 0, dirX: 0, dirY: 0, tag: 'test' });
  });
  check('abater as wyverns libera a sala (próxima onda ou portas)', await waitFor(page, () => {
    const s = window.__ATRIOX__.snapshot();
    return s.kinds.includes('goblin') || s.phase === 'doors' || s.pendingSpawns > 0 || s.wildWyverns > 0;
  }, null, 8000));
} finally {
  check('sem erros no console', errors.length === 0, errors.slice(0, 3).join(' | '));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações v0.5 passaram.`);
  await browser.close();
  server.kill();
  process.exitCode = failed ? 1 : 0;
}
