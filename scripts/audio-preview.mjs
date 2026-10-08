import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createSiteServer } from './serve.mjs';
import { wav } from './wav.mjs';
await mkdir('artifacts',{recursive:true});
await build({entryPoints:['scripts/audio-harness.ts'],bundle:true,format:'iife',outfile:'artifacts/audio-harness.js'});
await writeFile('artifacts/audio-harness.html','<!doctype html><title>Offline sound check</title><script src="audio-harness.js"></script>');
const server=createSiteServer('.');await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/artifacts/audio-harness.html`);
 const metrics={};
 const music=await page.evaluate(()=>window.renderMusicLoop());
 assert.ok(music.metrics.decodedBytes<48*1024*1024);
 assert.ok(music.metrics.peak<.98&&music.metrics.jump<.05);
 assert.ok(music.metrics.categoryMuted<.00001&&music.metrics.masterMuted<.00001);
 assert.ok(music.metrics.beforeSeam>.001&&music.metrics.afterSeam>.001&&music.metrics.afterLoop>.001);
 await writeFile('artifacts/audio-music-loop.wav',wav(music.channels,music.rate));metrics.music=music.metrics;
 for(const solo of [undefined,'rat','people']){
   const {channels,rate,metrics:result}=await page.evaluate(solo=>window.renderAudio(45,solo),solo);
   assert.ok(result.peak<.98&&result.rms>.0001);assert.ok(result.maxVoices<=40);assert.ok(result.stereoDifference>0);
   const name=solo??'street';await writeFile(`artifacts/audio-${name}.wav`,wav(channels,rate));metrics[name]=result;
 }
 await writeFile('artifacts/audio-metrics.json',JSON.stringify(metrics,null,2)+'\n');console.log(metrics);
}finally{await browser?.close();server.close();}
