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
