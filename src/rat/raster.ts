import type { Pose } from './types';
import type { PixelImage } from '../render';
import { rasterMesh, type RasterStyle } from '../model/raster';
import type { IsoCamera } from '../model/camera';
import { ratModel, type Rig } from './model';

export const RAT_CAMERA={width:384,height:288,x:192,y:165,scale:66} as const satisfies IsoCamera;
/** Rat art direction only; geometry, rasterization and textures use the shared toolkit. */
export function rasterRat(p:Pose,furTexture:number[],rig:Rig=ratModel(p),lighting?:Partial<RasterStyle>):PixelImage {
  return rasterMesh(rig.mesh,RAT_CAMERA,{
    light:[-.7,-1,2.2],ambient:.52,diffuse:.52,shadeSteps:24,
    tint:[.94+p.mood*.10,.98+p.mood*.015,1.04-p.mood*.08],outline:[50,44,38,160],
    ...lighting,
  },{fur:{width:32,height:32,data:furTexture,repeatU:3,repeatV:3}});
}
