// Marcador de partida estilo Rocket League (RF-12 a RF-17, RNF-7).
// Equipo azul a la izquierda (Goals, Saves) y naranja a la derecha (Assists, MVP), reloj de
// partida arriba, balón en el centro y barra de boost abajo. Fondo opaco #0a0e1a: una sola variante.
// Función pura: recibe un ProfileStats (scripts/lib/stats.mjs) y devuelve el SVG.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc, escapeXml } from '../lib/svg.mjs';
import { formatNumber } from '../lib/format.mjs';
import { scoreboardAlt } from '../lib/alt.mjs';

const W = 480;
const H = 392;
const R = 18;
const FONT = "'Segoe UI', Verdana, sans-serif";
const NO_LANGUAGE = '—';

/** Anchura media de un carácter en negrita respecto al tamaño de fuente (Verdana, la más ancha de la pila). */
const CHAR_EM = 0.68;

/** Casillas del marcador: título de juego, subetiqueta (tabla de cifras de la spec) y equipo. */
export const SCOREBOARD_TILES = Object.freeze([
  { title: 'Goals', label: 'Repositories', team: 'blue' },
  { title: 'Saves', label: 'Commits (last year)', team: 'blue' },
  { title: 'Assists', label: 'PRs, issues & reviews', team: 'orange' },
  { title: 'MVP', label: 'Top language', team: 'orange' },
]);

/**
 * Mayor tamaño de fuente (entre `min` y `max`) con el que `text` cabe en `maxWidth` px.
 * Estimación conservadora: anchura ≈ caracteres × tamaño × 0,68.
 */
export function fitFontSize(text, maxWidth, max, min) {
  const len = Math.max(1, [...String(text)].length);
  return Math.max(min, Math.min(max, Math.floor(maxWidth / (len * CHAR_EM))));
}

/** Acorta con "…" un texto que no cabe en `maxWidth` ni con la fuente mínima. */
function fitText(text, maxWidth, max, min) {
  const size = fitFontSize(text, maxWidth, max, min);
  const chars = [...text];
  const fits = Math.floor(maxWidth / (size * CHAR_EM));
  return { size, text: chars.length <= fits ? text : chars.slice(0, Math.max(1, fits - 1)).join('').trimEnd() + '…' };
}


/** Valores ya formateados de cada casilla, en el orden de SCOREBOARD_TILES. */
function tileValues(stats) {
  if (stats === null || typeof stats !== 'object') throw new TypeError('renderScoreboard: falta ProfileStats');
  const lang = stats.topLanguage;
  if (lang !== null && (typeof lang !== 'string' || !lang.trim())) {
    throw new TypeError('renderScoreboard: topLanguage debe ser un nombre o null');
  }
  return [
    formatNumber(stats.repositories),
    formatNumber(stats.commitsLastYear),
    // Assists siempre = PRs + issues + revisiones (spec: suma de las tres cifras de la tarjeta de stats).
    formatNumber(stats.prs + stats.issues + stats.reviews),
    lang ?? NO_LANGUAGE,
  ];
}

// --- Iconos de casilla (caja 20 × 20, trazo del color del equipo) -------------

const ICONS = {
  // Balón de Rocket League: círculo con hexágono central.
  Goals: (c) =>
    `<circle cx="10" cy="10" r="8.5" fill="none" stroke="${c}" stroke-width="1.6"/>` +
    `<path d="M10 5.6l3.8 2.2v4.4L10 14.4l-3.8-2.2V7.8zM10 1.5v4.1M17.4 7.3l-3.6.5M2.6 7.3l3.6.5M14.6 17l-.8-4.8M5.4 17l.8-4.8" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>`,
  // Escudo de parada.
  Saves: (c) =>
    `<path d="M10 1.5l7 2.6v5.2c0 4.4-3 7.7-7 9.2-4-1.5-7-4.8-7-9.2V4.1z" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M6.6 10l2.4 2.4 4.4-4.6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Pase: dos chevrones.
  Assists: (c) =>
    `<path d="M3 4.5L8.5 10 3 15.5M10 4.5l5.5 5.5-5.5 5.5" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Estrella de MVP.
  MVP: (c) =>
    `<path d="M10 1.8l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" fill="${c}" fill-opacity=".18" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`,
};

