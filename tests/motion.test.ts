import test from 'node:test';
import assert from 'node:assert/strict';
import { Rat, type Action } from '../src/simulation';
import { ratModel } from '../src/rat/model';
import { createFeet, GAITS } from '../src/rat/locomotion';
import { RAT_CAMERA, rasterRat } from '../src/rat/raster';
import { readFile } from 'node:fs/promises';
import type { Atlas } from '../src/assets';
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]!));
const step=(r:Rat,n:number)=>{for(let i=0;i<n;i++)r.update(1/60);};

test('planted paws do not slip during acceleration, gait changes, braking or turning',()=>{
  const r=new Rat();let supportedSamples=0;
  for(let i=0;i<1200;i++){
    if(i%120===0){r.command((['walk','scurry','idle','walk','listen'] as Action[])[Math.floor(i/120)%5]!);r.steer(Math.sin(i*.02)*1.2);}
    const before=r.current.feet.map(f=>({...f}));r.update(1/60);
    r.current.feet.forEach((f,j)=>{
      if(before[j]!.contact&&f.contact){assert.equal(f.x,before[j]!.x);assert.equal(f.y,before[j]!.y);assert.equal(f.z,0);supportedSamples++;}
      assert.ok(f.z>=0);
    });
  }
  assert.ok(supportedSamples>1000);
});
test('stance pixels move exactly with the street under an interpolated camera',()=>{
  const r=new Rat();r.steer(0);r.command('walk');step(r,180);
  let samples=0;
  for(let i=0;i<120;i++){
    r.update(1/60);
    for(let foot=0;foot<4;foot++)if(r.previous.feet[foot]!.contact&&r.current.feet[foot]!.contact){
      const anchor=r.current.feet[foot]!;
      for(const alpha of [0,.25,.5,.75,1]){
        const p=r.sample(alpha),f=p.feet[foot]!;
        const streetX=((anchor.x-p.x)-(anchor.y-p.y))*86;
        const spriteX=((f.x-p.x)-(f.y-p.y))*RAT_CAMERA.scale*86/RAT_CAMERA.scale;
        assert.ok(Math.abs(streetX-spriteX)<1e-10);samples++;
      }
    }
  }
  assert.ok(samples>500);
});
test('walk keeps two or three supports; scurry includes distinct front/hind grouping and suspension',()=>{
  const supportSets:number[][]=[];
  for(const action of ['walk','scurry'] as const){
    const r=new Rat();r.steer(0);r.command(action);step(r,180);
    const support:number[]=[];let forePair=0,hindPair=0;
    for(let i=0;i<600;i++){
      r.update(1/60);const feet=r.current.feet;support.push(feet.filter(f=>f.contact).length);
      if(feet[0]!.contact&&feet[1]!.contact&&!feet[2]!.contact&&!feet[3]!.contact)forePair++;
      if(!feet[0]!.contact&&!feet[1]!.contact&&feet[2]!.contact&&feet[3]!.contact)hindPair++;
    }
    supportSets.push(support);
    if(action==='scurry'){assert.ok(forePair>30);assert.ok(hindPair>30);}
  }
  assert.ok(supportSets[0]!.every(n=>n===2||n===3));assert.ok(supportSets[1]!.includes(0));
});
test('joint lengths remain constant over complete steady walking and galloping cycles',()=>{
  for(const action of ['walk','scurry'] as const){
    const r=new Rat();r.steer(0);r.command(action);step(r,180);
    for(let i=0;i<180;i++){
      r.update(1/60);
      for(const j of ratModel(r.current).joints){
        assert.ok(Math.abs(distance(j.hip,j.knee)-j.upper)<1e-7);
        assert.ok(Math.abs(distance(j.knee,j.ankle)-j.lower)<1e-7,`${action}: unreachable foot`);
      }
    }
  }
});
test('head and ears articulate at rest without moving planted paws',()=>{
  const r=new Rat();r.command('listen');step(r,120);const feet=r.current.feet.map(f=>({...f}));
  const a=ratModel(r.current);step(r,50);const b=ratModel(r.current);
  assert.ok(distance(a.nose,b.nose)>.005);assert.ok(distance(a.ears[0]!,b.ears[0]!)>.003);
  assert.deepEqual(r.current.feet.map(f=>[f.x,f.y,f.z]),feet.map(f=>[f.x,f.y,f.z]));
});
test('pivots and action transitions unload paws before the limbs exceed their reach',()=>{
  const r=new Rat();
  for(let i=0;i<1200;i++){
    if(i%100===0){r.command((['walk','scurry','idle','groom','listen','sniff'] as const)[Math.floor(i/100)%6]!);r.steer(Math.sin(i*.02)*2.2);}
    r.update(1/60);
    for(const j of ratModel(r.current).joints)assert.ok(Math.abs(distance(j.knee,j.ankle)-j.lower)<1e-7);
  }
});
test('stopping and wall collisions finish airborne feet instead of freezing them in the air',()=>{
  for(const blocked of [false,true]){
    const r=new Rat();r.steer(blocked?Math.PI/2:0);r.command('scurry');step(r,blocked?300:83);
    if(!blocked)r.command('idle');step(r,120);
    assert.ok(r.current.feet.every(f=>f.contact&&f.z===0));
    const feet=r.current.feet.map(f=>[f.x,f.y]);step(r,60);assert.deepEqual(r.current.feet.map(f=>[f.x,f.y]),feet);
  }
});
test('the live pixel rig is deterministic, stays inside its patch, and uses continuous headings',async()=>{
  const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
  const r=new Rat();r.command('idle');step(r,90);
  let previous:Uint8Array|undefined;
  for(let i=0;i<16;i++){
    r.current.heading=i*Math.PI/8;r.current.feet=createFeet(r.current);
    r.current.tail=r.current.tail.map((_,j)=>({x:r.current.x-Math.cos(r.current.heading)*(.65+j*.062),y:r.current.y-Math.sin(r.current.heading)*(.65+j*.062)}));
    const a=rasterRat(r.current,atlas.fur),b=rasterRat(r.current,atlas.fur);assert.deepEqual(a.data,b.data);
    for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)if(a.data[(y*a.width+x)*4+3])assert.ok(x>1&&x<a.width-2&&y>1&&y<a.height-2);
    if(previous)assert.notDeepEqual(a.data,previous);previous=a.data;
  }
  assert.notEqual(GAITS.walk.stride,GAITS.scurry.stride);
});
