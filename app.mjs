import {exampleHorses, runRace, summarizeRaces, validateHorses, STYLES} from './engine.mjs';
import {getHorseAppearance,getFrameNumber} from './appearance.mjs';
import {renderFrame,interpolateRaceFrame} from './visual.mjs';
import {coursePoint,lengthAtMetres,HALF_LAP_LENGTH,INSIDE_MARGIN,LANE_WIDTH,TRACK_OUTER_OFFSET} from './course.mjs';
const $ = (id) => document.getElementById(id);
const STORE = 'race-lab-demo-v01';
const DEFAULTS = {horses:exampleHorses(), distance:2200, scenario:'normal'};
function restore() {
  try {
    const data=JSON.parse(localStorage.getItem(STORE));
    if(!data || data.horses?.length!==18)return structuredClone(DEFAULTS);
    return {horses:data.horses,distance:data.distance||2200,scenario:data.scenario||'normal'};
  } catch {return structuredClone(DEFAULTS);}
}
const saved=restore();
const state={...saved,selected:1,race:null,stats:null,playing:false,recording:false,view:'chase',currentT:0,speed:8,lastTick:null,worker:null,seed:20261115};
const canvas=$('race-canvas');
let threeView=null;
const picker=$('horse-picker');
function persist(){try {localStorage.setItem(STORE,JSON.stringify({horses:state.horses,distance:state.distance,scenario:state.scenario}));}catch{setStatus('保存できません。端末のブラウザー設定を確認してください。',true)}}
function setStatus(text,error=false){$('status').textContent=text;$('status').style.color=error?'#ffc2a3':'#9baec4';}
// Race broadcast HUD: live course overview above the image, all horses below.
const HUD_SVG_NS='http://www.w3.org/2000/svg';
const hudMarkers=new Map(),hudEntries=new Map();
let hudReady=false,hudLastPaint=0,hudRankKey='';
function hudSvg(tag,attrs={}){
 const el=document.createElementNS(HUD_SVG_NS,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 return el;
}
function hudXY(s,offset){
 const p=coursePoint(s,offset);
 return {x:164+(p.x+48)*4.52,y:112-p.z*1.75};
}
function hudPath(offset,reverse=false){
 const parts=[];
 for(let i=0;i<=96;i++){
  const j=reverse?96-i:i;
  const p=hudXY(j*HALF_LAP_LENGTH/96,offset);
  parts.push((i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1));
 }
 return parts.join(' ');
}
function initializeHud(){
 if(hudReady)return;
 const svg=$('overview-map');
 svg.append(hudSvg('rect',{width:900,height:226,fill:'#08191b'}));
 svg.append(hudSvg('path',{
  d:hudPath(0)+' '+hudPath(TRACK_OUTER_OFFSET,true).replace(/^M/,'L')+' Z',
  fill:'#387b4d'}));
 for(const offset of [2.4,5.3,8.2,11.1]){
  svg.append(hudSvg('path',{d:hudPath(offset),fill:'none',
   stroke:'#80b77e','stroke-opacity':'.32','stroke-width':3}));
 }
 for(const offset of [0,TRACK_OUTER_OFFSET]){
  svg.append(hudSvg('path',{d:hudPath(offset),fill:'none',
   stroke:'#e4efe4','stroke-width':3.6}));
 }
 for(const item of [[0,'START'],[HALF_LAP_LENGTH,'GOAL']]){
  const a=hudXY(item[0],0),b=hudXY(item[0],TRACK_OUTER_OFFSET);
  svg.append(hudSvg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
   stroke:'#f6f4d4','stroke-width':4}));
  const text=hudSvg('text',{x:a.x,y:a.y-10,fill:'#f4f9f4',
   'font-size':15,'font-weight':700,'text-anchor':'middle'});
  text.textContent=item[1];svg.append(text);
 }
 const note=hudSvg('text',{x:23,y:36,fill:'#c9e9d6','font-size':20,'font-weight':800});
 note.textContent='馬群位置  /  左回り';svg.append(note);
 for(const horse of state.horses){
  const a=getHorseAppearance(horse.id);
  const group=hudSvg('g');
  group.append(hudSvg('circle',{r:15,fill:a.helmet,stroke:'#fff','stroke-width':2.4}));
  const text=hudSvg('text',{y:5,fill:a.helmetNumberColor,
   'font-size':16,'font-weight':900,'text-anchor':'middle'});
  text.textContent=String(horse.id);group.append(text);
  svg.append(group);hudMarkers.set(horse.id,group);
 }
 const grid=$('race-standings-list');
 for(let i=0;i<2;i++){
  const col=document.createElement('div');col.className='race-standings-column';grid.append(col);
 }
 for(const horse of state.horses){
  const a=getHorseAppearance(horse.id);
  const row=document.createElement('div');row.className='race-entry';
  const place=document.createElement('span');place.className='race-place';
  const chip=document.createElement('span');chip.className='race-frame-chip';
  chip.style.background=a.helmet;chip.style.color=a.helmetNumberColor;
  chip.textContent=String(horse.id);
  const name=document.createElement('span');name.className='race-horse-name';
  name.textContent=horse.name;
  row.append(place,chip,name);
  hudEntries.set(horse.id,{row,place,name});
 }
 hudReady=true;
}
function updateRaceHud(){
 const now=performance.now();
 if(state.playing&&now-hudLastPaint<85)return;
 hudLastPaint=now;
 initializeHud();
 const frame=state.race?.frames?.length
  ?interpolateRaceFrame(state.race.frames,state.currentT)
  :{horses:state.horses.map(h=>({id:h.id,x:0,lane:(h.id-1)%6}))};
 const distance=state.race?.distance||state.distance;
 const leader=Math.max(...frame.horses.map(h=>h.x));
 const leadS=lengthAtMetres(leader,distance);
 const ranked=[...frame.horses].sort((a,b)=>state.race
  ?b.x-a.x||a.id-b.id:a.id-b.id);
 const remaining=Math.max(0,Math.ceil(distance-leader));
 $('overview-remaining').textContent=state.race
  ?remaining===0?'ゴール':'残り '+remaining.toLocaleString()+'m':'スタート前';
 $('standings-heading').textContent=state.race
  ?state.currentT>=state.race.elapsed?'最終着順':'現在順位・馬名'
  :'出走馬一覧（馬番順）';

 // Spread overlapping symbols for legibility; the order below remains exact.
 const occupied=[];
 for(const h of ranked){
  const offset=INSIDE_MARGIN+h.lane*LANE_WIDTH;
  const s=state.race?leadS-Math.max(0,leader-h.x)*1.17:-(Math.floor((h.id-1)/6))*6;
  const point=hudXY(s,offset);
  let x=point.x,y=point.y;
  for(let attempt=0;attempt<24;attempt++){
   if(!occupied.some(p=>Math.hypot(p.x-x,p.y-y)<30))break;
   x-=13;y+=(h.id+attempt)%2===0?7:-7;
  }
  x=Math.max(22,Math.min(876,x));y=Math.max(18,Math.min(209,y));
  occupied.push({x,y});
  const dot=hudMarkers.get(h.id);
  dot.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+')');
  const horse=state.horses.find(item=>item.id===h.id);
  dot.setAttribute('aria-label',h.id+'番 '+(horse?.name||''));
 }
 const nameKey=state.horses.map(h=>h.id+':'+h.name).join('|');
 const rankKey=(state.race?'race:':'before:')+ranked.map(h=>h.id).join(',')+'|'+nameKey;
 if(rankKey===hudRankKey)return;
 hudRankKey=rankKey;
 const columns=$('race-standings-list').children;
 for(const [i,h] of ranked.entries()){
  const entry=hudEntries.get(h.id);
  entry.place.textContent=String(i+1);
  entry.name.textContent=state.horses.find(item=>item.id===h.id)?.name||'馬番'+h.id;
  entry.row.classList.toggle('leader',!!state.race&&i<3);
  columns[i<9?0:1].append(entry.row);
 }
}

