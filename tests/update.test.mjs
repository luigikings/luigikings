// T10: orquestador update.mjs (RF-18, RF-39, RF-51 a RF-55, RF-59 a RF-65).
// Red, disco y fecha falsos: ningún test usa la red, tokens reales ni el README real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runUpdate, main, createNodeFs, GENERATED_FILES, README_PATH, CONFIG_PATH } from '../scripts/update.mjs';
import { statsMarkers, STATS_PIECES, YOUTUBE_START, YOUTUBE_END } from '../scripts/lib/readme.mjs';
import { buildAltTexts } from '../scripts/lib/alt.mjs';
import { buildProfileStats } from '../scripts/lib/stats.mjs';
import { createFakeGitHub, fixedResponse, SECRET_REPO_NAMES } from './fixtures/github-fake.mjs';
import { VIDEOS } from './fixtures/youtube-videos.mjs';
import { assertSvgRules } from './helpers/svg-rules.mjs';

const TOKEN = 'fake-token-for-tests-only-ghp';
const KEY = 'fake-youtube-key-for-tests-only';
const NOW = new Date('2026-10-22T09:00:00Z');
const ENV = { PROFILE_READ_TOKEN: TOKEN, YOUTUBE_API_KEY: KEY };
const realCfg = JSON.parse(readFileSync(new URL('../config/profile.json', import.meta.url), 'utf8'));
const CFG = { ...realCfg, youtube: { ...realCfg.youtube, channelId: 'UCabcdefghijklmnopqrstuv' } };

const SVG_PATHS = Object.values(GENERATED_FILES);
const STATS_SVGS = STATS_PIECES.map((p) => GENERATED_FILES[p]);
const CONTRIB_SVGS = [GENERATED_FILES.snakeDark, GENERATED_FILES.snakeLight, GENERATED_FILES.contrib3d];
const OLD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><title>old</title></svg>';
const OLD_YT = '<p>old videos</p>';

const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const unescapeHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const titleOf = (svg) => unescapeXml(/<title>([^<]*)<\/title>/.exec(svg)[1]);

function readme({ blocks = STATS_PIECES } = {}) {
  const block = (p) => (blocks.includes(p) ? `${statsMarkers(p).start}<img src="assets/generated/${p}.svg" alt="old ${p}">${statsMarkers(p).end}` : '');
  return [
    '<h1>Profile</h1>',
    `<p>${block('scoreboard')}About me.</p>`,
    `<p align="center">${block('stats')} ${block('languages')} ${block('streak')}</p>`,
    '<h2>Latest YouTube videos</h2>',
    YOUTUBE_START,
    OLD_YT,
    YOUTUBE_END,
    '',
  ].join('\n');
}

/** Disco en memoria con el README y los SVG "anteriores". */
function memFs({ readmeText = readme(), cfg = CFG, withOld = true } = {}) {
  const files = new Map([[CONFIG_PATH, JSON.stringify(cfg)], [README_PATH, readmeText]]);
  if (withOld) for (const p of SVG_PATHS) files.set(p, OLD_SVG);
  const writes = [];
  return {
    files,
    writes,
    read: (p) => (files.has(p) ? files.get(p) : null),
    write: (p, c) => {
      writes.push(p);
      files.set(p, c);
    },
  };
}

/** YouTube falso: 3 vídeos normales (no hace falta sonda de Shorts). */
function fakeYouTube({ fail } = {}) {
  const videos = [VIDEOS.normal, VIDEOS.normalOld, VIDEOS.normalOlder];
  const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  return async (url) => {
    const u = new URL(url);
    if (fail) return json(fail, { error: { code: fail, message: `bad key ${KEY}`, errors: [{ reason: 'keyInvalid' }] } });
    if (u.pathname.endsWith('/playlistItems')) return json(200, { items: videos.map((v) => ({ contentDetails: { videoId: v.id } })) });
    if (u.pathname.endsWith('/videos')) return json(200, { items: videos });
    return { status: 303, ok: false, json: async () => ({}) };
  };
}

/** Red falsa: api.github.com → GitHub falso; el resto → YouTube falso. Registra las llamadas. */
function fakeNet({ github = createFakeGitHub(), youtube = fakeYouTube() } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(String(url));
    return new URL(url).hostname === 'api.github.com' ? github.fetch(url, init) : youtube(url, init);
  };
  return { fetch, calls };
}

