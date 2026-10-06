import type { PixelImage } from '../render';
import type { Mesh } from './mesh';
import { dot, unit, type V3 } from './vector';
import { projectIso, type IsoCamera } from './camera';
import { sampleScalar, type RGB, type TextureSet } from './material';

export interface RasterStyle {
  light: V3;
  ambient: number;
  diffuse: number;
  shadeSteps: number;
  tint: RGB;
  outline?: readonly [number,number,number,number];
}
/** Opaque triangles, orthographic z-buffer and optional one-pixel alpha outline. */
export function rasterMesh(mesh:Mesh,camera:IsoCamera,style:RasterStyle,textures:TextureSet={}):PixelImage {
  const {width,height}=camera,light=unit(style.light);
  const data=new Uint8Array(width*height*4),depth=new Float32Array(width*height).fill(-Infinity);
  const vertices=mesh.vertices.map(v=>{
    const diffuse=Math.max(0,dot(v.n,light));
    return {...projectIso(v.p,camera),shade:style.ambient+diffuse*style.diffuse,
      u:v.u,v:v.v,material:v.material};
  });
  for(let tri=0;tri<mesh.indices.length;tri+=3){
    const a=vertices[mesh.indices[tri]!]!,b=vertices[mesh.indices[tri+1]!]!,c=vertices[mesh.indices[tri+2]!]!;
    const area=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(area)<1e-5)continue;
    const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
    const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    const dax=(b.y-c.y)/area,day=(c.x-b.x)/area,dbx=(c.y-a.y)/area,dby=(a.x-c.x)/area;
    for(let y=minY;y<=maxY;y++){
      let wa=dax*(minX+.5-c.x)+day*(y+.5-c.y),wb=dbx*(minX+.5-c.x)+dby*(y+.5-c.y);
      for(let x=minX;x<=maxX;x++,wa+=dax,wb+=dbx){
        const wc=1-wa-wb;if(wa<0||wb<0||wc<0)continue;
        const z=wa*a.z+wb*b.z+wc*c.z,index=y*width+x;if(z<=depth[index]!)continue;
        depth[index]=z;
        let shade=wa*a.shade+wb*b.shade+wc*c.shade;
        // Texture follows the posed surface instead of screen coordinates.
        const texture=a.material.texture ? textures[a.material.texture] : undefined;
        if(texture){
          const u=wa*a.u+wb*b.u+wc*c.u,v=wa*a.v+wb*b.v+wc*c.v;
          shade*=sampleScalar(texture,u,v);
        }
        shade=Math.round(shade*style.shadeSteps)/style.shadeSteps;
        data[index*4]=Math.min(255,a.material.color[0]*shade*style.tint[0]);
        data[index*4+1]=Math.min(255,a.material.color[1]*shade*style.tint[1]);
        data[index*4+2]=Math.min(255,a.material.color[2]*shade*style.tint[2]);data[index*4+3]=255;
      }
    }
  }
  // An understated one-pixel silhouette. No blur, temporal noise or image crossfades.
  if(!style.outline)return {width,height,data};
  const outline=data.slice();
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;if(data[i*4+3])continue;
    if(data[(i-1)*4+3]||data[(i+1)*4+3]||data[(i-width)*4+3]||data[(i+width)*4+3])outline.set(style.outline,i*4);
  }
  return {width,height,data:outline};
}
