import sharp from 'sharp';
import { vergeModel } from '../src/environment/plants.ts';
import { rasterMesh } from '../src/model/raster.ts';
import { hash, noise } from '../src/math.ts';

/** Offline preparation only: source artwork, scan maps and small authored 3D plants. */
export async function streetAssets(put){
  const load=async name=>sharp(`assets/source/polyhaven/cobbles-${name}.jpg`).resize(512,512).removeAlpha().raw().toBuffer();
  const [diffuse,normal,ao]=await Promise.all(['diffuse','normal','ao'].map(load));
  const pixels=Buffer.alloc(512*512*4);
  for(let i=0;i<512*512;i++){
    const n=[normal[i*3]/127.5-1,normal[i*3+1]/127.5-1,normal[i*3+2]/127.5-1];
    const shade=(.62+.44*Math.max(0,-n[0]*.3-n[1]*.4+n[2]*.866))*(.62+.38*ao[i*3]/255);
    const mean=(diffuse[i*3]+diffuse[i*3+1]+diffuse[i*3+2])/3;
    for(let c=0;c<3;c++)pixels[i*4+c]=Math.min(255,Math.round((diffuse[i*3+c]*.8+mean*.2)*shade));
    pixels[i*4+3]=255;
  }
  const png=(data,width,height)=>sharp(data,{raw:{width,height,channels:4}}).png().toBuffer();
  const floor=await put(await png(pixels,512,512),2,900,512,512);
  // A compact copy of scanned relief guides vegetation into lower, dirt-filled joints.
  const reliefPixels=await sharp('assets/source/polyhaven/cobbles-height.jpg').resize(64,64).greyscale().raw().toBuffer();
  const relief={size:64,data:[...reliefPixels]};
  const cutout=async(path,x,y,w,h)=>{
    const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=0,bottom=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    // Retain transparent edge padding and suppress the generator's low-alpha matte residue.
    for(let i=3;i<data.length;i+=4)if(data[i]<16)data[i]=0;
    const image=await sharp(data,{raw:info}).extract({left:left-2,top:top-2,width:right-left+5,height:bottom-top+5}).resize(w,h,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    return put(image,x,y,w,h);
  };
  const lantern=await cutout('assets/source/street-lantern-original.png',520,900,144,632);
  const grille=await cutout('assets/source/cellar-grille.png',680,900,384,272);
  const plants=[],grain={width:32,height:32,repeatU:2,repeatV:2,data:Array.from({length:1024},(_,i)=>.65+diffuse[i*3]/220)};
  for(let i=0;i<8;i++){
    const sprite=rasterMesh(vergeModel(i),{width:64,height:64,x:32,y:50,scale:100},
      {light:[-.7,-1,2.2],ambient:.6,diffuse:.5,shadeSteps:24,tint:[1,1,1]},{rubble:grain});
    plants.push(await put(await png(sprite.data,64,64),680+i*66,1180,64,64));
  }
  const dirt=Buffer.alloc(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const dx=(x-64)/64,dy=(y-64)/64,edge=1-Math.hypot(dx,dy);
    const alpha=Math.max(0,Math.min(1,(edge+(noise(x*.12,y*.12,71)-.5)*.6)*2));
    const grain=.75+hash(x,y,51)*.5,i=(y*128+x)*4;
    dirt.set([80*grain,69*grain,52*grain,alpha*185],i);
  }
  const soil=await put(await png(dirt,128,128),1100,900,128,128);
  return {floor,relief,lantern,grille,plants,soil};
}
