import { lerp } from '../math';
import { createContacts, updateContacts, worldPoint, type Contact, type ContactPose, type RootPose } from '../animation/contacts';

export { worldPoint } from '../animation/contacts';
export type Foot = Contact;
export type Gait = 'walk' | 'scurry';
interface Walker extends ContactPose { gait:Gait; time:number; groom:number }
/** Foot order: left fore, right fore, left hind, right hind. Units match the street. */
export const FEET = [
  {x:.34,y:-.16,fore:true}, {x:.34,y:.16,fore:true},
  {x:-.34,y:-.21,fore:false}, {x:-.34,y:.21,fore:false},
] as const;
export const GAITS = {
  walk:{speed:1.25,stride:.50,offsets:[.22,.72,0,.5],duty:[.70,.70,.70,.70],lift:.065},
  // Asymmetric gallop: fore pair receives weight, hind pair gathers and propels.
  // Two short intervals have no support; it is not a sped-up walking cycle.
  scurry:{speed:4.1,stride:.94,offsets:[0,.08,.49,.55],duty:[.30,.30,.32,.32],lift:.15},
} as const;

export const createFeet=(p:RootPose):Foot[]=>createContacts(p,FEET);

/** Rat gait and paw-washing policy, independent of the reusable contact mechanism. */
export function updateFeet(p:Walker,dt:number,travelled:number):void {
  updateContacts(p,dt,travelled,{
    homes:FEET,gait:GAITS[p.gait],
    settings:{movingReach:.24,restReach:.14,recoverySeconds:.16,recoveryLift:.055},
    gesture(i,neutral){
      const home=FEET[i]!;
      if(!home.fore||p.groom<=.02)return;
      const wash=.5+.5*Math.sin(p.time*12+(i? .5:0));
      const target=worldPoint(p,.68,home.y*.55,.23+wash*.09);
      return {x:lerp(neutral.x,target.x,p.groom),y:lerp(neutral.y,target.y,p.groom),z:target.z*p.groom};
    },
  });
}