const altsIn = (text) =>
  Object.fromEntries(
    STATS_PIECES.map((p) => {
      const m = statsMarkers(p);
      const hit = new RegExp(`${m.start}<img [^>]*alt="([^"]*)">${m.end}`).exec(text);
      return [p, hit ? unescapeHtml(hit[1]) : null];
    }),
  );
const youtubeBlock = (text) => text.slice(text.indexOf(YOUTUBE_START), text.indexOf(YOUTUBE_END));

// ---------- Todo bien ----------

test('todo bien: escribe las 7 piezas y el README; los 4 alt tienen las cifras del <title> de cada pieza', async () => {
  const fs = memFs();
  const net = fakeNet();
  const res = await runUpdate({ env: ENV, fetch: net.fetch, now: NOW, fs });
  assert.deepEqual(res.failed, []);
  assert.deepEqual([...res.written].sort(), [...SVG_PATHS, README_PATH].sort());
  for (const p of SVG_PATHS) {
    const svg = fs.files.get(p);
    assertSvgRules(svg, p, { maxBytes: /snake|contrib-3d/.test(p) ? Infinity : undefined });
  }
  const alts = altsIn(fs.files.get(README_PATH));
  for (const p of STATS_PIECES) assert.equal(alts[p], titleOf(fs.files.get(GENERATED_FILES[p])), `alt de ${p}`);
  assert.match(alts.scoreboard, /Goals: 130 repositories/);
  const yt = youtubeBlock(fs.files.get(README_PATH));
  assert.ok(yt.includes('watch?v=normal00001') && !yt.includes(OLD_YT));
  assert.ok(yt.includes('https://youtube.com/@lk_rl'), 'enlace al canal');
});

test('nombres de archivo de las piezas en assets/generated/', () => {
  assert.deepEqual(GENERATED_FILES, {
    scoreboard: 'assets/generated/scoreboard.svg',
    stats: 'assets/generated/stats.svg',
    languages: 'assets/generated/languages.svg',
    streak: 'assets/generated/streak.svg',
    snakeDark: 'assets/generated/snake-dark.svg',
    snakeLight: 'assets/generated/snake-light.svg',
    contrib3d: 'assets/generated/contrib-3d.svg',
  });
});

// ---------- Fallos por grupo ----------

test('falla GitHub (401): ninguna pieza de GitHub (stats ni snake/3D) ni bloque ALT:* cambia; YouTube sí; failed', async () => {
  const fs = memFs();
  const before = fs.files.get(README_PATH);
  const net = fakeNet({ github: fixedResponse(401, { message: `Bad credentials for ${SECRET_REPO_NAMES[0]}` }) });
  const res = await runUpdate({ env: ENV, fetch: net.fetch, now: NOW, fs });
  assert.deepEqual(res.failed, [{ group: 'github', code: 'unauthorized' }, { group: 'contrib', code: 'unauthorized' }]);
  for (const p of SVG_PATHS) assert.equal(fs.files.get(p), OLD_SVG, `${p} intacta`);
  assert.deepEqual(res.written, [README_PATH]);
  const after = fs.files.get(README_PATH);
  assert.deepEqual(altsIn(after), altsIn(before));
  assert.ok(youtubeBlock(after).includes('watch?v=normal00001'));
});

test('falta la credencial de GitHub: falla sin usar la red de GitHub y sin degradar cifras (RF-63)', async () => {
  const fs = memFs();
  const net = fakeNet();
  const res = await runUpdate({ env: { YOUTUBE_API_KEY: KEY }, fetch: net.fetch, now: NOW, fs });
  assert.deepEqual(res.failed, [{ group: 'github', code: 'missing-token' }, { group: 'contrib', code: 'missing-token' }]);
  assert.ok(!net.calls.some((u) => u.includes('api.github.com')));
  for (const p of SVG_PATHS) assert.equal(fs.files.get(p), OLD_SVG);
});

