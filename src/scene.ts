import { hash, lerp, type Vec2 } from './math';
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
  const scale = 86 * zoom;
  const origin = { x: width * .5, y: height * .53 };
  const project = (x: number, y: number, z = 0): Vec2 => ({
    x: origin.x + ((x - p.x) - (y - p.y)) * scale,
    y: origin.y + ((x - p.x) + (y - p.y)) * scale * .5 - z * scale,
  });
  let serial = 0;
  const rect = (id: string, x: number, y: number, w: number, h: number, tint: Color, region?: Region) => {
    commands.push({ id: `${id}-${serial++}`, layer: 0, depth: 0, x, y, width: w, height: h, color: tint, region });
  };
  const quad = (id: string, corners: QuadCorners, tint: Color, region?: Region) => {
    const bounds = quadBounds(corners);
    if (bounds.x > width || bounds.x + bounds.width < 0 || bounds.y > height || bounds.y + bounds.height < 0) return;
    commands.push({ id: `${id}-${serial++}`, layer: 0, depth: 0, ...bounds, corners, color: tint, region });
  };
  const line = (id: string, a: Vec2, b: Vec2, thickness: number, tint: Color) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const x = -(b.y - a.y) / d * thickness / 2, y = (b.x - a.x) / d * thickness / 2;
    quad(id, [{ x: a.x + x, y: a.y + y }, { x: b.x + x, y: b.y + y },
      { x: a.x - x, y: a.y - y }, { x: b.x - x, y: b.y - y }], tint);
  };
  const surface = (id: string, x: number, y: number, w: number, h: number, tint: Color, region?: Region, z = 0) =>
    quad(id, [project(x,y,z),project(x+w,y,z),project(x,y+h,z),project(x+w,y+h,z)], tint, region);

  // A bounded visible neighborhood: no growing world cache or per-tile textures.
  const radius = Math.ceil((width + height * 2) / scale / 3) + 2;
  const base = Math.floor(p.x / 3) * 3;
  for (let x = base - radius * 3; x <= base + radius * 3; x += 3) {
    const baseY=Math.floor(p.y/3)*3;
    for (let y = baseY-9; y < baseY+12; y += 3) {
      surface('paving',x,y,3,3,[lerp(145,186,p.mood),lerp(159,177,p.mood),lerp(181,160,p.mood),255],atlas.floor);
    }
  }
  // Small puddles remain anchored to the world, not to the moving viewport.
  for (let i = Math.floor(p.x) - radius * 3; i < Math.floor(p.x) + radius * 3; i++) {
    if (hash(i, 7, 83) < .45) {
      const y = (hash(i, 8, 83) - .5) * 4;
      for (let j = 0; j < 4; j++) surface('water',i+j*.09,y+j*.13,.75-j*.12,.05,[117,143,155,30]);
    }
  }
  // Lower portions of the castle wall; cropped by the close camera.
  if(!view.study)for (let x = base - radius * 3; x <= base + radius * 3; x += 3) {
    const y = -2.85;
    quad('wall', [project(x,y,3.2),project(x+3,y,3.2),project(x,y),project(x+3,y)],
      [lerp(118,160,p.mood),lerp(130,148,p.mood),lerp(151,130,p.mood),255],atlas.wall);
    surface('wall-foot',x,y,3,.17,[76,81,83,255],atlas.wall,.12);
    // Projected stone string courses and iron drain grilles break the repetition.
    line('course',project(x,y,1.28),project(x+3,y,1.28),3*zoom,[48,55,62,170]);
    if (Math.round(x) % 6 === 0) {
      quad('drain', [project(x+.9,y,.42),project(x+1.5,y,.42),project(x+.9,y,.02),project(x+1.5,y,.02)],color('#10191d'));
      for(let j=0;j<5;j++) line('iron',project(x+.96+j*.11,y,.39),project(x+.96+j*.11,y,.05),2*zoom,color('#3c494b'));
    }
  }
  // Candle-lit wall sconces, luminous pools, and reflected amber in wet setts.
  if(!view.study)for (let i = Math.floor(p.x / 4.5) - radius; i <= Math.floor(p.x / 4.5) + radius; i++) {
    const x = i * 4.5 + 1.2, y = -2.68, flame = project(x,y,1.15), ground = project(x,y+.65);
    const flicker = .94 + Math.sin(p.time * 9 + i * 3) * .035 + Math.sin(p.time * 17+i) * .02;
    rect('lamp-pool',ground.x-scale*1.65,ground.y-scale*.72,scale*3.3,scale*1.44,[255,170,67,80*flicker],atlas.glow);
    rect('sconce-halo',flame.x-scale*.8,flame.y-scale*.8,scale*1.6,scale*1.6,[255,152,55,64*flicker],atlas.glow);
    line('bracket',project(x,y,1.03),project(x,y+.16,.82),5*zoom,color('#181c1b'));
    const light = project(x,y+.16,1.17);
    rect('lamp-case',light.x-7*zoom,light.y-5*zoom,14*zoom,25*zoom,color('#191e1c'));
    rect('lamp-glass',light.x-4*zoom,light.y-2*zoom,8*zoom,15*zoom,[245,157,62,255]);
    rect('candle',light.x-1*zoom,light.y+(4-flicker*2)*zoom,3*zoom,9*zoom,[255,233,166,255]);
    line('lamp-crossbar',{x:light.x-6*zoom,y:light.y+9*zoom},{x:light.x+6*zoom,y:light.y+9*zoom},2*zoom,color('#59482b'));
    for (let j=0;j<5;j++) {
      const r=project(x+.12*j,y+.4+j*.16);
      rect('reflection',r.x-10*zoom,r.y,20*zoom,1*zoom,[235,171,85,26*flicker]);
    }
  }

  const rig=ratModel(p);
  const live=rasterRat(p,atlas.fur,rig);
  // The same projection/scale is used for street points, locked feet, and model vertices.
  const spriteScale=scale/RAT_CAMERA.scale;
  rect('rat-shadow',origin.x-65*zoom,origin.y-24*zoom,130*zoom,48*zoom,[0,0,0,125],atlas.shadow);
  for(const foot of p.feet){
    const at=project(foot.x,foot.y);
    rect('paw-shadow',at.x-5*zoom,at.y-2*zoom,10*zoom,4*zoom,[0,0,0,foot.contact?140:35],atlas.shadow);
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

  // A low foreground gutter gives the street a frame without hiding the character.
  if(!view.study)for(let x=base-radius*3;x<=base+radius*3;x+=3){
    surface('gutter',x,3.15,3,.23,[58,67,73,255],atlas.wall,.09);
    line('gutter-edge',project(x,3.15,.09),project(x+3,3.15,.09),2*zoom,[128,135,137,130]);
  }
  if(view.rain)for(let i=0;i<65;i++){
    const x=((hash(i,1,91)*width+p.time*15) % (width+40))-20;
    const y=(hash(i,2,91)*height+p.time*(180+hash(i,3,91)*90))%(height+40)-20;
    line('rain',{x,y},{x:x-3,y:y+9},.65,[158,179,188,65*(1-p.mood*.65)]);
  }
  return {width,height,clear:color('#111c24'),commands,patches:[{...live,x:atlas.liveRat.x,y:atlas.liveRat.y}]};
}
