// T8: selección de vídeos y sección de YouTube (lógica pura). RF-41 a RF-46.
// Sin red ni fecha real: la sonda de Shorts llega como dato ya resuelto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIsoDuration,
  needsShortProbe,
  isShortFromProbe,
  classifyVideo,
  selectLatest,
  truncateTitle,
} from '../scripts/lib/youtube.mjs';
import {
  escapeHtml,
  replaceBetweenMarkers,
  renderYoutubeSection,
  YOUTUBE_START,
  YOUTUBE_END,
} from '../scripts/lib/readme.mjs';
import { VIDEOS } from './fixtures/youtube-videos.mjs';

const CFG = { shortsMaxSeconds: 180 };
const CHANNEL = 'https://youtube.com/@lk_rl';
const classify = (v, isShort) => classifyVideo(v, { ...CFG, isShort });

// ---------- parseIsoDuration ----------

test('parseIsoDuration convierte duraciones ISO 8601 de YouTube a segundos', () => {
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration('PT2M'), 120);
  assert.equal(parseIsoDuration('PT8M30S'), 510);
  assert.equal(parseIsoDuration('PT2H0M5S'), 7205);
  assert.equal(parseIsoDuration('P1DT1S'), 86401);
  assert.equal(parseIsoDuration('P0D'), 0);
});

test('parseIsoDuration devuelve NaN con valores mal formados', () => {
  for (const bad of [undefined, null, '', 'PT', '8M30S', 'PTXS', 42]) assert.ok(Number.isNaN(parseIsoDuration(bad)), String(bad));
});

// ---------- Sonda de Shorts ----------

test('needsShortProbe solo pide sonda si la duración es ≤ shortsMaxSeconds', () => {
  assert.equal(needsShortProbe(VIDEOS.shortCandidate, CFG), true);
  assert.equal(needsShortProbe(VIDEOS.shortLongCandidate, CFG), true);
  assert.equal(needsShortProbe(VIDEOS.normal, CFG), false);
  assert.equal(needsShortProbe(VIDEOS.liveNow, CFG), false, 'un directo se descarta antes, sin sonda');
  assert.equal(needsShortProbe(VIDEOS.private, CFG), false, 'un privado se descarta antes, sin sonda');
});

test('isShortFromProbe: 200 → Short; 3xx → no Short; error de red → regla de duración ≤ 60 s', () => {
  assert.equal(isShortFromProbe({ status: 200 }, 45), true);
  assert.equal(isShortFromProbe({ status: 200 }, 170), true);
  assert.equal(isShortFromProbe({ status: 303 }, 45), false);
  assert.equal(isShortFromProbe({ status: 302 }, 45), false);
  assert.equal(isShortFromProbe({ error: true }, 45), true);
  assert.equal(isShortFromProbe({ error: true }, 60), true);
  assert.equal(isShortFromProbe({ error: true }, 61), false);
  // Respuesta inesperada (p. ej. 404 o 500): se trata como fallo de la sonda.
  assert.equal(isShortFromProbe({ status: 500 }, 45), true);
  assert.equal(isShortFromProbe({ status: 404 }, 120), false);
});

// ---------- classifyVideo (RF-42) ----------

test('vídeo normal → elegible', () => {
  const c = classify(VIDEOS.normal);
  assert.equal(c.kind, 'video');
  assert.equal(c.eligible, true);
  assert.deepEqual(
    { id: c.id, title: c.title, publishedAt: c.publishedAt },
    { id: 'normal00001', title: 'How to air dribble in Rocket League', publishedAt: '2026-10-20T15:00:00Z' },
  );
});

test('Short con sonda 200 → excluido', () => {
  const c = classify(VIDEOS.shortCandidate, isShortFromProbe({ status: 200 }, 45));
  assert.equal(c.kind, 'short');
  assert.equal(c.eligible, false);
});

test('vídeo corto con sonda 303 → elegible', () => {
  const c = classify(VIDEOS.shortLongCandidate, isShortFromProbe({ status: 303 }, 120));
  assert.equal(c.kind, 'video');
  assert.equal(c.eligible, true);
});

test('sonda con error de red: ≤ 60 s → Short; 2 min → vídeo', () => {
  assert.equal(classify(VIDEOS.shortCandidate, isShortFromProbe({ error: true }, 45)).eligible, false);
  assert.equal(classify(VIDEOS.shortLongCandidate, isShortFromProbe({ error: true }, 120)).eligible, true);
});

