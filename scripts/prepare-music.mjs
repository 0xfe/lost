/** Optional macOS authoring: native Chrome decode, then Core Audio AAC encoding. Builds use retained outputs. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createSiteServer } from './serve.mjs';
const root='assets/audio/music';
await mkdir('artifacts',{recursive:true});
const source=await readFile(`${root}/source.m4a`),hash=data=>createHash('sha256').update(data).digest('hex');
const site=createSiteServer('.');
const server=createServer(async(req,res)=>{
 if(req.method==='POST'&&req.url==='/music-pcm'){
  try{const chunks=[];let size=0;for await(const data of req){size+=data.length;if(size>64*1024*1024)throw Error('PCM export exceeds budget');chunks.push(data);}
   await writeFile('artifacts/music-source.wav',Buffer.concat(chunks));res.writeHead(200).end('OK');
  }catch{res.writeHead(500).end('PCM export failed');}
 }else site.emit('request',req,res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/public/index.html`);
 const info=await page.evaluate(async()=>{
  const rate=32000,c=new OfflineAudioContext(2,1,rate),buffer=await c.decodeAudioData(await(await fetch('/assets/audio/music/source.m4a')).arrayBuffer());
  const channels=buffer.numberOfChannels,frames=buffer.length,bytes=new ArrayBuffer(44+frames*channels*2),v=new DataView(bytes);
  const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,bytes.byteLength-44,true);
  for(let channel=0;channel<channels;channel++){const pcm=buffer.getChannelData(channel);for(let i=0;i<frames;i++)v.setInt16(44+(i*channels+channel)*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),true);}
  const response=await fetch('/music-pcm',{method:'POST',body:bytes});if(!response.ok)throw Error('Could not save PCM');
  return {rate,channels,frames,duration:buffer.duration};
 });
 execFileSync('/usr/bin/afconvert',['-f','m4af','-d','aac@32000','-b','160000','-q','127','artifacts/music-source.wav',`${root}/soundtrack.m4a`]);
 const prepared=await readFile(`${root}/soundtrack.m4a`);
 await writeFile(`${root}/manifest.json`,JSON.stringify({title:'Lost Soundtrack',source:'source.m4a',originalFilename:'Lost Soundtrack.m4a',origin:'Supplied by the user in tmp; moved to assets on 2026-10-08',license:'User-supplied; no third-party license asserted',sourceSha256:hash(source),sourceBytes:source.length,file:'soundtrack.m4a',sha256:hash(prepared),bytes:prepared.length,...info,crossfadeSeconds:3,processing:'Chrome native decode to stereo 32 kHz PCM16; Core Audio AAC 160 kb/s. Runtime blends final three seconds into the opening and loops to second three, preserving the introduction on first play.'},null,2)+'\n');
 console.log({...info,bytes:prepared.length,sha256:hash(prepared)});
}finally{await browser?.close();server.close();site.close();}
