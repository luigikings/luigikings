// T9: capa de API de YouTube (RF-40, RF-61, RF-62) y resolve-channel-id.mjs.
// Solo `fetch` falsos: ningún test usa la red ni claves reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchLatest,
  resolveChannelId,
  uploadsPlaylistId,
  YouTubeApiError,
  YOUTUBE_API_BASE,
} from '../scripts/lib/youtube-api.mjs';
import { main as resolveMain } from '../scripts/resolve-channel-id.mjs';
import { VIDEOS } from './fixtures/youtube-videos.mjs';

const KEY = 'fake-key-for-tests-only';
const CHANNEL = 'UCabcdefghijklmnopqrstuv'; // 24 caracteres, forma de un ID real
const UPLOADS = 'UUabcdefghijklmnopqrstuv';
const OPTS = { count: 3, shortsMaxSeconds: 180, premiereMaxGapSeconds: 300 };

const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const ytError = (status, reason, extra = {}) =>
  json(status, { error: { code: status, message: `Secret message with key ${KEY}`, errors: [{ reason, domain: 'youtube' }], ...extra } });

/**
 * API de YouTube falsa. `videos` son items de videos.list; `probes` mapea id → status (o 'error').
 * `override(kind, url)` permite devolver otra respuesta para 'playlist', 'videos', 'channels' o 'probe'.
 */
function fakeYouTube({ videos = [], probes = {}, override, playlistItems } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ url: u, init });
    if (u.hostname === 'www.youtube.com' && u.pathname.startsWith('/shorts/')) {
      const r = override?.('probe', u);
      if (r) return r;
      const id = u.pathname.slice('/shorts/'.length);
      const p = probes[id];
      if (p === 'error') throw new Error('network down');
      return { status: p ?? 303, ok: p === 200, json: async () => ({}) };
    }
    if (u.pathname.endsWith('/playlistItems')) {
      const r = override?.('playlist', u);
      if (r) return r;
      const items = playlistItems ?? videos.map((v) => ({ contentDetails: { videoId: v.id } }));
      return json(200, { items });
    }
    if (u.pathname.endsWith('/videos')) {
      const r = override?.('videos', u);
      if (r) return r;
      const ids = (u.searchParams.get('id') ?? '').split(',');
      return json(200, { items: videos.filter((v) => ids.includes(v.id)) });
    }
    if (u.pathname.endsWith('/channels')) {
      const r = override?.('channels', u);
      if (r) return r;
      return json(200, { items: [{ id: CHANNEL }] });
    }
    throw new Error('URL inesperada en el fake: ' + url);
  };
  return { fetch, calls };
}

const run = (fake, extra = {}) => fetchLatest({ fetch: fake.fetch, key: KEY, channelId: CHANNEL, ...OPTS, ...extra });

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof YouTubeApiError, 'debe ser YouTubeApiError: ' + e);
    assert.equal(e.code, code);
    assert.ok(!e.message.includes(KEY), 'el mensaje no debe contener la clave');
    assert.ok(!/Secret message/.test(e.message), 'el mensaje no debe copiar textos de la API');
    return true;
  });
}

// ---------- RF-40: lista de subidas derivada del channelId de la configuración ----------

test('uploadsPlaylistId cambia el prefijo UC por UU', () => {
  assert.equal(uploadsPlaylistId(CHANNEL), UPLOADS);
});

test('uploadsPlaylistId rechaza IDs vacíos o con otra forma', () => {
  for (const bad of ['', '   ', '@lk_rl', 'UCshort', 'XXabcdefghijklmnopqrstuv', 'UCabcdefghijklmnopqrst!v', undefined, null]) {
    assert.throws(() => uploadsPlaylistId(bad), (e) => e instanceof YouTubeApiError && e.code === 'missing-channel');
  }
});

test('usa playlistItems con la lista UU… y nunca resuelve el handle en cada ejecución', async () => {
  const fake = fakeYouTube({ videos: [VIDEOS.normal, VIDEOS.normalOld, VIDEOS.normalOlder] });
  await run(fake);
  const playlist = fake.calls.find((c) => c.url.pathname.endsWith('/playlistItems'));
  assert.ok(playlist, 'llama a playlistItems');
  assert.equal(playlist.url.origin + playlist.url.pathname, `${YOUTUBE_API_BASE}/playlistItems`);
  assert.equal(playlist.url.searchParams.get('playlistId'), UPLOADS);
  assert.equal(playlist.url.searchParams.get('part'), 'contentDetails');
  assert.equal(playlist.url.searchParams.get('maxResults'), '50');
  assert.equal(playlist.url.searchParams.get('key'), KEY);
  assert.equal(fake.calls.filter((c) => c.url.pathname.endsWith('/channels')).length, 0, 'no llama a channels');
  assert.equal(fake.calls.filter((c) => c.url.pathname.includes('/search')).length, 0, 'no usa search (100 unidades)');
});

