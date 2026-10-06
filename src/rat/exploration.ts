import { clamp, hash, noise, type Vec2 } from '../math';
import type { Action, Pose } from './types';

export type ExplorePhase='travel'|'pause'|'notice'|'approach'|'investigate'|'return';
export interface Intent {action:Action;heading:number;speed:number;tempo:number;look:number}
/** Seeded bouts with explicit scent approach/investigate/return, not frame-wise random steering. */
export class Exploration {
  phase:ExplorePhase='pause';
  scent:Vec2={x:0,y:0};
  resume:Vec2={x:0,y:0};
  route=0;
  private origin:Vec2={x:0,y:0};
  private elapsed=0;
  private duration=1.15;
  private event=0;
  private travelBouts=0;
  private action:Action='sniff';
  private pace=1;
  constructor(readonly seed=7319){}
  private choose(channel:number):number{return hash(this.event,channel,this.seed);}
  redirect(heading:number,p:Vec2):void{this.route=heading;this.origin={x:p.x,y:p.y};this.enter('travel');}
  private enter(phase:ExplorePhase):void{
    this.phase=phase;this.elapsed=0;this.event++;
    if(phase==='travel'){
      this.travelBouts++;this.duration=1.6+this.choose(1)*3.6;
      this.action=this.choose(2)<.14?'scurry':'walk';this.pace=.66+this.choose(3)*.55;
    }else if(phase==='pause'){
      this.duration=.35+this.choose(4)*1.6;this.action=this.choose(5)<.3?'listen':'sniff';
    }else if(phase==='notice')this.duration=.28+this.choose(6)*.42;
    else if(phase==='investigate')this.duration=1.2+this.choose(7)*2.1;
    else this.duration=9;
  }
  private startScent(p:Pose,width:number):void{
    const side=this.choose(10)<.5?-1:1,forward=.7+this.choose(11)*.7,lateral=.9+this.choose(12)*.55;
    this.resume={x:p.x+Math.cos(this.route)*.7,y:clamp(p.y+Math.sin(this.route)*.7,-width+.4,width-.4)};
    this.scent={x:p.x+Math.cos(this.route)*forward-Math.sin(this.route)*lateral*side,
      y:clamp(p.y+Math.sin(this.route)*forward+Math.cos(this.route)*lateral*side,-width+.5,width-.5)};
    this.enter('notice');
  }
  update(p:Pose,dt:number,width:number):Intent {
    this.elapsed+=dt;
    const distance=(target:Vec2)=>Math.hypot(target.x-p.x,target.y-p.y);
    if(this.phase==='travel'&&this.elapsed>=this.duration){
      if(this.travelBouts>=2&&this.choose(15)<.46)this.startScent(p,width);
      else this.enter(this.choose(16)<.45?'pause':'travel');
    }else if(this.phase==='pause'&&this.elapsed>=this.duration)this.enter('travel');
    else if(this.phase==='notice'&&this.elapsed>=this.duration)this.enter('approach');
    else if(this.phase==='approach'&&(distance(this.scent)<.18||this.elapsed>this.duration))this.enter('investigate');
    else if(this.phase==='investigate'&&this.elapsed>=this.duration)this.enter('return');
    else if(this.phase==='return'&&(distance(this.resume)<.2||this.elapsed>this.duration))this.enter('travel');

    const variation=noise(p.time*1.3,this.event*.73,this.seed);
    let action=this.action,heading=this.route,speed=this.pace*(.79+variation*.36);
    let look=(noise(p.time*2.1,2,this.seed)-.5)*.36;
    if(this.phase==='travel'){
      const lateral=-(p.x-this.origin.x)*Math.sin(this.route)+(p.y-this.origin.y)*Math.cos(this.route);
      heading=this.route+clamp(-lateral*.25,-.22,.22)+(noise(p.time*.95,0,this.seed)-.5)*.29;
      speed*=1-.32*Math.max(0,Math.sin(p.time*4.9+this.event)*variation);
    }else if(this.phase==='approach'||this.phase==='return'){
      const target=this.phase==='approach'?this.scent:this.resume,d=distance(target);
      heading=Math.atan2(target.y-p.y,target.x-p.x);
      action=d>.65&&this.phase==='approach'?'scurry':'walk';
      speed=action==='scurry'?1.05+variation*.14:clamp(d*1.35,.22,1.05);
    }else{
      action=this.phase==='pause'?this.action:'sniff';speed=0;
      const focus=this.phase==='pause'?this.route:Math.atan2(this.scent.y-p.y,this.scent.x-p.x);
      heading=focus+(this.phase==='investigate'?(noise(p.time*1.2,7,this.seed)-.5)*.55:0);
      look=(noise(p.time*2.8,6,this.seed)-.5)*.7;
    }
    // Respect the corridor even when the user points the route toward a wall.
    let dx=Math.cos(heading),dy=Math.sin(heading);
    const limit=width-.35;
    if(Math.abs(p.y+dy*1.2)>limit){
      dy=clamp((clamp(p.y+dy*1.2,-limit,limit)-p.y)/1.2,-1,1);
      if(Math.abs(dx)<.25)dx=Math.cos(this.route)>=0?.7:-.7;
      heading=Math.atan2(dy,dx);
    }
    return {action,heading,speed,look,tempo:.6+noise(p.time*1.6,this.event*.2,this.seed)*1.05};
  }
}
