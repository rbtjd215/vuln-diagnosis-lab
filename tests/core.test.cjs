const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../docs/core.js');
const actual=fs.readFileSync(path.resolve(__dirname,'../docs/samples/fictional-01-08.txt'),'utf8');
const parse = D.parseReport;

test('fictional TXT: eight main results, correct totals, END, 01 evidence', () => {
  const r = parse(actual), review = D.review01(r);
  assert.deepEqual(r.counts, { GOOD: 4, BAD: 3, CHECK: 1, SKIP: 0, TOTAL: 8 });
  assert.equal(r.ended, true); assert.deepEqual(r.warnings, []);
  assert.equal(review.status, 'BAD'); assert.equal(review.rows[0].account, 'lp');
  assert.equal(review.rows[0].shell, '/sbin/nologin');
  assert.equal(review.rows[0].line, actual.replace(/\r\n/g, '\n').split('\n').findIndex(l => l.startsWith('lp:x:')) + 1);
});
test('07 and 08 details remain separate, 05 setting states retained', () => {
  const r = parse(actual);
  assert.equal(r.sections.find(s => s.id === '07').details.length, 2);
  assert.equal(r.sections.find(s => s.id === '08').details.length, 2);
  assert.equal(r.sections.find(s => s.id === '05').details.length, 3);
  assert.equal(r.counts.TOTAL, 8);
});
for (const status of D.STATES) test(`${status}: original status preserved in demo report`, () => {
  const r = parse(D.sample(status));
  assert.deepEqual(r.warnings, []); assert.equal(D.review01(r).status, status);
  assert.equal(r.counts[status], 1); assert.equal(r.counts.TOTAL, 1);
});
test('BAD without evidence does not invent a cause', () => {
  const review = D.review01(parse(D.sample('INSUFFICIENT')));
  assert.equal(review.status, 'BAD'); assert.equal(review.evidence.length, 0);
  assert.match(review.message, /원인 추가 확인/);
  assert.doesNotMatch(review.message, /비밀번호가.*기본|코드.*오류|삭제해야/);
});
test('GOOD alone acknowledges missing evidence', () => {
  const review = D.review01(parse(D.sample('GOOD').replace('MATCH_COUNT=0', '')));
  assert.equal(review.status, 'GOOD'); assert.match(review.message, /원인 추가 확인/);
});
test('CHECK and SKIP retain their reasons without reclassifying', () => {
  assert.match(D.review01(parse(D.sample('SKIP'))).message, /사유로 기록/);
  assert.equal(D.review01(parse(D.sample('CHECK'))).evidence[0].text, 'QUERY_ERROR: cat: /etc/passwd: Permission denied');
});
test('UTF8 BOM, Korean and CRLF accepted', () => {
  const text = '\uFEFF' + actual.replace(/\r?\n/g, '\r\n');
  assert.equal(parse(D.decodeTxt('보고서.TXT', Buffer.from(text))).counts.TOTAL, 8);
});
test('SH, invalid UTF8, NUL and large files rejected', () => {
  assert.throws(() => D.decodeTxt('test.sh', Buffer.from(actual)), /TXT/);
  assert.throws(() => D.decodeTxt('test.txt', Buffer.from([0xff, 0xfe, 0x41])), /UTF-8/);
  assert.throws(() => D.decodeTxt('test.txt', Buffer.from('a\0b')), /NUL/);
  assert.throws(() => D.decodeTxt('test.txt', new Uint8Array(D.MAX_BYTES + 1)), /1 MB/);
  assert.throws(() => parse('x'.repeat(D.MAX_BYTES + 1)), /1 MB/);
});
test('missing section is visible, not replaced with a verdict', () => {
  const input = actual.replace(/========== \[01\][\s\S]*?(?=========== \[02\])/, '');
  const r = parse(input);
  assert.equal(r.counts.TOTAL, 7); assert.equal(D.review01(r).status, null);
  assert.ok(r.warnings.some(w => w.includes('01번 항목이 없습니다')));
});
test('duplicate sections excluded from count and 01 review', () => {
  const block = actual.match(/========== \[01\][\s\S]*?(?=========== \[02\])/)[0];
  const r = parse(actual.replace(block, block + block));
  assert.equal(r.counts.TOTAL, 7); assert.equal(D.review01(r).status, null);
  assert.ok(r.warnings.some(w => w.includes('중복')));
});
test('missing and duplicate RESULT both visible', () => {
  const base = D.sample('BAD');
  for (const input of [base.replace(/^RESULT:.*\n/m, ''), base.replace('RESULT: BAD', 'RESULT: GOOD\nRESULT: BAD')]) {
    const r = parse(input); assert.equal(D.review01(r).status, null); assert.equal(r.counts.TOTAL, 0);
    assert.ok(r.warnings.some(w => w.includes('주 RESULT')));
  }
});
test('unknown status and orphan RESULT cannot become GOOD', () => {
  const r = parse('RESULT: GOOD\n' + D.sample('BAD').replace('RESULT: BAD', 'RESULT: SAFE'));
  assert.equal(r.counts.TOTAL, 0); assert.equal(D.review01(r).status, null);
  assert.ok(r.warnings.some(w => w.includes('항목 밖')));
});
test('invalid second RESULT still counts as duplication and prevents representative status', () => {
  const r = parse(D.sample('BAD').replace('RESULT: BAD', 'RESULT: SAFE\nRESULT: BAD'));
  assert.equal(r.counts.TOTAL, 0); assert.equal(D.review01(r).status, null);
  assert.ok(r.warnings.some(w => w.includes('표기가 2개')));
});
test('SUMMARY discrepancy keeps both counts', () => {
  const r = parse(D.sample('BAD').replace('GOOD=0 BAD=1', 'GOOD=1 BAD=0'));
  assert.equal(r.counts.BAD, 1); assert.equal(r.summary.counts.GOOD, 1);
  assert.ok(r.warnings.some(w => w.includes('SUMMARY가 다릅니다')));
});
test('missing/duplicate SUMMARY are not a complete report', () => {
  for (const input of [D.sample('GOOD').replace(/========== SUMMARY ==========[\s\S]*?\[END\]/, '[END]'), D.sample('GOOD').replace('[END]', '========== SUMMARY ==========\nGOOD=1 BAD=0 CHECK=0 SKIP=0 TOTAL=1\n[END]')]) {
    assert.ok(parse(input).warnings.some(w => w.includes('SUMMARY 머리글')));
  }
});
test('missing, duplicate or early END warns but preserves result', () => {
  for (const input of [D.sample('BAD').replace('[END]', ''), D.sample('BAD') + '[END]\n', D.sample('BAD') + 'trailing text']) {
    const r = parse(input); assert.equal(r.ended, false); assert.equal(D.review01(r).status, 'BAD');
    assert.ok(r.warnings.some(w => w.includes('[END]')));
  }
});
test('unsupported format remains unsupported with raw text', () => {
  const r = parse('내 점검 결과: 안전함'); assert.equal(r.recognized, false);
  assert.equal(r.raw, '내 점검 결과: 안전함'); assert.equal(D.review01(r).status, null);
});
test('scope must be explicit; out-of-scope result excluded', () => {
  assert.ok(parse(D.sample('GOOD').replace('Scope: 01-only\n', '')).warnings.some(w => w.includes('02번')));
  const r = parse(D.sample('GOOD').replace('========== SUMMARY', '========== [02] Other ==========\nRESULT: BAD\n========== SUMMARY'));
  assert.equal(r.counts.TOTAL, 1); assert.ok(r.warnings.some(w => w.includes('범위 밖')));
});
test('contradictory evidence warns without overriding original GOOD', () => {
  const r = parse(D.sample('BAD').replace('RESULT: BAD', 'RESULT: GOOD'));
  assert.equal(D.review01(r).status, 'GOOD'); assert.ok(D.review01(r).warnings.length);
});
test('HTML-like input retained verbatim as data', () => {
  const payload = '<img src=x onerror="window.XSS=1"><script>window.XSS=2</script>';
  const r = parse(D.sample('BAD').replace('Fictional sample', payload));
  assert.equal(D.review01(r).result.message, payload); assert.ok(r.raw.includes(payload));
});
test('next steps distinguish recorded status and lack of evidence', () => {
  for (const [status, expected] of [['GOOD', '검색 범위'], ['BAD', '사용 여부'], ['CHECK', '조회'], ['SKIP', '생략'], ['INSUFFICIENT', '근거']]) {
    const next = D.next01(D.review01(parse(D.sample(status))));
    assert.match(next.title + next.context, new RegExp(expected));
  }
  assert.match(D.next01(D.review01(parse('unknown'))).title, /구간/);
});
test('excessive lines rejected and unsafe count values flagged', () => {
  assert.throws(() => parse('\n'.repeat(30001)), /행 수/);
  assert.ok(D.review01(parse(D.sample('GOOD').replace('MATCH_COUNT=0', 'MATCH_COUNT=99999999999999999999'))).warnings.length);
});
test('filename injection and path traversal rejected before generation', () => {
  for (const [id, name] of [['../foo','학생'], ['1', '$(touch-x)'], ['1','a";x'], ['1','foo/bar'], ['1','x\ny']]) assert.throws(() => D.buildScript(id, name));
});
test('generated code is UTF8 LF and explicitly 01-only; body edits preserved', () => {
  const generated = D.buildScript('20260001', '학생', 'RESULT=BAD\r\nRESULT_NOTE="edited"');
  assert.equal(generated.filename, '20260001-학생-01-demo.sh'); assert.doesNotMatch(generated.script, /\r|\uFEFF/);
  assert.match(generated.script, /Scope: 01-only/); assert.match(generated.script, /RESULT=BAD\nRESULT_NOTE="edited"/);
  assert.equal(generated.script.match(/echo > /g).length, 1); assert.equal(generated.script.match(/SUMMARY/g).length, 1);
  assert.doesNotMatch(D.buildScript('1', '학생').script, /\b(userdel|usermod|chmod|chown)\b/);
});

