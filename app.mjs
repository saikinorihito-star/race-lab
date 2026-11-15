import {exampleHorses, runRace, summarizeRaces, validateHorses, STYLES} from './engine.mjs';
import {getHorseAppearance,getFrameNumber} from './appearance.mjs';
import {renderFrame,interpolateRaceFrame} from './visual.mjs';
import {coursePoint,lengthAtMetres,HALF_LAP_LENGTH,INSIDE_MARGIN,LANE_WIDTH,TRACK_OUTER_OFFSET,raceDisplayPositions,getTurfProfile,turfDistances,courseSlope,courseHeightMetres,HOME_STRAIGHT_METRES,furlongMarkerPositions,raceCoursePoint,startPocket,raceCourseHeightMetres,raceCourseSlope} from './course.mjs';
const $ = (id) => document.getElementById(id);
const STORE = 'race-lab-demo-v01';
const DEFAULTS = {horses:exampleHorses(),count:18,distance:2400,venue:'tokyo',layout:'outer',course:'A',scenario:'normal'};
const validVenue=value=>value==='kyoto'?'kyoto':'tokyo';
const validLayout=(value,venue)=>venue==='kyoto'&&value==='inner'?'inner':'outer';
const validDistance=(value,venue='tokyo',layout='outer')=>{
 const list=turfDistances(venue,layout),n=Number(value);
 return list.includes(n)?n:(venue==='kyoto'?(layout==='inner'?1600:1600):2400);
};
const validCourse=value=>['A','B','C','D'].includes(value)?value:'A';
function restore() {
  try {
    const data=JSON.parse(localStorage.getItem(STORE));
    if(!data || data.horses?.length!==18)return structuredClone(DEFAULTS);
    const venue=validVenue(data.venue),layout=validLayout(data.layout,venue);
    return {horses:data.horses,count:Number.isInteger(data.count)&&data.count>=2&&data.count<=18?data.count:18,
      distance:validDistance(data.distance,venue,layout),venue,layout,course:validCourse(data.course),scenario:data.scenario||'normal'};
  } catch {return structuredClone(DEFAULTS);}
}
const saved=restore();
const state={...saved,selected:1,race:null,stats:null,playing:false,recording:false,view:'top',currentT:0,speed:4,lastTick:null,worker:null,seed:20261115};
const canvas=$('race-canvas');
let threeView=null;
function activeHorses(){return [...state.horses].sort((a,b)=>a.id-b.id).slice(0,state.count);}
const picker=$('horse-picker');
function persist(){try {localStorage.setItem(STORE,JSON.stringify({horses:state.horses,count:state.count,distance:state.distance,venue:state.venue,layout:state.layout,course:state.course,scenario:state.scenario}));}catch{setStatus('保存できません。端末のブラウザー設定を確認してください。',true)}}
function setStatus(text,error=false){$('status').textContent=text;$('status').style.color=error?'#ffc2a3':'#9baec4';}
// Race broadcast HUD: live course overview above the image, all horses below.
const HUD_SVG_NS='http://www.w3.org/2000/svg';
const hudMarkers=new Map(),hudEntries=new Map();
let hudReady=false,hudLastPaint=0,hudRankKey='';
let hudCameraDot=null,hudCameraSight=null;
let elevationKey='',elevationPointer=null,elevationPointerDot=null;
function hudSvg(tag,attrs={}){
 const el=document.createElementNS(HUD_SVG_NS,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 return el;
}
function hudPoint(p){
 return {x:450+p.x*1.55,y:112+p.z*.86};
}
function hudXY(s,offset){
 return hudPoint(coursePoint(s,offset,state.course,state.venue,state.layout));
}
function hudPath(offset,reverse=false){
 const parts=[];
 for(let i=0;i<=192;i++){
  const j=reverse?192-i:i;
  const p=hudXY(j*getTurfProfile(state.venue,state.course,state.layout).lap/192,offset);
  parts.push((i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1));
 }
 return parts.join(' ');
}
// Rebuild only when venue, layout, rail or distance changes.
// The horizontal scale covers the entire selected RACE distance, so longer
// events show their repeated lap profiles rather than just the last lap.
function buildElevationProfile(){
 const key=[state.venue,state.layout,state.course,state.distance].join(':');
 if(elevationKey===key&&elevationPointer&&elevationPointerDot)return;
 elevationKey=key;
 const svg=$('elevation-chart');svg.replaceChildren();
 const p=getTurfProfile(state.venue,state.course,state.layout);
 const left=58,right=850,top=25,bottom=111;
 const height=Math.max(.1,p.elevation);
 const fraction=remaining=>Math.max(0,Math.min(1,1-remaining/state.distance));
 const x=remaining=>left+(right-left)*fraction(remaining);
 const y=remaining=>bottom-7-(raceCourseHeightMetres(remaining,state.distance,state.venue,state.layout,state.course)/height)*69;
 svg.append(hudSvg('rect',{x:0,y:0,width:900,height:154,fill:'#0c2225'}));
 for(const [value,line] of [[0,bottom-7],[height,bottom-76]]){
  svg.append(hudSvg('line',{x1:left,y1:line,x2:right,y2:line,
   stroke:'#527369','stroke-width':1,'stroke-dasharray':'4 6','opacity':'.68'}));
  const label=hudSvg('text',{x:left-7,y:line+4,fill:'#b8d3c5','font-size':12,
   'text-anchor':'end'});
  label.textContent=value===0?'0m':value.toFixed(1)+'m';svg.append(label);
 }
 const points=[];
 for(let i=0;i<=240;i++){
  const remaining=state.distance*(1-i/240);
  points.push([x(remaining),y(remaining)]);
 }
 const path=points.map(([px,py],i)=>(i===0?'M':'L')+
     px.toFixed(2)+' '+py.toFixed(2)).join(' ');
 svg.append(hudSvg('path',{d:path+' L'+right+' '+bottom+' L'+left+' '+bottom+' Z',
   fill:'#21674e','fill-opacity':'.58'}));
 svg.append(hudSvg('path',{d:path,fill:'none',stroke:'#8af1c9',
   'stroke-width':3.4,'stroke-linecap':'round','stroke-linejoin':'round'}));
 for(const remaining of [600,400,200]){
  if(remaining>state.distance)continue;
  const at=x(remaining);
  svg.append(hudSvg('line',{x1:at,y1:24,x2:at,y2:bottom,
    stroke:'#efc96e','stroke-opacity':'.42','stroke-dasharray':'3 4'}));
  const label=hudSvg('text',{x:at,y:18,fill:'#e4d093','font-size':12,
    'text-anchor':'middle','font-weight':800});
  label.textContent=String(remaining/100);svg.append(label);
 }
 for(const [at,labelText,anchorText] of [[left,'スタート','start'],[right,'ゴール','end']]){
  const label=hudSvg('text',{x:at,y:137,fill:'#dbece3','font-size':14,
   'font-weight':750,'text-anchor':anchorText});
  label.textContent=labelText;svg.append(label);
 }
 elevationPointer=hudSvg('line',{x1:left,y1:20,x2:left,y2:bottom,
  stroke:'#f8d579','stroke-width':2.5,'stroke-dasharray':'5 3'});
 elevationPointerDot=hudSvg('circle',{cx:left,cy:y(state.distance),r:7,
  fill:'#f8d579',stroke:'#122421','stroke-width':2});
 svg.append(elevationPointer,elevationPointerDot);
}
function updateElevationProgress(leader,distance){
 buildElevationProfile();
 const remaining=Math.max(0,Math.min(distance,distance-leader));
 const x=58+792*(1-remaining/distance);
 const p=getTurfProfile(state.venue,state.course,state.layout);
 const elevation=raceCourseHeightMetres(remaining,distance,state.venue,state.layout,state.course);
 const grade=raceCourseSlope(remaining,distance,state.venue,state.layout,state.course);
 const slopeLabel=grade>.001?'↗ 上り':grade<-.001?'↘ 下り':'→ 平坦';
 const y=104-69*(elevation/Math.max(.1,p.elevation));
 elevationPointer.setAttribute('x1',x.toFixed(2));
 elevationPointer.setAttribute('x2',x.toFixed(2));
 elevationPointerDot.setAttribute('cx',x.toFixed(2));
 elevationPointerDot.setAttribute('cy',y.toFixed(2));
 $('elevation-current').textContent=state.race
   ?'残り'+Math.ceil(remaining).toLocaleString('ja-JP')+'m / '+slopeLabel+' / 高さ'+elevation.toFixed(1)+'m'
   :'スタート地点';
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
 // Draw the separate start extension before the field joins the oval.
 const pocket=startPocket(state.venue,state.layout,state.distance);
 if(pocket){
  const rim=[];
  const opposite=[];
  for(let i=0;i<=36;i++){
   const t=i/36,s=-state.distance+(state.distance-pocket.joinRemaining)*t;
   rim.push(hudPoint(raceCoursePoint(s,0,state.distance,state.course,state.venue,state.layout)));
   opposite.push(hudPoint(raceCoursePoint(s,TRACK_OUTER_OFFSET,state.distance,state.course,state.venue,state.layout)));
  }
  const commands=rim.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')+
    opposite.reverse().map(p=>' L'+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')+' Z';
  svg.append(hudSvg('path',{d:commands,fill:'#568f70','fill-opacity':'.82',
    stroke:'#c2e0d0','stroke-width':2,'stroke-dasharray':'5 4'}));
 }
 // For Kyoto, show the alternate 3rd/4th bend as a thin reference track.
 if(state.venue==='kyoto'){
   const alternative=state.layout==='inner'?'outer':'inner';
   const other=getTurfProfile('kyoto',state.course,alternative);
   const points=[];
   for(let i=0;i<=64;i++){
     const s=1090+(other.lap-other.straight-1090)*i/64;
     points.push(hudPoint(coursePoint(s,0,state.course,'kyoto',alternative)));
   }
   svg.append(hudSvg('path',{
     d:points.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '),
     fill:'none',stroke:'#a5c2ce','stroke-width':2.5,
     'stroke-dasharray':'6 6','stroke-opacity':'.78'
   }));
 }
 for(const item of [[-state.distance,'START'],[0,'GOAL']]){
  const a=hudPoint(raceCoursePoint(item[0],0,state.distance,state.course,state.venue,state.layout)),
        b=hudPoint(raceCoursePoint(item[0],TRACK_OUTER_OFFSET,state.distance,state.course,state.venue,state.layout));
  svg.append(hudSvg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
   stroke:'#f6f4d4','stroke-width':4}));
  const text=hudSvg('text',{x:a.x,y:a.y-10,fill:'#f4f9f4',
   'font-size':15,'font-weight':700,'text-anchor':'middle'});
  text.textContent=item[1];svg.append(text);
 }
 // Place the identical JRA-style furlong marker coordinates on the race map.
 for(const marker of furlongMarkerPositions(state.course,state.venue,state.layout)){
   const q=hudPoint(marker.point);
   svg.append(hudSvg('circle',{
     cx:q.x,cy:q.y,r:9,fill:'#fffdf2',stroke:'#cf2932','stroke-width':2
   }));
   const digit=hudSvg('text',{
     x:q.x,y:q.y+3.7,'text-anchor':'middle','font-size':12,
     'font-weight':900,fill:'#d32231'
   });
   digit.textContent=marker.number;svg.append(digit);
 }
 const note=hudSvg('text',{x:23,y:36,fill:'#c9e9d6','font-size':20,'font-weight':800});
 note.textContent=`馬群位置 / ${state.venue==='kyoto'?'京都芝・右回り':'東京芝・左回り'}`;svg.append(note);
 // Show the precise 3D camera location and the direction it faces.
 hudCameraSight=hudSvg('line',{stroke:'#ffd276','stroke-width':3,
  'stroke-dasharray':'6 4','stroke-linecap':'round','pointer-events':'none'});
 hudCameraDot=hudSvg('circle',{r:9,fill:'#ffd276',stroke:'#102a23',
  'stroke-width':3,'pointer-events':'none'});
 svg.append(hudCameraSight,hudCameraDot);
 for(const horse of activeHorses()){
  const a=getHorseAppearance(horse.id,state.count);
  const group=hudSvg('g');
  group.append(hudSvg('circle',{r:8,fill:a.helmet,stroke:'#fff','stroke-width':1.5}));
  const text=hudSvg('text',{y:3.4,fill:a.helmetNumberColor,
   'font-size':9.5,'font-weight':900,'text-anchor':'middle'});
  text.textContent=String(horse.id);group.append(text);
  svg.append(group);hudMarkers.set(horse.id,group);
 }
 const grid=$('race-standings-list');
 for(let i=0;i<2;i++){
  const col=document.createElement('div');col.className='race-standings-column';grid.append(col);
 }
 for(const horse of activeHorses()){
  const a=getHorseAppearance(horse.id,state.count);
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
  :{horses:activeHorses().map(h=>({id:h.id,x:0,lane:h.id-1}))};
 const distance=state.race?.distance||state.distance;
 const leader=Math.max(...frame.horses.map(h=>h.x));
 const leadS=lengthAtMetres(leader,distance);
 const ranked=[...frame.horses].sort((a,b)=>state.race
  ?b.x-a.x||a.id-b.id:a.id-b.id);
 const remaining=Math.max(0,Math.ceil(distance-leader));
 $('overview-remaining').textContent=state.race
  ?remaining===0?'ゴール'
    :state.venue==='tokyo'&&remaining<=460&&remaining>=300?'残り '+remaining.toLocaleString()+'m・上り坂'
    :state.venue==='kyoto'&&raceCourseSlope(remaining,distance,state.venue,state.layout,state.course)>.0001?'残り '+remaining.toLocaleString()+'m・3コーナー上り'
    :state.venue==='kyoto'&&raceCourseSlope(remaining,distance,state.venue,state.layout,state.course)<-.0001?'残り '+remaining.toLocaleString()+'m・4コーナー下り'
    :remaining<=getTurfProfile(state.venue,state.course,state.layout).straight?'残り '+remaining.toLocaleString()+'m・直線'
    :'残り '+remaining.toLocaleString()+'m'
  :'スタート前';
 $('standings-heading').textContent=state.race
  ?state.currentT>=state.race.elapsed?'最終着順':'現在順位・馬名'
  :'出走馬一覧（馬番順）';

 // Exactly the same collision-safe display positions as the 3D renderer.
 // Do not artificially spread, clamp or stretch the horse markers.
 const placement=raceDisplayPositions(state.race,frame,distance,state.course,state.venue,state.layout);
 const cameraView=state.view==='three'&&threeView?.getViewState
   ?threeView.getViewState():null;
 const shown=new Set(cameraView?.visibleIds||[]);
 if(cameraView){
   const a=hudPoint(cameraView.camera),b=hudPoint(cameraView.target);
   hudCameraSight.setAttribute('x1',a.x.toFixed(2));
   hudCameraSight.setAttribute('y1',a.y.toFixed(2));
   hudCameraSight.setAttribute('x2',b.x.toFixed(2));
   hudCameraSight.setAttribute('y2',b.y.toFixed(2));
   hudCameraDot.setAttribute('cx',a.x.toFixed(2));
   hudCameraDot.setAttribute('cy',a.y.toFixed(2));
   hudCameraSight.setAttribute('visibility','visible');
   hudCameraDot.setAttribute('visibility','visible');
 }else{
   hudCameraSight.setAttribute('visibility','hidden');
   hudCameraDot.setAttribute('visibility','hidden');
 }
 // Paint back-runners first, so the leading horses are visible above their pack.
 for(const h of [...ranked].reverse()){
  const point=placement.get(h.id).point;
  const xy=hudPoint(point);
  const dot=hudMarkers.get(h.id);
  dot.setAttribute('transform','translate('+xy.x.toFixed(2)+' '+xy.y.toFixed(2)+')');
  dot.setAttribute('opacity',cameraView&&!shown.has(h.id)?'.40':'1');
  dot.setAttribute('aria-label',h.id+'番 '+(state.horses.find(v=>v.id===h.id)?.name||''));
  $('overview-map').append(dot);
 }
 // Keep the yellow camera marker above overlapping horse dots.
 if(cameraView)$('overview-map').append(hudCameraDot);
 $('overview-legend').textContent=cameraView
   ?'黄色＝3Dカメラ　明るい点＝映像内　薄い点＝映像外'
   :'点は馬の実位置（映像は別の視点）';
 const nameKey=activeHorses().map(h=>h.id+':'+h.name).join('|');
 const rankKey=(state.race?'race:':'before:')+ranked.map(h=>h.id).join(',')+'|'+nameKey;
 if(rankKey===hudRankKey)return;
 hudRankKey=rankKey;
 const columns=$('race-standings-list').children;
 for(const [i,h] of ranked.entries()){
  const entry=hudEntries.get(h.id);
  entry.place.textContent=String(i+1);
  entry.name.textContent=state.horses.find(item=>item.id===h.id)?.name||'馬番'+h.id;
  entry.row.classList.toggle('leader',!!state.race&&i<3);
  columns[i<Math.ceil(state.count/2)?0:1].append(entry.row);
 }
}

function updateCourseInfo(){
 const p=getTurfProfile(state.venue,state.course,state.layout);
 const place=state.venue==='kyoto'?'京都芝':'東京芝';
 const courseLabel=state.venue==='kyoto'?(state.layout==='inner'?'内回り':'外回り'):'左回り';
 const pocket=startPocket(state.venue,state.layout,state.distance);
 $('course-data').textContent=`${place}${state.course}・${courseLabel}｜1周 ${p.lap.toLocaleString('ja-JP')}m｜直線 ${p.straight}m｜高低差 ${p.elevation}m｜幅員 ${p.minWidth}〜${p.maxWidth}m${pocket?'｜専用発走路あり（模式）':''}`;
 $('overview-course').textContent=`${place}${state.course}・${p.turn==='right'?'右回り':'左回り'} ${state.distance.toLocaleString('ja-JP')}m`;
}
function refreshTurfControls(){
 const kyoto=state.venue==='kyoto';
 $('venue').value=state.venue;
 $('layout-field').hidden=!kyoto;
 $('course-layout').disabled=!kyoto;
 $('course-layout').value=state.layout;
 const distanceSelect=$('distance');
 const available=turfDistances(state.venue,state.layout);
 state.distance=validDistance(state.distance,state.venue,state.layout);
 distanceSelect.replaceChildren();
 for(const d of available){
   const opt=document.createElement('option');
   opt.value=String(d);opt.textContent='芝'+d.toLocaleString('ja-JP')+'m';
   distanceSelect.append(opt);
 }
 distanceSelect.value=String(state.distance);
 $('turf-course').value=state.course;
 updateCourseInfo();
}
function setColorChip(node,id){
 const a=getHorseAppearance(id,state.count);
 node.style.background=a.helmet;
 node.style.color=a.helmetNumberColor;
 node.style.border='1px solid '+(a.frame===2?'#f0f0f0':'rgba(15,22,33,.45)');
 node.title=`${a.frame}枠・${id}番`;
}
function currentHorse(){return state.horses.find(h=>h.id===state.selected)}
function resetHud(){
 hudReady=false;hudRankKey='';elevationKey='';elevationPointer=null;elevationPointerDot=null;
 hudMarkers.clear();hudEntries.clear();
 $('overview-map').replaceChildren();$('race-standings-list').replaceChildren();
 $('elevation-chart').replaceChildren();
}
function renderPicker(){
 picker.replaceChildren();
 for(const h of activeHorses()){
  const button=document.createElement('button');button.type='button';button.textContent=String(h.id);
  setColorChip(button,h.id);
  button.classList.toggle('active',h.id===state.selected);
  button.setAttribute('aria-label',`${getFrameNumber(h.id,state.count)}枠 ${h.id}番 ${h.name}`);
  button.setAttribute('aria-pressed',String(h.id===state.selected));
  button.addEventListener('click',()=>{state.selected=h.id;renderPicker();renderEditor()});
  picker.append(button);
 }
 $('field-count-label').textContent=`出走 ${state.count}頭`;
}
function renderEditor(){
 const h=currentHorse();if(!h)return;
 setColorChip($('selected-number'),h.id);$('selected-number').textContent=h.id;
 $('selected-title').textContent=`${h.name}（${getFrameNumber(h.id,state.count)}枠）`;
 const numberSelect=$('horse-number');
 numberSelect.replaceChildren();
 for(let n=1;n<=state.count;n++){
  const option=document.createElement('option');option.value=String(n);option.textContent=`${n}番`;
  numberSelect.append(option);
 }
 numberSelect.value=String(h.id);
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
function updateVideoTouchControl(){
 const button=$('race-touch-control'),prompt=$('race-touch-prompt'),hint=$('race-touch-hint');
 const finished=!!state.race&&state.currentT>=state.race.elapsed;
 const playing=state.playing;
 const action=state.recording?'録画中は操作できません':
   playing?'一時停止':!state.race?'レース開始':finished?'最初から再生':'再生';
 button.disabled=state.recording;
 button.classList.toggle('playing',playing);
 button.setAttribute('aria-label','レース映像をタップして'+action);
 prompt.textContent=state.recording?'録画中':
   playing?'Ⅱ 一時停止':!state.race?'▶ レース開始':
   finished?'↻ 最初から再生':'▶ 再生';
 hint.textContent=playing?'映像をタップで一時停止':
   !state.race?'映像をタップして開始':
   finished?'映像をタップして最初から再生':'映像をタップして再開';
}
function renderCanvas(){
 // WebGL is opt-in; preserve existing 2D views for low-power and offline use.
 if(state.view==='three' && threeView)threeView.render(state.race,activeHorses(),state.currentT,{venue:state.venue,layout:state.layout,course:state.course,distance:state.distance,replaySpeed:state.speed});
 else renderFrame(canvas,state.race,activeHorses(),state.currentT,'top',{venue:state.venue,layout:state.layout,course:state.course,distance:state.distance});
 const end=state.race?.elapsed||0;
 $('seek').value=end?String(Math.min(100,100*state.currentT/end)):'0';
 const duration=(s)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
 $('play-time').textContent=`${duration(state.currentT)} / ${duration(end)}`;
 $('canvas-label').textContent=state.race ? state.currentT>=end?'ゴール':state.playing?'再生中':'一時停止中':'スタート前';
 // The elevation marker moves every rendered frame, not only on the
 // 85ms ranking/HUD cadence: smoother at 4x and on high-refresh phones.
 const liveFrame=state.race?.frames?.length
   ?interpolateRaceFrame(state.race.frames,state.currentT):null;
 const liveLead=liveFrame?Math.max(...liveFrame.horses.map(h=>h.x)):0;
 updateElevationProgress(liveLead,state.race?.distance||state.distance);
 updateVideoTouchControl();
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
 try{state.race=runRace(activeHorses(),{distance:state.distance,venue:state.venue,layout:state.layout,course:state.course,scenario:state.scenario,seed});}
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
   worker.postMessage({horses:activeHorses(),options:{distance:state.distance,venue:state.venue,layout:state.layout,course:state.course,scenario:state.scenario,seed},attempts:1000});
   return;
  }catch{ /* file: protocol or unsupported module worker — continue on main thread */ }
 }
 fallbackStats();
}
function fallbackStats(){
 // Defer so the interface can render the new race before calculating.
 setTimeout(()=>{
  if(!state.race)return;
  try {state.stats=summarizeRaces(activeHorses(),{distance:state.distance,venue:state.venue,layout:state.layout,course:state.course,scenario:state.scenario,seed:state.seed},1000);renderStats(state.stats);setStatus('1,000回の仮想試行を集計しました。実データに基づく予測ではありません。');}
  catch(error){setStatus(error.message,true)}
 },35);
}
function changeHorseNumber(value){
 if(state.recording)return;
 const n=Number(value),horse=currentHorse();
 if(!Number.isInteger(n)||n<1||n>state.count||!horse||n===horse.id)return;
 const other=state.horses.find(h=>h.id===n);
 if(!other)return;
 const previous=horse.id;
 // Exchange numbers, not records; names and capabilities follow the horse.
 horse.id=n;other.id=previous;state.selected=n;
 persist();invalidate();renderPicker();renderEditor();
 setStatus(`馬番を${previous}番から${n}番へ変更し、変更先の馬は${previous}番にしました。`);
}
function changeHorseCount(value){
 if(state.recording)return;
 const n=Number(value);
 if(!Number.isInteger(n)||n<2||n>18||n===state.count)return;
 state.count=n;
 if(state.selected>n)state.selected=1;
 persist();resetHud();invalidate();renderPicker();renderEditor();
 setStatus(`出走頭数を${n}頭にしました。非出走馬の設定も保持されています。`);
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
$('scenario').value=state.scenario;$('horse-count').value=String(state.count);refreshTurfControls();
renderPicker();renderEditor();emptyResults();renderCanvas();
$('run').addEventListener('click',startSimulation);
$('reset-horses').addEventListener('click',()=>{
 if(state.recording)return;
 if(!confirm('保存している18頭すべての馬名・能力・馬番を初期状態に戻しますか？'))return;
 state.horses=exampleHorses();state.selected=1;persist();resetHud();invalidate();renderPicker();renderEditor();
});
$('horse-count').addEventListener('change',e=>changeHorseCount(e.target.value));
$('horse-number').addEventListener('change',e=>changeHorseNumber(e.target.value));
$('venue').addEventListener('change',e=>{
 state.venue=validVenue(e.target.value);
 state.layout='outer';refreshTurfControls();
 persist();resetHud();invalidate();
});
$('course-layout').addEventListener('change',e=>{
 state.layout=validLayout(e.target.value,state.venue);
 refreshTurfControls();persist();resetHud();invalidate();
});
$('distance').addEventListener('change',e=>{
 state.distance=validDistance(e.target.value,state.venue,state.layout);
 persist();resetHud();invalidate();updateCourseInfo();
});
$('turf-course').addEventListener('change',e=>{state.course=validCourse(e.target.value);persist();resetHud();invalidate();updateCourseInfo()});
$('scenario').addEventListener('change',e=>{state.scenario=e.target.value;persist();invalidate()});
$('horse-name').addEventListener('change',e=>updateEditedHorse('name',e.target.value));
$('horse-style').addEventListener('change',e=>updateEditedHorse('style',e.target.value));
for(const key of ['speed','stamina','kick']){
 $(`horse-${key}`).addEventListener('input',e=>{$(`${key}-value`).textContent=e.target.value;currentHorse()[key]=Number(e.target.value);$('selected-title').textContent=currentHorse().name;persist();if(state.race)invalidate();});
}
$('backup-save').addEventListener('click',()=>{
 const content=JSON.stringify({version:4,date:new Date().toISOString(),horses:state.horses,count:state.count,distance:state.distance,venue:state.venue,layout:state.layout,course:state.course,scenario:state.scenario},null,2);
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='race-lab-settings.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 setStatus('馬名・馬番・出走頭数・能力・ペース・距離のバックアップを保存しました。');
});
$('backup-load').addEventListener('click',()=>$('backup-file').click());
$('backup-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>100000)throw new Error('ファイルが大きすぎます。');
  const data=JSON.parse(await file.text());validateHorses(data.horses);
  if(data.horses.length!==18)throw new Error('バックアップには18頭分の保存データが必要です。');
  if(!Number.isFinite(Number(data.distance)))throw new Error('距離の設定が不正です。');
  if(!['normal','high','low'].includes(data.scenario))throw new Error('ペース設定が不正です。');
  if(!confirm('現在の設定をバックアップの内容で上書きしますか？'))return;
  state.horses=data.horses.map(h=>({id:h.id,name:String(h.name).slice(0,24),style:h.style,speed:Number(h.speed),stamina:Number(h.stamina),kick:Number(h.kick)}));
  state.venue=validVenue(data.venue);state.layout=validLayout(data.layout,state.venue);
  state.distance=validDistance(data.distance,state.venue,state.layout);state.course=validCourse(data.course);state.scenario=data.scenario;
  state.count=Number.isInteger(data.count)&&data.count>=2&&data.count<=18?data.count:18;
  state.selected=1;
  $('scenario').value=state.scenario;$('horse-count').value=String(state.count);refreshTurfControls();
  persist();resetHud();invalidate();renderPicker();renderEditor();updateCourseInfo();setStatus('バックアップから設定を復元しました。');
 }catch(error){setStatus(`復元に失敗しました：${error.message}`,true)}
 finally{e.target.value='';}
});
$('toggle-play').addEventListener('click',()=>{
 if(state.recording)return;
 if(!state.race){startSimulation();return;}
 setPlay(!state.playing);
});
$('race-touch-control').addEventListener('click',()=>{
 if(state.recording)return;
 if(!state.race){startSimulation();return;}
 setPlay(!state.playing);
});
$('seek').addEventListener('input',e=>{if(!state.race||state.recording)return;state.currentT=state.race.elapsed*Number(e.target.value)/100;state.lastTick=null;renderCanvas()});
$('speed').addEventListener('change',e=>state.speed=Number(e.target.value));
$('save-video').addEventListener('click',exportVideo);
// Load 3D by default; use overhead course view as the offline fallback.
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
     if(request===viewRequest){setStatus('3D表示を開始できませんでした。上空ビューで操作できます。接続とSafariを確認してください。',true);state.view='top';document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view==='top';b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});renderCanvas();}
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
