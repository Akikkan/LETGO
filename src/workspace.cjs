'use strict';

const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function safeRealpath(target) {
  try {
    return await fs.realpath(target);
  } catch (error) {
    if (error.code === 'EPERM') {
      return new Promise((resolve, reject) => {
        nodeFs.realpath(target, (err, res) => err ? reject(err) : resolve(res));
      });
    }
    throw error;
  }
}

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.dng', '.arw', '.cr2', '.cr3', '.nef', '.raf']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv']);
const EXCLUDED_DIRS = new Set(['node_modules', 'prototype', 'shiguang-desktop', '整理好的素材']);
const STATUSES = new Set([null, 'keep', 'skip', 'reject']);
const SETTING_KEYS = new Set(['name', 'trip', 'collection', 'tags', 'autoAdvance', 'aiMode', 'archiveMode']);
const ITEM_UPDATE_KEYS = new Set(['id', 'status', 'tags', 'deleteReviewed']);

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function workspaceRevision(state) {
  return digest(JSON.stringify({
    settings: state.settings,
    items: state.items.map(item => ({ id: item.id, relativePath: item.relativePath, size: item.size, mtimeMs: item.mtimeMs, status: item.status, tags: item.tags, deleteReviewed: item.deleteReviewed }))
  }));
}

function stableSourceKey(sourceDir) {
  const normalized = path.resolve(sourceDir).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized;
}

function normalizeRelative(relativePath) {
  return String(relativePath).split(path.sep).join('/');
}

function validateId(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new TypeError('无效的工作区 ID');
  return id;
}

function ensurePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label}必须是普通对象`);
  }
}

function hasOnlyKeys(object, allowed, label) {
  for (const key of Object.keys(object)) if (!allowed.has(key)) throw new TypeError(`${label}包含不允许的字段: ${key}`);
}

function cleanText(value, fallback = '', max = 160) {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new TypeError('设置值必须是文本');
  return value.trim().slice(0, max);
}

function cleanTags(value, limit = 64) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('标签必须是数组');
  return [...new Set(value.filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, limit);
}

function sanitizeSettings(value, previous = {}) {
  if (value == null) return { ...previous };
  ensurePlainObject(value, 'settings');
  hasOnlyKeys(value, SETTING_KEYS, 'settings');
  const out = { ...previous };
  for (const key of ['name', 'trip', 'collection']) if (Object.hasOwn(value, key)) out[key] = cleanText(value[key], '', 160);
  if (Object.hasOwn(value, 'tags')) out.tags = cleanTags(value.tags);
  if (Object.hasOwn(value, 'autoAdvance')) {
    if (typeof value.autoAdvance !== 'boolean') throw new TypeError('autoAdvance 必须是布尔值');
    out.autoAdvance = value.autoAdvance;
  }
  if (Object.hasOwn(value, 'aiMode')) {
    if (!(typeof value.aiMode === 'boolean' || (typeof value.aiMode === 'string' && value.aiMode.length <= 40))) throw new TypeError('aiMode 无效');
    out.aiMode = value.aiMode;
  }
  if (Object.hasOwn(value, 'archiveMode')) {
    if (!['copy', 'move'].includes(value.archiveMode)) throw new TypeError('archiveMode 只能是 copy 或 move');
    out.archiveMode = value.archiveMode;
  }
  return {
    name: out.name ?? '工作区', trip: out.trip ?? '', collection: out.collection ?? '镰仓',
    tags: out.tags ?? [], autoAdvance: out.autoAdvance ?? false, aiMode: out.aiMode ?? false,
    archiveMode: out.archiveMode ?? 'copy'
  };
}

function truncateUtf8(value, maxBytes) {
  let result = '';
  let bytes = 0;
  for (const character of String(value)) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > maxBytes) break;
    result += character;
    bytes += size;
  }
  return result;
}

function sanitizeFilenamePart(value, fallback) {
  let result = String(value || '').trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .replace(/_+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 90);
  if (!result) result = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result)) result = `_${result}`;
  return result;
}

function validCaptureTime(item) {
  const source = String(item.capturedAt || item.name || '');
  const match = source.match(/((?:19|20)\d{2})[-:]?(\d{2})[-:]?(\d{2})[T _-]?(\d{2})[:\-]?(\d{2})[:\-]?(\d{2})/);
  if (!match) return '未知时间';
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59) return '未知时间';
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function filenameFor(settings, item) {
  let trip = sanitizeFilenamePart(settings.trip || settings.name, '未命名旅程');
  let place = sanitizeFilenamePart(settings.collection, '未指定地点');
  const tag = Array.isArray(item.tags) ? item.tags[0] : '';
  let type = sanitizeFilenamePart(tag || (item.kind === 'video' ? '视频' : '照片'), item.kind === 'video' ? '视频' : '照片');
  const timestamp = validCaptureTime(item);
  let extension = String(item.extension || path.extname(item.name || '')).replace(/^\.+/, '').replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
  const tail = `_${timestamp}${extension ? `.${extension}` : ''}`;
  while (Buffer.byteLength(`${trip}_${place}_${type}${tail}`, 'utf8') > 240) {
    const largest = [trip, place, type].sort((a, b) => Buffer.byteLength(b, 'utf8') - Buffer.byteLength(a, 'utf8'))[0];
    const shortened = truncateUtf8(largest, Math.max(3, Buffer.byteLength(largest, 'utf8') - 8));
    if (largest === trip) trip = shortened;
    else if (largest === place) place = shortened;
    else type = shortened;
  }
  return `${trip}_${place}_${type}${tail}`;
}

function comparablePath(value) {
  let input = String(value);
  if (process.platform === 'win32') {
    input = input.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/, '');
  }
  const resolved = path.resolve(input);
  return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
}

function isWithin(parent, candidate) {
  const parentPath = comparablePath(parent);
  const candidatePath = comparablePath(candidate);
  if (parentPath === candidatePath) return true;
  const prefix = parentPath.endsWith(path.sep) ? parentPath : `${parentPath}${path.sep}`;
  return candidatePath.startsWith(prefix);
}

async function exists(target) {
  try { await fs.lstat(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function assertNoSymlinkPath(target, allowMissing = true) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error(`不允许符号链接: ${current}`);
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissing) continue;
      throw error;
    }
  }
}

async function canonicalPathAllowMissing(target) {
  let cursor = path.resolve(target);
  const suffix = [];
  for (;;) {
    try {
      const real = await safeRealpath(cursor);
      return path.resolve(real, ...suffix);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = require('node:fs').createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function atomicJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const backup = `${filePath}.bak`;
  const content = `${JSON.stringify(data, null, 2)}\n`;
  let handle;
  try {
    handle = await fs.open(temp, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    if (await exists(filePath)) {
      try {
        JSON.parse(await fs.readFile(filePath, 'utf8'));
        await fs.copyFile(filePath, backup);
      } catch { /* Keep the previous known-good backup if the primary file is damaged. */ }
    }
    await fs.rename(temp, filePath);
    let dirHandle;
    try {
      dirHandle = await fs.open(path.dirname(filePath), 'r');
      await dirHandle.sync();
    } catch { /* Directory sync is unavailable on some Windows filesystems. */ }
    finally { if (dirHandle) await dirHandle.close().catch(() => {}); }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temp).catch(() => {});
    throw error;
  }
}

function createStore({ dataDir, trashItem, onProgress = () => {}, readMetadata } = {}) {
  if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('dataDir 是必填项');
  if (typeof trashItem !== 'function') throw new TypeError('trashItem 是必填函数');
  if (typeof onProgress !== 'function') throw new TypeError('onProgress 必须是函数');
  if (readMetadata != null && typeof readMetadata !== 'function') throw new TypeError('readMetadata 必须是函数');
  const rootData = path.resolve(dataDir);
  const workspacesDir = path.join(rootData, 'workspaces');
  const plans = new Map();
  const locks = new Set();
  const invalidatePlans = id => { for (const [token, value] of plans) if (value.id === id) plans.delete(token); };

  const fileFor = id => path.join(workspacesDir, `${validateId(id)}.json`);
  const defaultSettings = sourceDir => ({ name: path.basename(sourceDir) || '工作区', trip: path.basename(sourceDir) || '', collection: '收录', tags: ['海边', '人物', '街景'], autoAdvance: true, aiMode: 'off', archiveMode: 'copy' });

  async function readStored(id) {
    const target = fileFor(id);
    for (const candidate of [target, `${target}.bak`]) {
      try {
        const parsed = JSON.parse(await fs.readFile(candidate, 'utf8'));
        if (parsed?.version === 1 && parsed.id === id && Array.isArray(parsed.items)) return parsed;
      } catch { /* Try the backup copy. */ }
    }
    return null;
  }

  async function writeStored(state) {
    state.updatedAt = new Date().toISOString();
    await atomicJson(fileFor(state.id), state);
    return state;
  }

  async function scan(sourceDir, previousState = {}) {
    const previousItems = Array.isArray(previousState?.items) ? previousState.items : [];
    const previousOperations = Array.isArray(previousState?.operations) ? previousState.operations : [];
    const prior = new Map(previousItems.map(item => [item.relativePath, item]));
    const found = [];
    async function visit(dir, relativeBase = '') {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') return; throw error; }
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      for (const entry of entries) {
        const relative = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
        if (entry.name.startsWith('.')) continue;
        const extension = path.extname(entry.name).toLowerCase();
        const candidate = path.join(dir, entry.name);
        const lst = await fs.lstat(candidate);
        if (lst.isSymbolicLink()) continue;
        if (lst.isDirectory()) {
          if (EXCLUDED_DIRS.has(entry.name.toLocaleLowerCase()) || entry.name === '整理好的素材') continue;
          await visit(candidate, relative);
          continue;
        }
        if (!lst.isFile() || (!PHOTO_EXTENSIONS.has(extension) && !VIDEO_EXTENSIONS.has(extension))) continue;
        const rel = normalizeRelative(relative);
        let capturedAt = null;
        if (readMetadata) {
          try {
            const metadata = await readMetadata(candidate, { name: entry.name, relativePath: rel, extension });
            capturedAt = typeof metadata === 'string' ? metadata : metadata?.capturedAt || metadata?.DateTimeOriginal || metadata?.dateTimeOriginal || null;
            if (capturedAt != null) capturedAt = String(capturedAt).slice(0, 80);
          } catch { capturedAt = null; }
        }
        const old = prior.get(rel);
        const unchanged = !!old && old.size === lst.size && old.mtimeMs === lst.mtimeMs;
        found.push({
          id: digest(rel), name: entry.name, relativePath: rel, size: lst.size, mtimeMs: lst.mtimeMs,
          extension: extension.slice(1), kind: VIDEO_EXTENSIONS.has(extension) ? 'video' : 'photo',
          capturedAt: capturedAt || old?.capturedAt || null,
          status: unchanged && STATUSES.has(old.status) ? old.status : null,
          tags: old ? cleanTags(old.tags) : [], deleteReviewed: unchanged && !!old?.deleteReviewed,
          ...(old?.suggestedTags ? { suggestedTags: cleanTags(old.suggestedTags) } : {}),
          ...(old?.suggestedStatus ? { suggestedStatus: old.suggestedStatus } : {})
        });
        if (old && !unchanged) old._sourceChanged = true;
        try { onProgress({ phase: 'scan', completed: found.length, total: null, current: entry.name }); } catch { /* UI progress callbacks must not interrupt scanning. */ }
      }
    }
    await visit(sourceDir);
    // Keep items that disappeared after a completed move/trash so results and history survive rescans.
    const foundPaths = new Set(found.map(item => item.relativePath));
    const completedItemIds = new Set(previousOperations.filter(op => op.status === 'completed').map(op => op.itemId));
    for (const old of previousItems) {
      if (completedItemIds.has(old.id) && !foundPaths.has(old.relativePath)) found.push({ ...old, missing: true });
    }
    for (const item of previousItems) {
      if (item._sourceChanged) {
        for (const operation of previousOperations) if (operation.itemId === item.id) operation._invalidated = true;
        delete item._sourceChanged;
      }
    }
    previousState.operations = previousOperations.filter(operation => !operation._invalidated).map(({ _invalidated, ...operation }) => operation);
    return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' }));
  }

  async function getState(id) {
    const state = await readStored(id);
    if (!state) throw new Error('工作区不存在或数据文件损坏');
    return state;
  }

  async function list() {
    let names = [];
    try { names = await fs.readdir(workspacesDir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const result = [];
    for (const name of names.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) {
      const state = await readStored(name.slice(0, -5));
      if (state) result.push({ id: state.id, sourceDir: state.sourceDir, name: state.settings?.name || path.basename(state.sourceDir), createdAt: state.createdAt, updatedAt: state.updatedAt, total: state.items.length, processed: state.items.filter(item => item.status).length });
    }
    return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function open(sourceDir) {
    if (typeof sourceDir !== 'string' || !sourceDir) throw new TypeError('sourceDir 是必填项');
    const entered = path.resolve(sourceDir);
    const rootStat = await fs.lstat(entered);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('素材目录必须是实际目录，不能是符号链接');
    const canonical = await safeRealpath(entered);
    const id = digest(stableSourceKey(canonical));
    if (locks.has(id)) throw new Error('工作区正在归档');
    const old = await readStored(id);
    const now = new Date().toISOString();
    try { onProgress({ phase: 'scan', completed: 0, total: null, current: null }); } catch { /* Progress callbacks must not interrupt scanning. */ }
    const items = await scan(canonical, old || {});
    const state = {
      version: 1, id, sourceDir: canonical,
      createdAt: old?.createdAt || now, updatedAt: now,
      settings: sanitizeSettings(old?.settings, defaultSettings(canonical)),
      items, operations: Array.isArray(old?.operations) ? old.operations : []
    };
    if (old?.lastPlan) state.lastPlan = old.lastPlan;
    await writeStored(state);
    invalidatePlans(id);
    return state;
  }

  async function load(id) {
    return getState(id);
  }

  async function save(id, input = {}) {
    validateId(id);
    if (locks.has(id)) throw new Error('工作区正在归档，暂时不能修改');
    ensurePlainObject(input, 'save 参数');
    hasOnlyKeys(input, new Set(['settings', 'items']), 'save 参数');
    const state = await getState(id);
    if (Object.hasOwn(input, 'settings')) state.settings = sanitizeSettings(input.settings, state.settings);
    if (Object.hasOwn(input, 'items')) {
      if (!Array.isArray(input.items)) throw new TypeError('items 必须是数组');
      const byId = new Map(state.items.map(item => [item.id, item]));
      for (const update of input.items) {
        ensurePlainObject(update, 'item 更新');
        hasOnlyKeys(update, ITEM_UPDATE_KEYS, 'item 更新');
        if (typeof update.id !== 'string' || !byId.has(update.id)) throw new Error('更新项目不属于此工作区');
        const current = byId.get(update.id);
        if (Object.hasOwn(update, 'status')) {
          if (!STATUSES.has(update.status)) throw new TypeError('status 无效');
          current.status = update.status;
          if (update.status !== 'reject') current.deleteReviewed = false;
        }
        if (Object.hasOwn(update, 'tags')) current.tags = cleanTags(update.tags);
        if (Object.hasOwn(update, 'deleteReviewed')) {
          if (typeof update.deleteReviewed !== 'boolean') throw new TypeError('deleteReviewed 必须是布尔值');
          if (current.status !== 'reject' && update.deleteReviewed) throw new Error('只有已标记删除的素材可以复审');
          current.deleteReviewed = update.deleteReviewed;
        }
      }
    }
    await writeStored(state);
    invalidatePlans(id);
    return state;
  }

  async function uniqueDestination(outputDir, filename, used) {
    const extension = path.extname(filename);
    const stem = filename.slice(0, filename.length - extension.length);
    let candidate = filename;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase()) || await exists(path.join(outputDir, candidate))) {
      const tag = `_${String(suffix++).padStart(2, '0')}`;
      const maxStemBytes = Math.max(1, 240 - Buffer.byteLength(`${tag}${extension}`, 'utf8'));
      candidate = `${truncateUtf8(stem, maxStemBytes)}${tag}${extension}`;
    }
    used.add(candidate.toLocaleLowerCase());
    return path.join(outputDir, candidate);
  }

  async function verifySource(root, item, expected = null) {
    const relative = String(item.relativePath || '').replace(/[\\]/g, '/');
    if (!relative || relative.startsWith('/') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('素材相对路径无效');
    if (digest(relative) !== item.id) throw new Error('素材路径校验失败');
    const absolute = path.resolve(root, ...relative.split('/'));
    if (!isWithin(root, absolute) || absolute === root) throw new Error('素材路径越界');
    await assertNoSymlinkPath(absolute, false);
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('素材不再是普通文件');
    if (stat.size !== item.size || stat.mtimeMs !== item.mtimeMs) throw new Error(`素材已变化，请重新扫描: ${item.name}`);
    const hash = await hashFile(absolute);
    const fingerprint = digest(JSON.stringify({ size: stat.size, mtimeMs: stat.mtimeMs, hash }));
    if (expected && fingerprint !== expected) throw new Error(`素材指纹变化，请重新生成方案: ${item.name}`);
    return { absolute, hash, fingerprint, stat };
  }

  async function plan(id, outputDir) {
    validateId(id);
    if (locks.has(id)) throw new Error('工作区正在归档');
    if (typeof outputDir !== 'string' || !outputDir.trim()) throw new TypeError('outputDir 是必填项');
    const state = await getState(id);
    // Resolve interrupted per-item transactions before producing another plan.
    let recovered = false;
    for (const operation of state.operations || []) {
      if (operation.status !== 'started') continue;
      const item = state.items.find(candidate => candidate.id === operation.itemId);
      if (!item) { operation.status = 'failed'; operation.error = '素材记录已不存在'; recovered = true; continue; }
      const sourcePath = path.resolve(state.sourceDir, ...String(item.relativePath).split('/'));
      let sourceHash = null;
      try { sourceHash = (await verifySource(state.sourceDir, item)).hash; } catch { sourceHash = null; }
      let destinationHash = null;
      if (operation.destination) {
        try {
          if (isWithin(state.sourceDir, operation.destination)) throw new Error('目标路径越界');
          await assertNoSymlinkPath(operation.destination, false);
          const stat = await fs.lstat(operation.destination);
          if (stat.isFile() && !stat.isSymbolicLink()) destinationHash = await hashFile(operation.destination);
        } catch { destinationHash = null; }
      }
      if (operation.action === 'trash' && !await exists(sourcePath)) {
        operation.status = 'completed';
        operation.recovered = true;
      } else if (operation.action === 'copy' && destinationHash && destinationHash === operation.contentHash && sourceHash === operation.contentHash) {
        operation.status = 'completed';
        operation.recovered = true;
      } else if (operation.action === 'move' && destinationHash && destinationHash === operation.contentHash) {
        operation.status = sourceHash === operation.contentHash ? 'partial' : sourceHash === null ? 'completed' : 'failed';
        operation.recovered = true;
        if (operation.status === 'failed') operation.error = '源素材在归档中发生变化';
      } else {
        operation.status = 'failed';
        operation.error = '归档在此项目执行中断，未发现可续用的已校验副本';
        operation.recovered = true;
      }
      operation.completedAt = new Date().toISOString();
      recovered = true;
    }
    if (recovered) await writeStored(state);
    const requestedRoot = path.resolve(outputDir);
    await assertNoSymlinkPath(requestedRoot, true);
    const destinationRoot = await canonicalPathAllowMissing(requestedRoot);
    if (isWithin(state.sourceDir, destinationRoot)) throw new Error('归档目录不能位于素材源目录内');
    if (await exists(destinationRoot)) {
      const stat = await fs.lstat(destinationRoot);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('归档目标必须是普通目录');
    }
    const operations = Array.isArray(state.operations) ? state.operations : [];
    const partialByItem = new Map(operations.filter(op => op.status === 'partial').map(op => [`${op.itemId}:${op.action}`, op]));
    const entries = [];
    const used = new Set();
    let kept = 0, deleted = 0, skipped = 0, unprocessed = 0;
    for (const [itemIndex, item] of state.items.entries()) {
      try { onProgress({ phase: 'plan', completed: itemIndex, total: state.items.length, current: item.name }); } catch { /* Progress callbacks must not interrupt planning. */ }
      if (item.status === 'skip') { skipped++; continue; }
      if (!item.status) { unprocessed++; continue; }
      if (item.status === 'keep') {
        kept++;
        const action = state.settings.archiveMode === 'move' ? 'move' : 'copy';
        const completedOperation = operations.find(op => op.itemId === item.id && op.action === action && op.status === 'completed');
        if (completedOperation && (item.missing || !await exists(path.resolve(state.sourceDir, ...item.relativePath.split('/'))))) continue;
        const source = await verifySource(state.sourceDir, item);
        if (completedOperation && completedOperation.fingerprint === source.fingerprint && completedOperation.size === source.stat.size && completedOperation.mtimeMs === source.stat.mtimeMs && completedOperation.contentHash === source.hash) continue;
        if (completedOperation) {
          item.status = null; item.deleteReviewed = false;
          state.operations = operations.filter(op => op.itemId !== item.id);
          await writeStored(state); invalidatePlans(id);
          throw new Error(`已归档素材发生变化，已撤销原决定，请重新筛选: ${item.name}`);
        }
        const partial = partialByItem.get(`${item.id}:${action}`);
        let filename;
        let resume = false;
        if (action === 'move' && partial?.destination && isWithin(destinationRoot, partial.destination) && await exists(partial.destination)) {
          await assertNoSymlinkPath(partial.destination, false);
          const priorStat = await fs.lstat(partial.destination);
          if (priorStat.isFile() && !priorStat.isSymbolicLink() && partial.contentHash === source.hash && await hashFile(partial.destination) === source.hash) {
            filename = partial.destination;
            used.add(path.basename(filename).toLocaleLowerCase());
            resume = true;
          }
        }
        if (!filename) filename = await uniqueDestination(destinationRoot, filenameFor(state.settings, item), used);
        entries.push({ id: item.id, action, name: path.basename(filename), sourceRelative: item.relativePath, destination: filename, fingerprint: source.fingerprint, contentHash: source.hash, size: source.stat.size, mtimeMs: source.stat.mtimeMs, resume });
      } else if (item.status === 'reject') {
        deleted++;
        if (!item.deleteReviewed) throw new Error(`删除项尚未复审: ${item.name}`);
        const completedOperation = operations.find(op => op.itemId === item.id && op.action === 'trash' && op.status === 'completed');
        if (completedOperation && (item.missing || !await exists(path.resolve(state.sourceDir, ...item.relativePath.split('/'))))) continue;
        const source = await verifySource(state.sourceDir, item);
        if (completedOperation && completedOperation.fingerprint === source.fingerprint && completedOperation.size === source.stat.size && completedOperation.mtimeMs === source.stat.mtimeMs && completedOperation.contentHash === source.hash) continue;
        if (completedOperation) {
          item.status = 'reject'; item.deleteReviewed = false;
          state.operations = operations.filter(op => op.itemId !== item.id);
          await writeStored(state); invalidatePlans(id);
          throw new Error(`待删除素材发生变化，复审已撤销: ${item.name}`);
        }
        entries.push({ id: item.id, action: 'trash', name: item.name, sourceRelative: item.relativePath, destination: null, fingerprint: source.fingerprint, contentHash: source.hash, size: source.stat.size, mtimeMs: source.stat.mtimeMs });
      }
    }
    try { onProgress({ phase: 'plan', completed: state.items.length, total: state.items.length, current: null }); } catch { /* Progress callbacks must not interrupt planning. */ }
    const token = crypto.randomBytes(32).toString('hex');
    const returnedEntries = entries.map(({ fingerprint, contentHash, size, mtimeMs, ...entry }) => entry);
    invalidatePlans(id);
    plans.set(token, { id, outputDir: destinationRoot, entries, signature: workspaceRevision(state), settings: { ...state.settings }, createdAt: Date.now() });
    state.lastPlan = { createdAt: new Date().toISOString(), outputDir: destinationRoot, kept, deleted, skipped, unprocessed, entryCount: entries.length };
    await writeStored(state);
    return { token, entries: returnedEntries, outputDir: destinationRoot, kept, deleted, skipped, unprocessed };
  }

  async function execute(id, planToken) {
    validateId(id);
    if (typeof planToken !== 'string' || !plans.has(planToken)) throw new Error('归档方案已失效，请重新生成');
    const planData = plans.get(planToken);
    if (planData.id !== id) throw new Error('归档方案不属于此工作区');
    if (locks.has(id)) throw new Error('工作区正在归档');
    plans.delete(planToken);
    locks.add(id);
    const results = [];
    let state;
    try {
      state = await getState(id);
      if (workspaceRevision(state) !== planData.signature) throw new Error('工作区状态在方案生成后已变化，请重新生成方案');
      if (state.sourceDir !== (await safeRealpath(state.sourceDir))) throw new Error('素材目录位置已变化');
      await assertNoSymlinkPath(planData.outputDir, true);
      const actualOutputDir = await canonicalPathAllowMissing(planData.outputDir);
      if (isWithin(state.sourceDir, actualOutputDir)) throw new Error('归档目录不能位于素材源目录内');
      // Preflight every source before the first mutation so a stale plan cannot partially run.
      for (const entry of planData.entries) {
        const item = state.items.find(candidate => candidate.id === entry.id);
        if (!item) throw new Error('方案中的素材已不属于此工作区');
        await verifySource(state.sourceDir, item, entry.fingerprint);
        if (entry.action !== 'trash') {
          const parent = path.dirname(entry.destination);
          if (!isWithin(planData.outputDir, entry.destination)) throw new Error('目标路径越界');
          await assertNoSymlinkPath(parent, true);
        }
      }
      await fs.mkdir(planData.outputDir, { recursive: true });
      await assertNoSymlinkPath(planData.outputDir, false);
      try { onProgress({ phase: 'execute', workspaceId: id, completed: 0, total: planData.entries.length, current: null }); } catch { /* Progress callbacks must not interrupt archive operations. */ }
      let hadFailure = false;
      for (const [index, entry] of planData.entries.entries()) {
        const item = state.items.find(candidate => candidate.id === entry.id);
        let source;
        const operation = { itemId: entry.id, action: entry.action, name: entry.name, destination: entry.destination, fingerprint: entry.fingerprint, contentHash: entry.contentHash, size: entry.size, mtimeMs: entry.mtimeMs, status: 'started', startedAt: new Date().toISOString() };
        state.operations ||= [];
        state.operations.push(operation);
        await writeStored(state);
        try {
          source = await verifySource(state.sourceDir, item, entry.fingerprint);
          if (entry.action === 'trash') {
            await trashItem(source.absolute);
          } else {
            const destinationParent = path.dirname(entry.destination);
            await fs.mkdir(destinationParent, { recursive: true });
            await assertNoSymlinkPath(destinationParent, false);
            let copied = false;
            if (entry.action === 'move' && entry.resume && await exists(entry.destination)) {
              const targetStat = await fs.lstat(entry.destination);
              if (targetStat.isSymbolicLink() || !targetStat.isFile() || await hashFile(entry.destination) !== entry.contentHash) throw new Error(`目标已存在且内容不同: ${entry.name}`);
              copied = true;
            }
            if (!copied) {
              let created = false;
              try {
                await fs.copyFile(source.absolute, entry.destination, require('node:fs').constants.COPYFILE_EXCL);
                created = true;
                const [sourceHash, copyHash] = await Promise.all([hashFile(source.absolute), hashFile(entry.destination)]);
            if (sourceHash !== entry.contentHash || copyHash !== entry.contentHash) throw new Error('复制校验失败，源文件或副本发生变化');
              } catch (error) {
                if (created) await fs.unlink(entry.destination).catch(() => {});
                throw error;
              }
            }
            if (entry.action === 'move') {
              try {
                await trashItem(source.absolute);
              } catch (error) {
                operation.status = 'partial';
                operation.error = `副本已校验，源文件未能移入回收站: ${error?.message || error}`;
                operation.completedAt = new Date().toISOString();
                await writeStored(state);
                results.push({ id: entry.id, action: entry.action, status: 'partial', name: entry.name, destination: entry.destination, error: operation.error });
                hadFailure = true;
                try { onProgress({ phase: 'execute', workspaceId: id, completed: index + 1, total: planData.entries.length, current: entry.name }); } catch { /* Progress callbacks must not interrupt archive operations. */ }
                continue;
              }
            }
          }
          operation.status = 'completed';
          operation.completedAt = new Date().toISOString();
          await writeStored(state);
          results.push({ id: entry.id, action: entry.action, status: 'completed', name: entry.name, destination: entry.destination });
        } catch (error) {
          operation.status = 'failed';
          operation.error = error?.message || String(error);
          operation.completedAt = new Date().toISOString();
          await writeStored(state);
          results.push({ id: entry.id, action: entry.action, status: 'failed', name: entry.name, destination: entry.destination, error: operation.error });
          hadFailure = true;
        }
        try { onProgress({ phase: 'execute', workspaceId: id, completed: index + 1, total: planData.entries.length, current: entry.name }); } catch { /* Progress callbacks must not interrupt archive operations. */ }
      }
      const errors = results.filter(result => result.error).map(result => ({ id: result.id, action: result.action, message: result.error }));
      return { workspace: state, results, completed: results.filter(result => result.status === 'completed').length, total: planData.entries.length, errors };
    } catch (error) {
      const message = error?.message || String(error);
      return { workspace: state || null, results, completed: results.filter(result => result.status === 'completed').length, total: planData.entries.length, errors: [{ message }] };
    } finally {
      locks.delete(id);
    }
  }

  async function importSuggestions(id, payload) {
    validateId(id);
    if (locks.has(id)) throw new Error('工作区正在归档，暂时不能导入建议');
    const state = await getState(id);
    if (payload && !Array.isArray(payload)) {
      ensurePlainObject(payload, '建议内容');
      hasOnlyKeys(payload, new Set(['version', 'workspaceId', 'items']), '建议内容');
      if (payload.workspaceId != null && payload.workspaceId !== id) throw new Error('建议内容属于其他工作区');
    }
    const suggestions = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(suggestions)) throw new TypeError('建议内容必须是数组或 {items:[]}');
    const byId = new Map(state.items.map(item => [item.id, item]));
    for (const suggestion of suggestions) {
      ensurePlainObject(suggestion, '建议项目');
      hasOnlyKeys(suggestion, new Set(['id', 'suggestedTags', 'suggestedStatus']), '建议项目');
      if (typeof suggestion.id !== 'string' || !byId.has(suggestion.id)) throw new Error('建议项目不属于此工作区');
      const item = byId.get(suggestion.id);
      if (Object.hasOwn(suggestion, 'suggestedTags')) item.suggestedTags = cleanTags(suggestion.suggestedTags);
      if (Object.hasOwn(suggestion, 'suggestedStatus')) {
        if (![null, 'keep', 'skip', 'reject'].includes(suggestion.suggestedStatus)) throw new TypeError('suggestedStatus 无效');
        item.suggestedStatus = suggestion.suggestedStatus;
      }
    }
    await writeStored(state);
    invalidatePlans(id);
    return state;
  }

  async function exportManifest(id) {
    const state = await getState(id);
    return {
      version: 1,
      workspaceId: state.id,
      workspace: { id: state.id, sourceDir: state.sourceDir, name: state.settings.name, trip: state.settings.trip, collection: state.settings.collection },
      items: state.items.map(item => ({
        id: item.id, name: item.name, relativePath: item.relativePath, extension: item.extension, kind: item.kind, size: item.size,
        capturedAt: item.capturedAt, tags: [...(item.tags || [])], suggestedTags: [...(item.suggestedTags || [])],
        ...(item.suggestedStatus ? { suggestedStatus: item.suggestedStatus } : {})
      }))
    };
  }

  return { list, open, load, save, plan, execute, importSuggestions, exportManifest };
}

module.exports = { createStore };
