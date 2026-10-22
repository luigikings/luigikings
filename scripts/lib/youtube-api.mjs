// Capa de API de YouTube (RF-40, RF-61, RF-62). Recibe `fetch` y `key`: no lee el entorno, la
// fecha ni el disco. La selección de vídeos (pura) vive en youtube.mjs.
//
// Cuota (YouTube Data API v3, 10 000 unidades/día por defecto):
//   fetchLatest      → playlistItems.list (1) + videos.list (1) = 2 unidades por ejecución.
//   resolveChannelId → channels.list (1), solo en el paso manual.
// La sonda de Shorts va a www.youtube.com, no a la API, y no gasta cuota.
//
// Seguridad: la clave viaja en la query (`key=`), así que los errores nunca copian la URL, el
// mensaje de la API ni la clave; solo un código fijo, el estado HTTP y motivos con forma de enumeración.
import { needsShortProbe, isShortFromProbe, classifyVideo, selectLatest, parseIsoDuration, PREMIERE_MAX_GAP_SECONDS } from './youtube.mjs';

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
export const SHORTS_PROBE_BASE = 'https://www.youtube.com/shorts/';

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HANDLE = /^@?[A-Za-z0-9._-]{3,30}$/;
const MAX_RESULTS = 50;
const PROBE_TIMEOUT_MS = 10_000;

const INVALID_KEY_REASONS = new Set([
  'keyInvalid',
  'API_KEY_INVALID',
  'API_KEY_SERVICE_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED',
  'ipRefererBlocked',
  'accessNotConfigured',
  'SERVICE_DISABLED',
  'keyExpired',
]);
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded', 'RATE_LIMIT_EXCEEDED_DAILY']);
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'RATE_LIMIT_EXCEEDED']);

