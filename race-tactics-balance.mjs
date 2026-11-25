// 18-runner race tactics. Deterministic, in physical m/s and metres.
// The coefficients are simulation tuning values, not measured JRA performance data.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ROLES=Object.freeze({
 '逃げ':{gap:0,early:.22,start:480},
 '先行':{gap:3,early:.10,start:560},
 '中団':{gap:6,early:0,start:660},
 '差し':{gap:10,early:-.08,start:800},
 '追込':{gap:15,early:-.15,start:900}
});
export function raceTacticalContext(snapshot,horses,flow){
 const active=snapshot.filter(o=>!o.finished);
 const leader=active.reduce((best,o)=>o.distance>best.distance?o:best,{distance:0,speed:0});
 const fieldPace=horses.reduce((v,h)=>v+(h.raceProfile?.early??16),0)/Math.max(1,horses.length);
 const nEscape=horses.filter(h=>h.raceProfile?.role==='逃げ').length;
 const tempo=clamp((nEscape-2)*.22+(flow.tempo||0),-.35,.68);
 const frontContest=active.filter(o=>leader.distance-o.distance<6.5&&horses[o.idx]?.raceProfile?.role==='逃げ').length;
 return {leader,fieldPace,tempo,contest:clamp((frontContest-1)/2,0,1)};
}
export function tacticalRaceTarget(h,profile,context,distance){
 const D=distance,d=h.distance,r=Math.max(0,D-d),e=h.energy??1,role=profile.role,style=ROLES[role]||ROLES['中団'];
 const finishStart=clamp(style.start*Math.sqrt(D/2000)+Math.max(0,context.tempo)*150,360,D*.57);
 const release=smooth(finishStart-r,0,Math.max(150,finishStart*.65));
 const settle=smooth(d,35,240);
 const gap=context.leader.distance-d;
 // The target gap only guides settling; it never modifies physical positions.
 // A faster horse retains its own ability. A rear horse spends energy if it chases.
 const correction=clamp((gap-style.gap*settle)*.085,-.48,1.65)*(1-release)*settle;
 const fit=1-Math.min(1,Math.abs(D-profile.preferredDistance)/1900);
 const paceBias=context.tempo*(1-release)*(.62+.38*(role==='逃げ'?1:0));
 const fatigue=(1-e)*(.40+Math.max(0,1-profile.endurance)*.55)+2.05*smooth(.29-e,0,.27);
 const saved=clamp((e-.08)/.58,0,1);
 const surge=(.58+2.65*saved)*release*(.82+.24*(profile.finishStrength??1));
 return {target:profile.early+style.early*(1-settle)+paceBias+correction+surge-fatigue+(fit-.5)*.70+(profile.courseBonus??0),closing:release,fit,energy:e};
}
export function tacticalEnergyCost({h,profile,context,snapshot,distance,physicalStep,forward,tick,composure}){
 const effort=clamp((forward/tick-14.1)/2.6,0,1.8);
 const load=Math.sqrt(distance/1800);
 const progress=h.distance/distance;
 const drafting=snapshot.some(o=>o.idx!==h.idx&&!o.finished&&o.distance-h.distance>2.5&&o.distance-h.distance<14&&Math.abs(o.lane-h.lane)<2.3);
 const exposed=h.distance>90&&context.leader.distance-h.distance<6;
 const hardPace=clamp((forward/tick-context.fieldPace+.12)/1.1,0,1);
 const burden=1+(exposed?(.045+.20*hardPace+.55*context.contest+.30*Math.max(0,context.tempo))*(1-.55*progress):0)-(drafting?.12:0);
 return physicalStep/Math.max(1,distance)*(.29+.32*effort*effort)*load/Math.max(.65,profile.endurance)*composure*burden;
}
