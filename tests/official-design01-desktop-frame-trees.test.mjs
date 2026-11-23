import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function extract(name){
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}\n',start);
 assert.ok(start>=0&&end>start,'Function not found '+name);
 return html.slice(start,end+2);
}
const frameIndex=runInNewContext('('+extract('officialFrameIndex')+')',{});
const paletteCode=html.match(/const RACE_FRAME_COLORS=\[[\s\S]*?\];/)?.[0];
const palette=runInNewContext('(()=>{'+paletteCode+'return RACE_FRAME_COLORS})()',{});

test('JRA 18-runner allocation and white-black-red-blue-yellow-green-orange-pink colours',()=>{
 assert.equal(palette.length,8);
 assert.deepEqual(Array.from(palette,x=>x.name),['白','黒','赤','青','黄','緑','橙','桃']);
 const actual=Array.from({length:18},(_,i)=>frameIndex(i+1)+1);
 assert.deepEqual(actual,[1,1,2,2,3,3,4,4,5,5,6,6,7,7,7,8,8,8]);
});

test('original detailed GLB skeleton and gait remain untouched, cloth numbers added separately',()=>{
 const loader=extract('initializeOfficialPair');
 const cloth=extract('addOfficialFrameCloth');
 assert.match(loader,/const model=cloneSkeleton\(source\)/);
 assert.match(loader,/if\(isOfficialEighteenTest\)\{\s*tintOriginalHelmetAndCloth\(model,i\+1\);\s*addOfficialFrameCloth\(group,i\+1,originalFrameBounds\);\s*\}/);
 assert.match(loader,/const originalFrameBounds=isOfficialEighteenTest\?/);
 assert.match(loader,/new THREE\.Box3\(\)\.setFromObject\(source\)/);
 assert.match(cloth,/group\.add\(outsidePanels\)/);
 assert.match(cloth,/new THREE\.PlaneGeometry\(panelLength,panelHeight\)/);
 assert.match(cloth,/frame_colour_back_strip/);
 assert.doesNotMatch(cloth,/model\.material\s*=/);
 assert.doesNotMatch(loader,/model\.material\s*=/);
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
});

test('all 18 numbers are unique and the enlarged cloth covers the old #4 while following the animated spine',()=>{
 const shown=[];
 class V{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 }
 class Group{
  constructor(){
   this.children=[];this.userData={};this.position={set(...xyz){this.xyz=xyz}};
   this.rotation={};
  }
  add(item){this.children.push(item);item.parent=this}
  updateMatrixWorld(){}
 }
 class Mesh extends Group{
  constructor(geometry,material){super();this.geometry=geometry;this.material=material}
 }
 class Geo{constructor(...args){this.args=args}}
 class Material{constructor(args){this.options=args}}
 const THREE={
  Vector3:V,Group,Mesh,PlaneGeometry:Geo,BoxGeometry:Geo,
  MeshBasicMaterial:Material,DoubleSide:2,SRGBColorSpace:'srgb',
  CanvasTexture:class{constructor(canvas){this.canvas=canvas}},
  MathUtils:{clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}
 };
 const document={createElement:()=>{
  const ctx={
   fillRect(){},strokeRect(){},
   fillText(number){shown.push(number)}
  };
  return {width:0,height:0,getContext:()=>ctx};
 }};
 const f=runInNewContext('('+extract('addOfficialFrameCloth')+')',{
  THREE,document,RACE_FRAME_COLORS:palette,officialFrameIndex:frameIndex,console
 });
 const bounds={
  min:{x:-.311066,y:-.663072,z:-.95027},
  getSize(v){v.x=.621427;v.y=1.326283;v.z=1.900130;return v}
 };
 const models=[];
 for(let i=1;i<=18;i++){
  const spine={attached:null,attach(obj){this.attached=obj;obj.parent=this}};
  const model={getObjectByName:name=>name==='spine_02'?spine:null};
  const group=new Group();group.add(model);
  const cloth=f(group,i,bounds);
  models.push({cloth,spine});
  assert.equal(cloth.userData.horseNumber,i);
  assert.equal(cloth.userData.attachedBone,'spine_02');
  assert.equal(spine.attached,cloth);
  const panels=cloth.children.filter(x=>x.name.startsWith('frame_'));
  assert.equal(panels.length,2);
  for(const panel of panels){
   assert.ok(panel.name.endsWith('_number_'+i));
   const [length,height]=panel.geometry.args;
   const [x,y,z]=panel.position.xyz;
   assert.ok(Math.abs(x)>.311066,'Panel must be outside source GLB surface');
   assert.ok(y-height/2<=-.23&&y+height/2>=.18,'Original #4 vertical region covered');
   assert.ok(z-length/2<=-.49&&z+length/2>=.065,'Original #4 horizontal region covered');
  }
 }
 assert.deepEqual(shown,Array.from({length:18},(_,i)=>String(i+1)));
 assert.equal(models.length,18);
});

