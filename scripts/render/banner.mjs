// Banner de la cabecera: campo de Rocket League en perspectiva con líneas neón,
// nombre con brillo pulsante, subtítulo y partículas de boost (RF-3 a RF-6).
// Función pura: mismo tema → mismo SVG (las partículas usan una semilla fija).
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc, escapeXml } from '../lib/svg.mjs';

export const BANNER_NAME = 'Luis Ángel Jose Da Silva';
export const BANNER_SUBTITLE = 'Software Developer · Rocket League Creator';

const W = 1200;
const H = 400;
const FONT = "'Segoe UI', Verdana, sans-serif";

// --- Proyección en perspectiva ---------------------------------------------
// Mundo: X = largo del campo (-1 portería azul .. 1 portería naranja), Z = profundidad
// (Z_NEAR banda cercana .. Z_FAR banda lejana), Y = altura. Cámara en el centro.
const F = 570; // focal: media anchura en pantalla de la banda cercana
const Z_NEAR = 1;
const Z_FAR = 2.1;
const HORIZON = 86.5; // y del punto de fuga
const CAM_H = 305.5 / F; // altura de cámara: banda cercana en y≈392, lejana en y≈232
const Z_MID = (Z_NEAR + Z_FAR) / 2;

const r1 = (v) => Math.round(v * 10) / 10;

function project(x, z, y = 0) {
  return [r1(W / 2 + (F * x) / z), r1(HORIZON + (F * (CAM_H - y)) / z)];
}

const pt = ([x, y]) => `${x} ${y}`;
const line = (points) => 'M' + points.map(pt).join('L');
const poly = (points) => line(points) + 'Z';

/** Contorno de un círculo del suelo proyectado (sale una elipse en perspectiva). */
function groundCircle(cx, cz, radius, steps = 40) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(project(cx + radius * Math.cos(a), cz + radius * Math.sin(a)));
  }
  return poly(pts);
}

// Generador pseudoaleatorio con semilla (mulberry32) para que el SVG sea determinista.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Piezas ------------------------------------------------------------------

