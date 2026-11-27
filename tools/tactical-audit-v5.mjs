
function build(s,tactics){
const cut=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const base=`const console={assert(){}};class V{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}clone(){return new V(this.x,this.y,this.z)}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this}normalize(){let n=Math.hypot(this.x,this.y,this.z)||1;this.x/=n;this.y/=n;this.z/=n;return this}}
class C{constructor(a,b,c,d){Object.assign(this,{a,b,c,d})}at(t){const u=1-t;return new V().addScaledVector(this.a,u*u*u).addScaledVector(this.b,3*u*u*t).addScaledVector(this.c,3*u*t*t).addScaledVector(this.d,t*t*t)}lengths(){if(this.l)return this.l;let a=[0],p=this.at(0);for(let i=1;i<=240;i++){let q=this.at(i/240);a.push(a[i-1]+Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z));p=q}return this.l=a}getLength(){return this.lengths()[240]}parameter(u){let a=this.lengths(),d=u*a[240],i=1;while(i<240&&a[i]<d)i++;return (i-1+(d-a[i-1])/Math.max(1e-9,a[i]-a[i-1]))/240}getPointAt(u){return this.at(this.parameter(u))}getTangentAt(u){const t=this.parameter(u),lo=this.at(Math.max(0,t-.0001)),hi=this.at(Math.min(1,t+.0001));return new V(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z).normalize()}}
const THREE={Vector3:V,CubicBezierCurve3:C,MathUtils:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),lerp:(a,b,t)=>a+(b-a)*t,smoothstep:(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}}};
const isOfficialEighteenTest=true,isOfficialMultiTest=true,OFFICIAL_TEST_COUNT=18,FOUR_INWARD_RATE=4.4,FOUR_MAX_LATERAL_PER_FORWARD=.30,FOUR_RAIL_CENTER_CLEARANCE=2.8,PAIR_LANE_SPACING=3.35,DISPLAY_RELIEF=1,ELEVATION_BASE=3.05;const GOING_SEVERITY={good:0,slightlyHeavy:.3,heavy:.7,bad:1};let raceGoingAtStart='good',raceFlowAtStart,raceElapsed=0,raceFinished=[],raceHorses=[],activePlan,horseIdentityBySlot=[],horseAbilities=[];const HORSE_ABILITY_KEYS=['speed','stamina','acceleration','course','distance','composure','traffic','going','hill','start'];const balanceWeights=Object.fromEntries(HORSE_ABILITY_KEYS.map(x=>[x,1]));function captureRaceAnalysis(){};`;
const geo=cut("const LAP=2083.1","const requestedRelief=")+cut("const profile=[","// 公表断面図")+cut("const LEFT_START_X=","// 芝内側のダート")+cut("const POCKET_DATA="," const vertices=[],colors=[],uv=[],indices=[];")+"return {...spec,curve,length,remaining,start:curve.getPointAt(0)};}\nconst POCKETS=new Map(POCKET_DATA.map(x=>[x.distance,makePocket(x)]));"+cut("function racePlan(distance)","function racePointAt")+cut("function fieldCenterAt(plan,distance)","function fieldStallWidth").replace("function fieldCenterAt(","function fieldCenterExact(");
const cache=`let samples=[];function makeCourse(D){activePlan=racePlan(D);samples=Array.from({length:(D+90)*4+1},(_,i)=>fieldCenterExact(activePlan,i/4));buildEighteenCornerProfile()}function fieldCenterAt(plan,d){return samples[Math.max(0,Math.min(samples.length-1,Math.round(d*4)))]}`;
const flow=cut("function makeRaceFlow(","function refreshFlowStatus()");
const profiles=cut("const EIGHTEEN_PACE_PROFILES=","// Per-horse ability editing")+cut("function defaultHorseAbility(","function normalizeHorseAbility")+cut("function baseForRegisteredHorse(","const raceGoingSelect")+cut("function effectiveEighteenProfile(","function refreshReserveAbilityOptions");
const lanes=cut("function fourHorseInnerLane(","// 4頭だけ外寄り");
const engine=cut("const EIGHTEEN_CORNER_STEP=","function updateRace(dt)");
const mod='const {raceTacticalContext,tacticalRaceTarget,tacticalEnergyCost}=(()=>{'+tactics.replace(/\bexport /g,"")+';return {raceTacticalContext,tacticalRaceTarget,tacticalEnergyCost}})();';
return new Function(base+geo+cache+flow+profiles+lanes+mod+engine+`
return function(D,kind,seed,rotation=0,scenario='base'){
 if(!activePlan||activePlan.distance!==D)makeCourse(D);
 horseIdentityBySlot=Array.from({length:18},(_,i)=>(i+rotation)%18);
 horseAbilities=Array.from({length:18},(_,i)=>defaultHorseAbility(i));
 if(scenario==='strong')for(const k of ['speed','stamina','acceleration'])horseAbilities[0][k]=10;
 if(scenario==='weak')for(const k of ['speed','stamina','acceleration'])horseAbilities[0][k]=1;
 if(scenario==='equal')for(const a of horseAbilities){a.role='先行';a.preferredDistance=D;}
 if(scenario.startsWith('role:'))horseAbilities[1].role=scenario.slice(5);
 raceElapsed=0;raceFinished=[];raceFlowAtStart=makeRaceFlow(kind,seed);
 raceHorses=horseIdentityBySlot.map((id,i)=>{const p=effectiveEighteenProfile(i),lane=eighteenStartLane(fieldCenterAt(activePlan,0).width,i);return {idx:i,number:i+1,slot:i,role:p.role,distance:0,postDistance:0,lane,speed:0,energy:1,finished:false,passGoal:null,passUntil:0,passCooldown:0,passAttempts:0,insidePassAttempts:0,outsidePassAttempts:0,blockedFor:0,startDelay:sampleStartDelay(p.startRisk,kind==='standard'?1:seed,id),last600StartTime:null,passOpponentIdx:null,outsideHoldUntil:0,outsideHoldMax:0,failedPassOpponentIdx:null,failedPassRetryDistance:0,raceFlow:kind==='standard'?null:runnerFlow(seed,id,kind),raceProfile:p}});
 let minGap=Infinity,near=0,lastLead=-1,leadChanges=0,invalid=0,outer=0,at400=null,at150=null,early=null,lateChanges=0;
 for(let k=0;k<Math.ceil(D/8*60)+3600&&raceFinished.length<18;k++){
  stepOfficialPair(1/60);if(k%12)continue;
  let leader=raceHorses.reduce((a,b)=>a.distance>b.distance?a:b);
  if(leader.distance>150&&leader.distance<D){if(lastLead!==-1&&lastLead!==leader.idx){leadChanges++;if(leader.distance>D-400)lateChanges++}lastLead=leader.idx;if(at150===null)at150=leader.raceProfile.identity+1;if(leader.distance>D-400&&at400===null)at400=leader.raceProfile.identity+1}
  if(leader.distance>=300&&!early)early=raceHorses.slice().sort((a,b)=>b.distance-a.distance).map(h=>[h.raceProfile.identity+1,h.role,+h.distance.toFixed(1)]);
  for(let i=0;i<18;i++){const a=raceHorses[i];if(!Number.isFinite(a.distance+a.lane+a.speed+a.energy))invalid++;if(a.finished)continue;
   const w=fieldCenterAt(activePlan,a.distance).width;if(a.lane<-w/2+1.47||a.lane>w/2-2.79)outer++;
   for(let j=i+1;j<18;j++){const b=raceHorses[j];if(b.finished)continue;const d=Math.hypot(a.distance-b.distance,a.lane-b.lane);minGap=Math.min(minGap,d);if(d<1)near++;}
  }
 }
 const order=raceHorses.slice().sort((a,b)=>a.finishTime-b.finishTime),winner=order[0],focus=order.findIndex(h=>h.raceProfile.identity===0)+1,focusHorse=order[focus-1];
 return {D,kind,seed,rotation,scenario,finished:raceFinished.length,winner:winner.raceProfile.identity+1,gate:winner.number,role:winner.role,time:+winner.finishTime.toFixed(3),rank0:focus,time0:+focusHorse.finishTime.toFixed(3),order:order.map(h=>h.raceProfile.identity+1).join(','),minGap:+minGap.toFixed(3),near,leadChanges,lateChanges,invalid,outer,at400,at150,early,passes:raceHorses.reduce((n,h)=>n+h.passAttempts,0),margin:+(order[1].finishTime-winner.finishTime).toFixed(3),energy:order.map(h=>[h.raceProfile.identity+1,+h.energy.toFixed(2)]),intrinsic:raceHorses.map(h=>[h.raceProfile.early,h.raceProfile.endurance,h.raceProfile.accel,h.raceProfile.finishStrength])};
}`)();}

export {build};
