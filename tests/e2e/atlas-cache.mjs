/** Reproduce a returning player's v0.2 atlas cache, then require the real Toknar frame. */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

// Model a cached pre-v0.3 atlas without requiring Git history in fresh clones.
const legacyManifest = JSON.parse(fs.readFileSync('public/assets/atlas/characters.json','utf8'));
legacyManifest.textures = legacyManifest.textures.filter(t=>!t.image.startsWith('advanced-'));
delete legacyManifest.meta.origins.toknar;
delete legacyManifest.meta.advancedFrames;
const oldAtlas = JSON.stringify(legacyManifest);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4321','--strictPort'], {stdio:'ignore'});
let browser;
try {
  await new Promise(r=>setTimeout(r,1000));
  browser = await chromium.launch({executablePath:findChrome(),headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  let legacyRequests=0;
  const textureURLs=[];
  await page.route('**/assets/atlas/characters.json', route=>{legacyRequests++;return route.fulfill({contentType:'application/json',body:oldAtlas});});
  page.on('request',r=>{if(r.url().includes('/assets/atlas/')&&r.url().includes('.webp'))textureURLs.push(r.url());});
  await page.goto('http://127.0.0.1:4321/?test');
  await page.waitForFunction(()=>window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!!window.__ATRIOX__?.arena?.player);
  await page.evaluate(()=>{const a=window.__ATRIOX__.arena;a.player.godMode=true;a.devGotoRoom('toknar');});
  await page.waitForFunction(()=>!!window.__ATRIOX__.arena.toknar);
  const frame = await page.evaluate(()=>window.__ATRIOX__.arena.toknar.anim.sprite.frame.name);
  console.log(JSON.stringify({frame,legacyRequests,textureURLs}));
  fs.mkdirSync('tests/e2e/screenshots',{recursive:true});
  await page.screenshot({path:'tests/e2e/screenshots/atlas-cache.png'});
  assert.ok(frame.startsWith('toknar_'),`Toknar virou ${frame} com atlas antigo em cache`);
  assert.equal(legacyRequests,0,'O atlas deve estar ligado ao bundle, sem buscar JSON antigo');
  assert.ok(textureURLs.length>=4 && textureURLs.every(url=>new URL(url).searchParams.has('v')),'Todas as páginas precisam de versão');
  console.log('PASS cache antigo não troca Toknar por Apollon; atlas e imagens sincronizados');
}finally {await browser?.close();server.kill();}
