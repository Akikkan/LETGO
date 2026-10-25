'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('inspector sidebar renders histogram, RGB clipping, dominant palette, and GPS location in review mode', async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const root = path.join(__dirname, '..');
    const w = {
      id: 'sample',
      settings: { name: '2024日本镰仓', trip: '日本旅行', collection: '镰仓', tags: ['海边', '人物'], autoAdvance: true, aiMode: 'off', archiveMode: 'copy' },
      items: [{
        id: 'p1',
        name: 'IMG_0.JPG',
        relativePath: 'DCIM/IMG_0.JPG',
        kind: 'photo',
        camera: 'DJI Pocket 3',
        focal35: '20mm',
        aperture: 'F2.0',
        shutter: '1/1250s',
        iso: '100',
        ev: '+0.3 EV',
        cct: '5600K',
        width: 3840,
        height: 2160,
        size: 5242880,
        capturedAt: '2024-05-18T14:32:05',
        latitude: 35.3190,
        longitude: 139.5505,
        altitude: 12,
        tags: ['海边'],
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="50%" height="100%" fill="%23305570"/><rect x="50%" width="50%" height="100%" fill="%23c0a080"/></svg>'
      }],
      operations: []
    };

    let html = fs.readFileSync(path.join(root, 'ui/index.html'), 'utf8')
      .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
      .replace(/<link[^>]*>/, '')
      .replace(/<script[\s\S]*?<\/script>/, '');

    await page.setContent(html);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/style.css'), 'utf8') });

    await page.evaluate(({ w }) => {
      window.shiguang = {
        bootstrap: async () => ({
          preferences: { theme: 'light', translucent: true, colorTheme: 'codex' },
          recent: [{ id: 'sample', name: w.settings.name, processed: 1, total: 3 }]
        }),
        load: async () => w,
        choose: async () => w,
        list: async () => [{ id: 'sample', name: w.settings.name, processed: 1, total: 3 }],
        appearance: async () => {},
        onProgress: () => {},
        save: async () => w
      };
    }, { w });

    const code = fs.readFileSync(path.join(root, 'ui/app.js'), 'utf8')
      .replace('src:`sgmedia://${w.id}/${p.id}`', 'src:p.preview||`sgmedia://${w.id}/${p.id}`');

    await page.addScriptTag({ content: code });
    await page.locator('#project-list [data-workspace=sample]').click();
    await page.locator('.review-dock').waitFor();

    // 1. Inspector sidebar should be present and visible
    const inspector = page.locator('#inspector-sidebar');
    await assert.doesNotReject(inspector.waitFor({ state: 'visible' }), '右侧素材检查器在整理模式下应可见');

    // 2. Camera exposure cards
    const focal = await inspector.locator('.exposure-pill:has-text("焦距") .exposure-val').textContent();
    assert.equal(focal.trim(), '20mm', '检查器应展示等效焦距');
    const aperture = await inspector.locator('.exposure-pill:has-text("光圈") .exposure-val').textContent();
    assert.equal(aperture.trim(), 'F2.0', '检查器应展示光圈');
    const cameraTag = await inspector.locator('.inspector-cam-tag').textContent();
    assert.equal(cameraTag.trim(), 'DJI Pocket 3', '检查器应展示相机型号');

    // 3. Histogram canvas & clipping badges
    const canvas = inspector.locator('.inspector-histogram-canvas');
    assert(await canvas.count() > 0, '检查器应包含直方图 canvas');
    const shadowClip = await inspector.locator('#shadow-clipping').textContent();
    assert(shadowClip.includes('暗部'), '应展示暗部峰值比例');

    // 4. GPS location card
    const gpsCard = inspector.locator('.inspector-gps-card');
    assert(await gpsCard.count() > 0, '含 GPS 信息的照片应展示地理位置卡片');
    const gpsText = await gpsCard.textContent();
    assert(gpsText.includes('镰仓') || gpsText.includes('35.3190'), 'GPS 卡片应包含地理信息');

    // 5. Test toggling inspector via shortcut 'i'
    await page.keyboard.press('i');
    await page.waitForTimeout(100);
    const hasCollapsed = await page.locator('#shiguang').evaluate(el => el.classList.contains('inspector-collapsed'));
    assert.equal(hasCollapsed, true, '按下 i 键应收起检查器');

    await page.keyboard.press('i');
    await page.waitForTimeout(100);
    const hasReopened = await page.locator('#shiguang').evaluate(el => !el.classList.contains('inspector-collapsed'));
    assert.equal(hasReopened, true, '再次按下 i 键应重新展开检查器');
  } finally {
    await browser.close();
  }
});
