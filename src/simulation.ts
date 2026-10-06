import { clamp, lerp, type Vec2 } from './math';

export const TAU = Math.PI * 2;
export const STREET_HALF_WIDTH = 2.3;
export type Action = 'idle' | 'walk' | 'scurry' | 'sniff' | 'listen' | 'groom';
export const ACTIONS: Action[] = ['idle', 'walk', 'scurry', 'sniff', 'listen', 'groom'];
export interface Pose extends Vec2 {
  heading: number; speed: number; stride: number; time: number;
  tail: Vec2[]; action: Action; mood: number;
}
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
function clone(p: Pose): Pose { return { ...p, tail: p.tail.map(v => ({ ...v })) }; }

/** One rat, world units, deterministic fixed-step motor. Camera never affects behavior. */
export class Rat {
  current: Pose;
  previous: Pose;
  targetHeading = .05;
  requested: Action = 'sniff';
  explore = true;
  mood = .12;
  private actionTime = 0;
  constructor() {
    this.current = { x: 0, y: 0, heading: .05, speed: 0, stride: 0, time: 0,
      tail: Array.from({ length: 15 }, (_, i) => ({ x: -.4 - i * .067, y: 0 })),
      action: 'sniff', mood: .12 };
    this.previous = clone(this.current);
  }
  command(action: Action): void {
    this.explore = false; this.requested = action; this.actionTime = 0;
  }
  steer(heading: number): void { this.targetHeading = heading; this.explore = false; }
  update(dt: number): void {
    this.previous = clone(this.current);
    const p = this.current;
    p.time += dt; this.actionTime += dt;
    if (this.explore) {
      const cycle = p.time % 22;
      this.requested = cycle < 3 ? 'sniff' : cycle < 12 ? 'walk' : cycle < 15 ? 'listen' : 'walk';
      this.targetHeading = Math.sin(p.time * .19) * .26 - p.y * .45;
    }
    const error = angleDelta(p.heading, this.targetHeading);
    p.heading += clamp(error, -dt * 2.8, dt * 2.8);
    const moving = this.requested === 'walk' || this.requested === 'scurry';
    // Turn first; a rat should never drift sideways while the billboard catches up.
    const cruise = this.requested === 'scurry' ? 1.75 : .66;
    const target = moving && Math.abs(error) < .25 ? cruise : 0;
    p.speed += clamp(target - p.speed, -dt * 5, dt * 2.8);
    const distance = Math.abs(error) < .4 ? p.speed * dt : 0;
    const nextY = p.y + Math.sin(p.heading) * distance;
    if (Math.abs(nextY) <= STREET_HALF_WIDTH) {
      p.x += Math.cos(p.heading) * distance; p.y = nextY;
      p.stride += distance / (this.requested === 'scurry' ? .67 : .45);
    } else { p.speed = 0; }
    p.action = p.speed > .02 ? (this.requested === 'scurry' ? 'scurry' : 'walk') : moving ? 'idle' : this.requested;
    p.mood = lerp(p.mood, this.mood, 1 - Math.exp(-dt * 1.4));
    this.updateTail(dt);
  }
  private updateTail(dt: number): void {
    const p = this.current;
    p.tail[0] = { x: p.x - Math.cos(p.heading) * .39, y: p.y - Math.sin(p.heading) * .39 };
    // A damped chain trails actual travel. Curvature propagates from root to tip.
    for (let i = 1; i < p.tail.length; i++) {
      const parent = p.tail[i - 1]!, point = p.tail[i]!;
      const bend = Math.sin(p.time * 1.8 - i * .28) * .22 * i / p.tail.length;
      const follow = p.heading + Math.sin(p.stride * TAU - i * .23) * .09 * Math.min(1, p.speed);
      point.x = lerp(point.x, parent.x - Math.cos(follow + bend) * .067, dt * 5);
      point.y = lerp(point.y, parent.y - Math.sin(follow + bend) * .067, dt * 5);
      const dx = point.x - parent.x, dy = point.y - parent.y;
      const length = Math.hypot(dx, dy) || 1;
      point.x = parent.x + dx / length * .067; point.y = parent.y + dy / length * .067;
    }
  }
  sample(alpha: number): Pose {
    const a = this.previous, b = this.current;
    return { ...b, x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha),
      heading: a.heading + angleDelta(a.heading, b.heading) * alpha,
      speed: lerp(a.speed, b.speed, alpha), stride: lerp(a.stride, b.stride, alpha),
      time: lerp(a.time, b.time, alpha), mood: lerp(a.mood, b.mood, alpha),
      tail: b.tail.map((p, i) => ({ x: lerp(a.tail[i]!.x, p.x, alpha), y: lerp(a.tail[i]!.y, p.y, alpha) })) };
  }
}
