(function(){
 'use strict';
 // Raster pages use the browser's Korean font, with no font/data request.
 // Each page is a standard embedded PNG in an offline PDF document.
 window.saveReviewPdf=async function(blocks){
  const pdf=await PDFLib.PDFDocument.create();pdf.setTitle('취약점 진단 01~08 TXT 결과 리뷰');pdf.setAuthor('로컬 학습실');
  const W=1240,H=1754,M=76,lineHeight=34;let canvas,ctx,y,pageCount=0;
  async function flush(){if(!canvas)return;const img=await pdf.embedPng(canvas.toDataURL('image/png'));const page=pdf.addPage([595.28,841.89]);page.drawImage(img,{x:0,y:0,width:595.28,height:841.89});}
  async function page(){await flush();if(++pageCount>64)throw new Error('PDF는 최대 64페이지까지 저장합니다. 원문을 보존하고 항목별 근거 길이를 확인해주세요.');canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';ctx.font='18px "Malgun Gothic",sans-serif';ctx.fillText('01–08 LOCAL LEARNING · TXT REVIEW',M,40);ctx.fillText(String(pageCount),W-M-25,H-30);y=M;}
  async function text(value,heading=false){ctx.font=`${heading?'bold 27':'21'}px "Malgun Gothic",sans-serif`;for(const inputLine of String(value).split('\n')){let line='';for(const char of Array.from(inputLine)){if(ctx.measureText(line+char).width>W-M*2){if(y>H-M){await page();ctx.font=`${heading?'bold 27':'21'}px "Malgun Gothic",sans-serif`;}ctx.fillText(line,M,y);y+=lineHeight;line='';}line+=char;}if(y>H-M){await page();ctx.font=`${heading?'bold 27':'21'}px "Malgun Gothic",sans-serif`;}ctx.fillText(line,M,y);y+=lineHeight;}y+=12;}
  await page();for(const block of blocks){if(block.newPage&&y>M)await page();await text(block.text,!!block.heading);}await flush();
  const bytes=await pdf.save(),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download='diagnosis-review.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return pageCount;
 };
})();
