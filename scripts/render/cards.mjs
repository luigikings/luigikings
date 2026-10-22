// Tarjetas propias de stats, lenguajes y racha (RF-32, RF-33, RF-34, RF-17, RNF-7).
// Las tres salen del mismo ProfileStats que el marcador (RF-39). Fondo opaco #0a0e1a con borde
// neón: una sola variante válida en tema claro y oscuro (RNF-5). Funciones puras.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc, escapeXml } from '../lib/svg.mjs';
import { formatNumber, formatPct } from '../lib/format.mjs';
import { statsAlt, languagesAlt, streakAlt } from '../lib/alt.mjs';
import { fitFontSize } from './scoreboard.mjs';

const W = 460;
const H = 200;
const R = 16;
const PAD = 24;
const FONT = "'Segoe UI', Verdana, sans-serif";
const MAX_LANGUAGES = 6;
const LANG_NAME_MAX = 15;
const NO_LANGUAGES = 'No languages yet';

/** Filas de la tarjeta de stats con las etiquetas exactas de RF-32 (en este orden). */
export const STATS_ROWS = Object.freeze([
  { key: 'stars', label: 'Stars', icon: 'star', color: PALETTE.orange },
  { key: 'commitsLastYear', label: 'Commits (last year)', icon: 'commit', color: PALETTE.blue },
  { key: 'prs', label: 'Pull requests (all time)', icon: 'pr', color: PALETTE.boost },
  { key: 'issues', label: 'Issues (all time)', icon: 'issue', color: PALETTE.orange },
  { key: 'reviews', label: 'Code reviews (all time)', icon: 'review', color: PALETTE.blue },
]);

/** Etiquetas exactas de RF-34, de izquierda a derecha. */
export const STREAK_LABELS = Object.freeze(['Total contributions', 'Current streak', 'Longest streak']);

// formatPct vive en lib/format.mjs (la usa también alt.mjs); se reexporta por compatibilidad.
export { formatPct };

function requireStats(stats, who) {
  if (stats === null || typeof stats !== 'object') throw new TypeError(`${who}: falta ProfileStats`);
  return stats;
}

const truncate = (s, max) => ([...s].length <= max ? s : [...s].slice(0, max - 1).join('').trimEnd() + '…');

// --- Marco común --------------------------------------------------------------

const lin = (id, stops, attrs = 'x1="0" x2="1"') =>
  `<linearGradient id="${id}" ${attrs}>${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;

const COMMON_STYLE = [
  '.run{stroke-dasharray:14 86;animation:run 6s linear infinite}',
  '@keyframes run{to{stroke-dashoffset:-100}}',
  '.sheen{animation:sheen 9s ease-in-out infinite}',
  '@keyframes sheen{0%,60%{transform:translateX(-240px)}100%{transform:translateX(760px)}}',
  '.pulse{animation:pulse 3s ease-in-out infinite}',
  '@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}',
];
const REDUCED = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

/**
 * Marco de tarjeta: fondo opaco, halo del acento, malla hexagonal tenue, cabecera, borde y destello.
 * @param {{title: string, heading: string|null, icon: string, accent: string, body: string, style?: string[], extraDefs?: string}} o
 */
function card({ title, heading, icon, accent, body, style = [], extraDefs = '' }) {
  const { bg, text, boost } = PALETTE;
  const defs =
    `<defs>` +
    `<radialGradient id="ag" cx="0" cy="0" r="1"><stop offset="0" stop-color="${accent}" stop-opacity=".22"/><stop offset=".6" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="bg2" cx="1" cy="1" r=".9"><stop offset="0" stop-color="${boost}" stop-opacity=".14"/><stop offset="1" stop-color="${boost}" stop-opacity="0"/></radialGradient>` +
    lin('ul', [[0, accent], [1, boost, 0]]) +
    lin('sh', [[0, text, 0], [0.5, text, 0.06], [1, text, 0]]) +
    lin('hf', [[0, accent, 0], [1, accent, 0.22]], `gradientUnits="userSpaceOnUse" x1="${W - 170}" y1="0" x2="${W}" y2="0"`) +
    `<clipPath id="cp"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>` +
    `<filter id="gl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="ng" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/><feFlood flood-color="${accent}" flood-opacity=".7"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    extraDefs +
    `</defs>`;

  const header = heading
    ? `<g transform="translate(${PAD} 20)">${HEAD_ICONS[icon](accent)}</g>` +
      `<text x="${PAD + 30}" y="38" font-family="${FONT}" font-size="18" font-weight="800" letter-spacing=".5" fill="${text}" filter="url(#ng)">${escapeXml(heading)}</text>` +
      `<rect x="${PAD + 30}" y="47" width="72" height="3" rx="1.5" fill="url(#ul)"/>`
    : '';

  const full =
    defs +
    `<rect class="bg" width="${W}" height="${H}" rx="${R}" fill="${bg}"/>` +
    `<g clip-path="url(#cp)">` +
    `<rect width="${W}" height="${H}" fill="url(#ag)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#bg2)"/>` +
    hexMesh() +
    `<rect class="sheen" x="0" y="-40" width="120" height="${H + 80}" fill="url(#sh)" transform="skewX(-20)"/>` +
    `</g>` +
    header +
    body +
    `<rect class="edge" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" fill="none" stroke="${accent}" stroke-opacity=".5" stroke-width="1.5"/>` +
    `<rect class="run" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" pathLength="100" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" filter="url(#gl)"/>`;

  return svgDoc({ width: W, height: H, title, style: [...COMMON_STYLE, ...style, REDUCED].join(''), body: full });
}

