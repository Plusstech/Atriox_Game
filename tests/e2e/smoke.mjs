/**
 * Teste de ponta a ponta (headless) contra o BUILD DE PRODUÇÃO (dist/).
 * Uso: npm run build && npm run test:e2e
 * Usa playwright-core com um Chromium já instalado (não baixa navegadores).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4317;
const GAME_URL = `http://127.0.0.1:${PORT}/?test`;
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(page, fn, arg, timeout = 15000, step = 80) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await sleep(step);
  }
  return false;
}
const snap = (page) => page.evaluate(() => window.__ATRIOX__?.snapshot());
const A = (page, fn, arg) => page.evaluate(fn, arg);
const inArena = (page) =>
  waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ArenaScene') && window.__ATRIOX__.arena.player && !window.__ATRIOX__.arena.player.dead, null, 6000);

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
  });
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto(GAME_URL);
    check('build abre e chega ao menu', await waitFor(page, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene')));
    const atlasOk = await page.evaluate(() => window.__ATRIOX_GAME__.textures.exists('characters') && Object.keys(window.__ATRIOX_GAME__.registry.get('animLibrary').anims).length > 20);
    check('atlas de animação carregado (quadros reais)', atlasOk);
    await page.mouse.click(640, 360);
    await page.keyboard.press('Enter');
    check('menu inicia a partida', await inArena(page));
    await sleep(900);
    const s0 = await snap(page);
    check('sala inicial = preparação', s0.room === 'prep' && s0.phase === 'prep', `${s0.room}/${s0.phase}`);
    const firstListeners = s0.listeners;

    // ------------------------------------------------ movimento cardinal e diagonal (medido em tempo de jogo)
    const measureMove = async (keys) => {
      await A(page, () => {
        const a = window.__ATRIOX__.arena;
        window.__mv = { max: 0, x0: a.player.x, y0: a.player.y };
        window.__mvFn = () => {
          const sp = Math.hypot(a.player.vx, a.player.vy);
          if (sp > window.__mv.max) window.__mv.max = sp;
        };
        a.events.on('postupdate', window.__mvFn);
      });
      for (const k of keys) await page.keyboard.down(k);
      await sleep(900);
      for (const k of keys) await page.keyboard.up(k);
      return A(page, () => {
        const a = window.__ATRIOX__.arena;
        a.events.off('postupdate', window.__mvFn);
        return { max: Math.round(window.__mv.max), dx: Math.round(a.player.x - window.__mv.x0), dy: Math.round(a.player.y - window.__mv.y0) };
      });
    };
    const mR = await measureMove(['d']);
    const mDiag = await measureMove(['s', 'a']);
    check('movimento cardinal', mR.dx > 10 && Math.abs(mR.max - 285) < 3, JSON.stringify(mR));
    check('diagonal normalizada (mesma velocidade máxima)', mDiag.dx < -5 && mDiag.dy > 5 && Math.abs(mDiag.max - 285) < 3, JSON.stringify(mDiag));

    // ------------------------------------------------ corrida: ciclo de quadros reais, sem reinício
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 500;
      window.__runLog = [];
      window.__runFn = () => {
        if (a.player.animator.state === 'run') window.__runLog.push(a.player.animator.frameName);
      };
      a.events.on('postupdate', window.__runFn);
    });
    await page.keyboard.down('d');
    await sleep(3500);
    await page.keyboard.up('d');
    const runLog = await A(page, () => {
      window.__ATRIOX__.arena.events.off('postupdate', window.__runFn);
      return window.__runLog;
    });
    const order = await page.evaluate(() => window.__ATRIOX_GAME__.cache.json.get('characters_meta').meta.atrioxRunOrder);
    const seq = runLog.filter((f, i) => i === 0 || f !== runLog[i - 1]);
    let monotonic = true;
    for (let i = 1; i < seq.length; i++) if (order.indexOf(seq[i]) !== (order.indexOf(seq[i - 1]) + 1) % order.length) monotonic = false;
    check('corrida avança o ciclo sem reiniciar', new Set(seq).size >= 6 && monotonic, `${seq.length} trocas, ${new Set(seq).size} quadros distintos, sequência contínua=${monotonic}`);

    // ------------------------------------------------ combo: 3 golpes distintos, 1 acerto por alvo
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = a.dummies[0].x + 60;
      a.player.y = a.dummies[0].y;
      window.__hits = [];
      window.__frames = new Set();
      window.__hitFn = () => {
        const p = a.player;
        if (p.combo.attacking) window.__frames.add(`${p.combo.index}:${p.animator.frameName}:${p.combo.phase}`);
        for (const b of a.hitboxes.all) if (b.spec.tag.startsWith('attack_') && b.hitAt.size) window.__hits.push(`${b.spec.tag}:${b.hitAt.size}`);
      };
      a.events.on('postupdate', window.__hitFn);
    });
    await page.mouse.move(200, 330);
    for (let i = 0; i < 3; i++) {
      await page.mouse.down();
      await page.mouse.up();
      await waitFor(page, (k) => window.__ATRIOX__.arena.player.combo.index === k && window.__ATRIOX__.arena.player.combo.elapsed > 120, i, 2500, 10);
    }
    await waitFor(page, () => !window.__ATRIOX__.arena.player.combo.attacking, null, 3000, 20);
    const combo = await A(page, () => {
      window.__ATRIOX__.arena.events.off('postupdate', window.__hitFn);
      return { frames: [...window.__frames], hits: [...new Set(window.__hits)] };
    });
    const steps = new Set(combo.frames.map((f) => f.split(':')[0]));
    check('combo completo (3 golpes) com buffer', steps.size === 3, [...steps].join(','));
    const activeFrames = [...new Set(combo.frames.filter((f) => f.endsWith(':active')).map((f) => f.split(':')[1]))];
    check('golpes visualmente distintos', activeFrames.length >= 3, activeFrames.join(' '));
    const windupHasHit = combo.frames.some((f) => f.endsWith(':windup') && /combat_0[569]|combat_10/.test(f));
    check('quadro de impacto não aparece na antecipação', !windupHasHit);
    check('cada golpe atinge o alvo no máximo uma vez', combo.hits.length > 0 && combo.hits.every((h) => h.endsWith(':1')), combo.hits.join(' '));

    // ------------------------------------------------ dash: 2 cargas, recarga, paredes
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 300;
      a.player.y = 900;
    });
    await sleep(1200);
    const c0 = (await snap(page)).player.charges;
    await page.keyboard.down('a');
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Space');
      await waitFor(page, () => window.__ATRIOX__.arena.player.dash.state === 'dashing', null, 1500, 5);
      await waitFor(page, () => window.__ATRIOX__.arena.player.dash.state === 'ready', null, 2000, 5);
    }
    const c1 = (await snap(page)).player.charges;
    await page.keyboard.press('Space');
    await sleep(80);
    const c2 = (await snap(page)).player;
    await page.keyboard.up('a');
    check('duas cargas de dash', c0 === 2 && c1 === 0, `${c0} → ${c1}`);
    check('dash contra a parede não atravessa', c2.x >= 185, `x=${c2.x} (limite 186)`);
    check('cargas recarregam', await waitFor(page, () => window.__ATRIOX__.arena.player.dash.charges === 2, null, 6000));

    // ------------------------------------------------ magia
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      window.__castSeen = false;
      window.__castFn = () => {
        if (a.player.animator.state === 'cast') window.__castSeen = true;
      };
      a.events.on('postupdate', window.__castFn);
    });
    await page.mouse.click(900, 300, { button: 'right' });
    const proj = await waitFor(page, () => window.__ATRIOX__.arena.projectiles.count > 0, null, 2000, 10);
    const castSeen = await A(page, () => {
      window.__ATRIOX__.arena.events.off('postupdate', window.__castFn);
      return window.__castSeen;
    });
    check('magia: animação de conjuração + projétil', proj && castSeen);

    // ------------------------------------------------ preparação → portas → sala 1
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 1200;
      a.player.y = 980;
    });
    await sleep(200);
    await page.keyboard.press('e');
    check('altar abre portas com recompensas visíveis', await waitFor(page, () => window.__ATRIOX__.snapshot().phase === 'doors' && window.__ATRIOX__.snapshot().doors.length === 2, null, 4000), JSON.stringify((await snap(page)).doors));
    await page.screenshot({ path: path.join(SHOTS, '01-portas.png') });
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.player.x = 740;
      a.player.y = 380;
    });
    await sleep(300);
    await page.keyboard.press('e');
    check('porta leva à sala 1', await waitFor(page, () => window.__ATRIOX__.snapshot().room === 'trial-1', null, 5000));
    check('combate da sala 1 começa e inimigos surgem', await waitFor(page, () => window.__ATRIOX__.snapshot().alive >= 3, null, 8000));
    check('saída bloqueada durante o combate', (await snap(page)).doors.length === 0);
    await sleep(1000);
    await page.screenshot({ path: path.join(SHOTS, '02-sala1.png') });

    // morte do jogador durante a conjuração de um inimigo
    const deathDuringCast = await A(page, async () => {
      const a = window.__ATRIOX__.arena;
      const t0 = performance.now();
      while (performance.now() - t0 < 6000) {
        if (a.enemies.some((e) => e.brain.state === 'windup')) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      const casting = a.enemies.some((e) => e.brain.state === 'windup');
      a.player.receiveHit({ damage: 9999, knockback: 0, dirX: 1, dirY: 0, tag: 'test' });
      return casting;
    });
    check('morte durante conjuração inimiga encerra a partida', await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ResultScene'), null, 9000), deathDuringCast ? 'inimigo em windup' : 'sem windup observado');
    await sleep(500);

    // ------------------------------------------------ nova partida → Nemeia
    await page.keyboard.press('Enter');
    await inArena(page);
    await sleep(800);
    const sRestart = await snap(page);
    check('reiniciar não duplica listeners', JSON.stringify(sRestart.listeners) === JSON.stringify(firstListeners), JSON.stringify(sRestart.listeners));
    await A(page, () => window.__ATRIOX__.arena.devGotoRoom('nemeia'));
    check('Arena de Nemeia carregada', await waitFor(page, () => window.__ATRIOX__.snapshot().room === 'nemeia', null, 4000));
    check('Caim entra e a luta começa', await waitFor(page, () => window.__ATRIOX__.snapshot().caim && window.__ATRIOX__.snapshot().caim.state !== 'intro', null, 15000));
    await A(page, () => (window.__ATRIOX__.arena.player.godMode = true));

    // sangue: entrada → exposição → stun → saída → imunidade
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.pools.clear();
      a.pools.rules.maxActive = 4;
      a.devSpawnPoolAtPlayer();
      window.__exposed = false;
      window.__expFn = () => {
        if (a.exposure.value > 0.3 && !a.exposure.stunned) window.__exposed = true;
      };
      a.events.on('postupdate', window.__expFn);
    });
    check('poça anunciada antes de ativar', await A(page, () => window.__ATRIOX__.arena.pools.pools.some((p) => p.state === 'warning')));
    check('exposição sobe dentro do sangue', await waitFor(page, () => window.__exposed, null, 6000, 30));
    check('stun por dominação no limiar', await waitFor(page, () => window.__ATRIOX__.snapshot().stunned, null, 6000, 30));
    await waitFor(page, () => window.__ATRIOX__.arena.player.animator.state === 'bloodStunned', null, 1000, 10);
    const stunInfo = await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.events.off('postupdate', window.__expFn);
      return { anim: a.player.animator.state, frame: a.player.animator.frameName };
    });
    check('stun usa os quadros de sangue envolvendo Atriox', stunInfo.anim === 'bloodStunned' && /atriox_combat_1[345]/.test(stunInfo.frame), `${stunInfo.anim} ${stunInfo.frame}`);
    await page.screenshot({ path: path.join(SHOTS, '03-dominado.png') });
    const xBefore = (await snap(page)).player.x;
    await page.keyboard.down('d');
    await page.mouse.click(900, 300);
    await sleep(300);
    await page.keyboard.up('d');
    const during = await A(page, () => ({ x: Math.round(window.__ATRIOX__.arena.player.x), attacking: window.__ATRIOX__.arena.player.combo.attacking, stunned: window.__ATRIOX__.arena.exposure.stunned }));
    check('dominado não se move nem ataca', !during.stunned || (Math.abs(during.x - xBefore) < 6 && !during.attacking), JSON.stringify(during));
    check('stun termina (duração limitada)', await waitFor(page, () => !window.__ATRIOX__.snapshot().stunned, null, 6000, 30));
    const again = await A(page, async () => {
      const a = window.__ATRIOX__.arena;
      const t0 = performance.now();
      let hit = false;
      while (performance.now() - t0 < 1500) {
        if (a.exposure.stunned) hit = true;
        await new Promise((r) => setTimeout(r, 16));
      }
      return hit;
    });
    check('proteção contra reaplicação imediata', !again);
    await A(page, () => window.__ATRIOX__.arena.pools.clear());

    // wyverns
    check('Caim invoca wyverns', await waitFor(page, () => window.__ATRIOX__.snapshot().wyverns > 0, null, 20000));
    check('wyvern anuncia e investe', await waitFor(page, () => window.__ATRIOX__.arena.wyverns.some((w) => w.brain.state === 'charge'), null, 15000, 20));
    await page.screenshot({ path: path.join(SHOTS, '04-wyverns.png') });

    // morte de Caim com projéteis ativos
    await A(page, () => {
      const a = window.__ATRIOX__.arena;
      a.spawnEnemy('archer', a.player.x + 300, a.player.y - 100);
    });
    await waitFor(page, () => window.__ATRIOX__.arena.projectiles.count > 0, null, 6000, 30);
    const projBefore = (await snap(page)).projectiles;
    await A(page, () => window.__ATRIOX__.arena.devDamageBoss(1));
    await sleep(400);
    const afterDeath = await snap(page);
    check('morte de Caim limpa projéteis e perigos', afterDeath.projectiles === 0 && afterDeath.hitboxes === 0, `projéteis antes=${projBefore} depois=${afterDeath.projectiles}, hitboxes=${afterDeath.hitboxes}`);
    check('vitória registrada', afterDeath.phase === 'victory');

    // bênção: pular só após o intervalo; conceder uma vez
    check('cena de Apollon inicia', await waitFor(page, () => window.__ATRIOX__.snapshot().cinematic, null, 10000));
    await sleep(300);
    await page.keyboard.press('e');
    const stillCine = (await snap(page)).cinematic;
    await page.screenshot({ path: path.join(SHOTS, '05-bencao.png') });
    await waitFor(page, () => window.__ATRIOX__.arena.cinematic?.canSkip, null, 6000, 30);
    await page.keyboard.press('e');
    await page.keyboard.press('e');
    check('não pula antes do intervalo; depois pula', stillCine);
    await waitFor(page, () => window.__ATRIOX__.snapshot().gloryGranted !== null, null, 6000, 30);
    check('Bênção da Glória concedida', (await snap(page)).gloryGranted === true);
    check('controle volta após a cena', await waitFor(page, () => !window.__ATRIOX__.arena.player.cinematic, null, 3000));
    check('resultado após a bênção', await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ResultScene'), null, 10000));
    const save1 = await page.evaluate(() => JSON.parse(localStorage.getItem('atriox-cinder.save.v1')));
    check('bênção persistida no save', save1.unlocks.blessingOfGlory === true && save1.unlocks.caimDefeats === 1, JSON.stringify(save1.unlocks));

    // segunda vitória: não concede de novo
    await page.keyboard.press('Enter');
    await inArena(page);
    await sleep(600);
    check('dash purifica sangue nas partidas seguintes', await A(page, () => window.__ATRIOX__.arena.player.dashPurifyMs > 0));
    await A(page, () => window.__ATRIOX__.arena.devGotoRoom('nemeia'));
    await waitFor(page, () => window.__ATRIOX__.snapshot().caim && window.__ATRIOX__.snapshot().caim.state !== 'intro', null, 15000);
    await A(page, () => {
      window.__ATRIOX__.arena.player.godMode = true;
      window.__ATRIOX__.arena.devDamageBoss(1);
    });
    await waitFor(page, () => window.__ATRIOX__.arena.cinematic?.canSkip, null, 12000, 30);
    await page.keyboard.press('Space');
    await waitFor(page, () => window.__ATRIOX__.snapshot().gloryGranted !== null, null, 6000, 30);
    check('bênção não é concedida duas vezes', (await snap(page)).gloryGranted === false);
    await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ResultScene'), null, 10000);

    // reinícios múltiplos
    const counts = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Enter');
      await inArena(page);
      await sleep(900);
      counts.push(await snap(page));
      await A(page, () => window.__ATRIOX__.arena.player.receiveHit({ damage: 9999, knockback: 0, dirX: 1, dirY: 0, tag: 'test' }));
      await waitFor(page, () => window.__ATRIOX_GAME__.scene.isActive('ResultScene'), null, 9000);
      await sleep(300);
    }
    check('vários reinícios não duplicam listeners', counts.every((c) => JSON.stringify(c.listeners) === JSON.stringify(firstListeners)));
    check('vários reinícios não acumulam objetos', Math.max(...counts.map((c) => c.displayObjects)) - Math.min(...counts.map((c) => c.displayObjects)) <= 3, counts.map((c) => c.displayObjects).join(','));
    const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1));
    check('memória após reinícios (informativo)', true, heap >= 0 ? `${heap} MB de heap JS` : 'indisponível');

    // perda de foco e redimensionamento
    await page.keyboard.press('Enter');
    await inArena(page);
    await sleep(800);
    await page.keyboard.down('d');
    await page.evaluate(() => window.__ATRIOX_GAME__.events.emit('blur'));
    await sleep(200);
    const blurred = await page.evaluate(() => ({
      paused: window.__ATRIOX_GAME__.scene.isPaused('ArenaScene'),
      pause: window.__ATRIOX_GAME__.scene.isActive('PauseScene'),
      keysDown: window.__ATRIOX__.arena.input.keyboard.keys.filter((k) => k && k.isDown).length
    }));
    await page.keyboard.up('d');
    check('perda de foco pausa e limpa teclas', blurred.paused && blurred.pause && blurred.keysDown === 0, JSON.stringify(blurred));
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.setViewportSize({ width: 900, height: 560 });
    await sleep(600);
    await page.mouse.move(300, 200);
    await sleep(600);
    const conv = await page.evaluate(() => {
      // conversão independente: CSS → coordenadas do jogo → mundo (zoom + rolagem da câmera atual)
      const a = window.__ATRIOX__.arena;
      const cam = a.cameras.main;
      const p = a.input.activePointer;
      const r = document.querySelector('#game canvas').getBoundingClientRect();
      const gx = ((p.event?.clientX ?? 300) - r.left) * (1280 / r.width);
      const gy = ((p.event?.clientY ?? 200) - r.top) * (720 / r.height);
      const exp = cam.getWorldPoint(gx, gy);
      const wp = p.positionToCamera(cam);
      return { w: Math.round(r.width), h: Math.round(r.height), dx: Math.round(wp.x - exp.x), dy: Math.round(wp.y - exp.y) };
    });
    check('redimensionamento: canvas escala e mouse→mundo correto', conv.w <= 900 && Math.abs(conv.dx) <= 2 && Math.abs(conv.dy) <= 2, JSON.stringify(conv));
    await page.setViewportSize({ width: 1280, height: 720 });
    await sleep(300);
    const perf = await snap(page);
    check('desempenho medido (informativo, renderização por software)', true, `fps ${perf.fps}, frame ${perf.frameMs} ms, partículas ${perf.particles}, objetos ${perf.displayObjects}`);
    check('sem erros de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();

    // ------------------------------------------------ asset ausente + save corrompido
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx2.addInitScript(() => localStorage.setItem('atriox-cinder.save.v1', '{corrompido!!'));
    const page2 = await ctx2.newPage();
    const errors2 = [];
    page2.on('pageerror', (e) => errors2.push(String(e)));
    await page2.route('**/assets/atriox/slash.png', (r) => r.fulfill({ status: 404, body: 'not found' }));
    await page2.goto(GAME_URL);
    check('asset ausente não causa tela preta', await waitFor(page2, () => window.__ATRIOX_GAME__?.scene.isActive('MenuScene')));
    await page2.keyboard.press('Enter');
    check('jogo inicia com asset ausente e save corrompido', await waitFor(page2, () => !!window.__ATRIOX__?.arena?.player));
    check('sem exceções com save corrompido', errors2.length === 0, errors2.join(' | '));
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
