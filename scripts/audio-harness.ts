import { SoundGraph } from '../src/audio/graph';
import { clips, StreetScore, type Clip, type SoundGroup } from '../src/audio/score';
import { Rat } from '../src/simulation';

async function renderAudio(seconds:number,solo?:SoundGroup){
  const rate=24000,context=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate),buffers=new Map<Clip,AudioBuffer>();
  await Promise.all(clips.map(async id=>buffers.set(id,await context.decodeAudioData(await (await fetch(`/assets/audio/clips/${id}.wav`)).arrayBuffer()))));
  const graph=new SoundGraph(context,buffers),score=new StreetScore(),rat=new Rat();let maxVoices=0,events=0;
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
Object.assign(window,{renderAudio});
