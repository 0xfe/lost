import { SoundGraph } from '../src/audio/graph';
import { clips, StreetScore, type Clip, type SoundGroup } from '../src/audio/score';
import { Rat } from '../src/simulation';

async function renderAudio(seconds:number,solo?:SoundGroup){
  const rate=24000,context=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate),buffers=new Map<Clip,AudioBuffer>();
  await Promise.all(clips.map(async id=>buffers.set(id,await context.decodeAudioData(await (await fetch(`/assets/audio/clips/${id}.wav`)).arrayBuffer()))));
  const music=!solo?await new OfflineAudioContext(2,1,32000).decodeAudioData(await(await fetch('/assets/audio/music/soundtrack.m4a')).arrayBuffer()):undefined;
  const graph=new SoundGraph(context,buffers,music),score=new StreetScore(),rat=new Rat();let maxVoices=0,events=0;
  graph.music?.start();
  if(solo)for(const group of Object.keys(graph.buses))graph.setGroup(group as SoundGroup,group===solo?1:0,0);
  for(let i=0;i<seconds*60;i++){
    rat.update(1/60);const now=i/60;
    const sounds=score.update(rat.previous,rat.current);
    if(i%6===0)graph.update(score.beds(rat.current,true),rat.current,rat.current.time,now);
    for(const sound of sounds){graph.play(sound,rat.current,rat.current.time,now);events++;}
    maxVoices=Math.max(maxVoices,graph.count);
  }
  const rendered=await context.startRendering(),channels=[...Array(2)].map((_,i)=>Array.from(rendered.getChannelData(i)));
  let peak=0,sum=0,difference=0;for(let i=0;i<rendered.length;i++)for(let c=0;c<2;c++){const v=channels[c]![i]!;peak=Math.max(peak,Math.abs(v));sum+=v*v;if(c===0)difference+=Math.abs(v-channels[1]![i]!);}
  return {channels,rate,metrics:{seconds,peak,rms:Math.sqrt(sum/(rendered.length*2)),stereoDifference:difference/rendered.length,maxVoices,events}};
}
async function renderMusicLoop(){
  const rate=32000,decoder=new OfflineAudioContext(2,1,rate);
  const music=await decoder.decodeAudioData(await(await fetch('/assets/audio/music/soundtrack.m4a')).arrayBuffer());
  const duration=music.duration,context=new OfflineAudioContext(2,Math.ceil((duration+6)*rate),rate),graph=new SoundGraph(context,new Map(),music);
  graph.music!.start();graph.setGroup('music',0,1);graph.setGroup('music',1,2);graph.volume(0,4);graph.volume(1,5);
  const result=await context.startRendering(),left=result.getChannelData(0),right=result.getChannelData(1);
  const rms=(from:number,to:number)=>{let sum=0;for(let i=Math.floor(from*rate);i<Math.floor(to*rate);i++)sum+=left[i]!**2+right[i]!**2;return Math.sqrt(sum/(Math.floor(to*rate)-Math.floor(from*rate))/2);};
  let peak=0;for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]!),Math.abs(right[i]!));
  const seam=Math.round(duration*rate),jump=Math.max(Math.abs(left[seam]!-left[seam-1]!),Math.abs(right[seam]!-right[seam-1]!));
  return {rate,channels:[left,right].map(pcm=>Array.from(pcm.slice(seam-rate*6,seam+rate*6))),
    metrics:{duration,loopStart:graph.music!.loopStart,decodedBytes:music.length*music.numberOfChannels*4,peak,jump,
      categoryMuted:rms(1.8,1.95),masterMuted:rms(4.8,4.95),beforeSeam:rms(duration-.1,duration),afterSeam:rms(duration,duration+.1),afterLoop:rms(duration+3,duration+4)}};
}
Object.assign(window,{renderAudio,renderMusicLoop});
