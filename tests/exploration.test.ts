import test from 'node:test';
import assert from 'node:assert/strict';
import { Rat, STREET_HALF_WIDTH } from '../src/simulation';
import { ratModel } from '../src/rat/model';

test('seeded exploration walks mostly, varies pace, investigates side scents and returns to its route',()=>{
  const rat=new Rat(),phases=new Set<string>(),speeds=new Set<number>(),pauseLengths:number[]=[];
  let walk=0,scurry=0,returns=0,previous=rat.exploration.phase,started=0;
  for(let tick=0;tick<60*120;tick++){
    rat.update(1/60);const p=rat.current,phase=rat.exploration.phase;
    phases.add(phase);if(p.action==='walk'){walk++;speeds.add(Math.round(p.speed*10));}if(p.action==='scurry')scurry++;
    if(previous!==phase){
      if(previous==='return'&&phase==='travel'){
        assert.ok(Math.hypot(p.x-rat.exploration.resume.x,p.y-rat.exploration.resume.y)<.22);returns++;
      }
      if(previous==='pause'||previous==='investigate')pauseLengths.push(tick-started);
      started=tick;previous=phase;
    }
    assert.ok(Math.abs(p.y)<=STREET_HALF_WIDTH);
    if(tick%20===0)for(const limb of ratModel(p).joints){
      assert.ok(Math.abs(Math.hypot(...limb.knee.map((n,i)=>n-limb.ankle[i]!))-limb.lower)<1e-7);
    }
  }
  assert.deepEqual([...phases].sort(),['approach','investigate','notice','pause','return','travel']);
  assert.ok(walk>scurry*3&&scurry>50);assert.ok(returns>=3);assert.ok(speeds.size>8);
  assert.ok(new Set(pauseLengths).size>3);assert.ok(rat.current.x>45);assert.ok(Math.abs(rat.current.y)<1.7);
});

test('exploration respects user direction, repeats by seed and differs with a different seed',()=>{
  const a=new Rat({seed:44}),b=new Rat({seed:44}),c=new Rat({seed:45});
  for(const r of [a,b,c])r.steer(Math.PI);
  for(let i=0;i<1800;i++)for(const r of [a,b,c])r.update(1/60);
  assert.deepEqual(a.current,b.current);assert.notDeepEqual(a.current,c.current);
  assert.ok(a.current.x<-8);assert.equal(a.explore,true);
  a.command('sniff');assert.equal(a.explore,false);a.setExploring(true);assert.equal(a.explore,true);
});

test('sniff and listen vary performance tempo while contacts remain planted',()=>{
  for(const action of ['sniff','listen'] as const){
    const r=new Rat();r.command(action);const rates:number[]=[];
    for(let i=0;i<600;i++){r.update(1/60);rates.push(r.current.tempo);}
    assert.ok(Math.max(...rates)-Math.min(...rates)>.15);
    assert.ok(r.current.feet.every(f=>f.contact));assert.equal(r.current.x,0);assert.equal(r.current.y,0);
  }
});
