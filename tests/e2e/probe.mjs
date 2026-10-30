/**
 * Capturas visuais (headless) dos momentos-chave, contra o build de produção.
 * Uso: npm run build && node tests/e2e/probe.mjs [cenário...]
 * Saída: tests/e2e/screenshots/probe-*.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4318;
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
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `probe-${n}.png`) });
const A = (fn, arg) => page.evaluate(fn, arg);

try {
  await page.goto(`http://127.0.0.1:${PORT}/?test`);
  await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await page.mouse.click(640, 360);
  await page.keyboard.press('Enter');
  await waitFor(page, () => !!window.__ATRIOX__?.arena?.player);
  await sleep(1500);
  if (on('prep')) await shot('01-prep');

  if (on('run')) {
    await page.keyboard.down('d');
    for (let i = 0; i < 4; i++) {
      await sleep(110);
      await shot(`02-run-${i}`);
    }
    await page.keyboard.up('d');
  }

  if (on('combo')) {
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1000;
      a.player.y = 1140;
      a.player.godMode = true;
    });
    await sleep(300);
    await page.mouse.move(900, 380);
    const frames = [];
    for (let k = 0; k < 3; k++) {
      await page.mouse.down();
      await page.mouse.up();
      for (let j = 0; j < 4; j++) {
        await sleep(70);
        frames.push(await A(() => window.__ATRIOX__.snapshot().player.frame));
        await shot(`03-combo-${k}-${j}`);
      }
    }
    console.log('quadros do combo:', frames.join(' '));
    await sleep(600);
  }

  if (on('dash')) {
    await page.keyboard.down('a');
    await page.keyboard.press('Space');
    await sleep(60);
    await shot('04-dash');
    await page.keyboard.up('a');
    await sleep(400);
  }

  if (on('doors')) {
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1200;
      a.player.y = 980;
    });
    await sleep(200);
    await page.keyboard.press('e');
    await sleep(1200);
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 820;
      a.player.y = 420;
    });
    await sleep(700);
    await shot('05-doors');
  }

  if (on('caim')) {
    await A(() => window.__ATRIOX__.arena.devGotoRoom('nemeia'));
    await sleep(2400);
    await shot('06-caim-intro');
    await waitFor(page, () => window.__ATRIOX__.snapshot().caim?.state && window.__ATRIOX__.snapshot().caim.state !== 'intro', null, 8000);
    await A(() => (window.__ATRIOX__.arena.player.godMode = true));
    // espera uma poça e uma invocação
    await waitFor(page, () => window.__ATRIOX__.snapshot().pools > 0, null, 12000);
    await sleep(500);
    await shot('07-caim-pool');
    await waitFor(page, () => window.__ATRIOX__.snapshot().wyverns > 0, null, 15000);
    await sleep(900);
    await shot('08-wyverns');
    await waitFor(page, () => window.__ATRIOX__.arena.wyverns.some((w) => w.brain.state === 'windup'), null, 8000);
    await shot('09-wyvern-windup');
    // dominação: poça sob o jogador, fica parado
    await A(() => {
      const a = window.__ATRIOX__.arena;
      a.pools.clear();
      a.devSpawnPoolAtPlayer();
    });
    await waitFor(page, () => window.__ATRIOX__.snapshot().stunned, null, 5000);
    await sleep(250);
    await shot('10-stunned');
    console.log('stun:', JSON.stringify(await A(() => window.__ATRIOX__.snapshot().player)));
    await sleep(2000);
    await A(() => window.__ATRIOX__.arena.devDamageBoss(1));
    await sleep(1800);
    await shot('11-caim-death');
    await waitFor(page, () => window.__ATRIOX__.snapshot().cinematic, null, 6000);
    for (let i = 0; i < 6; i++) {
      await sleep(1400);
      await shot(`12-blessing-${i}`);
    }
    await sleep(4000);
    await shot('13-result');
  }
} finally {
  console.log(errors.length ? `ERROS: ${errors.join(' | ')}` : 'sem erros de JS');
  await browser.close();
  server.kill();
}
