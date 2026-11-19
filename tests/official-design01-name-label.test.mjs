import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function extract(name){
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}\n',start);
 assert.ok(start>=0&&end>start,'Missing function '+name);
 return html.slice(start,end+2);
}

test('18-runner broadcast removes the obtrusive bars without deleting technical FPS information',()=>{
 assert.match(html,/\.official18 #broadcastCameraLabel,\.official18 #help\{display:none!important\}/);
 assert.match(html,/\.official18 #telemetry\{position:static/);
 assert.match(html,/document\.querySelector\('#officialPairTools'\)\.appendChild\(info\)/);
 assert.match(html,/<div id="runnerLabelLayer" hidden aria-hidden="true"><\/div>/);
 assert.match(html,/<details id="raceNameEditor" hidden>/);
 assert.match(html,/\.runner-name-label::after\{/);
 assert.match(html,/new THREE\.WebGLRenderer/);
 assert.match(html,/const model=cloneSkeleton\(source\)/);
});

test('horse labels load names from the existing main app, with independent explicit overrides',()=>{
 const saved={
  'race-lab-demo-v01':JSON.stringify({horses:[
   {id:1,name:'ミライホース'},{id:3,name:'ライバル'},{id:18,name:'ラスト'}]}),
  'race-lab-official-design01-18-runner-names-v1':JSON.stringify(['先頭候補','','編集済み'])
 };
 const load=runInNewContext('('+extract('loadOfficialRunnerNames')+')',{
  localStorage:{getItem:key=>saved[key]??null},
  RUNNER_NAMES_KEY:'race-lab-official-design01-18-runner-names-v1',
  console
 });
 const names=Array.from(load());
 assert.equal(names.length,18);
 assert.equal(names[0],'先頭候補');
 assert.equal(names[1],'試験馬2');
 assert.equal(names[2],'編集済み');
 assert.equal(names[17],'ラスト');
 assert.ok(!html.includes("name:'レーゼドラマ'"),'No names copied from reference video');
});

test('race order uses actual interpolated metres and finish time, not model array order',()=>{
 const horses=Array.from({length:18},(_,i)=>({
  distance:90-i,postDistance:0,finished:false,finishTime:null
 }));
 horses[3].distance=120;horses[8].distance=114;horses[10].distance=119;
 const rows=horses.map((h,i)=>({...h,name:'馬'+(i+1)}));
 const getRanks=runInNewContext('('+extract('rankedOfficialRunners')+')',{
  officialPair:Array.from({length:18},()=>({})),
  raceHorses:horses,
  officialPairVisualState:i=>rows[i],
  officialRunnerNames:rows.map(x=>x.name)
 });
 let result=Array.from(getRanks());
 assert.deepEqual(result.slice(0,3).map(h=>h.number),[4,11,9]);
 horses[1].finished=true;horses[1].finishTime=83.7;
 horses[6].finished=true;horses[6].finishTime=84.3;
 result=Array.from(getRanks());
 assert.deepEqual(result.slice(0,2).map(h=>h.number),[2,7]);
});

test('horse name bubbles reveal leader then second then third and disappear between shots',()=>{
 const labels=Array.from({length:3},()=>({hidden:true,style:{},textContent:''}));
 const officialPair=Array.from({length:18},(_,i)=>({
  group:{
   visible:true,
   updateWorldMatrix(){},
   localToWorld(v){v.x=-.75+(i%3)*.65;v.y=0;v.z=0;return v}
  }
 }));
 const ranked=Array.from({length:18},(_,i)=>({index:i,name:'試験馬'+(i+1)}));
 const context={
  isOfficialEighteenTest:true,installedDesign01:true,view:'broadcast',
  activePlan:{distance:1400},officialPair,runnerNameLabels:labels,
  lastBroadcastShotId:'back-lead',broadcastLabelCutAt:0,lastRunnerLabelPaint:-1,
  rankedOfficialRunners:()=>ranked,stage:{clientWidth:400,clientHeight:500},
  camera:{updateMatrixWorld(){}},
  THREE:{Vector3:class {
   constructor(x,y,z){this.x=x;this.y=y;this.z=z}
   project(){return this}
  }},
  clearRunnerNameLabels:()=>{for(const label of labels)label.hidden=true}
 };
 const update=runInNewContext('('+extract('updateRunnerNameLabels')+')',context);
 update(1100);
 assert.equal(labels[0].hidden,false);
 assert.equal(labels[1].hidden,false);
 assert.equal(labels[2].hidden,true);
 update(1900);
 assert.equal(labels[2].hidden,false);
 assert.equal(labels[2].textContent,'試験馬3');
 assert.ok(labels[0].style.left.endsWith('px'));
 update(7300);
 assert.ok(labels.every(x=>x.hidden));
 context.lastBroadcastShotId='back-third';context.broadcastLabelCutAt=7600;
 update(9500);
 assert.equal(labels[0].textContent,'試験馬3','Third place shot labels start at the third runner');
 assert.equal(labels[1].textContent,'試験馬4');
 context.view='side';
 update(9800);
 assert.ok(labels.every(x=>x.hidden),'Manual mode is unobstructed');
});

test('new low-front camera framing keeps the reference-clip shot structure',()=>{
 const body=extract('officialBroadcastCameraShot');
 assert.match(body,/height=6\.3;ahead=28/);
 assert.match(body,/height=6\.9;ahead=24/);
 assert.match(body,/broadcastShotId:stageShot\.id\+'-'\+focusType/);
 assert.match(html,/broadcastLabelCutAt=time/);
 assert.match(html,/updateRunnerNameLabels\(time\)/);
});
