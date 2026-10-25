'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('image viewer supports mouse wheel zooming centered on viewport/cursor', async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const root = path.join(__dirname, '..');
    const w = {
      id: 'sample',
      settings: { name: '测试项目', trip: '测试', collection: '测试', tags: ['标签'], autoAdvance: true, aiMode: 'off', archiveMode: 'copy' },
      items: [{
        id: 'p1',
        name: 'test.jpg',
        relativePath: 'test.jpg',
        kind: 'photo',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="100%" height="100%" fill="%23445"/></svg>'
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
          recent: [{ id: 'sample', name: w.settings.name, processed: 0, total: 1 }]
        }),
        load: async () => w,
        choose: async () => w,
        list: async () => [{ id: 'sample', name: w.settings.name, processed: 0, total: 1 }],
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

    const sliderBefore = await page.locator('.zoom-slider').inputValue();
    assert.equal(sliderBefore, '0', '初始缩放滑块应为 0');

    // Scroll wheel UP over .image-viewport
    const vp = page.locator('.image-viewport');
    const box = await vp.boundingBox();
    assert(box, '视口元素应存在');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(50);

    const sliderAfterZoomIn = await page.locator('.zoom-slider').inputValue();
    assert(Number(sliderAfterZoomIn) > 0, `滚轮向上应放大图片，当前滑块值: ${sliderAfterZoomIn}`);

    // Scroll wheel DOWN over .image-viewport
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(50);

    const sliderAfterZoomOut = await page.locator('.zoom-slider').inputValue();
    assert(Number(sliderAfterZoomOut) < Number(sliderAfterZoomIn), `滚轮向下应缩小图片，当前滑块值: ${sliderAfterZoomOut}`);
  } finally {
    await browser.close();
  }
});
