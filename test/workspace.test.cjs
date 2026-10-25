'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createStore } = require('../src/workspace.cjs');

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-workspace-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, '素材');
  const dataDir = path.join(root, 'data');
  const outputDir = path.join(root, '整理结果');
  const trashDir = path.join(root, '临时回收站');
  await fs.mkdir(source, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  const trashed = [];
  const moveToTrash = options.trashItem || (async (filePath, directory) => {
    await fs.mkdir(directory, { recursive: true });
    await fs.rename(filePath, path.join(directory, `${crypto.randomUUID()}-${path.basename(filePath)}`));
  });
  const store = createStore({
    dataDir,
    readMetadata: options.readMetadata,
    trashItem: async filePath => {
      await moveToTrash(filePath, trashDir);
      trashed.push({ source: filePath });
    }
  });
  return { root, source, dataDir, outputDir, trashDir, store, trashed };
}

async function addPhoto(source, relative, contents = 'fixture-image') {
  const filePath = path.join(source, ...relative.split('/'));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
  return filePath;
}

test('scan recurses, excludes hidden and excluded directories, and restores saved workspace state', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'day/one.jpg');
  await addPhoto(f.source, 'day/two.MP4');
  await addPhoto(f.source, '.hidden/secret.jpg');
  await addPhoto(f.source, 'prototype/preview.jpg');
  await addPhoto(f.source, 'node_modules/package.jpg');
  await fs.writeFile(path.join(f.source, 'notes.txt'), 'not media');

  const opened = await f.store.open(f.source);
  assert.deepEqual(opened.items.map(item => item.relativePath), ['day/one.jpg', 'day/two.MP4']);
  assert.equal(opened.items[0].kind, 'photo');
  assert.equal(opened.items[1].kind, 'video');
  await f.store.save(opened.id, {
    settings: { trip: '镰仓', collection: '海边', tags: ['海边'] },
    items: [{ id: opened.items[0].id, status: 'keep', tags: ['海边'] }]
  });

  const recovered = createStore({ dataDir: f.dataDir, trashItem: async () => assert.fail('trash should not run') });
  const restored = await recovered.load(opened.id);
  assert.equal(restored.settings.trip, '镰仓');
  assert.equal(restored.items[0].status, 'keep');
  assert.deepEqual(restored.items[0].tags, ['海边']);
  assert.equal((await recovered.list())[0].processed, 1);
});

test('scanner excludes symlinks when the platform permits creating them', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'real.jpg');
  const outside = await addPhoto(f.root, 'outside.jpg', 'outside-fixture');
  try {
    await fs.symlink(outside, path.join(f.source, 'linked.jpg'), 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) return t.skip(`symlink creation unavailable: ${error.code}`);
    throw error;
  }
  const opened = await f.store.open(f.source);
  assert.deepEqual(opened.items.map(item => item.relativePath), ['real.jpg']);
});

test('save enforces field whitelists and importSuggestions cannot change real status or tags', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'one.jpg');
  const opened = await f.store.open(f.source);
  const item = opened.items[0];
  await assert.rejects(f.store.save(opened.id, { settings: { sourceDir: 'C:/outside' } }), /不允许的字段/);
  await assert.rejects(f.store.save(opened.id, { items: [{ id: item.id, relativePath: '../outside.jpg' }] }), /不允许的字段/);
  await f.store.save(opened.id, { items: [{ id: item.id, tags: ['已有标签'] }] });

  await f.store.importSuggestions(opened.id, { items: [{ id: item.id, suggestedTags: ['建议标签'], suggestedStatus: 'reject' }] });
  const after = (await f.store.load(opened.id)).items[0];
  assert.equal(after.status, null);
  assert.deepEqual(after.tags, ['已有标签']);
  assert.deepEqual(after.suggestedTags, ['建议标签']);
  assert.equal(after.suggestedStatus, 'reject');
  await assert.rejects(f.store.importSuggestions(opened.id, [{ id: item.id, status: 'reject' }]), /不允许的字段/);
  await assert.rejects(f.store.importSuggestions(opened.id, [{ id: '0'.repeat(64), suggestedTags: ['x'] }]), /不属于/);
});