test('falla YouTube: el bloque de YouTube no cambia; los stats y sus alt sí (RF-52, RF-62)', async () => {
  for (const [env, net, code] of [
    [{ PROFILE_READ_TOKEN: TOKEN }, fakeNet(), 'missing-key'],
    [ENV, fakeNet({ youtube: fakeYouTube({ fail: 400 }) }), 'invalid-key'],
  ]) {
    const fs = memFs();
    const res = await runUpdate({ env, fetch: net.fetch, now: NOW, fs });
    assert.deepEqual(res.failed, [{ group: 'youtube', code }]);
    const after = fs.files.get(README_PATH);
    assert.equal(youtubeBlock(after), youtubeBlock(readme()));
    for (const p of SVG_PATHS) assert.notEqual(fs.files.get(p), OLD_SVG);
    for (const p of STATS_PIECES) assert.equal(altsIn(after)[p], titleOf(fs.files.get(GENERATED_FILES[p])));
  }
});

test('canal sin configurar → youtube: missing-channel (estado actual de config/profile.json)', async () => {
  const fs = memFs({ cfg: realCfg });
  const res = await runUpdate({ env: ENV, fetch: fakeNet().fetch, now: NOW, fs });
  assert.deepEqual(res.failed, [{ group: 'youtube', code: 'missing-channel' }]);
});

test('README con bloques ALT:* rotos en modo normal → el grupo marcador+tarjetas falla (readme-markers) sin escribir sus piezas; snake y 3D sí se escriben (RF-52)', async () => {
  for (const blocks of [['scoreboard', 'stats', 'languages'], []]) {
    const text = readme({ blocks });
    const fs = memFs({ readmeText: text });
    const res = await runUpdate({ env: ENV, fetch: fakeNet().fetch, now: NOW, fs });
    assert.deepEqual(res.failed, [{ group: 'github', code: 'readme-markers' }]);
    for (const p of STATS_SVGS) assert.equal(fs.files.get(p), OLD_SVG, `${p} intacta`);
    for (const p of CONTRIB_SVGS) {
      assert.notEqual(fs.files.get(p), OLD_SVG, `${p} escrita`);
      assertSvgRules(fs.files.get(p), p, { maxBytes: Infinity });
    }
    assert.deepEqual(altsIn(fs.files.get(README_PATH)), altsIn(text));
    assert.ok(youtubeBlock(fs.files.get(README_PATH)).includes('watch?v=normal00001'));
  }
});

test('main: ALT:* rotos → snake y 3D escritos, código 1 y failed=true (RF-52, RF-53)', async () => {
  const fs = memFs({ readmeText: readme({ blocks: [] }) });
  const outputs = [];
  const quiet = { write: () => {} };
  const code = await main({ argv: [], env: { ...ENV, GITHUB_OUTPUT: 'o' }, fetch: fakeNet().fetch, now: NOW, fs, stdout: quiet, stderr: quiet, appendFile: (p, t) => outputs.push(t) });
  assert.equal(code, 1);
  assert.deepEqual(outputs, ['failed=true\n']);
  for (const p of CONTRIB_SVGS) assert.ok(fs.writes.includes(p), `${p} escrita`);
  for (const p of STATS_SVGS) assert.ok(!fs.writes.includes(p), `${p} no escrita`);
});

const boom = () => {
  throw new Error('render roto');
};

test('falla el render de snake o de 3D → marcador, tarjetas y ALT:* sí se escriben; snake y 3D intactos; código 1 (RF-52, RF-53)', async () => {
  for (const renderers of [{ renderSnake: boom }, { renderContrib3d: boom }]) {
    const fs = memFs();
    const outputs = [];
    let err = '';
    const quiet = { write: () => {} };
    const code = await main({
      argv: [],
      env: { ...ENV, GITHUB_OUTPUT: 'o' },
      fetch: fakeNet().fetch,
      now: NOW,
      fs,
      stdout: quiet,
      stderr: { write: (s) => (err += s) },
      appendFile: (p, t) => outputs.push(t),
      renderers,
    });
    assert.equal(code, 1);
    assert.deepEqual(outputs, ['failed=true\n']);
    assert.match(err, /contrib: internal/);
    assert.doesNotMatch(err, /render roto/);
    for (const p of CONTRIB_SVGS) assert.equal(fs.files.get(p), OLD_SVG, `${p} intacta`);
    for (const p of STATS_SVGS) assert.notEqual(fs.files.get(p), OLD_SVG, `${p} escrita`);
    const alts = altsIn(fs.files.get(README_PATH));
    for (const p of STATS_PIECES) assert.equal(alts[p], titleOf(fs.files.get(GENERATED_FILES[p])), `alt de ${p}`);
  }
});

