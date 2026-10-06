import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Rat } from '../src/simulation';
import { StreetScore, spatial, clips, type Sound } from '../src/audio/score';
import { lampAt } from '../src/world/street';

test('paw foley follows individual landing edges, including gallop, and settles to silence',()=>{
  for(const action of ['walk','scurry'] as const){
    const rat=new Rat(),score=new StreetScore();rat.command(action);let contacts=0,heard=0;
    for(let i=0;i<600;i++){
      rat.update(1/60);const events=score.update(rat.previous,rat.current);
      const landed=rat.current.feet.filter((f,n)=>f.contact&&!rat.previous.feet[n]!.contact);
      contacts+=landed.length;heard+=events.filter(e=>e.id.startsWith('paw-')).length;
      assert.equal(events.filter(e=>e.id.startsWith('paw-')).length,landed.length);
    }
    assert.ok(contacts>20);assert.equal(contacts,heard);
    rat.command('idle');for(let i=0;i<120;i++){rat.update(1/60);score.update(rat.previous,rat.current);}
    for(let i=0;i<120;i++){rat.update(1/60);assert.equal(score.update(rat.previous,rat.current).filter(e=>e.group==='rat').length,0);}
  }
});
test('score is deterministic, bounded, with intermittent moving voices and different steps',()=>{
  function run(){const rat=new Rat(),score=new StreetScore(),events:Sound[]=[];let maxBeds=0;
    for(let i=0;i<180*60;i++){rat.update(1/60);events.push(...score.update(rat.previous,rat.current));if(i%60===0)maxBeds=Math.max(maxBeds,score.beds(rat.current,true).length);}
    return {events,maxBeds};}
  const a=run();assert.deepEqual(a,run());assert.equal(a.maxBeds,8);
  const people=a.events.filter(e=>e.group==='people');assert.ok(people.some(e=>e.clip==='voices'&&e.vx));
  assert.ok(people.some(e=>e.clip.startsWith('stone')));assert.ok(people.some(e=>e.clip.startsWith('sand')));
  assert.ok(people.length<400);
});
test('spatial perspective follows screen direction, distance, moving passers and world lamps',()=>{
  const rat=new Rat(),score=new StreetScore(),s=score.beds(rat.current,true)[0]!;
  const right=spatial({...s,x:5,y:0},rat.current,0),left=spatial({...s,x:0,y:5},rat.current,0);
  assert.ok(right.pan>0&&left.pan<0);assert.equal(left.gain,right.gain);
  const far=spatial({...s,x:20,y:0},rat.current,0);assert.ok(far.gain<right.gain&&far.cutoff<right.cutoff);
  assert.ok(spatial({...s,x:-10,y:0,vx:1,at:0},rat.current,20).pan>0);
  const off=score.beds(rat.current,false);assert.ok(off.filter(e=>e.group==='rain').every(e=>e.gain===0));
  const lamp=score.beds(rat.current,true).find(e=>e.id==='lamp-0')!;
  assert.equal(lamp.x,lampAt(0,0).x);assert.equal(lamp.gain,lampAt(0,0).power*.3);
});
test('shipped audio is complete, finite PCM with retained source hashes and small delivery budget',async()=>{
  const manifest=JSON.parse(await readFile('assets/audio/clips.json','utf8'));let bytes=0;
  assert.deepEqual(manifest.map((s:{id:string})=>s.id).sort(),[...clips].sort());
  for(const clip of manifest){const data=await readFile(`assets/audio/clips/${clip.id}.wav`);bytes+=data.length;
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt32LE(24),24000);
    assert.equal(createHash('sha256').update(data).digest('hex'),clip.sha256);
    if(clip.loop)assert.ok(Math.abs(data.readInt16LE(44)-data.readInt16LE(data.length-2))<6000,`${clip.id} seam`);
  }
  assert.ok(bytes<3_100_000);
  const sources=JSON.parse(await readFile('assets/audio/provenance.json','utf8'));
  for(const source of sources){assert.equal(source.license,'CC0-1.0');assert.equal(createHash('sha256').update(await readFile(`assets/audio/source/${source.file}`)).digest('hex'),source.sha256);}
});
