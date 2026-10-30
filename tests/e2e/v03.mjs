/** v0.3 integration: real production build, keyboard interactions, full room route and gift effects. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const shots = path.join(root, 'tests/e2e/screenshots');
fs.mkdirSync(shots, { recursive: true });
const server = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4318',
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
let browser;
let passed = 0;
const check = (name, value) => {
  assert.ok(value, name);
  passed++;
  console.log(`PASS ${name}`);
};
try {
  await new Promise((ok, no) => {
    const t = setTimeout(() => no(Error('preview timeout')), 15000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('4318')) {
        clearTimeout(t);
        ok();
      }
    });
    server.once('exit', () => no(Error('preview exited')));
  });
  browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const a = (fn) => page.evaluate(fn);
  const wait = (fn) => page.waitForFunction(fn, null, { timeout: 20000 });
  await page.goto('http://127.0.0.1:4318/?test');
  await wait(() => window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await wait(() => !!window.__ATRIOX__?.arena?.player);
  const interact = async (id) => {
    await page.evaluate((id) => {
      const a = window.__ATRIOX__.arena;
      const it = a.interactables.find((i) => i.id === id);
      if (!it) throw Error(`Missing interactable ${id}`);
      a.player.x = it.x;
      a.player.y = it.y;
      a.player.vx = a.player.vy = 0;
    }, id);
    await page.waitForTimeout(180);
    await page.keyboard.press('e');
  };
  await interact('altar');
  await wait(() => window.__ATRIOX__.snapshot().offers.length === 2);
  check(
    'duas portas têm dons diferentes',
    await a(() => {
      const o = window.__ATRIOX__.arena.giftOffers;
      return o.length === 2 && o[0].gift.id !== o[1].gift.id;
    }),
  );
  const stable = await a(() =>
    JSON.stringify(window.__ATRIOX__.snapshot().offers),
  );
  await page.waitForTimeout(400);
  check(
    'aproximação não rerrola ofertas',
    stable ===
      (await a(() => JSON.stringify(window.__ATRIOX__.snapshot().offers))),
  );
  check(
    'resumo e indicadores fora da tela estão acessíveis',
    await a(() => {
      const h = window.__ATRIOX__.arena.getHud();
      return h.options.length === 2 && h.arrows.length > 0;
    }),
  );
  await page.screenshot({ path: path.join(shots, 'v03-portas.png') });
  await a(() => {
    window.__ATRIOX__.arena.player.godMode = true;
    window.__ATRIOX__.arena.time.timeScale = 4;
  });
  const offered = await a(() => window.__ATRIOX__.arena.giftOffers[0].gift.id);
  await interact('door0');
  await page.keyboard.press('e');
  await wait(() => window.__ATRIOX__.arena.run.room.id === 'trial-1');
  check(
    'E concede um único dom e uma única passagem',
    await page.evaluate((id) => {
      const a = window.__ATRIOX__.arena;
      return (
        a.player.gifts.has(id) &&
        a.player.gifts.size === 1 &&
        a.build.level(id) === 1
      );
    }, offered),
  );
  check(
    'sem recompensas durante combate',
    await a(
      () =>
        window.__ATRIOX__.arena.giftOffers.length === 0 &&
        window.__ATRIOX__.arena.interactables.length === 0,
    ),
  );
  // Real room sequence: advance combat with confirmed enemy deaths, then use the actual door interaction.
  const seen = [];
  for (let guard = 0; guard < 12; guard++) {
    await wait(() =>
      ['combat', 'boss'].includes(window.__ATRIOX__.arena.run.phase),
    );
    const room = await a(() => window.__ATRIOX__.arena.run.room.id);
    seen.push(room);
    if (room === 'toknar') break;
    if (room === 'executioner') {
      await wait(
        () =>
          window.__ATRIOX__.arena.boss &&
          !window.__ATRIOX__.arena.boss.scripted,
      );
      await a(() => window.__ATRIOX__.arena.devDamageBoss(2));
    } else {
      await page.waitForFunction(
        () => {
          const a = window.__ATRIOX__.arena;
          a.devKillAll();
          return a.run.phase === 'doors';
        },
        null,
        { timeout: 30000, polling: 150 },
      );
    }
    await wait(() => window.__ATRIOX__.arena.giftOffers.length === 2);
    if (room === 'trial-1') {
      await a(() => {
        const a = window.__ATRIOX__.arena;
        a.player.godMode = false;
        a.player.health.current = 20;
      });
      await interact('buff');
      const state = await a(() => {
        const a = window.__ATRIOX__.arena;
        return JSON.stringify({
          hp: a.player.health.current,
          buff: a.buffActive,
          taken: a.buffTaken,
        });
      });
      await page.keyboard.press('e');
      check(
        'buff complementar é coletado uma vez',
        state ===
          (await a(() => {
            const a = window.__ATRIOX__.arena;
            return JSON.stringify({
              hp: a.player.health.current,
              buff: a.buffActive,
              taken: a.buffTaken,
            });
          })),
      );
      await a(() => (window.__ATRIOX__.arena.player.godMode = true));
    }
    // Every later altar is deliberately skipped.
    await interact('door1');
    await page.waitForFunction(
      (previous) => window.__ATRIOX__.arena.run.room.id !== previous,
      room,
      { timeout: 10000 },
    );
  }
  check(
    'campanha dá cinco combates e Carrasco antes de Toknar',
    seen.includes('build-3') &&
      seen.includes('executioner') &&
      seen.at(-1) === 'toknar',
  );
  await wait(() => !!window.__ATRIOX__.arena.toknar);
  check(
    'Toknar é acessível na campanha e usa sprites',
    await a(() => {
      const a = window.__ATRIOX__.arena;
      return (
        a.toknar.anim.sprite.frame.name.startsWith('toknar_') &&
        a.getHud().boss.name === 'TOKNAR'
      );
    }),
  );
  await page.screenshot({ path: path.join(shots, 'v03-toknar.png') });
  check(
    'drenagem ignora invulnerabilidade e cura por dano de vida confirmado',
    await a(() => {
      const a = window.__ATRIOX__.arena,
        t = a.toknar,
        p = a.player;
      t.health.current = t.health.max - 100;
      t.brain.drainUsed = 0;
      p.godMode = true;
      p.postHitInvuln = 0;
      const before = t.health.current;
      const d0 = p.receiveHit({
        damage: 20,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'toknar_cleave',
      });
      t.confirmedDrain(d0);
      const noHeal = t.health.current === before;
      p.godMode = false;
      p.health.current = p.health.max;
      p.barrier = 0;
      p.barrierHits = 0;
      const d = p.receiveHit({
        damage: 20,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'toknar_cleave',
      });
      t.confirmedDrain(d);
      p.godMode = true;
      return noHeal && d > 0 && t.health.current > before;
    }),
  );
  // Verify all nine gifts through the integrated executor and real entities, avoiding reliance on random offers.
  await a(() => {
    const a = window.__ATRIOX__.arena;
    for (const id of [
      'return_cut',
      'ascending',
      'execution_mark',
      'orbit',
      'second_step',
      'forge',
      'captive_sun',
      'glory_oath',
      'avatar',
    ])
      a.applyGift(id);
  });
  check(
    'dons novos estão adquiríveis e registrados na build',
    await a(() =>
      [
        'return_cut',
        'ascending',
        'execution_mark',
        'orbit',
        'second_step',
        'forge',
        'captive_sun',
        'glory_oath',
        'avatar',
      ].every((id) => window.__ATRIOX__.arena.player.gifts.has(id)),
    ),
  );
  await a(() => {
    const p = window.__ATRIOX__.arena.player;
    window.advancedHits = [];
    const original = p.hooks.onAdvanced;
    p.hooks.onAdvanced = (...args) => {
      window.advancedHits.push(args[0]);
      original(...args);
    };
  });
  await page.mouse.move(800, 350);
  await page.mouse.down();
  await wait(() => window.__ATRIOX__.arena.player.advanced.charging);
  await page.mouse.up();
  await wait(() => window.advancedHits.includes('charged'));
  check(
    'segurar e soltar executa Sentença pelo input real',
    await a(
      () => window.advancedHits.filter((k) => k === 'charged').length === 1,
    ),
  );
  await wait(() => window.__ATRIOX__.arena.player.advanced.action === null);
  await page.keyboard.press('Space');
  await wait(() => window.__ATRIOX__.arena.player.dash.state === 'recovering');
  await page.mouse.click(800, 350);
  await wait(() => window.advancedHits.includes('counter'));
  check('clique após dash executa Corte de Retorno', true);
  await wait(() => window.__ATRIOX__.arena.player.advanced.action === null);
  check(
    'marca consome uma vez e explosão não reaplica',
    await a(() => {
      const a = window.__ATRIOX__.arena,
        t = a.toknar;
      a.skills.confirmed(t, 'attack_3', 20);
      const marked = a.skills.marks.has(t.id);
      a.skills.confirmed(t, 'charged', 54);
      const n = a.hitboxes.all.filter(
        (b) => b.spec.tag === 'mark_explosion',
      ).length;
      a.skills.confirmed(t, 'mark_explosion', 38);
      return marked && !a.skills.marks.has(t.id) && n === 1;
    }),
  );
  check(
    'forja transforma dano e alcance; órbita dispara só uma lâmina',
    await a(() => {
      const a = window.__ATRIOX__.arena;
      a.skills.cast();
      const step = { damage: 30, range: 140, finisher: true };
      const x = a.skills.attack(step, 0);
      const forged =
        x.damage > 30 && x.range > 140 && a.skills.forgeCharges === 2;
      a.skills.onDash();
      a.skills.onDash();
      return (
        forged &&
        a.hitboxes.all.filter((b) => b.spec.tag === 'orbit_blade').length === 1
      );
    }),
  );
  check(
    'dash no vazio não concede eco; ameaça real concede um eco',
    await a(() => {
      const a = window.__ATRIOX__.arena,
        p = a.player;
      a.hitboxes.clear();
      a.skills.reset();
      a.skills.onDash();
      p.dash.tryDash(1, 0, 1);
      a.skills.update(1);
      const empty = a.skills.echoMs === 0;
      a.hitboxes.spawn({
        shape: { kind: 'circle', x: p.x, y: p.y, radius: 20 },
        team: 'enemy',
        damage: 10,
        knockback: 0,
        duration: 100,
        tag: 'test-threat',
      });
      a.skills.update(1);
      const precise = a.skills.echoMs > 0;
      p.dash.stop();
      a.hitboxes.clear();
      return empty && precise;
    }),
  );
  await page.waitForTimeout(500);
  await page.keyboard.press('r');
  await wait(() => !!window.__ATRIOX__.arena.skills.sun);
  await page.keyboard.press('r');
  await wait(() => window.__ATRIOX__.arena.skills.sun === null);
  check(
    'R cria e detona Sol Cativo sem prender a tecla',
    await a(() => window.__ATRIOX__.arena.skills.sun === null),
  );
  await a(() => window.__ATRIOX__.arena.devDamageBoss(2));
  await wait(() => window.__ATRIOX__.arena.giftOffers.length === 2);
  await interact('door0');
  await wait(
    () =>
      window.__ATRIOX__.arena.caim && !window.__ATRIOX__.arena.caim.scripted,
  );
  check(
    'Caim vem depois de Toknar',
    await a(() => window.__ATRIOX__.arena.run.room.id === 'nemeia'),
  );
  check(
    'manto tem vida e ruptura anunciada',
    await a(() => {
      const c = window.__ATRIOX__.arena.caim;
      c.defense.mode = 'shield';
      c.defense.shield = 105;
      const hp = c.health.current;
      c.receiveHit({
        damage: 200,
        knockback: 0,
        dirX: 0,
        dirY: 0,
        tag: 'charged',
      });
      return c.defense.mode === 'rupture' && c.health.current === hp;
    }),
  );
  check(
    'infecção aumenta exposição e é limitada',
    await a(() => {
      const a = window.__ATRIOX__.arena;
      a.caim.brain.phase = 2;
      const p = a.player;
      p.godMode = false;
      p.postHitInvuln = 0;
      p.infectionWard = 0;
      p.health.current = p.health.max;
      for (let i = 0; i < 5; i++)
        a.onPlayerDamaged(1, {
          damage: 1,
          knockback: 0,
          dirX: 0,
          dirY: 0,
          tag: 'caim_infected',
        });
      p.godMode = true;
      return a.infection === 3 && a.infectionMs > 0;
    }),
  );
  await page.screenshot({ path: path.join(shots, 'v03-caim.png') });
  await a(() => {
    const a = window.__ATRIOX__.arena;
    a.caim.defense.mode = 'none';
    a.devDamageBoss(2);
  });
  await wait(() => window.__ATRIOX__.arena.cinematic?.canSkip);
  await page.keyboard.press('e');
  await wait(() => window.__ATRIOX_GAME__.scene.isActive('VictoryChoiceScene'));
  check('vitória oferece encerrar ou Eternidade', true);
  const owned = await a(() =>
    JSON.stringify([...window.__ATRIOX__.arena.player.gifts]),
  );
  await page.keyboard.press('i');
  await wait(() => window.__ATRIOX__.arena.endlessWave === 1);
  check(
    'Eternidade preserva a build da campanha',
    owned ===
      (await a(() =>
        JSON.stringify([...window.__ATRIOX__.arena.player.gifts]),
      )),
  );
  await a(() => {
    const a = window.__ATRIOX__.arena;
    a.endlessWave = 2;
  });
  await page.waitForFunction(
    () => {
      const a = window.__ATRIOX__.arena;
      a.devKillAll();
      return a.endlessWave === 3;
    },
    null,
    { timeout: 30000, polling: 150 },
  );
  await page.waitForFunction(
    () => {
      const a = window.__ATRIOX__.arena;
      a.devKillAll();
      return a.run.phase === 'doors' && a.giftOffers.length === 2;
    },
    null,
    { timeout: 30000, polling: 150 },
  );
  check(
    'Eternidade oferece dons na terceira onda e mantém tetos',
    await a(() => {
      const a = window.__ATRIOX__.arena;
      return (
        a.enemies.length <= 14 &&
        a.hitboxes.all.length <= 120 &&
        a.projectiles.count <= 64
      );
    }),
  );
  await interact('door0');
  await wait(() => window.__ATRIOX__.arena.endlessWave === 4);
  check('porta do infinito continua sem reiniciar a campanha', true);
  await page.screenshot({ path: path.join(shots, 'v03-eternidade.png') });
  console.log(
    'DIAGNOSTICS',
    JSON.stringify(await a(() => window.__ATRIOX__.arena.debugSnapshot())),
  );
  await a(() => {
    const p = window.__ATRIOX__.arena.player;
    p.godMode = false;
    p.postHitInvuln = 0;
    p.barrier = 0;
    p.receiveHit({
      damage: 99999,
      knockback: 0,
      dirX: 0,
      dirY: 0,
      tag: 'test',
    });
  });
  await wait(() => window.__ATRIOX_GAME__.scene.isActive('ResultScene'));
  check(
    'morte no infinito registra resultado local',
    await a(
      () =>
        JSON.parse(localStorage.getItem('atriox-cinder.save.v1')).records
          .eternityBest >= 3,
    ),
  );
  await page.keyboard.press('Enter');
  await wait(() => window.__ATRIOX_GAME__.scene.isActive('ArenaScene'));
  check(
    'reinício limpa dons e perigos da partida anterior',
    await a(() => {
      const a = window.__ATRIOX__.arena;
      return (
        a.player.gifts.size === 0 &&
        !a.skills.sun &&
        !a.toknar &&
        !a.caim &&
        a.endlessWave === 0
      );
    }),
  );
  check('sem exceções de JavaScript', errors.length === 0);
  console.log(`${passed}/${passed} verificações v0.3 passaram.`);
} finally {
  await browser?.close();
  server.kill();
}
