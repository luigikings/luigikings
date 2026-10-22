// Botón neón de contacto (RF-47). Fondo opaco #0a0e1a con borde neón: una sola variante (RNF-5).
// Los iconos son glifos simplificados dibujados en la paleta (no logotipos de marca a color).
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc, escapeXml } from '../lib/svg.mjs';

const W = 220;
const H = 64;
const R = 14;
const FONT = "'Segoe UI', Verdana, sans-serif";
const NEONS = new Set([PALETTE.blue, PALETTE.orange, PALETTE.boost]);

/** Glifos en una caja de 24 × 24. */
const ICONS = {
  linkedin: (a, bg) =>
    `<rect width="24" height="24" rx="4" fill="${a}"/>` +
    `<rect x="4.4" y="9.4" width="3.3" height="10.2" fill="${bg}"/><circle cx="6.05" cy="5.9" r="1.95" fill="${bg}"/>` +
    `<path d="M10 9.4h3.1v1.4c.5-.9 1.6-1.7 3.1-1.7 2.6 0 3.4 1.6 3.4 4.2v6.3h-3.2v-5.5c0-1.3-.3-2.3-1.6-2.3s-1.9 1-1.9 2.3v5.5H10z" fill="${bg}"/>`,
  youtube: (a, bg) =>
    `<rect y="3" width="24" height="18" rx="5" fill="${a}"/><path d="M9.8 7.9v8.2l6.8-4.1z" fill="${bg}"/>`,
  gmail: (a) =>
    `<rect x="1" y="4" width="22" height="16" rx="2.5" fill="none" stroke="${a}" stroke-width="2"/>` +
    `<path d="M2.5 6.5l9.5 7 9.5-7" fill="none" stroke="${a}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
};

export const CONTACT_ICONS = Object.freeze(Object.keys(ICONS));

const STYLE = [
  '.run{stroke-dasharray:16 84;animation:run 5s linear infinite}',
  '@keyframes run{to{stroke-dashoffset:-100}}',
  '.ico{animation:pulse 3s ease-in-out infinite}',
  '@keyframes pulse{0%,100%{opacity:.8}50%{opacity:1}}',
  '.halo{animation:halo 3s ease-in-out infinite}',
  '@keyframes halo{0%,100%{opacity:.2}50%{opacity:.55}}',
  '.go{animation:go 2.4s ease-in-out infinite}',
  '@keyframes go{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
].join('');

/**
 * @param {{label: string, icon: 'linkedin'|'youtube'|'gmail', accent: string}} contact
 * @returns {string} SVG del botón
 */
export function renderContactButton({ label, icon, accent }) {
  if (typeof label !== 'string' || !label.trim()) throw new TypeError('renderContactButton: falta label');
  if (!NEONS.has(accent)) throw new TypeError(`renderContactButton: acento fuera de la paleta (${accent})`);
  if (!Object.hasOwn(ICONS, icon)) throw new TypeError(`renderContactButton: icono desconocido (${icon})`);
  const { bg, text, boost } = PALETTE;
  const cy = H / 2;

  const body =
    `<defs>` +
    `<radialGradient id="ag" cx=".12" cy=".5" r=".6"><stop offset="0" stop-color="${accent}" stop-opacity=".28"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ul" x1="0" x2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${boost}" stop-opacity="0"/></linearGradient>` +
    `<filter id="gl" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>` +
    `</defs>` +
    `<rect class="bg" width="${W}" height="${H}" rx="${R}" fill="${bg}"/>` +
    `<rect width="${W}" height="${H}" rx="${R}" fill="url(#ag)"/>` +
    `<circle class="halo" cx="34" cy="${cy}" r="16" fill="${accent}" filter="url(#bl)"/>` +
    `<g class="ico" transform="translate(22 ${cy - 12})">${ICONS[icon](accent, bg)}</g>` +
    `<text x="62" y="${cy + 7}" font-family="${FONT}" font-size="20" font-weight="700" letter-spacing=".5" fill="${text}">${escapeXml(label)}</text>` +
    `<rect x="62" y="${cy + 14}" width="56" height="2" rx="1" fill="url(#ul)"/>` +
    `<path class="go" d="M${W - 30} ${cy - 6}L${W - 24} ${cy}L${W - 30} ${cy + 6}" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<rect class="edge" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" fill="none" stroke="${accent}" stroke-opacity=".55" stroke-width="1.5"/>` +
    `<rect class="run" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" pathLength="100" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" filter="url(#gl)"/>`;

  return svgDoc({ width: W, height: H, title: `${label} contact button`, style: STYLE, body });
}
