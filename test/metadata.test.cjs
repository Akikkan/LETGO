const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readMetadata, MAX_HEADER_BYTES } = require('../src/metadata.cjs');

function makeTiff() {
  const buffer = Buffer.alloc(160);
  buffer.write('II', 0, 'ascii');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(4, 8);
  writeEntry(buffer, 10, 0x0112, 3, 1, 6);
  writeEntry(buffer, 22, 0x0100, 4, 1, 2400);
  writeEntry(buffer, 34, 0x0101, 4, 1, 1600);
  writeEntry(buffer, 46, 0x8769, 4, 1, 62);
  buffer.writeUInt32LE(0, 58);

  buffer.writeUInt16LE(2, 62);
  writeEntry(buffer, 64, 0x9003, 2, 20, 100);
  writeEntry(buffer, 76, 0x0132, 2, 20, 120);
  buffer.writeUInt32LE(0, 88);
  buffer.write('2024:05:06 07:08:09\0', 100, 'ascii');
  buffer.write('2020:01:02 03:04:05\0', 120, 'ascii');
  return buffer;
}

function writeEntry(buffer, offset, tag, type, count, value) {
  buffer.writeUInt16LE(tag, offset);
  buffer.writeUInt16LE(type, offset + 2);
  buffer.writeUInt32LE(count, offset + 4);
  if (type === 3) buffer.writeUInt16LE(value, offset + 8);
  else buffer.writeUInt32LE(value, offset + 8);
}

function makeJpegWithExif() {
  const tiff = makeTiff();
  const app1Payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const app1 = Buffer.alloc(4 + app1Payload.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(app1Payload.length + 2, 2);
  app1Payload.copy(app1, 4);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x06, 0x40, 0x09, 0x60, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof, Buffer.from([0xff, 0xd9])]);
}

test('reads preferred EXIF date and applies orientation dimensions for TIFF', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-meta-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'image.tif');
  await fs.writeFile(file, makeTiff());
  assert.deepEqual(await readMetadata(file), {
    capturedAt: '2024-05-06T07:08:09',
    width: 1600,
    height: 2400,
  });
});

test('reads JPEG EXIF and ignores corrupt input', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-meta-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const jpeg = path.join(dir, 'image.jpg');
  const corrupt = path.join(dir, 'broken.jpg');
  await fs.writeFile(jpeg, makeJpegWithExif());
  await fs.writeFile(corrupt, Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]));
  assert.deepEqual(await readMetadata(jpeg), {
    capturedAt: '2024-05-06T07:08:09',
    width: 1600,
    height: 2400,
  });
  assert.deepEqual(await readMetadata(corrupt), {});
  assert.equal(MAX_HEADER_BYTES, 256 * 1024);
});

test('returns empty metadata for unsupported or unreadable files', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-meta-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'video.mov');
  await fs.writeFile(file, Buffer.alloc(1024 * 1024, 0x61));
  assert.deepEqual(await readMetadata(file), {});
  assert.deepEqual(await readMetadata(path.join(dir, 'missing.jpg')), {});
});
