// T10: textos alternativos con cifras (RF-65, RNF-7, RF-39).
// Un único texto por pieza: el `alt` del README y el <title> del SVG salen de buildAltTexts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAltTexts } from '../scripts/lib/alt.mjs';
import { buildProfileStats } from '../scripts/lib/stats.mjs';
import {
  renderStatsImg,
  applyStatsAlts,
  statsMarkers,
  STATS_PIECES,
  STATS_IMAGES,
  YOUTUBE_START,
  YOUTUBE_END,
  MarkerError,
} from '../scripts/lib/readme.mjs';
import { renderScoreboard } from '../scripts/render/scoreboard.mjs';
import { renderStatsCard, renderLanguagesCard, renderStreakCard, formatPct } from '../scripts/render/cards.mjs';
import { formatPct as formatPctLib } from '../scripts/lib/format.mjs';

const cfg = JSON.parse(readFileSync(new URL('../config/profile.json', import.meta.url), 'utf8'));

/** ProfileStats ficticio (mismos valores que cards.test.mjs). */
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

const empty = () => buildProfileStats({}, '2026-10-22', cfg);

const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const titleOf = (svg) => unescapeXml(/<title>([^<]*)<\/title>/.exec(svg)[1]);
const unescapeHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// ---------- buildAltTexts ----------

test('buildAltTexts: los 4 textos exactos del plan con un ProfileStats de ejemplo', () => {
  assert.deepEqual(buildAltTexts(sample()), {
    scoreboard:
      'Scoreboard. Goals: 27 repositories. Saves: 1,234 commits (last year). Assists: 79 PRs, issues & reviews. MVP: TypeScript (top language).',
    stats:
      'GitHub stats. Stars: 56. Commits (last year): 1,234. Pull requests (all time): 48. Issues (all time): 19. Code reviews (all time): 12.',
    languages: 'Top languages: TypeScript 41.2%, JavaScript 22.5%, C# 14.0%, Python 10.0%, PHP 7.3%, Kotlin 4.9%.',
    streak: 'Contribution streak. Current streak: 7 days. Longest streak: 42 days. Total contributions: 3,456.',
  });
});

test('buildAltTexts: perfil vacío → "0", "—" y "No languages yet" (valores iniciales del seed)', () => {
  assert.deepEqual(buildAltTexts(empty()), {
    scoreboard: 'Scoreboard. Goals: 0 repositories. Saves: 0 commits (last year). Assists: 0 PRs, issues & reviews. MVP: — (top language).',
    stats: 'GitHub stats. Stars: 0. Commits (last year): 0. Pull requests (all time): 0. Issues (all time): 0. Code reviews (all time): 0.',
    languages: 'Top languages: No languages yet.',
    streak: 'Contribution streak. Current streak: 0 days. Longest streak: 0 days. Total contributions: 0.',
  });
});

test('buildAltTexts: números ≥ 10 000 abreviados según RF-17', () => {
  const a = buildAltTexts(big());
  assert.equal(a.scoreboard, 'Scoreboard. Goals: 10.2k repositories. Saves: 1.2M commits (last year). Assists: 2M PRs, issues & reviews. MVP: TypeScript (top language).');
  assert.equal(a.stats, 'GitHub stats. Stars: 10k. Commits (last year): 1.2M. Pull requests (all time): 999.9k. Issues (all time): 10k. Code reviews (all time): 1M.');
  assert.equal(a.streak, 'Contribution streak. Current streak: 12.3k days. Longest streak: 99.9k days. Total contributions: 1M.');
});

test('buildAltTexts: nunca más de 6 lenguajes (como la tarjeta)', () => {
  const s = sample();
  s.languages.push({ name: 'Rust', pct: 0.01 });
  assert.ok(!buildAltTexts(s).languages.includes('Rust'));
});

test('buildAltTexts: falla con datos no válidos', () => {
  assert.throws(() => buildAltTexts(null), TypeError);
  assert.throws(() => buildAltTexts({ ...sample(), languages: 'x' }), TypeError);
});

test('formatPct vive en lib/format.mjs y cards.mjs la reexporta', () => {
  assert.equal(formatPct, formatPctLib);
});

// ---------- Mismo texto en el <title> de los SVG (RNF-7) ----------

test('el <title> del marcador y de las 3 tarjetas es exactamente el texto de buildAltTexts', () => {
  for (const s of [sample(), empty(), big(), { ...sample(), topLanguage: 'A&B<C>"', languages: [{ name: 'A&B<C>"', pct: 100 }] }]) {
    const a = buildAltTexts(s);
    assert.equal(titleOf(renderScoreboard(s)), a.scoreboard);
    assert.equal(titleOf(renderStatsCard(s)), a.stats);
    assert.equal(titleOf(renderLanguagesCard(s)), a.languages);
    assert.equal(titleOf(renderStreakCard(s)), a.streak);
  }
});