test('pide videos.list con los IDs de la lista y las partes del contrato de T8', async () => {
  const fake = fakeYouTube({ videos: [VIDEOS.normal, VIDEOS.normalOld, VIDEOS.normalOlder] });
  await run(fake);
  const vids = fake.calls.filter((c) => c.url.pathname.endsWith('/videos'));
  assert.equal(vids.length, 1);
  assert.equal(vids[0].url.searchParams.get('part'), 'snippet,contentDetails,liveStreamingDetails,status');
  assert.equal(vids[0].url.searchParams.get('id'), 'normal00001,normal00002,normal00003');
  assert.equal(vids[0].url.searchParams.get('key'), KEY);
});

test('cuota: exactamente 2 llamadas a la API de datos por ejecución', async () => {
  const fake = fakeYouTube({ videos: Object.values(VIDEOS), probes: { short000001: 200, short000002: 303 } });
  await run(fake);
  assert.equal(fake.calls.filter((c) => c.url.hostname === 'www.googleapis.com').length, 2);
});

test('devuelve los 3 vídeos elegibles más recientes y descarta Shorts, directos, privados y grabaciones', async () => {
  const fake = fakeYouTube({ videos: Object.values(VIDEOS), probes: { short000001: 200, short000002: 303 } });
  const out = await run(fake);
  assert.deepEqual(
    out.map((v) => v.id),
    ['normal00001', 'short000002', 'premiere001'],
  );
  for (const v of out) assert.deepEqual(Object.keys(v).sort(), ['id', 'publishedAt', 'title']);
  assert.equal(out[0].title, 'How to air dribble in Rocket League');
});

test('la sonda de Shorts es HEAD a /shorts/{id} sin seguir redirecciones y solo para vídeos cortos', async () => {
  const fake = fakeYouTube({ videos: Object.values(VIDEOS), probes: { short000001: 200, short000002: 303 } });
  await run(fake);
  const probes = fake.calls.filter((c) => c.url.hostname === 'www.youtube.com');
  assert.ok(probes.length >= 1);
  for (const p of probes) {
    assert.match(p.url.pathname, /^\/shorts\/[A-Za-z0-9_-]{11}$/);
    assert.equal(p.init.method, 'HEAD');
    assert.equal(p.init.redirect, 'manual');
    assert.ok(!p.url.search.includes(KEY), 'la sonda no lleva la clave');
  }
  const probed = probes.map((p) => p.url.pathname.slice(8)).sort();
  for (const id of probed) assert.ok(['short000001', 'short000002'].includes(id), 'sonda solo de candidatos cortos: ' + id);
});

test('sonda con error de red → regla de respaldo (≤ 60 s es Short)', async () => {
  const fake = fakeYouTube({ videos: Object.values(VIDEOS), probes: { short000001: 'error', short000002: 'error' } });
  const out = await run(fake);
  assert.ok(!out.some((v) => v.id === 'short000001'), '45 s con sonda fallida → Short');
  assert.ok(out.some((v) => v.id === 'short000002'), '2 min con sonda fallida → vídeo');
});

test('para de sondear cuando ya tiene los vídeos pedidos', async () => {
  const old = { ...VIDEOS.shortCandidate, id: 'shortold001', snippet: { ...VIDEOS.shortCandidate.snippet, publishedAt: '2020-01-01T00:00:00Z' } };
  const fake = fakeYouTube({ videos: [VIDEOS.normal, VIDEOS.normalOld, VIDEOS.normalOlder, old], probes: { shortold001: 200 } });
  const out = await run(fake);
  assert.equal(out.length, 3);
  assert.equal(fake.calls.filter((c) => c.url.hostname === 'www.youtube.com').length, 0);
});

test('premiereMaxGapSeconds viene de las opciones (umbral configurable)', async () => {
  const fake = fakeYouTube({ videos: [VIDEOS.premiereAired] });
  assert.equal((await run(fake)).length, 1);
  await rejectsWith(run(fakeYouTube({ videos: [VIDEOS.premiereAired] }), { premiereMaxGapSeconds: 60 }), 'no-videos');
});

test('menos de 3 elegibles → devuelve los que haya', async () => {
  const out = await run(fakeYouTube({ videos: [VIDEOS.normal, VIDEOS.private] }));
  assert.deepEqual(out.map((v) => v.id), ['normal00001']);
});