test('vídeo corto sin resultado de sonda → regla de duración ≤ 60 s', () => {
  assert.equal(classify(VIDEOS.shortCandidate).kind, 'short');
  assert.equal(classify(VIDEOS.shortLongCandidate).kind, 'video');
});

test('directo en curso y directo programado → excluidos', () => {
  assert.deepEqual([classify(VIDEOS.liveNow).kind, classify(VIDEOS.liveNow).eligible], ['live', false]);
  assert.deepEqual([classify(VIDEOS.scheduledLive).kind, classify(VIDEOS.scheduledLive).eligible], ['upcoming', false]);
});

test('grabación de directo → excluida', () => {
  const c = classify(VIDEOS.liveRecording);
  assert.equal(c.kind, 'live-recording');
  assert.equal(c.eligible, false);
});

test('estreno ya emitido → elegible; estreno programado → excluido', () => {
  const aired = classify(VIDEOS.premiereAired);
  assert.equal(aired.kind, 'premiere');
  assert.equal(aired.eligible, true);
  const scheduled = classify(VIDEOS.premiereScheduled);
  assert.equal(scheduled.kind, 'upcoming');
  assert.equal(scheduled.eligible, false);
});

test('estreno con cuenta atrás más larga que el umbral → se trata como grabación (tolerancia aceptada)', () => {
  const long = {
    ...VIDEOS.premiereAired,
    liveStreamingDetails: { actualStartTime: '2026-10-17T18:00:00Z', actualEndTime: '2026-10-17T18:20:00Z' },
  };
  assert.equal(classify(long).kind, 'live-recording');
  assert.equal(classifyVideo(long, { ...CFG, premiereMaxGapSeconds: 900 }).kind, 'premiere');
});

test('grabación de directo cuyo vídeo dura unos segundos menos que la emisión → hoy se clasifica como estreno (tolerancia conocida, RF-42)', () => {
  // Emisión de 2 h 0 min 5 s; YouTube guarda un vídeo de 2 h 0 min (5 s menos, p. ej. recorte del final).
  // La heurística solo mira la diferencia emisión − vídeo (≤ premiereMaxGapSeconds) y no puede distinguirlo
  // de la cuenta atrás de un estreno: se cuela como 'premiere' y es elegible. Tolerancia aceptada por el
  // usuario (señales indirectas de RF-42); si cambia la heurística, este test debe cambiar con ella.
  const trimmed = { ...VIDEOS.liveRecording, contentDetails: { duration: 'PT2H0M0S' } };
  const c = classifyVideo(trimmed, { ...CFG, premiereMaxGapSeconds: 300 });
  assert.equal(c.kind, 'premiere');
  assert.equal(c.eligible, true);
  // Con la duración idéntica a la emisión (fixture habitual) sí se excluye.
  assert.equal(classifyVideo(VIDEOS.liveRecording, { ...CFG, premiereMaxGapSeconds: 300 }).kind, 'live-recording');
});

test('grabación sin hora de fin → excluida', () => {
  const v = { ...VIDEOS.liveRecording, liveStreamingDetails: { actualStartTime: '2026-10-18T18:00:00Z' } };
  assert.equal(classify(v).eligible, false);
});

test('privado y oculto → excluidos', () => {
  assert.deepEqual([classify(VIDEOS.private).kind, classify(VIDEOS.private).eligible], ['private', false]);
  assert.equal(classify(VIDEOS.unlisted).eligible, false);
});

test('datos mal formados (sin id válido, sin título, sin fecha o duración) → inválido, no elegible', () => {
  const cases = [
    { ...VIDEOS.normal, id: 'abc"><script' },
    { ...VIDEOS.normal, snippet: { ...VIDEOS.normal.snippet, title: '' } },
    { ...VIDEOS.normal, snippet: { ...VIDEOS.normal.snippet, publishedAt: 'ayer' } },
    { ...VIDEOS.normal, contentDetails: { duration: 'raro' } },
    { id: 'normal00001' },
    null,
  ];
  for (const v of cases) {
    const c = classify(v);
    assert.equal(c.kind, 'invalid');
    assert.equal(c.eligible, false);
  }
});

// ---------- selectLatest (RF-41) ----------

