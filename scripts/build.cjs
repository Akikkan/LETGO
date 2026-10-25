const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),views=path.join(root,'src/views'),ui=path.join(root,'ui');fs.mkdirSync(ui,{recursive:true});
const base=fs.readFileSync(path.join(views,'base-shell.html'),'utf8');
const css=[...base.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')+['review.css','glass.css','flow.css'].map(n=>fs.readFileSync(path.join(views,n),'utf8')).join('\n')+fs.readFileSync(path.join(root,'src/desktop.css'),'utf8')+fs.readFileSync(path.join(root,'src/project-sidebar.css'),'utf8')+fs.readFileSync(path.join(root,'src/inspector-sidebar.css'),'utf8')+fs.readFileSync(path.join(root,'src/image-viewer.css'),'utf8');
let js=['naming.js','home.js','setup.js','review.js','settings.js'].map(n=>fs.readFileSync(path.join(views,n),'utf8')).join('\n')+['project-sidebar.js','inspector-sidebar.js','image-viewer.js','renderer.js'].map(n=>fs.readFileSync(path.join(root,'src',n),'utf8')).join('\n');
js='(()=>{\n'+js+'\n})();';new vm.Script(js);fs.writeFileSync(path.join(ui,'app.js'),js);fs.writeFileSync(path.join(ui,'style.css'),css);
fs.copyFileSync(path.join(root,'src/index.html'),path.join(ui,'index.html'));
if(fs.existsSync(path.join(root,'src/icon.png')))fs.copyFileSync(path.join(root,'src/icon.png'),path.join(ui,'icon.png'));
console.log('Built desktop UI');
