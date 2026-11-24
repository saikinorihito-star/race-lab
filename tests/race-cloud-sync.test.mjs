import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stable,validPayload,syncDecision} from '../race-cloud-sync.mjs';
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
