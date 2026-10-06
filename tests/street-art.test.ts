import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { streetDetails, reliefAt } from '../src/world/dressing';
import { PAVING_REPEAT } from '../src/world/street';
import { vergeModel } from '../src/environment/plants';
import { compose } from '../src/scene';
import { Rat } from '../src/simulation';
import type { Atlas } from '../src/assets';

const load=async()=>JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
test('new street sprites have real alpha, remain registered and do not overlap any atlas region',async()=>{
  const atlas=await load(),{data}=await sharp('public/assets/atlas.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const regions=[atlas.floor,atlas.wall,atlas.glow,atlas.shadow,atlas.liveRat,atlas.ratShadow,atlas.lantern,atlas.grille,atlas.soil,...atlas.plants,...atlas.rat.flat()];
  for(const [i,a]of regions.entries()){
    assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=atlas.width&&a.y+a.height<=atlas.height);
    for(const b of regions.slice(i+1))assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
  }
  for(const r of [atlas.lantern,atlas.grille,...atlas.plants]){
    let solid=0,transparent=0;
    for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
      const a=data[((r.y+y)*atlas.width+r.x+x)*4+3]!;if(a>32)solid++;if(a===0)transparent++;
    }
    assert.ok(solid>15&&transparent>r.width*r.height*.15);
  }
  assert.ok(atlas.width*atlas.height*4<=16*1048576);
});
test('street scatter is stable when the camera moves, including negative coordinates',async()=>{
  const {relief}=await load(),a=streetDetails(-20,20,relief),b=streetDetails(-10,30,relief);
  const common=(items:typeof a)=>items.filter(p=>p.x>=-8&&p.x<=18);
  assert.deepEqual(common(a),common(b));assert.deepEqual(a,streetDetails(-20,20,relief));
  assert.ok(a.some(p=>p.variant>=6));assert.ok(a.some(p=>p.variant<6));
  assert.ok(a.filter(p=>Math.abs(p.y)>2.7).length>a.filter(p=>Math.abs(p.y)<1).length*2);
  assert.ok(a.every(p=>p.y>=-3.8&&p.y<=3.95));
  for(const x of [-19.6,-.37,.13,18.7])assert.equal(reliefAt(relief,x,1.3),reliefAt(relief,x+PAVING_REPEAT,1.3));
  assert.ok(streetDetails(99980,100020,relief).length<250);
});
test('grass, broadleaf weeds and irregular rubble use finite reusable mesh geometry',()=>{
  const variants=Array.from({length:8},(_,i)=>vergeModel(i));
  for(const mesh of variants){assert.ok(mesh.indices.length>30);assert.ok(mesh.vertices.every(v=>[...v.p,...v.n].every(Number.isFinite)));}
  assert.notDeepEqual(variants[0],variants[4]);assert.notDeepEqual(variants[6],variants[7]);
});
test('scene replaces schematic props and dresses both sides of the animal',async()=>{
  const atlas=await load(),rat=new Rat();for(let i=0;i<360;i++)rat.update(1/60);
  const frame=compose(rat.current,atlas,{width:960,height:600,zoom:.9,rain:false});
  const ids=frame.commands.map(c=>c.id),body=ids.findIndex(id=>id.startsWith('rat-body'));
  assert.ok(ids.some(id=>id.startsWith('cellar-grille')));
  assert.ok(frame.commands.some(c=>c.id.startsWith('streetlamp-post')&&c.region===atlas.lantern));
  assert.ok(ids.slice(0,body).some(id=>id.startsWith('verge-')));
  assert.ok(ids.slice(body).some(id=>id.startsWith('verge-')));
  assert.ok(ids.some(id=>id.startsWith('soil')));assert.ok(ids.some(id=>id.startsWith('kerb-face')));
  assert.ok(!ids.some(id=>id.startsWith('streetlamp-glass')||id.startsWith('water-')||id.startsWith('iron-')));
});