const all = () => [
  classify(VIDEOS.normalOld),
  classify(VIDEOS.liveNow),
  classify(VIDEOS.shortCandidate, true),
  classify(VIDEOS.normal),
  classify(VIDEOS.private),
  classify(VIDEOS.premiereAired),
  classify(VIDEOS.liveRecording),
  classify(VIDEOS.premiereScheduled),
  classify(VIDEOS.shortLongCandidate, false),
  classify(VIDEOS.scheduledLive),
  classify(VIDEOS.normalOlder),
];

test('selectLatest devuelve los 3 elegibles más recientes, del más nuevo al más antiguo', () => {
  const sel = selectLatest(all(), 3);
  assert.deepEqual(sel.map((v) => v.id), ['normal00001', 'short000002', 'premiere001']);
  assert.deepEqual(Object.keys(sel[0]).sort(), ['id', 'publishedAt', 'title']);
});

test('selectLatest recorre vídeos antiguos si los recientes son Shorts o directos', () => {
  const sel = selectLatest(
    [
      classify(VIDEOS.liveNow),
      classify(VIDEOS.shortCandidate, true),
      classify(VIDEOS.liveRecording),
      classify(VIDEOS.normalOldest),
      classify(VIDEOS.normalOld),
      classify(VIDEOS.normalOlder),
    ],
    3,
  );
  assert.deepEqual(sel.map((v) => v.id), ['normal00002', 'normal00003', 'normal00004']);
});

test('selectLatest con menos de 3 elegibles devuelve los que haya', () => {
  const sel = selectLatest([classify(VIDEOS.liveNow), classify(VIDEOS.normalOld), classify(VIDEOS.private)], 3);
  assert.deepEqual(sel.map((v) => v.id), ['normal00002']);
});

test('selectLatest con cero elegibles o lista vacía devuelve []', () => {
  assert.deepEqual(selectLatest([classify(VIDEOS.liveNow), classify(VIDEOS.private)], 3), []);
  assert.deepEqual(selectLatest([], 3), []);
});

