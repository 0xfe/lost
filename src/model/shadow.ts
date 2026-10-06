import type { Mesh } from './mesh';
import type { V3 } from './vector';
import type { IsoCamera } from './camera';
import { rasterMesh } from './raster';
import type { PixelImage } from '../render';

/** Project the actual posed triangles from a point light onto flat ground. */
export function rasterShadow(mesh:Mesh,light:V3,camera:IsoCamera,opacity:number):PixelImage {
  const projected:Mesh={indices:mesh.indices,vertices:mesh.vertices.map(v=>{
    const t=light[2]/Math.max(.01,light[2]-v.p[2]);
    return {...v,p:[light[0]+(v.p[0]-light[0])*t,light[1]+(v.p[1]-light[1])*t,0] as V3};
  })};
  const pixels=rasterMesh(projected,camera,{light:[0,0,1],ambient:1,diffuse:0,shadeSteps:1,tint:[0,0,0]});
  for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i])pixels.data[i]=Math.round(255*opacity);
  return pixels;
}
