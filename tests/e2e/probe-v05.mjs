/**
 * Capturas visuais da v0.5 (headless) contra o build de produção.
 * Uso: npm run build && node tests/e2e/probe-v05.mjs [cenário...]
 * Cenários: goblin orc wyvern carrasco toknar caim
 * Saída: tests/e2e/screenshots/v05-*.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4321;
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = new Set(process.argv.slice(2));
const on = (k) => want.size === 0 || want.has(k);

async function waitFor(page, fn, arg, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await sleep(80);
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
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `v05-${n}.png`) });
const A = (fn, arg) => page.evaluate(fn, arg);
const snap = () => A(() => window.__ATRIOX__.snapshot());

async function fresh(room) {
  await page.goto(`http://127.0.0.1:${PORT}/?test`);
  await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await page.mouse.click(640, 360);
  await page.keyboard.press('Enter');
  await waitFor(page, () => !!window.__ATRIOX__?.arena?.player);
  await sleep(600);
  await A((r) => {
    const a = window.__ATRIOX__.arena;
    a.player.godMode = true;
    a.devGotoRoom(r);
  }, room);
  await waitFor(page, (r) => window.__ATRIOX__.snapshot().room === r, room);
}

try {
  if (on('boneco')) {
    await page.goto(`http://127.0.0.1:${PORT}/?test`);
    await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
    await page.keyboard.press('Enter');
    await waitFor(page, () => !!window.__ATRIOX__?.arena?.player);
    await sleep(1200);
    await A(() => window.__ATRIOX__.arena.dummies[0].receiveHit({ damage: 1, knockback: 200, dirX: 1, dirY: 0, tag: 't' }));
    await sleep(80);
    await shot('boneco-golpe');
    await A(() => window.__ATRIOX__.arena.beginTrial());
    await sleep(260);
    await shot('boneco-quebra');
  }
  if (on('provacao')) {
    await fresh('build-1');
    await A(() => {
      const a = window.__ATRIOX__.arena;
      for (const [k, dx] of [['recruit', -220], ['archer', 220], ['guardian', 0]]) a.spawnEnemy(k, a.player.x + dx, a.player.y - 230);
    });
    await sleep(1500);
    await shot('provacao');
    await waitFor(page, () => window.__ATRIOX__.arena.enemies.some((e) => e.def.kind === 'guardian' && e.brain.state === 'attack'), null, 10000, 20);
    await shot('guardiao-impacto');
  }
  if (on('avatar')) {
    await fresh('trial-1');
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.applyGift('avatar');
      a.applyGift('second_sun');
      a.player.glory = 100;
      a.player.avatarCooldown = 0;
    });
    await waitFor(page, () => {
      const a = window.__ATRIOX__.arena;
      if (a.player.avatarT < 0) a.queued.avatar = true;
      return a.player.avatarT >= 450;
    }, null, 6000, 20);
    await shot('apollon-manifesta');
    await waitFor(page, () => window.__ATRIOX__.arena.player.avatarT >= 1150, null, 6000, 20);
    await shot('apollon-feixe');
    await waitFor(page, () => window.__ATRIOX__.arena.player.avatarT < 0, null, 6000, 20);
    await sleep(900);
    await page.mouse.move(820, 300);
    await page.keyboard.press('q');
    await sleep(1250);
    await shot('juizo-pilar');
  }
  if (on('plateia')) {
    await fresh('toknar');
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1200;
      a.player.y = 560;
      a.camTarget = { x: 1200, y: 380 };
    });
    await sleep(1500);
    await shot('plateia');
    await fresh('nemeia');
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.camTarget = { x: 760, y: 420 };
    });
    await sleep(1500);
    await shot('wyverns-pousadas');
  }
  if (on('goblin')) {
    await fresh('trial-1');
    await waitFor(page, () => window.__ATRIOX__.snapshot().alive >= 2, null, 8000);
    await sleep(1800);
    await shot('goblin');
  }
  if (on('orc')) {
    await fresh('trial-2');
    await waitFor(page, () => window.__ATRIOX__.snapshot().alive >= 1, null, 8000);
    await sleep(2400);
    await shot('orc');
  }
  if (on('wyvern')) {
    await fresh('build-2');
    await waitFor(page, () => window.__ATRIOX__.snapshot().wildWyverns >= 1, null, 8000);
    await sleep(300);
    await shot('wyvern-descent');
    await sleep(2500);
    await shot('wyvern');
  }
  if (on('carrasco')) {
    await fresh('executioner');
    await waitFor(page, () => window.__ATRIOX__.snapshot().dialogue, null, 12000);
    await sleep(1600);
    await shot('carrasco-dialogo');
    await page.keyboard.press('Escape');
    await waitFor(page, () => window.__ATRIOX__.snapshot().boss?.state === 'windup', null, 15000);
    await sleep(300);
    await shot('carrasco-windup');
    await waitFor(page, () => window.__ATRIOX__.snapshot().boss?.state === 'active', null, 6000);
    await shot('carrasco-active');
    console.log('carrasco', JSON.stringify((await snap()).boss));
  }
  if (on('toknar')) {
    await fresh('toknar');
    await waitFor(page, () => window.__ATRIOX__.snapshot().dialogue, null, 12000);
    await sleep(1800);
    await shot('toknar-dialogo');
    await page.keyboard.press('Enter');
    await sleep(200);
    await page.keyboard.press('Enter');
    await sleep(900);
    await shot('toknar-dialogo-2');
    await page.keyboard.press('Escape');
    await waitFor(page, () => window.__ATRIOX__.snapshot().toknar?.state === 'windup', null, 15000);
    await sleep(250);
    await shot('toknar-windup');
    await waitFor(page, () => window.__ATRIOX__.snapshot().toknar?.state === 'active', null, 6000);
    await sleep(60);
    await shot('toknar-active');
    console.log('toknar', JSON.stringify((await snap()).toknar));
  }
  if (on('caim')) {
    await fresh('nemeia');
    await waitFor(page, () => window.__ATRIOX__.snapshot().dialogue, null, 12000);
    await sleep(1600);
    await shot('caim-dialogo');
    await page.keyboard.press('Escape');
    await sleep(4000);
    await shot('caim');
  }
} finally {
  console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'sem erros no console');
  await browser.close();
  server.kill();
}
