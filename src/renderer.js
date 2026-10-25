const api=window.shiguang,root=document.getElementById('shiguang'),page=root.querySelector('#sg-page');
const esc=escapeHomeValue;
let workspace=null,photos=[],recent=[],appearance={theme:'light',translucent:true,colorTheme:'codex',customAccent:null,keepColor:null};
let s={view:'home',tags:[],index:0},history=[],backStack=[],activePlan=null,result=null,busy=false;
let pending=Promise.resolve(),saveCount=0,saveError=null,toastTimer;
const settingsKeys=['name','trip','collection','tags','autoAdvance','aiMode','archiveMode'];
const imageViewer=createImageViewer();
const statusText={keep:'收录',skip:'跳过',reject:'删除'};

const COLOR_PRESETS={
  codex:{id:'codex',color:'#3d7a68',darkColor:'#4e8e7c'},
  telecaster:{id:'telecaster',color:'#416b85',darkColor:'#5984a1'},
  tokyo:{id:'tokyo',color:'#5a5782',darkColor:'#726f9c'},
  kamakura:{id:'kamakura',color:'#8c6239',darkColor:'#a67c53'},
  sakura:{id:'sakura',color:'#825363',darkColor:'#9b6c7c'},
  slate:{id:'slate',color:'#54606e',darkColor:'#717e8e'}
};

function parseHex(hex){
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[16,163,127];
}
function adjustHex(hex,factor){
  const [r,g,b]=parseHex(hex);
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  if(factor>0)return `#${[r+(255-r)*factor,g+(255-g)*factor,b+(255-b)*factor].map(v=>clamp(v).toString(16).padStart(2,'0')).join('')}`;
  const f=1+factor;
  return `#${[r*f,g*f,b*f].map(v=>clamp(v).toString(16).padStart(2,'0')).join('')}`;
}

function toast(message){const box=root.querySelector('#sg-toast');box.textContent=message;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),4500);}
function saveIndicator(){const label=root.querySelector('#save-state');label.textContent=saveError?'保存失败 · 点击重试':saveCount?'保存中…':workspace?'已保存':'';label.classList.toggle('saving-error',!!saveError);label.dataset.action=saveError?'retry-save':'';}
function applyAppearance(){
  root.dataset.theme=appearance.theme;
  root.style.colorScheme=appearance.theme;
  document.documentElement.style.colorScheme=appearance.theme;
  document.body.style.background=appearance.translucent?'transparent':appearance.theme==='dark'?'#0c1017':'#f1f5f9';
  root.classList.toggle('translucent',appearance.translucent);

  const b=root.querySelector('.app-chrome [data-action=toggle-theme]');
  if(b){
    b.textContent=appearance.theme==='dark'?'☾':'☀';
    b.setAttribute('title',appearance.theme==='dark'?'当前：深色模式，点击切换为浅色':'当前：浅色模式，点击切换为深色');
    b.setAttribute('aria-label',appearance.theme==='dark'?'切换为浅色模式':'切换为深色模式');
  }
  const tb=root.querySelector('.app-chrome [data-action=toggle-translucency]');
  if(tb){
    tb.setAttribute('aria-pressed',String(appearance.translucent));
    tb.setAttribute('title',appearance.translucent?'液态玻璃：已开启，点击关闭':'液态玻璃：已关闭，点击开启');
  }

  const p=COLOR_PRESETS[appearance.colorTheme]||COLOR_PRESETS.codex;
  const isDark=appearance.theme==='dark';
  const accent=appearance.customAccent||(isDark?p.darkColor:p.color);
  const keep=appearance.keepColor||accent;

  const [ar,ag,ab]=parseHex(accent);
  const [kr,kg,kb]=parseHex(keep);

  root.style.setProperty('--accent',accent);
  root.style.setProperty('--accent-hover',adjustHex(accent,isDark?0.12:-0.12));
  root.style.setProperty('--accent-gradient',`linear-gradient(175deg, ${adjustHex(accent,0.12)} 0%, ${adjustHex(accent,-0.16)} 100%)`);
  root.style.setProperty('--accent-shadow',`rgba(${ar},${ag},${ab},${isDark?0.32:0.22})`);
  root.style.setProperty('--soft',`rgba(${ar},${ag},${ab},${isDark?0.14:0.08})`);
  root.style.setProperty('--soft-border',`rgba(${ar},${ag},${ab},${isDark?0.24:0.18})`);

  root.style.setProperty('--keep-accent',keep);
  root.style.setProperty('--keep-gradient',`linear-gradient(175deg, ${adjustHex(keep,0.12)} 0%, ${adjustHex(keep,-0.16)} 100%)`);
  root.style.setProperty('--keep-shadow',`rgba(${kr},${kg},${kb},${isDark?0.32:0.22})`);
  root.style.setProperty('--keep-glint',`rgba(${kr},${kg},${kb},0.75)`);
}
function payload(){return{settings:Object.fromEntries(settingsKeys.map(k=>[k,s[k]])),items:photos.map(p=>({id:p.id,status:p.status||null,tags:[...p.tags],deleteReviewed:!!p.deleteReviewed}))};}
function persist(){if(!workspace)return Promise.resolve();const id=workspace.id,data=payload();syncRecentProject();activePlan=null;saveCount++;saveIndicator();pending=pending.catch(()=>{}).then(()=>api.save(id,data)).then(()=>{saveError=null},error=>{saveError=error;toast('进度未保存：'+error.message)}).finally(()=>{saveCount--;saveIndicator()});return pending;}
function syncRecentProject(){if(!workspace)return;const row={id:workspace.id,name:s.name,sourceDir:workspace.sourceDir,total:photos.length,processed:photos.filter(p=>p.status).length};const i=recent.findIndex(p=>p.id===row.id);if(i>=0)recent[i]={...recent[i],...row};else recent.unshift(row);renderProjectSidebar({recent,activeId:workspace.id,busy:!!busy||s.view==='processing'});}
async function flush(){await pending;if(saveError)throw new Error('请先重试保存进度：'+saveError.message);}
function acceptWorkspace(w,view='review'){workspace=w;photos=w.items.map(p=>({...p,tags:p.tags||[],playable:true,src:`sgmedia://${w.id}/${p.id}`}));for(const p of photos){const op=[...(w.operations||[])].reverse().find(o=>o.itemId===p.id&&o.status==='completed');p.archived=op?.action==='move'||op?.action==='trash';p.archivedAction=op?.action;p.exportedTo=op?.destination;}
 s={...w.settings,view,index:Math.max(0,photos.findIndex(p=>!p.status&&!p.archived&&!p.missing)),reviewMode:null,zoom:false,milestones:Math.floor(photos.filter(p=>p.status).length/Math.max(1,photos.length)*4)};history=[];backStack=[];activePlan=null;result=null;syncRecentProject();render();}
