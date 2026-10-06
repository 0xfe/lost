import type { Pose } from '../simulation';
import type { PixelImage } from '../render';
import { ratModel, type Rig } from './model';
import { dot, unit } from './mesh';

export const RAT_CAMERA={width:384,height:288,x:192,y:165,scale:66} as const;
const light=unit([-.7,-1,2.2]);
/** Live software z-buffer, bounded to one small sprite. The street remains GPU-rendered. */
export function rasterRat(p:Pose,furTexture:number[],rig:Rig=ratModel(p)):PixelImage{
  const {width,height,x:cx,y:cy,scale}=RAT_CAMERA;
  const data=new Uint8Array(width*height*4),depth=new Float32Array(width*height).fill(-Infinity);
  const mesh=rig.mesh;
  const vertices=mesh.vertices.map(v=>{
    const diffuse=Math.max(0,dot(v.n,light));
    return {x:cx+(v.p[0]-v.p[1])*scale,y:cy+((v.p[0]+v.p[1])*.5-v.p[2])*scale,
      z:v.p[0]+v.p[1]+v.p[2],shade:.52+diffuse*.52,u:v.u,v:v.v,color:v.color,fur:v.fur};
  });
  const warm=p.mood;
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
        // Texture is attached to model coordinates, so fur never crawls in screen space.
        if(a.fur){
          const u=wa*a.u+wb*b.u+wc*c.u,v=wa*a.v+wb*b.v+wc*c.v;
          const tx=((Math.floor(u*96)%32)+32)%32,ty=((Math.floor(v*96)%32)+32)%32;
          shade*=furTexture[ty*32+tx]??1;
        }
        shade=Math.round(shade*24)/24;
        data[index*4]=Math.min(255,a.color[0]*shade*(.94+warm*.10));
        data[index*4+1]=Math.min(255,a.color[1]*shade*(.98+warm*.015));
        data[index*4+2]=Math.min(255,a.color[2]*shade*(1.04-warm*.08));data[index*4+3]=255;
      }
    }
  }
  // An understated one-pixel silhouette. No blur, temporal noise or image crossfades.
  const outline=data.slice();
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;if(data[i*4+3])continue;
    if(data[(i-1)*4+3]||data[(i+1)*4+3]||data[(i-width)*4+3]||data[(i+width)*4+3])outline.set([50,44,38,160],i*4);
  }
  return {width,height,data:outline};
}
