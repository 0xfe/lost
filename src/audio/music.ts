/** Blend the tail into the intro, then loop to the end of that intro. First play keeps the opening. */
export function crossfadeMusic(channels:Float32Array[],sampleRate:number,seconds=3):number {
  const length=channels[0]?.length??0;
  if(!length||sampleRate<=0||channels.some(c=>c.length!==length))throw Error('Invalid music PCM');
  const overlap=Math.min(Math.round(seconds*sampleRate),Math.floor(length/4));
  if(overlap<1)throw Error('Music crossfade must contain samples');
  for(const pcm of channels)for(let i=0;i<overlap;i++){
    const t=(i+1)/overlap,index=length-overlap+i;
    pcm[index]=pcm[index]!*(1-t)+pcm[i]!*t;
  }
  return overlap/sampleRate;
}

/** A stereo, non-spatial soundtrack. Native looping is sample scheduled; no timers or per-frame restarts. */
export class MusicLoop {
  private source?:AudioBufferSourceNode;
  private envelope?:GainNode;
  private began=0;
  readonly loopStart:number;
  constructor(private context:BaseAudioContext,private buffer:AudioBuffer,private output:AudioNode){
    this.loopStart=crossfadeMusic(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate);
  }
  get status(){
    const elapsed=Math.max(0,this.context.currentTime-this.began),span=this.buffer.duration-this.loopStart;
    return {playing:!!this.source&&this.context.state==='running',duration:this.buffer.duration,loopStart:this.loopStart,
      position:elapsed<this.buffer.duration?elapsed:this.loopStart+(elapsed-this.buffer.duration)%span,
      decodedBytes:this.buffer.length*this.buffer.numberOfChannels*4};
  }
  start(){
    this.stop();const c=this.context,s=c.createBufferSource(),envelope=c.createGain();
    s.buffer=this.buffer;s.loop=true;s.loopStart=this.loopStart;s.loopEnd=this.buffer.duration;
    this.began=c.currentTime;envelope.gain.setValueAtTime(0,this.began);envelope.gain.linearRampToValueAtTime(1,this.began+.6);
    s.connect(envelope).connect(this.output);s.start(this.began);this.source=s;this.envelope=envelope;
  }
  stop(){if(this.source){this.source.stop();this.source.disconnect();this.source=undefined;}this.envelope?.disconnect();this.envelope=undefined;}
}
