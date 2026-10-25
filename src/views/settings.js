const THEME_PRESETS = [
  { id: 'codex', name: 'Codex 翠绿', color: '#3d7a68', desc: '低饱和极客鼠尾草绿' },
  { id: 'telecaster', name: 'Fender 湖水蓝', color: '#416b85', desc: '日产 Lake Placid Blue 复古金属漆' },
  { id: 'tokyo', name: '东京魅夜', color: '#5a5782', desc: '雾气微醺低饱和暮靛蓝' },
  { id: 'kamakura', name: '镰仓暮色', color: '#8c6239', desc: '相模湾落日暖陶焦糖' },
  { id: 'sakura', name: '京都落樱', color: '#825363', desc: '鸭川暮樱雅致烟木粉' },
  { id: 'slate', name: '极简钛灰', color: '#54606e', desc: '深空哑光钛金属' }
];

function renderSettings(s, appearance) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const theme = appearance?.theme || s?.theme || 'light';
  const translucent = appearance?.translucent ?? s?.translucency ?? true;
  const colorTheme = appearance?.colorTheme || 'codex';
  const preset = THEME_PRESETS.find(p => p.id === colorTheme) || THEME_PRESETS[0];
  const customAccent = appearance?.customAccent || preset.color;
  const keepColor = appearance?.keepColor || preset.color;

  const presetsHTML = THEME_PRESETS.map(p => {
    const active = colorTheme === p.id && !appearance?.customAccent;
    return `<button type="button" class="preset-card ${active ? 'is-active' : ''}" data-action="set-preset-theme" data-preset="${p.id}" title="${p.name} - ${p.desc}">
      <span class="preset-dot" style="background:${p.color}"></span>
      <span class="preset-title">${p.name}</span>
    </button>`;
  }).join('');

  return `<section class="flow-page settings-page" aria-label="设置">
    <header class="flow-header"><button type="button" class="button muted" data-action="back" aria-label="返回">← 返回</button><div><div class="flow-eyebrow">${esc(s?.name || '工作区')}</div><h1>设置</h1></div></header>
    <div class="form-grid">
      <section class="setting-row">
        <div class="field"><label>界面主题</label><span>选择日常偏好的视觉模式</span></div>
        <div class="theme-segmented-control" role="group" aria-label="界面主题">
          <button type="button" class="theme-segment-btn ${theme === 'light' ? 'is-active' : ''}" data-action="set-theme-light" aria-pressed="${theme === 'light'}">☀ 浅色模式</button>
          <button type="button" class="theme-segment-btn ${theme === 'dark' ? 'is-active' : ''}" data-action="set-theme-dark" aria-pressed="${theme === 'dark'}">☾ 深色模式</button>
        </div>
      </section>
      <section class="setting-row">
        <div class="field"><label>液态玻璃效果</label><span>全局毛玻璃折射与悬浮水滴质感</span></div>
        <div class="settings-actions">
          <button type="button" class="toggle-translucent-btn ${translucent ? 'is-active' : ''}" data-action="toggle-translucency" aria-pressed="${!!translucent}">${translucent ? '✓ 已开启' : '○ 已关闭'}</button>
        </div>
      </section>
      <section class="setting-row preset-theme-row">
        <div class="field"><label>色彩主题预设</label><span>低饱和极简设计与经典工学配色</span></div>
        <div class="preset-theme-grid" role="group" aria-label="主题色彩预设">${presetsHTML}</div>
      </section>
      <section class="setting-row custom-colors-row">
        <div class="field"><label>组件自定义颜色</label><span>微调主强调色与「收录」按键的高光配色</span></div>
        <div class="custom-color-pickers">
          <label class="color-picker-item" title="全局主强调色、选中标签与分段器高光">
            <span>主强调色</span>
            <div class="color-picker-bubble">
              <input type="color" data-setting-color="customAccent" value="${customAccent}" />
              <span class="color-hex">${customAccent.toUpperCase()}</span>
            </div>
          </label>
          <label class="color-picker-item" title="筛选「收录」按钮的专属按键配色">
            <span>「收录」按键</span>
            <div class="color-picker-bubble">
              <input type="color" data-setting-color="keepColor" value="${keepColor}" />
              <span class="color-hex">${keepColor.toUpperCase()}</span>
            </div>
          </label>
          <button type="button" class="button droplet-btn reset-colors-btn" data-action="reset-theme-colors" title="重置为当前预设标准色彩">重置色彩</button>
        </div>
      </section>
      <section class="setting-row"><div class="field"><label for="setting-auto-advance">自动前进</label><span>收录、跳过或删除后自动前进</span></div><input id="setting-auto-advance" type="checkbox" data-setting="autoAdvance" ${s?.autoAdvance !== false ? 'checked' : ''} aria-label="标记后自动前进" /></section>
      <div class="settings-group-card" role="navigation" aria-label="偏好与操作指南">
        <button type="button" class="settings-group-row settings-link" data-action="ai">
          <div class="settings-group-text">
            <strong>AI 助手</strong>
            <small>选择建议模式和模型来源</small>
          </div>
          <span class="settings-group-arrow" aria-hidden="true">›</span>
        </button>
        <div class="settings-group-divider"></div>
        <button type="button" class="settings-group-row settings-link" data-action="tags">
          <div class="settings-group-text">
            <strong>标签管理</strong>
            <small>调整标签名称和顺序</small>
          </div>
          <span class="settings-group-arrow" aria-hidden="true">›</span>
        </button>
        <div class="settings-group-divider"></div>
        <button type="button" class="settings-group-row settings-link" data-action="help">
          <div class="settings-group-text">
            <strong>快捷键</strong>
            <small>查看整理操作说明</small>
          </div>
          <span class="settings-group-arrow" aria-hidden="true">›</span>
        </button>
      </div>
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
