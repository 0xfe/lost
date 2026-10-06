import sharp from 'sharp';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Rat, screenHeading } from '../src/simulation';
import { createFeet } from '../src/rat/locomotion';
import { ratModel } from '../src/rat/model';
import { rasterRat } from '../src/rat/raster';
import { compose } from '../src/scene';
import { MemoryRenderer } from '../src/render';
import type { Atlas } from '../src/assets';

await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
const source=await sharp('public/assets/atlas.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:source.info.width,height:source.info.height,data:source.data});
const width=480,height=300,frames=60,metrics:Record<string,unknown>={};
const comparison:Buffer[]=[];
for(const action of ['walk','scurry'] as const){
  const r=new Rat({streetHalfWidth:Infinity});r.current.heading=screenHeading(1,0);r.targetHeading=r.current.heading;r.current.feet=createFeet(r.current);r.command(action);
  // The diagnostic plane is unbounded; body, paw anchors and paving retain real world coordinates.
  for(let i=0;i<180;i++)r.update(1/60);
  const buffers:Buffer[]=[],times:number[]=[],supports:number[]=[],contacts:number[][]=[];
  let drift=0;
  for(let i=0;i<frames;i++){
    for(let j=0;j<2;j++){
      const old=r.current.feet.map(f=>({...f}));r.update(1/60);
      r.current.feet.forEach((f,k)=>{if(f.contact&&old[k]!.contact)drift=Math.max(drift,Math.hypot(f.x-old[k]!.x,f.y-old[k]!.y));});
    }
    const frame=compose(r.current,atlas,{width,height,zoom:1,rain:false,debug:true,study:true});
    renderer.render(frame);buffers.push(Buffer.from(renderer.pixels.data));
    supports.push(r.current.feet.filter(f=>f.contact).length);contacts.push(r.current.feet.map(f=>Number(f.contact)));
    const start=performance.now();rasterRat(r.current,atlas.fur);times.push(performance.now()-start);
    if(i%10===0)comparison.push(Buffer.from(renderer.pixels.data));
  }
  await sharp(Buffer.concat(buffers),{raw:{width,height:height*frames,channels:4,pageHeight:height}})
    .webp({lossless:true,loop:0,delay:Array.from({length:frames},(_,i)=>i%3===2?34:33)}).toFile(`artifacts/${action}-motion.webp`);
  const animation=await sharp(`artifacts/${action}-motion.webp`,{animated:true}).metadata();
  assert.equal(animation.pages,frames);assert.equal(animation.delay?.reduce((a,b)=>a+b,0),2000);
  times.sort((a,b)=>a-b);
  metrics[action]={worldSpeed:r.current.speed,stanceDriftWorld:drift,supportCounts:[...new Set(supports)].sort(),
    rasterP50Milliseconds:times[Math.floor(times.length*.5)],rasterP95Milliseconds:times[Math.floor(times.length*.95)],contacts,
    triangles:ratModel(r.current).mesh.indices.length/3};
}
const strip=Buffer.alloc(width*6*height*2*4);
for(let i=0;i<comparison.length;i++)for(let y=0;y<height;y++)comparison[i]!.copy(strip,((Math.floor(i/6)*height+y)*width*6+i%6*width)*4,y*width*4,(y+1)*width*4);
await sharp(strip,{raw:{width:width*6,height:height*2,channels:4}}).png().toFile('artifacts/gait-comparison.png');
await writeFile('artifacts/motion-metrics.json',JSON.stringify(metrics,null,2)+'\n');
await writeFile('artifacts/motion-study.html',`<!doctype html><meta charset="utf-8"><title>Lost · motion study</title><style>body{background:#132027;color:#d3cdbb;font:15px system-ui;margin:40px}main{display:flex;gap:24px;flex-wrap:wrap}h1{font:36px Georgia}h2{font:22px Georgia}img{width:min(600px,100%);image-rendering:pixelated;border:1px solid #52605b}p{max-width:1000px;line-height:1.6;color:#94a5a6}a{color:#d8c197}</style><h1>Finding his feet.</h1><p>Actual contact-planned poses, 30 fps software renders. Green anchors stay with the ground; amber feet recover in the air. The two-second previews restart at the loop boundary. The camera follows along an unbounded diagnostic lane.</p><main><section><h2>Walk · four staggered footfalls</h2><img src="walk-motion.webp"></section><section><h2>Scurry · asymmetric gallop</h2><img src="scurry-motion.webp"></section></main><p><a href="http://localhost:4173/?lab">Open the live Motion lab</a> for single stepping, slow motion and turns. Raster timing in motion-metrics.json measures CPU work only.</p>`);
console.log('Wrote animated gait comparisons, contact metrics and motion-study.html → artifacts/');
