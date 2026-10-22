// T3: tarjetas de proyecto (5) y botones de contacto (3) (RF-19, RF-20, RF-47, RNF-5, RNF-7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderProjectCard, wrapText, DESC_MAX_CHARS } from '../scripts/render/project-card.mjs';
import { renderContactButton } from '../scripts/render/contact-button.mjs';
import { buildStatic, PROJECTS, CONTACTS } from '../scripts/build-static.mjs';
import { PALETTE, contrastRatio } from '../scripts/lib/palette.mjs';
import { assertSvgRules, visibleText, textFills } from './helpers/svg-rules.mjs';

const STATIC_DIR = fileURLToPath(new URL('../assets/static/', import.meta.url));

// Textos exactos de RF-20, en el orden de RF-19.
const RF20 = [
  ['Magnar WarGames', 'Game of Thrones–inspired strategy web app'],
  ['ChatarreroMetalRenova', 'Static Astro + TypeScript site for a Madrid scrap-metal business, built for speed and local SEO'],
  ['AgencyMac', 'Astro monorepo for a marketing & coding agency — public site + internal CRM'],
  ['ChefAsesoriaJ', 'Multi-page React + Vite + Tailwind marketing site for Gatrobatos, a hospitality brand'],
  ['YouTube (Rocket League content)', 'Rocket League content and tutorials to help players improve'],
];

// Destinos de RF-21 a RF-25 y RF-48 (los usa el README en T11).
const PROJECT_URLS = [
  'https://www.magnarwargames.com/',
  'https://github.com/luigikings/ChatarreroMetalRenova',
  'https://github.com/luigikings/AgencyMac',
  'https://github.com/luigikings/ChefAsesoriaJ',
  'https://youtube.com/@lk_rl',
];
const CONTACT_DATA = [
  ['LinkedIn', 'https://www.linkedin.com/in/luis-angel-da-silva-a18a13244'],
  ['YouTube', 'https://youtube.com/@lk_rl'],
  ['Gmail', 'mailto:luigidasilv@gmail.com'],
];

const NEONS = [PALETTE.blue, PALETTE.orange, PALETTE.boost];
const oneLine = (s) => s.replace(/\s+/g, ' ').trim();
const titleOf = (svg) => /<title>([^<]*)<\/title>/.exec(svg)[1].replace(/&amp;/g, '&');