function setColorChip(node,id){
 const a=getHorseAppearance(id);
 node.style.background=a.helmet;
 node.style.color=a.helmetNumberColor;
 node.style.border='1px solid '+(a.frame===2?'#f0f0f0':'rgba(15,22,33,.45)');
 node.title=`${a.frame}枠・${id}番`;
}
function currentHorse(){return state.horses.find(h=>h.id===state.selected)}
function renderPicker(){
 picker.replaceChildren();
 for(const h of state.horses){
  const button=document.createElement('button');button.type='button';button.textContent=String(h.id);
  setColorChip(button,h.id);
  button.classList.toggle('active',h.id===state.selected);
  button.setAttribute('aria-label',`${getFrameNumber(h.id)}枠 ${h.id}番 ${h.name}`);
  button.setAttribute('aria-pressed',String(h.id===state.selected));
  button.addEventListener('click',()=>{state.selected=h.id;renderPicker();renderEditor()});
  picker.append(button);
 }
}
function renderEditor(){
 const h=currentHorse();setColorChip($('selected-number'),h.id);$('selected-number').textContent=h.id;
 $('selected-title').textContent=`${h.name}（${getFrameNumber(h.id)}枠）`;
 $('horse-name').value=h.name;
 $('horse-style').value=h.style;
 for(const k of ['speed','stamina','kick']){$(`horse-${k}`).value=h[k];$(`${k}-value`).textContent=h[k]}
}
function emptyResults(){
 $('summary').innerHTML='<div class="empty-state">設定した能力に基づき、1,000回の仮想レースを集計すると結果が表示されます。</div>';
 $('results').querySelector('tbody').innerHTML='<tr><td colspan="4" class="empty-row">まだ計算されていません</td></tr>';
}
function invalidate(){
 if(state.worker){state.worker.terminate();state.worker=null;}
 state.playing=false;state.race=null;state.stats=null;state.currentT=0;state.lastTick=null;
 $('toggle-play').textContent='▶';$('toggle-play').setAttribute('aria-label','再生');
 emptyResults();renderCanvas();setStatus('設定を変更しました。開始ボタンを押すと新しい条件で計算します。');
}
function renderStats(stats){
 const top=stats.slice(0,3), summary=$('summary');summary.replaceChildren();
 for(let i=0;i<top.length;i++){
  const card=document.createElement('div');card.className='score-card';
  const caption=document.createElement('small');caption.textContent=`推定勝率 ${i+1}位`;
  const rate=document.createElement('strong');rate.textContent=`${top[i].winRate.toFixed(1)}%`;
  const name=document.createElement('span');name.textContent=`${top[i].id}番 ${top[i].name}`;
  card.append(caption,rate,name);summary.append(card);
 }
 const body=$('results').querySelector('tbody');body.replaceChildren();
 for(const r of stats){
  const tr=document.createElement('tr');
  const horseCell=document.createElement('td');
  const num=document.createElement('span');num.className='num';num.textContent=r.id;setColorChip(num,r.id);
  const name=document.createElement('span');name.className='name';name.textContent=r.name;
  horseCell.append(num,name);
  const win=document.createElement('td');
  const value=document.createElement('div');value.textContent=`${r.winRate.toFixed(1)}%`;
  const track=document.createElement('div');track.className='bar-track';const fill=document.createElement('div');fill.className='bar-fill';fill.style.width=`${r.winRate}%`;track.append(fill);win.append(value,track);
  const place=document.createElement('td');place.textContent=`${r.placeRate.toFixed(1)}%`;
  const avg=document.createElement('td');avg.textContent=r.avgRank.toFixed(2);
  tr.append(horseCell,win,place,avg);body.append(tr);
 }
}
function renderCanvas(){
 // WebGL is opt-in; preserve existing 2D views for low-power and offline use.
 if(state.view==='three' && threeView)threeView.render(state.race,state.horses,state.currentT);
 else renderFrame(canvas,state.race,state.horses,state.currentT,state.view==='top'?'top':'chase');
 const end=state.race?.elapsed||0;
 $('seek').value=end?String(Math.min(100,100*state.currentT/end)):'0';
 const duration=(s)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
 $('play-time').textContent=`${duration(state.currentT)} / ${duration(end)}`;
 $('canvas-label').textContent=state.race ? state.currentT>=end?'ゴール':state.playing?'再生中':'一時停止中':'スタート前';
 updateRaceHud();
}
function setPlay(on){
 if(!state.race || state.recording)return;
 if(on && state.currentT>=state.race.elapsed)state.currentT=0;
 state.playing=on;state.lastTick=null;
 $('toggle-play').textContent=on?'Ⅱ':'▶';$('toggle-play').setAttribute('aria-label',on?'一時停止':'再生');
 renderCanvas();
}
function animate(ts){
 if(state.playing && state.race && !state.recording){
  if(state.lastTick!==null)state.currentT+=Math.min((ts-state.lastTick)/1000,.1)*state.speed;
  state.lastTick=ts;
  if(state.currentT>=state.race.elapsed){state.currentT=state.race.elapsed;setPlay(false)}
  renderCanvas();
 }
 requestAnimationFrame(animate);
}
function startSimulation(){
 if(state.recording)return;
 const seed=(Date.now()>>>0);
 state.seed=seed;
 try{state.race=runRace(state.horses,{distance:state.distance,scenario:state.scenario,seed});}
 catch(error){setStatus(error.message,true);return;}
 state.stats=null;state.currentT=0;state.playing=false;state.lastTick=null;
 emptyResults();setPlay(true);
 setStatus('1レースを生成しました。1,000回の仮想試行を集計中…');
 if(state.worker){state.worker.terminate();state.worker=null;}
 if(typeof Worker!=='undefined'){
  try{
   const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});state.worker=worker;
   worker.onmessage=ev=>{
    if(state.worker!==worker)return;
    if(ev.data.type==='progress')setStatus(`仮想試行を集計中… ${ev.data.done.toLocaleString()}/${ev.data.total.toLocaleString()}回`);
    if(ev.data.type==='error'){setStatus(ev.data.message,true);worker.terminate();state.worker=null;}
    if(ev.data.type==='result'){state.stats=ev.data.stats;renderStats(state.stats);setStatus('1,000回の試行を集計しました。数値は実データで検証されていない架空モデルの推定値です。');worker.terminate();state.worker=null;}
   };
   worker.onerror=()=>{if(state.worker===worker){worker.terminate();state.worker=null;fallbackStats();}};
   worker.postMessage({horses:state.horses,options:{distance:state.distance,scenario:state.scenario,seed},attempts:1000});
   return;
  }catch{ /* file: protocol or unsupported module worker — continue on main thread */ }
 }
 fallbackStats();
}
function fallbackStats(){
 // Defer so the interface can render the new race before calculating.
 setTimeout(()=>{
  if(!state.race)return;
  try {state.stats=summarizeRaces(state.horses,{distance:state.distance,scenario:state.scenario,seed:state.seed},1000);renderStats(state.stats);setStatus('1,000回の仮想試行を集計しました。実データに基づく予測ではありません。');}
  catch(error){setStatus(error.message,true)}
 },35);
}
function updateEditedHorse(property,value){
 const h=currentHorse();
 h[property]=property==='name'?String(value).trim()||`サンプル${String(h.id).padStart(2,'0')}`:
 property==='style'?value:Number(value);
 persist();invalidate();renderPicker();renderEditor();
}
async function exportVideo(){
 if(!state.race){setStatus('先にシミュレーションを開始してください。',true);return;}
 if(state.recording)return;
 const recordCanvas=state.view==='three' && threeView ? threeView.canvas : canvas;
 if(!recordCanvas.captureStream || typeof MediaRecorder==='undefined'){
  setStatus('このiPhone/ブラウザーでは直接録画に対応していません。iPhoneの「画面収録」を利用してください。',true);return;
 }
 let mime='';
 for(const m of ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm']){
  if(MediaRecorder.isTypeSupported?.(m)){mime=m;break;}
 }
 if(!mime){setStatus('対応する動画保存形式を確認できません。iPhoneの「画面収録」を利用してください。',true);return;}
 const wasPlaying=state.playing;state.playing=false;state.recording=true;
 $('save-video').disabled=true;$('run').disabled=true;$('save-video').textContent='録画中…';
 const oldTime=state.currentT;let stream=null;let recorder=null;
 try{
  state.currentT=0;renderCanvas();
  stream=recordCanvas.captureStream(24);const chunks=[];
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2200000});
  const finalized=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=e=>reject(e.error || new Error('動画の録画に失敗しました。'));
   recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));
  });
  recorder.start(200);
  const steps=288; // 12-second recap, 24fps: real render work is modest on mobile.
  for(let i=0;i<steps;i++){
   state.currentT=(i/(steps-1))*state.race.elapsed;renderCanvas();
   setStatus(`動画を生成中… ${Math.round(i/steps*100)}%（約12秒の短縮動画）`);
   await new Promise(resolve=>setTimeout(resolve,1000/24));
  }
  recorder.stop();const blob=await finalized;
  if(!blob.size)throw new Error('動画データが空でした。');
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download=`race-lab-${new Date().toISOString().slice(0,10)}.${mime.includes('mp4')?'mp4':'webm'}`;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  setStatus(`${(blob.size/1048576).toFixed(1)}MBの動画を生成しました。保存先はブラウザーのダウンロード一覧を確認してください。`);
 }catch(error){setStatus(`動画の保存に失敗しました：${error.message}。iPhoneの「画面収録」も利用できます。`,true);if(recorder?.state==='recording')recorder.stop();}
 finally{
  stream?.getTracks().forEach(track=>track.stop());
  state.recording=false;state.currentT=oldTime;state.playing=wasPlaying;state.lastTick=null;
  $('save-video').disabled=false;$('run').disabled=false;$('save-video').textContent='動画保存';renderCanvas();
 }
}
$('distance').value=String(state.distance);$('scenario').value=state.scenario;
renderPicker();renderEditor();emptyResults();renderCanvas();
$('run').addEventListener('click',startSimulation);
$('reset-horses').addEventListener('click',()=>{
 if(state.recording)return;
 if(!confirm('18頭の名前・能力を初期状態に戻しますか？'))return;
 state.horses=exampleHorses();persist();invalidate();renderPicker();renderEditor();
});
$('distance').addEventListener('change',e=>{state.distance=Number(e.target.value);persist();invalidate()});
$('scenario').addEventListener('change',e=>{state.scenario=e.target.value;persist();invalidate()});
$('horse-name').addEventListener('change',e=>updateEditedHorse('name',e.target.value));
$('horse-style').addEventListener('change',e=>updateEditedHorse('style',e.target.value));
for(const key of ['speed','stamina','kick']){
 $(`horse-${key}`).addEventListener('input',e=>{$(`${key}-value`).textContent=e.target.value;currentHorse()[key]=Number(e.target.value);$('selected-title').textContent=currentHorse().name;persist();if(state.race)invalidate();});
}
$('backup-save').addEventListener('click',()=>{
 const content=JSON.stringify({version:1,date:new Date().toISOString(),horses:state.horses,distance:state.distance,scenario:state.scenario},null,2);
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='race-lab-settings.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 setStatus('馬名・能力・ペース・距離のバックアップを保存しました。');
});
$('backup-load').addEventListener('click',()=>$('backup-file').click());
$('backup-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>100000)throw new Error('ファイルが大きすぎます。');
  const data=JSON.parse(await file.text());validateHorses(data.horses);
  if(![1200,1600,2000,2200,2400,3000].includes(Number(data.distance)))throw new Error('距離の設定が不正です。');
  if(!['normal','high','low'].includes(data.scenario))throw new Error('ペース設定が不正です。');
  if(!confirm('現在の18頭の設定を、バックアップの内容で上書きしますか？'))return;
  state.horses=data.horses.map(h=>({id:h.id,name:String(h.name).slice(0,24),style:h.style,speed:Number(h.speed),stamina:Number(h.stamina),kick:Number(h.kick)}));
  state.distance=Number(data.distance);state.scenario=data.scenario;
  $('distance').value=state.distance;$('scenario').value=state.scenario;
  persist();invalidate();renderPicker();renderEditor();setStatus('バックアップから設定を復元しました。');
 }catch(error){setStatus(`復元に失敗しました：${error.message}`,true)}
 finally{e.target.value='';}
});
$('toggle-play').addEventListener('click',()=>setPlay(!state.playing));
$('seek').addEventListener('input',e=>{if(!state.race||state.recording)return;state.currentT=state.race.elapsed*Number(e.target.value)/100;state.lastTick=null;renderCanvas()});
$('speed').addEventListener('change',e=>state.speed=Number(e.target.value));
$('save-video').addEventListener('click',exportVideo);
// Load the 3D view by default; retain the 2D chase as a safe fallback.
let viewRequest=0;
let threeLoading=null;
async function selectView(view){
 if(state.recording)return;
 const request=++viewRequest;
 if(view==='three' && !threeView){
   const btn=document.querySelector('[data-view="three"]');
   btn.disabled=true;
   const previousText=btn.textContent;
   btn.textContent='3D読込中…';
   try{
     if(!threeLoading)threeLoading=import('./three-view.mjs').then(module=>module.createThreeView($('three-host')));
     const created=await threeLoading;
     if(!threeView)threeView=created;
   }catch(error){
     threeLoading=null;
     if(request===viewRequest)setStatus('3D表示を開始できませんでした。追走ビューで操作できます。接続とSafariを確認してください。',true);
     console.error('3D view initialization failed',error);
     return;
   }finally{
     btn.disabled=false;
     btn.textContent=previousText;
   }
 }
 if(request!==viewRequest)return; // A newer view selection took precedence.
 state.view=view;
 $('three-host').hidden=view!=='three';
 document.querySelectorAll('[data-view]').forEach(btn=>{
   const selected=btn.dataset.view===view;
   btn.classList.toggle('active',selected);
   btn.setAttribute('aria-pressed',String(selected));
 });
 renderCanvas();
}
for(const btn of document.querySelectorAll('[data-view]')){
 btn.addEventListener('click',()=>{void selectView(btn.dataset.view);});
}
requestAnimationFrame(animate);
void selectView('three'); // Initial display on every app launch.
if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
