import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createSiteServer } from './serve.mjs';

await mkdir('artifacts',{recursive:true});
const server=createSiteServer('dist');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const executablePath=process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome');
let browser;
try{
  browser=await chromium.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto(`http://127.0.0.1:${port}/?test=1&paused&time=6`);await page.waitForFunction(()=>window.__lost?.frames>2);
  assert.equal(await page.evaluate(()=>window.__lost.renderer),'WebGL');
  await page.screenshot({path:'artifacts/browser-webgl.png'});
  await page.getByRole('button',{name:'Sniff 3',exact:true}).click();assert.equal(await page.evaluate(()=>window.__lost.rat.requested),'sniff');
  await page.getByRole('button',{name:'Groom 5',exact:true}).click();assert.equal(await page.evaluate(()=>window.__lost.rat.requested),'groom');
  await page.getByRole('button',{name:'Face northwest',exact:true}).click();
  await page.evaluate(()=>window.__lost.advance(2));assert.equal(await page.evaluate(()=>window.__lost.rat.current.action),'groom');
  await page.locator('#mood').fill('100');await page.evaluate(()=>window.__lost.advance(4));assert.ok(await page.evaluate(()=>window.__lost.rat.current.mood)>.98);
  await page.screenshot({path:'artifacts/browser-home.png'});
  await page.getByRole('button',{name:'Resume',exact:false}).click();
  await page.locator('h1').click({force:true});await page.keyboard.press('3');assert.equal(await page.evaluate(()=>window.__lost.rat.requested),'sniff');
  await page.keyboard.press('h');assert.equal(await page.locator('#controls').isVisible(),false);await page.keyboard.press('h');
  await page.getByRole('button',{name:'Open field notes'}).click();assert.equal(await page.locator('dialog').isVisible(),true);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Reset',exact:false}).click();
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.__lost.rat.current.speed>.3);await page.keyboard.up('ArrowRight');assert.equal(await page.evaluate(()=>window.__lost.rat.requested),'idle');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/browser-mobile.png'});
  assert.ok(await page.locator('#controls').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(`http://127.0.0.1:${port}/?test=1&renderer=canvas&paused&time=6`);await page.waitForFunction(()=>window.__lost?.frames>2);
  assert.equal(await page.evaluate(()=>window.__lost.renderer),'Canvas 2D');await page.screenshot({path:'artifacts/browser-canvas-mobile.png'});
  await page.setViewportSize({width:1440,height:960});await page.screenshot({path:'artifacts/browser-canvas.png'});
  assert.deepEqual(errors,[]);console.log('Browser checks passed: WebGL, Canvas, desktop/mobile, actions, facing, mood, keyboard, pause, notes.');
}finally{await browser?.close();server.close();}
