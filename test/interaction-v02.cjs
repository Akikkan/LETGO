const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { _electron } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const project = path.join(__dirname, '..');
const exe = process.env.SHIGUANG_ELECTRON || path.join(project, 'node_modules/electron/dist/electron.exe');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-interaction-v02-'));
  const sourceA = path.join(temp, 'project-a');
  const sourceB = path.join(temp, 'project-b');
  const data = path.join(temp, 'data');
  await fs.mkdir(sourceA, { recursive: true });
  await fs.mkdir(sourceB, { recursive: true });
  await fs.copyFile(path.join(project, '../prototype/sample-0.jpg'), path.join(sourceA, 'a.jpg'));
  await fs.copyFile(path.join(project, '../prototype/sample-1.jpg'), path.join(sourceA, 'b.jpg'));
  await fs.copyFile(path.join(project, '../prototype/sample-0.jpg'), path.join(sourceB, 'c.jpg'));
  const env = { ...process.env, SHIGUANG_TEST: '1', SHIGUANG_TEST_DATA: data, SHIGUANG_TEST_SOURCE: sourceA };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  const pageErrors = [];
  try {
    app = await _electron.launch({ executablePath: exe, args: [project], env, timeout: 30000 });
    const page = await app.firstWindow();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.locator('.home-entry').waitFor();

    const createProject = async () => {
      await page.locator('#sidebar-new-project').click();
      await page.locator('[data-action=start-review]').waitFor();
      await page.locator('[data-setting=name]').fill('交互测试');
      await page.locator('[data-setting=name]').press('Tab');
      await page.locator('[data-action=start-review]').click();
      await page.locator('.image-viewport .review-image').waitFor();
      await page.waitForFunction(() => document.querySelector('.review-image')?.naturalWidth > 0);
    };
    await createProject();
    const idA = await page.locator('#project-list [data-workspace]').first().getAttribute('data-workspace');
    assert(idA, '项目 A 应保存并显示在侧栏');

    const slider = page.locator('.zoom-slider');
    const setZoom = async value => slider.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    const viewport = page.locator('.image-viewport');
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('.image-viewport')?.dataset.scale) - 1) < 0.001);
    assert.equal(await slider.inputValue(), '0', '缩放中点应为适应窗口');
    await setZoom(100);
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('.image-viewport')?.dataset.scale) - 8) < 0.01);
    await setZoom(-100);
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('.image-viewport')?.dataset.scale) - 0.25) < 0.01);
    await setZoom(100);

    // Pan across the image; minimap must exist only for the active drag and remain bounded.
    const box = await viewport.boundingBox();
    assert(box && box.width > 200 && box.height > 120, 'image viewport has usable dimensions');
    const minimap = page.locator('.image-minimap');
    assert.equal(await minimap.evaluate(el => el.hidden), true);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8, { steps: 6 });
    await page.waitForFunction(() => document.querySelector('.image-minimap')?.hidden === false);
    const miniBox = await minimap.boundingBox();
    const windowBox = await page.locator('.minimap-window').boundingBox();
    assert(miniBox && windowBox, 'minimap and viewport indicator are visible while dragging');
    assert(windowBox.x >= miniBox.x - 1 && windowBox.y >= miniBox.y - 1 && windowBox.x + windowBox.width <= miniBox.x + miniBox.width + 1 && windowBox.y + windowBox.height <= miniBox.y + miniBox.height + 1, 'minimap viewport remains clamped inside minimap');
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.image-minimap')?.hidden === true);
    const pan = await viewport.evaluate(el => ({ x: Number(el.dataset.panX), y: Number(el.dataset.panY), w: el.clientWidth, h: el.clientHeight, iw: el.querySelector('img').getBoundingClientRect().width, ih: el.querySelector('img').getBoundingClientRect().height }));
    assert(Math.abs(pan.x) <= Math.max(0, (pan.iw - pan.w) / 2) + 1.5, 'horizontal pan stays within image bounds');
    assert(Math.abs(pan.y) <= Math.max(0, (pan.ih - pan.h) / 2) + 1.5, 'vertical pan stays within image bounds');

    await setZoom(100);
    await page.locator('[data-tag]').first().click();
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('.image-viewport')?.dataset.scale) - 8) < 0.01);
    assert.equal(await page.locator('.zoom-slider').inputValue(), '100', 'tagging the same photo preserves zoom');
    await page.locator('[data-action=next]').click();
    await page.waitForFunction(() => document.querySelector('.review-image')?.naturalWidth > 0 && document.querySelector('.zoom-slider')?.value === '0');
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('.image-viewport')?.dataset.scale) - 1) < 0.01);
    const centered = await viewport.evaluate(el => Math.abs(Number(el.dataset.panX)) < 0.1 && Math.abs(Number(el.dataset.panY)) < 0.1);
    assert(centered, 'new image starts centered');

    // Window sizes expected by the product: no document or image-view scrolling.
    for (const bounds of [{ width: 780, height: 640 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
      await app.evaluate(({ BrowserWindow }, b) => BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 40, ...b }), bounds);
      await wait(350);
      const geometry = await page.evaluate(() => {
        const page = document.querySelector('#sg-page');
        const viewport = document.querySelector('.image-viewport');
        return { iw: innerWidth, ih: innerHeight, dw: document.documentElement.scrollWidth, dh: document.documentElement.scrollHeight, pw: page.clientWidth, ph: page.clientHeight, psw: page.scrollWidth, psh: page.scrollHeight, vw: viewport.clientWidth, vh: viewport.clientHeight, vsw: viewport.scrollWidth, vsh: viewport.scrollHeight };
      });
      assert(geometry.vw > 0 && geometry.vh > 0, `photo viewport remains visible at ${bounds.width}x${bounds.height}`);
      assert(geometry.dw <= geometry.iw + 1 && geometry.dh <= geometry.ih + 1, `document does not scroll at ${bounds.width}x${bounds.height}: ${JSON.stringify(geometry)}`);
      assert(geometry.psw <= geometry.pw + 1 && geometry.psh <= geometry.ph + 1, `main view does not scroll at ${bounds.width}x${bounds.height}: ${JSON.stringify(geometry)}`);
      assert(geometry.vsw <= geometry.vw + 1 && geometry.vsh <= geometry.vh + 1, `image viewport does not scroll at ${bounds.width}x${bounds.height}: ${JSON.stringify(geometry)}`);
    }

    // Persist a distinct decision in A, then create B by changing only the test dialog fixture.
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('#project-list .project-progress')?.textContent.includes('1 / 2'));
    const idABefore = idA;
    await app.evaluate(source => { process.env.SHIGUANG_TEST_SOURCE = source; }, sourceB);
    await createProject();
    const ids = await page.locator('#project-list [data-workspace]').evaluateAll(els => els.map(el => el.dataset.workspace));
    assert.equal(ids.length, 2, 'both projects are retained');
    const idB = ids.find(id => id !== idABefore);
    assert(idB, 'project B has a distinct identity');
    await page.keyboard.press('d');
    await page.waitForFunction(() => document.querySelector('#project-list .project-progress')?.textContent.includes('1 / 1'));
    await page.locator(`#project-list [data-workspace="${idABefore}"]`).click();
    await page.locator('.review').waitFor();
    assert((await page.locator('#project-list .is-active [data-workspace]').getAttribute('data-workspace')) === idABefore, 'switching back activates project A');
    await page.waitForFunction(() => document.querySelector('#project-list .is-active .project-progress')?.textContent.includes('1 / 2'));
    await page.locator(`#project-list [data-workspace="${idB}"]`).click();
    await page.locator('.review').waitFor();
    await page.waitForFunction(() => document.querySelector('#project-list .is-active .project-progress')?.textContent.includes('1 / 1'));

    // Verify the route/back history path after navigating to the operation log.
    await page.locator('[data-action=finish-review]').click();
    await page.locator('[data-action=history]').click();
    await page.locator('.flow-page h1').waitFor();
    assert.equal((await page.locator('.flow-page h1').textContent()).trim(), '操作记录');
    await page.locator('.flow-page [data-action=back]').click();
    await page.locator('.review').waitFor();
    assert.deepEqual(pageErrors, [], 'renderer has no uncaught page errors');
    console.log('PASS interaction-v02: two-workspace switching/persistence/history, fit/max/min zoom, pan/minimap/clamp, tag zoom persistence, new-image reset, and resize/no-scroll checks.');
    console.log(`Fixtures: ${temp}`);
  } finally {
    if (app) await app.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
