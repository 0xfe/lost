import { clamp, lerp, type Vec2 } from '../math';
import type { Color } from '../render';

export const STREET_HALF_WIDTH=2.3;
export const PAVING_REPEAT=12;
export const LAMP_SPACING=14;
export interface StreetLamp { id:number;x:number;y:number;z:number;radius:number;power:number }
export function lampAt(id:number,time:number):StreetLamp {
  return {id,x:id*LAMP_SPACING+6,y:id%2===0?3.6:-3.6,z:6.35,radius:5.3,
    power:.96+Math.sin(time*8.3+id*3)*.025+Math.sin(time*14.7+id)*.015};
}
export function nearbyLamps(x:number,time:number,range=2):StreetLamp[]{
  const center=Math.floor((x-6)/LAMP_SPACING);
  return Array.from({length:range*2+1},(_,i)=>lampAt(center+i-range,time));
}
/** Soft finite pools in world space. Camera motion never moves the illumination field. */
export function lampStrength(lamp:StreetLamp,x:number,y:number):number {
  const distance=Math.hypot(x-lamp.x,y-lamp.y)/lamp.radius;
  return lamp.power*Math.exp(-distance*distance*1.35);
}
export function illumination(lamps:readonly StreetLamp[],x:number,y:number):number {
  return Math.min(1.2,lamps.reduce((sum,l)=>sum+lampStrength(l,x,y),0));
}
export function stoneTint(lamps:readonly StreetLamp[],x:number,y:number,mood:number,wall=false):Color {
  const light=illumination(lamps,x,y),base=wall?185:215;
  const channel=(value:number)=>Math.min(255,Math.round(base*value/4)*4);
  return [channel(clamp(.24+mood*.09+light*.94,0,1.3)),
    channel(clamp(.29+mood*.07+light*.70,0,1.2)),
    channel(clamp(.39+mood*.02+light*.38,0,1.1)),255];
}
/** Same physical scale for the actor, its contacts and the street, including on portrait screens. */
export function sceneCamera(width:number,height:number,zoom:number):{scale:number;origin:Vec2}{
  const fit=Math.min(1,width/700,height/440);
  return {scale:86*zoom*fit,origin:{x:width*.5,y:height*lerp(.46,.51,clamp((width/height-.6)/.8,0,1))}};
}
export const DEFAULT_ZOOM=.9;
