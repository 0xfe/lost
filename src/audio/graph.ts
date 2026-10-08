import { MusicLoop } from './music';
import { random, type Vec2 } from '../math';
import { groups, mix, spatial, type Clip, type Sound, type SoundGroup } from './score';
interface Voice { sound:Sound;source:AudioBufferSourceNode;gain:GainNode;pan:StereoPannerNode;filter:BiquadFilterNode;nodes:AudioNode[];end:number }
/** Shared by live playback and OfflineAudioContext previews. No app or DOM dependency. */
export class SoundGraph {
  readonly master:GainNode;
  readonly music?:MusicLoop;
  readonly buses={} as Record<SoundGroup,GainNode>;
  private reverb:ConvolverNode;
  private compressor:DynamicsCompressorNode;
  private voices=new Map<string,Voice>();
  private sends={} as Record<SoundGroup,GainNode>;
  constructor(readonly context:BaseAudioContext,private buffers:Map<Clip,AudioBuffer>,music?:AudioBuffer){
    const c=context;this.master=c.createGain();this.master.gain.value=.85;
    this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-12;this.compressor.knee.value=12;this.compressor.ratio.value=4;
    this.master.connect(this.compressor).connect(c.destination);
    this.reverb=c.createConvolver();this.reverb.normalize=false;
    const impulse=c.createBuffer(2,Math.floor(c.sampleRate*.85),c.sampleRate),rng=random(173);
    for(let channel=0;channel<2;channel++){
      const data=impulse.getChannelData(channel);let low=0;
      for(let i=0;i<data.length;i++){const t=i/c.sampleRate;low=low*.6+(rng()*2-1)*.4;data[i]=t<.045?0:low*Math.exp(-t*8)*.016;}
      for(const [delay,gain] of [[.055,.14],[.103,.08],[.171,.04]])data[Math.floor((delay!+channel*.009)*c.sampleRate)]=gain!;
    }
    this.reverb.buffer=impulse;this.reverb.connect(this.master);
    for(const group of groups){const bus=c.createGain();bus.gain.value=mix[group];bus.connect(this.master);this.buses[group]=bus;
      const send=c.createGain();send.gain.value=mix[group];send.connect(this.reverb);this.sends[group]=send;}
    if(music)this.music=new MusicLoop(c,music,this.buses.music);
  }
  get count(){return this.voices.size;}
  setGroup(group:SoundGroup,value:number,at=this.context.currentTime){
    this.buses[group].gain.setTargetAtTime(mix[group]*value,at,.06);this.sends[group].gain.setTargetAtTime(mix[group]*value,at,.06);
  }
  volume(value:number,at=this.context.currentTime){this.master.gain.setTargetAtTime(value*.85,at,.025);}
  private position(v:Voice,listener:Vec2,time:number,at:number){
    const s=spatial(v.sound,listener,time);
    v.gain.gain.setTargetAtTime(v.sound.gain*s.gain,at,.06);
    v.pan.pan.setTargetAtTime(s.pan,at,.07);v.filter.frequency.setTargetAtTime(s.cutoff,at,.08);
  }
  play(sound:Sound,listener:Vec2,time:number,at=this.context.currentTime){
    if(this.voices.has(sound.id))return;
    const buffer=this.buffers.get(sound.clip);if(!buffer)return;
    this.prune(at);
    if(this.voices.size>=40)return; // eight sustained sources plus bounded contact/pass-by voices
    const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),hp=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner(),envelope=c.createGain(),send=c.createGain();
    source.buffer=buffer;source.playbackRate.value=sound.rate;source.loop=!!sound.loop;
    filter.type='lowpass';filter.Q.value=.4;hp.type='highpass';hp.frequency.value=sound.highpass??65;hp.Q.value=.5;
    send.gain.value=sound.wet;
    source.connect(hp).connect(filter).connect(gain).connect(envelope).connect(pan);
    pan.connect(this.buses[sound.group]);pan.connect(send).connect(this.sends[sound.group]);
    const duration=Math.min(sound.duration,(buffer.duration-sound.offset)/sound.rate),end=sound.loop?Infinity:at+Math.max(.025,duration);
    envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(1,at+(sound.loop?.35:Math.min(.025,duration*.15)));
    if(!sound.loop){envelope.gain.setValueAtTime(1,Math.max(at+.004,end-Math.min(.2,duration*.4)));envelope.gain.linearRampToValueAtTime(0,end);}
    const v:Voice={sound,source,filter,gain,pan,nodes:[source,filter,hp,gain,pan,envelope,send],end};
    this.voices.set(sound.id,v);gain.gain.value=0;this.position(v,listener,time,at);
    source.start(at,sound.offset%buffer.duration);if(!sound.loop)source.stop(end+.005);
    source.onended=()=>{for(const node of v.nodes)node.disconnect();if(this.voices.get(sound.id)===v)this.voices.delete(sound.id);};
  }
  update(beds:Sound[],listener:Vec2,time:number,at=this.context.currentTime){
    this.prune(at);const keep=new Set(beds.map(s=>s.id));
    for(const [id,v] of this.voices)if(v.sound.loop&&!keep.has(id)){
      v.sound={...v.sound,loop:false,gain:0};v.end=at+.4;v.source.stop(v.end);this.position(v,listener,time,at);
    }
    for(const s of beds){const v=this.voices.get(s.id);if(v)v.sound=s;else this.play(s,listener,time,at);}
    for(const v of this.voices.values())this.position(v,listener,time,at);
  }
  private remove(id:string){const v=this.voices.get(id);if(!v)return;try{v.source.stop();}catch{}for(const node of v.nodes)node.disconnect();this.voices.delete(id);}
  private prune(at:number){
    // Real-time sources free themselves onended; OfflineAudioContext renders after scheduling.
    for(const [id,v] of this.voices)if(v.end+.02<at)this.voices.delete(id);
  }
  clear(){for(const id of this.voices.keys())this.remove(id);}
  dispose(){this.music?.stop();this.clear();this.reverb.disconnect();this.master.disconnect();this.compressor.disconnect();for(const group of groups){this.buses[group].disconnect();this.sends[group].disconnect();}}
}
