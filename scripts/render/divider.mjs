// Separador animado entre secciones (RF-2). Decorativo, sin texto y con una sola variante:
// línea neón azul → boost → naranja con un destello que la recorre y un "boost pad" central.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc } from '../lib/svg.mjs';

const W = 1200;
const H = 24;

export function renderDivider() {
  const { blue, orange, boost } = PALETTE;
  const style = [
    '.run{animation:run 4.5s ease-in-out infinite}',
    '@keyframes run{0%{transform:translateX(-160px)}100%{transform:translateX(1200px)}}',
    '.pad{transform-origin:600px 12px;animation:pad 3s ease-in-out infinite}',
    '@keyframes pad{0%,100%{opacity:.55;transform:rotate(45deg) scale(.85)}50%{opacity:1;transform:rotate(45deg) scale(1.1)}}',
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
  ].join('');
  const body =
    `<defs>` +
    `<linearGradient id="ln" x1="0" x2="1"><stop offset="0" stop-color="${blue}" stop-opacity="0"/><stop offset=".15" stop-color="${blue}"/><stop offset=".5" stop-color="${boost}"/><stop offset=".85" stop-color="${orange}"/><stop offset="1" stop-color="${orange}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="fl" x1="0" x2="1"><stop offset="0" stop-color="${boost}" stop-opacity="0"/><stop offset=".5" stop-color="${boost}"/><stop offset="1" stop-color="${boost}" stop-opacity="0"/></linearGradient>` +
    `<filter id="gl" x="-5%" y="-200%" width="110%" height="500%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>` +
    `<g filter="url(#gl)">` +
    `<rect x="0" y="11" width="${W}" height="2" rx="1" fill="url(#ln)" fill-opacity=".8"/>` +
    `<rect class="run" x="0" y="10" width="160" height="4" rx="2" fill="url(#fl)"/>` +
    `<rect class="pad" x="594" y="6" width="12" height="12" rx="2" fill="${orange}" fill-opacity=".25" stroke="${orange}" stroke-width="1.5"/>` +
    `</g>`;
  return svgDoc({ width: W, height: H, title: 'Neon section divider', style, body });
}
