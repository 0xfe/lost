import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { crossfadeMusic } from '../src/audio/music';

test('music retains its first-play introduction and joins its tail to the loop start without a jump',()=>{
  const channels=[Float32Array.from({length:1000},(_,i)=>Math.sin(i*.02)*.5),Float32Array.from({length:1000},(_,i)=>Math.cos(i*.01)*.4)];
  const before=channels.map(c=>c.slice()),start=crossfadeMusic(channels,100,2);
  assert.equal(start,2);
  channels.forEach((c,n)=>{
    assert.deepEqual(c.slice(0,800),before[n]!.slice(0,800));
    assert.equal(c[999],before[n]![199]);
    assert.ok(Math.abs(c[999]!-c[200]!)<.02);
    assert.ok(c.every(v=>Math.abs(v)<=.5));
  });
});
test('music loop guards short and invalid buffers',()=>{
  assert.equal(crossfadeMusic([new Float32Array(100)],100,3),.25);
  assert.throws(()=>crossfadeMusic([],32000));
  assert.throws(()=>crossfadeMusic([new Float32Array(4),new Float32Array(5)],32000));
  assert.throws(()=>crossfadeMusic([new Float32Array(4)],32000,0));
});
test('the user soundtrack and prepared asset retain provenance, hashes and a bounded stereo budget',async()=>{
  const m=JSON.parse(await readFile('assets/audio/music/manifest.json','utf8'));
  const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
  assert.equal(hash(await readFile(`assets/audio/music/${m.source}`)),m.sourceSha256);
  const file=await readFile(`assets/audio/music/${m.file}`);assert.equal(hash(file),m.sha256);assert.equal(file.length,m.bytes);
  assert.equal(m.channels,2);assert.equal(m.rate,32000);assert.ok(m.frames*m.channels*4<48*1024*1024);
  assert.ok(m.duration>170&&m.duration<185);assert.match(m.license,/User-supplied/);
  assert.ok(m.bytes<4*1024*1024);
});