function snapshot(){history.push({index:s.index,reviewMode:s.reviewMode,items:photos.map(p=>({status:p.status,tags:[...p.tags],deleteReviewed:p.deleteReviewed})),tags:[...s.tags]});if(history.length>60)history.shift();}
function changeView(view){if(s.view!==view)backStack.push(s.view);s.view=view;if(view==='review')s.reviewMode=null;s.newTag=false;render();}
function counts(){return{keep:photos.filter(p=>p.status==='keep').length,skip:photos.filter(p=>p.status==='skip').length,reject:photos.filter(p=>p.status==='reject').length,untouched:photos.filter(p=>!p.status).length};}
function countHTML(){const c=counts();return `<div class="flow-counts"><span>收录 <b>${c.keep}</b></span><span>跳过 <b>${c.skip}</b></span><span>删除 <b>${c.reject}</b></span><span>未处理 <b>${c.untouched}</b></span></div>`;}
function frame(title,body,footer=''){return `<section class="flow-page"><header class="flow-header"><button class="button" data-action="back" aria-label="返回">←</button><h1>${title}</h1></header>${body}${footer?`<footer class="flow-footer">${footer}</footer>`:''}</section>`;}
function render(){
 imageViewer.detach();root.classList.toggle('is-review',s.view==='review');renderProjectSidebar({recent,activeId:workspace?.id,busy:!!busy||s.view==='processing'});
 applyAppearance();root.querySelector('.workspace-title').textContent=workspace?s.name:'照片与视频';saveIndicator();root.classList.remove('zoomed');s.ai=s.aiMode!=='off';s.recent=recent;
 const oldVideo=page.querySelector('video'),oldVideoState=oldVideo?{src:oldVideo.getAttribute('src'),time:oldVideo.currentTime,paused:oldVideo.paused}:null;
 let html='';
 if(s.view==='home')html=renderHome(s,photos).replace(/<button class="home-demo"[\s\S]*?<\/button>/,'');
 else if(s.view==='setup')html=renderSetup(s,photos).replace('原型 · 路径与文件操作仅演示','').replace('工作区设置','整理设置')+`<div class="resume-tools"><button class="button" data-action="rescan">重新扫描</button><button class="button" data-action="reveal">打开源文件夹</button></div>`;
 else if(s.view==='review'){
  html=renderReview(s,photos);const p=photos[s.index];
  if(p){const timeText=p.capturedAt?esc(p.capturedAt.replace('T',' ')):(p.mtimeMs?`文件时间 ${new Date(p.mtimeMs).toISOString().slice(0,19).replace('T',' ')}`:'未读取到拍摄时间');html+=`<div class="review-fileline"><span>${esc(p.relativePath)}</span><span>${timeText}</span></div>`;const smartTags=(p.suggestedTags||[]).filter(t=>!p.tags?.includes(t));if(smartTags.length){html+=`<div class="suggestion-row"><span class="suggestion-label">推荐参数标签 ·</span>${smartTags.map(t=>`<button type="button" class="button tag-chip" data-quick-tag="${esc(t)}">＋ ${esc(t)}</button>`).join('')}</div>`;}}
 }else if(s.view==='confirm')html=renderArchive();
 else if(s.view==='processing')html=renderProgress();
 else if(s.view==='result')html=renderResultPage();
 else if(s.view==='overview')html=renderOverviewPage();
 else if(s.view==='history')html=renderHistoryPage();
 else if(s.view==='compare')html=renderComparePage();
 else if(s.view==='ai')html=renderAgentPage();
 else if(s.view==='tags')html=renderTags(s);
 else if(s.view==='settings')html=renderSettings(s,appearance)+(workspace?'<div class="resume-tools"><button class="button" data-action="setup">整理设置</button><button class="button" data-action="history">操作记录</button></div>':'');
 else html=renderHelp(s);
 page.innerHTML=html;
 if(s.view==='review'){
  const p=photos[s.index];if(p?.archived||p?.missing){const media=page.querySelector('.image-viewport');media.innerHTML=`<div class="unavailable"><span>${p.archivedAction==='trash'?'已移入回收站':p.archivedAction==='move'?'已移动至收录目录':'源文件不可用，请重新扫描'}</span><span>${esc(p.name)}</span></div>`;for(const b of page.querySelectorAll('[data-action=keep],[data-action=skip],[data-action=reject],[data-tag]'))b.disabled=true;}
  if(available(p)&&p.kind==='photo')imageViewer.mount(page,workspace.id+':'+p.id);else{const zoom=page.querySelector('.image-zoom-controls');if(zoom)zoom.hidden=true;}
  const current=page.querySelector('video');if(current&&oldVideoState?.src===current.getAttribute('src'))current.addEventListener('loadedmetadata',()=>{current.currentTime=Math.min(oldVideoState.time,current.duration||0);if(!oldVideoState.paused)current.play().catch(()=>{})},{once:true});
 }
 if(s.newTag){page.insertAdjacentHTML('beforeend','<div class="tag-dialog" role="dialog" aria-modal="true" aria-label="新建标签"><form id="tag-form"><input id="tag-name" maxlength="40" aria-label="标签名称" placeholder="标签名称" autocomplete="off"><button type="button" class="button" data-action="cancel-tag">取消</button><button class="button primary" type="submit">添加</button></form></div>');page.querySelector('#tag-name').focus();}
 if(busy)page.insertAdjacentHTML('beforeend',`<div class="busy-overlay" role="status"><span>${esc(typeof busy==='string'?busy:'正在处理…')}</span></div>`);
}
function renderArchive(){
 const needsReview=photos.filter(p=>p.status==='reject'&&!p.archived&&!p.deleteReviewed).length;
 const plans=activePlan?.entries||filenamePlans(s,photos.filter(p=>!p.archived)).map(x=>({id:x.photo.id,sourceRelative:x.photo.relativePath,name:x.name,action:s.archiveMode}));
 const rows=plans.slice(0,100).map(p=>`<div class="plan-row"><span>${esc(p.sourceRelative)}</span><span>→</span><span>${p.action==='trash'?'系统回收站':esc(p.name)}</span></div>`).join('');
 return frame('确认整理',`${countHTML()}<div class="form-grid"><label class="field">旅程<input data-setting="trip" value="${esc(s.trip)}" maxlength="60"></label><label class="field">地点<input data-setting="collection" value="${esc(s.collection)}" maxlength="60"></label></div><p class="path-line">旅程_地点_类型_时间</p><p class="path-line"><span>${activePlan?esc(activePlan.outputDir):'尚未选择收录目录'}</span><button class="button" data-action="choose-output" ${needsReview?'disabled':''}>${activePlan?'更换目录':'选择目录'}</button></p><div class="plan-list">${rows||'<p class="muted">没有需要归档的文件</p>'}</div>${plans.length>100?`<p class="muted">另有 ${plans.length-100} 项</p>`:''}<p class="ai-note">${s.archiveMode==='move'?'移动':'复制'}收录项；删除项进入系统回收站。</p>`,`${needsReview?`<button class="button" data-action="review-rejects">复审删除项 ${needsReview}</button>`:''}<button class="button primary" data-action="execute" ${!activePlan||!activePlan.entries.length||needsReview?'disabled':''}>确认执行</button>`);
}
function renderProgress(){const p=s.progress||{completed:0,total:0};return frame('正在整理',`<div class="flow-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.completed}"><span style="width:${p.total?p.completed/p.total*100:0}%"></span></div><div class="progress-detail"><span>${esc(p.current||'校验素材…')}</span><span>${p.completed} / ${p.total}</span></div>`);}
function renderResultPage(){const r=result;return frame(r?.errors?.length?'部分项目未完成':'本次整理完成',`${countHTML()}<p class="muted">${r?`成功 ${r.completed} / ${r.total} 项`:''}</p>${r?.errors?.map(e=>`<p class="error-text">${esc(e.message)}</p>`).join('')||''}`,`<button class="button" data-action="history">操作记录</button><button class="button" data-action="overview">素材清单</button><button class="button primary" data-action="back-review">继续筛选</button>`);}
function renderHistoryPage(){const ops=[...(workspace?.operations||[])].reverse();return frame('操作记录',ops.length?ops.slice(0,100).map(o=>`<article class="history-row"><strong>${esc({copy:'复制',move:'移动',trash:'移入回收站'}[o.action]||o.action)} · ${esc(o.name)}</strong><p>${esc(o.completedAt||o.startedAt||'')} · ${esc({completed:'完成',partial:'部分完成',failed:'失败',started:'中断，待核对'}[o.status]||o.status)}</p>${o.destination?`<p>${esc(o.destination)}</p>`:''}${o.error?`<p class="error-text">${esc(o.error)}</p>`:''}</article>`).join(''):'<p class="muted">暂无记录</p>',ops.length>100?`<span class="muted">显示最近 100 项</span>`:'');}
function renderOverviewPage(){const filter=s.filter||'all',mode=s.overviewMode||'grid',list=photos.map((p,i)=>({p,i})).filter(({p})=>filter==='all'||(filter==='none'?!p.status:p.status===filter)),offset=Math.min(s.listOffset||0,Math.max(0,Math.ceil(list.length/100)-1));s.listOffset=offset;const slice=list.slice(offset*100,(offset+1)*100);const filterNav=`<nav class="overview-filters">${[['all','全部'],['keep','收录'],['skip','跳过'],['reject','删除'],['none','未处理']].map(([v,n])=>`<button class="button" data-filter="${v}" aria-pressed="${filter===v}">${n}</button>`).join('')}</nav>`;const modeToggle=`<div class="overview-mode-toggle" role="group" aria-label="显示模式"><button class="button ${mode==='grid'?'is-active':''}" data-action="overview-mode-grid" aria-pressed="${mode==='grid'}" title="切换为小图预览">☷ 小图</button><button class="button ${mode==='list'?'is-active':''}" data-action="overview-mode-list" aria-pressed="${mode==='list'}" title="切换为列表模式">☰ 列表</button></div>`;let body='';if(!slice.length){body='<p class="muted">没有符合条件的素材</p>';}else if(mode==='grid'){body=`<div class="overview-grid">${slice.map(({p,i})=>{const isVideo=p.kind==='video';const thumb=isVideo?`<video src="${esc(p.src)}#t=0.01" preload="metadata" muted playsinline></video><span class="overview-badge-video">▶ 视频</span>`:`<img src="${esc(p.src)}" alt="${esc(p.name)}" loading="lazy">`;const badge=p.status?`<span class="overview-card-badge status-${p.status}">${statusText[p.status]}${p.archived?' ✓':''}</span>`:'';const tagsText=p.tags?.length?p.tags.map(esc).join(' · '):(statusText[p.status]||'未处理');return `<button class="overview-card" data-photo-index="${i}" title="${esc(p.relativePath)}"><div class="overview-card-thumb">${thumb}${badge}</div><div class="overview-card-info"><span class="overview-card-name">${esc(p.name)}</span><span class="overview-card-meta">${tagsText}</span></div></button>`;}).join('')}</div>`;}else{body=`<div class="overview-list">${slice.map(({p,i})=>{const isVideo=p.kind==='video';const thumb=isVideo?`<span class="overview-row-thumb is-video">▶</span>`:`<span class="overview-row-thumb"><img src="${esc(p.src)}" alt="" loading="lazy"></span>`;return `<button class="overview-row" data-photo-index="${i}">${thumb}<span class="overview-row-name">${esc(p.relativePath)}</span><span class="overview-row-tags">${p.tags.map(esc).join(' · ')}</span><span class="overview-row-status">${statusText[p.status]||'未处理'}${p.archived?' ✓':''}</span></button>`;}).join('')}</div>`;}return frame('素材清单',`<div class="overview-toolbar">${filterNav}${modeToggle}</div>${body}<div class="overview-footer"><button class="button" data-action="list-prev" ${offset?'':'disabled'}>←</button><span>${offset+1} / ${Math.max(1,Math.ceil(list.length/100))}</span><button class="button" data-action="list-next" ${(offset+1)*100>=list.length?'disabled':''}>→</button></div>`);}
function renderComparePage(){const candidates=photos.map((p,i)=>({p,i})).filter(x=>x.p.kind==='photo'&&!x.p.archived&&!x.p.missing);if(candidates.length<2)return frame('照片对比','<p class="muted">至少需要两张可用照片</p>');const at=(s.compareIndex||0)%candidates.length;return `<section class="flow-page compare-page"><header class="flow-header"><button class="button" data-action="back-review">←</button><h1>照片对比</h1><button class="button" data-action="compare-zoom" aria-label="同步放大" aria-pressed="${!!s.compareZoom}">⌕</button></header><div class="compare-pair ${s.compareZoom?'is-zoomed':''}">${[candidates[at],candidates[(at+1)%candidates.length]].map(({p,i})=>`<article><div class="compare-image"><img src="${esc(p.src)}" alt="${esc(p.name)}"></div><footer><span>${esc(p.name)}</span><button class="button ${p.status==='keep'?'primary':''}" data-compare-keep="${i}">✓ 收录</button></footer></article>`).join('')}</div><footer class="flow-footer"><button class="button" data-action="compare-next">下一组 →</button></footer></section>`;}
function renderAgentPage(){const tags=[...new Set(photos.flatMap(p=>p.suggestedTags||[]))];return frame('AI 助手',`<div class="setting-row"><label class="field">建议模式<select data-setting="aiMode"><option value="off" ${s.aiMode==='off'?'selected':''}>关闭</option><option value="suggest" ${s.aiMode==='suggest'?'selected':''}>仅建议</option><option value="auto" ${s.aiMode==='auto'?'selected':''}>收录时采用建议标签</option></select></label></div><div class="ai-demo"><button class="button" data-action="export-agent">导出素材清单</button><button class="button primary" data-action="import-agent">导入 AI 建议</button></div><p class="ai-note">将清单交给本地 agent，完成粗筛后导入建议文件。所有文件操作仍由你确认。</p><div class="setting-row"><span>已收到建议</span><span>${photos.filter(p=>p.suggestedTags?.length||p.suggestedStatus).length} / ${photos.length}</span></div>${tags.length?`<h2 class="plan-heading">常用标签建议</h2><div class="setup-tags">${tags.slice(0,24).map(t=>`<button class="button" data-add-suggested="${esc(t)}">＋ ${esc(t)}</button>`).join('')}</div>`:''}`);}
async function withBusy(label,fn){busy=label;render();try{return await fn()}finally{busy=false;render()}}
async function openWorkspace(id,view='review'){await flush();await withBusy('正在读取工作区…',async()=>{const w=await api.load(id);acceptWorkspace(w,view);if(matchMedia('(max-width:959px)').matches)toggleProjectSidebar(false);});}
function available(p){return p&&!p.archived&&!p.missing;}
function toggleTag(tag){const p=photos[s.index];if(!available(p))return;snapshot();p.tags=p.tags.includes(tag)?p.tags.filter(t=>t!==tag):[...p.tags,tag];render();persist();}
function decide(status){const p=photos[s.index];if(!available(p))return;snapshot();p.status=status;p.deleteReviewed=s.reviewMode==='reject'&&status==='reject';if(status==='keep'&&s.aiMode==='auto')p.tags=[...new Set([...p.tags,...(p.suggestedTags||[])])];s.zoom=false;
 if(s.reviewMode==='reject'){const next=photos.findIndex(x=>x.status==='reject'&&!x.deleteReviewed&&available(x));if(next<0){s.view='confirm';s.reviewMode=null}else s.index=next;}
 else if(s.autoAdvance){const next=photos.findIndex((x,i)=>i>s.index&&!x.status&&available(x)),first=photos.findIndex(x=>!x.status&&available(x));if(next>=0)s.index=next;else if(first>=0)s.index=first;}
 const quarter=Math.floor(photos.filter(p=>p.status).length/Math.max(1,photos.length)*4),award=quarter>(s.milestones||0);s.milestones=Math.max(s.milestones||0,quarter);render();persist();if(award)toast(quarter===4?'🏆 100%':`${['','◔','◑','◕'][quarter]} ${quarter*25}%`);
}
async function action(a, target){
 if(busy||s.view==='processing')return;
 if(a==='toggle-sidebar'){toggleProjectSidebar();return;}
 if(a==='close-sidebar'){toggleProjectSidebar(false);return;}
 if(a==='set-theme-light'||a==='set-theme-dark'){appearance.theme=a==='set-theme-dark'?'dark':'light';applyAppearance();await api.appearance(appearance);if(s.view==='settings')render();return;}
 if(a==='toggle-theme'||a==='toggle-translucency'){if(a==='toggle-theme')appearance.theme=appearance.theme==='light'?'dark':'light';else appearance.translucent=!appearance.translucent;applyAppearance();await api.appearance(appearance);if(s.view==='settings')render();return;}
 if(a==='set-preset-theme'){const p=target?.dataset.preset;if(p&&COLOR_PRESETS[p]){appearance.colorTheme=p;appearance.customAccent=null;appearance.keepColor=null;applyAppearance();await api.appearance(appearance);if(s.view==='settings')render();toast(`已应用色彩预设`);}return;}
 if(a==='reset-theme-colors'){appearance.customAccent=null;appearance.keepColor=null;applyAppearance();await api.appearance(appearance);if(s.view==='settings')render();toast('已恢复当前预设标准色彩');return;}
 if(a==='choose-folder'){await flush();await withBusy('正在扫描照片与视频…',async()=>{const w=await api.choose();if(w){acceptWorkspace(w,'setup');recent=await api.list()}});return;}
 if(a==='home'){await flush();recent=await api.list();changeView('home');return;}
 if(a==='retry-save'){await persist();return;}
 if(a==='help'){changeView('help');return;}
 if(a==='settings'){changeView('settings');return;}
 if(a==='back'){s.view=backStack.pop()||(workspace?'review':'home');render();return;}
 if(!workspace){toast('请先选择工作区');return;}
 if(['keep','skip','reject'].includes(a)){decide(a);return;}
 if(['setup','tags','ai','history','overview','compare'].includes(a)){changeView(a);return;}
 if(a==='start-review'){await flush();changeView('review');return;}
 if(a==='back-review'){changeView('review');return;}
 if(a==='finish-review'){await flush();changeView('confirm');return;}
 if(a==='new-tag'){s.newTag=true;render();return;}
 if(a==='cancel-tag'){s.newTag=false;render();return;}
 if(a==='toggle-ai'){changeView('ai');return;}
 if(a==='zoom'){imageViewer.reset();return;}
 if(a==='show-camera-info'){
  const p=photos[s.index];
  if(p){
   const info=[
    p.camera?`📷 ${p.camera}`:(p.kind==='video'?'🎬 视频素材':'📷 相机'),
    p.focal35?`焦距 ${p.focal35}`:null,
    p.aperture?`光圈 ${p.aperture}`:null,
    p.shutter?`快门 ${p.shutter}`:null,
    p.iso?(String(p.iso).startsWith('ISO')?p.iso:`ISO ${p.iso}`):null,
    p.ev?`曝光 ${p.ev}`:null,
    p.cct?`色温 ${p.cct}`:null,
    (p.width&&p.height)?`${p.width}×${p.height}`:null,
    p.recordedAt?`拍摄于 ${p.recordedAt.replace('T',' ')}`:null,
    p.name?`${p.name}`:null
   ].filter(Boolean);
   toast(info.join(' · '));
  }
  return;
 }
 if(a==='prev'||a==='next'){const queue=s.reviewMode==='reject'?photos.map((p,i)=>p.status==='reject'&&!p.archived?i:-1).filter(i=>i>=0):photos.map((_p,i)=>i);s.index=queue[Math.max(0,Math.min(queue.length-1,queue.indexOf(s.index)+(a==='next'?1:-1)))]??0;s.zoom=false;render();return;}
 if(a==='play'){const v=page.querySelector('video');if(v){if(v.paused)await v.play();else v.pause()}return;}
 if(a==='undo'){const h=history.pop();if(!h)return;photos.forEach((p,i)=>Object.assign(p,h.items[i]));s.tags=h.tags;s.index=h.index;s.reviewMode=h.reviewMode;s.view='review';render();persist();return;}
 if(a==='review-rejects'){const i=photos.findIndex(p=>p.status==='reject'&&!p.archived&&!p.deleteReviewed);if(i<0)return;s.index=i;s.reviewMode='reject';s.view='review';render();return;}
 if(a==='choose-output'){await flush();await withBusy('正在校验文件并生成方案…',async()=>{activePlan=await api.plan(workspace.id)});return;}
 if(a==='execute'){if(!activePlan)return;await flush();const token=activePlan.token;const answer=await api.execute(workspace.id,token);if(answer){const savedResult=answer.result;acceptWorkspace(answer.workspace,'result');result=savedResult;render()}else{s.view='confirm';render()}return;}
 if(a==='rescan'){await flush();await withBusy('正在重新扫描…',async()=>{acceptWorkspace(await api.rescan(workspace.id),'setup')});return;}
 if(a==='reveal'){await api.reveal(workspace.id);return;}
 if(a==='compare-next'){s.compareIndex=(s.compareIndex||0)+1;render();return;}
 if(a==='compare-zoom'){s.compareZoom=!s.compareZoom;render();return;}
 if(a==='list-prev'||a==='list-next'){s.listOffset=Math.max(0,(s.listOffset||0)+(a==='list-next'?1:-1));render();return;}
 if(a==='overview-mode-grid'){s.overviewMode='grid';render();return;}
 if(a==='overview-mode-list'){s.overviewMode='list';render();return;}
 if(a==='export-agent'){await flush();const r=await api.exportManifest(workspace.id);if(r)toast('已导出素材清单');return;}
 if(a==='import-agent'){await flush();const w=await api.importSuggestions(workspace.id);if(w){acceptWorkspace(w,'ai');toast('已导入建议')}return;}
 if(a==='accept-suggestion'){const p=photos[s.index];if(available(p)){snapshot();p.tags=[...new Set([...p.tags,...(p.suggestedTags||[])])];render();persist()}return;}
}
function report(error){console.error(error);toast(error.message||'操作失败');}
root.addEventListener('pointermove',e=>{
 const el=e.target.closest('.button, .review-btn, .overview-card, .project-row, .camera-param-bar, .tag-chip, .sidebar-new-project, .overview-mode-toggle .button, .droplet-btn, .theme-segment-btn, .toggle-translucent-btn, .preset-card, .settings-group-row');
 if(el){const r=el.getBoundingClientRect();el.style.setProperty('--mouse-x',`${(e.clientX-r.left).toFixed(1)}px`);el.style.setProperty('--mouse-y',`${(e.clientY-r.top).toFixed(1)}px`);}
});
root.addEventListener('click',e=>{if(busy||s.view==='processing')return;const target=e.target.closest('button,[data-action]');if(!target)return;
 if(target.dataset.projectSettings){openWorkspace(target.dataset.projectSettings,'setup').catch(report);return;}
 if(target.dataset.workspace){openWorkspace(target.dataset.workspace).catch(report);return;}
 if(target.dataset.tag){toggleTag(target.dataset.tag);return;}
 if(target.dataset.filter){s.filter=target.dataset.filter;s.listOffset=0;render();return;}
 if(target.dataset.photoIndex!==undefined){s.index=Number(target.dataset.photoIndex);changeView('review');return;}
 if(target.dataset.compareKeep!==undefined){const p=photos[Number(target.dataset.compareKeep)];if(available(p)){snapshot();p.status='keep';p.deleteReviewed=false;render();persist()}return;}
  if(target.dataset.quickTag){const t=target.dataset.quickTag,p=photos[s.index];if(available(p)){snapshot();if(!p.tags.includes(t))p.tags=[...p.tags,t];render();persist();toast(`已添加标签：${t}`);}return;}
 if(target.dataset.addSuggested){const t=target.dataset.addSuggested;if(!s.tags.includes(t)){s.tags.push(t);persist();toast('已加入常用标签')}return;}
 if(target.dataset.tagUp!==undefined||target.dataset.tagDown!==undefined){const i=Number(target.dataset.tagUp??target.dataset.tagDown),j=i+(target.dataset.tagUp!==undefined?-1:1);if(s.tags[j]!==undefined){snapshot();[s.tags[i],s.tags[j]]=[s.tags[j],s.tags[i]];render();persist()}return;}
 if(target.dataset.action)action(target.dataset.action, target).catch(report);
});
root.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.settingColor){
  appearance[el.dataset.settingColor]=el.value;
  const hex=el.parentElement?.querySelector('.color-hex');
  if(hex)hex.textContent=el.value.toUpperCase();
  applyAppearance();
  api.appearance(appearance).catch(report);
 }
});
root.addEventListener('change',e=>{const el=e.target;if(busy)return;if(el.dataset.setting){const key=el.dataset.setting;if(!settingsKeys.includes(key))return;s[key]=el.type==='checkbox'?el.checked:el.value;persist();if(el.tagName==='SELECT'||el.type==='checkbox'||el.type==='radio')render();else{const dest=page.querySelector('.setup-destination');if(dest)dest.textContent='整理好的素材 / '+(s.trip||'旅程')+' / '+(s.collection||'地点');const execute=page.querySelector('[data-action=execute]');if(execute)execute.disabled=true;const plans=page.querySelector('.plan-list');if(plans)plans.innerHTML=filenamePlans(s,photos.filter(p=>!p.archived)).slice(0,100).map(x=>`<div class="plan-row"><span>${esc(x.photo.relativePath)}</span><span>→</span><span>${esc(x.name)}</span></div>`).join('');}}
 if(el.dataset.tagIndex!==undefined){const i=Number(el.dataset.tagIndex),old=s.tags[i],next=el.value.trim();if(!next||s.tags.includes(next)){el.value=old;return}snapshot();s.tags[i]=next;photos.forEach(p=>p.tags=p.tags.map(t=>t===old?next:t));persist();render();}
});
root.addEventListener('submit',e=>{e.preventDefault();if(e.target.id!=='tag-form')return;const name=page.querySelector('#tag-name').value.trim();if(!name)return;snapshot();if(!s.tags.includes(name))s.tags.push(name);s.newTag=false;render();persist();});
root.addEventListener('error',e=>{if(e.target.classList.contains('minimap-image')){e.target.parentElement.hidden=true;return;}if(['IMG','VIDEO'].includes(e.target.tagName)){e.target.outerHTML='<div class="unavailable"><span>暂时无法预览此格式</span><span>可以跳过，或在原文件夹中查看</span><button class="button" data-action="reveal">打开源文件夹</button></div>';}},true);
document.addEventListener('keydown',e=>{if(busy||s.view==='processing'||e.isComposing||e.repeat)return;if(s.newTag){if(e.key==='Escape'){s.newTag=false;render()}if(e.key==='Tab'){const els=[...page.querySelectorAll('.tag-dialog input,.tag-dialog button')],at=els.indexOf(document.activeElement);e.preventDefault();els[(at+(e.shiftKey?-1:1)+els.length)%els.length].focus()}return;}const key=e.key.toLowerCase();const range=e.target.matches('input[type=range]');if((/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&(!range||['arrowleft','arrowright','arrowup','arrowdown','home','end','pageup','pagedown'].includes(key)))||e.target.isContentEditable)return;if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();action('undo').catch(report);return}if(e.ctrlKey||e.metaKey||e.altKey||s.view!=='review')return;if(e.shiftKey&&key==='q'){e.preventDefault();action('new-tag');return}const i='qwerty'.indexOf(key);if(key.length===1&&i>=0&&!e.shiftKey){e.preventDefault();if(s.tags[i])toggleTag(s.tags[i]);return}const a={f:'keep',d:'skip',x:'reject',arrowleft:'prev',arrowright:'next','?':'help',' ':'play'}[key];if(a){e.preventDefault();action(a).catch(report)}if(['j','l'].includes(key)){const v=page.querySelector('video');if(v){e.preventDefault();v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+(key==='j'?-5:5)))}}});
api.onProgress(p=>{if(p.workspaceId!==workspace?.id)return;if(p.phase==='scan'||p.phase==='plan'){const label=page.querySelector('.busy-overlay span');if(label)label.textContent=`${p.phase==='scan'?'正在扫描':'正在校验'} · ${p.current||''}`;return;}s.view='processing';s.progress=p;render();});
window.addEventListener('beforeunload',e=>{if(saveCount||saveError){e.preventDefault();e.returnValue='';toast('请等待进度保存完成后再关闭')}});
api.bootstrap().then(data=>{appearance=data.preferences;recent=data.recent;render()}).catch(report);
