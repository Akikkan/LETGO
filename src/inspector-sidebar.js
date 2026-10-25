// Inspector sidebar for real-time EXIF, histogram, RGB distribution, and dominant color palette
function createInspector() {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let currentPhoto = null;
  let canvas = null;
  let ctx = null;

  function render(photo, isOpen) {
    currentPhoto = photo;
    if (!photo) {
      return `<div class="inspector-empty"><span class="inspector-empty-icon">ℹ</span><p>暂无素材信息</p></div>`;
    }

    const isVideo = photo.kind === 'video';
    const cameraName = photo.camera || (isVideo ? '视频素材' : '标准相机');
    const lensName = photo.lens || (photo.camera ? '内置定焦镜头' : '--');
    const focalText = photo.focal35 || photo.focalLength || '--';
    const apertureText = photo.aperture || '--';
    const shutterText = photo.shutter || '--';
    const isoText = photo.iso ? (String(photo.iso).startsWith('ISO') ? photo.iso : `ISO ${photo.iso}`) : '--';
    const evText = photo.ev || '0.0 EV';
    const cctText = photo.cct || '--';

    const dims = (photo.width && photo.height) ? `${photo.width} × ${photo.height}` : '--';
    const mp = (photo.width && photo.height) ? `${((photo.width * photo.height) / 1000000).toFixed(1)} MP` : null;
    const sizeMB = photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : '--';
    const ext = (photo.extension || (isVideo ? 'mp4' : 'jpg')).toUpperCase();
    const timeText = photo.capturedAt ? photo.capturedAt.replace('T', ' ') : (photo.mtimeMs ? new Date(photo.mtimeMs).toLocaleString() : '--');

    // GPS location computation
    let gpsHTML = '';
    if (photo.latitude != null && photo.longitude != null) {
      const lat = Number(photo.latitude);
      const lon = Number(photo.longitude);
      const latRef = lat >= 0 ? 'N' : 'S';
      const lonRef = lon >= 0 ? 'E' : 'W';
      const coordStr = `${Math.abs(lat).toFixed(4)}° ${latRef}, ${Math.abs(lon).toFixed(4)}° ${lonRef}`;

      // Region hint for Japan trip
      let regionHint = 'GPS 坐标定位';
      if (lat >= 35.25 && lat <= 35.38 && lon >= 139.45 && lon <= 139.60) regionHint = '📍 日本 · 镰仓 / 相模湾';
      else if (lat >= 35.55 && lat <= 35.80 && lon >= 139.60 && lon <= 139.90) regionHint = '📍 日本 · 东京 / 涩谷·新宿';
      else if (lat >= 34.90 && lat <= 35.15 && lon >= 135.65 && lon <= 135.85) regionHint = '📍 日本 · 京都 / 鸭川·祇园';
      else if (lat >= 34.55 && lat <= 34.80 && lon >= 135.40 && lon <= 135.60) regionHint = '📍 日本 · 大阪 / 难波';
      else if (lat >= 30.0 && lat <= 46.0 && lon >= 128.0 && lon <= 146.0) regionHint = '📍 日本 旅拍坐标';

      gpsHTML = `<div class="inspector-card inspector-gps-card">
        <div class="inspector-card-title">
          <span>${regionHint}</span>
          <button type="button" class="inspector-copy-btn" data-action="copy-gps" data-coord="${esc(coordStr)}" title="复制经纬度坐标">复制</button>
        </div>
        <div class="inspector-gps-coords">${coordStr}</div>
        ${photo.altitude != null ? `<div class="inspector-gps-alt">海拔 ${photo.altitude} 米</div>` : ''}
      </div>`;
    }

    return `<header class="inspector-header">
      <div class="inspector-title-row">
        <span class="inspector-icon">◫</span>
        <h2>素材检查器</h2>
        <button type="button" class="inspector-close-btn" data-action="toggle-inspector" aria-label="收起检查器" title="收起检查器 (I)">✕</button>
      </div>
    </header>
    <div class="inspector-scroll">
      <!-- 1. Real-time Luminance & RGB Histogram -->
      <section class="inspector-section inspector-hist-section">
        <div class="inspector-section-head">
          <label>直方图与峰值表</label>
          <span class="inspector-hist-badge">RGB / 亮度</span>
        </div>
        <div class="inspector-canvas-box">
          <canvas class="inspector-histogram-canvas" width="290" height="92" aria-label="RGB 与亮度直方图"></canvas>
          <div class="inspector-clipping-row">
            <span class="clipping-pill shadow-pill" id="shadow-clipping">● 暗部: 0.0%</span>
            <span class="clipping-pill highlight-pill" id="highlight-clipping">● 高光: 0.0%</span>
          </div>
        </div>
      </section>

      <!-- 2. Dominant Color & Tone Harmony Compass -->
      <section class="inspector-section inspector-tone-section">
        <div class="inspector-section-head">
          <label>色彩与影调罗盘</label>
          <span class="inspector-tone-badge" id="inspector-tone-badge">分析中…</span>
        </div>
        <div class="tone-compass-box">
          <div class="temp-bar-header">
            <span class="temp-label cool-label"><span class="temp-dot cool-dot"></span>冷调 <strong id="cool-pct-val">--%</strong></span>
            <span class="temp-ratio-title">冷暖色温倾向</span>
            <span class="temp-label warm-label"><strong id="warm-pct-val">--%</strong> 暖调<span class="temp-dot warm-dot"></span></span>
          </div>
          <div class="temp-balance-track">
            <div class="temp-cool-fill" id="temp-cool-fill" style="width: 50%;"></div>
            <div class="temp-warm-fill" id="temp-warm-fill" style="width: 50%;"></div>
            <div class="temp-pointer" id="temp-pointer" style="left: 50%;"></div>
          </div>
          <div class="tone-indicators-row">
            <div class="tone-key-card">
              <span class="tone-ind-label">影调倾向</span>
              <strong class="tone-ind-val" id="tone-key-val">计算中…</strong>
            </div>
            <div class="tone-key-card">
              <span class="tone-ind-label">饱和度风格</span>
              <strong class="tone-ind-val" id="tone-sat-val">计算中…</strong>
            </div>
          </div>
        </div>
        <div class="inspector-palette-chips" id="inspector-palette-list">
          <div class="palette-loading">正在提取画面主色调…</div>
        </div>
      </section>

      <!-- 3. Core Exposure & Camera HUD -->
      <section class="inspector-section">
        <div class="inspector-section-head">
          <label>拍摄与曝光参数</label>
          <span class="inspector-cam-tag">${esc(cameraName)}</span>
        </div>
        <div class="inspector-exposure-grid">
          <div class="exposure-pill">
            <span class="exposure-label">焦距</span>
            <strong class="exposure-val">${esc(focalText)}</strong>
          </div>
          <div class="exposure-pill">
            <span class="exposure-label">光圈</span>
            <strong class="exposure-val">${esc(apertureText)}</strong>
          </div>
          <div class="exposure-pill">
            <span class="exposure-label">快门</span>
            <strong class="exposure-val">${esc(shutterText)}</strong>
          </div>
          <div class="exposure-pill">
            <span class="exposure-label">ISO</span>
            <strong class="exposure-val">${esc(isoText)}</strong>
          </div>
        </div>
        <div class="inspector-mini-params">
          <div class="mini-param-row"><span>曝光补偿</span><strong>${esc(evText)}</strong></div>
          <div class="mini-param-row"><span>白平衡色温</span><strong>${esc(cctText)}</strong></div>
          <div class="mini-param-row"><span>镜头信息</span><strong title="${esc(lensName)}">${esc(lensName)}</strong></div>
        </div>
      </section>

      <!-- 4. GPS Location Card (if available) -->
      ${gpsHTML}

      <!-- 5. File & Tech Details -->
      <section class="inspector-section">
        <div class="inspector-section-head">
          <label>素材基础信息</label>
        </div>
        <div class="inspector-info-list">
          <div class="info-row"><span>文件名</span><strong class="filename-text" title="${esc(photo.name)}">${esc(photo.name)}</strong></div>
          <div class="info-row"><span>格式规格</span><strong>${ext}${mp ? ` · ${mp}` : ''}</strong></div>
          <div class="info-row"><span>分辨率</span><strong>${dims}</strong></div>
          <div class="info-row"><span>文件大小</span><strong>${sizeMB}</strong></div>
          <div class="info-row"><span>拍摄时间</span><strong>${esc(timeText)}</strong></div>
          <div class="info-row"><span>路径</span><strong class="path-text" title="${esc(photo.relativePath)}">${esc(photo.relativePath)}</strong></div>
        </div>
      </section>
    </div>`;
  }

  function updateAnalysis(imgOrVideoElement) {
    if (!imgOrVideoElement) return;
    const sidebar = document.getElementById('inspector-sidebar');
    if (!sidebar || sidebar.clientWidth < 10) return;

    canvas = sidebar.querySelector('.inspector-histogram-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (imgOrVideoElement.tagName === 'IMG') {
      if (!imgOrVideoElement.complete || !imgOrVideoElement.naturalWidth) {
        imgOrVideoElement.addEventListener('load', () => updateAnalysis(imgOrVideoElement), { once: true });
        imgOrVideoElement.addEventListener('error', () => {
          const list = sidebar.querySelector('#inspector-palette-list');
          if (list) list.innerHTML = `<span class="inspector-sub">图片加载失败</span>`;
        }, { once: true });
        return;
      }
    } else if (imgOrVideoElement.tagName === 'VIDEO') {
      if (imgOrVideoElement.readyState < 2 || !imgOrVideoElement.videoWidth) {
        imgOrVideoElement.addEventListener('loadeddata', () => updateAnalysis(imgOrVideoElement), { once: true });
        return;
      }
    }

    // Use a small offscreen canvas to sample pixels quickly (under 2ms)
    try {
      const sampleW = 100;
      const sampleH = 100;
      const offscreen = document.createElement('canvas');
      offscreen.width = sampleW;
      offscreen.height = sampleH;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(imgOrVideoElement, 0, 0, sampleW, sampleH);
      const imgData = offCtx.getImageData(0, 0, sampleW, sampleH);
      const data = imgData.data;
      const totalPixels = sampleW * sampleH;

      const rHist = new Float32Array(256);
      const gHist = new Float32Array(256);
      const bHist = new Float32Array(256);
      const lHist = new Float32Array(256);

      let shadowCount = 0;
      let highlightCount = 0;
      let warmPixels = 0;
      let coolPixels = 0;
      let totalLum = 0;
      let totalSat = 0;

      // Color quantization map for palette extraction (bucket by 5-bit RGB)
      const colorBuckets = new Map();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        totalLum += lum;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const sat = max === 0 ? 0 : delta / max;
        totalSat += sat;

        // Color temperature categorization (HSV Hue angle)
        if (sat > 0.12 && lum > 18 && lum < 248) {
          let hue = 0;
          if (delta > 0) {
            if (max === r) hue = ((g - b) / delta) % 6;
            else if (max === g) hue = (b - r) / delta + 2;
            else hue = (r - g) / delta + 4;
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;
          }
          if (hue >= 330 || hue <= 68) warmPixels++;
          else if (hue >= 165 && hue <= 270) coolPixels++;
        }

        rHist[r]++;
        gHist[g]++;
        bHist[b]++;
        lHist[lum]++;

        if (lum <= 4) shadowCount++;
        if (lum >= 251) highlightCount++;

        // Quantize to 32 steps (32*8=256)
        const qr = (r >> 3) << 3;
        const qg = (g >> 3) << 3;
        const qb = (b >> 3) << 3;
        const key = (qr << 16) | (qg << 8) | qb;
        colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
      }

      // 1. Draw Histogram
      drawHistogram(rHist, gHist, bHist, lHist, totalPixels);

      // 2. Update Clipping Badges
      const shadowPct = ((shadowCount / totalPixels) * 100).toFixed(1);
      const highlightPct = ((highlightCount / totalPixels) * 100).toFixed(1);
      const shadowEl = sidebar.querySelector('#shadow-clipping');
      const highlightEl = sidebar.querySelector('#highlight-clipping');
      if (shadowEl) {
        shadowEl.textContent = `● 暗部: ${shadowPct}%`;
        shadowEl.classList.toggle('has-clipping', Number(shadowPct) >= 3.0);
      }
      if (highlightEl) {
        highlightEl.textContent = `● 高光: ${highlightPct}%`;
        highlightEl.classList.toggle('has-clipping', Number(highlightPct) >= 3.0);
      }

      // 3. Update Cold vs Warm Compass & Tone Keying
      const colorTempTotal = coolPixels + warmPixels;
      let coolPct = 50;
      let warmPct = 50;
      if (colorTempTotal > 0) {
        coolPct = Math.round((coolPixels / colorTempTotal) * 100);
        warmPct = 100 - coolPct;
      }

      const avgLum = totalLum / totalPixels;
      let toneKey = '均衡中调 (Mid-Tone)';
      if (avgLum >= 155) toneKey = '高调明朗 (High-Key)';
      else if (avgLum <= 92) toneKey = '低调深沉 (Low-Key)';

      const avgSat = totalSat / totalPixels;
      let satVibe = '自然胶片 (中饱和)';
      if (avgSat < 0.18) satVibe = '日系微灰 (低饱和)';
      else if (avgSat > 0.42) satVibe = '电影鲜活 (高饱和)';

      let moodBadge = '自然胶片色调';
      if (coolPct >= 65) moodBadge = '清透冷调 · 蔚蓝海滨';
      else if (warmPct >= 65) moodBadge = '暖金落日 · 暖色温';
      else if (Math.abs(coolPct - warmPct) <= 18 && colorTempTotal >= 800) moodBadge = '经典橙青 · 电影冷暖';
      else if (avgLum >= 160) moodBadge = '通透高光 · 日系空气感';
      else if (avgLum <= 85) moodBadge = '深邃低调 · 电影暗光';

      const badgeEl = sidebar.querySelector('#inspector-tone-badge');
      if (badgeEl) badgeEl.textContent = moodBadge;

      const coolValEl = sidebar.querySelector('#cool-pct-val');
      const warmValEl = sidebar.querySelector('#warm-pct-val');
      if (coolValEl) coolValEl.textContent = `${coolPct}%`;
      if (warmValEl) warmValEl.textContent = `${warmPct}%`;

      const coolFillEl = sidebar.querySelector('#temp-cool-fill');
      const warmFillEl = sidebar.querySelector('#temp-warm-fill');
      const pointerEl = sidebar.querySelector('#temp-pointer');
      if (coolFillEl) coolFillEl.style.width = `${coolPct}%`;
      if (warmFillEl) warmFillEl.style.width = `${warmPct}%`;
      if (pointerEl) pointerEl.style.left = `${coolPct}%`;

      const toneKeyEl = sidebar.querySelector('#tone-key-val');
      const toneSatEl = sidebar.querySelector('#tone-sat-val');
      if (toneKeyEl) toneKeyEl.textContent = toneKey;
      if (toneSatEl) toneSatEl.textContent = satVibe;

      // 3. Extract Dominant Color Palette (Top 5 diverse colors)
      const sorted = [...colorBuckets.entries()].sort((a, b) => b[1] - a[1]);
      const palette = [];
      for (const [key, count] of sorted) {
        const r = (key >> 16) & 0xff;
        const g = (key >> 8) & 0xff;
        const b = key & 0xff;

        // Check color distance against already chosen palette colors to ensure diversity
        const tooClose = palette.some(p => {
          const dr = p.r - r;
          const dg = p.g - g;
          const db = p.b - b;
          return Math.sqrt(dr * dr + dg * dg + db * db) < 38;
        });

        if (!tooClose) {
          const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
          const pct = Math.round((count / totalPixels) * 100);
          palette.push({ r, g, b, hex, pct });
          if (palette.length >= 5) break;
        }
      }

      renderPalette(sidebar, palette);
    } catch (err) {
      const list = sidebar.querySelector('#inspector-palette-list');
      if (list) list.innerHTML = `<span class="inspector-sub">已准备就绪</span>`;
    }
  }

  function drawHistogram(rHist, gHist, bHist, lHist, totalPixels) {
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, 0); ctx.lineTo(w * 0.25, h);
    ctx.moveTo(w * 0.50, 0); ctx.lineTo(w * 0.50, h);
    ctx.moveTo(w * 0.75, 0); ctx.lineTo(w * 0.75, h);
    ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Find max for scaling
    let max = 1;
    for (let i = 0; i < 256; i++) {
      if (lHist[i] > max) max = lHist[i];
      if (rHist[i] > max) max = rHist[i];
      if (gHist[i] > max) max = gHist[i];
      if (bHist[i] > max) max = bHist[i];
    }

    const drawChannel = (hist, strokeStyle, fillStyle) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const val = Math.min(1, hist[i] / max);
        const y = h - val * (h - 6);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    // Draw RGB and Luminance layers
    ctx.globalCompositeOperation = 'screen';
    drawChannel(rHist, 'rgba(239, 68, 68, 0.85)', 'rgba(239, 68, 68, 0.22)');
    drawChannel(gHist, 'rgba(34, 197, 94, 0.85)', 'rgba(34, 197, 94, 0.20)');
    drawChannel(bHist, 'rgba(59, 130, 246, 0.85)', 'rgba(59, 130, 246, 0.22)');
    ctx.globalCompositeOperation = 'source-over';
    drawChannel(lHist, 'rgba(255, 255, 255, 0.90)', 'rgba(255, 255, 255, 0.12)');
  }

  function renderPalette(sidebar, palette) {
    const list = sidebar.querySelector('#inspector-palette-list');
    if (!list) return;
    if (!palette.length) {
      list.innerHTML = `<span class="inspector-sub">无法提取调色板</span>`;
      return;
    }

    list.innerHTML = palette.map(p => {
      return `<button type="button" class="palette-swatch" data-action="copy-color" data-color="${p.hex}" title="点击复制颜色 ${p.hex} (占比 ${p.pct}%)">
        <span class="swatch-color" style="background:${p.hex}"></span>
        <span class="swatch-pct">${p.pct}%</span>
        <span class="swatch-code">${p.hex}</span>
      </button>`;
    }).join('');
  }

  return { render, updateAnalysis };
}
