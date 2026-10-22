// T5: marcador y tarjetas de stats, lenguajes y racha (RF-12 a RF-17, RF-32 a RF-34, RF-39, RNF-5, RNF-7).
// Datos de ejemplo claramente ficticios: solo viven en este test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderScoreboard, fitFontSize, SCOREBOARD_TILES } from '../scripts/render/scoreboard.mjs';
import { renderStatsCard, renderLanguagesCard, renderStreakCard, formatPct, STATS_ROWS, STREAK_LABELS } from '../scripts/render/cards.mjs';
import { buildProfileStats } from '../scripts/lib/stats.mjs';
import { minifySvg } from '../scripts/lib/svg.mjs';
import { checkXml } from './helpers/xml.mjs';
import { PALETTE } from '../scripts/lib/palette.mjs';
import { assertSvgRules, textNodes, assertOpaqueDarkBackground, assertTextContrast } from './helpers/svg-rules.mjs';

const cfg = JSON.parse(readFileSync(new URL('../config/profile.json', import.meta.url), 'utf8'));

/** ProfileStats ficticio de ejemplo (no son datos reales del usuario). */
function sample() {
  return {
    repositories: 27,
    commitsLastYear: 1234,
    prs: 48,
    issues: 19,
    reviews: 12,
    assists: 79,
    stars: 56,
    languages: [
      { name: 'TypeScript', pct: 41.237 },
      { name: 'JavaScript', pct: 22.5 },
      { name: 'C#', pct: 14.04 },
      { name: 'Python', pct: 10 },
      { name: 'PHP', pct: 7.3 },
      { name: 'Kotlin', pct: 4.923 },
    ],
    topLanguage: 'TypeScript',
    currentStreak: 7,
    longestStreak: 42,
    totalContributions: 3456,
    grid: [],
  };
}

/** Números grandes para comprobar el formato abreviado de RF-17. */
function big() {
  return {
    ...sample(),
    repositories: 10_290,
    commitsLastYear: 1_250_000,
    prs: 999_999,
    issues: 10_000,
    reviews: 1_000_000,
    assists: 2_009_999,
    stars: 10_000,
    currentStreak: 12_345,
    longestStreak: 99_999,
    totalContributions: 1_000_000,
  };
}

/** Perfil vacío real: el mismo que pintarán los archivos iniciales (seed de T10). */
const empty = () => buildProfileStats({}, '2026-10-22', cfg);

