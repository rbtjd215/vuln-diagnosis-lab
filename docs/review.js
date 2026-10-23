(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'),require('./content.js'));else root.ItemReview=factory(root.Diagnosis,root.LessonContent);})(typeof globalThis!=='undefined'?globalThis:this,function(D,C){
 'use strict';
 const meanings={GOOD:'해당 코드의 조건을 충족했다고 기록했습니다. 전체 안전을 뜻하지 않습니다.',BAD:'해당 코드의 조건을 충족하지 못했다고 기록했습니다. 학생 코드 오류라는 뜻은 아닙니다.',CHECK:'판정을 확정하지 못한 기록입니다. 이유는 원문 근거로만 확인합니다.',SKIP:'검사를 수행하지 않은 기록입니다. 생략 이유는 원문에서 확인합니다.'};
 const patterns={
  '02':/^(?:[^\s:]+\s*->\s*UID=0|UID0_COUNT=\d+|[^:]+:[^:]*:0:)/,
  '03':/^[bcdlps-][rwxStTs-]{9}[.+@]?\s+\d+\s+\S+\s+\S+.+/,
  '04':/^[bcdlps-][rwxStTs-]{9}[.+@]?\s+\d+\s+\S+\s+\S+.+/,
  '05':/^\s*PASS_(?:MIN_LEN|MAX_DAYS|MIN_DAYS)\s+\S+/i,
  '06':/^[^:\s]+:[^:]*:\d+:\d+:[^:]*:[^:]*:[^:]*$/,
  '07':/^(?:\s*#?\s*(?:auth|account|password|session)\s+|wheel:)/,
  '08':/^[bcdlps-][rwxStTs-]{9}[.+@]?\s+\d+\s+\S+\s+\S+.+/
 };
 function review(report,id){
  if(id==='01')return D.review01(report);
  if(!C[id])throw new Error('지원하지 않는 항목입니다.');
  const sections=report.sections.filter(s=>s.id===id);
  const base={id,status:null,message:'구간과 주 RESULT를 하나로 확정할 수 없습니다. 지원 양식의 누락·중복·상태를 확인해주세요.',evidence:[],rows:[],details:[],warnings:[]};
  if(sections.length!==1||sections[0].resultMarkers!==1||sections[0].results.length!==1)return base;
  const section=sections[0],status=section.results[0].status;
  const errors=section.lines.filter(r=>/^(?:QUERY_ERROR:|FILE_STATUS:)|(?:Permission denied|cannot open|No such file)/i.test(r.text));
  const evidence=section.lines.filter(r=>patterns[id].test(r.text)||errors.includes(r));
  const warnings=[];
  if(!evidence.length)warnings.push('조회 원문 근거 부족 · 구체적인 원인 미확인. RESULT 사유나 상세 상태만으로 입력값을 복원하지 않습니다.');
  if(errors.length)warnings.push('오류·파일 상태 원문이 있습니다. 기록된 상태를 바꾸지 않고 실제 조회 성공 여부를 별도로 확인합니다.');
  if(id==='03'||id==='04')warnings.push('권한 패턴 검사와 파일 소유자 기준은 다릅니다. ls에 보이는 소유자는 자동 판정에 포함된 것으로 해석하지 않습니다.');
  const details=section.details;
  if(id==='05'){
   const keys=['PASS_MIN_LEN','PASS_MAX_DAYS','PASS_MIN_DAYS'];
   for(const key of keys){
    const found=details.filter(r=>r.text.startsWith(key+':'));
    if(found.length!==1)warnings.push(`${key} 상세 상태가 없거나 중복입니다. 세 검사 완료를 확정하지 않습니다.`);
   }
   const min=evidence.map(r=>r.text.match(/^\s*PASS_MIN_DAYS\s+(\d+)\s*$/i)).filter(Boolean);
   if(min.length===1&&Number(min[0][1])>=1&&Number(min[0][1])<=6)warnings.push('기록된 최소 사용 기간은 1–6일입니다. >0 예제의 GOOD와 보안기준 7일 이상은 다릅니다. 원문 상태는 보존합니다.');
   warnings.push('한 설정의 누락·CHECK는 전체 암호 정책 부재를 뜻하지 않습니다. 시험 기준은 8자·70일·7일입니다.');
  }
  if(id==='06')warnings.push('행 전체 문자열 필터입니다. 마지막 Shell 필드·실제 로그인 동작·모든 계정을 검사했다고 확장하지 않습니다.');
  if(id==='07'){
   for(const key of ['PAM','WHEEL'])if(details.filter(r=>r.text.startsWith(key+' RESULT:')).length!==1)warnings.push(`${key} 상세 결과 없음 또는 중복 · 독립 검사 완료 여부를 확인합니다.`);
   warnings.push('wheel 네 번째 필드는 명시 구성원입니다. 기본 그룹·실제 인증·전체 PAM 순서는 이 TXT만으로 확인하지 못합니다.');
  }
  if(id==='08')warnings.push('PRACTICE·TEXTBOOK은 별도 기준입니다. 주 RESULT 사유를 보존하며, 기록되지 않은 상세 판정이나 passwd x 검사 성공을 만들지 않습니다.');
  return {...base,status,evidence,details,warnings,message:`${meanings[status]} ${!evidence.length?'조회 원문 근거가 부족해 구체적인 원인은 미확인입니다.':''}`};
 }
 function next(result,id){
  if(id==='01')return D.next01(result);
  const c=C[id];
  const action={GOOD:'GOOD가 확인한 조건과 미검사 범위를 읽습니다',BAD:'BAD의 근거와 조건을 대조합니다',CHECK:'확정하지 못한 조회를 확인합니다',SKIP:'생략 사유와 검사 조건을 확인합니다'};
  return {title:action[result.status]||'구간과 주 RESULT부터 확인합니다',context:c.remedy,steps:[result.status?'원본 RESULT·상세 결과·행 번호와 조회 근거를 함께 읽습니다.':'지원 번호 머리글과 주 RESULT가 한 번씩인지 확인합니다.',result.status==='CHECK'||result.status==='SKIP'?'기록된 오류·파일 상태·사유를 확인합니다. 사유가 없으면 원인 미확인으로 둡니다.':'학습 화면의 보안기준과 실제 코드의 조건을 나란히 대조합니다.',!result.evidence.length?'아래 조회로 실행 환경의 근거를 보충합니다. 근거가 없는 원인을 확정하지 않습니다.':'아래 조회의 입력·출력을 확인하고 누락된 속성은 별도로 검토합니다.','필요한 보완은 실습 환경의 관리자 검토 아래 진행한 뒤 같은 SH를 다시 실행하고 새 TXT를 비교합니다.'],command:c.command,note:'조회 예시입니다. 사이트는 실행하지 않습니다. 02~08의 원형 코드는 모든 파이프 오류를 별도 상태로 검출하지 않으므로 GOOD/BAD만으로 조회 성공도 보장하지 않습니다.'};
 }
 function sample(id,status){
  if(id==='01')return D.sample(status);
  const row={
   '02':status==='GOOD'?'root -> UID=0':'UID0_COUNT=2\nroot -> UID=0\nextra -> UID=0',
   '03':`${status==='GOOD'?'-rw-r--r--':'-rw-rw-rw-'}. 1 root root 2000 Jan 1 12:00 /etc/passwd`,
   '04':`${status==='GOOD'?'-rw-r--r--':'-rw-------'}. 1 root root 500 Jan 1 12:00 /etc/group`,
   '05':`PASS_MIN_LEN ${status==='GOOD'?8:5}\nPASS_MAX_DAYS 70\nPASS_MIN_DAYS 3\nPASS_MIN_LEN: ${status==='GOOD'?'GOOD':'BAD'}\nPASS_MAX_DAYS: GOOD\nPASS_MIN_DAYS: GOOD`,
   '06':`daemon:x:2:2:daemon:/sbin:${status==='GOOD'?'/sbin/nologin':'/bin/bash'}`,
   '07':`${status==='GOOD'?'':'#'}auth required pam_wheel.so use_uid\nwheel:x:10:student\nPAM RESULT: ${status==='GOOD'?'GOOD':'BAD'}\nWHEEL RESULT: GOOD`,
   '08':`${status==='GOOD'?'-r--------':'----------'}. 1 root root 1000 Jan 1 12:00 /etc/shadow\nPRACTICE RESULT: GOOD\nTEXTBOOK RESULT: ${status==='GOOD'?'GOOD':'BAD'}`
  };
  const recorded=status==='INSUFFICIENT'?'BAD':status;
  const evidence=status==='INSUFFICIENT'?'':status==='CHECK'?'QUERY_ERROR: input could not be confirmed (fictional)':status==='SKIP'?'FILE_STATUS: required input missing (fictional)':row[id];
  return `[Report 1] FICTIONAL item sample\nScope: 01-08\n========== [${id}] ${C[id].title} ==========\n${evidence}\nRESULT: ${recorded} -- Fictional ${id} sample\n========== SUMMARY ==========\n${D.STATES.map(s=>s+'='+(s===recorded?1:0)).join(' ')} TOTAL=1\n[END]\n`;
 }
 return {review,next,sample};
});
