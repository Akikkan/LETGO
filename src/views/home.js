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
