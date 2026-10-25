const fs = require('node:fs/promises');

const MAX_HEADER_BYTES = 256 * 1024;

/** Read a bounded file header and extract camera date and image dimensions. */
async function readMetadata(fullPath) {
  let handle;
  try {
    handle = await fs.open(fullPath, 'r');
    const buffer = Buffer.alloc(MAX_HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (!bytesRead) return {};
    const header = buffer.subarray(0, bytesRead);
    if (isJpeg(header)) return parseJpeg(header);
    if (isTiff(header, 0)) return parseTiff(header, 0);
    return {};
  } catch {
    return {};
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function isJpeg(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function isTiff(buffer, offset) {
  if (offset < 0 || offset + 8 > buffer.length) return false;
  const a = buffer[offset];
  const b = buffer[offset + 1];
  return ((a === 0x49 && b === 0x49) || (a === 0x4d && b === 0x4d)) &&
    readU16(buffer, offset + 2, a === 0x49) === 42;
}

function parseJpeg(buffer) {
  let capturedAt;
  let orientation = 1;
  let width;
  let height;
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    const payloadOffset = offset + 2;
    const payloadLength = segmentLength - 2;

    if (marker === 0xe1 && payloadLength >= 6 && buffer.toString('ascii', payloadOffset, payloadOffset + 6) === 'Exif\0\0') {
      const exif = parseTiff(buffer, payloadOffset + 6);
      capturedAt = capturedAt || exif.capturedAt;
      orientation = exif.orientation || orientation;
      width = width || exif.width;
      height = height || exif.height;
    }
    if (isSofMarker(marker) && payloadLength >= 5) {
      height = height || buffer.readUInt16BE(payloadOffset + 1);
      width = width || buffer.readUInt16BE(payloadOffset + 3);
    }
    offset += segmentLength;
  }

  const result = {};
  if (capturedAt) result.capturedAt = capturedAt;
  if (width && height) {
    if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
    result.width = width;
    result.height = height;
  }
  return result;
}

function isSofMarker(marker) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function parseTiff(buffer, base) {
  if (!isTiff(buffer, base)) return {};
  const little = buffer[base] === 0x49;
  const firstIfd = readU32(buffer, base + 4, little);
  if (firstIfd === null) return {};

  const result = { orientation: 1 };
  const visited = new Set();
  const readIfd = (relativeOffset, kind) => {
    if (!Number.isSafeInteger(relativeOffset) || relativeOffset < 8 || visited.has(relativeOffset)) return;
    const ifd = base + relativeOffset;
    if (ifd + 2 > buffer.length) return;
    const count = readU16(buffer, ifd, little);
    if (count === null || count > 4096 || ifd + 2 + count * 12 > buffer.length) return;
    visited.add(relativeOffset);
    let exifIfd;
    for (let index = 0; index < count; index += 1) {
      const entry = ifd + 2 + index * 12;
      const tag = readU16(buffer, entry, little);
      const type = readU16(buffer, entry + 2, little);
      const n = readU32(buffer, entry + 4, little);
      if (tag === null || type === null || n === null) continue;
      if (tag === 0x8769 && kind === 'main' && n === 1) {
        exifIfd = readU32(buffer, entry + 8, little);
        continue;
      }
      if ((tag === 0x0100 || tag === 0x0101 || tag === 0x0112) && n >= 1) {
        const value = readEntryValues(buffer, base, entry, type, n, little);
        if (!value || value.length === 0) continue;
        if (tag === 0x0100 && kind === 'main') result.width = value[0];
        if (tag === 0x0101 && kind === 'main') result.height = value[0];
        if (tag === 0x0112 && kind === 'main' && value[0] >= 1 && value[0] <= 8) result.orientation = value[0];
      }
      if ((tag === 0x9003 || tag === 0x0132) && type === 2 && n > 0) {
        const text = readAsciiEntry(buffer, base, entry, n, little);
        const date = parseExifDate(text);
        if (date && (tag === 0x9003 || !result.capturedAt)) result.capturedAt = date;
      }
    }
    if (exifIfd !== undefined) readIfd(exifIfd, 'exif');
  };

  readIfd(firstIfd, 'main');
  if (!result.capturedAt && result.width == null && result.height == null) return {};
  if (!result.width || !result.height) {
    delete result.width;
    delete result.height;
  } else if (result.orientation >= 5 && result.orientation <= 8) {
    [result.width, result.height] = [result.height, result.width];
  }
  delete result.orientation;
  return result;
}

function readEntryValues(buffer, base, entry, type, count, little) {
  const size = typeSize(type);
  if (!size || count > Math.floor(buffer.length / size)) return null;
  const total = size * count;
  const start = total <= 4 ? entry + 8 : base + (readU32(buffer, entry + 8, little) ?? Number.MAX_SAFE_INTEGER);
  if (start < base || start + total > buffer.length) return null;
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const at = start + i * size;
    let value;
    if (type === 3) value = readU16(buffer, at, little);
    else if (type === 4) value = readU32(buffer, at, little);
    else return null;
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

function readAsciiEntry(buffer, base, entry, count, little) {
  if (count > MAX_HEADER_BYTES) return '';
  const start = count <= 4 ? entry + 8 : base + (readU32(buffer, entry + 8, little) ?? Number.MAX_SAFE_INTEGER);
  if (start < base || start + count > buffer.length) return '';
  return buffer.toString('ascii', start, start + count).replace(/\0+$/, '');
}

function typeSize(type) {
  if (type === 1 || type === 2 || type === 6 || type === 7) return 1;
  if (type === 3 || type === 8) return 2;
  if (type === 4 || type === 9 || type === 11) return 4;
  if (type === 5 || type === 10 || type === 12) return 8;
  return 0;
}

function parseExifDate(value) {
  const match = /^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [y, m, d, h, min, sec] = parts;
  const date = new Date(Date.UTC(y, m - 1, d, h, min, sec));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || h > 23 || min > 59 || sec > 59) return undefined;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function readU16(buffer, offset, little) {
  if (offset < 0 || offset + 2 > buffer.length) return null;
  return little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readU32(buffer, offset, little) {
  if (offset < 0 || offset + 4 > buffer.length) return null;
  return little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

module.exports = { readMetadata, MAX_HEADER_BYTES };
