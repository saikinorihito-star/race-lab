import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function extract(name){
 const start=html.indexOf('function '+name+'(');
 const end=html.indexOf('\n}\n',start);
 assert.ok(start>=0&&end>start,'Missing function '+name);
 return html.slice(start,end+2);
}

test('中継は馬名の黒い吹き出しと三角形のしっぽで馬体を示す',()=>{
 assert.ok(html.includes('#runnerLabelLegend{position:absolute;inset:0'));
 assert.ok(html.includes('.runner-name-label{position:absolute'));
 assert.ok(html.includes('label.textContent=item.name'));
 assert.ok(html.includes('drawRunnerGuidePath(guide,position.left,position.bottom+1,x,tipY'));
 assert.ok(html.includes("guide.line.setAttribute('fill','#07141b')"));
 assert.ok(html.includes("guide.dot.setAttribute('r','0')"));
 assert.ok(html.includes('RUNNER_BUBBLE_INTERVAL_MS=3000'));
 assert.ok(html.includes("runner.headBone.getWorldPosition(new THREE.Vector3())"));
 assert.ok(!html.includes('runnerHorseBadges'));
 assert.ok(!html.includes('.runner-horse-badge'));
 assert.ok(html.includes('const model=cloneSkeleton(source)'));
});

test('馬名は既存アプリと明示的な編集の保存値を引き継ぐ',()=>{
 const saved={
  'race-lab-demo-v01':JSON.stringify({horses:[
   {id:1,name:'ミライホース'},{id:3,name:'ライバル'},{id:18,name:'ラスト'}]}),
  'race-lab-official-design01-18-runner-names-v1':JSON.stringify(['先頭候補','','編集済み'])
 };
 const load=runInNewContext('('+extract('loadOfficialRunnerNames')+')',{
  localStorage:{getItem:key=>saved[key]??null},
  RUNNER_NAMES_KEY:'race-lab-official-design01-18-runner-names-v1',console
 });
 const names=Array.from(load());
 assert.equal(names.length,18);
 assert.deepEqual([names[0],names[1],names[2],names[17]],
  ['先頭候補','試験馬2','編集済み','ラスト']);
});

test('確定順位は現在距離・到達時刻を基準とし、馬番順ではない',()=>{
 const horses=Array.from({length:18},(_,i)=>({
  distance:90-i,postDistance:0,finished:false,finishTime:null
 }));
 horses[3].distance=120;horses[8].distance=114;horses[10].distance=119;
 const positions=horses.map((h,i)=>({...h,name:'馬'+(i+1)}));
 const rank=runInNewContext('('+extract('rankedOfficialRunners')+')',{
  officialPair:Array.from({length:18},()=>({})),raceHorses:horses,
  officialPairVisualState:i=>positions[i],
  officialRunnerNames:positions.map(p=>p.name)
 });
 assert.deepEqual(Array.from(rank()).slice(0,3).map(h=>h.number),[4,11,9]);
 horses[1].finished=true;horses[1].finishTime=83.7;
 horses[6].finished=true;horses[6].finishTime=84.3;
 assert.deepEqual(Array.from(rank()).slice(0,2).map(h=>h.number),[2,7]);
});

function guideHarness(){
 const projected=[-.7,-.2,.3,.8,-.5,...Array(12).fill(2),.9];
 const labels=Array.from({length:3},()=>({
  hidden:true,textContent:'',offsetWidth:92,style:{setProperty(){}},dataset:{}
 }));
 function attrs(){return {values:{},setAttribute(key,value){this.values[key]=value}}}
 const guides=Array.from({length:3},()=>({
  group:{style:{}},outline:attrs(),line:attrs(),dot:attrs()
 }));
 const ctx={
  isOfficialEighteenTest:true,installedDesign01:true,view:'broadcast',
  activePlan:{distance:1400},watchSelectedHorseIndex:null,raceElapsed:6,
  lastBroadcastShotId:'back-lead',lastRunnerLabelPaint:-1,
  runnerBubbleShot:'',runnerBubbleLastTime:-1,runnerBubbleStep:0,
  runnerBubbleTime:0,RUNNER_BUBBLE_INTERVAL_MS:3000,playing:true,
  stage:{clientWidth:400,clientHeight:500},
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
  runnerNameLabels:labels,runnerGuidePaths:guides,
  runnerGuideLines:{setAttribute(){}},
  RACE_FRAME_COLORS:[{name:'白',hex:'#fff',ink:'#111'}],
  officialFrameIndex:()=>0
 };
 ctx.runnerProjectedBodyRect=runInNewContext('('+extract('runnerProjectedBodyRect')+')',ctx);
 ctx.clearRunnerGuidePath=runInNewContext('('+extract('clearRunnerGuidePath')+')',ctx);
 ctx.clearRunnerNameLabels=runInNewContext('('+extract('clearRunnerNameLabels')+')',ctx);
 ctx.drawRunnerGuidePath=runInNewContext('('+extract('drawRunnerGuidePath')+')',ctx);
 const update=runInNewContext('('+extract('updateRunnerNameLabels')+')',ctx);
 const active=()=>labels.filter(l=>!l.hidden).map(l=>l.textContent);
 return {ctx,labels,guides,projected,update,active};
}

