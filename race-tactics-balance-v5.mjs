// Race tactics v5. All coefficients are simulation tuning values, not measured JRA statistics.
// Registered ratings determine intrinsic ability. Race-day variation and role determine effort.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ROLES=Object.freeze({
 '逃げ':{gap:0,launch:.68,release:530,conserve:0,burst:.05},
 '先行':{gap:5,launch:.32,release:620,conserve:.06,burst:.20},
 '中団':{gap:12,launch:-.05,release:730,conserve:.14,burst:.35},
 '差し':{gap:20,launch:-.37,release:840,conserve:.23,burst:.52},
 '追込':{gap:30,launch:-.62,release:930,conserve:.30,burst:.68}
});
export function raceTacticalContext(snapshot,horses,flow){
 const active=snapshot.filter(o=>!o.finished);
 const furthest=list=>list.reduce((best,o)=>!best||o.distance>best.distance?o:best,null);
 const leader=furthest(active)||{distance:0,speed:0};
 // Hold rear-running styles relative to a genuine front runner, not
 // themselves if they happen to lead in the first few strides.
 const escape=active.filter(o=>horses[o.idx]?.raceProfile?.role==='逃げ');
 const paceGroup=active.filter(o=>['逃げ','先行'].includes(horses[o.idx]?.raceProfile?.role));
 const paceSetter=furthest(escape)||furthest(paceGroup)||leader;
 const fieldPace=horses.reduce((v,h)=>v+(h.raceProfile?.early??16),0)/Math.max(1,horses.length);
 const nEscape=horses.filter(h=>h.raceProfile?.role==='逃げ').length;
 const tempo=clamp((nEscape-2)*.22+(flow.tempo||0),-.35,.68);
 const frontContest=escape.filter(o=>leader.distance-o.distance<7).length;
 return {leader,paceSetter,fieldPace,tempo,contest:clamp((frontContest-1)/2,0,1),seed:flow.mode==='varied'?(flow.seed||1):1,varied:flow.mode==='varied'};
}
export function tacticalRaceTarget(h,profile,context,D){
 const d=h.distance,r=Math.max(0,D-d),e=h.energy??1,role=profile.role,style=ROLES[role]||ROLES['中団'];
 // Individual timing is a seeded race-day event; not an intrinsic ability
 // hidden in the horse identity. Fixed mode has no individual random offset.
 const identity=profile.identity??h.idx??0;
 const phase=context.varied?((Math.imul(identity+1,1103515245)^Math.imul(context.seed||1,2654435761))>>>0)/4294967296:.5;
 const personal=context.varied?(phase-.5)*100+(h.raceFlow?.releaseShift??0):0;
 const finishStart=clamp((style.release+personal)*Math.sqrt(D/2000)+Math.max(0,context.tempo)*130,300,D*.62);
 const release=smooth(finishStart-r,0,Math.max(140,finishStart*.68));
 const form=context.varied?(h.raceFlow?.form??0):0;
 const settle=smooth(d,15,230),opening=1-smooth(d,90,340);
 const gap=context.leader.distance-d;
 const fit=1-Math.min(1,Math.abs(D-profile.preferredDistance)/1900);
 const preferredGap=style.gap*clamp(Math.sqrt(D/2000),.8,1.35)*settle;
 const paceGap=context.paceSetter.distance-d;
 const roleControl=role==='逃げ'?clamp(gap*.060,0,.72):
  clamp((paceGap-preferredGap)*.11,-1.75,1.20);
 // Gradual positioning, no hard target rank or teleportation. Form and
 // raw speed stay relevant. At release, the positional restraint fades.
 const pacing=(style.launch*opening+roleControl*settle-style.conserve*(1-opening))*(1-release);
 const paceBias=context.tempo*(1-release)*(role==='逃げ'?1.12:role==='先行'?.85:.45);
 // The energy penalty is continuous, becoming steeper near exhaustion.
 const fatigue=(1-e)*.42+1.25*smooth(.44-e,0,.39)+1.85*smooth(.22-e,0,.20);
 const saved=smooth(e,.055,.66);
 const urgency=clamp((gap-3)*.028,0,.56)*release*saved;
 const surge=(.28+(2.20+style.burst)*saved)*release+urgency;
 const rhythm=context.varied?.10*Math.sin(d/D*Math.PI*4+phase*Math.PI*2)*smooth(d,130,360)*(1-release):0;
 return {target:profile.early+pacing+paceBias+surge+rhythm+form-fatigue+(fit-.5)*.70+(profile.courseBonus??0),closing:release,fit,energy:e};
}
export function tacticalEnergyCost({h,profile,context,snapshot,distance,physicalStep,forward,tick,composure}){
 const pace=forward/tick,effort=clamp((pace-13.7)/3.3,0,1.9);
 const load=Math.sqrt(distance/1800),progress=h.distance/distance;
 const drafting=snapshot.some(o=>o.idx!==h.idx&&!o.finished&&o.distance-h.distance>2.5&&o.distance-h.distance<14&&Math.abs(o.lane-h.lane)<2.0);
 const exposed=h.distance>75&&context.leader.distance-h.distance<6;
 const hardPace=clamp((pace-context.fieldPace+.2)/1.3,0,1);
 const burden=1+(exposed?(.18+.27*hardPace+.36*context.contest+.25*Math.max(0,context.tempo))*(1-.40*progress):0)-(drafting?.18:0);
 // Extra distance and higher speed both consume energy. Slow early phases
 // leave actual reserves, rather than awarding an unconditional late boost.
 const distanceFit=1-Math.min(1,Math.abs(distance-profile.preferredDistance)/1900);
 const fitLoad=1+.10*(1-distanceFit);
 const stamina=Math.max(.60,profile.endurance);
 return physicalStep/Math.max(1,distance)*(.24+.48*effort*effort)*load/stamina*composure*burden*fitLoad*(h.raceFlow?.efficiency??1);
}
