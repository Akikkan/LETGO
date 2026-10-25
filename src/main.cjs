const {app,BrowserWindow,ipcMain,dialog,shell,protocol,net,session,nativeTheme}=require('electron');
const fs=require('node:fs/promises'),nodeFs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function safeRealpath(target){try{return await fs.realpath(target)}catch(e){if(e.code==='EPERM'){return new Promise((resolve,reject)=>nodeFs.realpath(target,(err,res)=>err?reject(err):resolve(res)))}throw e;}}
const {createStore}=require('./workspace.cjs');
const {readMetadata}=require('./metadata.cjs');
app.setName('LETGO');
const testMode=!app.isPackaged&&process.env.SHIGUANG_TEST==='1';
if(testMode&&process.env.SHIGUANG_TEST_DATA)app.setPath('userData',process.env.SHIGUANG_TEST_DATA);
protocol.registerSchemesAsPrivileged([
  {scheme:'sgapp',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}},
  {scheme:'sgmedia',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true,corsEnabled:true}}
]);
let win,store,working=false,preferences={theme:'light',translucent:true,colorTheme:'codex',customAccent:null,keepColor:null};
const opened=new Map(),plans=new Map();
function cache(w){if(w?.id&&Array.isArray(w.items))opened.set(w.id,{...w,itemMap:new Map(w.items.map(i=>[i.id,i]))});return w;}
function folderPart(value,fallback){let p=String(value||fallback).trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,50)||fallback;if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))p='_'+p;return p;}
function validSender(event){return win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url==='sgapp://ui/index.html';}
function handle(channel,fn){ipcMain.handle(channel,async(e,...args)=>{if(!validSender(e))return{ok:false,error:'请求来源无效'};try{return{ok:true,value:await fn(...args)}}catch(error){return{ok:false,error:error.message||'操作失败'}}});}
async function chooseDirectory(title){if(testMode)return title==='选择工作区'?process.env.SHIGUANG_TEST_SOURCE:process.env.SHIGUANG_TEST_OUTPUT;const r=await dialog.showOpenDialog(win,{title,properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];}
async function savePrefs(value){preferences={theme:value?.theme==='dark'?'dark':'light',translucent:value?.translucent!==false,colorTheme:value?.colorTheme||preferences.colorTheme||'codex',customAccent:value?.customAccent!==undefined?value.customAccent:(preferences.customAccent||null),keepColor:value?.keepColor!==undefined?value.keepColor:(preferences.keepColor||null)};await fs.writeFile(path.join(app.getPath('userData'),'appearance.json'),JSON.stringify(preferences));applyNativeAppearance();return preferences;}
function applyNativeAppearance(){nativeTheme.themeSource=preferences.theme;if(process.platform==='win32'){try{win?.setBackgroundMaterial(preferences.translucent?'acrylic':'none')}catch{}}if(process.platform==='darwin'){try{win?.setVibrancy(preferences.translucent?'under-window':null)}catch{}}win?.setBackgroundColor(preferences.translucent?'#00000000':preferences.theme==='dark'?'#202630':'#f0f4fa');}
async function registerProtocols(){
 protocol.handle('sgapp',async request=>{const u=new URL(request.url);const filename=decodeURIComponent(u.pathname);if(u.hostname!=='ui'||!['/index.html','/app.js','/style.css'].includes(filename))return new Response('',{status:404});return net.fetch(pathToFileURL(path.join(__dirname,'../ui',filename)).href);});
 protocol.handle('sgmedia',async request=>{try{const u=new URL(request.url),w=opened.get(u.hostname),item=w?.itemMap.get(decodeURIComponent(u.pathname.slice(1)));if(!item||item.trashed)return new Response('',{status:404});const target=path.resolve(w.sourceDir,item.relativePath),relative=path.relative(w.sourceDir,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid path');const canonical=await safeRealpath(target),expected=process.platform==='win32'?target.toLowerCase():target,actual=process.platform==='win32'?canonical.toLowerCase():canonical;if(expected!==actual)throw Error('Changed path');const stat=await fs.stat(target);if(!stat.isFile())throw Error('Not a file');const headers={};if(request.headers.get('range'))headers.Range=request.headers.get('range');const res=await net.fetch(pathToFileURL(target).href,{headers});const resHeaders=new Headers(res.headers);resHeaders.set('Access-Control-Allow-Origin','*');resHeaders.set('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');return new Response(res.body,{status:res.status,statusText:res.statusText,headers:resHeaders});}catch{return new Response('',{status:404})}});
}
function installHandlers(){
 handle('app:bootstrap',async()=>({version:app.getVersion(),preferences,recent:await store.list(),platform:process.platform}));
 handle('app:appearance',savePrefs);
 handle('item:metadata',async(id,itemId)=>{const w=opened.get(id)||await store.load(id);const item=w?.items?.find(i=>i.id===itemId);if(!item)return null;const target=path.resolve(w.sourceDir,item.relativePath);return readMetadata(target,{name:item.name,relativePath:item.relativePath,extension:'.'+item.extension});});
 handle('workspace:choose',async()=>{const dir=await chooseDirectory('选择工作区');if(!dir)return null;return cache(await store.open(dir));});
 handle('workspace:load',async id=>cache(await store.load(id)));
 handle('workspace:list',()=>store.list());
 handle('workspace:rescan',async id=>{const w=await store.load(id);return cache(await store.open(w.sourceDir));});
 handle('workspace:save',async(id,value)=>cache(await store.save(id,value)));
 handle('workspace:plan',async id=>{const parent=await chooseDirectory('选择收录输出文件夹');if(!parent)return null;const w=await store.load(id);const dir=path.join(parent,folderPart(w.settings.trip||w.settings.name,'旅程'),folderPart(w.settings.collection,'收录'));const plan=await store.plan(id,dir);plans.set(plan.token,{id,dir,plan});return plan;});
 handle('workspace:execute',async(id,token)=>{
  const known=plans.get(token);if(!known||known.id!==id)throw Error('方案已失效，请重新预览');if(working)throw Error('正在处理素材');
  if(!testMode){const r=await dialog.showMessageBox(win,{type:'question',title:'确认整理',message:'执行这次整理？',detail:`收录 ${known.plan.kept} 项，删除 ${known.plan.deleted} 项。\n删除项与移动后的源文件会进入系统回收站。\n输出：${known.dir}`,buttons:['取消','确认执行'],defaultId:0,cancelId:0,noLink:true});if(r.response!==1)return null;}
  working=true;try{const result=await store.execute(id,token);const workspace=cache(await store.load(id));return{result,workspace};}finally{working=false;plans.delete(token);}
 });
 handle('workspace:reveal',async id=>{const w=await store.load(id);const error=await shell.openPath(w.sourceDir);if(error)throw Error(error);});
 handle('output:reveal',async(id,token)=>{const plan=plans.get(token);if(!plan||plan.id!==id)throw Error('请先选择输出目录');const error=await shell.openPath(plan.dir);if(error)throw Error(error);});
 handle('agent:export',async id=>{const payload=await store.exportManifest(id);const r=await dialog.showSaveDialog(win,{title:'导出 AI 素材清单',defaultPath:'shiguang-manifest.json',filters:[{name:'JSON',extensions:['json']}]});if(r.canceled)return null;await fs.writeFile(r.filePath,JSON.stringify(payload,null,2),'utf8');return{path:r.filePath};});
 handle('agent:import',async id=>{const r=await dialog.showOpenDialog(win,{title:'导入 AI 建议',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(r.canceled)return null;const st=await fs.stat(r.filePaths[0]);if(st.size>10*1024*1024)throw Error('建议文件超过 10 MB');const payload=JSON.parse(await fs.readFile(r.filePaths[0],'utf8'));return cache(await store.importSuggestions(id,payload));});
}
async function main(){
 await fs.mkdir(app.getPath('userData'),{recursive:true});try{const p=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'appearance.json'),'utf8'));preferences={theme:p.theme==='dark'?'dark':'light',translucent:p.translucent!==false,colorTheme:p.colorTheme||'codex',customAccent:p.customAccent||null,keepColor:p.keepColor||null};}catch{}
 store=createStore({dataDir:path.join(app.getPath('userData'),'workspaces'),readMetadata,trashItem:async file=>{if(testMode){const dir=path.join(app.getPath('userData'),'test-trash');await fs.mkdir(dir,{recursive:true});await fs.rename(file,path.join(dir,Date.now()+'-'+path.basename(file)));}else await shell.trashItem(file);},onProgress:value=>{if(win&&!win.isDestroyed())win.webContents.send('workspace:progress',value);}});
 await registerProtocols();installHandlers();session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
 win=new BrowserWindow({title:'LETGO',icon:path.join(__dirname,'icon.png'),width:1280,height:900,minWidth:780,minHeight:640,show:!testMode,backgroundColor:preferences.translucent?'#00000000':(preferences.theme==='dark'?'#202630':'#f0f4fa'),backgroundMaterial:process.platform==='win32'&&preferences.translucent?'acrylic':undefined,vibrancy:process.platform==='darwin'&&preferences.translucent?'under-window':undefined,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false,devTools:!app.isPackaged}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url!=='sgapp://ui/index.html')event.preventDefault()});
 win.on('close',event=>{if(working){event.preventDefault();dialog.showMessageBox(win,{message:'正在整理素材，请等待本次操作结束。',buttons:['好']});}});
 applyNativeAppearance();await win.loadURL('sgapp://ui/index.html');
}
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus()}});app.whenReady().then(main).catch(error=>{dialog.showErrorBox('LETGO无法启动',error.stack||error.message);app.quit()});app.on('window-all-closed',()=>app.quit());}