test('runUpdate: render de snake roto → failed solo contrib', async () => {
  const fs = memFs();
  const res = await runUpdate({ env: ENV, fetch: fakeNet().fetch, now: NOW, fs, renderers: { renderSnake: boom } });
  assert.deepEqual(res.failed, [{ group: 'contrib', code: 'internal' }]);
});

test('fallan los dos grupos: no se escribe nada y se informa de ambos', async () => {
  const fs = memFs();
  const res = await runUpdate({ env: {}, fetch: fakeNet().fetch, now: NOW, fs });
  assert.deepEqual(res.failed, [
    { group: 'github', code: 'missing-token' },
    { group: 'contrib', code: 'missing-token' },
    { group: 'youtube', code: 'missing-key' },
  ]);
  assert.deepEqual(fs.writes, []);
});

// ---------- Sin cambios ----------

test('sin cambios en los datos → no se escribe nada, tampoco el README (RF-54)', async () => {
  const fs = memFs();
  await runUpdate({ env: ENV, fetch: fakeNet().fetch, now: NOW, fs });
  fs.writes.length = 0;
  const res = await runUpdate({ env: ENV, fetch: fakeNet().fetch, now: NOW, fs });
  assert.deepEqual(res.failed, []);
  assert.deepEqual(res.written, []);
  assert.deepEqual(fs.writes, []);
});

test('ninguna pieza ni el README incluyen fechas de "última actualización" (RF-55)', async () => {
  const fs = memFs();
  await runUpdate({ env: ENV, fetch: fakeNet().fetch, now: NOW, fs });
  for (const [p, c] of fs.files) {
    if (p === CONFIG_PATH) continue;
    assert.doesNotMatch(c, /updated|last update|2026-10-22|22 Oct|Oct 22/i, `${p} con fecha`);
  }
});

// ---------- Salida sin secretos ----------

test('main: la salida no contiene secretos ni nombres de repos, y escribe failed en GITHUB_OUTPUT', async () => {
  for (const net of [fakeNet(), fakeNet({ github: fixedResponse(401, { message: `token ${TOKEN} repo ${SECRET_REPO_NAMES.join(' ')}` }), youtube: fakeYouTube({ fail: 403 }) })]) {
    let out = '';
    const outputs = [];
    const code = await main({
      argv: [],
      env: { ...ENV, GITHUB_OUTPUT: '/fake/output' },
      fetch: net.fetch,
      now: NOW,
      fs: memFs(),
      stdout: { write: (s) => (out += s) },
      stderr: { write: (s) => (out += s) },
      appendFile: (path, text) => outputs.push([path, text]),
    });
    for (const secret of [TOKEN, KEY, ...SECRET_REPO_NAMES, 'public-repo-']) assert.ok(!out.includes(secret), `salida con ${secret}: ${out}`);
    const failed = code !== 0;
    assert.deepEqual(outputs, [['/fake/output', `failed=${failed}\n`]]);
    if (failed) {
      assert.equal(code, 1);
      assert.match(out, /github: unauthorized/);
    }
  }
});

test('main: sin GITHUB_OUTPUT no intenta escribirlo; opción desconocida → código 2 sin tocar nada', async () => {
  const outputs = [];
  const fs = memFs();
  const quiet = { write: () => {} };
  const ok = await main({ argv: [], env: ENV, fetch: fakeNet().fetch, now: NOW, fs, stdout: quiet, stderr: quiet, appendFile: (...a) => outputs.push(a) });
  assert.equal(ok, 0);
  assert.deepEqual(outputs, []);
  const fs2 = memFs();
  const bad = await main({ argv: ['--sed'], env: ENV, fetch: fakeNet().fetch, now: NOW, fs: fs2, stdout: quiet, stderr: quiet, appendFile: () => {} });
  assert.equal(bad, 2);
  assert.deepEqual(fs2.writes, []);
});

