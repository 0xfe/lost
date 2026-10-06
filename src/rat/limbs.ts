import type { Pose } from './types';
import type { RatBody } from './body';
import { ellipsoid, bone, type Mesh } from '../model/mesh';
import { add, rotate, type V3, type Transform } from '../model/vector';
import { solid } from '../model/material';
import { fur, skin, textured } from './materials';
import { solveTwoLink } from '../animation/ik';
import { FEET } from './locomotion';

export interface Limb { hip:V3;knee:V3;ankle:V3;upper:number;lower:number }
export function buildLimbs(mesh:Mesh,p:Pose,{bodyWorld,world}:RatBody):Limb[]{
  const joints:Limb[]=[];
  for(let i=0;i<4;i++){
    const def=FEET[i]!,foot=p.feet[i]!,side=def.y<0?-1:1;
    // Scapular glide participates in forelimb reach; the hind knee flexes forwards.
    const localFoot=rotate([foot.x-p.x,foot.y-p.y,foot.z],-p.heading);
    const scapula=def.fore?(localFoot[0]-.32)*.16:0;
    const hip=bodyWorld(def.fore?.255+scapula:-.395,side*(def.fore?.139:.182),def.fore?.275:.31);
    const footAngle=foot.heading;
    const toe=def.fore?.044:.066;
    const ankle:V3=[foot.x-p.x-Math.cos(footAngle)*toe,foot.y-p.y-Math.sin(footAngle)*toe,foot.z+.025];
    const upper=def.fore?.205:.255,lower=def.fore?.235:.26;
    const knee=solveTwoLink(hip,ankle,upper,lower,world([def.fore?-1:1,side*.13,0]));
    joints.push({hip,knee,ankle,upper,lower});
    bone(mesh,hip,knee,def.fore?.050:.097,fur);
    bone(mesh,knee,ankle,def.fore?.027:.037,textured([139,119,100]));
    const pawOrientation:Transform=v=>rotate(v,footAngle);
    const paw:Transform=v=>add([foot.x-p.x,foot.y-p.y,foot.z],pawOrientation(v));
    ellipsoid(mesh,[-.005,0,.020],[def.fore?.060:.083,.034,.021],skin,paw,pawOrientation,10,6);
    for(let toeIndex=0;toeIndex<(def.fore?4:5);toeIndex++){
      const lateral=(toeIndex-(def.fore?1.5:2))*.015;
      const a=paw([.025,lateral,.015]),b=paw([.075-Math.abs(lateral)*.25,lateral*1.2,.008]);
      bone(mesh,a,b,.007,solid([168,119,112]));
      bone(mesh,b,paw([.086-Math.abs(lateral)*.25,lateral*1.22,.005]),.003,solid([190,175,148]));
    }
  }
  return joints;
}