test('発走前と発走から5秒未満は、選択中の馬でも吹き出しを一切出さない',()=>{
 const h=guideHarness();
 h.ctx.watchSelectedHorseIndex=17;
 h.ctx.raceElapsed=0;h.update(1000);
 assert.deepEqual(h.active(),[]);
 h.ctx.raceElapsed=4.99;h.update(1400);
 assert.deepEqual(h.active(),[]);
 h.ctx.raceElapsed=5;h.update(1700);
 assert.deepEqual(h.active(),['試験馬18','試験馬1']);
 h.ctx.raceElapsed=0;h.update(2000);
 assert.deepEqual(h.active(),[],'Race restart must remove old bubbles');
 assert.ok(h.guides.every(g=>g.group.style.display==='none'));
});
test('近くの頭上以外に吹き出しを置かず、馬の頭の骨に追従する',()=>{
 const h=guideHarness();
 let moved=false;
 h.ctx.officialPair[0].headBone={
  getWorldPosition(v){moved=true;v.x=0;v.y=0;v.z=0;return v;}
 };
 h.update(1000);
 assert.ok(moved,'The horse-specific head bone should drive the label');
 assert.ok(Math.abs(Number(h.labels[0].style.left.replace('px',''))-200)<1);
 assert.match(extract('updateRunnerNameLabels'),/for\(const rise of \[18,25,32\]\)/);
 assert.match(extract('updateRunnerNameLabels'),/for\(const offset of \[0,-9,9\]\)/);
 assert.match(extract('updateRunnerNameLabels'),/Math\.hypot\(position\.left-x,tipY-position\.bottom\)>26/);
});
test('中継では1頭ずつ順位順に切り替え、広角では2頭ずつ切り替える',()=>{
 const h=guideHarness();
 h.update(1000);
 assert.deepEqual(h.active(),['試験馬1']);
 for(let t=1100;t<=4100;t+=100)h.update(t);
 assert.deepEqual(h.active(),['試験馬2']);
 for(let t=4200;t<=7200;t+=100)h.update(t);
 assert.deepEqual(h.active(),['試験馬3']);
 h.ctx.lastBroadcastShotId='back-wide';
 h.update(7300);
 assert.deepEqual(h.active(),['試験馬1','試験馬2']);
 for(let t=7400;t<=10700;t+=100)h.update(t);
 assert.deepEqual(h.active(),['試験馬3','試験馬4']);
 h.ctx.view='side';h.update(10800);
 assert.equal(h.active().length,0);
 assert.ok(h.guides.every(g=>g.group.style.display==='none'));
});
test('選択した馬を常時優先し、他の馬名だけ順位順に切り替える',()=>{
 const h=guideHarness();
 h.ctx.watchSelectedHorseIndex=17;h.update(1000);
 assert.deepEqual(h.active(),['試験馬18','試験馬1']);
 for(let t=1100;t<=4100;t+=100)h.update(t);
 assert.deepEqual(h.active(),['試験馬18','試験馬2']);
 // The user may pause to inspect a named horse; do not rotate while paused.
 h.ctx.playing=false;
 for(let t=4200;t<=7000;t+=100)h.update(t);
 assert.deepEqual(h.active(),['試験馬18','試験馬2']);
 h.ctx.playing=true;
 for(let t=7100;t<=10100;t+=100)h.update(t);
 assert.deepEqual(h.active(),['試験馬18','試験馬3']);
});
test('選択した18番を優先、密集時は違う馬と取り違えず、実順位も保つ',()=>{
 const h=guideHarness();
 h.ctx.watchSelectedHorseIndex=17;
 h.projected[17]=h.projected[0];
 h.update(1000);
 assert.equal(h.active()[0],'試験馬18');
 assert.ok(!h.active().includes('試験馬1'));
 assert.equal(h.labels[0].dataset.rank,'18');
 assert.equal(h.labels[0].dataset.selected,'true');
 assert.ok(Number(h.labels[0].style.top.replace('px',''))<250,'Horse name is above its torso');
 assert.ok(h.guides[0].line.values.d.includes('60.0 243.0'));
 assert.equal(h.guides[0].dot.values.r,'0');
 assert.equal(h.guides[0].group.style.display,'');
});

