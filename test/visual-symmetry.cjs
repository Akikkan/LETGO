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
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    // Create a 100x100 canvas with a rich photo gradient (sunset seaside with Japan colors)
    const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="40%" stop-color="#f43f5e"/>
          <stop offset="70%" stop-color="#fb923c"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky)"/>
      <circle cx="200" cy="150" r="60" fill="#fef08a" opacity="0.8"/>
    </svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(testSvg)}`;

    const items = [
      {
        id: 'img1',
        name: 'P1020496.JPG',
        relativePath: '未分类/102_PANA/P1020496.JPG',
        kind: 'photo',
        tags: ['街景', '日落'],
        suggestedTags: ['Panasonic', '定焦', 'F4.8', '1/3s'],
        camera: 'Panasonic DMC-GX85',
        lens: 'LUMIX G VARIO 12-32mm',
        shutter: '1/3s',
        aperture: 'f/4.8',
        iso: 'ISO 400',
        focalLength: '22.0mm',
        focal35: '44mm',
        ev: '-0.3 EV',
        cct: '5200K',
        capturedAt: '2024-06-12 18:45:22',
        latitude: 35.3190,
        longitude: 139.5312,
        altitude: 18,
        width: 4592,
        height: 3448,
        size: 5740032,
        extension: 'JPG',
        status: 'keep',
        preview: dataUri
      },
      {
        id: 'img2',
        name: 'P1020497.JPG',
        relativePath: '未分类/102_PANA/P1020497.JPG',
        kind: 'photo',
        tags: ['海边'],
        camera: 'Panasonic DMC-GX85',
        lens: 'LUMIX G VARIO 12-32mm',
        shutter: '1/500s',
        aperture: 'f/5.6',
        iso: 'ISO 200',
        focalLength: '12.0mm',
        focal35: '24mm',
        ev: '0.0 EV',
        cct: '5500K',
        capturedAt: '2024-06-12 18:46:10',
        latitude: 35.3088,
        longitude: 139.4820,
        altitude: 4,
        width: 4592,
        height: 3448,
        size: 5820000,
        extension: 'JPG',
        status: null,
        preview: dataUri
      },
      {
        id: 'img3',
        name: 'P1020498.JPG',
        relativePath: '未分类/102_PANA/P1020498.JPG',
        kind: 'photo',
        status: null,
        preview: dataUri
      },
      {
        id: 'img4',
        name: 'P1020499.JPG',
        relativePath: '未分类/102_PANA/P1020499.JPG',
        kind: 'photo',
        status: null,
        preview: dataUri
      }
    ];

    const w = {
      id: 'sample-pana',
      settings: {
        name: '102_PANA 旅拍整理',
        trip: '日本旅行',
        collection: '镰仓·七里滨',
        tags: ['海边', '街景', '日落', '电车'],
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

    let currentPrefs = {
      theme: 'dark',
      translucent: true,
      colorTheme: 'telecaster', // Japan Telecaster Blue
      customAccent: null,
      keepColor: null
    };

    await page.evaluate(({ w, currentPrefs }) => {
      window.shiguang = {
        bootstrap: async () => ({
          preferences: currentPrefs,
          recent: [
            { id: 'sample-pana', name: w.settings.name, processed: 1, total: 4 }
          ]
        }),
        load: async () => w,
        choose: async () => w,
        list: async () => [
          { id: 'sample-pana', name: w.settings.name, processed: 1, total: 4 }
        ],
        appearance: async (prefs) => {
          Object.assign(currentPrefs, prefs);
        },
        metadata: async (wId, itemId) => {
          return w.items.find(i => i.id === itemId);
        },
        onProgress: () => {},
        save: async () => w
      };
    }, { w, currentPrefs });

    const code = fs.readFileSync(path.join(root, 'ui/app.js'), 'utf8')
      .replace(/src:`sgmedia:\/\/\$\{w\.id\}\/\$\{p\.id\}`/g, 'src:p.preview||`sgmedia://${w.id}/${p.id}`');

    await page.addScriptTag({ content: code });
    await page.locator('.home-entry').waitFor();

    // Open workspace
    await page.locator('#project-list [data-workspace=sample-pana]').click();
    await page.locator('.review-dock').waitFor();

    // Wait a brief moment for histogram and palette to render
    await page.waitForTimeout(500);

    // Capture Review Mode (Dark Theme + Telecaster Blue)
    await page.screenshot({ path: path.join(__dirname, 'shot-review-symmetry-dark.png') });

    // Switch to Light Theme and capture
    await page.locator('.app-chrome [data-action=toggle-theme]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, 'shot-review-symmetry-light.png') });

    console.log('Visual symmetry screenshots generated successfully.');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
