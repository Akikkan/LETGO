'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('overview page supports grid thumbnail and list view modes with toggle buttons', () => {
  const uiAppCode = fs.readFileSync(path.join(__dirname, '../ui/app.js'), 'utf8');
  assert(uiAppCode.includes('overview-mode-grid'), 'app.js 应包含 overview-mode-grid 动作');
  assert(uiAppCode.includes('overview-mode-list'), 'app.js 应包含 overview-mode-list 动作');
  assert(uiAppCode.includes('overview-grid'), 'app.js 应包含 overview-grid 样式类');
  assert(uiAppCode.includes('overview-card'), 'app.js 应包含 overview-card 缩略图卡片');

  const css = fs.readFileSync(path.join(__dirname, '../ui/style.css'), 'utf8');
  assert(css.includes('.overview-grid'), 'style.css 应包含 .overview-grid 网格样式');
  assert(css.includes('.overview-card'), 'style.css 应包含 .overview-card 卡片样式');
  assert(css.includes('.overview-mode-toggle'), 'style.css 应包含 .overview-mode-toggle 切换按钮组');
});
