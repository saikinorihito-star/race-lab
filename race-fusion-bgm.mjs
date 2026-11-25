// Original instrumental composition "Velocity Field" — 160 BPM, 64 bars, 96 sec.
// No samples, melodies, or recordings from existing commercial music.
export const TRACK_NAME='Velocity Field（オリジナル・フュージョン）';
export const TRACK_BPM=160;
export const TRACK_SECONDS=96;
export async function createFusionBgm(){
 const sr=22050,beat=60/TRACK_BPM,bar=beat*4,n=Math.round(TRACK_SECONDS*sr);
 const left=new Float32Array(n),right=new Float32Array(n);
 const tau=Math.PI*2,ts=2048,mask=ts-1;
 const tables={};
 for(const [name,weights] of Object.entries({bass:[1,.40,.23,.12,.07],guitar:[1,.62,.37,.26,.18,.12,.09,.05],lead:[1,.44,.14,.20,.08,.07],keys:[1,.13,.32,.06,.12]})){
  const a=new Float32Array(ts);for(let i=0;i<ts;i++){let x=0;for(let h=0;h<weights.length;h++)x+=weights[h]*Math.sin(tau*i/ts*(h+1));a[i]=Math.tanh(x*.68)}tables[name]=a;
 }
 let seed=519621;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
 function note(kind,midi,start,dur,vol,pan){
  const a=tables[kind],freq=440*2**((midi-69)/12),base=Math.round(start*sr),samples=Math.ceil((dur+.09)*sr),step=freq*ts/sr;
  const gl=Math.sqrt((1-pan)/2)*vol,gr=Math.sqrt((1+pan)/2)*vol;
  const attack=kind==='lead'?.021:kind==='keys'?.012:.004,rel=.075;
  for(let i=0;i<samples;i++){
   const t=i/sr,env=Math.min(1,t/attack)*Math.min(1,Math.max(0,(dur+rel-t)/rel));
   const decay=kind==='guitar'?Math.exp(-t*2.7):kind==='bass'?Math.exp(-t*1.9):kind==='keys'?Math.exp(-t*1.1):.86+.14*Math.sin(t*12);
   const vib=kind==='lead'?Math.sin(t*35)*.13*ts/10:0;
   const phase=i*step+vib;let v=a[Math.floor(phase)&mask];
   if(kind==='guitar'||kind==='lead')v=.72*v+.28*a[Math.floor(phase*1.0025+12)&mask];
   const k=(base+i)%n;v*=env*decay;left[k]+=v*gl;right[k]+=v*gr;
  }
 }
 function drum(kind,start,vol,pan){
  const len=kind==='kick'?.22:kind==='snare'?.19:kind==='open'?.18:.055;
  const b=Math.round(start*sr),gl=Math.sqrt((1-pan)/2)*vol,gr=Math.sqrt((1+pan)/2)*vol;let old=0,phase=0;
  for(let i=0;i<Math.round(len*sr);i++){
   const t=i/sr,noise=rnd(),hp=noise-old;old=noise;let x=0;
   if(kind==='kick'){phase+=tau*(47+100*Math.exp(-t*32))/sr;x=Math.sin(phase)*Math.exp(-t*20)+.10*hp*Math.exp(-t*100)}
   else if(kind==='snare')x=(.65*noise+.18*hp+.27*Math.sin(tau*178*t))*Math.exp(-t*26);
   else x=hp*.64*Math.exp(-t*(kind==='open'?19:75));
   const k=(b+i)%n;left[k]+=x*gl;right[k]+=x*gr;
  }
 }
 // Original harmonic progression, alternating 8-bar sections.
 const chords=[
  [40,[55,59,62,66]],[36,[55,59,62,64]],[43,[54,57,62,66]],[38,[54,57,60,64]],
  [45,[55,59,60,64]],[36,[55,59,62,64]],[42,[54,57,60,64]],[47,[57,63,66,69]]
 ];
 const bridge=[
  [41,[57,60,64,67]],[43,[59,62,65,69]],[40,[55,59,62,66]],[45,[55,59,60,64]],
  [36,[55,59,62,64]],[38,[54,57,60,64]],[42,[54,57,60,64]],[47,[57,63,66,69]]
 ];
 // Independently composed angular motifs, [beat offset, MIDI, duration in beats].
 const A=[[[0,71,.7],[.75,74,.35],[1.5,76,.85],[2.75,69,.45],[3.25,71,.6]],[[0,67,.7],[1,71,.4],[1.5,72,.4],[2,74,1.2]],[[.25,78,.55],[1,74,.55],[1.75,73,.5],[2.5,69,.5],[3.25,74,.45]],[[0,76,1.1],[1.5,72,.4],[2,69,.6],[3,66,.7]],[[0,72,.5],[.75,76,.5],[1.5,79,.8],[2.75,76,.4],[3.25,74,.4]],[[0,71,.75],[1,67,.6],[2,69,.45],[2.75,72,.8]],[[.5,73,.4],[1,76,.65],[2,74,.45],[2.75,69,.55]],[[0,71,1],[1.5,75,.4],[2.25,78,.5],[3,75,.7]]];
 const B=[[[0,77,1.2],[1.5,72,.4],[2,69,.5],[3,72,.75]],[[0,79,.5],[.75,74,.5],[1.5,77,.5],[2.25,81,1.2]],[[.5,78,.5],[1.25,76,.5],[2,71,1.5]],[[0,72,.5],[.75,76,.5],[1.5,74,.5],[2.5,69,1]],[[0,76,.75],[1,74,.75],[2,72,.75],[3,67,.65]],[[0,69,.55],[.75,72,.55],[1.5,76,1.4]],[[0,78,.5],[.75,76,.5],[1.5,73,.75],[2.75,69,.65]],[[0,75,.8],[1.25,71,.5],[2,78,.9],[3.25,75,.5]]];
 for(let b=0;b<64;b++){
  const section=Math.floor(b/8),idx=b%8,t=b*bar,[root,voicing]=(section===3||section===6?bridge:chords)[idx],full=section!==0||idx>=4;
  const bass=[root,root,root+12,root+7,root,root+10,root+12,root+7];
  for(let i=0;i<8;i++)note('bass',bass[i],t+i*beat/2,beat*(i===2||i===6?.27:.43),i%2?.115:.16,-.10);
  for(const q of [.5,1.75,2.5,3.25])for(const midi of voicing)note('keys',midi,t+q*beat,beat*.24,.027,-.55);
  for(const q of [0,1.5,2,3.25])drum('kick',t+q*beat,.24,0);
  for(const q of [1,3])drum('snare',t+q*beat,.19,.08);
  for(let i=0;i<8;i++)drum(i===7?'open':'hat',t+i*beat/2,i%2?.055:.085,.38);
  if(idx===7)for(const q of [3.25,3.5,3.75])drum('snare',t+q*beat,.115,.12);
  if(full){
   const phrase=(section===3||section===6?B:A)[idx],guitar=section%3!==1;
   for(const [q,m,d] of phrase){note(guitar?'guitar':'lead',m,t+q*beat,d*beat,.15,guitar?-.24:.22);note(guitar?'lead':'guitar',m-12,t+q*beat+.009,d*beat,.047,guitar?.35:-.35);}
   if(section>=4)for(const q of [.25,2.25])note('guitar',voicing[1]+12,t+q*beat,beat*.19,.038,.52);
  }else for(const q of [0,1.5,2.75])note('guitar',voicing[1]+12,t+q*beat,beat*.36,.11,.22);
  // Yield on mobile to avoid freezing the renderer while preparing audio.
  if(b%2===1)await new Promise(resolve=>setTimeout(resolve,0));
 }
 const buf=new ArrayBuffer(44+n*4),v=new DataView(buf);const tag=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 tag(0,'RIFF');v.setUint32(4,36+n*4,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sr,true);v.setUint32(28,sr*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,n*4,true);
 const delay=Math.round(.112*sr);for(let i=0;i<n;i++){const j=(i+n-delay)%n,l=left[i]+right[j]*.065,r=right[i]+left[j]*.065;const edge=Math.min(1,i/100,(n-1-i)/100);v.setInt16(44+i*4,Math.round(Math.tanh(l*1.15)*26000*edge),true);v.setInt16(46+i*4,Math.round(Math.tanh(r*1.15)*26000*edge),true)}
 return new Blob([buf],{type:'audio/wav'});
}