test('selectLatest no muta la entrada y desempata por id si la fecha coincide', () => {
  const a = { id: 'bbbbbbbbbbb', title: 'B', publishedAt: '2026-10-01T00:00:00Z', kind: 'video', eligible: true };
  const b = { id: 'aaaaaaaaaaa', title: 'A', publishedAt: '2026-10-01T00:00:00Z', kind: 'video', eligible: true };
  const input = [a, b];
  assert.deepEqual(selectLatest(input, 3).map((v) => v.id), ['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  assert.deepEqual(input, [a, b]);
});

// ---------- truncateTitle y escape ----------

test('truncateTitle deja intactos los títulos de ≤ 60 caracteres', () => {
  const t60 = 'x'.repeat(60);
  assert.equal(truncateTitle(t60, 60), t60);
  assert.equal(truncateTitle('Short title', 60), 'Short title');
});

test('truncateTitle corta a 60 caracteres en total, terminando en "…"', () => {
  const out = truncateTitle('a'.repeat(61), 60);
  assert.equal(out, 'a'.repeat(59) + '…');
  assert.equal([...out].length, 60);
});

test('truncateTitle no parte emojis y quita el espacio final antes de "…"', () => {
  const title = 'Rocket League 🚗⚽ '.repeat(5); // > 60
  const out = truncateTitle(title, 60);
  assert.ok(out.endsWith('…'));
  assert.ok(!/\s…$/.test(out));
  assert.ok(new Intl.Segmenter().segment(out)[Symbol.iterator]().next().value);
  assert.ok(!out.includes('�'));
  // Sin sustitutos sueltos: cada carácter es un código válido.
  assert.equal(out, out.toWellFormed());
  assert.ok([...new Intl.Segmenter().segment(out)].length <= 60);
});

test('escapeHtml escapa & < > " y \'', () => {
  assert.equal(escapeHtml(`Tom & "Jerry" <3 it's`), 'Tom &amp; &quot;Jerry&quot; &lt;3 it&#39;s');
});

// ---------- renderYoutubeSection (RF-41, RF-43, RF-44, RF-46) ----------

const sample = () => selectLatest(all(), 3);

test('renderYoutubeSection: miniatura i.ytimg.com con alt = título, enlace watch?v=ID y título enlazado', () => {
  const html = renderYoutubeSection(sample(), CHANNEL);
  for (const v of sample()) {
    assert.ok(
      html.includes(
        `<a href="https://www.youtube.com/watch?v=${v.id}"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" width="280" alt="${escapeHtml(v.title)}"></a>`,
      ),
      v.id,
    );
    assert.ok(html.includes(`<a href="https://www.youtube.com/watch?v=${v.id}">${escapeHtml(v.title)}</a>`), `título ${v.id}`);
  }
  assert.equal((html.match(/<img /g) || []).length, 3);
});

test('renderYoutubeSection mantiene el orden del más nuevo al más antiguo', () => {
  const html = renderYoutubeSection(sample(), CHANNEL);
  const ids = [...html.matchAll(/i\.ytimg\.com\/vi\/([\w-]{11})\//g)].map((m) => m[1]);
  assert.deepEqual(ids, ['normal00001', 'short000002', 'premiere001']);
});

test('renderYoutubeSection incluye el enlace al canal', () => {
  const html = renderYoutubeSection(sample(), CHANNEL);
  assert.match(html, /<a href="https:\/\/youtube\.com\/@lk_rl">[^<]+<\/a>/);
});

test('renderYoutubeSection trunca a 60 y escapa títulos con & < > "', () => {
  const title = 'Tips & tricks <PRO> "Champion" rank — how I went from Gold to GC in one season';
  const html = renderYoutubeSection([{ id: 'normal00001', title, publishedAt: '2026-10-20T15:00:00Z' }], CHANNEL);
  const shown = truncateTitle(title, 60);
  assert.ok(shown.endsWith('…'));
  assert.ok(html.includes(`alt="${escapeHtml(shown)}"`));
  assert.ok(html.includes(`>${escapeHtml(shown)}</a>`));
  assert.ok(!html.includes('<PRO>'));
  assert.ok(!html.includes('"Champion"'));
  assert.ok(!html.includes(' & '));
});

test('título en español con tildes y "ñ" se conserva tal cual, sin traducir ni corromper (texto y alt; RNF-13, RF-43)', () => {
  const title = 'Cómo hacer un Flip Reset en España: guía para pequeños y mayores';
  const raw = { ...VIDEOS.normal, snippet: { ...VIDEOS.normal.snippet, title } };
  const c = classify(raw);
  assert.equal(c.eligible, true);
  assert.equal(c.title, title, 'la clasificación no toca el título');
  const html = renderYoutubeSection(selectLatest([c], 3), CHANNEL);
  const shown = truncateTitle(title, 60);
  assert.ok(shown.startsWith('Cómo hacer un Flip Reset en España: guía para pequeños'));
  assert.equal(shown, shown.normalize('NFC'));
  assert.ok(html.includes(`alt="${shown}"`), 'alt con el título en español sin escapar tildes ni ñ');
  assert.ok(html.includes(`>${shown}</a>`), 'texto visible con el título en español');
  for (const ch of ['ó', 'ñ', 'í']) assert.ok(html.includes(ch), `conserva ${ch}`);
  assert.ok(!/&#\d+;|&[a-z]+;/i.test(html.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, '')), 'sin entidades HTML para las letras');
  assert.ok(!html.includes('�') && html === html.toWellFormed(), 'sin caracteres corruptos');
  // Sin truncar, un título corto en español sale idéntico.
  const short = 'Cómo hacer Air Dribble — año 2026';
  const html2 = renderYoutubeSection([{ id: 'normal00001', title: short, publishedAt: '2026-10-20T15:00:00Z' }], CHANNEL);
  assert.ok(html2.includes(`alt="${short}"`) && html2.includes(`>${short}</a>`));
});

test('renderYoutubeSection con menos de 3 vídeos no deja huecos ni enlaces rotos', () => {
  const html = renderYoutubeSection(sample().slice(0, 1), CHANNEL);
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.ok(!html.includes('watch?v=undefined'));
  assert.ok(!html.includes('watch?v="'));
});

test('renderYoutubeSection sin vídeos lanza error (la lista existente no se sobrescribe)', () => {
  assert.throws(() => renderYoutubeSection([], CHANNEL), /vídeo/);
});

test('renderYoutubeSection rechaza ids no válidos', () => {
  assert.throws(() => renderYoutubeSection([{ id: 'x"><b', title: 't', publishedAt: '2026-01-01T00:00:00Z' }], CHANNEL));
});

test('renderYoutubeSection no tiene líneas en blanco ni HTML prohibido por GitHub', () => {
  const html = renderYoutubeSection(sample(), CHANNEL);
  assert.ok(!/\n\s*\n/.test(html), 'una línea en blanco cortaría el bloque HTML');
  assert.ok(!/<(table|style|script)\b|\b(class|id|style)=/.test(html));
});

test('renderYoutubeSection es determinista y cambia si cambia un título o un vídeo (RF-45)', () => {
  const a = renderYoutubeSection(sample(), CHANNEL);
  assert.equal(renderYoutubeSection(sample(), CHANNEL), a);
  const renamed = sample().map((v, i) => (i === 1 ? { ...v, title: v.title + ' (updated)' } : v));
  assert.notEqual(renderYoutubeSection(renamed, CHANNEL), a);
  const replaced = sample().map((v, i) => (i === 2 ? { ...v, id: 'normal00009' } : v));
  assert.notEqual(renderYoutubeSection(replaced, CHANNEL), a);
});

// ---------- replaceBetweenMarkers ----------

const README = [
  '# Title',
  '',
  'Intro text.',
  '',
  YOUTUBE_START,
  'old content',
  YOUTUBE_END,
  '',
  '## Contact',
  'footer',
  '',
].join('\n');

test('replaceBetweenMarkers solo cambia el bloque entre marcadores', () => {
  const out = replaceBetweenMarkers(README, YOUTUBE_START, YOUTUBE_END, 'NEW');
  assert.equal(out, README.replace('old content', 'NEW'));
});

test('replaceBetweenMarkers es idempotente', () => {
  const once = replaceBetweenMarkers(README, YOUTUBE_START, YOUTUBE_END, 'NEW\nLINES');
  assert.equal(replaceBetweenMarkers(once, YOUTUBE_START, YOUTUBE_END, 'NEW\nLINES'), once);
});

test('replaceBetweenMarkers funciona con marcadores vacíos o en la misma línea', () => {
  const inline = `a ${YOUTUBE_START}${YOUTUBE_END} b`;
  assert.equal(replaceBetweenMarkers(inline, YOUTUBE_START, YOUTUBE_END, 'X'), `a ${YOUTUBE_START}\nX\n${YOUTUBE_END} b`);
});

test('replaceBetweenMarkers respeta los finales de línea CRLF del resto del archivo', () => {
  const crlf = README.replace(/\n/g, '\r\n');
  const out = replaceBetweenMarkers(crlf, YOUTUBE_START, YOUTUBE_END, 'NEW');
  assert.equal(out, crlf.replace('old content', 'NEW'));
});

test('replaceBetweenMarkers no interpreta $ del contenido como patrones de reemplazo', () => {
  const out = replaceBetweenMarkers(README, YOUTUBE_START, YOUTUBE_END, "costs $& and $' and $1");
  assert.ok(out.includes("costs $& and $' and $1"));
});

test('replaceBetweenMarkers lanza error si falta un marcador, está repetido o el orden es incorrecto', () => {
  assert.throws(() => replaceBetweenMarkers('nada', YOUTUBE_START, YOUTUBE_END, 'x'), /marcador/);
  assert.throws(() => replaceBetweenMarkers(`${YOUTUBE_START}\n`, YOUTUBE_START, YOUTUBE_END, 'x'), /marcador/);
  assert.throws(() => replaceBetweenMarkers(`${YOUTUBE_END}\n${YOUTUBE_START}`, YOUTUBE_START, YOUTUBE_END, 'x'), /marcador/);
  assert.throws(
    () => replaceBetweenMarkers(`${YOUTUBE_START}${YOUTUBE_END}${YOUTUBE_START}${YOUTUBE_END}`, YOUTUBE_START, YOUTUBE_END, 'x'),
    /marcador/,
  );
});

test('la sección renderizada se inserta entre los marcadores del README', () => {
  const html = renderYoutubeSection(sample(), CHANNEL);
  const out = replaceBetweenMarkers(README, YOUTUBE_START, YOUTUBE_END, html);
  assert.ok(out.startsWith('# Title\n\nIntro text.\n\n'));
  assert.ok(out.endsWith(`${YOUTUBE_END}\n\n## Contact\nfooter\n`));
  assert.ok(out.includes(`${YOUTUBE_START}\n${html}\n${YOUTUBE_END}`));
});
