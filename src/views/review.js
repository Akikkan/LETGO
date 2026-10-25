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
    ? `<video class="review-video" src="${esc(photo.src)}"${photo.poster ? ` poster="${esc(photo.poster)}"` : ''} crossorigin="anonymous" controls preload="metadata" playsinline aria-label="${esc(photo.name || '视频')}" ></video>`
    : photo.src ? `<img class="review-image" src="${esc(photo.src)}" crossorigin="anonymous" alt="${esc(photo.name || '照片')}" />` : '<span class="review-empty">暂无照片</span>';
  const statusLabels = { keep: '✓ 收录', skip: '↷ 跳过', reject: '⌫ 删除' };
  const keepText = reviewReject ? '恢复收录' : '收录';
  const rejectText = reviewReject ? '确认删除' : '删除';
  const pct = total ? Math.min(100, Math.round(processed / total * 100)) : 0;

  const progressHTML = `<div class="review-head-center">
    <div class="review-progress-expanded" aria-label="已处理 ${processed} 张，共 ${total} 张">
      <div class="review-progress-stats">
        <span class="review-progress-label">整理进度</span>
        <span class="review-progress-num"><strong>${processed}</strong><span class="review-progress-total"> / ${total}</span></span>
        <span class="review-progress-pct">${pct}%</span>
      </div>
      <div class="review-bar-wrapper">
        <div class="review-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${processed}">
          <span class="review-bar-fill" style="width:${pct}%"></span>
          <div class="review-bar-ticks">
            <span class="tick tick-25 ${pct >= 25 ? 'reached' : ''}" title="25% 里程碑"></span>
            <span class="tick tick-50 ${pct >= 50 ? 'reached' : ''}" title="50% 里程碑"></span>
            <span class="tick tick-75 ${pct >= 75 ? 'reached' : ''}" title="75% 里程碑"></span>
          </div>
        </div>
        ${complete ? '<span class="review-done" aria-label="全部完成" title="整理达成 100%！">🏆</span>' : ''}
      </div>
    </div>
  </div>`;

  return `<section class="review" aria-label="照片整理"><div class="review-shell">
  <header class="review-head">
    <div class="review-head-left">
      <div class="review-name">${esc(s?.name || '')}${reviewReject ? '<span class="review-mode">删除复审</span>' : ''}</div>
      <button class="review-mini" data-action="compare" aria-label="照片对比" data-tooltip="照片对比">◫</button>
      <button class="review-mini" data-action="overview" aria-label="素材清单" data-tooltip="素材清单">☷</button>
    </div>
    ${progressHTML}
    <div class="review-head-right"></div>
  </header>
  <div class="review-photo" aria-label="${isVideo ? '视频预览' : '照片预览'}"><div class="image-viewport">${media}${photo.status && statusLabels[photo.status] ? `<span class="review-status">${statusLabels[photo.status]}</span>` : ''}${!isVideo&&photo.src?`<div class="image-minimap" aria-label="当前图片可见范围" hidden><img class="minimap-image" src="${esc(photo.src)}" alt="" draggable="false"><span class="minimap-window"></span></div>`:''}</div>${!isVideo&&photo.src?'<div class="image-zoom-controls" aria-label="图片缩放"><button type="button" data-zoom="out" aria-label="缩小图片">−</button><div class="zoom-track"><input class="zoom-slider" type="range" min="-100" max="100" step="1" value="0" aria-label="图片缩放" aria-valuetext="适应窗口"></div><button type="button" data-zoom="in" aria-label="放大图片">＋</button><button type="button" class="zoom-value" data-zoom="reset" aria-label="重置为适应窗口">适应</button></div>':''}</div>
  <div class="review-dock"><div class="review-tag-row" aria-label="照片标签">${tagButtons}<button type="button" class="review-new-tag" data-action="new-tag" aria-label="新建标签（Shift+Q）" data-tooltip="新建标签 · Shift+Q">+</button><button type="button" class="review-ai-toggle" data-action="toggle-ai" aria-pressed="${!!s?.ai}" aria-label="AI ${s?.ai ? '已开启' : '关闭'}"><span class="review-ai-dot"></span><span>AI</span></button></div>
  <nav class="review-actions" aria-label="照片操作"><button type="button" class="review-btn primary" data-action="keep" aria-label="${keepText}（F）" ${total ? '' : 'disabled'}><span class="review-icon">✓</span>${keepText} <kbd>F</kbd></button><button type="button" class="review-btn" data-action="skip" aria-label="跳过（D）" ${total ? '' : 'disabled'}><span class="review-icon">↷</span>跳过 <kbd>D</kbd></button><button type="button" class="review-btn" data-action="reject" aria-label="${rejectText}（X）" ${total ? '' : 'disabled'}><span class="review-icon">⌫</span>${rejectText} <kbd>X</kbd></button><button type="button" class="review-btn" data-action="undo" aria-label="撤销">↶</button><span class="review-spacer"></span><span class="review-nav"><button type="button" class="review-btn" data-action="prev" aria-label="上一张" ${index <= 0 ? 'disabled' : ''}>←</button><span class="review-count">${total ? index + 1 : 0} / ${total}</span><button type="button" class="review-btn" data-action="next" aria-label="下一张" ${index >= total - 1 ? 'disabled' : ''}>→</button></span><button type="button" class="review-btn" data-action="finish-review" aria-label="处理${processed ? `（${processed}）` : ''}">处理${processed ? ` ${processed}` : ''}</button></nav></div>
</div></section>`;
}
