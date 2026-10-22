// Bloques del README que se reescriben automáticamente: la sección de YouTube (RF-41, RF-43 a RF-46)
// y la etiqueta <img> con su `alt` con cifras del marcador y de las 3 tarjetas de stats (RF-65).
import { truncateTitle } from './youtube.mjs';

export const YOUTUBE_START = '<!-- YOUTUBE:START -->';
export const YOUTUBE_END = '<!-- YOUTUBE:END -->';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para contenido o atributos HTML del README. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function indexesOf(haystack, needle) {
  const out = [];
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) out.push(i);
  return out;
}

/** Error de marcadores del README (falta, está repetido o en orden inverso). `code` fijo para la salida. */
export class MarkerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MarkerError';
    this.code = 'readme-markers';
  }
}

/** Posiciones [fin de start, inicio de end] del único bloque entre `start` y `end`. */
function locateBlock(readme, start, end, who) {
  const s = indexesOf(readme, start);
  const e = indexesOf(readme, end);
  if (s.length !== 1 || e.length !== 1) {
    throw new MarkerError(`${who}: cada marcador debe aparecer una vez (${start}: ${s.length}, ${end}: ${e.length})`);
  }
  const from = s[0] + start.length;
  if (e[0] < from) throw new MarkerError(`${who}: el marcador ${end} va antes de ${start}`);
  return [from, e[0]];
}

/**
 * Sustituye lo que hay entre `start` y `end` por `content` (que queda en sus propias líneas).
 * El resto del archivo no cambia. Respeta CRLF si el archivo lo usa.
 * Lanza MarkerError si algún marcador falta, está repetido o aparece en orden inverso.
 */
export function replaceBetweenMarkers(readme, start, end, content) {
  const [from, to] = locateBlock(readme, start, end, 'replaceBetweenMarkers');
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';
  const body = String(content).replace(/\r?\n/g, eol);
  return readme.slice(0, from) + eol + body + eol + readme.slice(to);
}

// --- Imágenes de stats con su alt (RF-65) -------------------------------------------

/** Piezas del grupo con bloque ALT:* en el README, en orden. */
export const STATS_PIECES = Object.freeze(['scoreboard', 'stats', 'languages', 'streak']);

/**
 * Atributos fijos de cada <img> regenerada. El marcador flota a la derecha del "About me";
 * las tarjetas (460 × 200) van en línea y bajan de fila solas (RNF-2).
 */
export const STATS_IMAGES = Object.freeze({
  scoreboard: Object.freeze({ src: 'assets/generated/scoreboard.svg', align: 'right', width: 360 }),
  stats: Object.freeze({ src: 'assets/generated/stats.svg', width: 390 }),
  languages: Object.freeze({ src: 'assets/generated/languages.svg', width: 390 }),
  streak: Object.freeze({ src: 'assets/generated/streak.svg', width: 390 }),
});

/** Marcadores `<!-- ALT:<pieza>:START -->` / `<!-- ALT:<pieza>:END -->`. */
export function statsMarkers(piece) {
  if (!STATS_PIECES.includes(piece)) throw new TypeError(`statsMarkers: pieza desconocida ${piece}`);
  return { start: `<!-- ALT:${piece}:START -->`, end: `<!-- ALT:${piece}:END -->` };
}

/** ¿Tiene el README algún marcador ALT:*? (un README antiguo no tiene ninguno). */
export function hasAnyStatsMarker(readme) {
  return STATS_PIECES.some((p) => {
    const m = statsMarkers(p);
    return readme.includes(m.start) || readme.includes(m.end);
  });
}

/** `<img>` en una línea con el `alt` escapado como atributo HTML. */
export function renderStatsImg({ src, alt, width, align }) {
  if (typeof src !== 'string' || !src) throw new TypeError('renderStatsImg: falta src');
  if (typeof alt !== 'string' || !alt.trim()) throw new TypeError('renderStatsImg: falta alt');
  if (!Number.isInteger(width) || width <= 0) throw new TypeError('renderStatsImg: width no válido');
  return `<img src="${escapeHtml(src)}"${align ? ` align="${escapeHtml(align)}"` : ''} width="${width}" alt="${escapeHtml(alt)}">`;
}

/**
 * Reescribe los 4 bloques ALT:* (en la misma línea, sin saltos) con la <img> y el alt de `alts`
 * (salida de buildAltTexts). Todo o nada: si falta un texto o un marcador, lanza sin devolver nada a medias.
 */
export function applyStatsAlts(readme, alts) {
  if (typeof readme !== 'string') throw new TypeError('applyStatsAlts: README no válido');
  let out = readme;
  for (const p of STATS_PIECES) {
    const { start, end } = statsMarkers(p);
    const img = renderStatsImg({ ...STATS_IMAGES[p], alt: alts?.[p] });
    const [from, to] = locateBlock(out, start, end, `applyStatsAlts(${p})`);
    out = out.slice(0, from) + img + out.slice(to);
  }
  return out;
}

/**
 * Sección "Latest YouTube videos" (sin los marcadores). `videos` = salida de `selectLatest`.
 * Sin líneas en blanco para que GitHub la trate como un único bloque HTML.
 */
export function renderYoutubeSection(videos, channelUrl, { titleMaxChars = 60 } = {}) {
  if (!Array.isArray(videos) || videos.length === 0) {
    throw new Error('renderYoutubeSection: no hay ningún vídeo que mostrar');
  }
  const items = videos.map((v) => {
    if (!v || typeof v.id !== 'string' || !VIDEO_ID.test(v.id)) throw new TypeError('renderYoutubeSection: id de vídeo no válido');
    return { url: `https://www.youtube.com/watch?v=${v.id}`, id: v.id, title: escapeHtml(truncateTitle(v.title, titleMaxChars)) };
  });
  return [
    '<p align="center">',
    ...items.map(
      (v) => `  <a href="${v.url}"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" width="280" alt="${v.title}"></a>`,
    ),
    '</p>',
    '<p align="center">',
    items.map((v) => `  ▶ <a href="${v.url}">${v.title}</a>`).join('<br>\n'),
    '</p>',
    '<p align="center">',
    `  <a href="${escapeHtml(channelUrl)}">More videos on the channel →</a>`,
    '</p>',
  ].join('\n');
}
