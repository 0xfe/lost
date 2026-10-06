/** Small dependency-free mesh vocabulary; geometry and rasterization also run on Node. */
export type V3 = readonly [number,number,number];
export type RGB = readonly [number,number,number];
export interface Vertex { p:V3; n:V3; u:number; v:number; color:RGB; fur:boolean }
export interface Mesh { vertices:Vertex[]; indices:number[] }
export const add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a:V3,s:number):V3=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=(a:V3):V3=>mul(a,1/(Math.hypot(...a)||1));
export const rotate=(a:V3,h:number):V3=>[a[0]*Math.cos(h)-a[1]*Math.sin(h),a[0]*Math.sin(h)+a[1]*Math.cos(h),a[2]];
export type Transform=(p:V3)=>V3;
const identity:Transform=p=>p;
const gridCache=new Map<string,{points:V3[];uv:[number,number][];indices:number[]}>();
function sphere(segments:number,rings:number){
  const key=`${segments}/${rings}`;let grid=gridCache.get(key);if(grid)return grid;
  grid={points:[],uv:[],indices:[]};
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,b=j/rings*Math.PI;
    grid.points.push([Math.sin(b)*Math.cos(a),Math.sin(b)*Math.sin(a),Math.cos(b)]);grid.uv.push([i/segments,j/rings]);
  }
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
    const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
    if(j>0)grid.indices.push(a,c,b);if(j<rings-1)grid.indices.push(c,d,b);
  }
  gridCache.set(key,grid);return grid;
}
export function ellipsoid(mesh:Mesh,center:V3,radius:V3,color:RGB,fur=false,
  transform:Transform=identity,normalTransform:Transform=identity,segments=14,rings=9):void{
  const grid=sphere(segments,rings),base=mesh.vertices.length;
  for(let i=0;i<grid.points.length;i++){
    const p=grid.points[i]!,uv=grid.uv[i]!;
    mesh.vertices.push({p:transform(add(center,[p[0]*radius[0],p[1]*radius[1],p[2]*radius[2]])),
      n:normalTransform(unit([p[0]/radius[0],p[1]/radius[1],p[2]/radius[2]])),u:uv[0],v:uv[1],color,fur});
  }
  for(const i of grid.indices)mesh.indices.push(base+i);
}
export function bone(mesh:Mesh,a:V3,b:V3,r:number,color:RGB,fur=false):void{
  const axis=unit(sub(b,a)),across=unit(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0]));
  const up=cross(axis,across),center=mul(add(a,b),.5);
  const orientation=(p:V3)=>add(add(mul(across,p[0]),mul(up,p[1])),mul(axis,p[2]));
  ellipsoid(mesh,[0,0,0],[r,r,Math.hypot(...sub(b,a))*.5+r*.15],color,fur,
    p=>add(center,orientation(p)),orientation,8,5);
}
/** Two-link IK, preserving the endpoint. The pole chooses elbow/knee flexion direction. */
export function joint(a:V3,b:V3,upper:number,lower:number,pole:V3):V3{
  const axis=unit(sub(b,a)),actual=Math.hypot(...sub(b,a)),d=Math.min(upper+lower-1e-6,Math.max(Math.abs(upper-lower)+1e-6,actual));
  const along=(upper*upper-lower*lower+d*d)/(2*d),off=Math.sqrt(Math.max(0,upper*upper-along*along));
  const bend=unit(sub(pole,mul(axis,dot(pole,axis))));
  return add(a,add(mul(axis,along),mul(bend,off)));
}
export interface Section { x:number; y:number; z:number; ry:number; rz:number }
/** A continuous loft avoids the disconnected sausage silhouette of stacked ellipsoids. */
export function loft(mesh:Mesh,sections:Section[],color:RGB,transform:Transform=identity,normalTransform:Transform=identity,segments=24):void{
  const base=mesh.vertices.length;
  for(let j=0;j<sections.length;j++){
    const s=sections[j]!,prev=sections[Math.max(0,j-1)]!,next=sections[Math.min(sections.length-1,j+1)]!;
    for(let i=0;i<=segments;i++){
      const theta=i/segments*Math.PI*2,c=Math.cos(theta),n=Math.sin(theta);
      const tangent:V3=[next.x-prev.x,next.y-prev.y+(next.ry-prev.ry)*c,next.z-prev.z+(next.rz-prev.rz)*n];
      const normal=unit(cross([0,-s.ry*n,s.rz*c],tangent));
      mesh.vertices.push({p:transform([s.x,s.y+s.ry*c,s.z+s.rz*n]),n:normalTransform(normal),u:j/(sections.length-1)*2,v:i/segments,color,fur:true});
    }
  }
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<segments;i++){
    const a=base+j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;mesh.indices.push(a,b,c,c,b,d);
  }
}
