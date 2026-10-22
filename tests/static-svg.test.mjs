// T2: banner claro/oscuro, separador y onda del footer (RF-2 a RF-6, RF-49, RNF-3 a RNF-5, RNF-8, RNF-9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderBanner, BANNER_NAME, BANNER_SUBTITLE } from '../scripts/render/banner.mjs';
import { renderDivider } from '../scripts/render/divider.mjs';
import { renderFooterWave } from '../scripts/render/footer.mjs';
import { buildStatic } from '../scripts/build-static.mjs';
import { PALETTE, GITHUB_BG, contrastRatio } from '../scripts/lib/palette.mjs';
import {
  assertSvgRules, animationDurations, externalProblems, offPaletteColors, visibleText, textFills,
} from './helpers/svg-rules.mjs';

const NAME = 'Luis Ángel Jose Da Silva';
const SUBTITLE = 'Software Developer · Rocket League Creator';
const STATIC_DIR = fileURLToPath(new URL('../assets/static/', import.meta.url));

// --- Helper de reglas (para que un fallo del helper no oculte un fallo real) ---

test('svg-rules: detecta duraciones cortas, recursos externos y colores fuera de paleta', () => {
  assert.deepEqual(animationDurations('a{animation:x 0.5s linear infinite}'), [0.5]);
  assert.deepEqual(animationDurations('a{animation:x 3s ease 200ms infinite, y 1200ms}'), [3, 1.2]);
  assert.deepEqual(animationDurations('<animate dur="2s"/>'), [2]);
  assert.deepEqual(externalProblems('<use href="#a"/><rect fill="url(#g)"/>'), []);
  assert.equal(externalProblems('<image href="https://x/y.png"/>').length, 2);
  assert.ok(externalProblems('<style>@import url(https://fonts.x/css);</style>').length >= 2);
  assert.deepEqual(offPaletteColors('<rect fill="#00D4FF" stroke="#ff0000"/>'), ['#ff0000']);
  assert.equal(visibleText('<text>a<tspan>b &amp; c</tspan></text>'), 'ab & c');
  assert.deepEqual(textFills('<text fill="#E6F1FF"><tspan fill="#00d4ff">x</tspan></text><text>y</text>'), ['#e6f1ff', '#00d4ff', null]);
});

// --- Banner (RF-3 a RF-6) ---

test('el banner exporta el nombre y el subtítulo exactos de RF-4', () => {
  assert.equal(BANNER_NAME, NAME);
  assert.equal(BANNER_SUBTITLE, SUBTITLE);
});

for (const theme of ['dark', 'light']) {
  test(`banner ${theme}: reglas de SVG (XML, viewBox, title, sin externos, < 100 KB, animación >= 1 s)`, () => {
    assertSvgRules(renderBanner(theme), `banner-${theme}`, { animated: true });
  });

  test(`banner ${theme}: nombre y subtítulo visibles y en el <title> (RF-4, RNF-7)`, () => {
    const svg = renderBanner(theme);
    const text = visibleText(svg);
    assert.ok(text.includes(NAME), 'nombre visible');
    assert.ok(text.replace(/\s+/g, ' ').includes(SUBTITLE), 'subtítulo visible');
    const title = /<title>([^<]*)<\/title>/.exec(svg)[1];
    assert.ok(title.includes(NAME), 'nombre en el title');
    assert.ok(title.includes('Software Developer') && title.includes('Rocket League Creator'), 'rol en el title');
  });

  test(`banner ${theme}: campo de Rocket League en perspectiva con líneas neón (RF-3)`, () => {
    const svg = renderBanner(theme);
    assert.match(svg, /<g class="field"/, 'grupo del campo');
    const field = /<g class="field"[\s\S]*?<\/g><!--\/field-->/.exec(svg)?.[0] ?? '';
    assert.ok(field.includes(PALETTE.blue) && field.includes(PALETTE.orange), 'líneas en azul y naranja');
    // perspectiva: el borde lejano del campo es más corto que el cercano
    const m = /data-far="([\d.]+)" data-near="([\d.]+)"/.exec(svg);
    assert.ok(m, 'declara los anchos lejano y cercano');
    assert.ok(Number(m[1]) < Number(m[2]), 'el borde lejano es más estrecho');
  });

  test(`banner ${theme}: brillo pulsante en el nombre (RF-4, RNF-9)`, () => {
    const svg = renderBanner(theme);
    assert.match(svg, /class="glow"/, 'capa de brillo');
    const anim = /\.glow\s*\{[^}]*animation\s*:\s*([^;}]+)/.exec(svg);
    assert.ok(anim, 'el brillo está animado');
    assert.match(anim[1], /infinite/);
  });

  test(`banner ${theme}: partículas de boost animadas en #c04bff (RF-5)`, () => {
    const svg = renderBanner(theme);
    const particles = svg.match(/<circle\b[^>]*class="p[^"]*"[^>]*fill="#c04bff"|<circle\b[^>]*fill="#c04bff"[^>]*class="p[^"]*"/g) ?? [];
    assert.ok(particles.length >= 8, `partículas: ${particles.length}`);
    assert.match(svg, /\.p\d*\s*\{[^}]*animation/, 'las partículas se animan');
  });
}