export class YouTubeApiError extends Error {
  /**
   * @param {'missing-key'|'missing-channel'|'invalid-key'|'quota-exceeded'|'rate-limited'|'forbidden'|'not-found'|'http'|'network'|'bad-response'|'no-videos'} code
   * @param {{status?: number, detail?: string}} [extra] `detail` solo admite motivos con forma de enumeración
   */
  constructor(code, { status, detail } = {}) {
    const parts = [code, status ? `HTTP ${status}` : '', detail ?? ''].filter(Boolean);
    super(`YouTube API error: ${parts.join(' ')}`);
    this.name = 'YouTubeApiError';
    this.code = code;
    if (status) this.status = status;
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** "UC…" → "UU…" (lista de subidas del canal). */
export function uploadsPlaylistId(channelId) {
  const id = typeof channelId === 'string' ? channelId.trim() : '';
  if (!CHANNEL_ID.test(id)) throw new YouTubeApiError('missing-channel');
  return 'UU' + id.slice(2);
}

function requireKey(key) {
  if (typeof key !== 'string' || key.trim() === '') throw new YouTubeApiError('missing-key');
  return key.trim();
}

/** Motivos de error de la API que tienen forma de enumeración (nunca mensajes libres). */
function safeReasons(body) {
  const err = isObj(body) ? body.error : null;
  if (!isObj(err)) return [];
  const raw = [
    ...(Array.isArray(err.errors) ? err.errors.map((e) => e?.reason) : []),
    ...(Array.isArray(err.details) ? err.details.map((d) => d?.reason) : []),
  ];
  return [...new Set(raw.filter((r) => typeof r === 'string' && /^[A-Za-z_]{1,40}$/.test(r)))];
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** GET a la API de datos. Devuelve el cuerpo JSON (objeto) o lanza YouTubeApiError. */
async function apiGet(fetchFn, key, resource, params) {
  const url = new URL(`${YOUTUBE_API_BASE}/${resource}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  let res;
  try {
    res = await fetchFn(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  } catch {
    throw new YouTubeApiError('network');
  }
  const status = res?.status;
  if (!res?.ok) {
    const reasons = safeReasons(await readJson(res));
    const detail = reasons.join(',') || undefined;
    const has = (set) => reasons.some((r) => set.has(r));
    if (has(INVALID_KEY_REASONS)) throw new YouTubeApiError('invalid-key', { status, detail });
    if (has(QUOTA_REASONS)) throw new YouTubeApiError('quota-exceeded', { status, detail });
    if (status === 429 || has(RATE_REASONS)) throw new YouTubeApiError('rate-limited', { status, detail });
    if (status === 400 && !reasons.length) throw new YouTubeApiError('invalid-key', { status });
    if (status === 401) throw new YouTubeApiError('invalid-key', { status, detail });
    if (status === 403) throw new YouTubeApiError('forbidden', { status, detail });
    if (status === 404) throw new YouTubeApiError('not-found', { status, detail });
    throw new YouTubeApiError('http', { status, detail });
  }
  const body = await readJson(res);
  if (!isObj(body)) throw new YouTubeApiError('bad-response');
  return body;
}

/** Sonda HEAD /shorts/{id} sin seguir redirecciones → { status } o { error: true }. Sin clave ni cuota. */
async function probeShort(fetchFn, id) {
  try {
    const init = { method: 'HEAD', redirect: 'manual' };
    if (typeof AbortSignal?.timeout === 'function') init.signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
    const res = await fetchFn(SHORTS_PROBE_BASE + id, init);
    return Number.isInteger(res?.status) ? { status: res.status } : { error: true };
  } catch {
    return { error: true };
  }
}

/**
 * Últimos `count` vídeos elegibles del canal (RF-40 a RF-42) usando su lista de subidas.
 * Devuelve [{ id, title, publishedAt }] (≥ 1). Nunca devuelve [] (RF-61): lanza 'no-videos'.
 * @param {{fetch: Function, key: string, channelId: string, count?: number, shortsMaxSeconds: number,
 *          premiereMaxGapSeconds?: number}} opts
 * @throws {YouTubeApiError}
 */
export async function fetchLatest({ fetch: fetchFn, key, channelId, count = 3, shortsMaxSeconds, premiereMaxGapSeconds = PREMIERE_MAX_GAP_SECONDS } = {}) {
  const apiKey = requireKey(key);
  const playlistId = uploadsPlaylistId(channelId);
  if (typeof fetchFn !== 'function') throw new TypeError('fetchLatest necesita una función fetch');
  if (!Number.isFinite(shortsMaxSeconds)) throw new TypeError('fetchLatest necesita shortsMaxSeconds');

  const list = await apiGet(fetchFn, apiKey, 'playlistItems', { part: 'contentDetails', playlistId, maxResults: MAX_RESULTS });
  if (!Array.isArray(list.items)) throw new YouTubeApiError('bad-response');
  if (list.items.length === 0) throw new YouTubeApiError('no-videos');
  const ids = [...new Set(list.items.map((it) => it?.contentDetails?.videoId).filter((id) => typeof id === 'string' && VIDEO_ID.test(id)))];
  if (ids.length === 0) throw new YouTubeApiError('bad-response');

  const vids = await apiGet(fetchFn, apiKey, 'videos', {
    part: 'snippet,contentDetails,liveStreamingDetails,status',
    id: ids.join(','),
    maxResults: MAX_RESULTS,
  });
  if (!Array.isArray(vids.items)) throw new YouTubeApiError('bad-response');

  // Del más nuevo al más antiguo; se para al tener `count` elegibles para no sondear de más.
  const ordered = vids.items
    .filter((v) => isObj(v) && typeof v.id === 'string' && !Number.isNaN(Date.parse(v.snippet?.publishedAt)))
    .sort((a, b) => Date.parse(b.snippet.publishedAt) - Date.parse(a.snippet.publishedAt));
  const classified = [];
  let eligible = 0;
  for (const video of ordered) {
    if (eligible >= count) break;
    const opts = { shortsMaxSeconds, premiereMaxGapSeconds };
    if (needsShortProbe(video, { shortsMaxSeconds })) {
      opts.isShort = isShortFromProbe(await probeShort(fetchFn, video.id), parseIsoDuration(video.contentDetails.duration));
    }
    const c = classifyVideo(video, opts);
    classified.push(c);
    if (c.eligible) eligible++;
  }

  const latest = selectLatest(classified, count);
  if (latest.length === 0) throw new YouTubeApiError('no-videos');
  return latest;
}

/**
 * ID del canal (UC…) a partir de su handle (@lk_rl). Solo para el paso manual de configuración.
 * @param {{fetch: Function, key: string, handle: string}} opts
 * @throws {YouTubeApiError|TypeError}
 */
export async function resolveChannelId({ fetch: fetchFn, key, handle } = {}) {
  const apiKey = requireKey(key);
  if (typeof handle !== 'string' || !HANDLE.test(handle.trim())) throw new TypeError('Handle de YouTube no válido');
  if (typeof fetchFn !== 'function') throw new TypeError('resolveChannelId necesita una función fetch');
  const h = handle.trim();
  const body = await apiGet(fetchFn, apiKey, 'channels', { part: 'id', forHandle: h.startsWith('@') ? h : '@' + h });
  if (body.items === undefined || (Array.isArray(body.items) && body.items.length === 0)) throw new YouTubeApiError('not-found');
  if (!Array.isArray(body.items)) throw new YouTubeApiError('bad-response');
  const id = body.items[0]?.id;
  if (typeof id !== 'string' || !CHANNEL_ID.test(id)) throw new YouTubeApiError('bad-response');
  return id;
}
