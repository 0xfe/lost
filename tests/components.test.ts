import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createContacts, updateContacts, type ContactPose, type ContactPlan } from '../src/animation/contacts';
import { solveTwoLink } from '../src/animation/ik';
import { sampleScalar } from '../src/model/material';
import { rasterMesh } from '../src/model/raster';
import { sproutModel } from '../src/examples/sprout';
import type { Mesh } from '../src/model/mesh';

test('the contact planner supports two and six legs without rat state',()=>{
  for(const count of [2,6]){
    const homes=Array.from({length:count},(_,i)=>({x:Math.floor(i/2)*.2,y:i%2?.2:-.2}));
    const p:ContactPose={x:0,y:0,heading:0,stride:0,feet:[]};p.feet=createContacts(p,homes);
    const plan:ContactPlan={homes,gait:{stride:.5,lift:.08,offsets:homes.map((_,i)=>i/count),duty:homes.map(()=>.65)},
      settings:{movingReach:.3,restReach:.15,recoverySeconds:.16,recoveryLift:.05}};
    const lifted=new Set<number>();let plantedSamples=0;
    for(let tick=0;tick<180;tick++){
      const old=p.feet.map(f=>({...f}));p.x+=.01;p.stride+=.01/plan.gait.stride;
      updateContacts(p,1/60,.01,plan);
      p.feet.forEach((f,i)=>{
        if(!f.contact)lifted.add(i);
        if(f.contact&&old[i]!.contact){assert.equal(f.x,old[i]!.x);assert.equal(f.y,old[i]!.y);plantedSamples++;}
        assert.ok(Number.isFinite(f.x+f.y+f.z));
      });
    }
    assert.equal(lifted.size,count);assert.ok(plantedSamples>count*30);
    for(let tick=0;tick<60;tick++)updateContacts(p,1/60,0,plan);
    assert.ok(p.feet.every(f=>f.contact&&f.z===0));
  }
});

test('scalar materials accept rectangular textures, independent UV repeats and negative UVs',()=>{
  const texture={width:2,height:3,data:[.2,.4,.6,.8,1,1.2],repeatU:2,repeatV:1};
  assert.equal(sampleScalar(texture,.25,.5),.8);
  assert.equal(sampleScalar(texture,-.25,-.01),1.2);
  assert.equal(sampleScalar(texture,1.25,1.5),.8);
});

test('the shared rasterizer resolves depth independent of triangle order and applies named materials',()=>{
  // Translation along (1,1,1) preserves this camera's projection and increases depth.
  const triangle=(shift:number,color:readonly [number,number,number],texture?:string)=>
    [[-.4,0,0],[.4,0,0],[0,0,.8]].map(p=>({p:[p[0]!+shift,p[1]!+shift,p[2]!+shift] as const,n:[0,0,1] as const,u:0,v:0,material:{color,texture}}));
  const mesh:Mesh={vertices:[...triangle(0,[200,0,0]),...triangle(1,[0,200,0],'leaves')],indices:[0,1,2,3,4,5]};
  const camera={width:40,height:40,x:20,y:30,scale:24};
  const style={light:[0,0,1] as const,ambient:1,diffuse:0,shadeSteps:24,tint:[1,1,1] as const};
  const textures={leaves:{width:1,height:1,data:[.5],repeatU:1,repeatV:1}};
  const a=rasterMesh(mesh,camera,style,textures);mesh.indices=[3,4,5,0,1,2];
  assert.deepEqual(a.data,rasterMesh(mesh,camera,style,textures).data);
  const offset=(24*40+20)*4;assert.deepEqual([...a.data.slice(offset,offset+4)],[0,100,0,255]);
});

test('a plant can animate and render through shared components without a rat pose or fur',()=>{
  const first=sproutModel({time:0,wind:.3,heading:0}),second=sproutModel({time:1,wind:.3,heading:0});
  const camera={width:128,height:128,x:64,y:105,scale:85};
  const style={light:[-1,-1,2] as const,ambient:.5,diffuse:.5,shadeSteps:16,tint:[1,1,1] as const};
  const a=rasterMesh(first,camera,style),b=rasterMesh(second,camera,style);
  assert.ok(a.data.some((v,i)=>i%4===3&&v===255));assert.notDeepEqual(a.data,b.data);
  assert.deepEqual(a.data,rasterMesh(sproutModel({time:0,wind:.3,heading:0}),camera,style).data);
});

test('two-link solver respects supplied lengths and bend direction for a reachable target',()=>{
  const joint=solveTwoLink([0,0,0],[1,0,0],.75,.75,[0,0,1]);
  assert.ok(joint[2]>0);assert.ok(Math.abs(Math.hypot(...joint)-.75)<1e-12);
  assert.ok(Math.abs(Math.hypot(joint[0]-1,joint[1],joint[2])-.75)<1e-12);
});

test('shared model and animation modules have no rat or application imports',async()=>{
  for(const directory of ['src/model','src/animation'])for(const file of await readdir(directory)){
    if(!file.endsWith('.ts'))continue;
    const source=await readFile(`${directory}/${file}`,'utf8');
    for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)){
      assert.doesNotMatch(match[1]!,/(?:^|\/)(?:rat|simulation|scene|main|assets)(?:\/|$)/,`${directory}/${file}`);
    }
  }
});
