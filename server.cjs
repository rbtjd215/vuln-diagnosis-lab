const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const BASE='/vuln-diagnosis-lab/',ROOT=path.resolve(__dirname,'docs');
const allowed=new Set(['index.html','styles.css','core.js','content.js','bodies.js','scripts.js','review.js','workspace.js','pdf.js','vendor/pdf-lib.min.js','vendor/pdf-lib-LICENSE.md',...fs.readdirSync(path.join(ROOT,'samples')).map(f=>'samples/'+f)]);
function createServer(){return http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/'||pathname===BASE.slice(0,-1)){res.writeHead(302,{Location:BASE});return res.end();}
 if(!pathname.startsWith(BASE)){res.writeHead(404);return res.end('Not found');}
 const file=pathname.slice(BASE.length)||'index.html';if(!allowed.has(file)){res.writeHead(404);return res.end('Not found');}
 fs.readFile(path.join(ROOT,file),(error,data)=>{if(error){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'})[ext]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);});
});}
if(require.main===module){const port=Number(process.env.PORT||4174);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid PORT');const server=createServer();server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+BASE));}
module.exports={createServer};
