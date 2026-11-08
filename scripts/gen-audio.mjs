#!/usr/bin/env node
// Generates public/audio/*.mp3 from scripts/audio-prompts.json via ElevenLabs Sound Effects,
// post-processes with ffmpeg, and rebuilds public/audio/manifest.json.
// Usage: node scripts/gen-audio.mjs [--dry-run] [--only id1,id2] [--env-file path] [--manifest-only]
// Key: ELEVENLABS_API_KEY from the environment, or (opt-in) from --env-file. Never printed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/audio');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dry = flag('--dry-run');
const only = opt('--only')?.split(',');
const CREDITS_PER_SEC = 40; // v3: 40 credits per second when duration is set
const MAX_SPEND = 30000;

const prompts = JSON.parse(fs.readFileSync(path.join(root, 'scripts/audio-prompts.json'), 'utf8'));
const fileFor = (c, n) => (c.variants > 1 ? `${c.id}.${n}.mp3` : `${c.id}.mp3`);
const jobs = [];
for (const c of prompts) {
  if (only && !only.includes(c.id)) continue;
  for (let n = 1; n <= c.variants; n++) jobs.push({ c, n, file: fileFor(c, n) });
}
const todo = jobs.filter((j) => !fs.existsSync(path.join(outDir, j.file)));
const est = todo.reduce((a, j) => a + Math.ceil(j.c.duration) * CREDITS_PER_SEC, 0);
console.log(`${jobs.length} files planned, ${todo.length} missing, ~${est} credits estimated`);
if (dry) { for (const j of todo) console.log(`  ${j.file} (${j.c.duration}s${j.c.loop ? ', loop' : ''})`); }

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const f = opt('--env-file');
  if (f && fs.existsSync(f)) {
    const m = fs.readFileSync(f, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  return null;
}

function ff(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...argv], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr.slice(-400));
  return r.stderr;
}
function dur(f) {
  return parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);
}

// loop: crossfade tail into head so the seam is continuous; one-shot: trim leading silence.
// Then two-pass loudnorm (-22 LUFS loops, -16 one-shots) and re-encode.
function post(raw, dest, loop) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-post-'));
  const pre = path.join(tmp, 'pre.wav');
  if (loop) {
    const D = dur(raw), x = Math.min(1.5, D / 4);
    ff(['-i', raw, '-filter_complex',
      `[0]atrim=0:${D - x},asetpts=PTS-STARTPTS[a];[0]atrim=${D - x}:${D},asetpts=PTS-STARTPTS[b];[b][a]acrossfade=d=${x}`, pre]);
  } else {
    ff(['-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.01', pre]);
    if (!(dur(pre) >= 0.2)) ff(['-i', raw, pre]); // trim ate the file: skip it
  }
  const I = loop ? -22 : -16;
  const base = `loudnorm=I=${I}:TP=-1.5:LRA=11`;
  const log = ff(['-i', pre, '-af', base + ':print_format=json', '-f', 'null', '-']);
  const j = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  if (!Number.isFinite(parseFloat(j.input_i))) throw new Error('silent output');
  const af = `${base}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}`;
  ff(['-i', pre, '-af', af, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', loop ? '96k' : '112k', dest]);
  fs.rmSync(tmp, { recursive: true, force: true });
}

async function main() {
  if (!flag('--manifest-only') && todo.length) {
    const key = loadKey();
    if (!key) {
      if (dry) { console.log('(no key; dry run only)'); return; }
      console.error('No ELEVENLABS_API_KEY in env (pass --env-file <path> to read it from a file).'); process.exit(3);
    }
    const sub = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } });
    let cap = MAX_SPEND;
    if (!sub.ok) console.warn('subscription query failed', sub.status, '- falling back to estimate + 30k cap');
    else { const s = await sub.json(); const remaining = s.character_limit - s.character_count;
      console.log(`credits remaining: ${remaining} / ${s.character_limit}`); cap = Math.min(MAX_SPEND, remaining / 2); }
    if (est > cap) { console.error(`Budget cap: estimate ${est} exceeds cap ${cap}. Stopping.`); process.exit(5); }
    if (dry) return;
    fs.mkdirSync(outDir, { recursive: true });
    for (const j of todo) {
      const body = { text: j.c.prompt, duration_seconds: j.c.duration, prompt_influence: j.c.influence, loop: j.c.loop, model_id: 'eleven_text_to_sound_v3' };
      const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
        method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { console.error(`FAIL ${j.file}: ${r.status} ${(await r.text()).slice(0, 200).replace(key, '***')}`); continue; }
      const raw = path.join(os.tmpdir(), `raw-${j.file}`);
      fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
      try { post(raw, path.join(outDir, j.file), j.c.loop); }
      catch (e) { console.error(`FAIL ${j.file}: ${String(e.message).slice(0, 120)}`); fs.rmSync(path.join(outDir, j.file), { force: true }); fs.rmSync(raw, { force: true }); continue; }
      fs.rmSync(raw, { force: true });
      console.log(`ok ${j.file} ${(fs.statSync(path.join(outDir, j.file)).size / 1024).toFixed(0)} KB`);
    }
  }
  if (!dry) writeManifest();
}

// Manifest: every ElevenLabs file on disk + any non-elevenlabs entries already in the manifest (CC0).
function writeManifest() {
  const mp = path.join(outDir, 'manifest.json');
  const old = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : [];
  const keep = old.filter((e) => e.source !== 'elevenlabs');
  const ids = new Set(keep.map((e) => e.id));
  const out = [...keep];
  for (const c of prompts) {
    for (let n = 1; n <= c.variants; n++) {
      const file = fileFor(c, n);
      const id = c.variants > 1 ? `${c.id}.${n}` : c.id;
      if (!fs.existsSync(path.join(outDir, file)) || ids.has(id)) continue;
      out.push({ id, file, loop: c.loop, gain: c.loop ? 0.6 : 0.8, source: 'elevenlabs', licence: 'ElevenLabs generated (commercial use per plan terms)', prompt: c.prompt });
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(mp, JSON.stringify(out, null, 1) + '\n');
  console.log(`manifest: ${out.length} entries`);
  const third = out.filter((e) => e.source !== 'elevenlabs');
  fs.writeFileSync(path.join(outDir, 'CREDITS.md'), '# Audio credits\n\n- Files with `source: elevenlabs` in `manifest.json` are generated offline by `scripts/gen-audio.mjs` from `scripts/audio-prompts.json` (ElevenLabs Sound Effects v3 (`eleven_text_to_sound_v3`), generated for this project).\n' + (third.length ? third.map((e) => `- ${e.file}: ${e.url || e.source}, ${e.licence}`).join('\n') + '\n' : '- Third-party CC0 files: none.\n'));
}
main().catch((e) => { console.error(String(e.message || e).replace(process.env.ELEVENLABS_API_KEY || '\0', '***')); process.exit(1); });