test('main: configuración ilegible → código 2 y failed=true', async () => {
  const fs = memFs();
  fs.files.set(CONFIG_PATH, '{ no json');
  const outputs = [];
  const quiet = { write: () => {} };
  const code = await main({ argv: [], env: { ...ENV, GITHUB_OUTPUT: 'o' }, fetch: fakeNet().fetch, now: NOW, fs, stdout: quiet, stderr: quiet, appendFile: (p, t) => outputs.push(t) });
  assert.equal(code, 2);
  assert.deepEqual(outputs, ['failed=true\n']);
  assert.deepEqual(fs.writes, []);
});

// ---------- --seed ----------

const noNetwork = async () => {
  throw new Error('--seed no debe usar la red');
};

test('--seed: sin red, crea las 7 piezas iniciales válidas y rellena los 4 ALT:* con "0" y "—"; YouTube intacto', async () => {
  const fs = memFs({ withOld: false });
  const res = await runUpdate({ seed: true, env: {}, fetch: noNetwork, now: NOW, fs });
  assert.deepEqual(res.failed, []);
  for (const p of SVG_PATHS) assertSvgRules(fs.files.get(p), p);
  const expected = buildAltTexts(buildProfileStats({}, NOW, CFG));
  const after = fs.files.get(README_PATH);
  assert.deepEqual(altsIn(after), expected);
  assert.match(expected.scoreboard, /Goals: 0 repositories.*MVP: — \(top language\)/);
  assert.equal(youtubeBlock(after), youtubeBlock(readme()));
  // Idempotente.
  fs.writes.length = 0;
  await runUpdate({ seed: true, env: {}, fetch: noNetwork, now: NOW, fs });
  assert.deepEqual(fs.writes, []);
});

test('--seed con un README sin ningún bloque ALT:* (README antiguo) → crea las piezas y no toca el README', async () => {
  const old = '# Old README\n';
  const fs = memFs({ readmeText: old, withOld: false });
  const res = await runUpdate({ seed: true, env: {}, fetch: noNetwork, now: NOW, fs });
  assert.deepEqual(res.failed, []);
  assert.equal(fs.files.get(README_PATH), old);
  assert.deepEqual([...res.written].sort(), [...SVG_PATHS].sort());
  assert.ok(res.notes.some((n) => /ALT/.test(n)));
});

test('--seed con bloques ALT:* incompletos → falla el grupo marcador+tarjetas sin escribirlo; snake y 3D sí (RF-52)', async () => {
  const fs = memFs({ readmeText: readme({ blocks: ['scoreboard'] }), withOld: false });
  const res = await runUpdate({ seed: true, env: {}, fetch: noNetwork, now: NOW, fs });
  assert.deepEqual(res.failed, [{ group: 'github', code: 'readme-markers' }]);
  assert.deepEqual([...fs.writes].sort(), [...CONTRIB_SVGS].sort());
});

test('main --seed: código 0 y no lee secretos', async () => {
  const quiet = { write: () => {} };
  const code = await main({ argv: ['--seed'], env: {}, fetch: noNetwork, now: NOW, fs: memFs(), stdout: quiet, stderr: quiet, appendFile: () => {} });
  assert.equal(code, 0);
});

// ---------- Escritura atómica en disco ----------

test('createNodeFs: escritura atómica (temporal + renombrado), crea carpetas y no deja temporales', () => {
  const dir = mkdtempSync(join(tmpdir(), 'update-test-'));
  try {
    const fs = createNodeFs(dir);
    assert.equal(fs.read('assets/generated/x.svg'), null);
    fs.write('assets/generated/x.svg', 'uno');
    assert.equal(readFileSync(join(dir, 'assets/generated/x.svg'), 'utf8'), 'uno');
    writeFileSync(join(dir, 'README.md'), 'antes');
    fs.write('README.md', 'después ✓');
    assert.equal(fs.read('README.md'), 'después ✓');
    assert.deepEqual(readdirSync(join(dir, 'assets/generated')), ['x.svg']);
    assert.deepEqual(readdirSync(dir).sort(), ['README.md', 'assets']);
    assert.throws(() => fs.write('../fuera.txt', 'x'), /fuera/);
    assert.ok(!existsSync(join(dir, '..', 'fuera.txt')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