// --- Geometría ------------------------------------------------------------------

const GAP = 16;
const TILE_W = (W - 2 * 24 - GAP) / 2; // 208
const TILE_H = 112;
const COL_X = [24, 24 + TILE_W + GAP];
const ROW_Y = [100, 100 + TILE_H + 14];
const VALUE_MAX_W = TILE_W - 32;

function tile({ title, label, team }, value, index) {
  const col = team === 'blue' ? 0 : 1;
  const row = index % 2;
  const x = COL_X[col];
  const y = ROW_Y[row];
  const c = PALETTE[team];
  const tx = x + 16;
  const isLang = title === 'MVP';
  const fitted = isLang ? fitText(value, VALUE_MAX_W, 36, 14) : { size: 36, text: value };
  // La franja del equipo va en el lado exterior (como los paneles laterales del marcador de RL).
  const stripeX = col === 0 ? x : x + TILE_W - 4;
  return (
    `<g>` +
    `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="10" fill="url(#t${team[0]})" stroke="${c}" stroke-opacity=".45" stroke-width="1.2"/>` +
    `<rect class="pulse" x="${stripeX}" y="${y + 14}" width="4" height="${TILE_H - 28}" rx="2" fill="${c}" filter="url(#gl)"/>` +
    `<path d="M${x + 10} ${y}H${x + 70}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<g transform="translate(${x + TILE_W - 36} ${y + 14})">${ICONS[title](c)}</g>` +
    `<text x="${tx}" y="${y + 30}" font-family="${FONT}" font-size="15" font-weight="800" letter-spacing="2" fill="${c}">${escapeXml(title)}</text>` +
    `<text class="val" x="${tx}" y="${y + 74}" font-family="${FONT}" font-size="${fitted.size}" font-weight="800" fill="${PALETTE.text}" filter="url(#v${team[0]})">${escapeXml(fitted.text)}</text>` +
    `<text x="${tx}" y="${y + 98}" font-family="${FONT}" font-size="12.5" fill="${PALETTE.text}">${escapeXml(label)}</text>` +
    `</g>`
  );
}