test('plan sanitizes names, avoids disk collisions, copies exclusively, and suppresses successful repeats', async t => {
  const f = await fixture(t, { readMetadata: async () => ({ capturedAt: '2024:01:02 03:04:05' }) });
  await addPhoto(f.source, '2024-01-02_03-04-05.jpg', 'copy-me');
  const opened = await f.store.open(f.source);
  const item = opened.items[0];
  await f.store.save(opened.id, {
    settings: { trip: 'CON', collection: 'A/B', archiveMode: 'copy' },
    items: [{ id: item.id, status: 'keep', tags: ['海边'] }]
  });
  const desiredName = '_CON_A-B_海边_20240102-030405.jpg';
  await fs.writeFile(path.join(f.outputDir, desiredName), 'pre-existing-user-file');
  const plan = await f.store.plan(opened.id, f.outputDir);
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].name, '_CON_A-B_海边_20240102-030405_02.jpg');
  assert.equal(plan.kept, 1);
  assert.equal(plan.unprocessed, 0);
  const result = await f.store.execute(opened.id, plan.token);
  assert.deepEqual(result.errors, []);
  assert.equal(result.results[0].status, 'completed');
  assert.equal(await fs.readFile(path.join(f.outputDir, desiredName), 'utf8'), 'pre-existing-user-file');
  assert.equal(await fs.readFile(path.join(f.outputDir, plan.entries[0].name), 'utf8'), 'copy-me');
  assert.equal(await fs.readFile(path.join(f.source, item.relativePath), 'utf8'), 'copy-me');

  const repeated = await f.store.plan(opened.id, f.outputDir);
  assert.equal(repeated.kept, 1);
  assert.equal(repeated.entries.length, 0);
  const noOp = await f.store.execute(opened.id, repeated.token);
  assert.equal(noOp.completed, 0);
  assert.deepEqual(noOp.errors, []);
  assert.equal((await fs.readdir(f.outputDir)).length, 2);
});

test('move copies and verifies before trashing source; copied file remains intact', async t => {
  const f = await fixture(t);
  const sourceFile = await addPhoto(f.source, 'move-me.png', 'move-content');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { settings: { archiveMode: 'move' }, items: [{ id: opened.items[0].id, status: 'keep' }] });
  const plan = await f.store.plan(opened.id, f.outputDir);
  const result = await f.store.execute(opened.id, plan.token);
  assert.deepEqual(result.errors, []);
  assert.equal(result.results[0].status, 'completed');
  assert.equal(f.trashed.length, 1);
  await assert.rejects(fs.access(sourceFile), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(f.outputDir, plan.entries[0].name), 'utf8'), 'move-content');
});

test('reject cannot be planned until reviewed, then trashes once and never repeats', async t => {
  const f = await fixture(t);
  const sourceFile = await addPhoto(f.source, 'remove.jpg');
  const opened = await f.store.open(f.source);
  const item = opened.items[0];
  await f.store.save(opened.id, { items: [{ id: item.id, status: 'reject' }] });
  await assert.rejects(f.store.plan(opened.id, f.outputDir), /尚未复审/);
  await f.store.save(opened.id, { items: [{ id: item.id, deleteReviewed: true }] });
  const plan = await f.store.plan(opened.id, f.outputDir);
  assert.equal(plan.deleted, 1);
  assert.equal(plan.entries[0].action, 'trash');
  assert.equal(plan.entries[0].destination, null);
  const result = await f.store.execute(opened.id, plan.token);
  assert.deepEqual(result.errors, []);
  assert.equal(result.results[0].status, 'completed');
  assert.equal(f.trashed.length, 1);
  await assert.rejects(fs.access(sourceFile), { code: 'ENOENT' });
  const again = await f.store.plan(opened.id, f.outputDir);
  assert.equal(again.entries.length, 0);
  assert.equal((await f.store.execute(opened.id, again.token)).completed, 0);
  assert.equal(f.trashed.length, 1);
});

test('all source files are preflighted before any destination mutation', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'a.jpg', 'first');
  const second = await addPhoto(f.source, 'b.jpg', 'second');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { items: opened.items.map(item => ({ id: item.id, status: 'keep' })) });
  const plan = await f.store.plan(opened.id, f.outputDir);
  await fs.writeFile(second, 'changed-size-and-content');
  const result = await f.store.execute(opened.id, plan.token);
  assert.equal(result.completed, 0);
  assert.match(result.errors[0].message, /已变化/);
  assert.deepEqual(await fs.readdir(f.outputDir), []);
  assert.equal(await fs.readFile(path.join(f.source, 'a.jpg'), 'utf8'), 'first');
});

test('rejects destinations nested inside the source tree', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'one.jpg');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { items: [{ id: opened.items[0].id, status: 'keep' }] });
  const nestedOutput = path.join(f.source, 'archive');
  await assert.rejects(f.store.plan(opened.id, nestedOutput), /不能位于素材源目录内/, `source=${opened.sourceDir}; output=${nestedOutput}`);
});

test('rejects tampered traversal paths before planning', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'one.jpg');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { items: [{ id: opened.items[0].id, status: 'keep' }] });
  const storedPath = path.join(f.dataDir, 'workspaces', `${opened.id}.json`);
  const stored = JSON.parse(await fs.readFile(storedPath, 'utf8'));
  stored.items[0].relativePath = '../outside.jpg';
  await fs.writeFile(storedPath, JSON.stringify(stored));
  await assert.rejects(f.store.plan(opened.id, f.outputDir), /路径校验失败|相对路径无效|越界/);
});

