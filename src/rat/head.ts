import type { Pose } from './types';
import type { RatBody } from './body';
import { ellipsoid, bone, loft, type Mesh } from '../model/mesh';
import { add, rotate, type V3, type Transform } from '../model/vector';
import { solid } from '../model/material';
import { fur, textured } from './materials';
import { pulse } from '../animation/curves';

export function buildHead(mesh:Mesh,p:Pose,{bodyPoint,world}:RatBody){
  const headPitch=.10+p.sniff*.20-p.listen*.24+p.groom*.20+Math.sin(p.time*28)*.025*p.sniff;
  const yaw=p.headYaw+Math.sin(p.time*2.7)*.02*p.sniff;
  const headBase=bodyPoint(.35,0,.29+p.listen*.035-p.sniff*.02);
  const headOrientation:Transform=v=>rotate([v[0]*Math.cos(headPitch)+v[2]*Math.sin(headPitch),v[1],-v[0]*Math.sin(headPitch)+v[2]*Math.cos(headPitch)],yaw);
  const head:Transform=v=>world(add(headBase,headOrientation(v)));
  const headNormal:Transform=v=>world(headOrientation(v));
  ellipsoid(mesh,[.10,0,.025],[.205,.124,.128],fur,head,headNormal,20,12);
  loft(mesh,[
    {x:.20,y:0,z:.012,ry:.106,rz:.094},{x:.30,y:0,z:-.013,ry:.079,rz:.067},
    {x:.40,y:0,z:-.035,ry:.048,rz:.038},{x:.47,y:0,z:-.04,ry:.022,rz:.021},
  ],textured([157,138,117]),head,headNormal,18);
  const nose=head([.479,0,-.037]);
  ellipsoid(mesh,[.479,0,-.037],[.022,.027,.018],solid([170,117,111]),head,headNormal,10,6);
  const blink=pulse(p.time,5.3,1.3,.12);
  const ears:V3[]=[];
  for(const side of [-1,1]){
    ellipsoid(mesh,[.195,side*.110,.065],[.037,.021,.036*(1-blink*.92)],solid([17,15,13]),head,headNormal,12,8);
    if(blink<.5)ellipsoid(mesh,[.204,side*.123,.078],[.009,.006,.009],solid([208,203,179]),head,headNormal,7,5);
    const flick=pulse(p.time,side<0?4.7:6.1,side<0?.8:2.4,.24)*.55;
    const tilt=side*(.12+flick+Math.sin(p.time*1.3+side)*.07)+p.listen*.14;
    const earRoot:V3=[-.01,side*.112,.12];
    const earOrientation:Transform=v=>[v[0],v[1]*Math.cos(tilt)-v[2]*Math.sin(tilt),v[1]*Math.sin(tilt)+v[2]*Math.cos(tilt)];
    const ear:Transform=v=>head(add(earRoot,earOrientation(v)));
    const earNormal:Transform=v=>headNormal(earOrientation(v));
    ears.push(ear([0,0,.10]));
    ellipsoid(mesh,[0,0,.053],[.067,.022,.088],solid([120,96,82]),ear,earNormal,16,10);
    ellipsoid(mesh,[.006,side*.018,.057],[.053,.008,.069],solid([174,127,117]),ear,earNormal,14,9);
    // Each whisker is a tapered chain, following head orientation and exploratory whisking.
    const whisk=(Math.sin(p.time*(p.sniff>.5?43:31)+side*.45)*.18+.18)*(.5+p.sniff*.5);
    for(let j=0;j<5;j++){
      let from=head([.38+j*.012,side*.045,-.025]);
      for(let k=1;k<=3;k++){
        const t=k/3,tip=head([.39+j*.01+(.04-j*.035+whisk*.18)*t,side*(.045+t*(.19+(.02*j))),-.025+t*(j-2)*.024]);
        bone(mesh,from,tip,.0032*(1-t*.65),solid([167,160,143]));from=tip;
      }
    }
  }

  return {nose,ears};
}