/** Reloj central con alas de equipo (cabecera del marcador de RL). */
function hud() {
  const { bg, blue, orange, text } = PALETTE;
  const cx = W / 2;
  return (
    // Alas: azul a la izquierda, naranja a la derecha.
    `<path d="M24 26H${cx - 78}L${cx - 92} 70H38Q24 70 24 56Z" fill="url(#wb)" stroke="${blue}" stroke-opacity=".6" stroke-width="1.2"/>` +
    `<path d="M${W - 24} 26H${cx + 78}L${cx + 92} 70H${W - 38}Q${W - 24} 70 ${W - 24} 56Z" fill="url(#wo)" stroke="${orange}" stroke-opacity=".6" stroke-width="1.2"/>` +
    `<text x="42" y="54" font-family="${FONT}" font-size="14" font-weight="800" letter-spacing="2" fill="${text}">BLUE</text>` +
    `<text x="${W - 42}" y="54" text-anchor="end" font-family="${FONT}" font-size="14" font-weight="800" letter-spacing="2" fill="${text}">ORANGE</text>` +
    `<path class="chev" d="M128 40l8 8-8 8M140 40l8 8-8 8" fill="none" stroke="${blue}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path class="chev r" d="M${W - 128} 40l-8 8 8 8M${W - 140} 40l-8 8 8 8" fill="none" stroke="${orange}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    // Caja del reloj.
    `<path d="M${cx - 84} 14H${cx + 84}L${cx + 70} 82H${cx - 70}Z" fill="${bg}" stroke="url(#eg)" stroke-width="1.6"/>` +
    `<path d="M${cx - 66} 78H${cx + 66}" stroke="url(#eg)" stroke-width="3" stroke-linecap="round" filter="url(#gl)"/>` +
    `<text x="${cx}" y="34" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="3.5" fill="${text}">SCOREBOARD</text>` +
    `<text x="${cx}" y="68" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="800" letter-spacing="1" fill="${text}">5<tspan class="colon" fill="${text}">:</tspan>00</text>`
  );
}

/** Balón de Rocket League girando entre las dos columnas. */
function ball() {
  const cx = W / 2;
  const cy = ROW_Y[1] - 7;
  const { text, boost } = PALETTE;
  return (
    `<circle cx="${cx}" cy="${cy}" r="17" fill="${boost}" filter="url(#bl)" class="pulse"/>` +
    `<g transform="translate(${cx - 12} ${cy - 12})"><g class="spin">` +
    `<circle cx="12" cy="12" r="11" fill="${PALETTE.bg}" stroke="${text}" stroke-width="1.6"/>` +
    `<path d="M12 7.2l4.2 2.4v4.8L12 16.8l-4.2-2.4V9.6zM12 1v6.2M21.6 8.4l-5.4 1.2M2.4 8.4l5.4 1.2M18.4 20.6l-2.2-6.2M5.6 20.6l2.2-6.2" fill="none" stroke="${text}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `</g></g>`
  );
}

/** Barra de boost decorativa (sin cifra: no es un dato del perfil). */
function boostBar() {
  const y = H - 34;
  const x = 92;
  const w = W - x - 24;
  return (
    `<text x="24" y="${y + 9}" font-family="${FONT}" font-size="12" font-weight="800" letter-spacing="2.5" fill="${PALETTE.boost}">BOOST</text>` +
    `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="${PALETTE.boost}" fill-opacity=".14"/>` +
    `<rect class="meter" x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="url(#bm)" filter="url(#gl)"/>` +
    `<path d="M${x + w * 0.25} ${y}v10M${x + w * 0.5} ${y}v10M${x + w * 0.75} ${y}v10" stroke="${PALETTE.bg}" stroke-width="2"/>`
  );
}

/** Campo de fondo: mitades tintadas por equipo, línea y círculo central. */
function pitch() {
  const { blue, orange, text } = PALETTE;
  const cx = W / 2;
  return (
    `<rect width="${W / 2}" height="${H}" fill="url(#hb)"/>` +
    `<rect x="${W / 2}" width="${W / 2}" height="${H}" fill="url(#ho)"/>` +
    `<path d="M${cx} 90V${H - 48}" stroke="${text}" stroke-opacity=".12" stroke-width="1.5" stroke-dasharray="6 6"/>` +
    `<circle cx="${cx}" cy="${ROW_Y[1] - 7}" r="58" fill="none" stroke="${text}" stroke-opacity=".08" stroke-width="1.5"/>` +
    `<path d="M0 ${H * 0.35}h10v${H * 0.3}h-10" fill="none" stroke="${blue}" stroke-opacity=".35" stroke-width="2"/>` +
    `<path d="M${W} ${H * 0.35}h-10v${H * 0.3}h10" fill="none" stroke="${orange}" stroke-opacity=".35" stroke-width="2"/>` +
    `<rect class="sheen" x="0" y="-40" width="140" height="${H + 80}" fill="url(#sh)" transform="skewX(-18)"/>`
  );
}

