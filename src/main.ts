import { StreetAudio } from './audio/player';
import type { SoundGroup } from './audio/score';
import { DEFAULT_ZOOM, sceneCamera } from './world/street';
import { FixedClock } from './math';
import { WebGLRenderer } from './webgl';
import { CanvasRenderer } from './canvas';
import { Rat, screenHeading, type Action } from './simulation';
import { compose } from './scene';
import type { Atlas } from './assets';
import type { PixelImage, Renderer } from './render';

declare const __ASSET_URLS__: Record<string,string>;
const $ = <T extends HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const canvas=$<HTMLCanvasElement>('#scene'), params=new URLSearchParams(location.search);
let rat=new Rat(), renderer:Renderer, atlas:Atlas, pixels:PixelImage;
let paused=params.has('paused')||matchMedia('(prefers-reduced-motion: reduce)').matches;
let zoom=DEFAULT_ZOOM,rain=true,frames=0,lab=params.has('lab'),showRig=true,timeScale=1;
const audio=new StreetAudio(__ASSET_URLS__,syncAudio);
const clock=new FixedClock(), keys=new Set<string>();
const descriptions:Record<Action,string>={idle:'A moment, very still',walk:'One small step at a time',scurry:'A little courage',sniff:'Taking in the night',listen:'Something in the distance',groom:'A moment to himself'};
const fail=(error:unknown)=>{const el=$('#fatal');el.hidden=false;el.textContent=`The street could not be drawn. ${error instanceof Error?error.message:String(error)} Reload to try again.`;$('#loading').hidden=true;console.error(error);};

async function initialize(){
  const [response,image]=await Promise.all([fetch(__ASSET_URLS__['atlas.json']!),new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load the sprite atlas.'));img.src=__ASSET_URLS__['atlas.png']!;
  })]);
  if(!response.ok)throw Error(`Atlas manifest: HTTP ${response.status}`);
  atlas=await response.json() as Atlas;
  const sheet=document.createElement('canvas');sheet.width=image.width;sheet.height=image.height;
  const ctx=sheet.getContext('2d')!;ctx.drawImage(image,0,0);
  pixels={width:image.width,height:image.height,data:new Uint8Array(ctx.getImageData(0,0,image.width,image.height).data)};
  if(params.get('renderer')==='canvas')renderer=new CanvasRenderer(canvas,pixels);
  else renderer=new WebGLRenderer(canvas,pixels);
  $('#renderer-label').textContent=renderer.name.toUpperCase();
  for(let i=0;i<Math.min(120,Math.max(0,Number(params.get('time'))||0))*60;i++)rat.update(1/60);
  const action=params.get('action');if(['walk','scurry','sniff','listen','groom','idle'].includes(action??''))rat.command(action as Action);
  $('#lab').hidden=hidden||!lab;$('#motion-lab').setAttribute('aria-pressed',String(lab));
  $('#loading').hidden=true;sync();requestAnimationFrame(tick);
  console.info('Lost • study 003',{renderer:renderer.name,atlasMiB:pixels.data.byteLength/1048576,rat:'continuous procedural rig',step:clock.step});
  if(params.has('test'))Object.assign(window,{__lost:{get audio(){return audio.status;},get rat(){return rat;},get paused(){return paused;},get frames(){return frames;},get renderer(){return renderer.name;},
    advance(seconds:number){for(let i=0;i<Math.round(seconds*60);i++)rat.update(1/60);},
    frame(){return compose(rat.sample(1),atlas,{width:canvas.width,height:canvas.height,zoom,rain});}}});
}

