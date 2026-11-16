// Shared racing gallop choreography for both the 3D and 2D simulators.
// Four ordered hoof contacts, with unequal left/right leg timing.
// All horses use the same four-beat pattern; cadence and extension depend on speed.
export const GAIT_HZ=2.48;
export function gallopDynamics(speedNow=16.5,replaySpeed=4){
 const velocity=Math.max(12,Math.min(20,Number(speedNow)||16.5));
 const replay=Math.max(.5,Math.min(12,Number(replaySpeed)||4));
 const exertion=Math.max(0,Math.min(1,(velocity-12)/8));
 // Animated cadence remains legible even when playback runs at 8x/12x.
 const playbackFactor=Math.sqrt(replay/4);
 return {
  hz:Math.max(1.4,Math.min(4.8,(2.65+exertion*1.05)*playbackFactor)),
  stride:1.18+exertion*.28,
  bob:.13+exertion*.045,
  neck:.15+exertion*.055
 };
}

export function gallopCycle(seconds,hz=GAIT_HZ){
 const t=(Number(seconds)||0)*(Number(hz)||GAIT_HZ);
 return ((t%1)+1)%1;
}
export function gallopLegPose(front,nearSide,cycle,stride=1){
 // Right-leading four-beat pattern: outer hind -> inner hind -> outer fore -> inner fore.
 const contact=front?(nearSide?.50:.35):(nearSide?.14:0);
 const t=((cycle-contact)%1+1)%1;
 const frames=[
  [0,.43,.025],[.12,-.04,-.045],[.24,-.40,.015],
  [.43,-.22,.34],[.68,.24,.34],[.87,.41,.09],[1,.43,.025]
 ];
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1];
  if(t<=b[0]){
   const u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
   const smooth=u*u*(3-2*u);
   return {
    hip:(a[1]+(b[1]-a[1])*smooth)*(front?1.14:1.08)*stride,
    knee:(a[2]+(b[2]-a[2])*smooth)*(front?1.35:-1.08)*stride
   };
  }
 }
 return {hip:.43*stride,knee:.025*stride};
}
