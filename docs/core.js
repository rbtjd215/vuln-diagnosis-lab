(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Diagnosis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STATES = ['GOOD', 'BAD', 'CHECK', 'SKIP'];
  const MAX_BYTES = 1024 * 1024;
  const VERSION = '2026-10-23 / 01-demo v0.1';
  function decodeTxt(name, bytes) {
    if (!/\.txt$/i.test(name)) throw new Error('TXT 파일만 선택할 수 있습니다. SH 파일은 입력받지 않습니다.');
    if (bytes.byteLength > MAX_BYTES) throw new Error('파일 크기는 1 MB 이하여야 합니다.');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('UTF-8로 읽을 수 없습니다. 원본을 보존하고 UTF-8 TXT 사본으로 저장해주세요.'); }
    if (/\u0000/.test(text)) throw new Error('텍스트로 읽을 수 없는 NUL 문자가 있습니다. UTF-8 TXT 사본을 확인해주세요.');
    return text;
  }
  function parseReport(input) {
    if (typeof input !== 'string' || new TextEncoder().encode(input).length > MAX_BYTES) throw new Error('TXT는 1 MB 이하의 텍스트여야 합니다.');
    const raw = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = raw.split('\n');
    if (lines.length > 30000) throw new Error('TXT의 행 수가 너무 많습니다. 30,000행 이하의 보고서를 선택해주세요.');
    const warnings = [], sections = [], summaries = [], meta = {};
    let current = null, inSummary = false, summaryHeaders = 0;
    const endLines = [];
    lines.forEach((text, index) => {
      const line = index + 1;
      const header = text.match(/^={3,}\s*\[(\d{2})\]\s*(.*?)\s*={3,}\s*$/);
      if (header) {
        if (inSummary) warnings.push(`${line}행: SUMMARY 뒤에 항목이 있습니다.`);
        current = { id: header[1], title: header[2], start: line, lines: [], results: [], resultMarkers: 0, details: [] };
        sections.push(current); inSummary = false; return;
      }
      if (/^={3,}\s*SUMMARY\s*={3,}\s*$/.test(text)) { summaryHeaders++; inSummary = true; current = null; return; }
      if (text.trim() === '[END]') { endLines.push(line); current = null; return; }
      if (inSummary) {
        const count = text.match(/^GOOD=(\d+)\s+BAD=(\d+)\s+CHECK=(\d+)\s+SKIP=(\d+)\s+TOTAL=(\d+)\s*$/);
        if (count) summaries.push({ line, raw: text, counts: Object.fromEntries([...STATES, 'TOTAL'].map((s, i) => [s, Number(count[i + 1])])) });
        if (/^RESULT\s*:/.test(text)) warnings.push(`${line}행: SUMMARY 안의 RESULT는 집계하지 않았습니다.`);
        return;
      }
      if (current) {
        const record = { line, text }; current.lines.push(record);
        if (/^RESULT\s*:/.test(text)) current.resultMarkers++;
        const result = text.match(/^RESULT:\s*(GOOD|BAD|CHECK|SKIP)(?:\s*--\s*(.*))?\s*$/);
        if (result) current.results.push({ ...record, status: result[1], message: result[2] || '' });
        else if (/^RESULT\s*:/.test(text)) warnings.push(`${line}행: 지원하지 않거나 잘못된 주 RESULT입니다.`);
        if (/^(?:(?:PAM|WHEEL|PRACTICE|TEXTBOOK) RESULT:|PASS_[A-Z_]+:)/.test(text)) current.details.push(record);
      } else {
        const m = text.match(/^(Version|Time|User|Scope):\s*(.*)$/);
        if (m) {
          if (Object.hasOwn(meta, m[1])) warnings.push(`${line}행: ${m[1]} 메타데이터가 중복되었습니다.`);
          else meta[m[1]] = m[2];
        }
        if (/^RESULT\s*:/.test(text)) warnings.push(`${line}행: 항목 밖의 RESULT는 집계하지 않았습니다.`);
      }
    });
    const demo = meta.Scope === '01-only';
    const expected = demo ? ['01'] : ['01', '02', '03', '04', '05', '06', '07', '08'];
    if (meta.Scope && !['01-only', '01-08'].includes(meta.Scope)) warnings.push('알 수 없는 Scope입니다. 기본 01~08 양식으로 확인합니다.');
    const counts = { GOOD: 0, BAD: 0, CHECK: 0, SKIP: 0, TOTAL: 0 };
    const occurrences = new Map();
    sections.forEach(s => occurrences.set(s.id, (occurrences.get(s.id) || 0) + 1));
    for (const id of expected) {
      const found = occurrences.get(id) || 0;
      if (!found) warnings.push(`${id}번 항목이 없습니다.`);
      if (found > 1) warnings.push(`${id}번 항목이 중복되었습니다. 해당 번호는 집계에서 제외했습니다.`);
    }
    for (const section of sections) {
      if (!expected.includes(section.id)) warnings.push(`${section.id}번은 선언된 범위 밖의 항목입니다. 집계에서 제외했습니다.`);
      if (section.resultMarkers !== 1 || section.results.length !== 1) warnings.push(`${section.id}번 주 RESULT 표기가 ${section.resultMarkers}개, 해석 가능한 결과가 ${section.results.length}개입니다. 해당 구간을 확인해주세요.`);
      if (expected.includes(section.id) && occurrences.get(section.id) === 1 && section.resultMarkers === 1 && section.results.length === 1) {
        counts[section.results[0].status]++; counts.TOTAL++;
      }
    }
    if (!sections.length) warnings.push('지원하는 번호 구간을 인식하지 못했습니다. 실행 안내의 양식을 확인해주세요.');
    const lastLine = lines.reduce((last, text, i) => text.trim() ? i + 1 : last, 0);
    const ended = endLines.length === 1 && endLines[0] === lastLine;
    if (!ended) warnings.push('[END]가 없거나 중복되었거나 마지막에 있지 않습니다. 불완전할 가능성이 있습니다.');
    if (summaryHeaders !== 1 || summaries.length !== 1) warnings.push('SUMMARY 머리글과 집계 행이 각각 1개인지 확인해주세요.');
    const summary = summaries.length === 1 ? summaries[0] : null;
    if (summary && Object.values(summary.counts).some(n => !Number.isSafeInteger(n))) warnings.push('SUMMARY의 숫자가 유효한 정수 범위를 벗어났습니다.');
    if (summary && Object.keys(counts).some(k => counts[k] !== summary.counts[k])) warnings.push('읽은 주 RESULT 집계와 TXT의 SUMMARY가 다릅니다.');
    return { raw, sections, meta, counts, summary, ended, demo, warnings, recognized: sections.length > 0 };
  }
  function review01(report) {
    const found = report.sections.filter(s => s.id === '01');
    if (found.length !== 1) return { status: null, message: found.length ? '01번이 중복되어 대표 결과를 선택하지 않았습니다.' : '01번 항목을 찾지 못했습니다.', rows: [], evidence: [], warnings: [] };
    const section = found[0], evidence = [], rows = [], warnings = [];
    let count = null;
    const countLines = section.lines.filter(r => /^MATCH_COUNT=\d+\s*$/.test(r.text));
    if (countLines.length === 1) { count = Number(countLines[0].text.split('=')[1]); evidence.push(countLines[0]); if (!Number.isSafeInteger(count)) { count = null; warnings.push('검색 행 수가 유효한 정수 범위를 벗어났습니다.'); } }
    else if (countLines.length > 1) warnings.push('검색 행 수가 중복 기록되어 하나로 확정하지 않았습니다.');
    for (const record of section.lines) {
      const fields = record.text.split(':');
      if (fields.length === 7 && /^[^:\s]+$/.test(fields[0]) && /^\d+$/.test(fields[2]) && /^\d+$/.test(fields[3])) {
        rows.push({ ...record, account: fields[0], uid: fields[2], shell: fields[6] }); evidence.push(record);
      }
      if (/^(?:QUERY_ERROR:|FILE_STATUS:|CHECK_SOURCE:)/.test(record.text)) evidence.push(record);
    }
    if (section.resultMarkers !== 1 || section.results.length !== 1) return { status: null, message: '01번 주 RESULT가 없거나 중복되었거나 지원 형식이 아니어서 대표 상태를 확정하지 않았습니다.', rows, evidence, warnings, section };
    const result = section.results[0], status = result.status;
    const meaning = {
      GOOD: '이 스크립트의 해당 검사 조건을 충족한 것으로 기록되어 있습니다.',
      BAD: '이 스크립트의 해당 검사 조건을 충족하지 못한 것으로 기록되어 있습니다.',
      CHECK: '이 검사에서 판정을 확정하지 못한 것으로 기록되어 있습니다.',
      SKIP: '이 항목의 검사가 수행되지 않은 것으로 기록되어 있습니다.'
    };
    let message = meaning[status];
    if (rows.length) message += ` TXT에 계정 형식의 행 ${rows.length}개가 있습니다. 계정의 사용 여부와 실제 비밀번호는 이 행만으로 알 수 없습니다.`;
    else if (count !== null) message += ` 검색 행 수는 ${count}로 기록되어 있습니다. 실제 파일 전체와 코드의 정확성은 확인하지 못합니다.`;
    else message += ' TXT에 구체적인 계정 행이나 검색 행 수가 없어 원인 추가 확인이 필요합니다.';
    if (status === 'GOOD' && (rows.length || count > 0)) warnings.push('GOOD와 함께 검색 행이 기록되어 있습니다. 원본 상태는 보존하며 판정 근거의 일관성은 추가 확인이 필요합니다.');
    if (status === 'BAD' && count === 0) warnings.push('BAD와 검색 행 수 0이 함께 기록되어 있습니다. 실제 실행 코드와 원문을 다시 확인해주세요.');
    if (count !== null && rows.length && count !== rows.length) warnings.push('기록된 검색 행 수와 계정 형식 행 수가 다릅니다.');
    if (status === 'SKIP' && /\/etc\/passwd file not found/.test(result.message)) message += ' 파일 부재가 사유로 기록되어 있으며, 현재 파일의 부재를 사이트가 직접 확인한 것은 아닙니다.';
    return { status, message, result, rows, count, evidence, warnings, section };
  }
  function next01(review) {
    const base = {
      title: '존재 확인 다음에는 사용 여부를 확인합니다',
      context: '교안 p41은 미사용이 확실한 계정과 의심스러운 계정을 검토·삭제하고, 로그인 불필요 계정의 Shell을 제한하도록 안내합니다.',
      steps: ['계정 행과 검색 행 수, 기록된 오류를 확인합니다.', '관리 목적과 실제 사용 중인 서비스, 계정이 필요한 이유를 실습 환경에서 확인합니다.', '미사용이 확실한 경우에만 관리자의 검토 아래 교안의 조치 예시를 학습합니다.', '필요한 보완 뒤 같은 스크립트를 다시 실행하고 새 TXT의 근거와 결과를 비교합니다.'],
      command: 'cat /etc/passwd |\n  grep -E "lp:|uucp:|nuucp:"\necho $?',
      note: '마지막 숫자는 직전 검색의 종료 상태입니다. 0은 일치 행 있음, 1은 일치 행 없음이며 행 수와 다른 값입니다. 오류는 출력 원문도 함께 확인합니다.'
    };
    if (!review.status) return { ...base, title: '01번 구간과 주 RESULT부터 확인합니다', context: '누락되거나 중복된 구간에서 대표 판정을 선택하지 않았습니다.', steps: ['지원 양식의 [01] 머리글과 RESULT가 각각 한 번인지 확인합니다.', '중간 종료나 다른 파일과의 합쳐짐이 없는지 원문을 살펴봅니다.', 'CentOS에서 새 TXT를 생성하고 다시 선택합니다.'], command: 'cat -- 학번-이름-01-demo.txt', note: '실제 파일명은 코드 작성·CentOS 실행 안내에서 확인해주세요.' };
    if (review.status === 'CHECK') return { ...base, title: '판정을 멈춘 조회부터 다시 확인합니다', context: 'CHECK는 판정을 확정하지 못했다는 기록입니다. 구체적인 원인은 TXT에 남은 사유와 오류 범위 안에서만 확인합니다.', steps: ['RESULT 사유와 QUERY_ERROR 원문을 확인합니다. 오류가 없으면 원인 미확인으로 둡니다.', '실행한 환경에서 파일 경로·읽기 가능 여부와 검색 명령의 실행 여부를 조회합니다.', '원인을 확인·보완한 뒤 같은 코드를 다시 실행하고 새 TXT를 리뷰합니다.'], command: 'ls -l /etc/passwd\ncat /etc/passwd', note: '파일과 내용 조회 예시입니다. CHECK만으로 파일 권한 문제나 코드 오류라고 단정하지 않습니다.' };
    if (review.status === 'SKIP') return { ...base, title: '검사가 생략된 사유부터 확인합니다', context: 'SKIP는 검사 미수행 기록입니다. 파일 부재 사유가 적혀 있으면 그 기록을 확인하고 실제 환경의 경로와 파일 존재를 조회합니다.', steps: ['TXT의 생략 사유를 확인합니다. 미기록이면 이유를 확정하지 않습니다.', '실행한 CentOS에서 /etc/passwd의 경로와 존재 여부를 확인합니다.', '검사를 수행할 수 있는 조건을 확인한 뒤 새로 실행하고 TXT를 가져옵니다.'], command: 'ls -l /etc/passwd', note: '조회 명령입니다. 파일을 새로 만들거나 계정을 삭제하는 지시가 아닙니다.' };
    if (review.status === 'GOOD') return { ...base, title: 'GOOD의 검색 범위를 확인합니다', context: 'GOOD는 해당 스크립트의 검사 조건 충족 기록입니다. 교안의 전체 계정관리 기준을 모두 검사했다는 뜻은 아닙니다.', steps: ['검색 행 수나 실제 조회 근거가 있는지 확인합니다. 없으면 근거 부족으로 남깁니다.', '실행한 코드의 검색 대상과 조건이 무엇인지 다시 읽습니다.', '다른 미사용·의심 계정과 실제 서비스 사용 여부는 별도로 검토합니다.'] };
    if (!review.rows.length) return { ...base, title: 'BAD의 조회 근거부터 보충합니다', context: '구체적인 계정 행이 없으므로 어떤 계정이 왜 검색됐는지 확정할 수 없습니다.', steps: ['계정 행·검색 행 수·오류 기록이 포함된 TXT인지 확인합니다.', '실행 환경에서 같은 조회 명령으로 검색된 원문을 확인합니다.', '근거를 기록해 새로 실행하고, 계정이 확인되면 실제 사용 여부를 검토합니다.'] };
    return base;
  }

  // Pedagogical additions: read-error handling, evidence, report framing. No account changes.
  const DEFAULT_BODY = [
    '# 01 Default 계정: 교안 p42~43의 검색·집계·비교 흐름',
    'if [ -f /etc/passwd ]',
    'then',
    '    PASSWD_CONTENT=$(cat /etc/passwd 2>&1)',
    '    if [ $? -eq 0 ]',
    '    then',
    '        MATCHED_ROWS=$(printf \'%s\\n\' "$PASSWD_CONTENT" | grep -E "lp:|uucp:|nuucp:" 2>&1)',
    '        SEARCH_STATUS=$?',
    '        if [ "$SEARCH_STATUS" -le 1 ]',
    '        then',
    '            if [ "$SEARCH_STATUS" -eq 1 ]',
    '            then',
    '                MATCH_COUNT=0',
    '            else',
    '                MATCH_COUNT=$(printf \'%s\\n\' "$MATCHED_ROWS" | wc -l)',
    '                printf \'%s\\n\' "$MATCHED_ROWS" >> "$CREATE_FILE"',
    '            fi',
    '            echo "MATCH_COUNT=$MATCH_COUNT" >> "$CREATE_FILE"',
    '            if [ "$MATCH_COUNT" -eq 0 ]',
    '            then',
    '                RESULT=GOOD',
    '                RESULT_NOTE="lp, uucp, nuucp pattern not found"',
    '            else',
    '                RESULT=BAD',
    '                RESULT_NOTE="Listed default account pattern(s) found"',
    '            fi',
    '        else',
    '            printf \'QUERY_ERROR: %s\\n\' "$MATCHED_ROWS" >> "$CREATE_FILE"',
    '            RESULT=CHECK',
    '            RESULT_NOTE="Pattern query failed; inspect QUERY_ERROR"',
    '        fi',
    '    else',
    '        printf \'QUERY_ERROR: %s\\n\' "$PASSWD_CONTENT" >> "$CREATE_FILE"',
    '        RESULT=CHECK',
    '        RESULT_NOTE="Cannot read /etc/passwd; inspect QUERY_ERROR"',
    '    fi',
    'else',
    '    echo "FILE_STATUS: /etc/passwd file not found" >> "$CREATE_FILE"',
    '    RESULT=SKIP',
    '    RESULT_NOTE="/etc/passwd file not found"',
    'fi'
  ].join('\n');
  function buildScript(studentId, studentName, body = DEFAULT_BODY) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(studentId)) throw new Error('학번은 영문·숫자·밑줄·하이픈 1~32자로 입력해주세요.');
    if (!/^[가-힣A-Za-z0-9_-]{1,24}$/.test(studentName)) throw new Error('이름은 한글·영문·숫자·밑줄·하이픈 1~24자로 입력해주세요.');
    const base = `${studentId}-${studentName}-01-demo`;
    const script = [
      '#!/bin/bash', '# 01-only local learning demo. Not the complete Report 1 assignment.',
      `CREATE_FILE="${base}.txt"`,
      'echo > "$CREATE_FILE"',
      'echo "[Report 1] Default account learning demo" >> "$CREATE_FILE"',
      `echo "Version: ${VERSION}" >> "$CREATE_FILE"`,
      'echo "Scope: 01-only" >> "$CREATE_FILE"',
      'date \'+Time: %Y-%m-%d %H:%M:%S %z\' >> "$CREATE_FILE"',
      'echo "User: $(whoami)" >> "$CREATE_FILE"',
      'echo "========== [01] Default account check ==========" >> "$CREATE_FILE"',
      'echo "CHECK_SOURCE: /etc/passwd; grep -E lp:|uucp:|nuucp:" >> "$CREATE_FILE"',
      'RESULT=CHECK', 'RESULT_NOTE="No result set by the edited learning code"', '',
      body.replace(/\r\n?/g, '\n').trim(), '',
      'case "$RESULT" in',
      '    GOOD|BAD|CHECK|SKIP) ;;',
      '    *) RESULT=CHECK; RESULT_NOTE="Unsupported result from edited code" ;;',
      'esac',
      'echo "RESULT: $RESULT -- $RESULT_NOTE" >> "$CREATE_FILE"',
      'GOOD=0; BAD=0; CHECK=0; SKIP=0',
      'case "$RESULT" in',
      '    GOOD) GOOD=1 ;;', '    BAD) BAD=1 ;;', '    CHECK) CHECK=1 ;;', '    SKIP) SKIP=1 ;;', 'esac',
      'echo "========== SUMMARY ==========" >> "$CREATE_FILE"',
      'echo "GOOD=$GOOD BAD=$BAD CHECK=$CHECK SKIP=$SKIP TOTAL=1" >> "$CREATE_FILE"',
      'echo "[END]" >> "$CREATE_FILE"', 'cat "$CREATE_FILE"', ''
    ].join('\n');
    return { script, filename: `${base}.sh`, resultFilename: `${base}.txt` };
  }
  function sample(status) {
    const evidence = {
      GOOD: 'MATCH_COUNT=0',
      BAD: 'lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin\nMATCH_COUNT=1',
      CHECK: 'QUERY_ERROR: cat: /etc/passwd: Permission denied',
      SKIP: 'FILE_STATUS: /etc/passwd file not found',
      INSUFFICIENT: ''
    };
    const recorded = status === 'INSUFFICIENT' ? 'BAD' : status;
    return `[Report 1] FICTIONAL learning sample\nVersion: demo fixture\nScope: 01-only\n========== [01] Default account check ==========\n${evidence[status]}\nRESULT: ${recorded} -- ${status === 'SKIP' ? '/etc/passwd file not found' : 'Fictional sample'}\n========== SUMMARY ==========\n${STATES.map(s => `${s}=${s === recorded ? 1 : 0}`).join(' ')} TOTAL=1\n[END]\n`;
  }
  return { STATES, MAX_BYTES, VERSION, DEFAULT_BODY, decodeTxt, parseReport, review01, next01, buildScript, sample };
});