function field(theme) {
  const dark = theme === 'dark';
  const cx = 0.06; // chaflán de las esquinas (las esquinas del campo de RL son redondeadas)
  const cz = 0.12;
  const half = (s) => [
    project(0, Z_FAR),
    project(s * (1 - cx), Z_FAR),
    project(s, Z_FAR - cz),
    project(s, Z_NEAR + cz),
    project(s * (1 - cx), Z_NEAR),
    project(0, Z_NEAR),
  ];
  const outline = [...half(-1), ...half(1).reverse()];
  const farW = r1((2 * F) / Z_FAR);
  const nearW = r1(2 * F);

  // Carriles que convergen hacia el punto de fuga, con guiones en movimiento.
  const lanes = [];
  for (let i = 1; i < 10; i++) {
    const x = -0.9 + i * 0.18;
    if (Math.abs(x) < 0.01) continue;
    lanes.push(line([project(x, Z_FAR), project(x, Z_NEAR)]));
  }
  const depthLines = [1.25, 1.55, 1.85].map((z) => line([project(-1, z), project(1, z)]));

  // Áreas y porterías de cada equipo.
  const box = (s) => poly([project(s, 1.32), project(s * 0.84, 1.32), project(s * 0.84, 1.78), project(s, 1.78)]);
  const goal = (s) => {
    const gx = s * 1.09;
    const [a, b] = [1.42, 1.68];
    const gy = 0.13;
    return {
      net: poly([project(s, a, gy), project(gx, a, gy), project(gx, b, gy), project(s, b, gy)]) +
        poly([project(gx, a), project(gx, b), project(gx, b, gy), project(gx, a, gy)]),
      frame: line([project(s, a), project(s, a, gy), project(s, b, gy), project(s, b)]) +
        line([project(s, a, gy), project(gx, a, gy), project(gx, b, gy), project(s, b, gy)]) +
        line([project(gx, a), project(gx, a, gy)]) + line([project(gx, b), project(gx, b, gy)]),
    };
  };
  const gl = goal(-1);
  const gr = goal(1);

  const pads = [[-0.88, Z_NEAR + 0.07], [0.88, Z_NEAR + 0.07], [-0.88, Z_FAR - 0.07], [0.88, Z_FAR - 0.07], [0, Z_NEAR + 0.06], [0, Z_FAR - 0.06]]
    .map(([x, z], i) => `<path class="pad" style="animation-delay:-${(i * 0.43).toFixed(2)}s" d="${groundCircle(x, z, 0.035, 16)}" fill="${PALETTE.orange}"/>`)
    .join('');

  const laneColor = dark ? PALETTE.text : PALETTE.blue;
  return (
    `<g class="field" data-far="${farW}" data-near="${nearW}">` +
    `<path d="${poly(outline)}" fill="url(#turf)"/>` +
    `<path class="lane" d="${lanes.join('')}" stroke="${laneColor}" stroke-opacity="${dark ? 0.16 : 0.35}" stroke-width="1" fill="none"/>` +
    `<path d="${depthLines.join('')}" stroke="${laneColor}" stroke-opacity="${dark ? 0.08 : 0.2}" stroke-width="1" fill="none"/>` +
    `<g filter="url(#neon)" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
    `<path d="${gl.net}" fill="${PALETTE.blue}" fill-opacity=".14" stroke="none"/>` +
    `<path d="${gr.net}" fill="${PALETTE.orange}" fill-opacity=".14" stroke="none"/>` +
    `<path d="${line(half(-1))}${box(-1)}${gl.frame}" stroke="${PALETTE.blue}" stroke-width="2.5"/>` +
    `<path d="${line(half(1))}${box(1)}${gr.frame}" stroke="${PALETTE.orange}" stroke-width="2.5"/>` +
    `<path d="${line([project(0, Z_FAR), project(0, Z_NEAR)])}${groundCircle(0, Z_MID, 0.2, 48)}" stroke="${PALETTE.boost}" stroke-width="2"/>` +
    `</g>` +
    pads +
    ball(theme) +
    `</g><!--/field-->`
  );
}

function ball(theme) {
  const [bx, by] = project(0, Z_MID, 0.075);
  const [, gy] = project(0, Z_MID);
  const r = r1((F * 0.042) / Z_MID);
  const dark = theme === 'dark';
  const ink = dark ? PALETTE.text : PALETTE.bg;
  return (
    `<ellipse cx="${bx}" cy="${gy}" rx="${r1(r * 1.3)}" ry="${r1(r * 0.35)}" fill="${PALETTE.boost}" fill-opacity=".35"/>` +
    `<g class="ball"><circle cx="${bx}" cy="${by}" r="${r}" fill="url(#ballfill)" stroke="${ink}" stroke-width="1.5"/>` +
    `<path d="M${r1(bx - r * 0.55)} ${r1(by - r * 0.2)}L${bx} ${r1(by - r * 0.55)}L${r1(bx + r * 0.55)} ${r1(by - r * 0.2)}L${r1(bx + r * 0.35)} ${r1(by + r * 0.45)}L${r1(bx - r * 0.35)} ${r1(by + r * 0.45)}Z" ` +
    `fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="1"/></g>`
  );
}

const PARTICLE_PATHS = [
  // [nombre, duración (s), keyframe final]
  ['b1', 5, 'translate(260px,-46px)'],
  ['b2', 6.5, 'translate(180px,-120px)'],
  ['b3', 7.5, 'translate(40px,-150px)'],
  ['b4', 4.5, 'translate(340px,-24px)'],
];

function particles() {
  const rand = rng(1337);
  const out = [];
  for (let i = 0; i < 28; i++) {
    const k = i % PARTICLE_PATHS.length;
    const [, dur] = PARTICLE_PATHS[k];
    const x = r1(90 + rand() * 860);
    const y = r1(255 + rand() * 125);
    const r = r1(1.4 + rand() * 2.4);
    const delay = (rand() * dur).toFixed(2);
    out.push(`<circle class="p p${k + 1}" style="animation-delay:-${delay}s" cx="${x}" cy="${y}" r="${r}" fill="${PALETTE.boost}"/>`);
  }
  return `<g class="boost" filter="url(#spark)">${out.join('')}</g>`;
}

function stars() {
  const rand = rng(42);
  const out = [];
  for (let i = 0; i < 34; i++) {
    out.push(`<circle cx="${r1(20 + rand() * 1160)}" cy="${r1(14 + rand() * 200)}" r="${r1(0.5 + rand() * 1.1)}"/>`);
  }
  return `<g fill="${PALETTE.text}" fill-opacity=".35">${out.join('')}</g>`;
}

function title(theme) {
  const dark = theme === 'dark';
  const ink = dark ? PALETTE.text : PALETTE.bg;
  const name =
    `<text id="nm" x="600" y="128" text-anchor="middle" font-family="${FONT}" font-size="60" font-weight="800" letter-spacing="1" fill="${ink}">` +
    `${escapeXml(BANNER_NAME)}</text>`;
  const [role, creator] = BANNER_SUBTITLE.split(' · ');
  const subtitle = dark
    ? `<text x="600" y="190" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="600" letter-spacing="2" fill="${PALETTE.text}">` +
      `<tspan fill="${PALETTE.blue}">${escapeXml(role)}</tspan><tspan> · </tspan><tspan fill="${PALETTE.orange}">${escapeXml(creator)}</tspan></text>`
    : `<text x="600" y="190" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="600" letter-spacing="2" fill="${PALETTE.bg}">` +
      `${escapeXml(BANNER_SUBTITLE)}</text>`;
  return (
    // Halo de color detrás del nombre: misma forma, solo el brillo, con pulso suave.
    `<use href="#nm" class="glow2" filter="url(#halo2)"/>` +
    `<use href="#nm" class="glow" filter="url(#halo)"/>` +
    name +
    // Barra bajo el nombre con un destello que la recorre.
    `<rect x="420" y="146" width="360" height="3" rx="1.5" fill="url(#bar)"/>` +
    `<g clip-path="url(#barclip)"><rect class="sweep" x="560" y="145" width="80" height="5" fill="url(#flash)"/></g>` +
    subtitle
  );
}

function defs(theme) {
  const dark = theme === 'dark';
  const { blue, orange, boost, text, bg } = PALETTE;
  return (
    `<defs>` +
    `<radialGradient id="gb" cx=".12" cy=".85" r=".55"><stop offset="0" stop-color="${blue}" stop-opacity="${dark ? 0.32 : 0.16}"/><stop offset="1" stop-color="${blue}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="go" cx=".88" cy=".85" r=".55"><stop offset="0" stop-color="${orange}" stop-opacity="${dark ? 0.3 : 0.16}"/><stop offset="1" stop-color="${orange}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="gm" cx=".5" cy=".3" r=".45"><stop offset="0" stop-color="${boost}" stop-opacity="${dark ? 0.22 : 0.1}"/><stop offset="1" stop-color="${boost}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="turf" x1="0" x2="1"><stop offset="0" stop-color="${blue}" stop-opacity="${dark ? 0.14 : 0.1}"/><stop offset=".5" stop-color="${boost}" stop-opacity="${dark ? 0.06 : 0.04}"/><stop offset="1" stop-color="${orange}" stop-opacity="${dark ? 0.14 : 0.1}"/></linearGradient>` +
    `<linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="${blue}" stop-opacity="0"/><stop offset=".2" stop-color="${blue}"/><stop offset=".5" stop-color="${boost}"/><stop offset=".8" stop-color="${orange}"/><stop offset="1" stop-color="${orange}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="flash" x1="0" x2="1"><stop offset="0" stop-color="${dark ? text : boost}" stop-opacity="0"/><stop offset=".5" stop-color="${dark ? text : boost}"/><stop offset="1" stop-color="${dark ? text : boost}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="${blue}"/><stop offset=".5" stop-color="${boost}"/><stop offset="1" stop-color="${orange}"/></linearGradient>` +
    `<radialGradient id="ballfill" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${text}"/><stop offset="1" stop-color="${dark ? blue : text}" stop-opacity="${dark ? 0.5 : 1}"/></radialGradient>` +
    `<clipPath id="barclip"><rect x="420" y="140" width="360" height="15"/></clipPath>` +
    `</defs>`
  );
}

