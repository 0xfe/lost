import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Rat, screenHeading } from '../src/simulation';
import { compose } from '../src/scene';
import { MemoryRenderer } from '../src/render';
import type { Atlas } from '../src/assets';
import { createFeet } from '../src/rat/locomotion';

await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
const source=await sharp('public/assets/atlas.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:source.info.width,height:source.info.height,data:source.data});
for(const mood of [0,1]){
  const rat=new Rat();rat.mood=mood;for(let i=0;i<6*60;i++)rat.update(1/60);
  const frame=compose(rat.current,atlas,{width:960,height:600,zoom:1.2,rain:true});renderer.render(frame);
  await sharp(renderer.pixels.data,{raw:{width:960,height:600,channels:4}}).png().toFile(`artifacts/${mood?'home':'lost'}-memory.png`);
}
const sheet=Buffer.alloc(4*240*8*180*4,0);
for(let row=0;row<8;row++)for(let pose=0;pose<4;pose++){
  const rat=new Rat({streetHalfWidth:Infinity});rat.current.heading=screenHeading(Math.cos(row*Math.PI/4),Math.sin(row*Math.PI/4));
  rat.targetHeading=rat.current.heading;rat.current.feet=createFeet(rat.current);rat.command(pose%2?'scurry':'walk');
  for(let i=0;i<150+pose*7;i++)rat.update(1/60);
  const frame=compose(rat.current,atlas,{width:240,height:180,zoom:.53,rain:false});
  // Review the body separately against a contrasting background, with all registered poses.
  frame.commands=frame.commands.filter(c=>c.id.startsWith('rat-body'));frame.clear=[32,45,50,255];renderer.render(frame);
  for(let y=0;y<180;y++)Buffer.from(renderer.pixels.data).copy(sheet,((row*180+y)*960+pose*240)*4,y*240*4,(y+1)*240*4);
}
await sharp(sheet,{raw:{width:960,height:1440,channels:4}}).png().toFile('artifacts/rat-directions.png');
await writeFile('artifacts/budget.json',JSON.stringify({atlas:{width:atlas.width,height:atlas.height,decodedBytes:atlas.width*atlas.height*4,budgetBytes:16*1048576},runtimeDependencies:0},null,2));
console.log('Wrote Lost/Home memory snapshots, articulated direction/gait sheet, and atlas budget → artifacts/');