/** Malla hexagonal (red de portería) en la esquina superior derecha, desvanecida hacia la izquierda. */
function hexMesh() {
  const s = 12;
  const dx = Math.sqrt(3) * s;
  const dy = 1.5 * s;
  const rr = (v) => Math.round(v * 10) / 10;
  let d = '';
  for (let row = -1; row * dy < 90; row++) {
    const off = row % 2 ? dx / 2 : 0;
    for (let x = W - 170 + off; x < W + dx; x += dx) {
      const y = row * dy;
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        pts.push(`${rr(x + s * Math.cos(a))} ${rr(y + s * Math.sin(a))}`);
      }
      d += `M${pts.join('L')}Z`;
    }
  }
  return `<path d="${d}" fill="none" stroke="url(#hf)" stroke-width="1"/>`;
}

// --- Iconos (caja 20 × 20 para cabeceras, 16 × 16 para filas) ----------------

const HEAD_ICONS = {
  // Barras de stats.
  stats: (c) => `<path d="M3 17V10M8 17V5M13 17V8M18 17V2" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`,
  // Llaves de código.
  code: (c) => `<path d="M7 4L2 10l5 6M13 4l5 6-5 6" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Llama de boost.
  flame: (c) =>
    `<path d="M10 1.5c.8 3.2 5.5 5.3 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.4 1.3-4 2.6-5.2.2 1.7 1 2.8 2.1 3.2C8.6 7 9.3 4.2 10 1.5z" fill="${c}" fill-opacity=".2" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`,
};

const ROW_ICONS = {
  star: (c) => `<path d="M8 1.2l2 4.2 4.6.6-3.3 3.2.8 4.6L8 11.6l-4.1 2.2.8-4.6L1.4 6l4.6-.6z" fill="${c}" fill-opacity=".2" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>`,
  commit: (c) => `<circle cx="8" cy="8" r="3.2" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M0.5 8h4.3M11.2 8h4.3" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`,
  pr: (c) =>
    `<circle cx="3.5" cy="3" r="2" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="3.5" cy="13" r="2" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="12.5" cy="13" r="2" fill="none" stroke="${c}" stroke-width="1.4"/>` +
    `<path d="M3.5 5v6M12.5 11V6.5a2.5 2.5 0 0 0-2.5-2.5H7M8.8 2.2L7 4l1.8 1.8" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  issue: (c) => `<circle cx="8" cy="8" r="6.5" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="8" cy="8" r="1.8" fill="${c}"/>`,
  review: (c) =>
    `<path d="M1 8s2.6-4.8 7-4.8S15 8 15 8s-2.6 4.8-7 4.8S1 8 1 8z" fill="none" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" fill="${c}"/>`,
};

// --- Tarjeta de stats (RF-32) ----------------------------------------------------

