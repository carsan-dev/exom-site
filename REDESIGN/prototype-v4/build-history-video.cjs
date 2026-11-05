'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const source = path.resolve(__dirname, '../assets/media/videos/Físico actual Moi.mov');
const output = path.join(__dirname, 'assets/history-present');
const hash = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const originalHash = hash();
fs.mkdirSync(output, { recursive: true });
// Restore V1's intentional framing; do not upscale the native crop.
const tone = 'crop=720:1280:180:400,libplacebo=w=720:h=1280:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:format=yuv420p:tonemapping=bt.2446a:peak_detect=0:contrast_recovery=0,format=yuv420p';
const segments = [1, 6, 11];
for (const [index, start] of segments.entries()) {
execFileSync(process.argv[2] || 'ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-init_hw_device', 'vulkan=vk',
  '-ss', String(start), '-i', source, '-t', '2.6', '-vf', 'setpts=PTS-STARTPTS,fps=30,' + tone,
  '-an', '-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709',
  '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart',
  path.join(output, `pose-${index + 1}.mp4`)
], { stdio: 'inherit' });
execFileSync(process.argv[2] || 'ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(output, `pose-${index + 1}.mp4`),
  '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', path.join(output, `pose-${index + 1}.webp`)
], { stdio: 'inherit' });
}
const list = path.join(output, 'segments.txt');
fs.writeFileSync(list, segments.map((_, i) => `file 'pose-${i + 1}.mp4'`).join('\n') + '\n');
execFileSync(process.argv[2] || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(output, 'pose.mp4')], { stdio: 'inherit' });
execFileSync(process.argv[2] || 'ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(output, 'pose.mp4'),
  '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', path.join(output, 'pose.webp')
], { stdio: 'inherit' });
if (hash() !== originalHash) throw Error('Original video changed');
fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify({
  source: path.basename(source), sha256: originalHash, segments, segmentDuration: 2.6, duration: 7.8,
  crop: '720:1280:180:400', width: 720, height: 1280, fps: 30, crf: 18, toneMapping: 'bt.2446a'
}, null, 2) + '\n');
console.log('PASS: three poses, native 720x1280 crop, 30 fps, H264 SDR, no audio; source preserved.');
