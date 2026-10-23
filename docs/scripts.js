(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'),require('./bodies.js'));else root.LearningScripts=factory(root.Diagnosis,root.CheckBodies);})(typeof globalThis!=='undefined'?globalThis:this,function(D,B){
  'use strict';
  const ids=['01','02','03','04','05','06','07','08'];
  const defaults={...B,'01':D.DEFAULT_BODY};
  function build(id,name,user,bodies=defaults,scope='all'){
    D.buildScript(id,name); // shared filename validation
    if(scope==='01')return D.buildScript(id,name,bodies['01']);
    if(!/^[a-z_][a-z0-9_-]{0,31}$/.test(user))throw new Error('07 본인 계정은 소문자·숫자·밑줄·하이픈으로 입력해주세요. 첫 글자는 소문자 또는 밑줄입니다.');
    if(scope!=='all')throw new Error('지원하지 않는 저장 범위입니다.');
    const base=`${id}-${name}-learning`;
    const first=D.buildScript(id,name,bodies['01']).script;
    const part01=first.slice(first.indexOf('echo "========== [01]'),first.indexOf('GOOD=0; BAD=0;'));
    const start=['#!/bin/bash','# Local learning: read checks only; edited code is not automatically graded.',`CREATE_FILE="${base}.txt"`,'PASSWORD_TEMP="${CREATE_FILE}.password.tmp"',`EXPECTED_USER="${user}"`,'echo > "$CREATE_FILE"','echo "[Report 1] Account management learning" >> "$CREATE_FILE"','echo "Version: 02-08-local-1" >> "$CREATE_FILE"','echo "Scope: 01-08" >> "$CREATE_FILE"','date \'+Time: %Y-%m-%d %H:%M:%S %z\' >> "$CREATE_FILE"','echo "User: $(whoami)" >> "$CREATE_FILE"','echo "Expected wheel user: $EXPECTED_USER" >> "$CREATE_FILE"'];
    const end=['GOOD=$(grep -c "^RESULT: GOOD --" "$CREATE_FILE")','BAD=$(grep -c "^RESULT: BAD --" "$CREATE_FILE")','CHECK=$(grep -c "^RESULT: CHECK --" "$CREATE_FILE")','SKIP=$(grep -c "^RESULT: SKIP --" "$CREATE_FILE")','TOTAL=$((GOOD+BAD+CHECK+SKIP))','echo "========== SUMMARY ==========" >> "$CREATE_FILE"','echo "GOOD=$GOOD BAD=$BAD CHECK=$CHECK SKIP=$SKIP TOTAL=$TOTAL" >> "$CREATE_FILE"','echo "SUMMARY_BASIS: main RESULT only; 08 main uses textbook basis" >> "$CREATE_FILE"','echo "[END]" >> "$CREATE_FILE"','cat "$CREATE_FILE"',''];
    return {filename:base+'.sh',resultFilename:base+'.txt',script:[...start,part01,...ids.slice(1).map(key=>bodies[key]),...end].join('\n').replace(/\r\n?/g,'\n')};
  }
  return {ids,defaults,build};
});
