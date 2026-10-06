import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Rat, type Action } from '../src/simulation';
import { rasterRat } from '../src/rat/raster';

test('reviewed rat states and interpolated RGBA pixels remain stable',async()=>{
  const baseline=JSON.parse(await readFile('tests/fixtures/rat-reference.json','utf8')) as {
    frames:{action:Action;heading:number;ticks:number;state:string;pixels:string[]}[];
  };
  const {fur}=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as {fur:number[]};
  const hash=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
  const rat=new Rat();
  for(const frame of baseline.frames){
    rat.command(frame.action);rat.steer(frame.heading);
    for(let i=0;i<frame.ticks;i++)rat.update(1/60);
    assert.equal(hash(JSON.stringify(rat.current)),frame.state,`${frame.action}: simulation changed`);
    for(const [index,alpha] of [0,.5,1].entries()){
      assert.equal(hash(rasterRat(rat.sample(alpha),fur).data),frame.pixels[index],`${frame.action} at ${alpha}: pixels changed`);
    }
  }
});
