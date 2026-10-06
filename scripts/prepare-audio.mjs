/** Offline authoring only. Browser codecs avoid a separate ffmpeg dependency. */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSiteServer } from './serve.mjs';
import { wav } from './wav.mjs';
const root='assets/audio';
await mkdir(`${root}/clips`,{recursive:true});
await mkdir('artifacts/audio-source',{recursive:true});
for(const file of ['steps','leaves'])execFileSync('tar',['-xf',`${root}/source/${file}.7z`,'-C','artifacts/audio-source']);
const sources=JSON.parse(await readFile(`${root}/provenance.json`,'utf8'));
for(const source of sources){const data=await readFile(`${root}/source/${source.file}`);if(createHash('sha256').update(data).digest('hex')!==source.sha256)throw Error(`Changed source: ${source.file}`);}
const specs=[
 {id:'rain',source:`${root}/source/rain.ogg`,start:3,duration:19,loop:true},
 {id:'drizzle',source:`${root}/source/rain.ogg`,start:27,duration:13,loop:true},
 {id:'crickets',source:`${root}/source/crickets.mp3`,start:0,duration:10,loop:true},
 {id:'candle',source:`${root}/source/fire.wav`,start:0,duration:2,loop:true},
 {id:'voices',source:`${root}/source/voices.mp3`,start:1,duration:13},
 ...[1,2,3].map(n=>({id:`leaves${n}`,source:`artifacts/audio-source/rustle/rustle0${n}.flac`,start:0,duration:3})),
 ...['Stone','Sand'].flatMap(kind=>[1,2,3].map(n=>({id:`${kind.toLowerCase()}${n}`,source:`artifacts/audio-source/Fantozzi-footsteps/flac/Fantozzi-${kind}L${n}.flac`,start:0,duration:1}))),
];
const server=createSiteServer('.');await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/public/index.html`);
 const manifest=[];
 for(const spec of specs){
  const samples=await page.evaluate(async spec=>{
   const rate=24000,ctx=new OfflineAudioContext(1,1,rate);
   const b=await ctx.decodeAudioData(await (await fetch('/'+spec.source)).arrayBuffer());
   const start=Math.min(Math.floor(spec.start*rate),Math.max(0,b.length-rate));
   let data=new Float32Array(Math.min(Math.floor(spec.duration*rate),b.length-start));
   for(let c=0;c<b.numberOfChannels;c++)for(let i=0;i<data.length;i++)data[i]+=b.getChannelData(c)[start+i]/b.numberOfChannels;
   // Remove DC; normalize all recordings to the same conservative RMS, peak limited.
   const mean=data.reduce((a,v)=>a+v,0)/data.length;
   let energy=0,peak=0;for(let i=0;i<data.length;i++){data[i]-=mean;energy+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));}
   const gain=Math.min(.12/Math.sqrt(energy/data.length),.85/peak);
   for(let i=0;i<data.length;i++)data[i]*=gain;
   if(spec.loop){
    const overlap=Math.min(Math.floor(rate*.65),Math.floor(data.length/4)),length=data.length-overlap,out=new Float32Array(length);
    out.set(data.subarray(overlap));
    for(let i=0;i<overlap;i++){const t=i/overlap;out[length-overlap+i]=data[length+i]*(1-t)+data[i]*t;}
    data=out;
   }else{
    // Trim leading silence from contact samples, so sound starts with the planted paw.
    if(/stone|sand/.test(spec.id)){let first=data.findIndex(v=>Math.abs(v)>.015);data=data.slice(Math.max(0,first-48));}
    for(let i=0;i<data.length;i++)data[i]*=Math.min(1,i/96,(data.length-1-i)/240);
   }
   return Array.from(data);
  },spec);
  const data=wav([samples],24000);await writeFile(`${root}/clips/${spec.id}.wav`,data);
  manifest.push({...spec,rate:24000,frames:samples.length,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  console.log(spec.id,(samples.length/24000).toFixed(2)+'s');
 }
 await writeFile(`${root}/clips.json`,JSON.stringify(manifest,null,2)+'\n');
}finally{await browser?.close();server.close();}
