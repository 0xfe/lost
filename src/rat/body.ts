import { clamp } from '../math';
import type { Pose } from './types';
import { rotate } from '../model/vector';
import { loft, type Mesh } from '../model/mesh';
import type { V3 } from '../model/vector';
import { catmullRom } from '../animation/curves';
import { fur } from './materials';
const TAU=Math.PI*2;

/** Rat silhouette and body deformation; returns attachment transforms for the other parts. */
export function buildBody(mesh:Mesh,p:Pose){
  const run=p.gallop*p.activity*(1+clamp((p.speed-3.3)/1.6,0,1)*.16),phase=p.stride*TAU;
  const gather=Math.cos(phase-TAU*.47);
  const stretch=1-run*.115*gather;
  const sway=Math.sin(phase)*.018*p.activity*(1-run*.8);
  const lift=run*(.022+Math.sin(phase-TAU*.69)*.027);
  const breath=Math.sin(p.motionTime*4.8)*.004*(1-p.activity*.6);
  const bodyPoint=(x:number,y:number,z:number):V3=>[
    x*stretch,y+sway*Math.cos(x*3),z+lift+breath+run*.058*gather*Math.exp(-x*x*7)+p.groom*.04*(x+.6),
  ];
  const world=(v:V3):V3=>rotate(v,p.heading);
  // Body coordinates stay root-relative. The shared camera supplies the world translation.
  const bodyWorld=(x:number,y:number,z:number)=>world(bodyPoint(x,y,z));
  const profile=[
    [-.68,.15,.026,.035],[-.60,.23,.13,.14],[-.46,.31,.235,.255],[-.28,.32,.255,.27],
    [-.07,.285,.218,.227],[.11,.245,.178,.192],[.27,.25,.154,.174],[.40,.267,.103,.115],[.47,.275,.045,.06],
  ];
  const sections=[];
  // Catmull-Rom interpolation keeps the back/rump smooth without a high triangle count.
  for(let i=0;i<profile.length-1;i++)for(let k=0;k<3;k++){
    const t=k/3,a=profile[Math.max(0,i-1)]!,b=profile[i]!,c=profile[i+1]!,d=profile[Math.min(profile.length-1,i+2)]!;
    const sample=(channel:number)=>catmullRom(a[channel]!,b[channel]!,c[channel]!,d[channel]!,t);
    const at=bodyPoint(sample(0),0,sample(1));sections.push({x:at[0],y:at[1],z:at[2],ry:Math.max(.015,sample(2)),rz:Math.max(.02,sample(3))});
  }
  const last=profile.at(-1)!,at=bodyPoint(last[0]!,0,last[1]!);sections.push({x:at[0],y:at[1],z:at[2],ry:last[2]!,rz:last[3]!});
  loft(mesh,sections,fur,world,world,24);
  return {bodyPoint,world,bodyWorld,sections};
}
export type RatBody = ReturnType<typeof buildBody>;
