import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stable,validPayload,syncDecision,validRacePreset,validRaceArchive,makeRacePreset,saveRacePreset,restoreRacePreset,RACE_ARCHIVE_LIMIT} from '../race-cloud-sync.mjs';
const sample=()=>({version:1,library:{version:1,nextId:18,lineup:Array.from({length:18},(_,i)=>i),horses:Array.from({length:18},(_,id)=>({id,name:'馬'+id,ability:{speed:5}}))},settings:{distance:2400,weather:'sunny'}});
test('payload validates, and duplicate identities, bad lineup, bad names and oversize library are rejected',()=>{
 assert.ok(validPayload(sample()));let p=sample();p.library.horses[1].id=0;assert.ok(!validPayload(p));
 p=sample();p.library.lineup[1]=0;assert.ok(!validPayload(p));p=sample();p.library.horses[0].name='';assert.ok(!validPayload(p));
 p=sample();p.library.horses=Array.from({length:101},(_,id)=>({id,name:'馬'+id,ability:null}));assert.ok(!validPayload(p));
});
test('first device and account switches always require explicit user choice',()=>{
 const p=sample(),remote={revision:1,payload:p};
 assert.equal(syncDecision(null,'A',p,null),'setup');
 assert.equal(syncDecision(null,'A',p,remote),'setup');
 assert.equal(syncDecision({uid:'B',revision:1,base:stable(p)},'A',p,remote),'setup');
});
test('only one-sided edits sync automatically; conflicting edits never overwrite',()=>{
 const p=sample(),local=sample(),remote=sample(),b={uid:'A',revision:1,base:stable(p)};
 local.library.horses[0].name='iPhone';remote.library.horses[1].name='Mac';
 assert.equal(syncDecision(b,'A',p,{revision:1,payload:p}),'equal');
 assert.equal(syncDecision(b,'A',local,{revision:1,payload:p}),'upload');
 assert.equal(syncDecision(b,'A',p,{revision:2,payload:remote}),'download');
 assert.equal(syncDecision(b,'A',local,{revision:2,payload:remote}),'conflict');
 assert.equal(syncDecision(b,'A',local,{revision:2,payload:local}),'ack');
});
test('server JSONB key reordering does not create a change',()=>assert.equal(stable({b:1,a:{y:2,x:3}}),stable({a:{x:3,y:2},b:1})));
test('existing UI integration parses, has gate protection and backs up before receiving',()=>{
 const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../race-cloud-sync.mjs',import.meta.url),'utf8');
 const integration=html.slice(html.indexOf('// Optional cloud sync'),html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(integration));
 assert.match(integration,/!playing&&raceElapsed===0&&!balanceAuditBusy/);
 assert.match(integration,/localStorage.setItem\(RUNNER_LIBRARY_KEY/);
 assert.match(source,/localStorage.setItem\(BACKUP/);
 assert.match(source,/\.eq\('revision',remote.revision\)/);
 assert.doesNotMatch(source,/sb_secret_|service_role/);
});

const raceAbility=(speed=5)=>({speed,stamina:5,acceleration:5,course:5,distance:5,composure:5,traffic:5,going:5,hill:5,start:5,role:'先行',preferredDistance:2400});
const raceSample=()=>{
 const p=sample();p.library.horses.forEach(h=>h.ability=raceAbility());
 Object.assign(p.settings,{flowMode:'standard',flowSeed:1,going:'good'});return p;
};
const emptyArchive=()=>({version:1,races:[],activeId:null});
test('named races are independent snapshots with frame order, names, ability and race conditions',()=>{
 const p=raceSample(),a=makeRacePreset('a','ジャパンカップ',p);
 let archive=saveRacePreset(emptyArchive(),a);
 p.library.horses[0].name='別の馬';p.library.horses[0].ability.speed=10;
 p.library.lineup.reverse();p.settings.distance=1600;
 const b=makeRacePreset('b','安田記念',p);archive=saveRacePreset(archive,b);
 assert.equal(archive.races.length,2);
 assert.equal(archive.races[0].horses[0].name,'馬0');
 assert.equal(archive.races[0].horses[0].ability.speed,5);
 assert.equal(archive.races[0].conditions.distance,2400);
 assert.equal(archive.races[1].horses[17].name,'別の馬');
 assert.equal(archive.races[1].conditions.distance,1600);
 assert.equal(archive.activeId,'b');
 const next=restoreRacePreset(p.library,a);
 assert.deepEqual(next.lineup,Array.from({length:18},(_,i)=>i));
 assert.equal(next.horses.find(h=>h.id===0).name,'馬0');
 assert.equal(next.horses.find(h=>h.id===0).ability.speed,5);
 assert.equal(p.library.horses[0].name,'別の馬');
});
test('recall keeps reserve horses and restores a removed former entry without reusing IDs',()=>{
 const p=raceSample();p.library.horses.push({id:19,name:'控え',ability:raceAbility(7)});
 p.library.nextId=20;p.library.lineup[0]=19;
 const a=makeRacePreset('a','レースA',p);
 p.library.lineup[0]=0;p.library.horses=p.library.horses.filter(h=>h.id!==19);
 p.library.horses.push({id:20,name:'別の控え',ability:raceAbility(8)});p.library.nextId=21;
 const restored=restoreRacePreset(p.library,a);
 assert.equal(restored.lineup[0],19);assert.equal(restored.nextId,21);
 assert.equal(restored.horses.find(h=>h.id===20).ability.speed,8);
 assert.equal(restored.horses.find(h=>h.id===19).name,'控え');
});
test('invalid archives and accidental overwrites are rejected; old cloud payload remains valid',()=>{
 const p=raceSample(),a=makeRacePreset('a','レースA',p),archive=saveRacePreset(emptyArchive(),a);
 assert.ok(validPayload(p));p.settings.raceArchive=archive;assert.ok(validPayload(p));
 assert.throws(()=>saveRacePreset(archive,a));assert.throws(()=>saveRacePreset(archive,{...a,id:'b'},true));
 const updated=saveRacePreset(archive,{...a,name:'変更名'},true);
 assert.equal(updated.races[0].name,'変更名');assert.equal(archive.races[0].name,'レースA');
 p.settings.raceArchive={...archive,activeId:'missing'};assert.ok(!validPayload(p));
 const invalid=structuredClone(a);invalid.horses[0].ability.speed=11;assert.ok(!validRacePreset(invalid));
 assert.ok(!validRaceArchive({version:1,races:[a,a],activeId:'a'}));
});
test('30 races fit the existing cloud payload limit even with 100 registered horses and long Japanese names',()=>{
 const p=raceSample();p.library.horses=Array.from({length:100},(_,id)=>({id,name:'馬'.repeat(24),ability:raceAbility(10)}));
 p.library.nextId=100;let archive=emptyArchive();
 for(let i=0;i<RACE_ARCHIVE_LIMIT;i++)archive=saveRacePreset(archive,makeRacePreset('r'+i,'競馬'.repeat(30),p));
 assert.throws(()=>saveRacePreset(archive,makeRacePreset('extra','追加',p)));
 p.settings.raceArchive=archive;assert.ok(validPayload(p));
 assert.ok(Buffer.byteLength(JSON.stringify(p),'utf8')<=230000);
});
test('race archive is transmitted, persisted, and guarded on recall',()=>{
 const html=readFileSync(new URL('../tokyo-turf-a-elevation-rebuild.html',import.meta.url),'utf8');
 const code=html.slice(html.indexOf('// Optional cloud sync'),html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(code));
 assert.match(code,/raceArchive\?\{raceArchive\}/);
 assert.match(code,/localStorage.setItem\(RACE_PRESET_BACKUP/);
 assert.match(code,/api.restoreRacePreset/);
 assert.match(code,/restoringSnapshot=true/);
});
