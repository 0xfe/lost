import { clamp, lerp } from '../math';

export type Gait = 'walk' | 'scurry';
export type Point3 = { x:number; y:number; z:number };
export interface Foot extends Point3 {
  contact:boolean; heading:number; from:Point3; target:Point3;
  start:number; end:number; progress:number; mode:'stance'|'stride'|'recover'|'gesture';
}
export interface Walker {
  x:number; y:number; heading:number; speed:number; stride:number; gait:Gait;
  time:number; groom:number; feet:Foot[];
}
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
export const fraction=(n:number)=>n-Math.floor(n);
export const smooth=(n:number)=>{n=clamp(n,0,1);return n*n*n*(n*(n*6-15)+10);};
export function worldPoint(p:Pick<Walker,'x'|'y'|'heading'>,x:number,y:number,z=0):Point3 {
  const c=Math.cos(p.heading),s=Math.sin(p.heading);
  return {x:p.x+x*c-y*s,y:p.y+x*s+y*c,z};
}
export function createFeet(p:Pick<Walker,'x'|'y'|'heading'>):Foot[]{
  return FEET.map(home=>{const point=worldPoint(p,home.x,home.y);return {...point,contact:true,heading:p.heading,from:{...point},target:{...point},start:0,end:0,progress:0,mode:'stance'};});
}

/** Contact anchors are WORLD positions. A stance foot is never translated with the root. */
export function updateFeet(p:Walker,dt:number,travelled:number):void {
  const gait=GAITS[p.gait],moving=travelled>1e-7;
  for(let i=0;i<4;i++){
    const foot=p.feet[i]!,home=FEET[i]!,neutral=worldPoint(p,home.x,home.y);
    const phase=fraction(p.stride-gait.offsets[i]!);
    const swing=phase>=gait.duty[i]!;
    if(home.fore&&p.groom>.02){
      const wash=.5+.5*Math.sin(p.time*12+(i? .5:0));
      const target=worldPoint(p,.68,home.y*.55,.23+wash*.09);
      foot.x=lerp(neutral.x,target.x,p.groom);foot.y=lerp(neutral.y,target.y,p.groom);foot.z=target.z*p.groom;
      foot.contact=false;foot.mode='gesture';continue;
    }
    const beginRecovery=()=>{foot.from={x:foot.x,y:foot.y,z:foot.z};foot.progress=0;foot.mode='recover';foot.contact=false;};
    if(foot.mode==='gesture')beginRecovery();
    if(!moving&&foot.mode==='stride')beginRecovery();
    if(foot.contact&&Math.hypot(foot.x-neutral.x,foot.y-neutral.y)>(moving?.24:.14)&&
      !p.feet.some(f=>f.mode==='recover'))beginRecovery();
    if(moving&&foot.contact&&swing){
      foot.from={x:foot.x,y:foot.y,z:foot.z};foot.start=p.stride;
      foot.end=Math.floor(p.stride-gait.offsets[i]!)+1+gait.offsets[i]!;
      foot.mode='stride';foot.contact=false;foot.progress=0;
    }
    if(foot.mode==='stride'){
      foot.progress=clamp((p.stride-foot.start)/Math.max(.01,foot.end-foot.start),0,1);
      // Predict touchdown, including the remaining swing. Only airborne targets may move.
      const remaining=Math.max(0,foot.end-p.stride)*gait.stride;
      const reach=gait.stride*gait.duty[i]!*.5;
      foot.target=worldPoint(p,home.x+remaining+reach,home.y);
    }else if(foot.mode==='recover'){
      foot.progress=Math.min(1,foot.progress+dt/.16);foot.target=neutral;
    }
    if(foot.mode==='stride'||foot.mode==='recover'){
      const t=foot.progress,ease=smooth(t),lift=foot.mode==='stride'?gait.lift:.055;
      foot.x=lerp(foot.from.x,foot.target.x,ease);foot.y=lerp(foot.from.y,foot.target.y,ease);
      foot.z=lerp(foot.from.z,0,ease)+Math.sin(Math.PI*t)**2*lift;
      foot.heading=p.heading;
      if(t>=1){foot.z=0;foot.contact=true;foot.mode='stance';}
    }
  }
}