test('ignora IDs con forma inválida en playlistItems (no se inyectan en la URL)', async () => {
  const fake = fakeYouTube({
    videos: [VIDEOS.normal],
    playlistItems: [{ contentDetails: { videoId: 'normal00001' } }, { contentDetails: { videoId: 'bad&id=x' } }, {}],
  });
  await run(fake);
  const vids = fake.calls.find((c) => c.url.pathname.endsWith('/videos'));
  assert.equal(vids.url.searchParams.get('id'), 'normal00001');
});

// ---------- RF-61: vacío, mal formado o sin elegibles → error sin vídeos ----------

test('lista de subidas vacía → no-videos', async () => {
  await rejectsWith(run(fakeYouTube({ videos: [] })), 'no-videos');
});

test('ningún vídeo elegible → no-videos', async () => {
  const fake = fakeYouTube({ videos: [VIDEOS.private, VIDEOS.liveNow, VIDEOS.liveRecording], probes: {} });
  await rejectsWith(run(fake), 'no-videos');
});

test('videos.list devuelve items vacío → no-videos', async () => {
  const fake = fakeYouTube({ videos: [VIDEOS.normal], override: (k) => (k === 'videos' ? json(200, { items: [] }) : null) });
  await rejectsWith(run(fake), 'no-videos');
});

test('respuestas mal formadas → bad-response', async () => {
  const cases = [
    (k) => (k === 'playlist' ? json(200, {}) : null),
    (k) => (k === 'playlist' ? json(200, { items: 'x' }) : null),
    (k) => (k === 'playlist' ? json(200, null) : null),
    (k) => (k === 'playlist' ? { status: 200, ok: true, json: async () => { throw new SyntaxError('bad json'); } } : null),
    (k) => (k === 'playlist' ? json(200, { items: [{}, { contentDetails: {} }] }) : null),
    (k) => (k === 'videos' ? json(200, { kind: 'x' }) : null),
  ];
  for (const override of cases) await rejectsWith(run(fakeYouTube({ videos: [VIDEOS.normal], override })), 'bad-response');
});

test('items mal formados de videos.list se descartan; si no queda ninguno → no-videos', async () => {
  const broken = { id: 'normal00001', snippet: { title: '' } };
  const fake = fakeYouTube({ videos: [VIDEOS.normal], override: (k) => (k === 'videos' ? json(200, { items: [broken, 42, null] }) : null) });
  await rejectsWith(run(fake), 'no-videos');
});

// ---------- RF-62: clave ausente, inválida o sin cuota → error tipado ----------

test('sin clave → missing-key sin tocar la red', async () => {
  for (const key of [undefined, '', '   ']) {
    const fake = fakeYouTube({ videos: [VIDEOS.normal] });
    await rejectsWith(run(fake, { key }), 'missing-key');
    assert.equal(fake.calls.length, 0);
  }
});

test('sin channelId en la configuración → missing-channel sin tocar la red', async () => {
  const fake = fakeYouTube({ videos: [VIDEOS.normal] });
  await rejectsWith(run(fake, { channelId: '' }), 'missing-channel');
  assert.equal(fake.calls.length, 0);
});

test('clave inválida (400 keyInvalid / API_KEY_INVALID) → invalid-key', async () => {
  await rejectsWith(run(fakeYouTube({ override: () => ytError(400, 'keyInvalid') })), 'invalid-key');
  await rejectsWith(
    run(fakeYouTube({ override: () => ytError(400, 'badRequest', { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] }) })),
    'invalid-key',
  );
});

test('clave sin acceso a la API (403 accessNotConfigured / API_KEY_SERVICE_BLOCKED) → invalid-key', async () => {
  await rejectsWith(run(fakeYouTube({ override: () => ytError(403, 'accessNotConfigured') })), 'invalid-key');
  await rejectsWith(run(fakeYouTube({ override: () => ytError(403, 'forbidden', { details: [{ reason: 'API_KEY_SERVICE_BLOCKED' }] }) })), 'invalid-key');
});

test('cuota agotada (403 quotaExceeded / dailyLimitExceeded) → quota-exceeded', async () => {
  await rejectsWith(run(fakeYouTube({ override: () => ytError(403, 'quotaExceeded') })), 'quota-exceeded');
  await rejectsWith(run(fakeYouTube({ override: (k) => (k === 'videos' ? ytError(403, 'dailyLimitExceeded') : null), videos: [VIDEOS.normal] })), 'quota-exceeded');
});

test('otros errores HTTP y de red → código tipado', async () => {
  await rejectsWith(run(fakeYouTube({ override: () => ytError(403, 'forbidden') })), 'forbidden');
  await rejectsWith(run(fakeYouTube({ override: () => ytError(404, 'playlistNotFound') })), 'not-found');
  await rejectsWith(run(fakeYouTube({ override: () => json(429, {}) })), 'rate-limited');
  await rejectsWith(run(fakeYouTube({ override: () => json(500, 'boom') })), 'http');
  const offline = { fetch: async () => { throw new Error(`fetch failed for key=${KEY}`); } };
  await rejectsWith(run(offline), 'network');
});

