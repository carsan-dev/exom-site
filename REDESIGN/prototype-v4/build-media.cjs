'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sceneSpecs, gallerySpec } = require('./motion.js');
const config = require('./media-config.cjs');
const ffmpeg = process.argv[2] || 'ffmpeg';
const mode = process.argv[3] || '--all';
if (!['--all', '--gallery-only', '--scenes-only', '--training-only', '--coach-only', '--clips-only'].includes(mode)) throw Error('Unknown media scope');
const sources = path.resolve(__dirname, '../assets/media/videos');
const assets = path.join(__dirname, 'assets');

function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-init_hw_device', 'vulkan=vk', ...args], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
}
function tone(width, height, rgb = true) {
  const output = rgb ? 'color_trc=iec61966-2-1:range=full:format=rgba' : 'color_trc=bt709:range=tv:format=yuv420p';
  return `libplacebo=w=${width}:h=${height}:colorspace=bt709:color_primaries=bt709:${output}:tonemapping=bt.2446a:peak_detect=0:contrast_recovery=0,format=${rgb ? 'rgba' : 'yuv420p'}`;
}
function exportSequence([key, file, start, duration], spec, isGallery) {
  const { width, height, columns, directory, quality } = spec;
  const dir = path.join(assets, directory, key);
  fs.mkdirSync(dir, { recursive: true });
  const input = ['-ss', String(start), '-i', path.join(sources, file)];
  // Reuse the approved shadow/midtone lift only for this underexposed source, after HDR-to-SDR conversion.
  const exposure = file === 'Entreno moi pierna.MOV' ? ",curves=all='0/0 .04/.10 .1/.24 .2/.43 .4/.65 .65/.84 .85/.94 1/1'" : '';
  const filter = tone(width, height) + exposure;
  run([...input, '-vf', `trim=duration=${duration},fps=24,${filter},tile=${columns}x${columns}`, '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', path.join(dir, 'sheet-%02d.webp')]);
  const poster = isGallery ? path.join(assets, directory, key + '-poster.webp') : path.join(dir, 'poster.webp');
  run([...input, '-vf', filter, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', poster]);
}
if (mode === '--all' || mode === '--gallery-only') {
  for (const entry of config.gallery) exportSequence(entry, gallerySpec, true);
}
if (mode === '--all' || mode === '--scenes-only' || mode === '--training-only' || mode === '--coach-only') {
  for (const entry of config.scenes) {
    if (mode === '--training-only' && entry[0] !== 'training') continue;
    if (mode === '--coach-only' && entry[0] !== 'coach') continue;
    exportSequence(entry, sceneSpecs[entry[0]], false);
  }
}
if (mode === '--all' || mode === '--clips-only') {
  const dir = path.join(assets, 'clients-v1');
  fs.mkdirSync(dir, { recursive: true });
  for (const [key, file, start, duration] of config.clips) {
    const input = ['-ss', String(start), '-i', path.join(sources, file)];
    const stem = path.join(dir, key);
    const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
    run([...input, '-t', String(duration), '-vf', tone(540, 960, false), '-r', '24', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-profile:v', 'main', '-pix_fmt', 'yuv420p', ...color, '-movflags', '+faststart', stem + '.mp4']);
    run([...input, '-vf', tone(540, 960), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', stem + '.webp']);
  }
}
console.log('PASS: V3 media exported (' + mode + '); V2, original media and D47 untouched.');