test('同じ画面位置で2頭が重なる場合は次の見える馬の吹き出しに切り替える',()=>{
 const h=guideHarness();
 h.projected[1]=h.projected[0];
 h.ctx.lastBroadcastShotId='back-wide';
 h.update(1000);
 assert.deepEqual(h.active(),['試験馬1','試験馬3']);
 assert.equal(h.guides.filter(g=>g.group.style.display!=='none').length,2);
});
test('画面外の選択馬を示す偽の吹き出しを出さず、画面内の馬に戻す',()=>{
 const h=guideHarness();
 h.ctx.watchSelectedHorseIndex=17;
 h.projected[17]=3;
 h.update(1000);
 assert.deepEqual(h.active(),['試験馬1']);
 assert.equal(h.guides.filter(g=>g.group.style.display!=='none').length,1);
});

test('吹き出しの候補領域が馬体と重なる場合は、その馬名表示を抑制する',()=>{
 const h=guideHarness();
 // Simulate a tightly packed TV shot covering all bubble candidate positions.
 h.ctx.runnerProjectedBodyRect=()=>({
  left:0,right:400,top:100,bottom:240
 });
 h.update(1000);
 assert.deepEqual(h.active(),[],'No label should obscure a real horse');
 assert.ok(h.guides.every(g=>g.group.style.display==='none'));
});
test('吹き出しは頭上に離れ、三角しっぽも馬体に入らない',()=>{
 const h=guideHarness();
 h.update(1000);
 assert.deepEqual(h.active(),['試験馬1']);
 const label=h.labels[0];
 const bottom=Number(label.style.top.replace('px',''));
 assert.ok(bottom<=232,'Text must remain close to its head anchor');
 const tail=h.guides[0].line.values.d;
 assert.ok(tail.includes('60.0 243.0'),'Short balloon tail stays directly above its horse');
});
function rosterHarness(){
 const horses=Array.from({length:18},(_,i)=>({
  idx:i,number:i+1,distance:18-i,postDistance:0,finished:false,finishTime:null
 }));
 horses[8].distance=99;horses[17].distance=100;
 const rows=Array.from({length:18},()=>({
  item:{style:{order:''},classList:{toggle(){}},title:''},
  name:{textContent:''},rank:{textContent:''}
 }));
 const elements=Object.fromEntries(['#watchCourse','#watchRemain','#watchRosterStatus']
  .map(key=>[key,{textContent:''}]));
 const ctx={
  isOfficialEighteenTest:true,activePlan:{distance:1400},
  document:{body:{classList:{contains:()=>true}},
   querySelector:key=>elements[key]},
  lastWatchPaint:-Infinity,raceHorses:horses,watchRows:rows,
  officialRunnerNames:Array.from({length:18},(_,i)=>'登録馬'+(i+1)),
  raceFinished:[],activeDistance:1400,watchSelectedHorseIndex:null,
  paintWatchOverview(){},paintWatchSlope(){}
 };
 const render=runInNewContext('('+extract('renderRaceWatchUI')+')',ctx);
 return {horses,rows,ctx,render};
}
test('18頭一覧は現在順位順、着順確定後も順位順。馬名と馬番は元の馬に対応',()=>{
 assert.ok(html.includes('if(r.item.style.order!==String(rank))r.item.style.order=String(rank)'));
 assert.ok(html.includes('item.append(rank,frame,name)'));
 const h=rosterHarness();h.render(1000,true);
 assert.equal(h.rows[17].item.style.order,'1');
 assert.equal(h.rows[8].item.style.order,'2');
 assert.equal(h.rows[0].item.style.order,'3');
 assert.equal(h.rows[17].name.textContent,'登録馬18');
 assert.equal(h.rows[17].rank.textContent,'1位');
 h.horses[8].finished=true;h.horses[8].finishTime=95;
 h.horses[17].finished=true;h.horses[17].finishTime=97;
 h.render(1200,true);
 assert.equal(h.rows[8].item.style.order,'1');
 assert.equal(h.rows[17].item.style.order,'2');
 assert.equal(h.rows[8].rank.textContent,'1位');
});

test('選択クリックは順位による並び替え後も元の馬IDを使う',()=>{
 assert.ok(html.includes('watchSelectedHorseIndex=watchSelectedHorseIndex===i?null:i'));
 assert.ok(html.includes("item.addEventListener('keydown',event=>"));
 assert.ok(html.includes('r.item.classList.toggle'));
});

test('JRA風中継のカメラとモデルには手を加えない',()=>{
 const cam=extract('officialBroadcastCameraShot');
 for(const type of ['lead','third','horseEye','side','wide'])
  assert.ok(cam.includes("focusType==='"+type+"'"));
 assert.ok(html.includes('updateRunnerNameLabels(time)'));
 assert.ok(html.includes('const model=cloneSkeleton(source)'));
});
