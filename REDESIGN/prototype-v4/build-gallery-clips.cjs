'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gallery } = require('./media-config.cjs');
const output = path.join(__dirname, 'assets/gallery-clips-v1');
fs.mkdirSync(output, { recursive: true });
for (const [key, file, start, duration] of gallery) {
  const filter = `trim=start=0:end=${duration},setpts=PTS-STARTPTS,libplacebo=w=360:h=640:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:format=yuv420p:tonemapping=bt.2446a:peak_detect=0:contrast_recovery=0,format=yuv420p`;
  const result = spawnSync(process.argv[2] || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-init_hw_device', 'vulkan=vk', '-ss', String(start), '-i', path.resolve(__dirname, '../assets/media/videos', file), '-t', String(duration), '-vf', filter, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-fps_mode', 'passthrough', '-enc_time_base', 'filter', '-movflags', '+faststart', path.join(output, key + '.mp4')], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
}
console.log('PASS: six exact gallery intervals, 360x640, source frame timing, SDR, H264 8-bit, no audio.');
