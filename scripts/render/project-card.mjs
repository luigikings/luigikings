// Tarjeta neón de proyecto (RF-19, RF-20). Fondo opaco #0a0e1a con borde neón, así que tiene
// una sola variante válida en tema claro y oscuro (RNF-5). Función pura y determinista.
// Estética de Rocket League: malla hexagonal de portería, luz que recorre el borde,
// barra de boost que se llena y flecha de "ir" que empuja hacia la derecha.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc, escapeXml } from '../lib/svg.mjs';

const W = 440;
const H = 200;
const R = 16;
const PAD = 28;
const FONT = "'Segoe UI', Verdana, sans-serif";

/** Máximo de caracteres por línea de la descripción (16 px; calculado para Verdana, la fuente más ancha de la pila). */
export const DESC_MAX_CHARS = 40;
const DESC_MAX_LINES = 3;
const NAME_MAX_CHARS = 24;

const NEONS = new Set([PALETTE.blue, PALETTE.orange, PALETTE.boost]);
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Parte un texto en líneas de como mucho `max` caracteres, cortando solo entre palabras.
 * Una palabra más larga que `max` queda sola en su línea (nunca se parte).
 */
export function wrapText(text, max) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Malla hexagonal (red de portería) en la zona derecha, desvanecida hacia la izquierda con un degradado. */
function hexMesh() {
  const s = 13; // radio del hexágono (vértices en punta arriba)
  const dx = Math.sqrt(3) * s;
  const dy = 1.5 * s;
  let d = '';
  for (let row = -1; row * dy < H + s; row++) {
    const off = row % 2 ? dx / 2 : 0;
    for (let x = 250 + off; x < W + dx; x += dx) {
      const y = row * dy;
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        pts.push(`${r1(x + s * Math.cos(a))} ${r1(y + s * Math.sin(a))}`);
      }
      d += `M${pts.join('L')}Z`;
    }
  }
  return `<path d="${d}" fill="none" stroke="url(#hf)" stroke-width="1"/>`;
}

/** Nombre del proyecto; un sufijo entre paréntesis va más pequeño en el mismo <text>. */
function nameText(name, accent) {
  const m = /^(.*?)\s+(\(.*\))$/.exec(name);
  const [main, sub] = m ? [m[1], m[2]] : [name, ''];
  if (main.length > NAME_MAX_CHARS) throw new RangeError(`renderProjectCard: nombre demasiado largo (${main})`);
  return (
    `<text x="${PAD}" y="56" font-family="${FONT}" font-size="26" font-weight="800" letter-spacing=".5" fill="${accent}" filter="url(#ng)">` +
    escapeXml(main) +
    (sub ? `<tspan font-size="15" font-weight="600" letter-spacing="0" fill="${PALETTE.text}"> ${escapeXml(sub)}</tspan>` : '') +
    `</text>`
  );
}

const STYLE = [
  '.run{stroke-dasharray:14 86;animation:run 6s linear infinite}',
  '@keyframes run{to{stroke-dashoffset:-100}}',
  '.sheen{animation:sheen 8s ease-in-out infinite}',
  '@keyframes sheen{0%,55%{transform:translateX(-220px)}100%{transform:translateX(700px)}}',
  '.meter{transform-origin:28px 0;animation:meter 5s ease-in-out infinite alternate}',
  '@keyframes meter{from{transform:scaleX(.18)}to{transform:scaleX(1)}}',
  '.go{animation:go 2.4s ease-in-out infinite}',
  '@keyframes go{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}',
  '.pulse{animation:pulse 3s ease-in-out infinite}',
  '@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.9}}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
].join('');

/**
 * @param {{name: string, description: string, accent: string}} project
 * @returns {string} SVG de la tarjeta
 */
export function renderProjectCard({ name, description, accent }) {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('renderProjectCard: falta name');
  if (typeof description !== 'string' || !description.trim()) throw new TypeError('renderProjectCard: falta description');
  if (!NEONS.has(accent)) throw new TypeError(`renderProjectCard: acento fuera de la paleta (${accent})`);
  const lines = wrapText(description, DESC_MAX_CHARS);
  if (lines.length > DESC_MAX_LINES || lines.some((l) => l.length > DESC_MAX_CHARS)) {
    throw new RangeError(`renderProjectCard: la descripción de ${name} no cabe en ${DESC_MAX_LINES} líneas`);
  }
  const { bg, text, boost } = PALETTE;

  const defs =
    `<defs>` +
    `<radialGradient id="ag" cx="0" cy="0" r="1"><stop offset="0" stop-color="${accent}" stop-opacity=".3"/><stop offset=".55" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="bg2" cx="1" cy="1" r=".9"><stop offset="0" stop-color="${boost}" stop-opacity=".16"/><stop offset="1" stop-color="${boost}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="hf" gradientUnits="userSpaceOnUse" x1="250" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset="1" stop-color="${accent}" stop-opacity=".3"/></linearGradient>` +
    `<linearGradient id="ul" x1="0" x2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${boost}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="mt" x1="0" x2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${boost}"/></linearGradient>` +
    `<linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="${text}" stop-opacity="0"/><stop offset=".5" stop-color="${text}" stop-opacity=".07"/><stop offset="1" stop-color="${text}" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="cp"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>` +
    `<filter id="ng" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feFlood flood-color="${accent}" flood-opacity=".75"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="gl" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>`;

  const desc = lines
    .map((l, i) => `<text x="${PAD}" y="${102 + i * 23}" font-family="${FONT}" font-size="16" fill="${text}">${escapeXml(l)}</text>`)
    .join('');

  const cx = W - 38;
  const cy = H - 30;
  const body =
    defs +
    `<rect class="bg" width="${W}" height="${H}" rx="${R}" fill="${bg}"/>` +
    `<g clip-path="url(#cp)">` +
    `<rect width="${W}" height="${H}" fill="url(#ag)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#bg2)"/>` +
    hexMesh() +
    `<rect class="sheen" x="0" y="-40" width="120" height="${H + 80}" fill="url(#sh)" transform="skewX(-20)"/>` +
    `<rect class="pulse" x="0" y="26" width="4" height="${H - 52}" rx="2" fill="${accent}" filter="url(#gl)"/>` +
    `</g>` +
    nameText(name, accent) +
    `<rect x="${PAD}" y="68" width="88" height="3" rx="1.5" fill="url(#ul)"/>` +
    desc +
    // Barra de boost: pista tenue y relleno que sube y baja despacio.
    `<rect x="${PAD}" y="${H - 31}" width="300" height="4" rx="2" fill="${accent}" fill-opacity=".15"/>` +
    `<rect class="meter" x="${PAD}" y="${H - 31}" width="300" height="4" rx="2" fill="url(#mt)" filter="url(#gl)"/>` +
    // Botón "ir": flecha dentro de un círculo neón.
    `<circle cx="${cx}" cy="${cy}" r="15" fill="${accent}" fill-opacity=".12" stroke="${accent}" stroke-width="1.5"/>` +
    `<path class="go" d="M${cx - 6} ${cy}H${cx + 5}M${cx} ${cy - 5}L${cx + 5} ${cy}L${cx} ${cy + 5}" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    // Borde: línea neón fija y destello que lo recorre.
    `<rect class="edge" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" fill="none" stroke="${accent}" stroke-opacity=".5" stroke-width="1.5"/>` +
    `<rect class="run" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" pathLength="100" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" filter="url(#gl)"/>`;

  return svgDoc({
    width: W,
    height: H,
    title: `${name} — ${description}`,
    style: STYLE,
    body,
  });
}