test('el error expone el motivo seguro y el estado, nunca la URL ni la clave', async () => {
  try {
    await run(fakeYouTube({ override: () => ytError(403, 'quotaExceeded') }));
    assert.fail('debía fallar');
  } catch (e) {
    assert.equal(e.status, 403);
    assert.match(e.message, /quota-exceeded/);
    assert.match(e.message, /quotaExceeded/);
    assert.ok(!e.message.includes('googleapis'));
  }
});

// ---------- resolveChannelId y scripts/resolve-channel-id.mjs ----------

test('resolveChannelId usa channels.list con forHandle y devuelve el UC…', async () => {
  const fake = fakeYouTube();
  const id = await resolveChannelId({ fetch: fake.fetch, key: KEY, handle: '@lk_rl' });
  assert.equal(id, CHANNEL);
  assert.equal(fake.calls.length, 1);
  const u = fake.calls[0].url;
  assert.equal(u.origin + u.pathname, `${YOUTUBE_API_BASE}/channels`);
  assert.equal(u.searchParams.get('part'), 'id');
  assert.equal(u.searchParams.get('forHandle'), '@lk_rl');
  assert.equal(u.searchParams.get('key'), KEY);
});

test('resolveChannelId acepta el handle sin @', async () => {
  const fake = fakeYouTube();
  await resolveChannelId({ fetch: fake.fetch, key: KEY, handle: 'lk_rl' });
  assert.equal(fake.calls[0].url.searchParams.get('forHandle'), '@lk_rl');
});

test('resolveChannelId: handle inexistente → not-found; respuesta rara → bad-response; sin clave → missing-key', async () => {
  await rejectsWith(resolveChannelId({ fetch: fakeYouTube({ override: () => json(200, { pageInfo: {} }) }).fetch, key: KEY, handle: '@nadie' }), 'not-found');
  await rejectsWith(resolveChannelId({ fetch: fakeYouTube({ override: () => json(200, { items: [{ id: 'nope' }] }) }).fetch, key: KEY, handle: '@lk_rl' }), 'bad-response');
  await rejectsWith(resolveChannelId({ fetch: fakeYouTube().fetch, key: '', handle: '@lk_rl' }), 'missing-key');
  await assert.rejects(resolveChannelId({ fetch: fakeYouTube().fetch, key: KEY, handle: '@bad handle!' }), TypeError);
});

function capture() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

test('resolve-channel-id.mjs imprime el UC… del handle pasado y no escribe la configuración', async () => {
  const fake = fakeYouTube();
  const io = capture();
  const writes = [];
  const code = await resolveMain({ argv: ['@lk_rl'], env: { YOUTUBE_API_KEY: KEY }, fetch: fake.fetch, ...io, writeFile: (...a) => writes.push(a) });
  assert.equal(code, 0);
  assert.equal(io.out.join('').split('\n')[0], CHANNEL);
  assert.match(io.err.join(''), /youtube\.com\/channel\/UCabcdefghijklmnopqrstuv/);
  assert.equal(writes.length, 0);
  assert.ok(!io.out.join('').includes(KEY) && !io.err.join('').includes(KEY));
});

test('resolve-channel-id.mjs usa el handle de config/profile.json si no se pasa ninguno', async () => {
  const fake = fakeYouTube();
  const io = capture();
  const code = await resolveMain({ argv: [], env: { YOUTUBE_API_KEY: KEY }, fetch: fake.fetch, ...io });
  assert.equal(code, 0);
  assert.equal(fake.calls[0].url.searchParams.get('forHandle'), '@lk_rl');
});

test('resolve-channel-id.mjs sin clave o con error → código 1 y solo el tipo de error', async () => {
  let io = capture();
  assert.equal(await resolveMain({ argv: ['@lk_rl'], env: {}, fetch: fakeYouTube().fetch, ...io }), 1);
  assert.match(io.err.join(''), /missing-key/);
  assert.match(io.err.join(''), /YOUTUBE_API_KEY/);
  assert.equal(io.out.join(''), '');

  io = capture();
  assert.equal(await resolveMain({ argv: ['@lk_rl'], env: { YOUTUBE_API_KEY: KEY }, fetch: fakeYouTube({ override: () => ytError(400, 'keyInvalid') }).fetch, ...io }), 1);
  assert.match(io.err.join(''), /invalid-key/);
  assert.ok(!io.err.join('').includes(KEY));
});