// Halo: desenfoca la silueta del texto y la tiñe de neón (no cambia el color del texto).
function filters(theme) {
  const dark = theme === 'dark';
  const glow = (id, color, std, slope) =>
    `<filter id="${id}" x="-20%" y="-120%" width="140%" height="340%">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${std}" result="b"/>` +
    `<feComponentTransfer in="b" result="a"><feFuncA type="linear" slope="${slope}"/></feComponentTransfer>` +
    `<feFlood flood-color="${color}"/><feComposite in2="a" operator="in"/></filter>`;
  return (
    `<defs>` +
    glow('halo', PALETTE.blue, dark ? 7 : 6, dark ? 1.8 : 1.3) +
    glow('halo2', PALETTE.boost, dark ? 20 : 16, 1.4) +
    `<filter id="neon" x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="spark" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>`
  );
}

const STYLE = [
  '.glow{animation:pulse 3s ease-in-out infinite}',
  '.glow2{animation:pulse2 3s ease-in-out infinite}',
  '@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}',
  '@keyframes pulse2{0%,100%{opacity:.1}50%{opacity:.55}}',
  '.lane{stroke-dasharray:5 15;animation:run 2.4s linear infinite}',
  '@keyframes run{to{stroke-dashoffset:-40}}',
  '.pad{animation:pad 2.6s ease-in-out infinite}',
  '@keyframes pad{0%,100%{opacity:.35}50%{opacity:.95}}',
  '.ball{animation:bob 3.2s ease-in-out infinite}',
  '@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
  '.sweep{animation:sweep 4s ease-in-out infinite}',
  '@keyframes sweep{0%{transform:translateX(-230px)}100%{transform:translateX(230px)}}',
  '.p{opacity:0}',
  ...PARTICLE_PATHS.map(
    ([name, dur, end], i) =>
      `.p${i + 1}{animation:${name} ${dur}s linear infinite}` +
      `@keyframes ${name}{0%{transform:translate(0,0);opacity:0}15%{opacity:.95}70%{opacity:.6}100%{transform:${end};opacity:0}}`,
  ),
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.p{opacity:.6}}',
].join('');

