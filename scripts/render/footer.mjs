// Onda neón animada del footer (RF-49). Decorativa, sin texto y con una sola variante.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc } from '../lib/svg.mjs';

const W = 1200;
const H = 140;
const PERIOD = 600; // la onda se repite cada 600 px; desplazar un periodo hace el bucle continuo

/** Camino de una onda senoidal de x=0 a x=W+PERIOD, cerrado por abajo. */
function wavePath(baseY, amp, phase) {
  const pts = [];
  for (let x = 0; x <= W + PERIOD; x += 20) {
    const y = baseY + amp * Math.sin(((x / PERIOD) * 2 + phase) * Math.PI);
    pts.push(`${x} ${Math.round(y * 10) / 10}`);
  }
  return `M${pts.join('L')}L${W + PERIOD} ${H}L0 ${H}Z`;
}

function crestPath(baseY, amp, phase) {
  const pts = [];
  for (let x = 0; x <= W + PERIOD; x += 20) {
    const y = baseY + amp * Math.sin(((x / PERIOD) * 2 + phase) * Math.PI);
    pts.push(`${x} ${Math.round(y * 10) / 10}`);
  }
  return `M${pts.join('L')}`;
}

export function renderFooterWave() {
  const { blue, orange, boost } = PALETTE;
  const style = [
    '.w1{animation:flow 10s linear infinite}',
    '.w2{animation:flow 14s linear infinite reverse}',
    '.w3{animation:flow 18s linear infinite}',
    '@keyframes flow{from{transform:translateX(0)}to{transform:translateX(-600px)}}',
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
  ].join('');
  const body =
    `<defs>` +
    `<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${boost}" stop-opacity=".0"/><stop offset="1" stop-color="${boost}" stop-opacity=".25"/></linearGradient>` +
    `<filter id="gl" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>` +
    `<path class="w1" d="${wavePath(52, 16, 0)}" fill="${blue}" fill-opacity=".28"/>` +
    `<path class="w2" d="${wavePath(70, 14, 0.5)}" fill="${boost}" fill-opacity=".3"/>` +
    `<path class="w3" d="${wavePath(88, 12, 1)}" fill="${orange}" fill-opacity=".32"/>` +
    `<rect y="60" width="${W}" height="${H - 60}" fill="url(#fade)"/>` +
    `<g filter="url(#gl)" fill="none" stroke-width="2">` +
    `<path class="w1" d="${crestPath(52, 16, 0)}" stroke="${blue}"/>` +
    `<path class="w3" d="${crestPath(88, 12, 1)}" stroke="${orange}"/>` +
    `</g>`;
  return svgDoc({ width: W, height: H, title: 'Neon wave footer', style, body });
}