test('race scene includes three tree silhouettes with 36 instanced trees of each type',()=>{
 assert.match(html,/const RACE_TREE_TYPES=\[/);
 const src=html.match(/const RACE_TREE_TYPES=\[[\s\S]*?\];/)?.[0];
 const items=runInNewContext('(()=>{'+src+'return RACE_TREE_TYPES})()',{});
 assert.deepEqual(Array.from(items,x=>x.name),['広葉樹','針葉樹','高木']);
 assert.deepEqual(Array.from(items,x=>x.shape),['round','pine','tall']);
 assert.match(html,/const perType=36/);
 assert.match(html,/const segment=i%RACE_TREE_SITES.length/);
 assert.match(html,/const outside=34\+\(\(i\+type\*3\)%5\)\*6/);
 assert.match(html,/MEASURE_OFFSET-renderedTurfWidthAt\(station\)-outside/);
 assert.match(html,/raceForest\.name='Design01_18_ThreeTreeSpecies'/);
 assert.match(html,/trunks\.visible=false;crowns\.visible=false;caps\.visible=false/);
 assert.match(html,/scene\.add\(raceForest\)/);
 assert.match(html,/const lower=new THREE\.InstancedMesh\(lowerGeo,leafMat,perType\)/);
 assert.match(html,/const upper=new THREE\.InstancedMesh\(upperGeo,leafMat,perType\)/);
});

test('tree placements favor turns and back straight, not home straight or the start rail',()=>{
 const code=html.match(/const RACE_TREE_SITES=\[[\s\S]*?\];/)?.[0];
 const siteList=runInNewContext('(()=>{'+code+'return RACE_TREE_SITES})()',{
  STRAIGHT:560,BACK_START:1009,BACK_END:1551,LAP:2083.1
 });
 assert.equal(siteList.length,3);
 assert.ok(siteList.every(([start,end])=>start>=675&&end<2050&&end>start));
 assert.ok(siteList[0][1]<1009);
 assert.ok(siteList[1][0]>1009&&siteList[1][1]<1551);
 assert.ok(siteList[2][0]>1551);
});

test('only 2x and 4x are exposed; selected speed toggles back to normal 1x',()=>{
 const rate=html.match(/<select id="rate">([\s\S]*?)<\/select>/)?.[1];
 assert.ok(rate);
 assert.deepEqual([...rate.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),['1','2','4']);
 const buttons=[2,4].map(value=>({
  dataset:{raceSpeed:String(value)},attrs:{},chosen:false,
  classList:{toggle(){}},setAttribute(name,value){this.attrs[name]=value}
 }));
 const selector={value:'1'};
 const toolbar={querySelectorAll:()=>buttons};
 const setter=runInNewContext('('+extract('setRacePlaybackSpeed')+')',{
  rate:selector,raceSpeedButtons:toolbar
 });
 setter(2);assert.equal(selector.value,'2');assert.equal(buttons[0].attrs['aria-pressed'],'true');
 setter(4);assert.equal(selector.value,'4');assert.equal(buttons[1].attrs['aria-pressed'],'true');
 setter(1);assert.equal(selector.value,'1');assert.ok(buttons.every(b=>b.attrs['aria-pressed']==='false'));
 setter(8);assert.equal(selector.value,'1','No unsupported speed option');
 assert.match(html,/Number\(rate\.value\)===requested\?1:requested/);
});

test('Mac mouse gestures and shortcuts are separate from the approved iPhone controls',()=>{
 assert.match(html,/event\.pointerType==='mouse'&&event\.button!==0&&/);
 assert.match(html,/event\.button===2\|\|event\.shiftKey/);
 assert.match(html,/event\.pointerType==='mouse'&&\(previous\.pan\|\|event\.shiftKey\)/);
 assert.match(html,/addEventListener\('wheel',event=>/);
 assert.match(html,/camera18\.zoom\*Math\.exp\(event\.deltaY\*\.0013\)/);
 assert.match(html,/addEventListener\('contextmenu',event=>event\.preventDefault\(\)\)/);
 assert.match(html,/window\.addEventListener\('keydown',event=>/);
 assert.match(html,/key===' '/);
 assert.match(html,/key==='1'/);
 assert.match(html,/key==='4'/);
 assert.match(html,/key==='r'/);
 assert.match(html,/key==='arrowleft'/);
 assert.match(html,/event\.metaKey\|\|event\.ctrlKey/);
});

test('race desktop toolbar and speed controls preserve the construction UI and past camera controls',()=>{
 assert.match(html,/#raceSpeedButtons\[hidden\],#legacyRateLabel\[hidden\]\{display:none!important\}/);
 assert.match(html,/@media\(min-width:820px\)/);
 assert.match(html,/if\(isOfficialEighteenTest\)\{\s*raceSpeedButtons\.hidden=false/);
 assert.match(html,/document\.querySelector\('#legacyRateLabel'\)\.hidden=true/);
 assert.match(html,/const racingCameraViews=new Set\(\['broadcast','side','front3q','chase','field'\]\)/);
 assert.match(html,/id="cam18Extras"/);
 assert.match(html,/id="stageStartBtn"/);
});
