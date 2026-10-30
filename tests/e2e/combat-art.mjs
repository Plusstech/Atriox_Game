/** Real input + confirmed damage: standing charge, clean frames and committed aim. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4322',
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
let browser,
  passed = 0;
const check = (name, value) => {
  assert.ok(value, name);
  passed++;
  console.log(`PASS ${name}`);
};
try {
  await new Promise((r) => setTimeout(r, 1000));
  browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const A = (fn) => page.evaluate(fn),
    wait = (fn) => page.waitForFunction(fn, null, { timeout: 20000 });
  await page.goto('http://127.0.0.1:4322/?test');
  await wait(() => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await wait(() => !!window.__ATRIOX__?.arena?.player);
  await A(() => {
    const a = window.__ATRIOX__.arena,
      p = a.player,
      d = a.dummies[0];
    p.x = d.x - 65;
    p.y = d.y;
    p.godMode = true;
    window.artHits = [];
    window.artFrames = [];
    const original = d.receiveHit.bind(d);
    d.receiveHit = (hit) => {
      window.artHits.push({
        tag: hit.tag,
        frame: p.animator.frameName,
        phase: p.combo.phase,
        advanced: p.advanced.action,
        elapsed: p.advanced.elapsed,
        angle: p.attackAngle,
      });
      return original(hit);
    };
    a.events.on('postupdate', () => {
      if (p.combo.attacking || p.advanced.action)
        window.artFrames.push({
          state: p.animator.state,
          frame: p.animator.frameName,
          phase: p.combo.phase,
        });
    });
    a.applyGift('forge');
    a.applyGift('orbit');
    a.applyGift('ascending');
    a.applyGift('execution_mark');
    a.applyGift('glory_blade');
    a.skills.cast();
  });
  await page.waitForTimeout(600);
  await page.mouse.move(930, 360);
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(930, 360);
    await page.waitForFunction(
      (i) => {
        const p = window.__ATRIOX__.arena.player;
        return p.combo.index === i && p.combo.elapsed > 120;
      },
      i,
      { timeout: 10000 },
    );
  }
  await wait(() => !window.__ATRIOX__.arena.player.combo.attacking);
  check(
    'três golpes com Forja/Marca/Órbita preservam os novos sprites',
    await A(
      () =>
        window.artFrames.every(
          (f) => !['orbit', 'execution_mark', 'second_step'].includes(f.state),
        ) &&
        // v0.5: o finalizador usa o corte diagonal próprio (atriox_combo_3)
        ['atriox_horizontal', 'atriox_return', 'atriox_diagonal'].every(
          (prefix) => window.artFrames.some((f) => f.frame.startsWith(prefix)),
        ),
    ),
  );
  check(
    'hits básicos confirmados aparecem somente nos quadros ativos 4 e 5',
    await A(() => {
      const hits = window.artHits.filter((h) => h.tag.startsWith('attack_'));
      return (
        hits.length > 0 &&
        hits.every((h) => h.phase === 'active' && /_0[34]$/.test(h.frame))
      );
    }),
  );
  check(
    'cada golpe básico confirma dano uma vez no alvo',
    await A(() => {
      const hits = window.artHits.filter((h) => h.tag.startsWith('attack_'));
      return ['attack_1', 'attack_2', 'attack_3'].every(
        (tag) => hits.filter((h) => h.tag === tag).length === 1,
      );
    }),
  );
  await A(() => {
    const a = window.__ATRIOX__.arena,
      p = a.player,
      d = a.dummies[0];
    p.x = d.x - 65;
    p.y = d.y;
    p.vx = p.vy = 0;
    p.combo.interrupt();
    a.skills.reset();
    window.artHits = [];
  });
  await page.waitForTimeout(500);
  await page.mouse.down();
  await wait(() => window.__ATRIOX__.arena.player.advanced.charging);
  check(
    'carga usa os quatro quadros em pé',
    await A(() =>
      window.__ATRIOX__.arena.player.animator.frameName.startsWith(
        'atriox_charge_',
      ),
    ),
  );
  const count = await A(() => window.artHits.length);
  await page.waitForTimeout(400);
  check(
    'manter a carga não causa hits',
    count === (await A(() => window.artHits.length)),
  );
  fs.mkdirSync('tests/e2e/screenshots', { recursive: true });
  await page.screenshot({
    path: 'tests/e2e/screenshots/combat-charge-standing.png',
  });
  await page.mouse.up();
  await wait(
    () => window.__ATRIOX__.arena.player.advanced.action === 'charged',
  );
  const committed = await A(() => window.__ATRIOX__.arena.player.attackAngle);
  await page.mouse.move(80, 360);
  await wait(() => window.artHits.some((h) => h.tag === 'charged'));
  check(
    'Sentença confirma um hit, no quadro de impacto, sem mudar de direção durante o golpe',
    await page.evaluate((angle) => {
      const hits = window.artHits.filter((h) => h.tag === 'charged');
      return (
        hits.length === 1 &&
        hits[0].frame.startsWith('atriox_ascending_') &&
        /_0[34]$/.test(hits[0].frame) &&
        Math.abs(hits[0].angle - angle) < 0.001
      );
    }, committed),
  );
  await wait(() => window.__ATRIOX__.arena.player.advanced.action === null);
  await page.mouse.click(930, 360);
  await wait(() => window.__ATRIOX__.arena.player.combo.attacking);
  check('combo continua acessível após a carga', true);
  await wait(() => !window.__ATRIOX__.arena.player.combo.attacking);
  await page.mouse.down();
  await wait(() => window.__ATRIOX__.arena.player.advanced.charging);
  await A(() => window.__ATRIOX_GAME__.events.emit('blur'));
  await wait(() => window.__ATRIOX_GAME__.scene.isActive('PauseScene'));
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  check(
    'perder foco durante a carga limpa o botão e não prende a pose',
    await A(() => {
      const a = window.__ATRIOX__.arena;
      return (
        !a.attackHeld &&
        !a.player.advanced.charging &&
        !a.player.advanced.action &&
        a.player.animator.state !== 'charge_hold'
      );
    }),
  );
  check('sem exceções de JavaScript', errors.length === 0);
  console.log(`${passed}/${passed} verificações de arte/combate passaram`);
} finally {
  await browser?.close();
  server.kill();
}
