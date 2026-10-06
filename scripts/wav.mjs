/** Interleaved little-endian PCM16, used by authoring and offline mix previews. */
export function wav(channels,rate){
 const frames=channels[0].length,count=channels.length,out=Buffer.alloc(44+frames*count*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(count,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*count*2,28);out.writeUInt16LE(count*2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(out.length-44,40);
 for(let i=0;i<frames;i++)for(let c=0;c<count;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*count+c)*2);
 return out;
}
