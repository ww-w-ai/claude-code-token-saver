#!/usr/bin/env node
/**
 * shrink-img.js — zero-dependency image downscaler (preview shrinker, NOT a cropper).
 *
 * Why: when an AI attaches a full-res image FILE to itself to find layout / text /
 * divider positions, the decoded RGBA payload can blow past the tool-call limit
 * ("Request too large / 32MB"). A downscaled copy (default longest side 1000px)
 * stays perfectly readable for position-finding at a fraction of the payload.
 *
 * Usage:
 *   node shrink-img.js <src> [--out <path>] [--scale <f>] [--maxdim <px>]
 *                      [--width <px>] [--height <px>] [--maxmp <mp>] [--quality <1-100>]
 *     <src>          source image path (required)
 *   Sizing — all OPTIONAL upper bounds; combine freely, the tightest wins, NEVER
 *   upscales, aspect always preserved. If none given, defaults to --maxdim 1000.
 *     --scale <f>    relative factor, e.g. 0.5 (half).
 *     --maxdim <px>  clamp LONGEST side to N px (absolute).
 *     --width <px>   clamp width to N px.
 *     --height <px>  clamp height to N px.
 *     --maxmp <mp>   clamp TOTAL pixels to N megapixels (resolution/payload budget).
 *   Other:
 *     --quality <n>  JPEG output quality 1-100 (default 85). Ignored for PNG.
 *     --out <path>   output path. Default: <name>-sm<ext> beside src.
 *
 * On success prints EXACTLY one stdout line:
 *   <outpath>: <W>x<H> -> <w>x<h> (scale <s.sss>), decoded RGBA ~= <M.MM>MB, disk <K>KB
 * On error prints one "shrink-img: ..." line to stderr and exits 1.
 *
 * Strategy (zero-dep, cross-platform — plugin ships with NO node_modules):
 *   - macOS (darwin): shell out to built-in `sips` (-Z clamps longest side; PNG+JPEG).
 *   - Non-darwin PNG:  VENDORED pure-JS pngjs (lib/vendor/pngjs, MIT).
 *   - Non-darwin JPEG: VENDORED pure-JS jpeg-js (lib/vendor/jpeg-js, BSD).
 *     Both decode -> we box/area-average downscale the RGBA -> the lib re-encodes.
 *     pngjs uses Node's built-in zlib; neither has native addons or npm deps.
 *   - Non-darwin OTHER formats (GIF/TIFF/WebP…): last-resort ffmpeg / ImageMagick
 *     (magick|convert) if present. PNG+JPEG never need an external tool.
 *
 * We do NOT hand-roll image codecs — pngjs / jpeg-js (third-party, vendored;
 * see scripts/lib/vendor/ + repo THIRD-PARTY-NOTICES.md) own the hard parse/encode.
 * This file only owns arg-parsing, the box downscale, and platform routing.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---- error helper: one stderr line + exit 1 ---------------------------------
function fail(msg) {
  process.stderr.write('shrink-img: ' + msg + '\n');
  process.exit(1);
}

// ---- arg parsing ------------------------------------------------------------
function parseArgs(argv) {
  // All sizing flags are OPTIONAL upper bounds on the output. Any combination is
  // allowed; the most restrictive wins; output never upscales. If NONE is given,
  // a default of --maxdim 1000 is applied.
  const opts = {
    src: null, out: null, quality: 85, forceNode: false,
    scale: null, maxdim: null, width: null, height: null, maxmp: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--scale') opts.scale = parseFloat(argv[++i]);
    else if (a === '--maxdim') opts.maxdim = parseInt(argv[++i], 10);
    else if (a === '--width') opts.width = parseInt(argv[++i], 10);
    else if (a === '--height') opts.height = parseInt(argv[++i], 10);
    else if (a === '--maxmp') opts.maxmp = parseFloat(argv[++i]);
    else if (a === '--quality') opts.quality = parseInt(argv[++i], 10);
    else if (a === '--force-node') opts.forceNode = true; // hidden: force vendored pure-JS path
    else if (a.startsWith('--')) fail('unknown flag ' + a);
    else if (opts.src === null) opts.src = a;
    else fail('unexpected extra arg ' + a);
  }
  if (!opts.src) fail('missing <src>. usage: node shrink-img.js <src> [--out <path>] ' +
    '[--scale <f>] [--maxdim <px>] [--width <px>] [--height <px>] [--maxmp <mp>] [--quality <1-100>]');
  const pos = (v, name) => { if (v !== null && (!Number.isFinite(v) || v <= 0)) fail(name + ' must be a positive number'); };
  pos(opts.scale, '--scale'); pos(opts.maxdim, '--maxdim');
  pos(opts.width, '--width'); pos(opts.height, '--height'); pos(opts.maxmp, '--maxmp');
  if (!Number.isFinite(opts.quality) || opts.quality < 1 || opts.quality > 100) fail('--quality must be 1-100');
  // Default: no sizing flag given -> longest side 1000px.
  if (opts.scale === null && opts.maxdim === null && opts.width === null &&
      opts.height === null && opts.maxmp === null) opts.maxdim = 1000;
  return opts;
}

// ---- default output path: <name>-sm<ext> beside src -------------------------
function defaultOut(src) {
  const ext = path.extname(src);
  const base = path.basename(src, ext);
  return path.join(path.dirname(src), base + '-sm' + ext);
}

// Compute target dims. Each provided flag is an upper bound on the scale factor;
// the final scale = min of all of them, clamped to <= 1 (NEVER upscales). Aspect
// is always preserved (a single scale for both axes).
function targetDims(W, H, opts) {
  const bounds = [];
  if (opts.scale !== null) bounds.push(opts.scale);                 // relative factor
  if (opts.maxdim !== null) bounds.push(opts.maxdim / Math.max(W, H)); // longest side <= px
  if (opts.width !== null) bounds.push(opts.width / W);             // width <= px
  if (opts.height !== null) bounds.push(opts.height / H);           // height <= px
  if (opts.maxmp !== null) bounds.push(Math.sqrt((opts.maxmp * 1e6) / (W * H))); // total px budget
  let scale = bounds.length ? Math.min(...bounds) : 1;
  scale = Math.min(scale, 1); // never upscale
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  return { w, h };
}

// Emit the single success summary line.
function report(outPath, W, H, w, h) {
  const scale = H > 0 ? h / H : 1; // new/old (height ratio == width ratio, aspect preserved)
  const mb = (w * h * 4) / 1024 / 1024;
  let diskKB = 0;
  try { diskKB = Math.round(fs.statSync(outPath).size / 1024); } catch (_) {}
  process.stdout.write(
    `${outPath}: ${W}x${H} -> ${w}x${h} (scale ${scale.toFixed(3)}), ` +
    `decoded RGBA ~= ${mb.toFixed(2)}MB, disk ${diskKB}KB\n`
  );
}

// The only "image math" we own: box / area-average downscale of an RGBA buffer.
// Averages the source pixels covering each destination pixel (anti-aliased).
function boxResize(rgba, W, H, w, h) {
  if (w === W && h === H) return Buffer.from(rgba);
  const out = Buffer.alloc(w * h * 4);
  for (let dy = 0; dy < h; dy++) {
    const sy0 = Math.floor(dy * H / h);
    const sy1 = Math.max(sy0 + 1, Math.floor((dy + 1) * H / h));
    for (let dx = 0; dx < w; dx++) {
      const sx0 = Math.floor(dx * W / w);
      const sx1 = Math.max(sx0 + 1, Math.floor((dx + 1) * W / w));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const si = (sy * W + sx) * 4;
          r += rgba[si]; g += rgba[si + 1]; b += rgba[si + 2]; a += rgba[si + 3]; n++;
        }
      }
      const di = (dy * w + dx) * 4;
      out[di] = (r / n) | 0; out[di + 1] = (g / n) | 0; out[di + 2] = (b / n) | 0; out[di + 3] = (a / n) | 0;
    }
  }
  return out;
}

// =============================================================================
// macOS path — built-in `sips`
// =============================================================================
function sipsDims(file) {
  // `sips -g pixelWidth -g pixelHeight <file>` -> lines "  pixelWidth: 1672"
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  const wm = out.match(/pixelWidth:\s*(\d+)/);
  const hm = out.match(/pixelHeight:\s*(\d+)/);
  if (!wm || !hm) throw new Error('could not read dims from sips');
  return { W: parseInt(wm[1], 10), H: parseInt(hm[1], 10) };
}

function runSips(opts, outPath) {
  const { W, H } = sipsDims(opts.src);
  const { w, h } = targetDims(W, H, opts);
  const longest = Math.max(w, h); // sips -Z sets max(width,height) preserving aspect
  execFileSync('sips', ['-Z', String(longest), opts.src, '--out', outPath]);
  const d = sipsDims(outPath); // re-read actual out dims (sips rounds independently)
  report(outPath, W, H, d.W, d.H);
}

// =============================================================================
// Non-darwin PNG path — vendored pngjs (decode/encode) + our box downscale
// =============================================================================
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function isPng(buf) {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG);
}

function runNodePng(opts, outPath, srcBuf) {
  // Vendored, MIT, zero-dep, Node-zlib-based. See lib/vendor/pngjs/.
  // pngjs imposes no resolution cap — the only ceiling is real memory (a huge image
  // needs W*H*4 bytes decoded before it can be downscaled). No artificial limit here.
  const pngSync = require(path.join(__dirname, 'lib', 'vendor', 'pngjs', 'lib', 'png-sync.js'));
  let src;
  try {
    src = pngSync.read(srcBuf); // { width, height, data(RGBA Buffer) } — handles filter/palette/interlace
  } catch (e) {
    throw new Error('PNG decode failed (' + e.message + '). For an extremely large ' +
      'image that exhausts memory, run on macOS (sips) or install ffmpeg/ImageMagick.');
  }
  const W = src.width, H = src.height;
  const { w, h } = targetDims(W, H, opts);
  const scaled = boxResize(src.data, W, H, w, h);
  const outBuf = pngSync.write({ width: w, height: h, data: scaled });
  fs.writeFileSync(outPath, outBuf);
  report(outPath, W, H, w, h);
}

// =============================================================================
// Non-darwin JPEG path — vendored jpeg-js (decode/encode) + our box downscale
// =============================================================================
function isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function runNodeJpeg(opts, outPath, srcBuf) {
  // Vendored, BSD, zero-dep, pure-JS. See lib/vendor/jpeg-js/.
  const jpeg = require(path.join(__dirname, 'lib', 'vendor', 'jpeg-js', 'index.js'));
  // Lift jpeg-js's built-in caps (default 100MP / 512MB) so ANY image size is
  // accepted — this is a general-purpose shrinker, no artificial size limit.
  let src;
  try {
    src = jpeg.decode(srcBuf, {
      useTArray: true, formatAsRGBA: true,
      maxResolutionInMP: Infinity, maxMemoryUsageInMB: Infinity,
    }); // { width, height, data(RGBA) }
  } catch (e) {
    throw new Error('JPEG decode failed (' + e.message + '). For an extremely large ' +
      'image that exhausts memory, run on macOS (sips) or install ffmpeg/ImageMagick.');
  }
  const W = src.width, H = src.height;
  const { w, h } = targetDims(W, H, opts);
  const scaled = boxResize(Buffer.from(src.data.buffer, src.data.byteOffset, src.data.length), W, H, w, h);
  const enc = jpeg.encode({ data: scaled, width: w, height: h }, opts.quality); // { data(JPEG) }
  fs.writeFileSync(outPath, Buffer.from(enc.data));
  report(outPath, W, H, w, h);
}

// =============================================================================
// Non-darwin other formats — last-resort ffmpeg / ImageMagick
// =============================================================================
function has(cmd) {
  try { execFileSync('command', ['-v', cmd], { shell: '/bin/sh', stdio: 'ignore' }); return true; }
  catch (_) {
    try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch (_2) { return false; }
  }
}

function readImgDimsExternal(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file], { encoding: 'utf8' }).trim();
    const m = out.match(/(\d+)x(\d+)/);
    if (m) return { W: parseInt(m[1], 10), H: parseInt(m[2], 10) };
  } catch (_) {}
  try {
    const out = execFileSync('identify', ['-format', '%wx%h', file], { encoding: 'utf8' }).trim();
    const m = out.match(/(\d+)x(\d+)/);
    if (m) return { W: parseInt(m[1], 10), H: parseInt(m[2], 10) };
  } catch (_) {}
  throw new Error('could not read dims (need ffprobe or ImageMagick identify)');
}

function runExternal(opts, outPath) {
  const { W, H } = readImgDimsExternal(opts.src);
  const { w, h } = targetDims(W, H, opts);
  if (has('ffmpeg')) {
    execFileSync('ffmpeg', ['-y', '-i', opts.src, '-vf', `scale=${w}:${h}`, outPath], { stdio: 'ignore' });
  } else if (has('magick')) {
    execFileSync('magick', [opts.src, '-resize', `${w}x${h}!`, outPath], { stdio: 'ignore' });
  } else if (has('convert')) {
    execFileSync('convert', [opts.src, '-resize', `${w}x${h}!`, outPath], { stdio: 'ignore' });
  } else {
    fail('PNG and JPEG work everywhere with no external tool; this format (' +
         path.extname(opts.src) + ') needs ffmpeg or ImageMagick installed');
  }
  report(outPath, W, H, w, h);
}

// =============================================================================
// main
// =============================================================================
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.src)) fail('source not found: ' + opts.src);
  const outPath = opts.out || defaultOut(opts.src);

  let srcBuf = null;
  try { srcBuf = fs.readFileSync(opts.src); } catch (e) { fail('cannot read source: ' + e.message); }
  const png = isPng(srcBuf);
  const jpg = isJpeg(srcBuf);

  try {
    if (opts.forceNode) {
      // hidden flag: force the pure-JS vendored path (proves the Linux/Windows route)
      if (png) runNodePng(opts, outPath, srcBuf);
      else if (jpg) runNodeJpeg(opts, outPath, srcBuf);
      else fail('--force-node only works on PNG or JPEG input');
    } else if (process.platform === 'darwin') {
      runSips(opts, outPath);
    } else if (png) {
      runNodePng(opts, outPath, srcBuf);
    } else if (jpg) {
      runNodeJpeg(opts, outPath, srcBuf);
    } else {
      runExternal(opts, outPath);
    }
  } catch (e) {
    fail(e.message || String(e));
  }
}

main();
