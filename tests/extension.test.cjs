const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const D=require('../docs/core.js'),S=require('../docs/scripts.js'),C=require('../docs/content.js'),R=require('../docs/review.js');
const actual=fs.readFileSync(path.resolve(__dirname,'../docs/samples/fictional-01-08.txt'),'utf8');
const report=D.parseReport(actual);
const detailStates=review=>review.details.map(r=>r.text.match(/:\s*(GOOD|BAD|CHECK|SKIP)\b/)[1]);
test('fictional eight-part report: states, line evidence and independent details',()=>{
 assert.deepEqual(S.ids.map(id=>R.review(report,id).status),['BAD','GOOD','GOOD','GOOD','CHECK','GOOD','BAD','BAD']);
 for(const id of S.ids){const r=R.review(report,id);assert.ok(r.evidence.length,id);for(const e of r.evidence)assert.equal(report.raw.split('\n')[e.line-1],e.text);}
 assert.deepEqual(detailStates(R.review(report,'05')),['CHECK','GOOD','GOOD']);
 assert.deepEqual(detailStates(R.review(report,'07')),['BAD','BAD']);
 assert.deepEqual(detailStates(R.review(report,'08')),['GOOD','BAD']);
 assert.deepEqual(report.counts,{GOOD:4,BAD:3,CHECK:1,SKIP:0,TOTAL:8});
});
for(const id of S.ids.slice(1)){
 for(const status of D.STATES)test(`${id} ${status}: original state, scoped evidence, matching next action`,()=>{
  const p=D.parseReport(R.sample(id,status)),r=R.review(p,id),next=R.next(r,id);assert.equal(r.status,status);assert.ok(r.evidence.length);assert.ok(next.command);assert.match(next.steps.join(' '),/새 TXT/);assert.equal(R.review(p,'01').status,null);
 });
 test(`${id} insufficient evidence preserves BAD and unknown cause`,()=>{const r=R.review(D.parseReport(R.sample(id,'INSUFFICIENT')),id);assert.equal(r.status,'BAD');assert.equal(r.evidence.length,0);assert.match(r.message,/미확인/);assert.match(R.next(r,id).steps.join(' '),/없는 원인을 확정하지/);});
 test(`${id} duplicate/missing/invalid RESULT and duplicate sections have no representative`,()=>{
  const raw=R.sample(id,'GOOD');for(const broken of [raw.replace('\nRESULT: GOOD','\nRESULT: MAYBE'),raw.replace('\nRESULT: GOOD --','\nRESULT: GOOD -- one\nRESULT: BAD --'),raw.replace('\nRESULT: GOOD -- Fictional '+id+' sample',''),raw.replace('========== SUMMARY',`========== [${id}] duplicated ==========\nRESULT: BAD -- x\n========== SUMMARY`)])assert.equal(R.review(D.parseReport(broken),id).status,null);
 });
 test(`${id} learning content retains criteria, command, explanation and delayed quiz`,()=>{const c=C[id];for(const key of ['goal','risk','criteria','scope','resultMeaning','remedy','command'])assert.ok(c[key]?.length>20,key);assert.ok(c.steps.length>=4);assert.ok(c.criteriaItems.length>=3);assert.ok(c.quiz.options.length===3&&c.quiz.answer<3);});
}
test('03/04 owner is evidence, never added as automatic criterion',()=>{for(const id of ['03','04']){const raw=R.sample(id,'GOOD').replace('1 root root','1 other root');const r=R.review(D.parseReport(raw),id);assert.equal(r.status,'GOOD');assert.match(r.evidence[0].text,/other/);assert.match(r.warnings.join(' '),/소유자/);}});
test('05 minimum 1–6 versus textbook >=7, missing and duplicate details',()=>{const raw=R.sample('05','GOOD'),r=R.review(D.parseReport(raw),'05');assert.equal(r.status,'GOOD');assert.match(r.warnings.join(' '),/1–6일/);for(const text of [raw.replace('PASS_MAX_DAYS: GOOD',''),raw.replace('PASS_MAX_DAYS: GOOD','PASS_MAX_DAYS: GOOD\nPASS_MAX_DAYS: BAD')])assert.match(R.review(D.parseReport(text),'05').warnings.join(' '),/PASS_MAX_DAYS 상세/);});
test('07 one detail absent is unknown, PAM BAD keeps independent WHEEL GOOD',()=>{const raw=R.sample('07','BAD'),r=R.review(D.parseReport(raw),'07');assert.deepEqual(detailStates(r),['BAD','GOOD']);const absent=R.review(D.parseReport(raw.replace('WHEEL RESULT: GOOD','')),'07');assert.equal(absent.status,'BAD');assert.match(absent.warnings.join(' '),/WHEEL 상세 결과 없음/);});
test('08 one or no detail supported without fabricating result or replacing main basis',()=>{for(const raw of [R.sample('08','BAD').replace('TEXTBOOK RESULT: BAD',''),R.sample('08','BAD').replace('PRACTICE RESULT: GOOD','').replace('TEXTBOOK RESULT: BAD','')]){const r=R.review(D.parseReport(raw),'08');assert.equal(r.status,'BAD');assert.ok(r.details.length<=1);}});
test('integrated output: eight actual blocks, one initialization and summary, LF, edited body',()=>{
 const bodies={...S.defaults,'02':S.defaults['02']+'\r\n# my edited note'};
 const x=S.build('123','학생','student',bodies);assert.equal(x.filename,'123-학생-learning.sh');assert.equal(x.resultFilename,'123-학생-learning.txt');assert.equal(x.script.includes('\r'),false);
 assert.equal((x.script.match(/^echo > "\$CREATE_FILE"$/gm)||[]).length,1);assert.equal((x.script.match(/^echo "========== \[\d\d\]/gm)||[]).length,8);assert.equal((x.script.match(/^echo "========== SUMMARY/gm)||[]).length,1);assert.match(x.script,/# my edited note/);assert.match(x.script,/EXPECTED_USER="student"/);assert.doesNotMatch(x.script,/'\^student\$'/);assert.match(x.script,/grep "\^\$\{EXPECTED_USER\}\$"/);
 assert.doesNotMatch(x.script,/\b(?:userdel|usermod|chmod|chown|groupadd)\s/);assert.doesNotMatch(x.script,/\b(?:bash|source)\s+.*\.sh/);assert.match(x.script,/PASSWORD_TEMP="\$\{CREATE_FILE\}.password.tmp"/);assert.match(x.script,/rm -f "\$PASSWORD_TEMP"/);
});
test('legacy 01 download is unchanged',()=>assert.deepEqual(S.build('123','학생','student',S.defaults,'01'),D.buildScript('123','학생')));
test('filename and account inputs cannot inject shell syntax or paths',()=>{for(const bad of ['../x','$(id)','a";x','a/b','a b','-x','ROOT',''])assert.throws(()=>S.build('123','학생',bad));for(const bad of ['../x','$(id)','a";x','a/b','a b','']){assert.throws(()=>S.build(bad,'학생','student'));assert.throws(()=>S.build('123',bad,'student'));}});
