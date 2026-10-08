import { clamp, hash, noise, random, type Vec2 } from '../math';
import type { Pose } from '../rat/types';
import { nearbyLamps } from '../world/street';

export const groups=['music','rain','insects','foliage','people','candle','rat'] as const;
export type SoundGroup=typeof groups[number];
export type Clip='rain'|'drizzle'|'crickets'|'candle'|'voices'|`leaves${1|2|3}`|`stone${1|2|3}`|`sand${1|2|3}`;
export const clips:Clip[]=['rain','drizzle','crickets','candle','voices','leaves1','leaves2','leaves3','stone1','stone2','stone3','sand1','sand2','sand3'];
/** Gains act on RMS-normalized recordings. All distances are world units. */
export const mix:Record<SoundGroup,number>={music:.28,rain:.34,insects:.24,foliage:.27,people:.42,candle:.15,rat:.55};
export interface Sound extends Vec2 {
  id:string;clip:Clip;group:SoundGroup;gain:number;rate:number;cutoff:number;wet:number;
  z?:number;at:number;duration:number;offset:number;vx?:number;loop?:boolean;highpass?:number;
}
export interface Spatial { pan:number;gain:number;cutoff:number }
/** Fixed camera stereo: screen-right is +world-x / -world-y. */
export function spatial(sound:Sound,listener:Vec2,time:number):Spatial {
  const dx=sound.x+(sound.vx??0)*Math.max(0,time-sound.at)-listener.x,dy=sound.y-listener.y;
  const distance=Math.hypot(dx,dy,(sound.z??0)*.4);
  return {pan:clamp((dx-dy)/Math.SQRT2/(3+distance*.7),-.94,.94),
    gain:1/(1+(distance/4)**2),cutoff:Math.max(500,sound.cutoff/(1+distance*.12))};
}
function sound(id:string,clip:Clip,group:SoundGroup,p:Vec2,time:number,extra:Partial<Sound>={}):Sound {
  return {id,clip,group,x:p.x,y:p.y,at:time,gain:1,rate:1,cutoff:9000,wet:.12,duration:.3,offset:0,...extra};
}
interface Passer { x:number;y:number;start:number;end:number;vx:number;step:number;voice:number;cadence:number;soft:boolean;talks:boolean }
/** Pure score. Contact events use the physics clock; no audio/browser state affects the rat. */
export class StreetScore {
  private rng=random(0x1057a);
  private serial=0;
  private nextLeaves=2;
  private nextPerson=9;
  private person?:Passer;
  update(before:Pose,p:Pose):Sound[]{
    const events:Sound[]=[];
    p.feet.forEach((foot,i)=>{
      if(!foot.contact||before.feet[i]!.contact)return;
      const n=1+Math.floor(this.rng()*3) as 1|2|3;
      events.push(sound(`paw-${this.serial++}`,`stone${n}`,'rat',foot,p.time,{
        gain:(.16+Math.min(p.speed,4)*.035)*(i<2?.85:1)*( .8+this.rng()*.4),
        rate:1.8+this.rng()*.35,highpass:1000,cutoff:6500,duration:.065,wet:.05}));
      if(p.speed>.05&&this.rng()<.25)events.push(sound(`crawl-${this.serial++}`,`leaves${n}`,'rat',foot,p.time,{
        gain:.075,rate:1.3+this.rng()*.3,highpass:1800,cutoff:8000,duration:.11,offset:.1,wet:.03}));
    });
    if(p.time>=this.nextLeaves){
      const n=1+Math.floor(this.rng()*3) as 1|2|3;
      events.push(sound(`leaves-${this.serial++}`,`leaves${n}`,'foliage',{x:p.x+(this.rng()-.5)*12,y:this.rng()<.5?-3:3},p.time,{
        gain:.25+this.rng()*.35,rate:.85+this.rng()*.3,duration:.5+this.rng()*.8,cutoff:6500,wet:.18}));
      this.nextLeaves=p.time+4+this.rng()*10;
    }
    if(!this.person&&p.time>=this.nextPerson){
      const dir=this.rng()<.5?-1:1,speed=.65+this.rng()*.65;
      this.person={x:p.x-dir*12,y:(this.rng()<.5?-1:1)*(4.5+this.rng()*2),start:p.time,end:p.time+24/speed,
        vx:dir*speed,step:p.time,voice:p.time+2,cadence:.43+this.rng()*.25,soft:this.rng()<.45,talks:this.rng()<.65};
    }
    const h=this.person;
    if(h){
      const pos={x:h.x+(p.time-h.start)*h.vx,y:h.y};
      if(p.time>=h.end){this.person=undefined;this.nextPerson=p.time+15+this.rng()*25;}
      else{
        if(p.time>=h.step){const n=1+Math.floor(this.rng()*3) as 1|2|3;
          events.push(sound(`human-${this.serial++}`,`${h.soft?'sand':'stone'}${n}`,'people',pos,p.time,{
            gain:.55+this.rng()*.35,rate:(h.soft?1.05:.85)+this.rng()*.1,cutoff:4200,wet:.35,duration:.35,vx:h.vx}));
          h.step=p.time+h.cadence*(.88+this.rng()*.24);
        }
        if(h.talks&&p.time>=h.voice){
          events.push(sound(`voice-${this.serial++}`,'voices','people',pos,p.time,{
            gain:.48,rate:.97+this.rng()*.06,cutoff:1400,wet:.4,duration:1.5+this.rng()*2,offset:this.rng()*8,vx:h.vx,highpass:220}));
          h.voice=p.time+4+this.rng()*4;
        }
      }
    }
    return events;
  }
  beds(p:Pose,rain:boolean):Sound[]{
    const t=p.time,out:Sound[]=[],weather=.65+noise(t*.055,0,651)*.35;
    // Broad weather surrounds the camera; local insects and lamps stay anchored in the world.
    for(const side of [-1,1])out.push(sound(`rain-${side}`,side<0?'rain':'drizzle','rain',{x:p.x+side*3,y:p.y-side*2},t,{
      loop:true,duration:0,offset:side<0?0:3,rate:side<0?1:.93,gain:rain?weather*(side<0?.8:.5):0,cutoff:side<0?7200:3900,wet:.07}));
    const cell=Math.floor(p.x/12);
    for(let id=cell-1;id<=cell+1;id++)out.push(sound(`insects-${id}`,'crickets','insects',{x:id*12+4,y:hash(id,0,62)<.5?-4:4},t,{
      loop:true,duration:0,offset:hash(id,0,91)*7,rate:.94+hash(id,0,37)*.1,
      gain:(rain?.3:.8)*(.35+.65*noise(t*.12,id,77)),cutoff:10000,wet:.12}));
    for(const lamp of nearbyLamps(p.x,t,1))out.push(sound(`lamp-${lamp.id}`,'candle','candle',lamp,t,{
      z:lamp.z,loop:true,duration:0,offset:hash(lamp.id,0,33),rate:.97+hash(lamp.id,0,7)*.09,
      gain:lamp.power*.3,highpass:1100,cutoff:6000,wet:.1}));
    return out;
  }
}