/**
 * @param {'dark'|'light'} theme
 * @returns {string} SVG del banner
 */
export function renderBanner(theme) {
  if (theme !== 'dark' && theme !== 'light') throw new TypeError(`renderBanner: tema desconocido ${theme}`);
  const dark = theme === 'dark';
  const background = dark
    ? `<rect class="bg" width="${W}" height="${H}" rx="18" fill="${PALETTE.bg}"/>`
    : `<rect class="frame" width="${W}" height="${H}" rx="18" fill="${PALETTE.blue}" fill-opacity=".04"/>`;
  const body =
    filters(theme) +
    defs(theme) +
    background +
    `<rect width="${W}" height="${H}" rx="18" fill="url(#gb)"/>` +
    `<rect width="${W}" height="${H}" rx="18" fill="url(#go)"/>` +
    `<rect width="${W}" height="${H}" rx="18" fill="url(#gm)"/>` +
    (dark ? stars() : '') +
    field(theme) +
    particles() +
    title(theme) +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="url(#edge)" stroke-opacity="${dark ? 0.7 : 0.55}" stroke-width="2"/>`;
  return svgDoc({
    width: W,
    height: H,
    title: `${BANNER_NAME} — ${BANNER_SUBTITLE}`,
    desc: 'Neon Rocket League pitch in perspective with blue and orange goals, a pulsing glow on the name and floating boost particles.',
    style: STYLE,
    body,
  });
}