/** @param {object} stats ProfileStats */
export function renderStatsCard(stats) {
  requireStats(stats, 'renderStatsCard');
  const rows = STATS_ROWS.map((r) => ({ ...r, value: formatNumber(stats[r.key]) }));
  const title = statsAlt(stats);
  const { text } = PALETTE;
  const top = 76;
  const step = 25;
  const body = rows
    .map((r, i) => {
      const y = top + i * step;
      return (
        `<g class="row" style="animation-delay:${(i * 0.4).toFixed(1)}s">` +
        `<g transform="translate(${PAD} ${y - 12})">${ROW_ICONS[r.icon](r.color)}</g>` +
        `<text x="${PAD + 26}" y="${y}" font-family="${FONT}" font-size="14" fill="${text}">${escapeXml(r.label)}</text>` +
        `<path d="M${PAD + 236} ${y - 4}H${W - PAD - 74}" stroke="${r.color}" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="1 5" stroke-linecap="round"/>` +
        `<text x="${W - PAD}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="16" font-weight="800" fill="${r.color}">${escapeXml(r.value)}</text>` +
        `</g>`
      );
    })
    .join('');
  return card({
    title,
    heading: 'GitHub stats',
    icon: 'stats',
    accent: PALETTE.blue,
    body,
    style: ['.row{animation:row 6s ease-in-out infinite}', '@keyframes row{0%,100%{opacity:.85}50%{opacity:1}}'],
  });
}

// --- Tarjeta de lenguajes (RF-33) --------------------------------------------------

/** Colores de los 6 segmentos: solo la paleta (los dos últimos, tonos atenuados del azul y el naranja). */
const SEGMENTS = [
  { color: PALETTE.blue, opacity: 1 },
  { color: PALETTE.orange, opacity: 1 },
  { color: PALETTE.boost, opacity: 1 },
  { color: PALETTE.text, opacity: 1 },
  { color: PALETTE.blue, opacity: 0.5 },
  { color: PALETTE.orange, opacity: 0.5 },
];

/** @param {object} stats ProfileStats */
export function renderLanguagesCard(stats) {
  requireStats(stats, 'renderLanguagesCard');
  if (!Array.isArray(stats.languages)) throw new TypeError('renderLanguagesCard: languages debe ser una lista');
  const langs = stats.languages.slice(0, MAX_LANGUAGES).map((l) => {
    if (typeof l?.name !== 'string' || !l.name.trim()) throw new TypeError('renderLanguagesCard: lenguaje sin nombre');
    return { name: l.name, pct: l.pct, label: formatPct(l.pct) };
  });
  const { text, bg } = PALETTE;
  const barX = PAD;
  const barY = 66;
  const barW = W - 2 * PAD;
  const barH = 12;

  const title = languagesAlt(stats);
  let body =
    `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="6" fill="${text}" fill-opacity=".08"/>`;

  if (!langs.length) {
    body += `<text x="${W / 2}" y="140" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="${text}">${NO_LANGUAGES}</text>`;
  } else {
    let x = barX;
    let segs = '';
    langs.forEach((l, i) => {
      const w = Math.round(((Math.min(100, l.pct) / 100) * barW) * 10) / 10;
      const s = SEGMENTS[i];
      segs += `<rect class="seg" x="${Math.round(x * 10) / 10}" y="${barY}" width="${w}" height="${barH}" fill="${s.color}"${s.opacity < 1 ? ` fill-opacity="${s.opacity}"` : ''}/>`;
      x += w;
    });
    // Separadores finos entre segmentos para que se distingan los colores parecidos.
    body +=
      `<g clip-path="url(#bc)">${segs}<rect class="shine" x="${barX}" y="${barY}" width="60" height="${barH}" fill="url(#bs)"/></g>` +
      `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="6" fill="none" stroke="${bg}" stroke-opacity=".5"/>`;

    // Leyenda en 2 columnas × 3 filas, por columnas (1-3 a la izquierda, 4-6 a la derecha).
    const colW = (W - 2 * PAD - 16) / 2;
    langs.forEach((l, i) => {
      const col = Math.floor(i / 3);
      const row = i % 3;
      const lx = PAD + col * (colW + 16);
      const ly = 112 + row * 30;
      const s = SEGMENTS[i];
      body +=
        `<g>` +
        `<circle class="dot" cx="${lx + 6}" cy="${ly - 5}" r="5.5" fill="${s.color}"${s.opacity < 1 ? ` fill-opacity="${s.opacity}"` : ''} style="animation-delay:${(i * 0.5).toFixed(1)}s"/>` +
        `<text x="${lx + 20}" y="${ly}" font-family="${FONT}" font-size="13" fill="${text}">${escapeXml(truncate(l.name, LANG_NAME_MAX))}</text>` +
        `<text x="${lx + colW}" y="${ly}" text-anchor="end" font-family="${FONT}" font-size="13" font-weight="800" fill="${s.color}">${escapeXml(l.label)}</text>` +
        `</g>`;
    });
  }

  return card({
    title,
    heading: 'Top languages',
    icon: 'code',
    accent: PALETTE.orange,
    body,
    extraDefs:
      `<clipPath id="bc"><rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="6"/></clipPath>` +
      lin('bs', [[0, text, 0], [0.5, text, 0.55], [1, text, 0]]),
    style: [
      '.shine{animation:shine 5s ease-in-out infinite}',
      `@keyframes shine{0%,40%{transform:translateX(-80px)}100%{transform:translateX(${barW + 40}px)}}`,
      '.dot{animation:dot 3s ease-in-out infinite}',
      '@keyframes dot{0%,100%{opacity:.75}50%{opacity:1}}',
    ],
  });
}

