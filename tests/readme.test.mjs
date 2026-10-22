// T11: el README nuevo (RF-1, RF-2, RF-4, RF-6 a RF-11, RF-19 a RF-31, RF-46 a RF-49, RF-55, RF-60, RF-65,
// RNF-1, RNF-2, RNF-6, RNF-7, RNF-8, RNF-12, RNF-13). Se lee el README real del repo, sin red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROJECTS, CONTACTS } from '../scripts/build-static.mjs';
import { STATS_PIECES, STATS_IMAGES, statsMarkers, renderStatsImg, YOUTUBE_START, YOUTUBE_END } from '../scripts/lib/readme.mjs';
import { buildAltTexts } from '../scripts/lib/alt.mjs';
import { buildProfileStats } from '../scripts/lib/stats.mjs';
import { PALETTE, GITHUB_BG, contrastRatio } from '../scripts/lib/palette.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const CFG = JSON.parse(readFileSync(new URL('../config/profile.json', import.meta.url), 'utf8'));

const DARK = '(prefers-color-scheme: dark)';
const unescapeHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescapeHtml(m[1]) : null;
};
const imgTags = (text = README) => [...text.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const pictures = () => [...README.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map((m) => m[1]);
const count = (needle, text = README) => text.split(needle).length - 1;

// --- Secciones (RF-1, RF-2) ---------------------------------------------------------

const HEADINGS = ['About me', 'Projects', 'Tech stack', 'GitHub stats', 'Latest YouTube videos', 'Contact'];

function headingIndex(title) {
  const re = new RegExp(`^## .*\\b${title.replace(/ /g, ' ')}\\s*$`, 'gm');
  const all = [...README.matchAll(re)];
  assert.equal(all.length, 1, `debe haber una sola cabecera "## … ${title}"`);
  return all[0].index;
}

/** Inicio de cada sección principal: la cabecera empieza en el banner. */
function sectionStarts() {
  return [README.indexOf('banner-'), ...HEADINGS.map(headingIndex)];
}

function section(i) {
  const s = sectionStarts();
  return README.slice(s[i], i + 1 < s.length ? s[i + 1] : README.length);
}

test('RF-1: las 7 secciones principales aparecen en el orden de la spec', () => {
  const starts = sectionStarts();
  assert.ok(starts[0] >= 0, 'falta el banner');
  assert.ok(README.slice(0, starts[0]).search(/<img|^#/m) === -1, 'el banner es lo primero del README');
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] > starts[i - 1], `${HEADINGS[i - 1]} va en su sitio`);
  assert.ok(README.indexOf('readme-typing-svg') > starts[0] && README.indexOf('readme-typing-svg') < starts[1], 'texto animado en la cabecera');
});

test('RF-2: un separador animado entre cada par de secciones consecutivas (6 en total)', () => {
  const divider = 'assets/static/divider.svg';
  assert.equal(count(divider), 6);
  assert.ok(existsSync(ROOT + divider));
  const starts = sectionStarts();
  for (let i = 0; i < starts.length - 1; i++) {
    // El separador va al final de la sección i, antes de la cabecera de la siguiente.
    assert.equal(count(divider, README.slice(starts[i], starts[i + 1])), 1, `un separador tras la sección ${i + 1}`);
  }
  assert.equal(count(divider, README.slice(starts.at(-1))), 0, 'ningún separador después de Contact');
});

// --- Cabecera (RF-4, RF-6 a RF-9) --------------------------------------------------

function pictureWith(file) {
  const p = pictures().find((x) => x.includes(file));
  assert.ok(p, `falta <picture> con ${file}`);
  const source = /<source\b[^>]*>/.exec(p)?.[0];
  assert.ok(source, 'el <picture> tiene <source>');
  assert.equal(attr(source, 'media'), DARK);
  const img = imgTags(p);
  assert.equal(img.length, 1);
  return { dark: attr(source, 'srcset'), light: attr(img[0], 'src'), alt: attr(img[0], 'alt') };
}

test('RF-4, RF-6: banner en <picture> con variante oscura y clara, y nombre y rol en el alt', () => {
  const b = pictureWith('banner-');
  assert.equal(b.dark, 'assets/static/banner-dark.svg');
  assert.equal(b.light, 'assets/static/banner-light.svg');
  assert.ok(b.alt.includes('Luis Ángel Jose Da Silva'));
  assert.ok(b.alt.includes('Software Developer · Rocket League Creator'));
});

const PHRASES = ['Full-Stack Developer', 'Building web apps with .NET, React & Node', 'Rocket League content creator', 'Always shipping, always boosting 🚀'];

test('RF-7 a RF-9: texto animado de demolab con las 4 frases exactas y color por tema con contraste', () => {
  assert.ok(!README.includes('herokuapp'), 'sin el dominio obsoleto');
  const t = pictureWith('readme-typing-svg');
  const urls = { dark: new URL(t.dark), light: new URL(t.light) };
  for (const [theme, url] of Object.entries(urls)) {
    assert.equal(url.hostname, 'readme-typing-svg.demolab.com', theme);
    assert.deepEqual(url.searchParams.get('lines').split(';'), PHRASES, `frases de ${theme}`);
    const color = `#${url.searchParams.get('color')}`.toLowerCase();
    assert.ok(contrastRatio(color, GITHUB_BG[theme]) >= 4.5, `contraste ${theme} ${color}`);
  }
  assert.equal(`#${urls.dark.searchParams.get('color')}`.toLowerCase(), PALETTE.blue);
  assert.equal(`#${urls.light.searchParams.get('color')}`.toLowerCase(), PALETTE.bg);
  // Las frases también como texto alternativo (RNF-7).
  for (const p of PHRASES) assert.ok(t.alt.includes(p), `alt con "${p}"`);
});

// --- About me (RF-10, RF-11, RF-65) -------------------------------------------------

const SEED_ALTS = buildAltTexts(buildProfileStats({}, new Date('2026-10-22T00:00:00Z'), CFG));

test('RF-65, RF-60: los 4 bloques ALT:* aparecen una vez, en una línea, con el alt inicial de --seed', () => {
  for (const p of STATS_PIECES) {
    const { start, end } = statsMarkers(p);
    assert.equal(count(start), 1, start);
    assert.equal(count(end), 1, end);
    const line = README.split(/\r?\n/).find((l) => l.includes(start));
    assert.ok(line.includes(end), `${p}: START y END en la misma línea`);
    const block = README.slice(README.indexOf(start) + start.length, README.indexOf(end));
    assert.equal(block, renderStatsImg({ ...STATS_IMAGES[p], alt: SEED_ALTS[p] }));
    assert.ok(existsSync(ROOT + STATS_IMAGES[p].src), STATS_IMAGES[p].src);
  }
});

test('RF-10: el marcador flota a la derecha al principio de About me y el texto va a su lado', () => {
  const about = section(1);
  const { start } = statsMarkers('scoreboard');
  assert.ok(about.includes(start), 'el marcador está en About me');
  assert.equal(STATS_IMAGES.scoreboard.align, 'right');
  const afterBoard = about.slice(about.indexOf(start));
  assert.match(afterBoard, /Luis Ángel Jose Da Silva/, 'el texto va después del marcador (fluye a su lado)');
});

test('RF-11: el texto de About me cubre los puntos de la spec', () => {
  const about = section(1);
  for (const re of [/Software Developer/, /Rocket League/, /YouTube/, /@lk_rl/, /DAW/, /Web Application Development/, /frontend/i, /backend/i, /databases/i, /AI tools/, /collaborations/]) {
    assert.match(about, re);
  }
  assert.ok(!/Currently working on/i.test(README), 'sin "Currently working on"');
});

// --- Projects (RF-19 a RF-27) -------------------------------------------------------

test('RF-19 a RF-25: 5 tarjetas en orden, cada una enlazada a su destino y con alt con nombre y descripción', () => {
  const projects = section(2);
  let last = -1;
  for (const p of PROJECTS) {
    const re = new RegExp(`<a href="${p.url.replace(/[.?/]/g, '\\$&')}"><img src="assets/static/${p.file}"[^>]*></a>`);
    const m = re.exec(projects);
    assert.ok(m, `tarjeta ${p.name} enlazada a ${p.url}`);
    assert.ok(m.index > last, `${p.name} en orden`);
    last = m.index;
    const alt = attr(m[0], 'alt');
    assert.ok(alt.includes(p.name) && alt.includes(p.description), `alt de ${p.name}`);
    assert.ok(existsSync(ROOT + 'assets/static/' + p.file));
  }
  assert.equal(imgTags(projects).filter((t) => t.includes('assets/static/project-')).length, 5);
});

test('RF-26: ningún enlace al repo privado de Magnar WarGames', () => {
  assert.ok(!/github\.com\/[^\s"')]*magnar/i.test(README));
});

test('RF-27: AgencyMac nunca se presenta como .NET + TailwindCSS', () => {
  for (const line of README.split(/\r?\n/).filter((l) => /AgencyMac/i.test(l))) {
    assert.ok(!/\.NET|Tailwind/i.test(line), line);
  }
});

// --- Tech stack (RF-28 a RF-31) -----------------------------------------------------

const CATEGORIES = [
  ['Frontend', ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React', 'TailwindCSS']],
  ['Backend', ['Node.js', 'Django', '.NET', 'PHP']],
  ['Databases', ['MySQL', 'MariaDB', 'MongoDB']],
  ['Programming Languages', ['Java', 'Python', 'C', 'C#', 'Kotlin']],
  ['Tools & DevOps', ['Git', 'Docker', 'Linux', 'AWS', 'Azure']],
];
// Ids de skillicons.dev. MariaDB no tiene icono (comprobado a mano el 2026-10-22: devuelve un SVG vacío).
const ICON_IDS = {
  HTML5: 'html', CSS3: 'css', JavaScript: 'js', TypeScript: 'ts', React: 'react', TailwindCSS: 'tailwind',
  'Node.js': 'nodejs', Django: 'django', '.NET': 'dotnet', PHP: 'php', MySQL: 'mysql', MariaDB: null, MongoDB: 'mongodb',
  Java: 'java', Python: 'py', C: 'c', 'C#': 'cs', Kotlin: 'kotlin', Git: 'git', Docker: 'docker', Linux: 'linux', AWS: 'aws', Azure: 'azure',
};

test('RF-28, RF-29: iconos de skillicons para las tecnologías con icono; las demás no van en los iconos', () => {
  const stack = section(3);
  const icons = imgTags(stack).filter((t) => attr(t, 'src').startsWith('https://skillicons.dev/'));
  assert.ok(icons.length >= 1, 'hay filas de iconos');
  const ids = icons.flatMap((t) => new URL(attr(t, 'src')).searchParams.get('i').split(','));
  const all = CATEGORIES.flatMap(([, techs]) => techs);
  assert.equal(all.length, 23);
  assert.deepEqual(ids, all.map((t) => ICON_IDS[t]).filter(Boolean), 'iconos exactos y en orden de categoría');
  const alts = icons.map((t) => attr(t, 'alt')).join(' ');
  for (const t of all.filter((x) => ICON_IDS[x])) assert.ok(alts.includes(t), `alt de iconos con ${t}`);
  assert.ok(!alts.includes('MariaDB'), 'MariaDB no está en las filas de iconos');
});

test('RF-30, RF-31: 5 desplegables cerrados, en orden y con la lista exacta, debajo de los iconos', () => {
  const stack = section(3);
  const details = [...stack.matchAll(/<details(\s[^>]*)?>([\s\S]*?)<\/details>/g)];
  assert.equal(details.length, 5);
  assert.equal(count('<details', README), 5, 'no hay más desplegables en el README');
  assert.ok(stack.indexOf('skillicons.dev') < details[0].index, 'los desplegables van debajo de los iconos');
  details.forEach((d, i) => {
    assert.ok(!/\bopen\b/.test(d[1] ?? ''), 'cerrado por defecto');
    const [name, techs] = CATEGORIES[i];
    const summary = unescapeHtml(/<summary>([\s\S]*?)<\/summary>/.exec(d[2])[1].replace(/<[^>]+>/g, '')).trim();
    assert.ok(summary.endsWith(name), `summary ${i + 1}: ${summary}`);
    const body = unescapeHtml(d[2].slice(d[2].indexOf('</summary>') + 10).replace(/<[^>]+>/g, ' '));
    const listed = body.split('·').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(listed, techs, `contenido de ${name}`);
  });
});

// --- GitHub stats (RF-32 a RF-37 en el README) --------------------------------------

test('RNF-7: stats, lenguajes y racha en GitHub stats; snake en <picture> y 3D con alt fijo sin cifras', () => {
  const stats = section(4);
  for (const p of ['stats', 'languages', 'streak']) assert.ok(stats.includes(statsMarkers(p).start), p);
  const snake = pictureWith('snake-');
  assert.equal(snake.dark, 'assets/generated/snake-dark.svg');
  assert.equal(snake.light, 'assets/generated/snake-light.svg');
  assert.ok(stats.includes('snake-dark.svg'));
  const d3 = imgTags(stats).find((t) => attr(t, 'src') === 'assets/generated/contrib-3d.svg');
  assert.ok(d3, 'gráfico 3D');
  for (const alt of [snake.alt, attr(d3, 'alt')]) {
    assert.ok(alt.length > 10);
    // "3D" es el nombre del gráfico, no una cifra de datos.
    assert.ok(!/\d/.test(alt.replace(/\b3D\b/g, '')), `sin cifras: ${alt}`);
  }
});

// --- YouTube (RF-46) ----------------------------------------------------------------

test('RF-46: marcadores de YouTube una vez dentro de su sección, con enlace al canal', () => {
  const yt = section(5);
  assert.equal(count(YOUTUBE_START), 1);
  assert.equal(count(YOUTUBE_END), 1);
  const block = yt.slice(yt.indexOf(YOUTUBE_START), yt.indexOf(YOUTUBE_END));
  assert.ok(yt.indexOf(YOUTUBE_START) >= 0 && yt.indexOf(YOUTUBE_END) > yt.indexOf(YOUTUBE_START));
  assert.ok(block.includes('href="https://youtube.com/@lk_rl"'));
  assert.ok(!/\n\s*\n/.test(block.slice(YOUTUBE_START.length).trim()), 'sin líneas en blanco dentro del bloque');
});

// --- Contact y footer (RF-47 a RF-49) ----------------------------------------------

test('RF-47, RF-48: 3 botones de contacto con su destino y alt con el destino', () => {
  const contact = section(6);
  for (const c of CONTACTS) {
    const re = new RegExp(`<a href="${c.url.replace(/[.?/]/g, '\\$&')}"><img src="assets/static/${c.file}"[^>]*></a>`);
    const m = re.exec(contact);
    assert.ok(m, `botón ${c.label}`);
    assert.ok(attr(m[0], 'alt').includes(c.label));
  }
  assert.ok(!/utm_|[?&]si=/.test(README), 'sin parámetros de seguimiento');
  assert.ok(contact.includes('luigidasilv@gmail.com'));
});

test('RF-49: el README termina con la onda neón del footer', () => {
  const imgs = imgTags();
  assert.equal(attr(imgs.at(-1), 'src'), 'assets/static/footer-wave.svg');
  assert.ok(section(6).includes('footer-wave.svg'));
});

// --- Reglas generales (RNF-1, RNF-2, RNF-7, RNF-8, RNF-12, RNF-13, RF-55) -----------

test('RNF-1, RNF-2: sin tablas ni HTML que GitHub elimina', () => {
  assert.ok(!/<table\b|<style\b|<script\b/i.test(README));
  assert.ok(!/\s(class|id|style)\s*=/i.test(README));
  assert.ok(!README.split(/\r?\n/).some((l) => /^\s*\|?\s*:?-{3,}:?\s*\|/.test(l)), 'sin tablas Markdown');
});

test('RNF-7: toda <img> lleva alt descriptivo', () => {
  const imgs = imgTags();
  assert.ok(imgs.length > 20);
  for (const t of imgs) assert.ok((attr(t, 'alt') ?? '').trim().length >= 5, t);
});

test('RF-60: todo src/srcset relativo existe en disco', () => {
  const refs = [...README.matchAll(/\s(?:src|srcset)="([^"]*)"/g)].map((m) => unescapeHtml(m[1]));
  for (const r of refs.filter((x) => !/^https?:/.test(x))) assert.ok(existsSync(ROOT + r), r);
});

test('RNF-12: solo typing SVG, skillicons y miniaturas de YouTube como imágenes externas', () => {
  const allowed = ['readme-typing-svg.demolab.com', 'skillicons.dev', 'i.ytimg.com'];
  const refs = [...README.matchAll(/\s(?:src|srcset)="(https?:[^"]*)"/g)].map((m) => new URL(unescapeHtml(m[1])).hostname);
  for (const h of refs) assert.ok(allowed.includes(h), h);
});

/** Archivos propios que carga la portada en cada tema (cada archivo cuenta una vez: el navegador lo cachea). */
function ownFilesByTheme() {
  const dark = new Set();
  const light = new Set();
  let rest = README;
  for (const p of pictures()) {
    const { dark: d, light: l } = { dark: attr(/<source\b[^>]*>/.exec(p)[0], 'srcset'), light: attr(imgTags(p)[0], 'src') };
    if (!/^https?:/.test(d)) dark.add(d);
    if (!/^https?:/.test(l)) light.add(l);
    rest = rest.replace(p, '');
  }
  for (const t of imgTags(rest)) {
    const s = attr(t, 'src');
    if (!/^https?:/.test(s)) {
      dark.add(s);
      light.add(s);
    }
  }
  return { dark, light };
}

test('RNF-8: peso total de las piezas propias por tema ≤ 1.5 MB', () => {
  for (const [theme, files] of Object.entries(ownFilesByTheme())) {
    const total = [...files].reduce((sum, f) => sum + statSync(ROOT + f).size, 0);
    assert.ok(total <= 1.5 * 1024 * 1024, `${theme}: ${total} bytes`);
    console.log(`# peso ${theme}: ${(total / 1024).toFixed(1)} KB en ${files.size} archivos`);
  }
});

test('RF-55, RNF-13: sin "last updated" y texto visible en inglés', () => {
  assert.ok(!/last updated|updated on|actualizado/i.test(README));
  const text = README.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/https?:\S+/g, ' ');
  const spanish = ['el', 'la', 'los', 'las', 'que', 'para', 'con', 'una', 'del', 'proyecto', 'proyectos', 'sobre', 'también', 'desarrollador', 'contacto'];
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  for (const w of spanish) assert.ok(!words.includes(w), `palabra en español: ${w}`);
});
