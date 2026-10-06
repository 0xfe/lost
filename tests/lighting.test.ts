import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { illumination, nearbyLamps, sceneCamera, DEFAULT_ZOOM, PAVING_REPEAT } from '../src/world/street';
import { ratModel } from '../src/rat/model';
import { Rat } from '../src/simulation';
import { rasterShadow } from '../src/model/shadow';
import { compose } from '../src/scene';
import type { Atlas } from '../src/assets';
import { quadColor } from '../src/render';

test('lamp falloff is tied to the street and creates distinct lit and dark stretches',()=>{
  const lamps=nearbyLamps(6,2);
  assert.ok(illumination(lamps,6,0)>illumination(lamps,13,0)*2.5);
  assert.equal(illumination(lamps,6,0),illumination(nearbyLamps(9,2),6,0));
  assert.equal(PAVING_REPEAT,12);
});
test('portrait and laptop framing leave room around the whole rat',()=>{
  for(const [width,height] of [[312,675],[1100,733],[667,300]]){
    const camera=sceneCamera(width!,height!,DEFAULT_ZOOM);
    // Conservative 2.9-unit actor+tail extent in a side view.
    assert.ok(camera.scale*2.9/width!<.39);
    assert.ok(camera.origin.y/height!>=.46&&camera.origin.y/height!<=.51);
  }
});
test('posed shadows change side when the point light moves across the rat',()=>{
  const rat=new Rat();rat.command('idle');const mesh=ratModel(rat.current).mesh;
  const camera={width:352,height:288,x:176,y:165,scale:66};
  const center=(pixels:Uint8Array)=>{let x=0,n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){x+=(i>>2)%352;n++;}return x/n;};
  const a=rasterShadow(mesh,[4,0,4],camera,.4),b=rasterShadow(mesh,[-4,0,4],camera,.4);
  assert.ok(center(a.data)<center(b.data)-12);assert.notDeepEqual(a.data,b.data);
});
test('scene uses upright lamp geometry, surface gradients and a separate registered cast shadow',async()=>{
  const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
  const r=new Rat(),frame=compose(r.current,atlas,{width:960,height:640,zoom:DEFAULT_ZOOM,rain:false});
  assert.ok(frame.commands.some(c=>c.id.startsWith('streetlamp-post')));
  assert.ok(!frame.commands.some(c=>c.id.startsWith('sconce')||c.id.startsWith('lamp-case')));
  assert.ok(frame.commands.some(c=>c.id.startsWith('rat-cast-shadow')));
  assert.ok(frame.commands.some(c=>c.cornerColors&&new Set(c.cornerColors.map(v=>v.join(','))).size>1));
  assert.equal(frame.patches?.length,2);
  assert.ok(atlas.ratShadow.x>=atlas.liveRat.x+atlas.liveRat.width);
  assert.ok(atlas.ratShadow.x+atlas.ratShadow.width<=atlas.width);
});
test('the same posed rat is darker between lamps than beside one',async()=>{
  const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
  const brightness=(x:number)=>{
    const r=new Rat(),p=r.current;p.x=x;p.feet.forEach(f=>f.x+=x);p.tail.forEach(t=>t.x+=x);
    const pixels=compose(p,atlas,{width:960,height:640,zoom:DEFAULT_ZOOM,rain:false}).patches![0]!.data;
    let sum=0,count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]===255){sum+=pixels[i]!+pixels[i+1]!+pixels[i+2]!;count++;}return sum/count;
  };
  assert.ok(brightness(6)>brightness(13)*1.25);
});
test('quad illumination follows the renderer triangle diagonal',()=>{
  const colors=[[200,0,0,255],[0,200,0,255],[0,0,200,255],[200,200,200,255]] as const;
  assert.deepEqual(quadColor(colors,.5,.5),[0,100,100,255]);
  assert.deepEqual(quadColor(colors,1,1),colors[3]);
});
