const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const items = [0, 1, 2].map(n => {
      let preview = '';
      try {
        preview = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, `../prototype/sample-${n}.jpg`)).toString('base64');
      } catch {}
      return {
        id: String(n),
        name: 'IMG_' + n + '.JPG',
        relativePath: 'DCIM/IMG_' + n + '.JPG',
        kind: 'photo',
        tags: ['海边'],
        suggestedTags: ['Pocket 3', '广角', 'F2.0', '1/1250s'],
        camera: 'DJI Pocket 3',
        shutter: '1/1250s',
        aperture: 'F2.0',
        iso: 'ISO 100',
        focalLength: '20mm',
        ev: '+0.3 EV',
        cct: '5600K',
        capturedAt: '2024-05-18 14:32:05',
        status: null,
        preview
      };
    });

    const w = {
      id: 'sample',
      settings: {
        name: '2024日本镰仓',
        trip: '日本旅行',
        collection: '镰仓',
        tags: ['海边', '人物', '街景', '夜景', '美食'],
        autoAdvance: true,
        aiMode: 'off',
        archiveMode: 'copy'
      },
      items,
      operations: []
    };

    let html = fs.readFileSync(path.join(root, 'ui/index.html'), 'utf8')
      .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
      .replace(/<link[^>]*>/, '')
      .replace(/<script[\s\S]*?<\/script>/, '');

    await page.setContent(html);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/style.css'), 'utf8') });

    let currentTheme = 'light';
    let currentTranslucent = true;

    await page.evaluate(({ w, currentTheme, currentTranslucent }) => {
      window.shiguang = {
        bootstrap: async () => ({
          preferences: { theme: currentTheme, translucent: currentTranslucent },
          recent: [
            { id: 'sample', name: w.settings.name, processed: 1, total: 3 },
            { id: 'kyoto', name: '京都旅拍', processed: 48, total: 520 }
          ]
        }),
        load: async () => w,
        choose: async () => w,
        list: async () => [
          { id: 'sample', name: w.settings.name, processed: 1, total: 3 },
          { id: 'kyoto', name: '京都旅拍', processed: 48, total: 520 }
        ],
        appearance: async (prefs) => {
          currentTheme = prefs.theme;
          currentTranslucent = prefs.translucent;
        },
        onProgress: () => {},
        save: async () => w
      };
    }, { w, currentTheme, currentTranslucent });

    const code = fs.readFileSync(path.join(root, 'ui/app.js'), 'utf8')
      .replace('src:`sgmedia://${w.id}/${p.id}`', 'src:p.preview||`sgmedia://${w.id}/${p.id}`');

    await page.addScriptTag({ content: code });
    await page.locator('.home-entry').waitFor();

    // 1. Open settings in light mode
    await page.locator('.app-chrome [data-action=settings]').click();
    await page.locator('.settings-page').waitFor();
    await page.screenshot({ path: path.join(__dirname, 'shot-settings-light.png') });

    // 2. Switch to dark mode via segmented control
    await page.locator('[data-action=set-theme-dark]').click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(__dirname, 'shot-settings-dark.png') });

    // 3. Go to review mode in dark mode and test hover droplet glint
    await page.locator('[data-action=back]').click();
    await page.locator('#project-list [data-workspace=sample]').click();
    await page.locator('.review-dock').waitFor();

    // Move cursor over "收录" button to trigger pointer tracking
    const keepBtn = page.locator('.review-btn[data-action=keep]');
    const box = await keepBtn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.screenshot({ path: path.join(__dirname, 'shot-review-dark-droplet.png') });

    // 4. Go to Overview grid in dark mode
    await page.locator('.app-chrome [data-action=settings]').click();
    await page.locator('[data-action=set-theme-light]').click();
    await page.locator('[data-action=back]').click();
    await page.locator('.review-mini[data-action=overview]').click();
    await page.locator('.overview-grid').waitFor();
    await page.screenshot({ path: path.join(__dirname, 'shot-overview-light-droplet.png') });

    console.log('All visual screenshots successfully captured.');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
