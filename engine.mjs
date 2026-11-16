/**
 * Race Lab demonstration engine.
 * The model and its parameters are illustrative, NOT calibrated against real races.
 * Independent of rendering, DOM, network and external data providers.
 */
import {getTurfProfile,turfDistances,raceCourseSlope} from './course.mjs';
export const STYLES = ['逃げ', '先行', '差し', '追込'];
export const SCENARIOS = {high: 'ハイ', normal: 'ミドル', low: 'スロー'};
export const COLORS = ['#f6f7fa','#34373f','#e6575e','#4b83dd','#ecc858','#52a86d','#f18b44','#e285ae','#a5a5a5','#9c7a45','#7b70c7','#31a9b1','#bf576e','#aad85d','#427b83','#d4aa82','#6662a9','#c4c8d1'];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function exampleHorses() {
  return Array.from({length: 18}, (_, index) => {
    const id = index + 1;
    const style = index % 9 < 2 ? '逃げ' : index % 9 < 5 ? '先行' : index % 9 < 7 ? '差し' : '追込';
    return {id, name: `サンプル${String(id).padStart(2, '0')}`, style,
      speed: 66 + (id * 7) % 19, stamina: 62 + (id * 11) % 24, kick: 62 + (id * 13) % 25};
  });
}
function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6D2B79F5;
    let z = n;
    z = Math.imul(z ^ z >>> 15, z | 1);
    z ^= z + Math.imul(z ^ z >>> 7, z | 61);
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
function normal(rng) {
  return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}
export function validateHorses(horses) {
  if (!Array.isArray(horses) || horses.length < 2 || horses.length > 18) throw new Error('出走馬数は2〜18頭にしてください。');
  const ids = new Set();
  for (const h of horses) {
    if (!Number.isInteger(h.id) || h.id < 1 || h.id > 18 || ids.has(h.id)) throw new Error('馬番は1〜18の重複しない整数が必要です。');
    ids.add(h.id);
    if (!String(h.name ?? '').trim()) throw new Error(`${h.id}番の馬名が空です。`);
    if (!STYLES.includes(h.style)) throw new Error(`${h.id}番の脚質が正しくありません。`);
    for (const k of ['speed', 'stamina', 'kick']) {
      if (!Number.isFinite(Number(h[k])) || Number(h[k]) < 40 || Number(h[k]) > 100) throw new Error(`${h.id}番の${k}は40〜100にしてください。`);
    }
  }
  for(let id=1;id<=horses.length;id++)if(!ids.has(id))throw new Error('出走馬の馬番は1番から連続する番号にしてください。');
}

/** A deterministic synthetic race with traffic-aware lanes and overtakes.
 * lane=0 is the INSIDE rail; larger lanes travel farther from the rail.
 * Frame and result formats intentionally remain compatible with the existing UI.
 * This is a race-game model, NOT a trained or validated real-racing forecast.
 */