test('banner oscuro: fondo opaco #0a0e1a y texto con contraste >= 4.5 (RNF-5)', () => {
  const svg = renderBanner('dark');
  assert.match(svg, /<rect\b[^>]*class="bg"[^>]*fill="#0a0e1a"/);
  const fills = textFills(svg);
  assert.ok(fills.length > 0);
  assert.ok(!fills.includes(null), 'todos los <text> declaran fill');
  for (const f of fills) assert.ok(contrastRatio(f, PALETTE.bg) >= 4.5, `${f} sobre ${PALETTE.bg}`);
});

test('banner claro: el texto usa #0a0e1a y el neón no se usa como texto (RNF-5)', () => {
  const svg = renderBanner('light');
  const fills = textFills(svg);
  assert.ok(fills.length > 0);
  for (const f of fills) assert.equal(f, PALETTE.bg, `texto en ${f}`);
  assert.ok(contrastRatio(PALETTE.bg, GITHUB_BG.light) >= 4.5);
  assert.doesNotMatch(svg, /class="bg"[^>]*fill="#0a0e1a"/, 'sin fondo oscuro opaco en la variante clara');
});

test('renderBanner rechaza un tema desconocido', () => {
  assert.throws(() => renderBanner('sepia'), TypeError);
});

// --- Separador (RF-2) y onda del footer (RF-49) ---

test('separador: reglas de SVG y animado, sin texto', () => {
  const svg = renderDivider();
  assertSvgRules(svg, 'divider', { animated: true });
  assert.equal(visibleText(svg), '');
  assert.ok(svg.includes(PALETTE.blue) && svg.includes(PALETTE.orange), 'en la paleta neón');
});

test('onda del footer: reglas de SVG, animada, sin texto', () => {
  const svg = renderFooterWave();
  assertSvgRules(svg, 'footer-wave', { animated: true });
  assert.equal(visibleText(svg), '');
  assert.ok((svg.match(/<path\b[^>]*class="w\d"/g) ?? []).length >= 2, 'al menos dos ondas');
});

// --- build-static.mjs ---

const EXPECTED = ['banner-dark.svg', 'banner-light.svg', 'divider.svg', 'footer-wave.svg'];

test('buildStatic devuelve las 4 piezas de T2 minificadas y válidas', () => {
  const files = buildStatic();
  for (const name of EXPECTED) {
    assert.ok(name in files, `falta ${name}`);
    assertSvgRules(files[name], name, { animated: true });
  }
});

test('assets/static/ contiene las piezas generadas y están al día con buildStatic', () => {
  const files = buildStatic();
  for (const name of EXPECTED) {
    const path = STATIC_DIR + name;
    assert.ok(existsSync(path), `falta ${path}: ejecuta node scripts/build-static.mjs`);
    assert.equal(readFileSync(path, 'utf8'), files[name], `${name} desactualizado: ejecuta node scripts/build-static.mjs`);
  }
});
