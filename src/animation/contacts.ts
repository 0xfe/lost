import { clamp, lerp } from '../math';
import { fraction, smooth } from './curves';

export interface Point3 { x:number; y:number; z:number }
export interface RootPose { x:number; y:number; heading:number }
export interface ContactHome { x:number; y:number }
export interface Contact extends Point3 {
  contact:boolean; heading:number; from:Point3; target:Point3;
  start:number; end:number; progress:number; mode:'stance'|'stride'|'recover'|'gesture';
}
export interface ContactPose extends RootPose { stride:number; feet:Contact[] }
export interface GaitPattern {
  stride:number; offsets:readonly number[]; duty:readonly number[]; lift:number;
}
export interface ContactPlan {
  homes:readonly ContactHome[];
  gait:GaitPattern;
  settings:{movingReach:number;restReach:number;recoverySeconds:number;recoveryLift:number};
  /** Optional world-space target for a released contact, e.g. a hand reaching or grooming. */
  gesture?:(index:number,neutral:Point3)=>Point3|undefined;
}

export function worldPoint(p:RootPose,x:number,y:number,z=0):Point3 {
  const c=Math.cos(p.heading),s=Math.sin(p.heading);
  return {x:p.x+x*c-y*s,y:p.y+x*s+y*c,z};
}
export function createContacts(p:RootPose,homes:readonly ContactHome[]):Contact[]{
  return homes.map(home=>{const point=worldPoint(p,home.x,home.y);return {...point,contact:true,heading:p.heading,from:{...point},target:{...point},start:0,end:0,progress:0,mode:'stance'};});
}

/** Contact anchors are WORLD positions. A stance foot is never translated with the root. */
export function updateContacts(p:ContactPose,dt:number,travelled:number,plan:ContactPlan):void {
  const {gait,homes,settings}=plan,moving=travelled>1e-7;
  for(let i=0;i<homes.length;i++){
    const foot=p.feet[i]!,home=homes[i]!,neutral=worldPoint(p,home.x,home.y);
    const phase=fraction(p.stride-gait.offsets[i]!);
    const swing=phase>=gait.duty[i]!;
    const gesture=plan.gesture?.(i,neutral);
    if(gesture){
      foot.x=gesture.x;foot.y=gesture.y;foot.z=gesture.z;
      foot.contact=false;foot.mode='gesture';continue;
    }
    const beginRecovery=()=>{foot.from={x:foot.x,y:foot.y,z:foot.z};foot.progress=0;foot.mode='recover';foot.contact=false;};
    if(foot.mode==='gesture')beginRecovery();
    if(!moving&&foot.mode==='stride')beginRecovery();
    if(foot.contact&&Math.hypot(foot.x-neutral.x,foot.y-neutral.y)>(moving?settings.movingReach:settings.restReach)&&
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
      foot.progress=Math.min(1,foot.progress+dt/settings.recoverySeconds);foot.target=neutral;
    }
    if(foot.mode==='stride'||foot.mode==='recover'){
      const t=foot.progress,ease=smooth(t),lift=foot.mode==='stride'?gait.lift:settings.recoveryLift;
      foot.x=lerp(foot.from.x,foot.target.x,ease);foot.y=lerp(foot.from.y,foot.target.y,ease);
      foot.z=lerp(foot.from.z,0,ease)+Math.sin(Math.PI*t)**2*lift;
      foot.heading=p.heading;
      if(t>=1){foot.z=0;foot.contact=true;foot.mode='stance';}
    }
  }
}

/** Stop a proposed pivot if a planted contact needs to replant first. */
export function constrainContactTurn(p:ContactPose,homes:readonly ContactHome[],turn:number,maxReach:number):number {
  for(let i=0;i<homes.length;i++)if(p.feet[i]!.contact){
    const home=homes[i]!,candidate=worldPoint({...p,heading:p.heading+turn},home.x,home.y);
    if(Math.hypot(candidate.x-p.feet[i]!.x,candidate.y-p.feet[i]!.y)>maxReach)turn=0;
  }
  return turn;
}
