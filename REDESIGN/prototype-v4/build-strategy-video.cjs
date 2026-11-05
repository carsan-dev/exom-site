'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scene = process.argv[3] || 'training';
if (!['training', 'coach'].includes(scene)) throw Error('Unknown scene');
const [, file, sourceStart, sourceDuration] = require('./media-config.cjs').scenes.find(([key]) => key === scene);
// Keep two consecutive repetitions, trimming only the initial setup; historical frames stay untouched.
const start = scene === 'training' ? 25.8 : sourceStart;
const duration = scene === 'training' ? 9.2 : sourceDuration;
// Both use the approved HDR conversion; only the underexposed training source needs the shadow lift.
const exposure = scene === 'training' ? ",curves=all='0/0 .04/.10 .1/.24 .2/.43 .4/.65 .65/.84 .85/.94 1/1'" : '';
const filter = 'setpts=PTS-STARTPTS,fps=30,libplacebo=w=720:h=1280:colorspace=bt709:color_primaries=bt709:color_trc=iec61966-2-1:range=full:format=rgba:tonemapping=bt.2446a:peak_detect=0:contrast_recovery=0,format=rgba' + exposure + ',scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p';
const output = scene === 'training' ? 'strategy-training.mp4' : 'coaching.mp4';
const result = spawnSync(process.argv[2] || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-init_hw_device', 'vulkan=vk', '-ss', String(start), '-i', path.resolve(__dirname, '../assets/media/videos', file), '-t', String(duration), '-vf', filter, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-movflags', '+faststart', path.join(__dirname, 'assets', output)], { encoding: 'utf8' });
if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
if (scene === 'training') {
  // Decode the finished clip so the waiting image matches its first frame, including color.
  const poster = spawnSync(process.argv[2] || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(__dirname, 'assets', output), '-frames:v', '1', '-vf', 'format=rgb24', '-c:v', 'libwebp', '-lossless', '1', path.join(__dirname, 'assets', 'strategy-training-poster.webp')], { encoding: 'utf8' });
  if (poster.error || poster.status !== 0) throw poster.error || Error(poster.stderr);
}
console.log('PASS: ' + scene + ' clip, ' + start + '–' + (start + duration) + ' s, 720x1280, 30 fps, SDR, H264, no audio.');
