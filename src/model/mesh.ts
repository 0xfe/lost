import { add, sub, mul, cross, unit, identity, type V3, type Transform } from './vector';
import type { Material } from './material';

export interface Vertex { p:V3; n:V3; u:number; v:number; material:Material }
export interface Mesh { vertices:Vertex[]; indices:number[] }
export const createMesh = (): Mesh => ({ vertices: [], indices: [] });

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
/** Positive radii; position and normal transforms are separate so translation never affects light. */
export function ellipsoid(mesh:Mesh,center:V3,radius:V3,material:Material,
  transform:Transform=identity,normalTransform:Transform=identity,segments=14,rings=9):void{
  const grid=sphere(segments,rings),base=mesh.vertices.length;
  for(let i=0;i<grid.points.length;i++){
    const p=grid.points[i]!,uv=grid.uv[i]!;
    mesh.vertices.push({p:transform(add(center,[p[0]*radius[0],p[1]*radius[1],p[2]*radius[2]])),
      n:normalTransform(unit([p[0]/radius[0],p[1]/radius[1],p[2]/radius[2]])),u:uv[0],v:uv[1],material});
  }
  for(const i of grid.indices)mesh.indices.push(base+i);
}
/** Rounded segment between distinct endpoints; also useful for stems and appendages. */
export function bone(mesh:Mesh,a:V3,b:V3,r:number,material:Material):void{
  const axis=unit(sub(b,a)),across=unit(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0]));
  const up=cross(axis,across),center=mul(add(a,b),.5);
  const orientation=(p:V3)=>add(add(mul(across,p[0]),mul(up,p[1])),mul(axis,p[2]));
  ellipsoid(mesh,[0,0,0],[r,r,Math.hypot(...sub(b,a))*.5+r*.15],material,
    p=>add(center,orientation(p)),orientation,8,5);
}
export interface Section { x:number; y:number; z:number; ry:number; rz:number }
/** A continuous loft avoids the disconnected sausage silhouette of stacked ellipsoids. */
export function loft(mesh:Mesh,sections:Section[],material:Material,transform:Transform=identity,normalTransform:Transform=identity,segments=24):void{
  const base=mesh.vertices.length;
  for(let j=0;j<sections.length;j++){
    const s=sections[j]!,prev=sections[Math.max(0,j-1)]!,next=sections[Math.min(sections.length-1,j+1)]!;
    for(let i=0;i<=segments;i++){
      const theta=i/segments*Math.PI*2,c=Math.cos(theta),n=Math.sin(theta);
      const tangent:V3=[next.x-prev.x,next.y-prev.y+(next.ry-prev.ry)*c,next.z-prev.z+(next.rz-prev.rz)*n];
      const normal=unit(cross([0,-s.ry*n,s.rz*c],tangent));
      mesh.vertices.push({p:transform([s.x,s.y+s.ry*c,s.z+s.rz*n]),n:normalTransform(normal),u:j/(sections.length-1)*2,v:i/segments,material});
    }
  }
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<segments;i++){
    const a=base+j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;mesh.indices.push(a,b,c,c,b,d);
  }
}
