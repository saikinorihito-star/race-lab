import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function fn(name){
 const p=html.indexOf('function '+name+'('), e=html.indexOf('\n}\n',p);
 assert.ok(p>=0&&e>p,name);return html.slice(p,e+2);
}
const keys=html.match(/const HORSE_ABILITY_KEYS=\[[\s\S]*?\];/)[0];
const roles=html.match(/const HORSE_ROLE_OPTIONS=\[[^\n]+\];/)[0];
const profiles=html.match(/const EIGHTEEN_PACE_PROFILES=Array\.from\([\s\S]*?\n\}\);/)[0];
function setup(storage={}){
 const source=[
  'const THREE={MathUtils:{clamp:(x,a,b)=>Math.min(b,Math.max(a,x))}};',
  keys,roles,profiles,
  "const HORSE_ABILITIES_KEY='race-lab-design01-18-abilities-v2',HORSE_ABILITIES_LEGACY_KEY='race-lab-design01-18-abilities-v1';",
  'const localStorage={getItem:k=>storage[k]??null};',
  'const horseIdentityBySlot=Array.from({length:18},(_,i)=>i),horseAbilities=[];',
  ...['baseForRegisteredHorse','defaultHorseAbility','normalizeHorseAbility','loadHorseAbilities','defaultBalanceWeights','effectiveEighteenProfile'].map(fn),
  'const balanceWeights=defaultBalanceWeights();',
  'return {keys:HORSE_ABILITY_KEYS,defaultHorseAbility,normalizeHorseAbility,loadHorseAbilities,effectiveEighteenProfile,horseIdentityBySlot,horseAbilities};'
 ].join('\n');
 return new Function('storage',source)(storage);
}
test('10 performance abilities plus separate start risk, no independent finish field, 40 comparison runs',()=>{
 const m=setup();assert.equal(m.keys.length,10);assert.ok(!m.keys.includes('finish'));
 assert.doesNotMatch(html,/abilityFinish|balanceWeights\.finish|v\.finish\b/);
 assert.match(html,/計40走/);
 assert.equal((html.match(/id="ability\w+" type="range"/g)||[]).length,11);
});
test('v2 migration preserves retained ratings, role and preferred distance; ignores finish',()=>{
 const raw={speed:9,stamina:3,finish:10,role:'追込',preferredDistance:2400};
 const m=setup({'race-lab-design01-18-abilities-v2':JSON.stringify({version:2,horses:[raw]})});
 const a=m.loadHorseAbilities()[0];
 assert.equal(a.speed,9);assert.equal(a.stamina,3);assert.equal(a.role,'追込');
 assert.equal(a.preferredDistance,2400);assert.ok(!('finish' in a));
 assert.equal(m.normalizeHorseAbility({preferredDistance:9999},0).preferredDistance,4000);
 assert.equal(m.normalizeHorseAbility({preferredDistance:2434},0).preferredDistance,2450);
 assert.equal(m.normalizeHorseAbility({},0).preferredDistance,m.defaultHorseAbility(0).preferredDistance);
});
test('v1 migration preserves retained ratings and role',()=>{
 const m=setup({'race-lab-design01-18-abilities-v1':JSON.stringify({version:1,horses:[{speed:90,stamina:0,acceleration:70,finish:100,course:60,role:'差し'}]})});
 const a=m.loadHorseAbilities()[0];
 assert.equal(a.speed,9);assert.equal(a.stamina,1);assert.equal(a.acceleration,7);assert.equal(a.course,6);assert.equal(a.role,'差し');assert.ok(!('finish' in a));
});
test('profile follows identity, preferred distance and separately mapped acceleration and start',()=>{
 const m=setup();const a=m.defaultHorseAbility(7);
 m.horseIdentityBySlot[0]=7;m.horseAbilities[7]={...a,preferredDistance:3000,acceleration:10,start:2,stamina:10};
 const p=m.effectiveEighteenProfile(0),standard=m.effectiveEighteenProfile(0,a);
 assert.equal(p.preferredDistance,3000);assert.equal(p.accelerationAbility,10);assert.equal(p.startAbility,2);
 assert.ok(p.accel>standard.accel);assert.equal(p.baseAccel,standard.baseAccel);assert.ok(p.endurance>standard.endurance);
 assert.equal(p.finishStrength,standard.finishStrength);
});

test('start risk migrates safely and is independent of launch ability',()=>{
 const m=setup();
 assert.equal(m.defaultHorseAbility(0).startRisk,1);
 assert.equal(m.normalizeHorseAbility({start:8},0).startRisk,1);
 assert.equal(m.normalizeHorseAbility({startRisk:99,start:8},0).startRisk,10);
 assert.equal(m.normalizeHorseAbility({startRisk:3.6},0).startRisk,4);
 const a=m.normalizeHorseAbility({start:8,startRisk:7},0);
 const p=m.effectiveEighteenProfile(0,a);
 assert.equal(p.startAbility,8);assert.equal(p.startRisk,7);
});
test('seeded gate reaction is monotonic, deterministic and bounded',()=>{
 const m=new Function([fn('flowHash'),fn('startRiskProbability'),fn('sampleStartDelay'),'return {startRiskProbability,sampleStartDelay}'].join('\n'))();
 const rates=[0,.02,.04,.06,.10,.15,.22,.32,.45,.60];
 for(let level=1;level<=10;level++){
  assert.equal(m.startRiskProbability(level),rates[level-1]);
  let count=0;
  for(let seed=1;seed<=1000;seed++)for(let id=0;id<18;id++){
   const d=m.sampleStartDelay(level,seed,id);
   assert.equal(d,m.sampleStartDelay(level,seed,id));
   if(d){count++;assert.ok(d>=.25&&d<=1.5);assert.ok(Math.abs(d*60-Math.round(d*60))<1e-8);}
   if(level>1&&m.sampleStartDelay(level-1,seed,id)>0)assert.ok(d>0);
  }
  assert.ok(Math.abs(count/18000-rates[level-1])<.015);
 }
});