// ---------- renderStatsImg ----------

test('renderStatsImg: una sola línea con src, align, width y alt escapado', () => {
  assert.equal(
    renderStatsImg({ src: 'assets/generated/scoreboard.svg', align: 'right', width: 360, alt: 'A & B <c> "d"' }),
    '<img src="assets/generated/scoreboard.svg" align="right" width="360" alt="A &amp; B &lt;c&gt; &quot;d&quot;">',
  );
  assert.equal(renderStatsImg({ src: 'assets/generated/stats.svg', width: 390, alt: 'x' }), '<img src="assets/generated/stats.svg" width="390" alt="x">');
  assert.throws(() => renderStatsImg({ src: 'a.svg', width: 1, alt: '' }), TypeError);
});

test('STATS_IMAGES: las 4 piezas apuntan a assets/generated/ con el marcador a la derecha', () => {
  assert.deepEqual(STATS_PIECES, ['scoreboard', 'stats', 'languages', 'streak']);
  for (const p of STATS_PIECES) assert.match(STATS_IMAGES[p].src, new RegExp(`^assets/generated/${p}\\.svg$`));
  assert.equal(STATS_IMAGES.scoreboard.align, 'right');
  assert.equal(STATS_IMAGES.scoreboard.width, 360);
});

// ---------- applyStatsAlts ----------

function readmeWithBlocks(inner = (p) => `<img src="assets/generated/${p}.svg" alt="old">`, eol = '\n') {
  const block = (p) => {
    const m = statsMarkers(p);
    return `${m.start}${inner(p)}${m.end}`;
  };
  return [
    '# Title',
    '<p>',
    `  ${block('scoreboard')}`,
    'About text with A & B.',
    '</p>',
    '<p align="center">',
    `  ${block('stats')}`,
    `  ${block('languages')}`,
    `  ${block('streak')}`,
    '</p>',
    YOUTUBE_START,
    'videos',
    YOUTUBE_END,
    '',
  ].join(eol);
}

const altsIn = (readme) =>
  Object.fromEntries(
    STATS_PIECES.map((p) => {
      const m = statsMarkers(p);
      const re = new RegExp(`${m.start}<img [^>]*alt="([^"]*)">${m.end}`);
      return [p, unescapeHtml(re.exec(readme)[1])];
    }),
  );

test('statsMarkers: formato de marcadores del plan', () => {
  assert.deepEqual(statsMarkers('scoreboard'), { start: '<!-- ALT:scoreboard:START -->', end: '<!-- ALT:scoreboard:END -->' });
  assert.throws(() => statsMarkers('snake'), TypeError);
});

test('applyStatsAlts: sustituye solo los 4 bloques ALT:* y deja el resto igual', () => {
  const before = readmeWithBlocks();
  const alts = buildAltTexts(sample());
  const after = applyStatsAlts(before, alts);
  assert.deepEqual(altsIn(after), alts);
  for (const p of STATS_PIECES) {
    const m = statsMarkers(p);
    const line = `${m.start}${renderStatsImg({ ...STATS_IMAGES[p], alt: alts[p] })}${m.end}`;
    assert.ok(after.includes(line), `bloque ${p}`);
  }
  // Fuera de los bloques, nada cambia.
  const strip = (s) => s.replace(/<!-- ALT:(\w+):START -->[\s\S]*?<!-- ALT:\1:END -->/g, '[$1]');
  assert.equal(strip(after), strip(before));
  assert.ok(after.includes('About text with A & B.'));
});

test('applyStatsAlts: idempotente (aplicarla dos veces da lo mismo) y respeta CRLF', () => {
  const alts = buildAltTexts(sample());
  for (const eol of ['\n', '\r\n']) {
    const once = applyStatsAlts(readmeWithBlocks(undefined, eol), alts);
    assert.equal(applyStatsAlts(once, alts), once);
    assert.equal(once.split(eol).length, readmeWithBlocks(undefined, eol).split(eol).length, 'mismas líneas');
    if (eol === '\n') assert.ok(!once.includes('\r'));
  }
});

test('applyStatsAlts: marcador ausente, duplicado o invertido → MarkerError sin tocar nada', () => {
  const alts = buildAltTexts(sample());
  const ok = readmeWithBlocks();
  const m = statsMarkers('streak');
  assert.throws(() => applyStatsAlts(ok.replace(m.start, ''), alts), MarkerError);
  assert.throws(() => applyStatsAlts(ok + m.start + m.end, alts), MarkerError);
  assert.throws(() => applyStatsAlts(ok.replace(m.start, 'X').replace(m.end, m.start).replace('X', m.end), alts), MarkerError);
  assert.throws(() => applyStatsAlts(ok, { ...alts, streak: undefined }), TypeError);
  assert.equal(new MarkerError('x').code, 'readme-markers');
});
