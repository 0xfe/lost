import test from 'node:test';
import assert from 'node:assert/strict';
import { FiveTaps } from '../src/input/five-taps';
const tap=(g:FiveTaps,at:number,id=1)=>{g.down(id,20,30,at);return g.up(id,21,31,at+70);};
test('only the fifth quick tap toggles controls, and a fresh sequence is required afterward',()=>{
  const g=new FiveTaps();for(let i=0;i<10;i++)assert.equal(tap(g,i*150),(i+1)%5===0);
});
test('slow taps, holds and drags cannot accidentally reveal the interface',()=>{
  const g=new FiveTaps();for(let i=0;i<5;i++)assert.equal(tap(g,i*1000),false);
  g.cancel();for(let i=0;i<4;i++)tap(g,i*150);
  g.down(1,20,30,600);assert.equal(g.up(1,20,30,900),false);assert.equal(tap(g,1000),false);
  g.cancel();for(let i=0;i<4;i++)tap(g,i*150);
  g.down(1,20,30,600);g.move(1,80,30);assert.equal(g.up(1,20,30,700),false);assert.equal(tap(g,800),false);
});
test('a second finger and cancelled pointers reset the tap sequence',()=>{
  const g=new FiveTaps();for(let i=0;i<4;i++)tap(g,i*150);
  g.down(1,20,30,600);g.down(2,40,30,610,false);
  assert.equal(g.up(1,20,30,670),false);assert.equal(g.up(2,40,30,680),false);assert.equal(tap(g,800),false);
  g.cancel();assert.equal(tap(g,1000),false);
});
