import { sceneCamera, PAVING_REPEAT, nearbyLamps, lampStrength, illumination, stoneTint, type StreetLamp } from './world/street';
import { streetDetails } from './world/dressing';
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
  const divisions=atlas.floor.width/64,cell=PAVING_REPEAT/divisions,radius=Math.ceil((width*.5+height)/scale/cell)+2;
  const baseX=Math.floor(p.x/cell),baseY=Math.floor(p.y/cell);
  const mod=(n:number,m:number)=>(n%m+m)%m;
  for(let ix=baseX-radius;ix<=baseX+radius;ix++)for(let iy=baseY-radius;iy<=baseY+radius;iy++){
    const x=ix*cell,y=iy*cell,corners:[Vec2,Vec2,Vec2,Vec2]=[project(x,y),project(x+cell,y),project(x,y+cell),project(x+cell,y+cell)];
    const bounds=quadBounds(corners);if(bounds.x>width||bounds.x+bounds.width<0||bounds.y>height||bounds.y+bounds.height<0)continue;
    const region={x:atlas.floor.x+mod(ix,divisions)*64,y:atlas.floor.y+mod(iy,divisions)*64,width:64,height:64};
    const t=(a:number,b:number):Color=>view.study?[155,167,182,255]:stoneTint(lamps,a,b,p.mood);
    quad('paving',corners,WHITE,region,[t(x,y),t(x+cell,y),t(x,y+cell),t(x+cell,y+cell)]);
  }
  const reach=(width*.5+height)/scale+5;
  // Irregular dirt deposits collect along verges; damp stains break up the scanned repeat.
  if(!view.study)for(let i=Math.floor((p.x-reach)/2);i<Math.ceil((p.x+reach)/2);i++){
    const x=i*2+hash(i,7,83),side=hash(i,8,83)<.5?-1:1;
    const y=side*(2.3+hash(i,9,83)*1.3),size=1+hash(i,10,83)*1.4;
    surface('soil',x,y,size,size*.65,stoneTint(lamps,x,y,p.mood),atlas.soil);
    if(hash(i,11,83)<.3)surface('damp',x-.6,y*.5,size*1.3,size*.42,[40,49,51,115],atlas.soil);
  }
  // Larger masonry and a taller wall establish an animal-sized point of view.
  if(!view.study)for(let ix=Math.floor((p.x-reach)/2);ix<=Math.ceil((p.x+reach)/2);ix++){
    const x=ix*2,y=-3.95;
    for(let iz=0;iz<4;iz++){
      const z=iz*1.5,region={x:atlas.wall.x+mod(ix,4)*64,y:atlas.wall.y+(3-iz)*64,width:64,height:64};
      const left=stoneTint(lamps,x,y,p.mood,true),right=stoneTint(lamps,x+2,y,p.mood,true);
      quad('wall',[project(x,y,z+1.5),project(x+2,y,z+1.5),project(x,y,z),project(x+2,y,z)],WHITE,region,[left,right,left,right]);
    }
    surface('wall-foot',x,y,2,.18,stoneTint(lamps,x,y,p.mood,true),{x:atlas.wall.x+mod(ix,4)*64,y:atlas.wall.y+230,width:64,height:12},.09);
    if(mod(ix,8)===0){
      const tint=stoneTint(lamps,x+.9,y,p.mood,true);
      quad('cellar-grille',[project(x+.05,y+.01,1.46),project(x+1.95,y+.01,1.46),
        project(x+.05,y+.01,.02),project(x+1.95,y+.01,.02)],tint,atlas.grille);
    }
  }
  // A generated, registered sprite gives the tall prop real iron, horn and timber surfaces.
  const drawLamp=(lamp:StreetLamp)=>{
    const base=project(lamp.x-.45,lamp.y+.45),flame=project(lamp.x,lamp.y,lamp.z);
    const h=scale*8.73,w=h*atlas.lantern.width/atlas.lantern.height;
    rect('streetlamp-foot-shadow',base.x-scale*.45,base.y-scale*.15,scale*.9,scale*.3,[0,0,0,105],atlas.shadow);
    const tint:Color=[178+p.mood*21,182+p.mood*15,188+p.mood*6,255];
    rect('streetlamp-post',base.x-w*.335,base.y-h*.985,w,h,tint,atlas.lantern);
    rect('streetlamp-halo',flame.x-scale*.37,flame.y-scale*.40,scale*.74,scale*.80,[255,166,54,30*lamp.power],atlas.glow);
  };
  const visibleLamps=lamps.filter(l=>Math.abs(project(l.x,l.y).x-width*.5)<width*.5+scale*2);
  const details=view.study?[]:streetDetails(p.x-reach,p.x+reach,atlas.relief);
  const drawDetail=(detail:typeof details[number])=>{
    const at=project(detail.x,detail.y),factor=scale/100*detail.size,region=atlas.plants[detail.variant]!;
    const tint=stoneTint(lamps,detail.x,detail.y,p.mood);
    rect(`verge-${detail.id}`,at.x-32*factor,at.y-50*factor,64*factor,64*factor,tint,region);
  };
  if(!view.study){
    const behind=[...details.filter(d=>d.x+d.y<=p.x+p.y).map(d=>({depth:d.x+d.y,draw:()=>drawDetail(d)})),
      ...visibleLamps.filter(l=>l.x+l.y<=p.x+p.y).map(l=>({depth:l.x+l.y,draw:()=>drawLamp(l)}))];
    for(const item of behind.sort((a,b)=>a.depth-b.depth))item.draw();
  }

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
    // Separate irregular kerbstones, with visible front faces instead of a stretched wall strip.
    for(let i=Math.floor(p.x-reach);i<=p.x+reach;i++){
      const x=i+.025,y=4.05+(hash(i,3,172)-.5)*.08,z=.10+hash(i,4,172)*.10;
      const tint=stoneTint(lamps,x,y,p.mood,true),w=.91+hash(i,5,172)*.06;
      surface('kerb-top',x,y,w,.38,tint,{x:atlas.wall.x+70+mod(i,3)*30,y:atlas.wall.y+140,width:24,height:12},z);
      quad('kerb-face',[project(x,y+.38,z),project(x+w,y+.38,z),project(x,y+.38),project(x+w,y+.38)],
        [tint[0]*.68,tint[1]*.68,tint[2]*.68,255],{x:atlas.wall.x+70+mod(i,3)*30,y:atlas.wall.y+150,width:24,height:12});
    }
    const front=[...details.filter(d=>d.x+d.y>p.x+p.y).map(d=>({depth:d.x+d.y,draw:()=>drawDetail(d)})),
      ...visibleLamps.filter(l=>l.x+l.y>p.x+p.y).map(l=>({depth:l.x+l.y,draw:()=>drawLamp(l)}))];
    for(const item of front.sort((a,b)=>a.depth-b.depth))item.draw();
  }
  if(view.rain)for(let i=0;i<65;i++){
    const x=((hash(i,1,91)*width+p.time*15) % (width+40))-20;
    const y=(hash(i,2,91)*height+p.time*(180+hash(i,3,91)*90))%(height+40)-20;
    line('rain',{x,y},{x:x-3,y:y+9},.65,[158,179,188,65*(1-p.mood*.65)]);
  }
  return {width,height,clear:color('#111c24'),commands,patches:[{...live,x:atlas.liveRat.x,y:atlas.liveRat.y},{...shadow,x:atlas.ratShadow.x,y:atlas.ratShadow.y}]};
}
