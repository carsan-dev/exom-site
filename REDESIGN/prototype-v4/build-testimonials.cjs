'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ffmpeg = process.argv[2] || 'ffmpeg';
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'assets/testimonials-v1');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'exom-testimonials-'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
fs.mkdirSync(output, { recursive: true });
function convert(name, args) {
  const log = fs.openSync(path.join(scratch, name + '.log'), 'w');
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-y', ...args], { stdio: ['ignore', log, log], windowsHide: true });
  fs.closeSync(log);
  assert.equal(result.status, 0, 'Media conversion failed; see ' + scratch);
}
for (const [name, crf] of [['adrian', '21.4'], ['gloria', '19'], ['lucia', null]]) {
  const original = 'assets/testimonio_' + name + '.mp4';
  const source = path.join(root, original);
  const before = digest(fs.readFileSync(source));
  const video = path.join(scratch, name + '.mp4');
  convert(name, ['-i', source, '-map', '0:v:0', '-map', '0:a:0', ...(crf ? ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', crf, '-pix_fmt', 'yuv420p', '-c:a', 'copy'] : ['-c', 'copy']), '-map_metadata', '-1', '-movflags', '+faststart', video]);
  const poster = path.join(scratch, name + '.webp');
  convert(name + '-poster', ['-ss', '1', '-i', source, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', poster]);
  const record = { name, original, originalSha256: before, crf, preset: crf ? 'veryslow' : 'stream-copy', posterTime: 1 };
  for (const [kind, file, limit] of [['video', video, 5000000], ['poster', poster, 500000]]) {
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length <= limit, 'Size limit exceeded; ask owner before reducing quality');
    const relative = 'assets/testimonials-v1/' + path.basename(file);
    fs.copyFileSync(file, path.join(__dirname, relative));
    record[kind] = { file: relative, bytes: bytes.length, sha256: digest(bytes), ...(kind === 'poster' ? { quality: 80 } : {}) };
  }
  assert.equal(digest(fs.readFileSync(source)), before);
  records.push(record);
}
fs.writeFileSync(path.join(output, 'sources.json'), JSON.stringify(records, null, 2) + '\n');
console.log('PASS: three full-length MP4s <=5 MB; WebP quality 80 <=500 KB; originals preserved. Logs: ' + scratch);