const glow = (id, color, dev, op) =>
  `<filter id="${id}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="${dev}" result="b"/><feFlood flood-color="${color}" flood-opacity="${op}"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

function defs() {
  const { blue, orange, boost, text } = PALETTE;
  const lin = (id, stops, attrs = 'x1="0" x2="1"') =>
    `<linearGradient id="${id}" ${attrs}>${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
  return (
    `<defs>` +
    lin('eg', [[0, blue], [0.5, boost], [1, orange]]) +
    lin('bm', [[0, blue], [0.5, boost], [1, orange]]) +
    lin('hb', [[0, blue, 0.16], [1, blue, 0]]) +
    lin('ho', [[0, orange, 0], [1, orange, 0.16]]) +
    lin('wb', [[0, blue, 0.32], [1, blue, 0.06]]) +
    lin('wo', [[0, orange, 0.06], [1, orange, 0.32]]) +
    lin('tb', [[0, blue, 0.14], [1, blue, 0.03]], 'x1="0" y1="0" x2="0" y2="1"') +
    lin('to', [[0, orange, 0.14], [1, orange, 0.03]], 'x1="0" y1="0" x2="0" y2="1"') +
    lin('sh', [[0, text, 0], [0.5, text, 0.06], [1, text, 0]]) +
    `<clipPath id="cp"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>` +
    glow('vb', blue, 6, 0.85) +
    glow('vo', orange, 6, 0.85) +
    `<filter id="gl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>` +
    `</defs>`
  );
}

const STYLE = [
  '.run{stroke-dasharray:12 38;animation:run 7s linear infinite}',
  '@keyframes run{to{stroke-dashoffset:-100}}',
  '.sheen{animation:sheen 9s ease-in-out infinite}',
  '@keyframes sheen{0%,60%{transform:translateX(-260px)}100%{transform:translateX(760px)}}',
  '.meter{transform-origin:92px 0;animation:meter 6s ease-in-out infinite alternate}',
  '@keyframes meter{from{transform:scaleX(.25)}to{transform:scaleX(1)}}',
  '.pulse{animation:pulse 3s ease-in-out infinite}',
  '@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}',
  '.colon{animation:colon 2s ease-in-out infinite}',
  '@keyframes colon{0%,100%{opacity:1}50%{opacity:.3}}',
  '.val{animation:val 4s ease-in-out infinite}',
  '@keyframes val{0%,100%{opacity:.9}50%{opacity:1}}',
  '.spin{transform-box:fill-box;transform-origin:center;animation:spin 8s linear infinite}',
  '@keyframes spin{to{transform:rotate(360deg)}}',
  '.chev{animation:chev 2.4s ease-in-out infinite}',
  '.chev.r{animation-name:chevr}',
  '@keyframes chev{0%,100%{transform:translateX(0);opacity:.6}50%{transform:translateX(5px);opacity:1}}',
  '@keyframes chevr{0%,100%{transform:translateX(0);opacity:.6}50%{transform:translateX(-5px);opacity:1}}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
].join('');

/**
 * @param {import('../lib/stats.mjs').ProfileStats} stats salida de buildProfileStats
 * @returns {string} SVG del marcador (una sola línea)
 */
export function renderScoreboard(stats) {
  const values = tileValues(stats);
  const title = scoreboardAlt(stats); // mismo texto que el alt del README (RF-65, RNF-7)

  const body =
    defs() +
    `<rect class="bg" width="${W}" height="${H}" rx="${R}" fill="${PALETTE.bg}"/>` +
    `<g clip-path="url(#cp)">${pitch()}</g>` +
    hud() +
    SCOREBOARD_TILES.map((t, i) => tile(t, values[i], i)).join('') +
    ball() +
    boostBar() +
    `<rect class="edge" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" fill="none" stroke="url(#eg)" stroke-opacity=".7" stroke-width="1.5"/>` +
    `<rect class="run" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" pathLength="100" fill="none" stroke="url(#eg)" stroke-width="2.5" stroke-linecap="round" filter="url(#gl)"/>`;

  return svgDoc({ width: W, height: H, title, style: STYLE, body });
}

export const SCOREBOARD_SIZE = Object.freeze({ width: W, height: H });
