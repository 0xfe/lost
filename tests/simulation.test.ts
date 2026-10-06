import test from 'node:test';
import assert from 'node:assert/strict';
import { Rat, directionRow, screenHeading, STREET_HALF_WIDTH, angleDelta } from '../src/simulation';
import { FixedClock, project, unproject } from '../src/math';
import { compose } from '../src/scene';
import { readFile } from 'node:fs/promises';
import type { Atlas } from '../src/assets';
import { GAITS } from '../src/rat/locomotion';

const advance=(rat:Rat,seconds:number)=>{for(let i=0;i<seconds*60;i++)rat.update(1/60);};
test('projection roundtrips signed coordinates',()=>{
  for(const p of [{x:-123,y:8},{x:0,y:-7},{x:17,y:41}]){
    const result=unproject(project(p,{width:172,height:86}),{width:172,height:86});assert.deepEqual(result,p);
  }
});
test('all eight generated headings match screen-space travel',()=>{
  for(let row=0;row<8;row++)assert.equal(directionRow(screenHeading(Math.cos(row*Math.PI/4),Math.sin(row*Math.PI/4))),row);
});
test('60 Hz and 144 Hz presentations produce identical simulation',()=>{
  const run=(hz:number)=>{const rat=new Rat(),clock=new FixedClock();for(let i=0;i<hz*12;i++)clock.advance(1/hz,dt=>rat.update(dt));return rat.current;};
  assert.deepEqual(run(60),run(144));
});
test('turns are bounded and begin without sideways translation',()=>{
  const rat=new Rat();rat.steer(Math.PI);rat.command('walk');const initial={...rat.current};rat.update(1/60);
  assert.equal(rat.current.x,initial.x);assert.equal(rat.current.y,initial.y);
  assert.ok(Math.abs(angleDelta(initial.heading,rat.current.heading))<=2.8/60+1e-8);
  // A half turn now includes actual paw-recovery steps rather than spinning over planted feet.
  advance(rat,3.5);assert.ok(rat.current.x<-.2);
});
test('distance drives gait and rest settles without skating',()=>{
  const rat=new Rat();rat.steer(0);rat.current.heading=0;rat.command('walk');advance(rat,3);
  assert.ok(Math.abs(rat.current.stride-rat.current.x/GAITS.walk.stride)<1e-8);
  rat.command('idle');advance(rat,1);const {x,y,stride}=rat.current;advance(rat,3);
  assert.equal(rat.current.x,x);assert.equal(rat.current.y,y);assert.equal(rat.current.stride,stride);
});
test('wall stops actual movement and stops gait cycling',()=>{
  const rat=new Rat();rat.steer(Math.PI/2);rat.command('scurry');advance(rat,12);
  assert.ok(Math.abs(rat.current.y)<=STREET_HALF_WIDTH);
  const {y,stride}=rat.current;advance(rat,3);assert.equal(rat.current.y,y);assert.equal(rat.current.stride,stride);
});
test('tail remains attached, finite, and has constrained segment lengths through reversals',()=>{
  const rat=new Rat();rat.command('walk');
  for(let i=0;i<1200;i++){
    if(i%150===0)rat.steer(i*.02);rat.update(1/60);
    const p=rat.current;assert.ok(Math.abs(p.tail[0]!.x-(p.x-Math.cos(p.heading)*.65))<1e-9);
    for(let j=1;j<p.tail.length;j++)assert.ok(Math.abs(Math.hypot(p.tail[j]!.x-p.tail[j-1]!.x,p.tail[j]!.y-p.tail[j-1]!.y)-.062)<1e-8);
  }
});
test('long exploration stays in the street and reproduces exactly',()=>{
  const a=new Rat(),b=new Rat();advance(a,600);advance(b,600);assert.deepEqual(a.current,b.current);assert.ok(Math.abs(a.current.y)<=STREET_HALF_WIDTH);assert.equal(a.current.tail.length,19);
});
test('render list stays bounded at distant and negative world positions',async()=>{
  const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
  for(const x of [-100000,0,100000]){
    const rat=new Rat();rat.current.x=x;
    const frame=compose(rat.current,atlas,{width:960,height:600,zoom:1.2,rain:true});
    assert.ok(frame.commands.length<2000);
    for(const command of frame.commands){assert.ok(Number.isFinite(command.x));assert.ok(command.width>=0);}
    assert.ok(frame.commands.some(c=>c.id.startsWith('rat-body')));
  }
});
