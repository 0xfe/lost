import { bone, createMesh, ellipsoid, type Mesh } from '../model/mesh';
import { add, rotate, type V3 } from '../model/vector';
import { solid } from '../model/material';

export interface SproutPose { time:number; wind:number; heading:number }
const stem=solid([103,125,68]),leaf=solid([110,155,78]);

/** Minimal non-rat consumer: rooted plant, wind-bent stem and independently rotated leaves. */
export function sproutModel(p:SproutPose):Mesh {
  const mesh=createMesh();
  const at=(height:number):V3=>rotate([
    Math.sin(p.time*1.7+height)*height*height*p.wind,0,height,
  ],p.heading);
  for(let i=0;i<5;i++)bone(mesh,at(i*.15),at((i+1)*.15),.025-i*.003,stem);
  for(const side of [-1,1]){
    const root=at(side<0?.35:.57);
    const orientation=(v:V3):V3=>rotate(v,p.heading+side*.6+Math.sin(p.time*2+side)*p.wind*.3);
    const position=(v:V3):V3=>add(root,orientation(v));
    ellipsoid(mesh,[side*.18,0,.025],[.23,.09,.02],leaf,position,orientation);
  }
  return mesh;
}
