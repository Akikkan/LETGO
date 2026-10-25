'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('settings view provides clear segmented control for light and dark themes', () => {
  const uiAppCode = fs.readFileSync(path.join(__dirname, '../ui/app.js'), 'utf8');
  assert(uiAppCode.includes('set-theme-light'), 'app.js 应包含 set-theme-light 浅色设置动作');
  assert(uiAppCode.includes('set-theme-dark'), 'app.js 应包含 set-theme-dark 深色设置动作');
  assert(uiAppCode.includes('theme-segmented-control'), 'app.js 应包含 theme-segmented-control 分段控件');
  assert(uiAppCode.includes('pointermove'), 'app.js 应监听 pointermove 事件以进行光标流光定位');
  assert(uiAppCode.includes('--mouse-x'), 'app.js 应设置 --mouse-x 变量');
  assert(uiAppCode.includes('--mouse-y'), 'app.js 应设置 --mouse-y 变量');

  const css = fs.readFileSync(path.join(__dirname, '../ui/style.css'), 'utf8');
  assert(css.includes('--mouse-x'), 'style.css 应利用 --mouse-x 进行径向高光跟随');
  assert(css.includes('--mouse-y'), 'style.css 应利用 --mouse-y 进行径向高光跟随');
  assert(css.includes('.theme-segmented-control'), 'style.css 应包含分段控制栏样式');
  assert(css.includes('9999px'), 'style.css 应包含水滴胶囊圆角 9999px');
  assert(css.includes('#shiguang.translucent #project-sidebar'), 'style.css 应为毛玻璃侧边栏提供半透明玻璃质感');
  assert(!css.includes('@keyframes gleam-sweep'), 'style.css 应已移除过于激进的循环扫光动画');
  assert(css.includes('mask-composite: exclude') || css.includes('-webkit-mask-composite: xor'), 'style.css 应使用边缘遮罩确保流光仅出现在边界而不溢入按钮内部');
  assert(css.includes('#376a8d') || css.includes('#447b9f'), 'style.css 应采用日产 Telecaster Lake Placid Blue 湖水蓝克制调色');
});