function syncAudio(){
  const state=audio.status,button=$<HTMLButtonElement>('#sound');
  button.disabled=state.loading;button.setAttribute('aria-pressed',String(!state.muted));
  button.setAttribute('aria-label',state.loading?'Loading sound':state.error?'Retry sound':state.muted?'Enable sound':'Mute sound');
  button.title=state.error||(state.muted?'Enable sound (M)':'Mute sound (M)');
  $('#sound-label').textContent=state.loading?'Loading…':state.error?'Retry sound':state.muted?'Sound off':'Sound on';
  $('#audio-status').textContent=state.error;
}
$('#sound').onclick=()=>{void audio.toggle();};
document.querySelectorAll<HTMLInputElement>('[data-sound]').forEach(input=>input.oninput=()=>audio.setGroup(input.dataset.sound as SoundGroup,Number(input.value)/100));
function update(dt:number){rat.update(dt);audio.update(rat.previous,rat.current);}
function sync(){
  audio.setActive(!paused&&!document.hidden);
  $('#explore').setAttribute('aria-pressed',String(rat.explore));
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(!rat.explore&&rat.requested===b.dataset.action)));
  $('#pause').setAttribute('aria-pressed',String(paused));$('#pause').textContent=paused?'▷ Resume':'Ⅱ Pause';
  $('#activity').textContent=paused?'The night holds its breath':descriptions[rat.current.action];
  if(rat.explore&&!paused){const phase=rat.exploration.phase;$('#activity').textContent=phase==='notice'?'Caught a scent':phase==='approach'?'Something over here':phase==='investigate'?'Following his nose':phase==='return'?'Nothing here. Back to the street':descriptions[rat.current.action];}
  if(lab){
    $('#gait-readout').textContent=rat.current.speed<.02?'At rest':rat.current.gait==='walk'?'Four-beat walk':'Asymmetric gallop';
    rat.current.feet.forEach((f,i)=>$(`#foot-${i}`).dataset.contact=String(f.contact));
    $('#motion-readout').textContent=`${(rat.current.speed/1.5).toFixed(2)} body lengths / s`;
  }
}
$('#motion-lab').onclick=()=>{lab=!lab;$('#lab').hidden=hidden||!lab;$('#motion-lab').setAttribute('aria-pressed',String(lab));sync();};
$<HTMLSelectElement>('#time-scale').onchange=e=>{timeScale=Number((e.target as HTMLSelectElement).value);};
$<HTMLInputElement>('#show-rig').onchange=e=>{showRig=(e.target as HTMLInputElement).checked;};
$('#step').onclick=()=>{paused=true;clock.reset();update(1/60);sync();};
function act(action:Action){rat.command(action);sync();}
$('#explore').onclick=()=>{rat.setExploring(!rat.explore);sync();};
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action as Action));
document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.dir!.split(',').map(Number);rat.steer(screenHeading(x!,y!));sync();});
$('#rest').onclick=()=>act('idle');
$('#pause').onclick=()=>{paused=!paused;clock.reset();sync();};
$('#reset').onclick=()=>{rat=new Rat();audio.reset();clock.reset();paused=false;zoom=DEFAULT_ZOOM;rain=true;$<HTMLInputElement>('#rain').checked=true;$<HTMLInputElement>('#zoom').value=String(DEFAULT_ZOOM*100);$<HTMLInputElement>('#mood').value='12';$('#mood-label').textContent='Lost';sync();};
$<HTMLInputElement>('#mood').oninput=e=>{const v=Number((e.target as HTMLInputElement).value);rat.mood=v/100;if(paused){rat.current.mood=rat.mood;rat.previous.mood=rat.mood;}$('#mood-label').textContent=v<35?'Lost':v<70?'A glimmer':'Almost home';};
$<HTMLInputElement>('#zoom').oninput=e=>{zoom=Number((e.target as HTMLInputElement).value)/100;};
$<HTMLInputElement>('#rain').onchange=e=>{rain=(e.target as HTMLInputElement).checked;};
let hidden=true;
function hide(){hidden=!hidden;document.querySelectorAll<HTMLElement>('.interface').forEach(el=>el.hidden=hidden);$('#lab').hidden=hidden||!lab;$('#show-controls').hidden=!hidden;}
$('#hide').onclick=hide;$('#show-controls').onclick=hide;
const dialog=$<HTMLDialogElement>('#notes-dialog');
$('#notes').onclick=()=>dialog.showModal();$('#close-notes').onclick=()=>dialog.close();$('#back-street').onclick=()=>dialog.close();
$('#fullscreen').onclick=()=>{(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(fail);};

document.addEventListener('keydown',e=>{
  if(dialog.open)return;
  if((e.target as HTMLElement).matches('input,select,textarea'))return;
  if(e.code==='Space'){if((e.target as HTMLElement).matches('button'))return;e.preventDefault();if(!e.repeat)$('#pause').click();return;}
  if(e.key.toLowerCase()==='m'){if(!e.repeat)$('#sound').click();return;}
  if(e.key.toLowerCase()==='h'){if(!e.repeat)hide();return;}
  if(e.key.startsWith('Arrow')){e.preventDefault();keys.add(e.key);return;}
  const actions:Record<string,Action>={'0':'idle','1':'walk','2':'scurry','3':'sniff','4':'listen','5':'groom'};
  if(actions[e.key])act(actions[e.key]!);
});
document.addEventListener('keyup',e=>{if(keys.delete(e.key)&&keys.size===0)act('idle');});
window.addEventListener('blur',()=>{if(keys.size)act('idle');keys.clear();clock.reset();});
document.addEventListener('visibilitychange',()=>{keys.clear();clock.reset();last=0;audio.setActive(!paused&&!document.hidden);});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;fail(new Error('WebGL context was lost.'));});
canvas.addEventListener('webglcontextrestored',()=>{try{renderer.dispose();renderer=new WebGLRenderer(canvas,pixels);$('#fatal').hidden=true;sync();}catch(e){fail(e);}});
// Touch/mouse hold on the street steers relative to the centered rat.
let pointer=false;
function point(e:PointerEvent){const {origin}=sceneCamera(innerWidth,innerHeight,zoom);const x=e.clientX-origin.x,y=e.clientY-origin.y;if(Math.hypot(x,y)<25){act('idle');return;}rat.steer(screenHeading(x,y));rat.command('walk');}
canvas.addEventListener('pointerdown',e=>{pointer=true;canvas.setPointerCapture(e.pointerId);point(e);});
canvas.addEventListener('pointermove',e=>{if(pointer)point(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{if(pointer){pointer=false;act('idle');}});
let last=0;
function tick(now:number){
  const dt=last?(now-last)/1000:0;last=now;
  if(!paused&&!document.hidden){
    if(keys.size){const x=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));if(x||y){rat.steer(screenHeading(x,y));rat.command('walk');}}
    clock.advance(dt*timeScale,update);
  }
  const resolution=Math.max(1.25,innerWidth/1100);
  const frame=compose(rat.sample(paused?1:clock.alpha),atlas,{width:Math.round(innerWidth/resolution),height:Math.round(innerHeight/resolution),zoom,rain,debug:!hidden&&lab&&showRig});
  renderer.render(frame);audio.frame(rat.sample(paused?1:clock.alpha),rain);frames++;
  if(frames%15===0)sync();
  requestAnimationFrame(tick);
}
initialize().catch(fail);
