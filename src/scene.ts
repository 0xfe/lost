import { sceneCamera, PAVING_REPEAT, nearbyLamps, lampStrength, illumination, stoneTint, type StreetLamp } from './world/street';
import { rasterShadow } from './model/shadow';
import { hash, type Vec2 } from './math';
import { quadBounds, type QuadCorners } from './quad';
import { color, WHITE, type Color, type DrawCommand, type Frame, type Region } from './render';
import type { Pose } from './simulation';
import { ratModel } from './rat/model';
import { rasterRat, RAT_CAMERA } from './rat/raster';
import type { Atlas } from './assets';

export interface View { width: number; height: number; zoom: number; rain: boolean; debug?:boolean; study?:boolean }
/** World surfaces and pixel sprites share a single painter-ordered atlas batch. */
export function compose(p: Pose, atlas: Atlas, view: View): Frame {
  const { width, height, zoom } = view, commands: DrawCommand[] = [];
  const {scale,origin}=view.study?{scale:86*zoom,origin:{x:width*.5,y:height*.53}}:sceneCamera(width,height,zoom);
  const pixelScale=scale/86,lamps=nearbyLamps(p.x,p.time,3);
  const project = (x: number, y: number, z = 0): Vec2 => ({
    x: origin.x + ((x - p.x) - (y - p.y)) * scale,
    y: origin.y + ((x - p.x) + (y - p.y)) * scale * .5 - z * scale,
  });
  let serial = 0;
  const rect = (id: string, x: number, y: number, w: number, h: number, tint: Color, region?: Region) => {
    commands.push({ id: `${id}-${serial++}`, layer: 0, depth: 0, x, y, width: w, height: h, color: tint, region });
  };
  const quad = (id: string, corners: QuadCorners, tint: Color, region?: Region,cornerColors?:readonly [Color,Color,Color,Color]) => {
    const bounds = quadBounds(corners);
    if (bounds.x > width || bounds.x + bounds.width < 0 || bounds.y > height || bounds.y + bounds.height < 0) return;
    commands.push({ id: `${id}-${serial++}`, layer: 0, depth: 0, ...bounds, corners, color: tint, region,cornerColors });
  };
  const line = (id: string, a: Vec2, b: Vec2, thickness: number, tint: Color) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const x = -(b.y - a.y) / d * thickness / 2, y = (b.x - a.x) / d * thickness / 2;
    quad(id, [{ x: a.x + x, y: a.y + y }, { x: b.x + x, y: b.y + y },
      { x: a.x - x, y: a.y - y }, { x: b.x - x, y: b.y - y }], tint);
  };
  const surface = (id: string, x: number, y: number, w: number, h: number, tint: Color, region?: Region, z = 0) =>
    quad(id, [project(x,y,z),project(x+w,y,z),project(x,y+h,z),project(x+w,y+h,z)], tint, region);

  // Texture size and lighting tessellation are independent: stones stay large while light is smooth.
  const cell=PAVING_REPEAT/4,radius=Math.ceil((width*.5+height)/scale/cell)+2;
  const baseX=Math.floor(p.x/cell),baseY=Math.floor(p.y/cell);
  const mod=(n:number,m:number)=>(n%m+m)%m;
  for(let ix=baseX-radius;ix<=baseX+radius;ix++)for(let iy=baseY-radius;iy<=baseY+radius;iy++){
    const x=ix*cell,y=iy*cell,corners:[Vec2,Vec2,Vec2,Vec2]=[project(x,y),project(x+cell,y),project(x,y+cell),project(x+cell,y+cell)];
    const bounds=quadBounds(corners);if(bounds.x>width||bounds.x+bounds.width<0||bounds.y>height||bounds.y+bounds.height<0)continue;
    const region={x:atlas.floor.x+mod(ix,4)*64,y:atlas.floor.y+mod(iy,4)*64,width:64,height:64};
    const t=(a:number,b:number):Color=>view.study?[155,167,182,255]:stoneTint(lamps,a,b,p.mood);
    quad('paving',corners,WHITE,region,[t(x,y),t(x+cell,y),t(x,y+cell),t(x+cell,y+cell)]);
  }
  const reach=(width*.5+height)/scale+5;
  for(let i=Math.floor(p.x-reach);i<Math.ceil(p.x+reach);i++)if(hash(i,7,83)<.38){
    const y=(hash(i,8,83)-.5)*5,light=illumination(lamps,i,y);
    for(let j=0;j<3;j++)surface('water',i+j*.12,y+j*.17,.7-j*.12,.045,[140+light*60,160+light*22,177-light*35,12+light*30]);
  }
  // Larger masonry and a taller wall establish an animal-sized point of view.
  if(!view.study)for(let ix=Math.floor((p.x-reach)/2);ix<=Math.ceil((p.x+reach)/2);ix++){
    const x=ix*2,y=-3.95;
    for(let iz=0;iz<4;iz++){
      const z=iz*1.5,region={x:atlas.wall.x+mod(ix,4)*64,y:atlas.wall.y+(3-iz)*64,width:64,height:64};
      const left=stoneTint(lamps,x,y,p.mood,true),right=stoneTint(lamps,x+2,y,p.mood,true);
      quad('wall',[project(x,y,z+1.5),project(x+2,y,z+1.5),project(x,y,z),project(x+2,y,z)],WHITE,region,[left,right,left,right]);
    }
    surface('wall-foot',x,y,2,.26,stoneTint(lamps,x,y,p.mood,true),atlas.wall,.16);
    if(mod(ix,8)===0){
      quad('drain',[project(x+.45,y,.72),project(x+1.5,y,.72),project(x+.45,y,.04),project(x+1.5,y,.04)],color('#080e13'));
      for(let j=0;j<5;j++)line('iron',project(x+.53+j*.21,y,.68),project(x+.53+j*.21,y,.05),2*pixelScale,color('#343d40'));
    }
  }
  const drawLamp=(lamp:StreetLamp)=>{
    const {x,y}=lamp,at=project(x,y),top=project(x,y,7.2),flame=project(x,y,7.75);
    const iron:Color=[32,35,34,255],litIron:Color=[94,88,69,255];
    // Stone plinth, upright iron shaft and enclosed candle lantern. All dimensions are world units.
    surface('streetlamp-plinth',x-.23,y-.23,.46,.46,stoneTint(lamps,x,y,p.mood,true),atlas.wall,.13);
    line('streetlamp-post',project(x,y,.13),top,Math.max(2,scale*.065),iron);
    line('streetlamp-highlight',project(x+.027,y,.2),project(x+.027,y,7.2),Math.max(.7,scale*.015),litIron);
    for(const z of [.28,1.2,6.9])line('streetlamp-collar',project(x-.07,y,z),project(x+.07,y,z),Math.max(2,scale*.04),iron);
    rect('streetlamp-halo',flame.x-scale*.65,flame.y-scale*.65,scale*1.3,scale*1.3,[255,174,69,75*lamp.power],atlas.glow);
    const corners=[[-.3,-.24],[.3,-.24],[-.3,.24],[.3,.24]] as const;
    const point=(index:number,z:number)=>project(x+corners[index]![0],y+corners[index]![1],z);
    quad('streetlamp-glass',[point(2,8.2),point(3,8.2),point(2,7.25),point(3,7.25)],[211,139,57,255]);
    quad('streetlamp-glass',[point(1,8.2),point(3,8.2),point(1,7.25),point(3,7.25)],[245,179,82,255]);
    line('streetlamp-flame',project(x,y,7.48),project(x,y,7.92+lamp.power*.04),scale*.09,[255,237,172,255]);
    for(let i=0;i<4;i++)line('streetlamp-frame',point(i,7.22),point(i,8.2),Math.max(1,scale*.04),iron);
    for(const z of [7.22,8.2])for(const [a,b] of [[0,1],[1,3],[3,2],[2,0]])line('streetlamp-rim',point(a!,z),point(b!,z),Math.max(1,scale*.05),iron);
    const peak=project(x,y,8.58);
    quad('streetlamp-roof',[point(2,8.22),point(3,8.22),peak,peak],[53,53,45,255]);
    quad('streetlamp-roof',[point(1,8.22),point(3,8.22),peak,peak],[71,66,49,255]);
    line('streetlamp-finial',peak,project(x,y,8.73),Math.max(1,scale*.03),iron);
    rect('streetlamp-foot-shadow',at.x-scale*.3,at.y-scale*.12,scale*.6,scale*.24,[0,0,0,95],atlas.shadow);
  };
  const visibleLamps=lamps.filter(l=>Math.abs(project(l.x,l.y).x-width*.5)<width*.5+scale);
  if(!view.study)for(const lamp of visibleLamps.filter(l=>l.x+l.y<=p.x+p.y))drawLamp(lamp);

  const rig=ratModel(p);
  const light=illumination(lamps,p.x,p.y);
  const live=rasterRat(p,atlas.fur,rig,view.study?undefined:{
    light:[-.7,-1,2.2],ambient:.24+p.mood*.07,diffuse:.16,
    points:lamps.map(l=>({position:[l.x-p.x,l.y-p.y,l.z] as const,power:l.power*1.7,radius:l.radius})),
    tint:[.86+light*.22+p.mood*.1,.93+light*.05,1.11-light*.20],outline:[18,23,29,125],
  });
  const shadowCamera={...RAT_CAMERA,width:352,x:176};
  const dominant=lamps.reduce((a,b)=>lampStrength(a,p.x,p.y)>lampStrength(b,p.x,p.y)?a:b);
  const shadow=rasterShadow(rig.mesh,[dominant.x-p.x,dominant.y-p.y,dominant.z],shadowCamera,Math.min(.48,light*.65));
  // The same projection/scale is used for street points, locked feet, and model vertices.
  const spriteScale=scale/RAT_CAMERA.scale;
  rect('rat-shadow',origin.x-scale*.72,origin.y-scale*.23,scale*1.44,scale*.46,[0,0,0,65],atlas.shadow);
  if(!view.study)rect('rat-cast-shadow',origin.x-shadowCamera.x*spriteScale,origin.y-shadowCamera.y*spriteScale,shadow.width*spriteScale,shadow.height*spriteScale,WHITE,atlas.ratShadow);
  for(const foot of p.feet){
    const at=project(foot.x,foot.y);
    rect('paw-shadow',at.x-4*pixelScale,at.y-1.6*pixelScale,8*pixelScale,3.2*pixelScale,[0,0,0,foot.contact?140:35],atlas.shadow);
  }
  rect('rat-body',origin.x-RAT_CAMERA.x*spriteScale,origin.y-RAT_CAMERA.y*spriteScale,
    live.width*spriteScale,live.height*spriteScale,WHITE,atlas.liveRat);
  if(view.debug){
    for(let i=0;i<4;i++){
      const foot=p.feet[i]!,at=project(foot.x,foot.y),raised=project(foot.x,foot.y,foot.z);
      const tint:Color=foot.contact?[120,230,160,255]:[244,183,85,255];
      line('contact-x',{x:at.x-4,y:at.y},{x:at.x+4,y:at.y},1.5,tint);
      line('contact-y',{x:at.x,y:at.y-3},{x:at.x,y:at.y+3},1.5,tint);
      line('paw-height',at,raised,1,tint);
      const chain=rig.joints[i]!;
      const atJoint=(v:readonly number[])=>project(p.x+v[0]!,p.y+v[1]!,v[2]!);
      line('rig-upper',atJoint(chain.hip),atJoint(chain.knee),1,[137,196,223,170]);
      line('rig-lower',atJoint(chain.knee),atJoint(chain.ankle),1,[137,196,223,170]);
    }
  }

  if(!view.study){
    for(let x=Math.floor((p.x-reach)/6)*6;x<=p.x+reach;x+=6){
      surface('gutter',x,4.1,6,.3,stoneTint(lamps,x,4.1,p.mood,true),atlas.wall,.12);
    }
    for(const lamp of visibleLamps.filter(l=>l.x+l.y>p.x+p.y).sort((a,b)=>a.x+a.y-b.x-b.y))drawLamp(lamp);
  }
  if(view.rain)for(let i=0;i<65;i++){
    const x=((hash(i,1,91)*width+p.time*15) % (width+40))-20;
    const y=(hash(i,2,91)*height+p.time*(180+hash(i,3,91)*90))%(height+40)-20;
    line('rain',{x,y},{x:x-3,y:y+9},.65,[158,179,188,65*(1-p.mood*.65)]);
  }
  return {width,height,clear:color('#111c24'),commands,patches:[{...live,x:atlas.liveRat.x,y:atlas.liveRat.y},{...shadow,x:atlas.ratShadow.x,y:atlas.ratShadow.y}]};
}
