import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base='03371f7287433dac7f09c99ff95729fb4c071652';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const allow=new Set(['frontend/student/today/index.html','frontend/student/today/style.css','frontend/student/courses/index.html','frontend/student/courses/style.css','frontend/student/growth/index.html','frontend/student/growth/assets/growth-live.css','CURRENT_HANDOFF.md']);
const paths=[...new Set([...git('diff','--name-only',base).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')])].filter(Boolean);
assert.equal(git('branch','--show-current'),'feat/yz-rd-t098-student-learning-visual-redesign');
assert.equal(git('merge-base',base,'HEAD'),base);
assert.ok(paths.every(p=>allow.has(p)||p.startsWith('evidence/yz-rd-t098/')),'write allowlist');
for(const p of ['frontend/student/today/today.js','frontend/student/today/today-showcase.js','frontend/student/courses/courses.js','frontend/student/growth/assets/growth-live.js','frontend/shared/student-nav.css','frontend/shared/student-nav.js']){
 assert.equal(readFileSync(root+p,'utf8'),execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'}),p+' unchanged');
}
assert.equal(git('diff','--name-only',base,'--','frontend/student/courses/course-detail/','frontend/assets/','backend/','packages/','local_sources/'),'');
const old=execFileSync('git',['show',base+':CURRENT_HANDOFF.md'],{cwd:root,encoding:'utf8'});
const current=readFileSync(root+'CURRENT_HANDOFF.md','utf8');
assert.ok(current.startsWith(old),'handoff append only');
assert.equal((current.slice(old.length).match(/## YZ-RD-T098/g)||[]).length,1,'one handoff checkpoint');
console.log(JSON.stringify({FILE_OWNER_GUARD:'PASS',base,branch:git('branch','--show-current'),changedPaths:paths,protectedBusinessJs:'BYTE_IDENTICAL',courseDetailMediaAssets:'UNCHANGED',handoff:'ONE_APPEND_ONLY_CHECKPOINT'},null,2));
