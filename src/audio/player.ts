import type { Pose } from '../rat/types';
import { SoundGraph } from './graph';
import { clips, StreetScore, type Clip, type SoundGroup } from './score';
/** Browser lifetime and autoplay policy. Nothing is fetched or opened until an explicit playback gesture. */
export class StreetAudio {
  private context?:AudioContext;
  private graph?:SoundGraph;
  private score=new StreetScore();
  private muted=true;
  private active=true;
  private loading=false;
  private error='';
  private mixes=new Map<SoundGroup,number>();
  constructor(private urls:Record<string,string>,private changed:()=>void){}
  get status(){return {muted:this.muted,loading:this.loading,error:this.error,state:this.context?.state??'unopened',voices:this.graph?.count??0};}
  async toggle(){
    if(this.loading)return;
    if(this.graph){this.muted=!this.muted;this.apply();this.changed();return;}
    this.loading=true;this.error='';this.changed();
    try{
      this.context??=new AudioContext();
      // Resume synchronously from the gesture, before asynchronous network/decoding work.
      await this.context.resume();
      const buffers=new Map<Clip,AudioBuffer>();
      await Promise.all(clips.map(async id=>{
        const response=await fetch(this.urls[`${id}.wav`]!);if(!response.ok)throw Error(`${id}: HTTP ${response.status}`);
        buffers.set(id,await this.context!.decodeAudioData(await response.arrayBuffer()));
      }));
      this.graph=new SoundGraph(this.context,buffers);
      for(const [group,value] of this.mixes)this.graph.setGroup(group,value);
      this.muted=false;this.apply();
    }catch(error){this.error='Sound could not load. Tap to retry.';this.muted=true;void this.context?.suspend();console.warn('Lost audio:',error);}
    finally{this.loading=false;this.changed();}
  }
  setActive(active:boolean){if(active===this.active)return;this.active=active;this.apply();}
  private apply(){
    const c=this.context;if(!c||!this.graph)return;
    const audible=!this.muted&&this.active;
    this.graph.volume(audible?1:0);
    // Ramp to silence before suspending; generation check prevents a stale mute winning a new unmute.
    if(audible)void c.resume().catch(()=>{this.muted=true;this.error='Tap to resume sound.';this.changed();});
    else setTimeout(()=>{if(this.muted||!this.active){if(this.muted)this.graph?.clear();void c.suspend();}},100);
  }
  update(before:Pose,pose:Pose){
    const events=this.score.update(before,pose);
    if(this.muted||!this.active||!this.graph||this.context?.state!=='running')return;
    for(const event of events)this.graph.play(event,pose,pose.time);
  }
  frame(pose:Pose,rain:boolean){if(!this.muted&&this.active&&this.context?.state==='running')this.graph?.update(this.score.beds(pose,rain),pose,pose.time);}
  setGroup(group:SoundGroup,value:number){this.mixes.set(group,value);this.graph?.setGroup(group,value);}
  reset(){this.graph?.clear();this.score=new StreetScore();}
  dispose(){this.graph?.dispose();void this.context?.close();}
}
