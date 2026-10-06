import { lerp, type Vec2 } from '../math';

/** Planar following chain. Caller supplies the rest direction, not the constraint solver. */
export function updateTrailingChain(points:Vec2[],root:Vec2,segmentLength:number,dt:number,
  response:number,headingAt:(index:number)=>number):void {
  points[0]=root;
  for(let i=1;i<points.length;i++){
    const parent=points[i-1]!,point=points[i]!,heading=headingAt(i);
    point.x=lerp(point.x,parent.x-Math.cos(heading)*segmentLength,dt*response);
    point.y=lerp(point.y,parent.y-Math.sin(heading)*segmentLength,dt*response);
    const dx=point.x-parent.x,dy=point.y-parent.y,length=Math.hypot(dx,dy)||1;
    point.x=parent.x+dx/length*segmentLength;point.y=parent.y+dy/length*segmentLength;
  }
}
