import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// All image processing is offline. Keep source cells registered, never trim poses independently.
await mkdir('public/assets', { recursive: true });
const width=1536, height=896, data=Buffer.alloc(width*height*4);
if(data.length>16*1048576)throw Error('Atlas exceeds the 16 MiB decoded budget.');
data.set([255,255,255,255],0); // untextured GL primitives sample this white pixel
const put=async(input,x,y,w,h)=>{
  const pixels=await sharp(input).resize(w,h,{kernel:'nearest',fit:'fill'}).ensureAlpha().raw().toBuffer();
  for(let j=0;j<h;j++)pixels.copy(data,((y+j)*width+x)*4,j*w*4,(j+1)*w*4);
  return {x,y,width:w,height:h};
};
const rat=[], source=await sharp('assets/source/rat.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(source.info.width!==1024||source.info.height!==1536)throw Error('Rat source must be reviewed 1024 × 1536, four columns/eight rows.');
let transparent=0;
for(let i=3;i<source.data.length;i+=4)if(source.data[i]<10)transparent++;
if(transparent<source.info.width*source.info.height*.45)throw Error('Rat sheet must contain real transparency.');
// The generated sheet's rows have unequal gutters. These reviewed bands avoid clipping
// the back views or accidentally sampling the next row. Each row uses ONE union offset.
const bands=[0,196,367,550,727,890,1080,1280,1536], offsets=[];
for(let row=0;row<8;row++){
  rat[row]=[];
  let top=bands[row+1],bottom=bands[row];
  for(let y=bands[row];y<bands[row+1];y++)for(let x=0;x<1024;x++){
    if(source.data[(y*1024+x)*4+3]>48){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(bottom-top>200)throw Error(`Row ${row} exceeds registered cell; review crop bands.`);
  const offset=188-bottom;offsets.push(offset);
  for(let col=0;col<4;col++){
    const registered=Buffer.alloc(256*208*4);
    for(let y=top;y<=bottom;y++)source.data.copy(registered,((y+offset)*256)*4,(y*1024+col*256)*4,(y*1024+col*256+256)*4);
    const cell=await sharp(registered,{raw:{width:256,height:208,channels:4}})
      .resize(192,144,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
    // Generated mattes have near-transparent residual pixels. Preserve soft fur above 12/255.
    for(let i=3;i<cell.length;i+=4){if(cell[i]<12)cell[i]=0;else if(cell[i]>245)cell[i]=255;}
    const x=(row%4)*384+col%2*192,y=Math.floor(row/4)*288+Math.floor(col/2)*144+2;
    for(let j=0;j<144;j++)cell.copy(data,((y+j)*width+x)*4,j*192*4,(j+1)*192*4);
    rat[row].push({x,y,width:192,height:144});
  }
}
const floor=await put('assets/source/cobbles.png',2,600,256,256);
const wall=await put('assets/source/masonry.png',260,600,256,256);
function radial(x,y,size,power){
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const d=Math.hypot((i+.5)/size*2-1,(j+.5)/size*2-1);
    const alpha=Math.round(Math.pow(Math.max(0,1-d),power)*255);
    data.set([255,255,255,alpha],((y+j)*width+x+i)*4);
  }
  return {x,y,width:size,height:size};
}
const glow=radial(520,600,128,1.8),shadow=radial(652,600,128,.65);
const roots=[[48,134],[64,278],[130,403],[200,610],[216,837],[165,1045],[129,1253],[69,1438]];
const noses=[[239,122],[210,332],[128,530],[48,676],[34,819],[69,927],[130,1113],[205,1320]];
const points=rows=>rows.map(([x,y],row)=>({x:x*.75,y:(y+offsets[row])*144/208}));
const anchors=Array.from({length:8},()=>({x:96,y:184*144/208}));
// Retained generated fur becomes a stable model-space material; old frames remain for comparison.
const furPixels=await sharp('assets/source/rat.png').extract({left:80,top:87,width:65,height:48}).resize(32,32,{kernel:'nearest'}).removeAlpha().raw().toBuffer();
const luminance=Array.from({length:1024},(_,i)=>(furPixels[i*3]*.3+furPixels[i*3+1]*.59+furPixels[i*3+2]*.11));
const mean=luminance.reduce((a,b)=>a+b,0)/luminance.length;
// Remove the painted source's broad lighting contrast; the live mesh supplies its own light.
const fur=luminance.map(v=>Math.round(Math.max(.84,Math.min(1.16,1+(v/mean-1)*.40))*100)/100);
const atlas={width,height,floor,wall,glow,shadow,rat,anchors,roots:points(roots),noses:points(noses),liveRat:{x:800,y:600,width:384,height:288},fur};
await sharp(data,{raw:{width,height,channels:4}}).png().toFile('public/assets/atlas.png');
await writeFile('public/assets/atlas.json',JSON.stringify(atlas));
const sources={};
for(const name of ['rat-original.png','rat.png','cobbles.png','masonry.png'])sources[name]=createHash('sha256').update(await readFile(`assets/source/${name}`)).digest('hex');
await writeFile('assets/provenance.json',JSON.stringify({generator:'image_gen.imagegen',date:'2026-10-06',sources,
  notes:'Original generated artwork. rat.png is the transparency edit of rat-original.png. Nearest-neighbor preparation; fixed row anchors. Tail, light masks and geometry are authored in code.'},null,2)+'\n');
console.log(`Atlas ${width} × ${height}: ${(data.length/1048576).toFixed(2)} MiB decoded; live rat region + 32 retained reference poses.`);
