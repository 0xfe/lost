import type { Pose } from './types';
import type { RatBody } from './body';
import { bone, type Mesh } from '../model/mesh';
import { mul, type V3 } from '../model/vector';
import { solid } from '../model/material';

export function buildTail(mesh:Mesh,p:Pose,{bodyWorld}:RatBody):void{
  // Tail starts on the deformed pelvis. Most of its length trails world motion on the ground.
  let previous=bodyWorld(-.66,0,.16);
  const tailRoot=previous;
  for(let i=1;i<p.tail.length;i++){
    const t=i/(p.tail.length-1),tail=p.tail[i]!;
    const target:V3=[tail.x-p.x,tail.y-p.y,.015+Math.exp(-t*8)*.10];
    const base=mul(tailRoot,Math.exp(-t*14));
    const to:V3=[target[0]+base[0]*.06,target[1]+base[1]*.06,target[2]];
    bone(mesh,previous,to,.031*(1-t)**.8+.002,solid([143-i*.8,106-i*.5,99-i*.4]));previous=to;
  }
}
