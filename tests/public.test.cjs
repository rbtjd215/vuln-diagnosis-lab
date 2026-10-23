const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createServer}=require('../server.cjs');const docs=path.resolve(__dirname,'../docs');
test('static control IDs are unique so upload, evidence and view switching target one element',()=>{
 const html=fs.readFileSync(path.join(docs,'index.html'),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
test('public package contains code, license and fictional TXT only',()=>{
 const files=[];function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else files.push(p);}}walk(docs);
 for(const file of files){assert.match(file,/\.(?:html|css|js|md|txt)$|\.nojekyll$/);const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/(?:C:\\Users\\|\/mnt\/[a-z]\/)/);if(file.endsWith('.txt'))assert.match(text,/FICTIONAL/);}
 const html=fs.readFileSync(path.join(docs,'index.html'),'utf8'),ui=fs.readFileSync(path.join(docs,'workspace.js'),'utf8');assert.doesNotMatch(html,/(?:href|src)="\/sources\//);assert.doesNotMatch(ui,/`\/sources\//);assert.match(html,/value="student"/);assert.match(html,/connect-src 'none'/);
});
test('GitHub Pages subpath: assets and samples work; private paths are absent',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base='http://127.0.0.1:'+server.address().port;const root=await fetch(base+'/vuln-diagnosis-lab/');assert.equal(root.status,200);const html=await root.text();for(const src of [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map(m=>m[1]))assert.equal((await fetch(base+'/vuln-diagnosis-lab/'+src)).status,200,src);assert.equal((await fetch(base+'/vuln-diagnosis-lab/samples/fictional-01-08.txt')).status,200);for(const name of ['sources/account1.pdf','sources/password.jpg','../README.md','server.cjs'])assert.equal((await fetch(base+'/vuln-diagnosis-lab/'+name)).status,404,name);assert.equal((await fetch(base+'/vuln-diagnosis-lab/',{method:'POST'})).status,405);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
