import type { V3 } from './vector';

/** Sprite-local anchor and pixels per world unit, through the street's fixed 2:1 camera. */
export interface IsoCamera { width:number; height:number; x:number; y:number; scale:number }
export function projectIso(p:V3, camera:IsoCamera): {x:number;y:number;z:number} {
  return { x:camera.x+(p[0]-p[1])*camera.scale,
    y:camera.y+((p[0]+p[1])*.5-p[2])*camera.scale, z:p[0]+p[1]+p[2] };
}
