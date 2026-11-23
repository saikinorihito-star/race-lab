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

test('18頭中継には馬名・馬番バッジ・SVG接続線がある',()=>{
 assert.ok(html.includes('<div id="runnerLabelLayer" hidden aria-hidden="true"><svg id="runnerGuideLines"'));
 assert.ok(html.includes('.runner-horse-badge[data-selected="true"]'));
 assert.ok(html.includes('function drawRunnerGuidePath('));
 assert.ok(html.includes('runner.group.localToWorld(new THREE.Vector3(0,1.05,0))'));
 assert.ok(html.includes('const model=cloneSkeleton(source)'));
 assert.ok(html.includes('.official18 #broadcastCameraLabel,.official18 #help{display:none!important'));
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

function guideHarness(){
 const projected=[-.7,-.2,.3,.8,-.5,...Array(12).fill(2),.9];
 const style=()=>({setProperty(){}});
 const labels=Array.from({length:3},()=>({
  hidden:true,style:style(),dataset:{},
  runnerParts:{
   place:{textContent:''},
   number:{textContent:'',getBoundingClientRect:()=>({left:312,top:12,width:18,height:18})},
   name:{textContent:''}
  }
 }));
 const badges=Array.from({length:3},()=>({hidden:true,style:style(),dataset:{},textContent:''}));
 const guides=Array.from({length:3},()=>({group:{style:{}},outline:{setAttribute(){}},line:{setAttribute(){}}}));
 const ctx={
  isOfficialEighteenTest:true,installedDesign01:true,view:'broadcast',
  activePlan:{distance:1400},watchSelectedHorseIndex:null,
  lastBroadcastShotId:'back-lead',lastRunnerLabelPaint:-1,
  stage:{clientWidth:400,clientHeight:500,getBoundingClientRect:()=>({left:0,top:0})},
  camera:{updateMatrixWorld(){}},
  THREE:{Vector3:class {
   constructor(x,y,z){this.x=x;this.y=y;this.z=z}
   project(){return this}
  }},
  officialPair:Array.from({length:18},(_,i)=>({group:{
   visible:true,updateWorldMatrix(){},
   localToWorld(v){v.x=projected[i];v.y=0;v.z=0;return v}
  }})),
  rankedOfficialRunners:()=>Array.from({length:18},(_,index)=>({
   index,number:index+1,name:'試験馬'+(index+1)
  })),
  runnerNameLabels:labels,runnerHorseBadges:badges,runnerGuidePaths:guides,
  runnerGuideLines:{setAttribute(){}},
  RACE_FRAME_COLORS:[{name:'白',hex:'#fff',ink:'#111'}],
  officialFrameIndex:()=>0,
  clearRunnerNameLabels(){
   for(const label of labels)label.hidden=true;
   for(const badge of badges)badge.hidden=true;
   for(const guide of guides)guide.group.style.display='none';
  },
  drawRunnerGuidePath(guide,sx,sy,ex,ey,color){
   guide.group.style.display='';guide.coords={sx,sy,ex,ey,color}
  }
 };
 const update=runInNewContext('('+extract('updateRunnerNameLabels')+')',ctx);
 const active=()=>labels.filter(x=>!x.hidden).map(x=>x.runnerParts.number.textContent);
 return {ctx,labels,badges,guides,projected,update,active};
}
test('先頭・3番手・全景で表示頭数を変更し、手動カメラでは非表示',()=>{
 const h=guideHarness();
 h.update(1000);assert.deepEqual(h.active(),['1','2','3']);
 h.ctx.lastBroadcastShotId='back-third';
 h.update(1100);assert.deepEqual(h.active(),['3','4','5']);
 h.ctx.lastBroadcastShotId='back-wide';
 h.update(1200);assert.equal(h.active().length,2);
 h.ctx.view='side';h.update(1300);assert.equal(h.active().length,0);
});
test('一覧で選んだ馬を優先して同じ馬体に接続し、重なった別の馬番を隠す',()=>{
 const h=guideHarness();
 h.ctx.watchSelectedHorseIndex=17;
 h.projected[17]=h.projected[0];h.update(1000);
 assert.equal(h.active()[0],'18');
 assert.ok(!h.active().includes('1'));
 assert.equal(h.labels[0].runnerParts.place.textContent,'18位');
 assert.equal(h.labels[0].dataset.selected,'true');
 assert.equal(h.badges[0].textContent,'18');
 assert.ok(Math.abs(h.guides[0].coords.ex-60)<1e-8);
});
test('選択馬が画面外なら実際に映る上位馬へフォールバック',()=>{
 const h=guideHarness();
 h.ctx.watchSelectedHorseIndex=17;
 h.projected[17]=3;
 h.update(1000);assert.deepEqual(h.active(),['1','2','3']);
});
test('馬名タップの再解除とキーボード操作が残っている',()=>{
 assert.ok(html.includes('watchSelectedHorseIndex=watchSelectedHorseIndex===i?null:i'));
 assert.ok(html.includes("item.addEventListener('keydown',event=>"));
 assert.ok(html.includes('label.dataset.selected=badge.dataset.selected'));
});

test('中継の5画角と接続線の毎フレーム更新が保持される',()=>{
 const body=extract('officialBroadcastCameraShot');
 for(const name of ['lead','third','horseEye','side','wide'])
  assert.ok(body.includes("focusType==='"+name+"'"),name);
 assert.ok(body.includes("broadcastShotId:stageShot.id+'-'+focusType"));
 assert.ok(html.includes('updateRunnerNameLabels(time)'));
});