/** Fondo opaco #0a0e1a que cubre todo el viewBox (una sola variante válida en ambos temas). */
function assertOpaqueDarkBackground(svg, name) {
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const bg = /<rect\b[^>]*class="bg"[^>]*>/.exec(svg)?.[0];
  assert.ok(bg, `${name}: falta el fondo class="bg"`);
  assert.match(bg, /fill="#0a0e1a"/, `${name}: el fondo no es #0a0e1a`);
  assert.doesNotMatch(bg, /(fill-)?opacity="/, `${name}: el fondo no es opaco`);
  assert.match(bg, new RegExp(`width="${w}"`), `${name}: el fondo no cubre el ancho`);
  assert.match(bg, new RegExp(`height="${h}"`), `${name}: el fondo no cubre el alto`);
}

function assertTextContrast(svg, name) {
  const fills = textFills(svg);
  assert.ok(fills.length > 0, `${name}: sin texto`);
  assert.ok(!fills.includes(null), `${name}: todos los <text> declaran fill`);
  for (const f of fills) {
    assert.ok(contrastRatio(f, PALETTE.bg) >= 4.5, `${name}: texto ${f} sobre ${PALETTE.bg} < 4.5`);
  }
}

// --- Datos (RF-19, RF-20, RF-48) ---

test('PROJECTS: 5 tarjetas en el orden de RF-19 con los textos exactos de RF-20', () => {
  assert.deepEqual(PROJECTS.map((p) => [p.name, p.description]), RF20);
  assert.deepEqual(PROJECTS.map((p) => p.url), PROJECT_URLS);
  for (const p of PROJECTS) {
    assert.match(p.file, /^project-[a-z0-9-]+\.svg$/, `nombre de archivo ${p.file}`);
    assert.ok(NEONS.includes(p.accent), `${p.name}: acento fuera de la paleta`);
  }
  assert.equal(new Set(PROJECTS.map((p) => p.file)).size, 5, 'archivos únicos');
});

test('PROJECTS: AgencyMac no se presenta como .NET (RF-27) y Magnar no enlaza a GitHub (RF-26)', () => {
  const agency = PROJECTS.find((p) => p.name === 'AgencyMac');
  assert.doesNotMatch(agency.description, /\.NET/i);
  const magnar = PROJECTS.find((p) => p.name === 'Magnar WarGames');
  assert.doesNotMatch(magnar.url, /github\.com/);
});

test('CONTACTS: LinkedIn, YouTube y Gmail con sus destinos de RF-48', () => {
  assert.deepEqual(CONTACTS.map((c) => [c.label, c.url]), CONTACT_DATA);
  for (const c of CONTACTS) {
    assert.match(c.file, /^contact-[a-z0-9-]+\.svg$/, `nombre de archivo ${c.file}`);
    assert.ok(NEONS.includes(c.accent), `${c.label}: acento fuera de la paleta`);
  }
});

// --- wrapText ---

test('wrapText: corta por palabras sin superar el máximo y sin perder texto', () => {
  assert.deepEqual(wrapText('', 10), []);
  assert.deepEqual(wrapText('short', 10), ['short']);
  assert.deepEqual(wrapText('aaa bbb ccc ddd', 7), ['aaa bbb', 'ccc ddd']);
  assert.deepEqual(wrapText('  a   b  ', 10), ['a b']);
  // una palabra más larga que el máximo queda sola en su línea, sin partirse
  assert.deepEqual(wrapText('x supercalifragilistic y', 6), ['x', 'supercalifragilistic', 'y']);
  for (const [, desc] of RF20) {
    const lines = wrapText(desc, DESC_MAX_CHARS);
    assert.equal(lines.join(' '), desc, 'no pierde texto');
    for (const l of lines) assert.ok(l.length <= DESC_MAX_CHARS, `línea demasiado larga: ${l}`);
    assert.ok(lines.length <= 3, `${desc}: más de 3 líneas`);
  }
});

// --- Tarjetas de proyecto (RF-19, RF-20, RNF-5, RNF-7) ---

for (const [name, description] of RF20) {
  const p = () => PROJECTS.find((x) => x.name === name);

  test(`tarjeta ${name}: reglas de SVG (XML, viewBox, title, sin externos, paleta, < 100 KB, animación >= 1 s)`, () => {
    assertSvgRules(renderProjectCard(p()), name, { animated: true });
  });

  test(`tarjeta ${name}: nombre y descripción exactos visibles y en el <title> (RF-20, RNF-7)`, () => {
    const svg = renderProjectCard(p());
    const texts = [...svg.matchAll(/<text\b[\s\S]*?<\/text>/g)].map((m) => oneLine(visibleText(m[0])));
    assert.ok(texts.includes(name), `nombre visible exacto en un único <text>: ${JSON.stringify(texts)}`);
    assert.ok(oneLine(visibleText(svg)).includes(description), 'descripción visible exacta');
    const title = titleOf(svg);
    assert.ok(title.includes(name), 'nombre en el title');
    assert.ok(title.includes(description), 'descripción en el title');
  });

  test(`tarjeta ${name}: fondo opaco #0a0e1a y contraste de texto >= 4.5 (RNF-5)`, () => {
    const svg = renderProjectCard(p());
    assertOpaqueDarkBackground(svg, name);
    assertTextContrast(svg, name);
  });

  test(`tarjeta ${name}: borde neón del color de acento`, () => {
    const svg = renderProjectCard(p());
    assert.match(svg, new RegExp(`<rect\\b[^>]*class="edge"[^>]*stroke="${p().accent}"`), 'borde en el acento');
  });
}

test('renderProjectCard escapa el texto (& de AgencyMac) y es determinista', () => {
  const agency = PROJECTS.find((x) => x.name === 'AgencyMac');
  const svg = renderProjectCard(agency);
  assert.ok(svg.includes('marketing &amp; coding'));
  assert.equal(svg, renderProjectCard(agency));
});

test('renderProjectCard rechaza datos no válidos', () => {
  assert.throws(() => renderProjectCard({ name: '', description: 'x', accent: PALETTE.blue }), TypeError);
  assert.throws(() => renderProjectCard({ name: 'x', description: '', accent: PALETTE.blue }), TypeError);
  assert.throws(() => renderProjectCard({ name: 'x', description: 'y', accent: '#ff0000' }), TypeError);
  assert.throws(
    () => renderProjectCard({ name: 'x', description: 'word '.repeat(40).trim(), accent: PALETTE.blue }),
    RangeError,
    'una descripción que no cabe en 3 líneas se rechaza en vez de desbordar',
  );
});

// --- Botones de contacto (RF-47, RNF-5, RNF-7) ---

for (const [label] of CONTACT_DATA) {
  const c = () => CONTACTS.find((x) => x.label === label);

  test(`botón ${label}: reglas de SVG, etiqueta visible y en el <title>`, () => {
    const svg = renderContactButton(c());
    assertSvgRules(svg, `contact-${label}`, { animated: true });
    assert.equal(oneLine(visibleText(svg)), label);
    assert.ok(titleOf(svg).includes(label), 'etiqueta en el title');
  });

  test(`botón ${label}: fondo opaco #0a0e1a, borde neón y contraste >= 4.5 (RNF-5)`, () => {
    const svg = renderContactButton(c());
    assertOpaqueDarkBackground(svg, label);
    assertTextContrast(svg, label);
    assert.match(svg, new RegExp(`<rect\\b[^>]*class="edge"[^>]*stroke="${c().accent}"`), 'borde en el acento');
  });
}

test('renderContactButton rechaza etiqueta vacía o acento fuera de la paleta', () => {
  assert.throws(() => renderContactButton({ label: '', icon: 'linkedin', accent: PALETTE.blue }), TypeError);
  assert.throws(() => renderContactButton({ label: 'X', icon: 'linkedin', accent: '#123456' }), TypeError);
  assert.throws(() => renderContactButton({ label: 'X', icon: 'fax', accent: PALETTE.blue }), TypeError);
});

// --- build-static.mjs ---

test('buildStatic incluye las 5 tarjetas y los 3 botones, minificados y válidos', () => {
  const files = buildStatic();
  for (const { file } of [...PROJECTS, ...CONTACTS]) {
    assert.ok(file in files, `falta ${file}`);
    assertSvgRules(files[file], file, { animated: true });
  }
});

test('assets/static/ contiene las tarjetas y botones al día con buildStatic', () => {
  const files = buildStatic();
  for (const { file } of [...PROJECTS, ...CONTACTS]) {
    const path = STATIC_DIR + file;
    assert.ok(existsSync(path), `falta ${path}: ejecuta node scripts/build-static.mjs`);
    assert.equal(readFileSync(path, 'utf8'), files[file], `${file} desactualizado: ejecuta node scripts/build-static.mjs`);
  }
});
