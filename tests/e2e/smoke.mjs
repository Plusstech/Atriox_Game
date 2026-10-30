/**
 * Teste de ponta a ponta (headless) contra o BUILD DE PRODUÇÃO (dist/).
 * Uso: npm run build && npm run test:e2e
 *
 * Usa playwright-core com um Chromium já instalado em %LOCALAPPDATA%/ms-playwright
 * (ou CHROME_PATH). Não baixa navegadores.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4317;
const GAME_URL = `http://127.0.0.1:${PORT}/?test`;
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium')).sort().reverse();
  for (const d of dirs) {
    for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-linux/chrome']) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(page, fn, arg, timeout = 15000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await sleep(step);
  }
  return false;
}

const active = (page, key) => page.evaluate((k) => !!window.__ATRIOX_GAME__?.scene.isActive(k), key);
const snap = (page) => page.evaluate(() => window.__ATRIOX__?.snapshot());
const arena = (page, code) => page.evaluate(code);

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('vite preview não iniciou')), 20000);
    server.stdout.on('data', (d) => {
      if (String(d).includes(String(PORT))) {
        clearTimeout(to);
        resolve();
      }
    });
    server.on('exit', (c) => reject(new Error(`preview saiu (${c})`)));
  });

  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required']
  });

  try {
    // ------------------------------------------------------------------ partida completa
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto(GAME_URL);
    check('build abre e chega ao menu', await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene')));
    await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

    await page.mouse.click(640, 360);
    await page.keyboard.press('Enter');
    check('menu inicia a partida', await waitFor(page, () => !!window.__ATRIOX__?.arena?.player && window.__ATRIOX_GAME__.scene.isActive('ArenaScene')));
    await sleep(900);
    const s0 = await snap(page);
    check('fase inicial = tutorial', s0.phase === 'tutorial', s0.phase);
    const firstListeners = s0.listeners;

    // movimento
    const p0 = s0.player;
    await page.keyboard.down('d');
    await sleep(400);
    await page.keyboard.up('d');
    await page.keyboard.down('w');
    await sleep(300);
    await page.keyboard.up('w');
    await sleep(200);
    const p1 = (await snap(page)).player;
    const fps = await page.evaluate(() => Math.round(window.__ATRIOX_GAME__.loop.actualFps));
    check('Atriox se movimenta (D e W)', p1.x > p0.x + 10 && p1.y < p0.y - 5, `${p0.x},${p0.y} → ${p1.x},${p1.y} (fps headless ${fps})`);

    // ataque
    await page.mouse.move(900, 300);
    await page.mouse.down();
    await page.mouse.up();
    check('clique inicia combo', await waitFor(page, () => window.__ATRIOX__.arena.player.combo.attacking, null, 1000, 10));
    check('hitbox do golpe surge na janela ativa', await waitFor(page, () => window.__ATRIOX__.arena.hitboxes.all.some((b) => b.spec.tag === 'attack_1'), null, 1000, 10));
    await sleep(500);

    // dash
    // observa o estado a cada quadro do jogo (independente do FPS do headless)
    await page.evaluate(() => {
      const a = window.__ATRIOX__.arena;
      window.__dashSeen = false;
      const fn = () => {
        if (a.player.dash.state === 'dashing' && a.player.hurtbox.invulnerable) window.__dashSeen = true;
      };
      a.events.on('postupdate', fn);
      window.__dashOff = () => a.events.off('postupdate', fn);
    });
    await page.keyboard.press('Space');
    const dashInv = await waitFor(page, () => window.__dashSeen, null, 2000, 20);
    await page.evaluate(() => window.__dashOff());
    const dashInfo = await page.evaluate(() => { const p = window.__ATRIOX__.arena.player; return JSON.stringify({ used: p.usage.dashed, state: p.dash.state, cd: Math.round(p.dash.cooldown.remaining), combo: p.combo.phase, casting: p.spell.casting }); });
    check('dash ativa invulnerabilidade', dashInv, dashInfo);
    await sleep(500);
    check('dash encerra invulnerabilidade', !(await arena(page, () => window.__ATRIOX__.arena.player.hurtbox.invulnerable)));

    // magia
    await page.mouse.click(900, 300, { button: 'right' });
    check('magia dispara projétil', await waitFor(page, () => window.__ATRIOX__.arena.projectiles.count > 0, null, 1500, 10));
    check('magia entra em cooldown', !(await arena(page, () => window.__ATRIOX__.arena.player.spell.cooldown.ready)));
    await page.screenshot({ path: path.join(SHOTS, '02-tutorial.png') });

    // iniciar provação no altar
    await arena(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1200;
      a.player.y = 980;
    });
    await sleep(150);
    await page.keyboard.press('e');
    check('E no altar inicia a onda 1', await waitFor(page, () => window.__ATRIOX__.snapshot().phase === 'wave', null, 2000));
    check('inimigos surgem', await waitFor(page, () => window.__ATRIOX__.snapshot().alive >= 3, null, 4000));
    await sleep(1600);
    await page.screenshot({ path: path.join(SHOTS, '03-wave1.png') });

    // o jogador pode receber dano de verdade (sem modo deus) — inimigos atacam
    const hpBefore = (await snap(page)).hp;
    await arena(page, () => {
      const a = window.__ATRIOX__.arena;
      const e = a.enemies.find((x) => !x.dead);
      a.player.x = e.x + 40;
      a.player.y = e.y;
    });
    const tookDamage = await waitFor(page, (hp) => window.__ATRIOX__.snapshot().hp < hp, hpBefore, 6000, 50);
    check('inimigos perseguem e atacam (jogador recebeu dano)', tookDamage, `hp ${hpBefore} → ${(await snap(page)).hp}`);
    await arena(page, () => (window.__ATRIOX__.arena.player.godMode = true));

    // inimigos mortos não atacam: matar e conferir que nenhuma hitbox inimiga sobra
    await arena(page, () => window.__ATRIOX__.arena.devKillAll());
    await sleep(200);
    const enemyBoxes = await arena(page, () => window.__ATRIOX__.arena.hitboxes.all.filter((b) => b.spec.team === 'enemy' && !b.cancelled).length);
    check('inimigos mortos não deixam ataques ativos', enemyBoxes === 0, `hitboxes inimigas: ${enemyBoxes}`);

    const clearWave = async () => {
      for (let i = 0; i < 12; i++) {
        await arena(page, () => window.__ATRIOX__.arena.devKillAll());
        if (await waitFor(page, () => window.__ATRIOX__.snapshot().phase === 'waveCleared', null, 1300)) return true;
      }
      return false;
    };
    check('onda 1 termina ao derrotar todos', await clearWave());
    await sleep(900);
    await arena(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1200;
      a.player.y = 980;
    });
    await sleep(200);
    await page.keyboard.press('e');
    check('brasa de bênção abre a escolha', await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('RewardScene'), null, 3000));
    await sleep(700);
    await page.screenshot({ path: path.join(SHOTS, '04-reward.png') });
    const dashMulBefore = await arena(page, () => window.__ATRIOX__.arena.player.stats.get('dashCooldownMul'));
    // escolher Passo do Julgamento se oferecida, senão a primeira
    const offerIdx = await page.evaluate(() => {
      const r = window.__ATRIOX_GAME__.scene.getScene('RewardScene');
      return (r.data0?.offer ?? []).indexOf('judgment_step');
    });
    await page.keyboard.press(String(offerIdx >= 0 ? offerIdx + 1 : 1));
    check('bênção concedida', await waitFor(page, () => window.__ATRIOX__.snapshot().blessings.length === 1, null, 3000));
    if (offerIdx >= 0) {
      const after = await arena(page, () => window.__ATRIOX__.arena.player.stats.get('dashCooldownMul'));
      check('recompensa altera atributos (cooldown do dash)', after < dashMulBefore, `${dashMulBefore} → ${after}`);
    } else {
      const b = (await snap(page)).blessings[0];
      check('recompensa registrada', !!b, b);
    }

    check('onda 2 começa', await waitFor(page, () => window.__ATRIOX__.snapshot().phase === 'wave' && window.__ATRIOX__.snapshot().wave === 1, null, 4000));
    await sleep(1500);
    check('onda 2 termina', await clearWave());
    await sleep(900);
    await arena(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1200;
      a.player.y = 980;
    });
    await sleep(200);
    await page.keyboard.press('e');
    await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('RewardScene'), null, 3000);
    await sleep(600);
    await page.keyboard.press('2');
    check('segunda bênção concedida', await waitFor(page, () => window.__ATRIOX__.snapshot().blessings.length === 2, null, 3000));

    // chefe
    check('introdução do chefe', await waitFor(page, () => window.__ATRIOX__.snapshot().phase === 'bossIntro', null, 4000));
    await sleep(2900);
    await page.screenshot({ path: path.join(SHOTS, '05-boss-intro.png') });
    check('combate contra o chefe começa', await waitFor(page, () => window.__ATRIOX__.snapshot().phase === 'boss', null, 6000));
    const telegraphSeen = await waitFor(page, () => window.__ATRIOX__.arena.boss?.brain.state === 'windup' && window.__ATRIOX__.arena.boss.brain.windupProgress > 0.6, null, 8000, 30);
    if (telegraphSeen) await page.screenshot({ path: path.join(SHOTS, '06-boss-telegraph.png') });
    check('chefe executa ataques com telegraph', telegraphSeen);
    await arena(page, () => window.__ATRIOX__.arena.devDamageBoss(0.55));
    check('chefe muda para a fase 2', await waitFor(page, () => window.__ATRIOX__.snapshot().boss?.phase === 2, null, 2000));
    await sleep(700);
    await page.screenshot({ path: path.join(SHOTS, '07-boss-phase2.png') });
    const infernoSeen = await waitFor(page, () => window.__ATRIOX__.arena.boss?.brain.move?.id === 'inferno' && window.__ATRIOX__.arena.boss.brain.windupProgress > 0.5, null, 15000, 30);
    if (infernoSeen) await page.screenshot({ path: path.join(SHOTS, '08-boss-inferno.png') });
    check('golpe exclusivo da fase 2 (Execução Ardente)', infernoSeen);
    await arena(page, () => window.__ATRIOX__.arena.devDamageBoss(1));
    await sleep(800);
    await page.screenshot({ path: path.join(SHOTS, '09-boss-death.png') });
    check('vitória leva à tela de resultado', await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ResultScene'), null, 10000));
    await sleep(800);
    await page.screenshot({ path: path.join(SHOTS, '10-result-victory.png') });
    const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('atriox-cinder.save.v1') ?? '{}'));
    check('save local registra vitória e tentativa', rec.records?.bossVictories >= 1 && rec.records?.attempts >= 1, JSON.stringify(rec.records));

    // reinício sem duplicar listeners/entidades
    const counts = [];
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Enter');
      await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ArenaScene') && window.__ATRIOX__.arena.player && !window.__ATRIOX__.arena.player.dead, null, 5000);
      await sleep(900);
      const s = await snap(page);
      counts.push(s);
      // derrota: dano letal
      await arena(page, () => window.__ATRIOX__.arena.player.receiveHit({ damage: 9999, knockback: 0, dirX: 1, dirY: 0, tag: 'test' }));
      await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ResultScene'), null, 8000);
      if (i === 0) {
        await sleep(700);
        await page.screenshot({ path: path.join(SHOTS, '11-result-defeat.png') });
      }
      await sleep(300);
    }
    check('derrota encerra a partida (jogador pode morrer)', await active(page, 'ResultScene'));
    const same = JSON.stringify(counts[0].listeners) === JSON.stringify(firstListeners) && JSON.stringify(counts[1].listeners) === JSON.stringify(firstListeners);
    check('reiniciar não duplica listeners', same, JSON.stringify(counts.map((c) => c.listeners)));
    check('reiniciar não duplica entidades', counts[0].enemies === 0 && counts[1].enemies === 0 && counts[0].hurtboxes === counts[1].hurtboxes && Math.abs(counts[0].displayObjects - counts[1].displayObjects) <= 2, JSON.stringify(counts.map((c) => [c.enemies, c.hurtboxes, c.displayObjects])));
    const uiCount = await page.evaluate(() => window.__ATRIOX_GAME__.scene.getScenes(false).filter((s) => s.scene.key === 'UIScene').length);
    check('apenas uma instância de UIScene', uiCount === 1);
    check('sem erros de JavaScript na partida', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();

    // ------------------------------------------------------------------ asset ausente + save corrompido
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx2.addInitScript(() => localStorage.setItem('atriox-cinder.save.v1', '{corrompido!!'));
    const page2 = await ctx2.newPage();
    const errors2 = [];
    page2.on('pageerror', (e) => errors2.push(String(e)));
    await page2.route('**/assets/atriox/slash.png', (r) => r.fulfill({ status: 404, body: 'not found' }));
    await page2.goto(GAME_URL);
    check('asset ausente não causa tela preta (menu carrega)', await waitFor(page2, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene')));
    const missing = await page2.evaluate(() => window.__ATRIOX_GAME__.registry.get('missingAssets'));
    check('asset ausente é listado', Array.isArray(missing) && missing.length === 1, JSON.stringify(missing));
    await page2.keyboard.press('Enter');
    check('jogo inicia mesmo com asset ausente e save corrompido', await waitFor(page2, () => !!window.__ATRIOX__?.arena?.player));
    check('sem exceções com save corrompido', errors2.length === 0, errors2.join(' | '));
    await page2.screenshot({ path: path.join(SHOTS, '12-missing-asset.png') });
    await ctx2.close();
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
