import assert from 'node:assert/strict';
import { mkdir, readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { DEFAULT_ZOOM } from '../src/world/street';
import { Rat } from '../src/simulation';
import { compose } from '../src/scene';
import { MemoryRenderer } from '../src/render';
import type { Atlas } from '../src/assets';

// Render the actual model and street; no browser chrome or diagnostic overlays.
const width=480,height=300,fps=20,frames=100;
const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
const source=await sharp('public/assets/atlas.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:source.info.width,height:source.info.height,data:source.data});
const rat=new Rat();rat.steer(0);rat.command('sniff');
for(let i=0;i<90;i++)rat.update(1/60);
const images:Buffer[]=[];
for(let frame=0;frame<frames;frame++){
  const time=frame/fps;
  rat.command(time<.75?'sniff':time<2.75?'walk':time<4?'scurry':'idle');
  for(let step=0;step<60/fps;step++)rat.update(1/60);
  renderer.render(compose(rat.current,atlas,{width,height,zoom:DEFAULT_ZOOM,rain:true}));
  const pixels=Buffer.from(renderer.pixels.data);
  // Dissolve back to the opening scene; the first frame also works as a static thumbnail.
  const blend=Math.max(0,(frame-(frames-8))/7);
  if(blend>0)for(let i=0;i<pixels.length;i+=4){
    for(let channel=0;channel<3;channel++){
      const index=i+channel;
      pixels[index]=Math.round(pixels[index]!*(1-blend)+images[0]![index]!*blend);
    }
  }
  images.push(pixels);
}
await mkdir('docs/media',{recursive:true});
const path='docs/media/lost.gif';
await sharp(Buffer.concat(images),{raw:{width,height:height*frames,channels:4,pageHeight:height}})
  .gif({loop:0,delay:Array(frames).fill(1000/fps),colours:64,dither:0,effort:7,interFrameMaxError:8}).toFile(path);
const encoded=sharp(path,{animated:true}),metadata=await encoded.metadata();
assert.equal(metadata.format,'gif');assert.equal(metadata.pages,frames);
assert.equal(metadata.width,width);assert.equal(metadata.pageHeight,height);
assert.equal(metadata.loop,0);assert.equal(metadata.delay?.reduce((sum,n)=>sum+n,0),5000);
await encoded.raw().toBuffer(); // Decode every frame, not just the header.
const bytes=(await stat(path)).size;assert.ok(bytes<10*1048576,'README GIF exceeds 10 MiB');
console.log(`${path}: ${frames} frames, ${fps} fps, 5 seconds, ${(bytes/1048576).toFixed(2)} MiB`);