const titleOf = (svg) =>
  /<title>([^<]*)<\/title>/.exec(svg)[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const RENDERERS = {
  scoreboard: renderScoreboard,
  stats: renderStatsCard,
  languages: renderLanguagesCard,
  streak: renderStreakCard,
};

// ---------- Reglas comunes (RNF-3 a RNF-10) ----------

for (const [name, render] of Object.entries(RENDERERS)) {
  for (const [variant, data] of Object.entries({ sample, big, empty })) {
    test(`${name} (${variant}): reglas de SVG, fondo opaco #0a0e1a y contraste >= 4.5`, () => {
      const svg = render(data());
      assertSvgRules(svg, `${name}-${variant}`, { animated: true });
      assertOpaqueDarkBackground(svg, `${name}-${variant}`);
      assertTextContrast(svg, `${name}-${variant}`);
      assert.match(svg, /<rect\b[^>]*class="edge"/, 'borde neón');
      assert.ok(!svg.endsWith('\n'), 'sin salto final');
      assert.ok(!svg.includes('\n'), 'en una sola línea');
    });
  }

  test(`${name}: determinista, minifySvg no lo agranda y sigue siendo XML válido`, () => {
    const svg = render(sample());
    assert.equal(svg, render(sample()));
    const min = minifySvg(svg);
    assert.ok(min.length <= svg.length);
    assert.deepEqual(checkXml(min), { ok: true });
  });

  test(`${name}: no modifica el ProfileStats recibido`, () => {
    const s = sample();
    const copy = structuredClone(s);
    render(s);
    assert.deepEqual(s, copy);
  });

  test(`${name}: rechaza cifras ausentes o no válidas`, () => {
    assert.throws(() => render({}), TypeError);
    assert.throws(() => render(null), TypeError);
  });
}

// ---------- Marcador (RF-12 a RF-17) ----------

test('marcador: definición de casillas de la tabla de la spec (equipo azul Goals/Saves, naranja Assists/MVP)', () => {
  assert.deepEqual(
    SCOREBOARD_TILES.map((t) => [t.title, t.label, t.team]),
    [
      ['Goals', 'Repositories', 'blue'],
      ['Saves', 'Commits (last year)', 'blue'],
      ['Assists', 'PRs, issues & reviews', 'orange'],
      ['MVP', 'Top language', 'orange'],
    ],
  );
});

test('marcador: títulos Goals, Saves, Assists y MVP con su valor y subetiqueta exactos (RF-12 a RF-16)', () => {
  const texts = textNodes(renderScoreboard(sample()));
  const expected = [
    ['Goals', '27', 'Repositories'],
    ['Saves', '1,234', 'Commits (last year)'],
    ['Assists', '79', 'PRs, issues & reviews'],
    ['MVP', 'TypeScript', 'Top language'],
  ];
  for (const [title, value, label] of expected) {
    const i = texts.indexOf(title);
    assert.ok(i >= 0, `falta el título ${title}: ${JSON.stringify(texts)}`);
    assert.deepEqual(texts.slice(i, i + 3), [title, value, label], `casilla ${title}`);
  }
});

test('marcador: Assists = PRs + issues + revisiones aunque el campo assists falte', () => {
  const s = sample();
  delete s.assists;
  assert.ok(textNodes(renderScoreboard(s)).includes('79'));
});

test('marcador: colores de equipo (azul a la izquierda, naranja a la derecha) (RF-12)', () => {
  const svg = renderScoreboard(sample());
  const fillOf = (label) => new RegExp(`<text\\b[^>]*fill="([^"]+)"[^>]*>${label}</text>`).exec(svg)?.[1];
  assert.equal(fillOf('Goals'), PALETTE.blue);
  assert.equal(fillOf('Saves'), PALETTE.blue);
  assert.equal(fillOf('Assists'), PALETTE.orange);
  assert.equal(fillOf('MVP'), PALETTE.orange);
  const xOf = (label) => Number(new RegExp(`<text\\b[^>]*x="([\\d.]+)"[^>]*>${label}</text>`).exec(svg)?.[1]);
  assert.ok(xOf('Goals') < xOf('Assists'), 'azul a la izquierda');
  assert.ok(xOf('Saves') < xOf('MVP'), 'azul a la izquierda');
});

test('marcador: cifras y lenguaje top en el <title> (RNF-7)', () => {
  // T10: el <title> es el texto de buildAltTexts (RF-65), con las subetiquetas en minúscula dentro de la frase.
  const title = titleOf(renderScoreboard(sample())).toLowerCase();
  for (const s of ['Goals', '27', 'Repositories', 'Saves', '1,234', 'Commits (last year)', 'Assists', '79', 'PRs, issues & reviews', 'MVP', 'TypeScript', 'Top language']) {
    assert.ok(title.includes(s.toLowerCase()), `title sin "${s}": ${title}`);
  }
});

test('marcador: números grandes abreviados según RF-17', () => {
  const svg = renderScoreboard(big());
  const texts = textNodes(svg);
  for (const v of ['10.2k', '1.2M', '2M']) assert.ok(texts.includes(v), `falta ${v}: ${JSON.stringify(texts)}`);
  for (const v of ['10.2k', '1.2M', '2M']) assert.ok(titleOf(svg).includes(v), `title sin ${v}`);
});

test('marcador vacío: "0" en las casillas numéricas y "—" en MVP (casos límite)', () => {
  const svg = renderScoreboard(empty());
  const texts = textNodes(svg);
  assert.deepEqual(texts.slice(texts.indexOf('Goals'), texts.indexOf('Goals') + 2), ['Goals', '0']);
  assert.deepEqual(texts.slice(texts.indexOf('Saves'), texts.indexOf('Saves') + 2), ['Saves', '0']);
  assert.deepEqual(texts.slice(texts.indexOf('Assists'), texts.indexOf('Assists') + 2), ['Assists', '0']);
  assert.deepEqual(texts.slice(texts.indexOf('MVP'), texts.indexOf('MVP') + 3), ['MVP', '—', 'Top language']);
  assert.ok(titleOf(svg).includes('MVP: —'), 'title con "—"');
});

test('marcador: escapa el nombre del lenguaje', () => {
  const svg = renderScoreboard({ ...sample(), topLanguage: 'A&B<C>' });
  assert.ok(svg.includes('A&amp;B&lt;C&gt;'));
  assert.deepEqual(checkXml(svg), { ok: true });
  assert.ok(textNodes(svg).includes('A&B<C>'));
});

test('fitFontSize: reduce la fuente para que el texto quepa y nunca baja del mínimo', () => {
  assert.equal(fitFontSize('Go', 200, 34, 14), 34);
  const s = fitFontSize('Jupyter Notebook', 180, 34, 14);
  assert.ok(s < 34 && s >= 14, `tamaño ${s}`);
  assert.equal(fitFontSize('x'.repeat(200), 180, 34, 14), 14);
});

test('marcador: un lenguaje top largo se reduce y, si no cabe ni al mínimo, se acorta con "…" (nombre completo en el <title>)', () => {
  const mid = renderScoreboard({ ...sample(), topLanguage: 'Jupyter Notebook' });
  assert.ok(textNodes(mid).includes('Jupyter Notebook'));
  const long = 'Microsoft Developer Studio Project Extra';
  const svg = renderScoreboard({ ...sample(), topLanguage: long });
  const shown = textNodes(svg)[textNodes(svg).indexOf('MVP') + 1];
  assert.ok(shown.endsWith('…') && shown.length < long.length, `mostrado: ${shown}`);
  assert.ok(titleOf(svg).includes(long));
});

// ---------- Tarjeta de stats (RF-32) ----------

test('tarjeta de stats: exactamente las 5 cifras de RF-32, en orden, con su valor', () => {
  assert.deepEqual(STATS_ROWS.map((r) => r.label), [
    'Stars',
    'Commits (last year)',
    'Pull requests (all time)',
    'Issues (all time)',
    'Code reviews (all time)',
  ]);
  const texts = textNodes(renderStatsCard(sample()));
  assert.deepEqual(texts, [
    'GitHub stats',
    'Stars', '56',
    'Commits (last year)', '1,234',
    'Pull requests (all time)', '48',
    'Issues (all time)', '19',
    'Code reviews (all time)', '12',
  ]);
});

test('tarjeta de stats: cifras en el <title> y números grandes abreviados (RNF-7, RF-17)', () => {
  const title = titleOf(renderStatsCard(sample()));
  for (const s of ['Stars: 56', 'Commits (last year): 1,234', 'Pull requests (all time): 48', 'Issues (all time): 19', 'Code reviews (all time): 12']) {
    assert.ok(title.includes(s), `title sin "${s}": ${title}`);
  }
  const texts = textNodes(renderStatsCard(big()));
  for (const v of ['10k', '1.2M', '999.9k', '1M']) assert.ok(texts.includes(v), `falta ${v}`);
});

test('tarjeta de stats vacía: todo a "0"', () => {
  const texts = textNodes(renderStatsCard(empty()));
  assert.equal(texts.filter((t) => t === '0').length, 5);
});

// ---------- Tarjeta de lenguajes (RF-33) ----------

test('formatPct: un decimal redondeado, "<0.1%" para cantidades mínimas', () => {
  assert.equal(formatPct(41.237), '41.2%');
  assert.equal(formatPct(10), '10.0%');
  assert.equal(formatPct(100), '100.0%');
  assert.equal(formatPct(4.96), '5.0%');
  assert.equal(formatPct(0.04), '<0.1%');
});

test('tarjeta de lenguajes: hasta 6 lenguajes en orden con su porcentaje; el primero es el top (RF-33)', () => {
  const svg = renderLanguagesCard(sample());
  const texts = textNodes(svg);
  const expected = [
    ['TypeScript', '41.2%'],
    ['JavaScript', '22.5%'],
    ['C#', '14.0%'],
    ['Python', '10.0%'],
    ['PHP', '7.3%'],
    ['Kotlin', '4.9%'],
  ];
  assert.equal(texts[0], 'Top languages');
  assert.deepEqual(texts.slice(1), expected.flat());
  const title = titleOf(svg);
  for (const [n, p] of expected) assert.ok(title.includes(`${n} ${p}`), `title sin "${n} ${p}"`);
});

test('tarjeta de lenguajes: nunca pinta más de 6 aunque reciba más', () => {
  const s = sample();
  s.languages.push({ name: 'Rust', pct: 0.01 });
  assert.ok(!textNodes(renderLanguagesCard(s)).includes('Rust'));
});

test('tarjeta de lenguajes: un segmento de barra por lenguaje con anchura proporcional', () => {
  const svg = renderLanguagesCard(sample());
  const segs = [...svg.matchAll(/<rect\b[^>]*class="seg"[^>]*width="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(segs.length, 6);
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i] <= segs[i - 1] + 0.1, 'orden decreciente');
  assert.ok(Math.abs(segs[0] / segs[3] - 41.237 / 10) < 0.05, 'proporcional al porcentaje');
});

test('tarjeta de lenguajes sin lenguajes: mensaje "No languages yet" visible y en el <title>', () => {
  const svg = renderLanguagesCard(empty());
  assert.deepEqual(textNodes(svg), ['Top languages', 'No languages yet']);
  assert.ok(titleOf(svg).includes('No languages yet'));
});

test('tarjeta de lenguajes: escapa nombres y acorta con "…" los demasiado largos (completo en el <title>)', () => {
  const long = 'Common Workflow Language Extended';
  const svg = renderLanguagesCard({ ...sample(), languages: [{ name: long, pct: 60 }, { name: 'A&B', pct: 40 }], topLanguage: long });
  assert.deepEqual(checkXml(svg), { ok: true });
  const texts = textNodes(svg);
  assert.ok(texts.includes('A&B'));
  assert.ok(texts[1].endsWith('…') && texts[1].length < long.length, `mostrado: ${texts[1]}`);
  assert.ok(titleOf(svg).includes(long));
});

// ---------- Tarjeta de racha (RF-34) ----------

test('tarjeta de racha: etiquetas exactas de RF-34 con su valor', () => {
  assert.deepEqual(STREAK_LABELS, ['Total contributions', 'Current streak', 'Longest streak']);
  const texts = textNodes(renderStreakCard(sample()));
  for (const [label, value] of [['Total contributions', '3,456'], ['Current streak', '7'], ['Longest streak', '42']]) {
    const i = texts.indexOf(label);
    assert.ok(i > 0, `falta ${label}: ${JSON.stringify(texts)}`);
    assert.equal(texts[i - 1], value, `valor de ${label}`);
  }
  const title = titleOf(renderStreakCard(sample()));
  for (const s of ['Current streak: 7', 'Longest streak: 42', 'Total contributions: 3,456']) assert.ok(title.includes(s), `title sin "${s}"`);
});

test('tarjeta de racha: números grandes y perfil vacío', () => {
  const texts = textNodes(renderStreakCard(big()));
  for (const v of ['1M', '12.3k', '99.9k']) assert.ok(texts.includes(v), `falta ${v}`);
  const e = textNodes(renderStreakCard(empty()));
  assert.equal(e.filter((t) => t === '0').length, 3);
});

test('tarjeta de racha: la racha actual larga reduce su fuente para caber en el anillo', () => {
  const sizeOf = (svg, value) => Number(new RegExp(`font-size="([\\d.]+)"[^>]*>${value}</text>`).exec(svg)?.[1]);
  const small = sizeOf(renderStreakCard(sample()), '7');
  const large = sizeOf(renderStreakCard(big()), '12.3k');
  assert.ok(large < small, `"12.3k" (${large}) debería ser menor que "7" (${small})`);
  assert.ok(large * 0.68 * 5 <= 2 * 38 - 14, 'cabe dentro del anillo');
});

// ---------- Un único ProfileStats para las 4 piezas (RF-39) ----------

test('las cifras compartidas coinciden entre el marcador y las tarjetas (RF-39)', () => {
  const s = sample();
  const board = textNodes(renderScoreboard(s));
  const stats = textNodes(renderStatsCard(s));
  const langs = textNodes(renderLanguagesCard(s));
  const saves = board[board.indexOf('Saves') + 1];
  const commits = stats[stats.indexOf('Commits (last year)') + 1];
  assert.equal(saves, commits);
  assert.equal(board[board.indexOf('MVP') + 1], langs[1], 'el MVP es el primer lenguaje de la tarjeta');
  const assists = Number(board[board.indexOf('Assists') + 1]);
  const sum = ['Pull requests (all time)', 'Issues (all time)', 'Code reviews (all time)'].reduce((a, l) => a + Number(stats[stats.indexOf(l) + 1]), 0);
  assert.equal(assists, sum, 'Assists = PRs + issues + reviews de la tarjeta');
});
