import { hash, noise } from '../math';
import { PAVING_REPEAT } from './street';

export interface GroundDetail { id:string;x:number;y:number;variant:number;size:number }
export interface GroundRelief { size:number;data:number[] }
export function reliefAt(map:GroundRelief,x:number,y:number):number {
  const mod=(n:number)=>(n%map.size+map.size)%map.size;
  return map.data[mod(Math.floor(y/PAVING_REPEAT*map.size))*map.size+mod(Math.floor(x/PAVING_REPEAT*map.size))]!/255;
}
/** Bounded, world-anchored scatter: damp verges are richer; the traveled center stays sparse. */
export function streetDetails(minX:number,maxX:number,relief:GroundRelief):GroundDetail[]{
  const result:GroundDetail[]=[],cell=.8;
  for(let ix=Math.floor(minX/cell);ix<=Math.ceil(maxX/cell);ix++)for(let iy=-5;iy<=4;iy++){
    const x=(ix+hash(ix,iy,701)*.72)*cell,y=(iy+hash(ix,iy,702)*.72)*cell;
    if(y< -3.8||y>3.95)continue;
    const verge=Math.abs(y)>2.7,damp=noise(x*.37,y*.5,75);
    const chance=verge?.28+damp*.23:.035+damp*.045;
    if(hash(ix,iy,703)>chance)continue;
    const rubble=hash(ix,iy,704)<.25;
    if(!verge&&!rubble&&reliefAt(relief,x,y)>.46)continue;
    result.push({id:`${ix}:${iy}`,x,y,variant:rubble?6+Math.floor(hash(ix,iy,705)*2):Math.floor(hash(ix,iy,706)*6),size:.65+hash(ix,iy,707)*.55});
  }
  return result;
}
