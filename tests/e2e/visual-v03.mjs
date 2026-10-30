/** Capture the two bosses close to Atriox for visual review; requires a production build. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4319','--strictPort'],{stdio:'ignore'});
let browser;
try {
  await new Promise(r=>setTimeout(r,1000));
  browser=await chromium.launch({executablePath:findChrome(),headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const p=await browser.newPage({viewport:{width:1280,height:720}});
  await p.goto('http://127.0.0.1:4319/?test');
  await p.waitForFunction(()=>window.__ATRIOX_GAME__?.scene.isActive('MenuScene'));
  await p.keyboard.press('Enter');await p.waitForFunction(()=>!!window.__ATRIOX__?.arena?.player);
  await p.evaluate(()=>{const a=window.__ATRIOX__.arena;a.player.godMode=true;a.devGotoRoom('toknar');});
  await p.waitForFunction(()=>!!window.__ATRIOX__.arena.toknar);
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{const a=window.__ATRIOX__.arena,t=a.toknar;a.camTarget=null;a.player.x=t.x+210;a.player.y=t.y+70;a.cameras.main.centerOn(t.x+110,t.y-40);});
  await p.waitForTimeout(600);
  fs.mkdirSync('tests/e2e/screenshots',{recursive:true});
  await p.screenshot({path:'tests/e2e/screenshots/v03-toknar-review.png'});
  await p.evaluate(()=>window.__ATRIOX__.arena.devGotoRoom('nemeia'));
  await p.waitForFunction(()=>window.__ATRIOX__.arena.caim&&!window.__ATRIOX__.arena.caim.scripted);
  await p.waitForTimeout(2100);
  await p.evaluate(()=>{const a=window.__ATRIOX__.arena,c=a.caim;a.camTarget=null;a.player.x=c.x+210;a.player.y=c.y+80;c.defense.mode='shield';c.defense.timer=0;c.defense.shield=105;a.cameras.main.centerOn(c.x+100,c.y-40);});
  await p.waitForTimeout(300);
  await p.screenshot({path:'tests/e2e/screenshots/v03-caim-review.png'});
  await p.keyboard.down('Tab');await p.waitForTimeout(150);
  await p.screenshot({path:'tests/e2e/screenshots/v03-build-review.png'});
  console.log('Visual captures written to tests/e2e/screenshots');
}finally{await browser?.close();server.kill();}
