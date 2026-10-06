import { constrainContactTurn } from './animation/contacts';
import { updateTrailingChain } from './animation/chain';
import { clamp, lerp } from './math';
import { createFeet, updateFeet, FEET, GAITS, type Gait } from './rat/locomotion';
import type { Action, Pose } from './rat/types';

export const TAU = Math.PI * 2;
export const STREET_HALF_WIDTH = 2.3;
export type { Action, Pose } from './rat/types';
export const ACTIONS: Action[] = ['idle', 'walk', 'scurry', 'sniff', 'listen', 'groom'];
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function directionRow(heading: number): number {
  // Source rows follow SCREEN directions, not world headings.
  const sx = Math.cos(heading) - Math.sin(heading);
  const sy = (Math.cos(heading) + Math.sin(heading)) * .5;
  return (Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) + 8) % 8;
}
export function screenHeading(x: number, y: number): number {
  return Math.atan2(y - x * .5, y + x * .5);
}
function clone(p: Pose): Pose { return { ...p, tail: p.tail.map(v => ({ ...v })),feet:p.feet.map(f=>({...f,from:{...f.from},target:{...f.target}})) }; }

/** One rat, world units, deterministic fixed-step motor. Camera never affects behavior. */
export class Rat {
  current: Pose;
  previous: Pose;
  targetHeading = .05;
  requested: Action = 'sniff';
  explore = true;
  mood = .12;
  constructor(private options:{streetHalfWidth?:number}={}) {
    this.current = { x: 0, y: 0, heading: .05, speed: 0, stride: 0, time: 0,
      tail: Array.from({ length: 19 }, (_, i) => ({ x: -.65 - i * .062, y: 0 })),
      action: 'sniff', mood: .12,feet:createFeet({x:0,y:0,heading:.05}),gait:'walk',gallop:0,activity:0,
      sniff:1,listen:0,groom:0,headYaw:0 };
    this.previous = clone(this.current);
  }
  command(action: Action): void {
    this.explore = false; this.requested = action;
  }
  steer(heading: number): void { this.targetHeading = heading; this.explore = false; }
  update(dt: number): void {
    this.previous = clone(this.current);
    const p = this.current;
    p.time += dt;
    if (this.explore) {
      const cycle = p.time % 22;
      this.requested = cycle < 3 ? 'sniff' : cycle < 12 ? 'walk' : cycle < 15 ? 'listen' : 'walk';
      this.targetHeading = Math.sin(p.time * .19) * .26 - p.y * .45;
    }
    const error = angleDelta(p.heading, this.targetHeading);
    let turn=clamp(error,-dt*2.8,dt*2.8);
    // Let a planted pivot unload its feet before twisting the shoulders out of reach.
    turn=constrainContactTurn(p,FEET,turn,.22);
    p.heading+=turn;
    const moving = this.requested === 'walk' || this.requested === 'scurry';
    // Turn first; translation follows the body's heading.
    const cruise = this.requested === 'scurry' ? GAITS.scurry.speed : GAITS.walk.speed;
    const target = moving && Math.abs(error) < .25 ? cruise : 0;
    p.speed += clamp(target - p.speed, -dt * 9, dt * 5.5);
    const distance = Math.abs(error) < .4 ? p.speed * dt : 0;
    const nextY = p.y + Math.sin(p.heading) * distance;
    if (Math.abs(nextY) <= (this.options.streetHalfWidth??STREET_HALF_WIDTH)) {
      p.x += Math.cos(p.heading) * distance; p.y = nextY;
      p.stride += distance / GAITS[p.gait].stride;
    } else { p.speed = 0; }
    p.action = p.speed > .02 ? (this.requested === 'scurry' ? 'scurry' : 'walk') : moving ? 'idle' : this.requested;
    const nextGait:Gait=this.requested==='scurry'&&p.speed>1.5?'scurry':'walk';
    // Commit at a cycle boundary; active swings keep their phase endpoints.
    if(Math.floor(p.stride)!==Math.floor(this.previous.stride)||p.speed<.01)p.gait=nextGait;
    p.gallop=lerp(p.gallop,p.gait==='scurry'?1:0,1-Math.exp(-dt*9));
    p.activity=lerp(p.activity,Math.min(1,p.speed/.6),1-Math.exp(-dt*12));
    for(const name of ['sniff','listen','groom'] as const)p[name]=lerp(p[name],p.action===name?1:0,1-Math.exp(-dt*7));
    const scan=(Math.sin(p.time*.83)*.16+Math.sin(p.time*1.91)*.07)*(1-p.activity*.85);
    p.headYaw=lerp(p.headYaw,clamp(error*.5,-.40,.40)+scan*(1-p.groom),1-Math.exp(-dt*7));
    p.mood = lerp(p.mood, this.mood, 1 - Math.exp(-dt * 1.4));
    updateFeet(p,dt,Math.hypot(p.x-this.previous.x,p.y-this.previous.y));
    this.updateTail(dt);
  }
  private updateTail(dt: number): void {
    const p = this.current;
    const root={x:p.x-Math.cos(p.heading)*.65,y:p.y-Math.sin(p.heading)*.65};
    updateTrailingChain(p.tail,root,.062,dt,3,i=>{
      const bend=Math.sin(p.time*1.8-i*.28)*.22*i/p.tail.length;
      const follow=p.heading+Math.sin(p.stride*TAU-i*.23)*.09*Math.min(1,p.speed);
      return follow+bend;
    });
  }

  sample(alpha: number): Pose {
    const a = this.previous, b = this.current;
    return { ...b, x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha),
      heading: a.heading + angleDelta(a.heading, b.heading) * alpha,
      speed: lerp(a.speed, b.speed, alpha), stride: lerp(a.stride, b.stride, alpha),
      time: lerp(a.time, b.time, alpha), mood: lerp(a.mood, b.mood, alpha),
      gallop:lerp(a.gallop,b.gallop,alpha),activity:lerp(a.activity,b.activity,alpha),
      sniff:lerp(a.sniff,b.sniff,alpha),listen:lerp(a.listen,b.listen,alpha),groom:lerp(a.groom,b.groom,alpha),
      headYaw:lerp(a.headYaw,b.headYaw,alpha),
      feet:b.feet.map((f,i)=>({...f,x:lerp(a.feet[i]!.x,f.x,alpha),y:lerp(a.feet[i]!.y,f.y,alpha),z:lerp(a.feet[i]!.z,f.z,alpha)})),
      tail: b.tail.map((p, i) => ({ x: lerp(a.tail[i]!.x, p.x, alpha), y: lerp(a.tail[i]!.y, p.y, alpha) })) };
  }
}
