import type { Pose } from '../simulation';
import { FEET, fraction } from './locomotion';
import { add, mul, rotate, ellipsoid, bone, loft, joint, type Mesh, type V3, type Transform } from './mesh';

export interface Rig { mesh:Mesh; joints:{hip:V3;knee:V3;ankle:V3;upper:number;lower:number}[]; nose:V3; ears:V3[]; spine:V3[] }
const TAU=Math.PI*2;
const fur=[139,117,95] as const,skin=[177,127,119] as const;
function pulse(time:number,period:number,offset:number,duration:number):number{
  const t=fraction((time+offset)/period)*period;
  return t<duration?Math.sin(t/duration*Math.PI)**2:0;
}

/** Continuous articulated anatomy. Feet arrive from the contact planner, not a looping image. */
export function ratModel(p:Pose):Rig{
  const mesh:Mesh={vertices:[],indices:[]},joints:Rig['joints']=[];
  const run=p.gallop*p.activity,phase=p.stride*TAU;
  const gather=Math.cos(phase-TAU*.47);
  const stretch=1-run*.115*gather;
  const sway=Math.sin(phase)*.018*p.activity*(1-run*.8);
  const lift=run*(.022+Math.sin(phase-TAU*.69)*.027);
  const breath=Math.sin(p.time*4.8)*.004*(1-p.activity*.6);
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
    const sample=(channel:number)=>.5*((2*b[channel]!)+(-a[channel]!+c[channel]!)*t+(2*a[channel]!-5*b[channel]!+4*c[channel]!-d[channel]!)*t*t+(-a[channel]!+3*b[channel]!-3*c[channel]!+d[channel]!)*t*t*t);
    const at=bodyPoint(sample(0),0,sample(1));sections.push({x:at[0],y:at[1],z:at[2],ry:Math.max(.015,sample(2)),rz:Math.max(.02,sample(3))});
  }
  const last=profile.at(-1)!,at=bodyPoint(last[0]!,0,last[1]!);sections.push({x:at[0],y:at[1],z:at[2],ry:last[2]!,rz:last[3]!});
  loft(mesh,sections,fur,world,world,24);

  const headPitch=.10+p.sniff*.20-p.listen*.24+p.groom*.20+Math.sin(p.time*28)*.025*p.sniff;
  const yaw=p.headYaw+Math.sin(p.time*2.7)*.02*p.sniff;
  const headBase=bodyPoint(.35,0,.29+p.listen*.035-p.sniff*.02);
  const headOrientation:Transform=v=>rotate([v[0]*Math.cos(headPitch)+v[2]*Math.sin(headPitch),v[1],-v[0]*Math.sin(headPitch)+v[2]*Math.cos(headPitch)],yaw);
  const head:Transform=v=>world(add(headBase,headOrientation(v)));
  const headNormal:Transform=v=>world(headOrientation(v));
  ellipsoid(mesh,[.10,0,.025],[.205,.124,.128],fur,true,head,headNormal,20,12);
  loft(mesh,[
    {x:.20,y:0,z:.012,ry:.106,rz:.094},{x:.30,y:0,z:-.013,ry:.079,rz:.067},
    {x:.40,y:0,z:-.035,ry:.048,rz:.038},{x:.47,y:0,z:-.04,ry:.022,rz:.021},
  ],[157,138,117],head,headNormal,18);
  const nose=head([.479,0,-.037]);
  ellipsoid(mesh,[.479,0,-.037],[.022,.027,.018],[170,117,111],false,head,headNormal,10,6);
  const blink=pulse(p.time,5.3,1.3,.12);
  const ears:V3[]=[];
  for(const side of [-1,1]){
    ellipsoid(mesh,[.195,side*.110,.065],[.037,.021,.036*(1-blink*.92)],[17,15,13],false,head,headNormal,12,8);
    if(blink<.5)ellipsoid(mesh,[.204,side*.123,.078],[.009,.006,.009],[208,203,179],false,head,headNormal,7,5);
    const flick=pulse(p.time,side<0?4.7:6.1,side<0?.8:2.4,.24)*.55;
    const tilt=side*(.12+flick+Math.sin(p.time*1.3+side)*.07)+p.listen*.14;
    const earRoot:V3=[-.01,side*.112,.12];
    const earOrientation:Transform=v=>[v[0],v[1]*Math.cos(tilt)-v[2]*Math.sin(tilt),v[1]*Math.sin(tilt)+v[2]*Math.cos(tilt)];
    const ear:Transform=v=>head(add(earRoot,earOrientation(v)));
    const earNormal:Transform=v=>headNormal(earOrientation(v));
    ears.push(ear([0,0,.10]));
    ellipsoid(mesh,[0,0,.053],[.067,.022,.088],[120,96,82],false,ear,earNormal,16,10);
    ellipsoid(mesh,[.006,side*.018,.057],[.053,.008,.069],[174,127,117],false,ear,earNormal,14,9);
    // Each whisker is a tapered chain, following head orientation and exploratory whisking.
    const whisk=(Math.sin(p.time*(p.sniff>.5?43:31)+side*.45)*.18+.18)*(.5+p.sniff*.5);
    for(let j=0;j<5;j++){
      let from=head([.38+j*.012,side*.045,-.025]);
      for(let k=1;k<=3;k++){
        const t=k/3,tip=head([.39+j*.01+(.04-j*.035+whisk*.18)*t,side*(.045+t*(.19+(.02*j))),-.025+t*(j-2)*.024]);
        bone(mesh,from,tip,.0032*(1-t*.65),[167,160,143]);from=tip;
      }
    }
  }

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
    const knee=joint(hip,ankle,upper,lower,world([def.fore?-1:1,side*.13,0]));
    joints.push({hip,knee,ankle,upper,lower});
    bone(mesh,hip,knee,def.fore?.050:.097,fur,true);
    bone(mesh,knee,ankle,def.fore?.027:.037,[139,119,100],true);
    const pawOrientation:Transform=v=>rotate(v,footAngle);
    const paw:Transform=v=>add([foot.x-p.x,foot.y-p.y,foot.z],pawOrientation(v));
    ellipsoid(mesh,[-.005,0,.020],[def.fore?.060:.083,.034,.021],skin,false,paw,pawOrientation,10,6);
    for(let toeIndex=0;toeIndex<(def.fore?4:5);toeIndex++){
      const lateral=(toeIndex-(def.fore?1.5:2))*.015;
      const a=paw([.025,lateral,.015]),b=paw([.075-Math.abs(lateral)*.25,lateral*1.2,.008]);
      bone(mesh,a,b,.007,[168,119,112]);
      bone(mesh,b,paw([.086-Math.abs(lateral)*.25,lateral*1.22,.005]),.003,[190,175,148]);
    }
  }
  // Tail starts on the deformed pelvis. Most of its length trails world motion on the ground.
  let previous=bodyWorld(-.66,0,.16);
  const tailRoot=previous;
  for(let i=1;i<p.tail.length;i++){
    const t=i/(p.tail.length-1),tail=p.tail[i]!;
    const target:V3=[tail.x-p.x,tail.y-p.y,.015+Math.exp(-t*8)*.10];
    const base=mul(tailRoot,Math.exp(-t*14));
    const to:V3=[target[0]+base[0]*.06,target[1]+base[1]*.06,target[2]];
    bone(mesh,previous,to,.031*(1-t)**.8+.002,[143-i*.8,106-i*.5,99-i*.4]);previous=to;
  }
  return {mesh,joints,nose,ears,spine:sections.map(s=>world([s.x,s.y,s.z+s.rz]))};
}
