// Selección de vídeos de YouTube (RF-41, RF-42, RF-45). Funciones puras: sin red ni fecha real.
// La sonda de Shorts (red) la hace youtube-api.mjs (T9) y llega aquí como resultado ya resuelto.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** Regla de respaldo si no hay sonda o falla: un Short dura ≤ 60 s. */
export const SHORT_FALLBACK_SECONDS = 60;
/** Margen máximo entre la emisión de un estreno y la duración del vídeo (cuenta atrás). */
export const PREMIERE_MAX_GAP_SECONDS = 300;

/** "PT8M30S" → 510. Devuelve NaN si el valor no es una duración ISO 8601 válida. */
export function parseIsoDuration(value) {
  if (typeof value !== 'string') return NaN;
  const m = ISO_DURATION.exec(value);
  if (!m || value === 'P' || value.endsWith('T')) return NaN;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

const isValidDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Extrae los campos básicos de un item de `videos.list`; null si están mal formados. */
function basics(video) {
  if (!video || typeof video !== 'object') return null;
  const { id, snippet, contentDetails, status } = video;
  if (typeof id !== 'string' || !VIDEO_ID.test(id)) return null;
  if (!snippet || typeof snippet.title !== 'string' || snippet.title.trim() === '') return null;
  if (!isValidDate(snippet.publishedAt)) return null;
  const duration = parseIsoDuration(contentDetails?.duration);
  if (Number.isNaN(duration)) return null;
  return {
    id,
    title: snippet.title,
    publishedAt: snippet.publishedAt,
    live: snippet.liveBroadcastContent ?? 'none',
    privacy: status?.privacyStatus,
    duration,
    liveDetails: video.liveStreamingDetails ?? null,
  };
}

/** ¿Hay que lanzar la sonda HEAD /shorts/{id}? Solo para vídeos públicos, ya emitidos y cortos. */
export function needsShortProbe(video, { shortsMaxSeconds }) {
  const b = basics(video);
  if (!b || b.privacy !== 'public' || b.live === 'live' || b.live === 'upcoming') return false;
  return b.duration <= shortsMaxSeconds;
}

/**
 * Traduce el resultado de la sonda a "es Short".
 * probe = { status } (sin seguir redirecciones) o { error: true }.
 * 200 → Short; 3xx → no Short; error de red u otro estado → duración ≤ 60 s.
 */
export function isShortFromProbe(probe, durationSeconds) {
  const status = probe?.status;
  if (!probe?.error && status === 200) return true;
  if (!probe?.error && Number.isInteger(status) && status >= 300 && status < 400) return false;
  return durationSeconds <= SHORT_FALLBACK_SECONDS;
}

/**
 * Clasifica un item de `videos.list` (part: snippet,contentDetails,liveStreamingDetails,status).
 * opts: { shortsMaxSeconds, isShort?, premiereMaxGapSeconds? }.
 * Devuelve { id, title, publishedAt, kind, eligible } con kind ∈
 * video | premiere | short | live | upcoming | live-recording | private | invalid.
 */
export function classifyVideo(video, { shortsMaxSeconds, isShort, premiereMaxGapSeconds = PREMIERE_MAX_GAP_SECONDS } = {}) {
  const b = basics(video);
  if (!b) return { id: video?.id ?? null, title: null, publishedAt: null, kind: 'invalid', eligible: false };
  const out = (kind) => ({
    id: b.id,
    title: b.title,
    publishedAt: b.publishedAt,
    kind,
    eligible: kind === 'video' || kind === 'premiere',
  });

  if (b.privacy !== 'public') return out('private');
  if (b.live === 'live') return out('live');
  if (b.live === 'upcoming') return out('upcoming'); // directo programado o estreno aún no emitido

  if (b.duration <= shortsMaxSeconds) {
    const short = typeof isShort === 'boolean' ? isShort : b.duration <= SHORT_FALLBACK_SECONDS;
    if (short) return out('short');
  }

  if (b.liveDetails) {
    const start = Date.parse(b.liveDetails.actualStartTime);
    const end = Date.parse(b.liveDetails.actualEndTime);
    if (Number.isNaN(start) || Number.isNaN(end)) return out('live-recording');
    const span = (end - start) / 1000;
    // La emisión de un estreno dura el vídeo más la cuenta atrás.
    if (b.duration < span && span - b.duration <= premiereMaxGapSeconds) return out('premiere');
    return out('live-recording');
  }

  return out('video');
}

/** Los `n` vídeos elegibles más recientes, del más nuevo al más antiguo (desempate por id). */
export function selectLatest(classified, n) {
  return classified
    .filter((v) => v && v.eligible)
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, n)
    .map(({ id, title, publishedAt }) => ({ id, title, publishedAt }));
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * Normaliza espacios y, si supera `max` caracteres visibles (grafemas), corta a `max` en total
 * terminando en "…" sin partir emojis. No escapa: eso se hace al pintar.
 */
export function truncateTitle(title, max = 60) {
  const clean = String(title).replace(/\s+/g, ' ').trim();
  const graphemes = Array.from(segmenter.segment(clean), (s) => s.segment);
  if (graphemes.length <= max) return clean;
  return graphemes.slice(0, max - 1).join('').trimEnd() + '…';
}
