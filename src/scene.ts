import { hash, lerp, type Vec2 } from './math';
import { quadBounds, type QuadCorners } from './quad';
import { color, WHITE, type Color, type DrawCommand, type Frame, type Region } from './render';
import { directionRow, TAU, type Pose } from './simulation';
import type { Atlas } from './assets';

export interface View { width: number; height: number; zoom: number; rain: boolean }
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
    for (let y = -9; y < 12; y += 3) {
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
  for (let x = base - radius * 3; x <= base + radius * 3; x += 3) {
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
  for (let i = Math.floor(p.x / 4.5) - radius; i <= Math.floor(p.x / 4.5) + radius; i++) {
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

  // Rat contact shadow: separate from the directional body and tail.
  rect('rat-shadow',origin.x-55*zoom,origin.y-18*zoom,110*zoom,36*zoom,[0,0,0,160],atlas.shadow);
  const drawTail = () => {
    const root=project(p.tail[0]!.x,p.tail[0]!.y,.04), landmark=atlas.roots[row]!;
    const offset={x:rx+landmark.x*ratScale-root.x,y:ry+landmark.y*ratScale-root.y};
    for (let i=p.tail.length-1;i>0;i--) {
      const a=project(p.tail[i]!.x,p.tail[i]!.y,.025), b=project(p.tail[i-1]!.x,p.tail[i-1]!.y,.04);
      a.x+=offset.x; a.y+=offset.y; b.x+=offset.x; b.y+=offset.y;
      const thickness=(.8+(1-i/p.tail.length)*4)*zoom;
      line('tail-outline',a,b,thickness+1.4*zoom,color('#302a2b'));
      line('tail',a,b,thickness,[138,105,101,255]);
      line('tail-ridge',{x:a.x,y:a.y-.7*zoom},{x:b.x,y:b.y-.7*zoom},Math.max(.7,thickness*.28),[183,140,127,210]);
    }
  };
  const row=directionRow(p.heading), moving=p.action==='walk'||p.action==='scurry';
  const frame=moving?Math.floor(p.stride*4)%4:0;
  const region=atlas.rat[row]![frame]!, anchor=atlas.anchors[row]!;
  const breath=Math.sin(p.time*3.6)*.35;
  const sniff=p.action==='sniff'?Math.sin(p.time*14)*.65:0;
  const groom=p.action==='groom'?Math.sin(p.time*10)*1.1:0;
  const listen=p.action==='listen'?Math.sin(p.time*2.2)*1.8:0;
  const bob=moving?Math.sin(p.stride*TAU*2)*.9:0;
  const ratScale=zoom*.73;
  const rx=origin.x-anchor.x*ratScale, ry=origin.y-anchor.y*ratScale-bob*zoom;
  const rw=region.width*ratScale, rh=region.height*ratScale;
  const tailInFront=row>=5&&row<=7;
  if(!tailInFront)drawTail();
  // Registered sprite mesh: head movement fades through shoulders; feet stay grounded.
  const deform=(u:number,v:number):Vec2=>{
    const dx=u-.5,dy=v-.5,angle=row*Math.PI/4;
    const head=Math.max(0,Math.min(1,(dx*Math.cos(angle)+dy*Math.sin(angle)) * 3+.3));
    const lift=(sniff+groom*1.6+listen*.4)*head;
    return {x:rx+u*rw+head*listen*zoom,y:ry+v*rh+(lift+breath*(1-v))*zoom};
  };
  for(let v=0;v<8;v++)for(let u=0;u<8;u++){
    const cell={x:region.x+u*region.width/8,y:region.y+v*region.height/8,width:region.width/8,height:region.height/8};
    quad('rat-body',[deform(u/8,v/8),deform((u+1)/8,v/8),deform(u/8,(v+1)/8),deform((u+1)/8,(v+1)/8)],
      [lerp(219,245,p.mood),lerp(218,232,p.mood),lerp(221,209,p.mood),255],cell);
  }
  if(tailInFront)drawTail();
  // Fine whisker sweeps have independent timing from the stride.
  const nosePoint=atlas.noses[row]!;
  const nose=deform(nosePoint.x/region.width,nosePoint.y/region.height);
  if(row<5)for(const side of [-1,1])for(let j=0;j<3;j++){
    const a=p.heading+side*(.85+j*.26+Math.sin(p.time*(p.action==='sniff'?18:7)+side*.5)*.08);
    const end={x:nose.x+(Math.cos(a)-Math.sin(a))*.16*scale,y:nose.y+(Math.cos(a)+Math.sin(a))*.08*scale};
    line('whisker',nose,end,.65*zoom,[181,174,155,110]);
  }
  if(p.action==='groom'&&row<5){
    for(const side of [-1,1])line('groom-paw',
      {x:nose.x+side*8*zoom,y:nose.y+8*zoom},
      {x:nose.x+side*3*zoom,y:nose.y+(2+groom*2)*zoom},2.5*zoom,[174,130,119,240]);
  }

  // A low foreground gutter gives the street a frame without hiding the character.
  for(let x=base-radius*3;x<=base+radius*3;x+=3){
    surface('gutter',x,3.15,3,.23,[58,67,73,255],atlas.wall,.09);
    line('gutter-edge',project(x,3.15,.09),project(x+3,3.15,.09),2*zoom,[128,135,137,130]);
  }
  if(view.rain)for(let i=0;i<65;i++){
    const x=((hash(i,1,91)*width+p.time*15) % (width+40))-20;
    const y=(hash(i,2,91)*height+p.time*(180+hash(i,3,91)*90))%(height+40)-20;
    line('rain',{x,y},{x:x-3,y:y+9},.65,[158,179,188,65*(1-p.mood*.65)]);
  }
  return {width,height,clear:color('#111c24'),commands};
}
