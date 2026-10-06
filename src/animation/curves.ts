import { clamp } from '../math';

export const fraction=(n:number)=>n-Math.floor(n);
export const smooth=(n:number)=>{n=clamp(n,0,1);return n*n*n*(n*(n*6-15)+10);};
/** Brief deterministic impulse, useful for blinks, ear flicks and other accents. */
export function pulse(time:number,period:number,offset:number,duration:number):number {
  const t=fraction((time+offset)/period)*period;
  return t<duration?Math.sin(t/duration*Math.PI)**2:0;
}
/** Uniform Catmull-Rom channel; callers choose endpoint padding and sampling density. */
export function catmullRom(a:number,b:number,c:number,d:number,t:number):number {
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
}