// --- Tarjeta de racha (RF-34) ---------------------------------------------------------

/** @param {object} stats ProfileStats */
export function renderStreakCard(stats) {
  requireStats(stats, 'renderStreakCard');
  const values = [stats.totalContributions, stats.currentStreak, stats.longestStreak].map(formatNumber);
  const title = streakAlt(stats);
  const { text, blue, orange, boost } = PALETTE;
  const colW = (W - 2 * PAD) / 3;
  const cxs = [0, 1, 2].map((i) => PAD + colW * (i + 0.5));
  const colors = [blue, orange, boost];

  // Columnas laterales: cifra grande y etiqueta.
  const side = (i) =>
    `<text x="${cxs[i]}" y="122" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="800" fill="${text}" filter="url(#v${i})">${escapeXml(values[i])}</text>` +
    `<text x="${cxs[i]}" y="166" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700" fill="${colors[i]}">${STREAK_LABELS[i]}</text>`;

  // Columna central: anillo de boost con la racha actual y una llama encima.
  const cx = cxs[1];
  const cy = 112;
  const r = 38;
  // La cifra cabe dentro del anillo: la fuente se reduce con cifras largas ("12.3k").
  const ringSize = fitFontSize(values[1], 2 * r - 14, 28, 14);
  const center =
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${orange}" fill-opacity=".08" stroke="${orange}" stroke-opacity=".25" stroke-width="5"/>` +
    `<circle class="ring" cx="${cx}" cy="${cy}" r="${r}" pathLength="100" fill="none" stroke="url(#rg)" stroke-width="5" stroke-linecap="round" filter="url(#gl)"/>` +
    `<g transform="translate(${cx - 10} ${cy - r - 22})"><g class="flame">` +
    `<circle cx="10" cy="11" r="11" fill="${PALETTE.bg}"/>` +
    HEAD_ICONS.flame(orange) +
    `</g></g>` +
    `<text x="${cx}" y="${cy + Math.round(ringSize * 0.36)}" text-anchor="middle" font-family="${FONT}" font-size="${ringSize}" font-weight="800" fill="${text}" filter="url(#v1)">${escapeXml(values[1])}</text>` +
    `<text x="${cx}" y="166" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700" fill="${orange}">${STREAK_LABELS[1]}</text>`;

  const dividers = [1, 2]
    .map((i) => `<path d="M${PAD + colW * i} 72V172" stroke="${text}" stroke-opacity=".12" stroke-width="1.5"/>`)
    .join('');

  const glowFor = (id, c) =>
    `<filter id="${id}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feFlood flood-color="${c}" flood-opacity=".75"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

  return card({
    title,
    heading: 'Contribution streak',
    icon: 'flame',
    accent: boost,
    body: dividers + side(0) + center + side(2),
    extraDefs: lin('rg', [[0, orange], [1, boost]]) + glowFor('v0', blue) + glowFor('v1', orange) + glowFor('v2', boost),
    style: [
      `.ring{stroke-dasharray:70 30;transform-box:fill-box;transform-origin:center;animation:ring 6s linear infinite}`,
      '@keyframes ring{to{transform:rotate(360deg)}}',
      '.flame{animation:flame 2.4s ease-in-out infinite}',
      '@keyframes flame{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    ],
  });
}