export function runRace(horses, options = {}) {
  validateHorses(horses);
  const venue=options.venue==='kyoto'?'kyoto':'tokyo';
  const layout=venue==='kyoto'&&options.layout==='inner'?'inner':'outer';
  const course=['A','B','C','D'].includes(options.course)?options.course:'A';
  const distance=Number(options.distance||2400);
  if(!turfDistances(venue,layout).includes(distance))
    throw new Error('選択した競馬場・コースで施行できる芝距離を指定してください。');
  const profile=getTurfProfile(venue,course,layout);
  const scenario=SCENARIOS[options.scenario]?options.scenario:'normal';
  const seed=(options.seed??20261115)>>>0;
  const record=options.record!==false;
  const rng=random(seed), dt=.5, limit=horses.length-1;
  const states=[...horses].sort((a,b)=>a.id-b.id).map((horse,index)=>{
    // All 18 start on one straight starting line, occupying separate lateral stalls.
    // After the break they find room to merge gradually toward the inner rail.
    const lane=index;
    return {...horse,
      x:0,
      lane, targetLane:lane, nextDecision:3.0+rng()*.5,
      form:clamp(normal(rng)*.115,-.32,.32),
      sway:rng()*Math.PI*2,
      finishTime:null, speedNow:0, overtakes:0};
  });
  const frames=[];
  const maxT=distance/12+65;
  let t=0;
  const packFrame=()=>({
    t:Number(t.toFixed(1)),
    horses:states.map(h=>({id:h.id,
      x:h.finishTime===null?h.x:distance+Math.max(0,t-h.finishTime)*13.5,
      lane:Number(h.lane.toFixed(3)),
      speed:h.speedNow,finished:h.finishTime!==null}))
  });
  if(record)frames.push(packFrame());

  // Return free-space and the nearest horse ahead in an intended corridor.
  function corridor(snapshot,me,lane) {
    let forward=Infinity,rear=Infinity,front=null;
    for(const other of snapshot){
      if(other.id===me.id||other.finished)continue;
      if(Math.abs(other.lane-lane)>.68)continue;
      const gap=other.x-me.x;
      if(gap>=0&&gap<forward){forward=gap;front=other;}
      if(gap<0&&-gap<rear)rear=-gap;
    }
    return {forward,rear,front};
  }
  for(let step=0;step<maxT/dt;step++){
    if(states.every(h=>h.finishTime!==null))break;
    const snapshot=states.map(h=>({id:h.id,x:h.x,lane:h.lane,speedNow:h.speedNow,finished:h.finishTime!==null}));
    for(const h of states){
      if(h.finishTime!==null)continue;
      const p=clamp(h.x/distance,0,1),early=clamp(1-p/.38,0,1);
      const late=clamp((p-.60)/.40,0,1);
      const styleEarly={逃げ:.51,先行:.25,差し:-.17,追込:-.36}[h.style];
      const styleLate={逃げ:-.24,先行:.08,差し:.35,追込:.53}[h.style];
      const paceEarly=scenario==='high'?.41:scenario==='low'?-.43:0;
      const paceLate=scenario==='high'?-.36:scenario==='low'?.22:0;
      const energyCost=scenario==='high'?.13:scenario==='low'?-.07:0;
      // All three editor ratings have separate, observable effects on every
      // race. Speed acts throughout, stamina sustains late pace, and kick
      // increases acceleration predominantly in the final third.
      // Coefficients are game-balancing values, not fitted to JRA results.
      const speedAbility=Number(h.speed)-70;
      const staminaAbility=Number(h.stamina)-70;
      const kickAbility=Number(h.kick)-70;
      const staminaPhase=clamp((p-.30)/.70,0,1);
      const finishPhase=clamp((p-.67)/.33,0,1);
      const finishBurst=finishPhase*finishPhase*(3-2*finishPhase);
      const staminaSupport=staminaAbility*.016*staminaPhase;
      const kickBurst=kickAbility*.030*finishBurst;
      const fatigue=late*(Math.max(0,72-Number(h.stamina))*.007+
        energyCost*(.35+Math.max(0,styleEarly)));
      const dynamic=.083*Math.sin(t/8+h.sway)+.042*Math.sin(t/3.7+h.sway*1.8);
      // At Kyoto this switches between inner and outer home-straight lengths.
      const onHomeStretch=distance-h.x<=profile.straight;
      let desiredSpeed=16.52+speedAbility*.021+h.form+
        styleEarly*early+styleLate*late+paceEarly*early+paceLate*late+
        staminaSupport+kickBurst-fatigue+dynamic;

      // Re-evaluate the racing line every ~1 second, or sooner when trapped.
      const current=corridor(snapshot,h,h.lane);
      const trapped=current.forward<6.0;
      if(t>=3 && (t>=h.nextDecision || (trapped&&t+dt>=h.nextDecision-.55))){
        const base=clamp(Math.round(h.lane),0,limit);
        const candidates=[base,base-1,base+1].filter(v=>v>=0&&v<=limit);
        let best=base,bestCost=Infinity;
        for(const target of candidates){
          const space=corridor(snapshot,h,target);
          // Penalize dangerous crossovers where a horse is alongside.
          let alongside=false;
          if(target!==base){
            const halfway=(h.lane+target)*.5;
            alongside=snapshot.some(other=>other.id!==h.id&&!other.finished&&
              Math.abs(other.x-h.x)<2.8&&
              Math.abs(other.lane-halfway)<.67);
          }
          // Strong inside preference, relieved only by imminent traffic.
          // Before the last straight, minimize traveled distance along the inner rail.
          // Allow an outer pass only if the traffic benefit outweighs a strong cost.
          const onFinalStraight=onHomeStretch;
          // A blocked fast horse must be able to seek clear running
          // instead of being held behind slower rivals by a rail bias.
          const inside=target*(onFinalStraight?.10:.70)
            +Math.max(0,target-3)*(onFinalStraight?0:.16);
          const ahead=space.forward<12?(12-space.forward)*.58:0;
          const close=space.forward<3.6?1.9:0;
          const unsafe=alongside?8:0;
          const rear=space.rear<1.8?.7:0;
          const change=Math.abs(target-h.lane)*.14;
          const hold=Math.abs(target-h.targetLane)*.05;
          const outerDetour=target>base&&!onFinalStraight?.75:0;
          const cost=inside+ahead+close+unsafe+rear+change+hold+outerDetour;
          if(cost<bestCost-1e-6 || (Math.abs(cost-bestCost)<1e-6&&target<best)){
            best=target;bestCost=cost;
          }
        }
        h.targetLane=best;
        h.nextDecision=t+1.0+rng()*.6;
      }
      // Lateral motion is bounded: no teleporting or instantaneous weaving.
      const lateral=t<3?0:clamp(h.targetLane-h.lane,-.44,.44);
      const nextLane=clamp(h.lane+lateral,0,limit);
      const halfway=(h.lane+nextLane)*.5;
      // Keep an entire horse-length buffer before entering another corridor.
      // This also prevents two horses from simultaneously cutting across each other.
      const sideCollision=snapshot.some(other=>other.id!==h.id&&!other.finished&&
        Math.abs(other.x-h.x)<6&&Math.abs(other.lane-nextLane)<1.1);
      if(!sideCollision||Math.abs(lateral)<.01)h.lane=nextLane;
      else h.targetLane=Math.round(h.lane);

      const space=corridor(snapshot,h,h.lane);
      // Drafting/traffic: an occupied corridor caps acceleration until cleared.
      if(space.front && space.forward<5){
        const limitSpeed=space.front.speedNow>10?
          space.front.speedNow+clamp((space.forward-2.25)*.35,-.50,.80):
          desiredSpeed;
        desiredSpeed=Math.min(desiredSpeed,limitSpeed);
      }
      // An outside path is slightly longer, particularly around bends.
      // The wide route costs more until the final straight, where horses can spread.
      desiredSpeed-=Math.min(10,h.lane)*(onHomeStretch?.004:.025);
      // Schematic gradient effect, NOT fitted to historic finishing times:
      // Tokyo rises in the home straight; Kyoto climbs before turn 3 and
      // descends toward turn 4. The coefficient is illustrative, not official.
      desiredSpeed-=raceCourseSlope(distance-h.x,distance,venue,layout,course)*6.0;
      // Outer starters briefly tuck behind an inside runner before cutting over.
      const breakIn=clamp(1-Math.max(0,h.x)/120,0,1);
      desiredSpeed-=h.lane*.035*breakIn;
      // An even break keeps the field side-by-side for the opening moments.
      if(t<3)desiredSpeed=16.4+speedAbility*.017;
      desiredSpeed=clamp(desiredSpeed,12.1,19.6);
      const accel=clamp(desiredSpeed-h.speedNow,-.37,.37);
      const velocity=h.speedNow>10?clamp(h.speedNow+accel,12.1,19.6):desiredSpeed;
      h.speedNow=velocity;
      const before=h.x;
      h.x+=velocity*dt;
      // Finishing times are finalized after the collision safety pass.
    }
    // Resolve longitudinal safety on the track after the simultaneous motion proposals.
    // Adjacent 1.55-m lanes are distinct; a merge is blocked unless clear.
    const prevX=new Map(snapshot.map(v=>[v.id,v.x]));
    const order=[...states.filter(h=>h.finishTime===null)].sort((a,b)=>b.x-a.x||a.id-b.id);
    for(let i=0;i<order.length;i++){
      const h=order[i],oldX=prevX.get(h.id);
      for(let j=0;j<i;j++){
        const ahead=order[j];
        const lateralMetres=Math.abs(h.lane-ahead.lane)*1.55;
        if(lateralMetres>=1.23)continue;
        const required=5.6*Math.sqrt(Math.max(0,1-(lateralMetres/1.23)**2));
        h.x=Math.min(h.x,ahead.x-required);
      }
      h.x=Math.max(oldX,h.x);
      h.speedNow=Math.max(0,(h.x-oldX)/dt);
    }
    // Crossing the finish line is evaluated only after resolving traffic.
    for(const h of states){
      if(h.finishTime!==null)continue;
      const oldX=prevX.get(h.id);
      if(h.x>=distance){
        const stepSpeed=Math.max(.01,(h.x-oldX)/dt);
        h.finishTime=t+Math.max(0,distance-oldX)/stepSpeed;
      }
    }
    t+=dt;
    if(record && (step%2===1||states.every(h=>h.finishTime!==null)))frames.push(packFrame());
  }
  if(states.some(h=>h.finishTime===null))throw new Error('計算が規定時間内に終了しませんでした。');
  const bestTime=Math.min(...states.map(h=>h.finishTime));
  const results=[...states].sort((a,b)=>a.finishTime-b.finishTime)
    .map((h,i)=>({id:h.id,name:h.name,style:h.style,rank:i+1,
      time:h.finishTime,gap:h.finishTime-bestTime}));
  return {frames,results,elapsed:t,distance,venue,layout,course,scenario,seed};
}

export function summarizeRaces(horses, opts={}, attempts=1000, onProgress=null) {
  validateHorses(horses);
  const baseSeed = (opts.seed ?? 20261115) >>> 0;
  const stats = horses.map(h=>({id:h.id,name:h.name,win:0,place:0,rankTotal:0}));
  const byId = new Map(stats.map(v => [v.id,v]));
  for (let i=0;i<attempts;i++) {
    const result = runRace(horses,{...opts, seed:(baseSeed + Math.imul(i,2654435761))>>>0, record:false});
    for (const horse of result.results) {
      const x=byId.get(horse.id);
      x.rankTotal+=horse.rank;
      if (horse.rank===1) x.win++;
      if (horse.rank<=3) x.place++;
    }
    if(onProgress && (i+1)%100===0)onProgress(i+1, attempts);
  }
  return stats.map(s=>({...s, winRate:s.win/attempts*100, placeRate:s.place/attempts*100, avgRank:s.rankTotal/attempts}))
    .sort((a,b)=>b.winRate-a.winRate || a.id-b.id);
}
