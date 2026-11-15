// Shared racing gallop choreography for both the 3D and 2D simulators.
// Four ordered hoof contacts, with unequal left/right leg timing.
// All 18 horses use the same pattern and cadence; motion is not tied to replay speed.
export const GAIT_HZ=2.48;
export function gallopCycle(seconds){
 const t=(Number(seconds)||0)*GAIT_HZ;
 return ((t%1)+1)%1;
}
export function gallopLegPose(front,nearSide,cycle){
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
    hip:(a[1]+(b[1]-a[1])*smooth)*(front?1:.89),
    knee:(a[2]+(b[2]-a[2])*smooth)*(front?1:-.75)
   };
  }
 }
 return {hip:.43,knee:.025};
}
