import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const files=['frontend/student/today/today.js','frontend/student/today/today-showcase.js','frontend/student/courses/courses.js','frontend/student/growth/assets/growth-live.js','evidence/yz-rd-t098/capture.mjs','evidence/yz-rd-t098/visual-fixture.js','evidence/yz-rd-t098/guard.mjs','evidence/yz-rd-t098/verify.mjs'];
let log='';let failed=false;
for(const p of files){const r=spawnSync(process.execPath,['--check',p],{cwd:root,encoding:'utf8'});log+=`node --check ${p}\nexit=${r.status}\n${r.stdout}${r.stderr}`;failed ||=r.status!==0;}
const d=spawnSync('git',['diff','--check'],{cwd:root,encoding:'utf8'});log+=`git diff --check\nexit=${d.status}\n${d.stdout}${d.stderr}`;failed ||=d.status!==0;
writeFileSync(new URL('./syntax-diff.log',import.meta.url),log);process.stdout.write(log);if(failed)process.exit(1);