test('plan tokens are process-local and cannot be replayed across stores', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'one.jpg');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { items: [{ id: opened.items[0].id, status: 'keep' }] });
  const plan = await f.store.plan(opened.id, f.outputDir);
  const recovered = createStore({ dataDir: f.dataDir, trashItem: async () => {} });
  await assert.rejects(recovered.execute(opened.id, plan.token), /已失效/);
});

test('saving workspace state invalidates an outstanding plan token', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'one.jpg');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { items: [{ id: opened.items[0].id, status: 'keep' }] });
  const plan = await f.store.plan(opened.id, f.outputDir);
  await f.store.save(opened.id, { settings: { collection: '新地点' } });
  await assert.rejects(f.store.execute(opened.id, plan.token), /失效|变化/);
  assert.deepEqual(await fs.readdir(f.outputDir), []);
});

test('rescanning changed same-name media clears review and completion records', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'copy.jpg', 'copy-before');
  await addPhoto(f.source, 'reject.jpg', 'reject-before');
  const opened = await f.store.open(f.source);
  const copy = opened.items.find(item => item.name === 'copy.jpg');
  const reject = opened.items.find(item => item.name === 'reject.jpg');
  await f.store.save(opened.id, { items: [
    { id: copy.id, status: 'keep' },
    { id: reject.id, status: 'reject', deleteReviewed: true }
  ] });
  const plan = await f.store.plan(opened.id, f.outputDir);
  const execution = await f.store.execute(opened.id, plan.token);
  assert.deepEqual(execution.errors, []);
  assert.ok((await f.store.load(opened.id)).operations.some(op => op.itemId === copy.id && op.status === 'completed'));

  await fs.writeFile(path.join(f.source, 'copy.jpg'), 'copy-after-changed');
  await fs.writeFile(path.join(f.source, 'reject.jpg'), 'reject-after-changed');
  const rescanned = await f.store.open(f.source);
  const refreshedCopy = rescanned.items.find(item => item.name === 'copy.jpg');
  const refreshedReject = rescanned.items.find(item => item.name === 'reject.jpg');
  assert.equal(refreshedCopy.status, null);
  assert.equal(refreshedReject.status, null);
  assert.equal(refreshedReject.deleteReviewed, false);
  assert.ok(!rescanned.operations.some(op => op.itemId === copy.id));
});

test('partial move resumes from its verified copy without duplicating output', async t => {
  let failFirstTrash = true;
  const f = await fixture(t, {
    trashItem: async (filePath, trashDir) => {
      if (failFirstTrash) {
        failFirstTrash = false;
        throw new Error('simulated temporary trash failure');
      }
      await fs.mkdir(trashDir, { recursive: true });
      await fs.rename(filePath, path.join(trashDir, `${crypto.randomUUID()}-${path.basename(filePath)}`));
    }
  });
  const sourceFile = await addPhoto(f.source, 'resume.jpg', 'resume-content');
  const opened = await f.store.open(f.source);
  await f.store.save(opened.id, { settings: { archiveMode: 'move' }, items: [{ id: opened.items[0].id, status: 'keep' }] });
  const firstPlan = await f.store.plan(opened.id, f.outputDir);
  const first = await f.store.execute(opened.id, firstPlan.token);
  assert.equal(first.results[0].status, 'partial');
  assert.ok(await fs.readFile(sourceFile, 'utf8'));
  const outputName = first.results[0].name;
  assert.equal(await fs.readFile(path.join(f.outputDir, outputName), 'utf8'), 'resume-content');

  const retryPlan = await f.store.plan(opened.id, f.outputDir);
  assert.equal(retryPlan.entries.length, 1);
  assert.equal(retryPlan.entries[0].name, outputName);
  const retry = await f.store.execute(opened.id, retryPlan.token);
  assert.deepEqual(retry.errors, []);
  assert.equal(retry.results[0].status, 'completed');
  await assert.rejects(fs.access(sourceFile), { code: 'ENOENT' });
  assert.deepEqual(await fs.readdir(f.outputDir), [outputName]);
});

test('long CJK output names stay within 240 UTF-8 bytes and retain the extension', async t => {
  const f = await fixture(t);
  await addPhoto(f.source, 'long-name.jpg', 'bytes');
  const opened = await f.store.open(f.source);
  const item = opened.items[0];
  await f.store.save(opened.id, {
    settings: { trip: '旅'.repeat(90), collection: '所'.repeat(90) },
    items: [{ id: item.id, status: 'keep', tags: ['景'.repeat(40)] }]
  });
  const plan = await f.store.plan(opened.id, f.outputDir);
  assert.equal(plan.entries.length, 1);
  assert.ok(Buffer.byteLength(plan.entries[0].name, 'utf8') <= 240);
  assert.ok(plan.entries[0].name.endsWith('.jpg'));
});
