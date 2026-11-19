import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
function block(name){
 const p=html.indexOf('function '+name+'('),e=html.indexOf('\n}\n',p);
 assert.ok(p>=0&&e>p,'Missing function '+name);
 return html.slice(p,e+2);
}
const widthSource=html.match(/function widthAt\(s\)\{[^\n]*\}/)?.[0];
assert.ok(widthSource);
const widthAt=runInNewContext('('+widthSource+')',{LAP:2083.1});
const rendered=flag=>runInNewContext('('+block('renderedTurfWidthAt')+')',{
 widthAt,isOfficialEighteenTest:flag,EIGHTEEN_OUTER_TURF_EXTRA:9
});
const lane=runInNewContext('('+block('eighteenStartLane')+')',{
 PAIR_LANE_SPACING:3.35,FOUR_RAIL_CENTER_CLEARANCE:2.8,
 fourHorseInnerLane:width=>width/2-2.8
});

test('18-horse visible turf and outer rail extend 9m, preserving original racing width',()=>{
 for(const at of [0,120,525.9,975,1400,1900,2083.1]){
  assert.ok(Math.abs(rendered(true)(at)-widthAt(at)-9)<1e-8);
  assert.ok(Math.abs(rendered(false)(at)-widthAt(at))<1e-8);
 }
 assert.match(html,/const EIGHTEEN_OUTER_TURF_EXTRA=9\.0/);
 assert.match(html,/s=>offsetAt\(s,MEASURE_OFFSET-renderedTurfWidthAt\(s\),\.065\)/);
 assert.match(block('createRail'),/MEASURE_OFFSET-renderedTurfWidthAt\(s\)/);
 assert.match(html,/borderBand\(s=>MEASURE_OFFSET-renderedTurfWidthAt\(s\)-3/);
 assert.match(html,/slopedGround\(s=>offsetAt\(s,MEASURE_OFFSET-renderedTurfWidthAt\(s\)-3/);
});

test('18 original Design01 horses are centered exactly in their numbered starting gate stalls',()=>{
 const gate=block('drawFieldGate');
 assert.match(gate,/eighteenStartLane\(a\.width,0\)-eighteenStartLane\(a\.width,1\)/);
 assert.match(gate,/eighteenStartLane\(a\.width,FIELD_COUNT-1\)/);
 for(const w of [24,28,31,36,41,...[1400,1600,1800,2000,2300,2400,2500,2600,3400]
 .map(d=>widthAt((525.9-d+4166.2)%2083.1))]){
  const pitch=lane(w,0)-lane(w,1),center=(lane(w,0)+lane(w,17))/2;
  for(let i=0;i<18;i++)
   assert.ok(Math.abs(center+(8.5-i)*pitch-lane(w,i))<1e-7,
    'Gate does not match horse '+(i+1)+' for width '+w);
  assert.ok(w/2+lane(w,17)+9>10,'Wider outside clearance');
 }
});

test('real starting gate is shown in 18 mode, doors open and the far-away gate is culled',()=>{
 assert.match(html,/gateRoot\.visible=fieldMode\.value!=='single'&&\s*\(!isOfficialPairTest\|\|isOfficialEighteenTest\)/);
 assert.match(html,/if\(isOfficialEighteenTest\)gateRoot\.visible=travel<105/);
 assert.match(html,/drawFieldGate\(activePlan\)/);
 assert.match(html,/gateOpening=travel>0\?Math\.min\(1,gateOpening\+dt\*4\):0/);
 assert.match(block('updateGateDoors'),/door\.rotation\.y=side\*gateOpening\*1\.17/);
 assert.match(block('resetDemo'),/if\(isOfficialEighteenTest\)gateRoot\.visible=true/);
 assert.match(html,/travel=0;gateOpening=0;initRaceHorses\(\);updateGateDoors\(\);positionFieldHorses\(\);\s*if\(isOfficialEighteenTest\)gateRoot\.visible=true/);
});

test('18-mode stabilized rendering cannot reallocate canvas after fluctuating FPS',()=>{
 assert.match(html,/高精細・固定（18頭推奨）/);
 assert.match(html,/let auto18Dpr=1\.35,auto18ObservedFps=0/);
 assert.match(html,/renderQuality\.value==='auto'\?1\.35/);
 const monitor=block('autoTune18HorseResolution');
 assert.match(monitor,/auto18ObservedFps=fps/);
 assert.doesNotMatch(monitor,/renderer\.setPixelRatio\s*\(/);
 assert.doesNotMatch(monitor,/renderer\.setSize\s*\(/);
 assert.match(block('resize'),/w===lastStageWidth&&h===lastStageHeight/);
 assert.match(html,/renderQuality\.value==='auto'\?auto18Dpr/);
});

test('previously approved modes and Design01 original rig remain used',()=>{
 assert.match(html,/official-meshy-blue-ribbon-original-geometry-gallop-v2-20261119/);
 assert.match(html,/const OFFICIAL_TEST_COUNT=isOfficialEighteenTest\?18:isOfficialEightTest\?8:isOfficialFourTest\?4:2/);
 assert.match(html,/const EIGHTEEN_SPACING_FROM=300/);
 assert.match(html,/function officialEighteenCameraShot/);
});
