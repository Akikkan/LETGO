(()=>{
function filenamePart(value, fallback) {
  const clean=String(value||'').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').replace(/_+/g,'-');
  return clean||fallback;
}
function filenameTime(photo) {
  // Preserve the camera's recorded wall time; do not convert it to the browser timezone.
  const source=String(photo.capturedAt||photo.name||'');
  const match=source.match(/((?:19|20)\d{2})[-:]?(\d{2})[-:]?(\d{2})[T _-]?(\d{2})[:\-]?(\d{2})[:\-]?(\d{2})/);
  if(!match)return {text:'未知时间',source:'缺少拍摄时间'};
  const [,y,m,d,h,min,sec]=match;const date=new Date(Date.UTC(+y,+m-1,+d,+h,+min,+sec));
  if(date.getUTCFullYear()!==+y||date.getUTCMonth()!==+m-1||date.getUTCDate()!==+d||+h>23||+min>59||+sec>59)return {text:'未知时间',source:'拍摄时间无效'};
  return {text:`${y}${m}${d}-${h}${min}${sec}`,source:photo.capturedAt?'素材拍摄时间':'原文件名中的时间'};
}
function filenamePlans(s,photos) {
  const used=new Set();
  return photos.filter(p=>p.status==='keep').map(photo=>{
    const trip=filenamePart(s.trip||s.name,'未命名旅程');const location=filenamePart(s.collection,'未指定地点');
    const type=filenamePart(photo.category||photo.tags?.[0],photo.kind==='video'?'视频':'照片');
    const time=filenameTime(photo);const extension=String(photo.extension||photo.name?.match(/\.([a-z0-9]{1,12})$/i)?.[1]||'').replace(/^\.+/,'').replace(/[^a-z0-9]/gi,'');
    const base=`${trip}_${location}_${type}_${time.text}`;let name=base+(extension?'.'+extension:'');let n=2;
    while(used.has(name.toLowerCase()))name=base+'_'+String(n++).padStart(2,'0')+(extension?'.'+extension:'');
    used.add(name.toLowerCase());return {photo,name,timeSource:time.source};
  });
}

function renderHome(s, photos) {
  const recent = Array.isArray(s && s.recent) ? s.recent : [];
  const recentRows = recent.map((workspace) => {
    const id = escapeHomeValue(workspace && workspace.id);
    const name = escapeHomeValue(workspace && workspace.name);
    const processed = Math.max(0, Number(workspace && workspace.processed) || 0);
    const total = Math.max(0, Number(workspace && workspace.total) || 0);
    const done = total > 0 && processed >= total;
    return `<button class="home-recent-row glass" type="button" data-workspace="${id}"><span class="home-recent-name">${name}</span><span class="home-recent-count">${done ? "🏆 " : ""}${processed} / ${total}</span></button>`;
  }).join("");
  return `
    <style>
      #shiguang .home-entry{min-height:360px;display:grid;place-items:center;padding:36px 20px;color:var(--ink)}
      #shiguang .home-entry-inner{width:min(100%,420px);display:flex;flex-direction:column;align-items:center;text-align:center}
      #shiguang .home-folder{width:76px;height:76px;border:1px solid var(--line);border-radius:24px;background:var(--surface);display:grid;place-items:center;color:var(--accent);box-shadow:0 8px 30px color-mix(in srgb,var(--ink) 7%,transparent)}
      #shiguang .home-folder-shape{position:relative;width:37px;height:26px;margin-top:5px;border:2px solid currentColor;border-radius:5px;background:color-mix(in srgb,var(--accent) 15%,transparent)}
      #shiguang .home-folder-shape:before{content:"";position:absolute;left:-2px;top:-8px;width:16px;height:8px;border:2px solid currentColor;border-bottom:0;border-radius:4px 4px 0 0;background:var(--surface)}
      #shiguang .home-caption{margin:16px 0 25px;font-size:13px;color:var(--muted)}
      #shiguang .home-actions{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(100%,250px)}
      #shiguang .home-actions .button{width:100%;justify-content:center}
      #shiguang .home-demo{border:0;background:transparent;color:var(--muted);font:inherit;font-size:12px;padding:8px 12px;cursor:pointer}
      #shiguang .home-demo:hover{color:var(--ink)}
      #shiguang .home-recent{width:min(100%,360px);margin-top:30px;text-align:left}
      #shiguang .home-recent-title{margin:0 0 9px;color:var(--muted);font-size:11px;font-weight:500}
      #shiguang .home-recent-list{display:grid;gap:7px}
      #shiguang .home-recent-row{width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--line);border-radius:13px;color:var(--ink);text-align:left;cursor:pointer}
      #shiguang .home-recent-row:hover{border-color:var(--accent)}
      #shiguang .home-recent-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
      #shiguang .home-recent-count{flex:none;color:var(--muted);font-size:11px}
      @media(max-width:400px){#shiguang .home-entry{padding-inline:16px}#shiguang .home-folder{width:68px;height:68px;border-radius:21px}}
    </style>
    <section class="home-entry">
      <div class="home-entry-inner">
        <div class="home-folder" aria-hidden="true"><span class="home-folder-shape"></span></div>
        <p class="home-caption">照片与视频</p>
        <div class="home-actions">
          <button class="button primary" type="button" data-action="choose-folder">新建项目</button>
          <button class="home-demo" type="button" data-action="open-review">使用演示素材</button>
        </div>
        ${recent.length ? `<div class="home-recent"><h2 class="home-recent-title">最近项目</h2><div class="home-recent-list">${recentRows}</div></div>` : ""}
      </div>
    </section>`;
}

function escapeHomeValue(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderSetup(s, photos) {
  const state = s || {};
  const items = Array.isArray(photos) ? photos : [];
  const isVideo = (item) => {
    const value = String((item && (item.type || item.mime || item.src || item.name)) || "").toLowerCase();
    return item?.kind === "video" || value.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv)(?:$|[?#])/.test(value);
  };
  const videoCount = items.filter(isVideo).length;
  const photoCount = items.length - videoCount;
  const tags = Array.isArray(state.tags) ? state.tags : [];
  const archiveMode = state.archiveMode === "move" ? "move" : "copy";
  const aiMode = ["off", "suggest", "auto"].includes(state.aiMode) ? state.aiMode : "off";
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  return `
    <style>
      #shiguang .setup-page{max-width:820px;margin:0 auto;padding:22px clamp(16px,4vw,36px) 30px;color:var(--ink)}
      #shiguang .setup-back{appearance:none;border:0;background:transparent;color:var(--muted);padding:7px 0;font:inherit;font-size:13px;cursor:pointer}
      #shiguang .setup-back:hover{color:var(--ink)}
      #shiguang .setup-title{font-size:23px;line-height:1.3;font-weight:600;letter-spacing:.02em;margin:14px 0 6px}
      #shiguang .setup-count{font-size:13px;color:var(--muted);margin:0 0 25px}
      #shiguang .setup-count span+span:before{content:"·";padding:0 8px;color:var(--line)}
      #shiguang .setup-section{margin-top:24px}
      #shiguang .setup-section-title{font-size:14px;font-weight:600;margin:0 0 12px}
      #shiguang .setup-tags{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
      #shiguang .setup-tag{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:7px 12px;color:var(--ink);font:inherit;font-size:12px}
      #shiguang .setup-tag-add{border-style:dashed;color:var(--muted);cursor:pointer}
      #shiguang .setup-tag-manage{margin-top:11px;padding:0;border:0;background:transparent;color:var(--muted);font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
      #shiguang .setup-destination{font-size:13px;color:var(--muted);margin:0 0 10px}
      #shiguang .setup-destination strong{color:var(--ink);font-weight:500}
      #shiguang .setup-mode-row{display:flex;gap:10px;flex-wrap:wrap}
      #shiguang .setup-choice{display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);font-size:13px}
      #shiguang .setup-choice input{accent-color:var(--accent);margin:0}
      #shiguang .setup-ai-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      #shiguang .setup-ai-select{min-height:40px;min-width:190px;max-width:100%;padding:8px 32px 8px 11px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px}
      #shiguang .setup-ai-config{min-height:40px}
      #shiguang .setup-footer-note{font-size:11px;color:var(--muted);text-align:center;margin:19px 0 0}
      @media(max-width:440px){#shiguang .setup-title{font-size:21px}#shiguang .setup-mode-row{display:grid;grid-template-columns:1fr}#shiguang .setup-choice{width:100%}#shiguang .setup-ai-select{flex:1;min-width:0}}
    </style>
    <section class="flow-page setup-page">
      <header class="flow-header">
        <button class="setup-back" type="button" data-action="home">← 返回</button>
        <h1 class="setup-title">工作区设置</h1>
        <p class="setup-count"><span>${photoCount} 张照片</span><span>${videoCount} 个视频</span></p>
      </header>
      <form class="form-grid" autocomplete="off">
        <label class="field">工作区名称
          <input type="text" data-setting="name" value="${escape(state.name)}" placeholder="例如：京都周末">
        </label>
        <label class="field">旅程名称
          <input type="text" data-setting="trip" value="${escape(state.trip)}" placeholder="例如：春日漫游">
        </label>
        <label class="field">地点
          <input type="text" data-setting="collection" value="${escape(state.collection)}" placeholder="例如：京都">
        </label>
        <div class="setup-section">
          <h2 class="setup-section-title">标签</h2>
          <div class="setup-tags">${tags.map((tag,i) => `<span class="setup-tag">${escape(tag)} ${i<6?`<kbd>${"QWERTY"[i]}</kbd>`:""}</span>`).join("")}<button class="setup-tag setup-tag-add" type="button" data-action="new-tag">＋</button></div>
          <button class="setup-tag-manage" type="button" data-action="tags">管理标签</button>
        </div>
        <div class="setup-section">
          <h2 class="setup-section-title">整理好的素材</h2>
          <p class="setup-destination">整理好的素材 / <strong>${escape(state.trip || "旅程")}</strong> / <strong>${escape(state.collection || "地点")}</strong></p>
          <div class="setup-mode-row">
            <label class="setup-choice"><input type="radio" name="archiveMode" data-setting="archiveMode" value="copy" ${archiveMode === "copy" ? "checked" : ""}> 复制到整理目录</label>
            <label class="setup-choice"><input type="radio" name="archiveMode" data-setting="archiveMode" value="move" ${archiveMode === "move" ? "checked" : ""}> 移动到整理目录</label>
          </div>
        </div>
        <div class="setup-section">
          <h2 class="setup-section-title">AI 整理</h2>
          <div class="setup-ai-row">
            <select class="setup-ai-select" data-setting="aiMode" aria-label="AI 整理方式">
              <option value="off" ${aiMode === "off" ? "selected" : ""}>关闭</option>
              <option value="suggest" ${aiMode === "suggest" ? "selected" : ""}>仅建议</option>
              <option value="auto" ${aiMode === "auto" ? "selected" : ""}>自动预标记</option>
            </select>
            <button class="button setup-ai-config" type="button" data-action="ai">配置 AI</button>
          </div>
        </div>
        <footer class="flow-footer">
          <button class="button primary" type="button" data-action="start-review">开始筛选</button>
        </footer>
      </form>
      <p class="setup-footer-note">原型 · 路径与文件操作仅演示</p>
    </section>`;
}

function renderReview(s, photos) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = Array.isArray(photos) ? photos : [];
  const total = list.length;
  const index = Math.max(0, Math.min(Number(s?.index) || 0, Math.max(0, total - 1)));
  const photo = list[index] || {};
  const processed = list.filter(p => p.status).length;
  const complete = total > 0 && processed >= total;
  const reviewReject = s?.reviewMode === 'reject';
  const isVideo = photo.kind === 'video';
  const tags = Array.isArray(s?.tags) ? s.tags : [];
  const activeTags = Array.isArray(photo.tags) ? photo.tags : [];
  const tagButtons = tags.map((tag, i) => `<button type="button" class="review-tag ${activeTags.includes(tag) ? 'is-active' : ''}" data-tag="${esc(tag)}" aria-pressed="${activeTags.includes(tag)}" aria-label="标签 ${esc(tag)}${i < 6 ? `（${'QWERTY'[i]}）` : ''}"><span>${esc(tag)}</span>${i < 6 ? `<kbd>${'QWERTY'[i]}</kbd>` : ''}</button>`).join('');
  const time = Math.max(0, Number(s?.time) || 0);
  const duration = Math.max(1, Number(s?.duration) || 30);
  const actualVideo = isVideo && photo.playable && photo.src;
  const media = actualVideo
    ? `<video class="review-video" src="${esc(photo.src)}"${photo.poster ? ` poster="${esc(photo.poster)}"` : ''} controls preload="metadata" playsinline aria-label="${esc(photo.name || '视频')}" ></video>`
    : photo.src ? `<img class="review-image" src="${esc(photo.src)}" alt="${esc(photo.name || '照片')}" />` : '<span class="review-empty">暂无照片</span>';
  const statusLabels = { keep: '✓ 收录', skip: '↷ 跳过', reject: '⌫ 删除' };
  const keepText = reviewReject ? '恢复收录' : '收录';
  const rejectText = reviewReject ? '确认删除' : '删除';

  return `<section class="review" aria-label="照片整理"><div class="review-shell">
  <header class="review-head"><div class="review-name">${esc(s?.name || '')}${reviewReject ? '<span class="review-mode">删除复审</span>' : ''}</div><button class="review-mini" data-action="compare" aria-label="照片对比" data-tooltip="照片对比">◫</button><button class="review-mini" data-action="overview" aria-label="素材清单" data-tooltip="素材清单">☷</button><div class="review-progress" aria-label="已处理 ${processed} 张，共 ${total} 张"><strong>${processed}</strong><span>/ ${total}</span><span class="review-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${processed}"><span class="review-bar-fill" style="width:${total ? Math.min(100, processed / total * 100) : 0}%"></span></span>${complete ? '<span class="review-done" aria-label="全部完成">🏆</span>' : ''}</div></header>
  <div class="review-photo" aria-label="${isVideo ? '视频预览' : '照片预览'}"><div class="image-viewport">${media}${photo.status && statusLabels[photo.status] ? `<span class="review-status">${statusLabels[photo.status]}</span>` : ''}${!isVideo&&photo.src?`<div class="image-minimap" aria-label="当前图片可见范围" hidden><img class="minimap-image" src="${esc(photo.src)}" alt="" draggable="false"><span class="minimap-window"></span></div>`:''}</div>${!isVideo&&photo.src?'<div class="image-zoom-controls" aria-label="图片缩放"><button type="button" data-zoom="out" aria-label="缩小图片">−</button><div class="zoom-track"><input class="zoom-slider" type="range" min="-100" max="100" step="1" value="0" aria-label="图片缩放" aria-valuetext="适应窗口"></div><button type="button" data-zoom="in" aria-label="放大图片">＋</button><button type="button" class="zoom-value" data-zoom="reset" aria-label="重置为适应窗口">适应</button></div>':''}</div>
  <div class="review-dock"><div class="review-tag-row" aria-label="照片标签">${tagButtons}<button type="button" class="review-new-tag" data-action="new-tag" aria-label="新建标签（Shift+Q）" data-tooltip="新建标签 · Shift+Q">+</button><button type="button" class="review-ai-toggle" data-action="toggle-ai" aria-pressed="${!!s?.ai}" aria-label="AI ${s?.ai ? '已开启' : '关闭'}"><span class="review-ai-dot"></span><span>AI</span></button></div>
  <nav class="review-actions" aria-label="照片操作"><button type="button" class="review-btn primary" data-action="keep" aria-label="${keepText}（F）" ${total ? '' : 'disabled'}><span class="review-icon">✓</span>${keepText} <kbd>F</kbd></button><button type="button" class="review-btn" data-action="skip" aria-label="跳过（D）" ${total ? '' : 'disabled'}><span class="review-icon">↷</span>跳过 <kbd>D</kbd></button><button type="button" class="review-btn" data-action="reject" aria-label="${rejectText}（X）" ${total ? '' : 'disabled'}><span class="review-icon">⌫</span>${rejectText} <kbd>X</kbd></button><button type="button" class="review-btn" data-action="undo" aria-label="撤销">↶</button><span class="review-spacer"></span><span class="review-nav"><button type="button" class="review-btn" data-action="prev" aria-label="上一张" ${index <= 0 ? 'disabled' : ''}>←</button><span class="review-count">${total ? index + 1 : 0} / ${total}</span><button type="button" class="review-btn" data-action="next" aria-label="下一张" ${index >= total - 1 ? 'disabled' : ''}>→</button></span><button type="button" class="review-btn" data-action="finish-review" aria-label="处理${processed ? `（${processed}）` : ''}">处理${processed ? ` ${processed}` : ''}</button></nav></div>
</div></section>`;
}

function renderSettings(s, appearance) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const theme = appearance?.theme || s?.theme || 'light';
  const translucent = appearance?.translucent ?? s?.translucency ?? true;
  return `<section class="flow-page settings-page" aria-label="设置">
    <header class="flow-header"><button type="button" class="button muted" data-action="back" aria-label="返回">← 返回</button><div><div class="flow-eyebrow">${esc(s?.name || '工作区')}</div><h1>设置</h1></div></header>
    <div class="form-grid">
      <section class="setting-row"><div class="field"><label>外观</label><span>选择界面显示方式</span></div><div class="settings-actions"><button type="button" class="button ${theme === 'dark' ? 'primary' : 'muted'}" data-action="toggle-theme" aria-pressed="${theme === 'dark'}">${theme === 'dark' ? '深色' : '浅色'}模式</button><button type="button" class="button ${translucent ? 'primary' : 'muted'}" data-action="toggle-translucency" aria-pressed="${!!translucent}">液态玻璃 ${translucent ? '开启' : '关闭'}</button></div></section>
      <section class="setting-row"><div class="field"><label for="setting-auto-advance">自动前进</label><span>收录、跳过或删除后自动前进</span></div><input id="setting-auto-advance" type="checkbox" data-setting="autoAdvance" ${s?.autoAdvance !== false ? 'checked' : ''} aria-label="标记后自动前进" /></section>
      <button type="button" class="button muted settings-link" data-action="ai"><span><strong>AI 助手</strong><small>选择建议模式和模型来源</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="button muted settings-link" data-action="tags"><span><strong>标签管理</strong><small>调整标签名称和顺序</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="button muted settings-link" data-action="help"><span><strong>快捷键</strong><small>查看整理操作说明</small></span><span aria-hidden="true">›</span></button>
    </div>
  </section>`;
}

function renderTags(s) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tags = Array.isArray(s?.tags) ? s.tags : [];
  const rows = tags.map((tag, i) => `<div class="setting-row tag-setting-row"><label class="field" for="tag-name-${i}"><span>标签 ${i < 6 ? `<kbd>${'QWERTY'[i]}</kbd>` : ''}</span></label><input id="tag-name-${i}" type="text" value="${esc(tag)}" data-tag-index="${i}" aria-label="编辑标签 ${esc(tag)}" /><div class="tag-order"><button type="button" class="button muted" data-tag-up="${i}" aria-label="上移标签 ${esc(tag)}" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="button muted" data-tag-down="${i}" aria-label="下移标签 ${esc(tag)}" ${i === tags.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('');
  return `<section class="flow-page tags-page" aria-label="标签管理"><header class="flow-header"><button type="button" class="button muted" data-action="back" aria-label="返回">← 返回</button><div><div class="flow-eyebrow">整理偏好</div><h1>标签管理</h1></div></header><div class="form-grid"><div class="tags-list">${rows || '<p class="field">还没有标签</p>'}</div><button type="button" class="button primary" data-action="new-tag" aria-label="新建标签">＋ 新建标签</button></div></section>`;
}

function renderAI(s, photos) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mode = ['off', 'suggest', 'auto'].includes(s?.aiMode) ? s.aiMode : 'off';
  const provider = s?.aiProvider === 'agent' ? 'agent' : 'local';
  const done = !!s?.aiDone;
  const count = Array.isArray(photos) ? photos.length : 0;
  const progress = Math.max(0, Math.min(100, Number(s?.aiProgress) || 0));
  const suggestions = (Array.isArray(s?.aiSuggestions) ? s.aiSuggestions : ['重复照片', '轻微模糊', '推荐保留']).slice(0, 3);
  return `<section class="flow-page ai-page" aria-label="AI 助手"><header class="flow-header"><button type="button" class="button muted" data-action="back" aria-label="返回">← 返回</button><div><div class="flow-eyebrow">${esc(s?.name || '工作区')}</div><h1>AI 助手</h1></div><span class="ai-status">未连接 agent</span></header>
    <div class="form-grid"><div class="setting-row"><label class="field" for="ai-mode"><strong>建议模式</strong><span>控制 AI 建议的使用方式</span></label><select id="ai-mode" data-setting="aiMode"><option value="off" ${mode === 'off' ? 'selected' : ''}>关闭</option><option value="suggest" ${mode === 'suggest' ? 'selected' : ''}>仅建议</option><option value="auto" ${mode === 'auto' ? 'selected' : ''}>自动预标记</option></select></div>
    <div class="setting-row"><label class="field" for="ai-provider"><strong>模型来源</strong></label><select id="ai-provider" data-setting="aiProvider"><option value="local" ${provider === 'local' ? 'selected' : ''}>本地模型</option><option value="agent" ${provider === 'agent' ? 'selected' : ''}>外部Agent（MCP）</option></select></div>
    <div class="ai-capabilities" aria-label="能力范围"><div class="setting-row"><span>素材预览</span><span aria-label="支持">✓</span></div><div class="setting-row"><span>提交标签建议</span><span aria-label="支持">✓</span></div><div class="setting-row"><span>不执行文件操作</span><span aria-label="不会执行">✓</span></div></div>
    <div class="ai-demo"><button type="button" class="button primary" data-action="run-ai">模拟粗筛</button><span class="field">${count} 项素材 · 模拟数据</span></div>
    ${s?.aiProgress != null && !done ? `<div class="ai-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>` : ''}
    ${done ? `<div class="ai-results"><h2>模拟建议</h2><p class="field">以下结果为模拟数据</p><div class="ai-suggestions">${suggestions.map((item, i) => `<div class="setting-row"><span>${esc(item)}</span><button type="button" class="button muted" data-action="apply-ai" data-suggestion-index="${i}" aria-label="应用建议：${esc(item)}">应用</button></div>`).join('')}</div></div>` : ''}</div></section>`;
}

function renderHelp(s) {
  const keys = [
    ['F', '收录'], ['D', '跳过'], ['X', '删除'], ['Q / W / E / R / T / Y', '添加对应标签'], ['Shift + Q', '新建标签'], ['Ctrl / ⌘ + Z', '撤销'], ['← / →', '上一张 / 下一张'], ['空格', '播放 / 暂停视频'], ['J / L', '视频快退 / 快进']
  ];
  return `<section class="flow-page help-page" aria-label="快捷键"><header class="flow-header"><button type="button" class="button muted" data-action="back" aria-label="返回">← 返回</button><div><div class="flow-eyebrow">${String(s?.name ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</div><h1>快捷键</h1></div></header><div class="form-grid shortcut-table" role="table" aria-label="整理快捷键">${keys.map(([key, action]) => `<div class="setting-row" role="row"><span role="cell"><kbd>${key}</kbd></span><span role="cell">${action}</span></div>`).join('')}</div></section>`;
}
const projectSidebarMedia = window.matchMedia('(max-width: 959px)');
let projectSidebarInitialized = false;

function projectSidebarExpandedPreference() {
  try { return window.localStorage.getItem('shiguang.projectSidebarExpanded') !== 'false'; }
  catch { return true; }
}

function setProjectSidebarExpandedPreference(expanded) {
  try { window.localStorage.setItem('shiguang.projectSidebarExpanded', String(expanded)); }
  catch { /* The sidebar still works when storage is unavailable. */ }
}

function syncProjectSidebarButton() {
  const root = document.querySelector('#shiguang');
  const button = document.querySelector('#sidebar-toggle');
  if (!root || !button) return;
  const expanded = projectSidebarMedia.matches
    ? root.classList.contains('sidebar-open')
    : !root.classList.contains('sidebar-collapsed');
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', expanded ? '收起项目栏' : '展开项目栏');
  button.title = expanded ? '收起项目栏' : '展开项目栏';
  const sidebar=document.querySelector('#project-sidebar');
  if(sidebar)sidebar.inert=!expanded;
}

function initializeProjectSidebar() {
  if (projectSidebarInitialized) return;
  projectSidebarInitialized = true;
  const root = document.querySelector('#shiguang');
  if (!root) return;
  root.classList.toggle('sidebar-collapsed', !projectSidebarExpandedPreference());
  root.classList.remove('sidebar-open');
  syncProjectSidebarButton();
}

function toggleProjectSidebar(force) {
  initializeProjectSidebar();
  const root = document.querySelector('#shiguang');
  if (!root) return;
  if (projectSidebarMedia.matches) {
    const open = typeof force === 'boolean' ? force : !root.classList.contains('sidebar-open');
    root.classList.toggle('sidebar-open', open);
  } else {
    const expanded = typeof force === 'boolean' ? force : root.classList.contains('sidebar-collapsed');
    root.classList.toggle('sidebar-collapsed', !expanded);
    root.classList.remove('sidebar-open');
    setProjectSidebarExpandedPreference(expanded);
  }
  syncProjectSidebarButton();
}

function renderProjectSidebar({ recent = [], activeId = null, busy = false } = {}) {
  initializeProjectSidebar();
  const list = document.querySelector('#project-list');
  if (!list) return;
  const projects = Array.isArray(recent) ? recent : [];
  list.innerHTML = projects.map((project) => {
    const id = escapeProjectSidebar(project.id);
    const name = escapeProjectSidebar(project.name || '未命名工作区');
    const total = Math.max(0, Number(project.total) || 0);
    const processed = Math.max(0, Number(project.processed) || 0);
    const complete = total > 0 && processed >= total;
    const current = String(project.id) === String(activeId);
    const percent = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    return `<div class="project-row${current ? ' is-active' : ''}">
      <button class="project-open" type="button" data-workspace="${id}" ${busy ? 'disabled' : ''} ${current ? 'aria-current="page"' : ''} title="${name}">
        <span class="project-name">${name}</span>
        <span class="project-progress"><span>${processed} / ${total}</span>${complete ? '<span class="project-trophy" aria-label="已完成">🏆</span>' : ''}</span>
        <span class="project-progress-track" aria-hidden="true"><span style="width:${percent}%"></span></span>
      </button>
      <button class="project-settings" type="button" data-project-settings="${id}" aria-label="设置 ${name}" title="项目设置" ${busy ? 'disabled' : ''}>⚙</button>
    </div>`;
  }).join('') || '<p class="project-empty">还没有项目</p>';
  syncProjectSidebarButton();
}

function escapeProjectSidebar(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

projectSidebarMedia.addEventListener('change', () => {
  const root = document.querySelector('#shiguang');
  if (!root) return;
  if (projectSidebarMedia.matches) root.classList.remove('sidebar-open');
  else {
    root.classList.remove('sidebar-open');
    root.classList.toggle('sidebar-collapsed', !projectSidebarExpandedPreference());
  }
  syncProjectSidebarButton();
});

// Image coordinates stay independent of window size. The centre value always fits.
function createImageViewer(){
 let key=null,position=0,focusX=.5,focusY=.5,viewport=null,img=null,slider=null,mini=null,windowBox=null,observer=null,drag=null;
 let width=0,height=0,renderWidth=0,renderHeight=0,offsetX=0,offsetY=0,miniWidth=0,miniHeight=0;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const scale=()=>position<0?Math.pow(4,position/100):Math.pow(8,position/100);
 function finishDrag(){if(!viewport)return;const pointer=drag?.id;drag=null;viewport.classList.remove('is-dragging');if(mini)mini.hidden=true;if(pointer!==undefined&&viewport.hasPointerCapture(pointer))viewport.releasePointerCapture(pointer);}
 function draw(){
  if(!viewport||!img?.naturalWidth||!img?.naturalHeight)return;
  width=viewport.clientWidth;height=viewport.clientHeight;if(!width||!height)return;
  const fit=Math.min(width/img.naturalWidth,height/img.naturalHeight),zoom=scale();renderWidth=img.naturalWidth*fit*zoom;renderHeight=img.naturalHeight*fit*zoom;
  offsetX=clamp((.5-focusX)*renderWidth,-Math.max(0,(renderWidth-width)/2),Math.max(0,(renderWidth-width)/2));
  offsetY=clamp((.5-focusY)*renderHeight,-Math.max(0,(renderHeight-height)/2),Math.max(0,(renderHeight-height)/2));
  focusX=.5-offsetX/renderWidth;focusY=.5-offsetY/renderHeight;
  img.style.width=`${renderWidth}px`;img.style.height=`${renderHeight}px`;img.style.transform=`translate3d(${(width-renderWidth)/2+offsetX}px,${(height-renderHeight)/2+offsetY}px,0)`;
  viewport.classList.toggle('can-pan',renderWidth>width+.5||renderHeight>height+.5);
  viewport.dataset.scale=String(zoom);viewport.dataset.panX=String(offsetX);viewport.dataset.panY=String(offsetY);
  slider.value=position;slider.disabled=false;slider.setAttribute('aria-valuetext',position===0?'适应窗口':`${Math.round(zoom*100)}%，相对于适应窗口`);
  const label=viewport.parentElement.querySelector('.zoom-value');label.textContent=position===0?'适应':`${Math.round(zoom*100)}%`;label.setAttribute('aria-label','重置为适应窗口');
  const thumbScale=Math.min(150/img.naturalWidth,100/img.naturalHeight);miniWidth=img.naturalWidth*thumbScale;miniHeight=img.naturalHeight*thumbScale;mini.style.width=`${miniWidth}px`;mini.style.height=`${miniHeight}px`;
  const left=(width-renderWidth)/2+offsetX,top=(height-renderHeight)/2+offsetY;
  const x0=clamp(-left/renderWidth,0,1),x1=clamp((width-left)/renderWidth,0,1),y0=clamp(-top/renderHeight,0,1),y1=clamp((height-top)/renderHeight,0,1);
  Object.assign(windowBox.style,{left:`${x0*miniWidth}px`,top:`${y0*miniHeight}px`,width:`${(x1-x0)*miniWidth}px`,height:`${(y1-y0)*miniHeight}px`});
 }
 function setZoom(value){position=clamp(Number(value)||0,-100,100);draw();}
 function pointerDown(event){if(event.button!==0||!viewport.classList.contains('can-pan'))return;event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,offsetX,offsetY};viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');mini.hidden=false;}
 function pointerMove(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();focusX=.5-(drag.offsetX+event.clientX-drag.x)/renderWidth;focusY=.5-(drag.offsetY+event.clientY-drag.y)/renderHeight;draw();}
 function pointerEnd(event){if(event.pointerId===drag?.id)finishDrag();}
 function reset(){finishDrag();position=0;focusX=focusY=.5;draw();}
 function detach(){finishDrag();observer?.disconnect();observer=null;window.removeEventListener('blur',finishDrag);if(viewport){viewport.removeEventListener('pointerdown',pointerDown);viewport.removeEventListener('pointermove',pointerMove);viewport.removeEventListener('pointerup',pointerEnd);viewport.removeEventListener('pointercancel',pointerEnd);viewport.removeEventListener('lostpointercapture',finishDrag);viewport.removeEventListener('dblclick',reset);}viewport=null;img=null;}
 function mount(container,mediaKey){detach();if(key!==mediaKey){key=mediaKey;position=0;focusX=focusY=.5;}viewport=container.querySelector('.image-viewport');img=viewport?.querySelector('.review-image');if(!img){viewport=null;return;}
  slider=container.querySelector('.zoom-slider');mini=container.querySelector('.image-minimap');windowBox=container.querySelector('.minimap-window');slider.value=position;slider.disabled=!img.complete||!img.naturalWidth;
  img.draggable=false;img.addEventListener('dragstart',event=>event.preventDefault());img.addEventListener('load',draw,{once:true});img.addEventListener('error',()=>{slider.disabled=true;finishDrag()},{once:true});
  slider.addEventListener('input',()=>setZoom(slider.value));container.querySelector('[data-zoom=reset]').addEventListener('click',reset);container.querySelector('[data-zoom=out]').addEventListener('click',()=>setZoom(position-10));container.querySelector('[data-zoom=in]').addEventListener('click',()=>setZoom(position+10));
  viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',pointerEnd);viewport.addEventListener('lostpointercapture',finishDrag);viewport.addEventListener('dblclick',reset);window.addEventListener('blur',finishDrag);
  observer=new ResizeObserver(()=>{finishDrag();draw()});observer.observe(viewport);draw();
 }
 return{mount,detach,reset};
}

const api=window.shiguang,root=document.getElementById('shiguang'),page=root.querySelector('#sg-page');
const esc=escapeHomeValue;
let workspace=null,photos=[],recent=[],appearance={theme:'light',translucent:true};
let s={view:'home',tags:[],index:0},history=[],backStack=[],activePlan=null,result=null,busy=false;
let pending=Promise.resolve(),saveCount=0,saveError=null,toastTimer;
const settingsKeys=['name','trip','collection','tags','autoAdvance','aiMode','archiveMode'];
const imageViewer=createImageViewer();
const statusText={keep:'收录',skip:'跳过',reject:'删除'};
function toast(message){const box=root.querySelector('#sg-toast');box.textContent=message;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),4500);}
function saveIndicator(){const label=root.querySelector('#save-state');label.textContent=saveError?'保存失败 · 点击重试':saveCount?'保存中…':workspace?'已保存':'';label.classList.toggle('saving-error',!!saveError);label.dataset.action=saveError?'retry-save':'';}
function applyAppearance(){root.dataset.theme=appearance.theme;root.style.colorScheme=appearance.theme;document.documentElement.style.colorScheme=appearance.theme;document.body.style.background=appearance.translucent?'transparent':appearance.theme==='dark'?'#202630':'#f0f4fa';root.classList.toggle('translucent',appearance.translucent);const b=root.querySelector('.app-chrome [data-action=toggle-theme]');b.textContent=appearance.theme==='dark'?'☾':'☀';b.setAttribute('aria-label',appearance.theme==='dark'?'切换日间模式':'切换暗夜模式');root.querySelector('.app-chrome [data-action=toggle-translucency]').setAttribute('aria-pressed',String(appearance.translucent));}
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
  if(p){html+=`<div class="review-fileline"><span>${esc(p.relativePath)}</span><span>${p.capturedAt?esc(p.capturedAt.replace('T',' ')):'未读取到拍摄时间'}</span></div>`;if(s.aiMode!=='off'&&p.suggestedTags?.length)html+=`<div class="suggestion-row"><span>AI 建议 · ${p.suggestedTags.map(esc).join(' · ')}</span><button class="button" data-action="accept-suggestion">采用标签</button></div>`;}
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
async function action(a){
 if(busy||s.view==='processing')return;
 if(a==='toggle-sidebar'){toggleProjectSidebar();return;}
 if(a==='close-sidebar'){toggleProjectSidebar(false);return;}
 if(a==='toggle-theme'||a==='toggle-translucency'){if(a==='toggle-theme')appearance.theme=appearance.theme==='light'?'dark':'light';else appearance.translucent=!appearance.translucent;applyAppearance();await api.appearance(appearance);if(s.view==='settings')render();return;}
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
root.addEventListener('click',e=>{if(busy||s.view==='processing')return;const target=e.target.closest('button,[data-action]');if(!target)return;
 if(target.dataset.projectSettings){openWorkspace(target.dataset.projectSettings,'setup').catch(report);return;}
 if(target.dataset.workspace){openWorkspace(target.dataset.workspace).catch(report);return;}
 if(target.dataset.tag){toggleTag(target.dataset.tag);return;}
 if(target.dataset.filter){s.filter=target.dataset.filter;s.listOffset=0;render();return;}
 if(target.dataset.photoIndex!==undefined){s.index=Number(target.dataset.photoIndex);changeView('review');return;}
 if(target.dataset.compareKeep!==undefined){const p=photos[Number(target.dataset.compareKeep)];if(available(p)){snapshot();p.status='keep';p.deleteReviewed=false;render();persist()}return;}
 if(target.dataset.addSuggested){const t=target.dataset.addSuggested;if(!s.tags.includes(t)){s.tags.push(t);persist();toast('已加入常用标签')}return;}
 if(target.dataset.tagUp!==undefined||target.dataset.tagDown!==undefined){const i=Number(target.dataset.tagUp??target.dataset.tagDown),j=i+(target.dataset.tagUp!==undefined?-1:1);if(s.tags[j]!==undefined){snapshot();[s.tags[i],s.tags[j]]=[s.tags[j],s.tags[i]];render();persist()}return;}
 if(target.dataset.action)action(target.dataset.action).catch(report);
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

})();