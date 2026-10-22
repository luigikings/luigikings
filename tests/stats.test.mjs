import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDailyMap,
  aggregateLanguages,
  topLanguage,
  computeStreak,
  contributionLevels,
  buildProfileStats,
} from '../scripts/lib/stats.mjs';
import { last12Months } from '../scripts/lib/dates.mjs';

const cfg = JSON.parse(readFileSync(new URL('../config/profile.json', import.meta.url), 'utf8'));
const TODAY = '2026-10-22';
const day = (date, commits = 0, others = 0) => ({ date, commits, others });

function emptyRaw() {
  return { createdAt: '2020-01-01T00:00:00Z', repos: [], yearly: [], days: [] };
}

// ---------- buildDailyMap ----------

test('buildDailyMap suma commits + others por día UTC y fusiona duplicados', () => {
  const m = buildDailyMap([day('2026-10-20', 2, 1), day('2026-10-20', 1, 0), day('2026-10-21', 0, 0)]);
  assert.equal(m.get('2026-10-20'), 4);
  assert.equal(m.get('2026-10-21'), 0);
  assert.equal(m.size, 2);
});

test('buildDailyMap normaliza fechas con hora a su día UTC', () => {
  const m = buildDailyMap([day('2026-10-20T23:30:00-02:00', 1, 0)]);
  assert.equal(m.get('2026-10-21'), 1);
});

test('buildDailyMap con lista vacía o ausente devuelve un mapa vacío', () => {
  assert.equal(buildDailyMap([]).size, 0);
  assert.equal(buildDailyMap(undefined).size, 0);
});

// ---------- lenguajes ----------

test('aggregateLanguages suma bytes entre repos, excluye marcado y ordena por bytes', () => {
  const repos = [
    { isPrivate: false, stars: 0, languages: [{ name: 'JavaScript', bytes: 300 }, { name: 'HTML', bytes: 9000 }] },
    { isPrivate: true, stars: 0, languages: [{ name: 'C#', bytes: 500 }, { name: 'JavaScript', bytes: 100 }, { name: 'CSS', bytes: 8000 }] },
    { isPrivate: false, stars: 0, languages: [{ name: 'SCSS', bytes: 1 }, { name: 'Markdown', bytes: 1 }, { name: 'MDX', bytes: 1 }, { name: 'Sass', bytes: 1 }, { name: 'Less', bytes: 1 }] },
  ];
  const langs = aggregateLanguages(repos, cfg.languages);
  assert.deepEqual(langs.map((l) => l.name), ['C#', 'JavaScript']);
  assert.equal(langs[0].bytes, 500);
  assert.equal(langs[1].bytes, 400);
  assert.ok(Math.abs(langs[0].pct - 55.5555) < 0.001);
  assert.ok(Math.abs(langs[1].pct - 44.4444) < 0.001);
});

test('aggregateLanguages: empate de bytes → orden alfabético', () => {
  const repos = [{ isPrivate: false, stars: 0, languages: [{ name: 'TypeScript', bytes: 50 }, { name: 'Python', bytes: 50 }, { name: 'Go', bytes: 50 }] }];
  assert.deepEqual(aggregateLanguages(repos, cfg.languages).map((l) => l.name), ['Go', 'Python', 'TypeScript']);
});

test('aggregateLanguages: máximo cfg.max lenguajes y porcentaje sobre el total no excluido', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const repos = [{ isPrivate: false, stars: 0, languages: names.map((name, i) => ({ name, bytes: (8 - i) * 10 })) }];
  const langs = aggregateLanguages(repos, cfg.languages);
  assert.equal(langs.length, 6);
  assert.deepEqual(langs.map((l) => l.name), ['A', 'B', 'C', 'D', 'E', 'F']);
  // Σ total = 360; A = 80 → 22.22 %
  assert.ok(Math.abs(langs[0].pct - (80 / 360) * 100) < 1e-9);
});

test('aggregateLanguages: la exclusión no distingue mayúsculas e ignora bytes 0', () => {
  const repos = [{ isPrivate: false, stars: 0, languages: [{ name: 'html', bytes: 99 }, { name: 'Rust', bytes: 0 }, { name: 'Java', bytes: 1 }] }];
  assert.deepEqual(aggregateLanguages(repos, cfg.languages).map((l) => l.name), ['Java']);
});

test('topLanguage: primero de la lista o null si no hay ninguno', () => {
  assert.equal(topLanguage([{ name: 'C#', bytes: 1, pct: 100 }]), 'C#');
  assert.equal(topLanguage([]), null);
  const onlyMarkup = [{ isPrivate: false, stars: 0, languages: [{ name: 'HTML', bytes: 10 }, { name: 'CSS', bytes: 10 }] }];
  assert.equal(topLanguage(aggregateLanguages(onlyMarkup, cfg.languages)), null);
});

// ---------- racha ----------

test('computeStreak: racha que termina hoy', () => {
  const days = [day('2026-10-20', 1), day('2026-10-21', 0, 2), day('2026-10-22', 3)];
  assert.deepEqual(computeStreak(days, TODAY), { current: 3, longest: 3 });
});

test('computeStreak: racha que termina ayer se mantiene', () => {
  const days = [day('2026-10-19', 1), day('2026-10-20', 1), day('2026-10-21', 1)];
  assert.deepEqual(computeStreak(days, TODAY), { current: 3, longest: 3 });
});

test('computeStreak: hoy y ayer sin contribuciones → racha actual 0', () => {
  const days = [day('2026-10-18', 1), day('2026-10-19', 1), day('2026-10-20', 1), day('2026-10-21', 0)];
  assert.deepEqual(computeStreak(days, TODAY), { current: 0, longest: 3 });
});

test('computeStreak: racha cortada por un día sin datos y la más larga en el pasado', () => {
  const days = [
    day('2025-01-01', 1), day('2025-01-02', 1), day('2025-01-03', 1), day('2025-01-04', 1), // 4 días
    day('2025-12-31', 1), day('2026-01-01', 1), // cruza año: 2
    day('2026-10-20', 1), /* 21 sin datos */ day('2026-10-22', 1),
  ];
  assert.deepEqual(computeStreak(days, TODAY), { current: 1, longest: 4 });
});

test('computeStreak: lista vacía → 0 y 0', () => {
  assert.deepEqual(computeStreak([], TODAY), { current: 0, longest: 0 });
});

test('computeStreak: usa el día UTC de today e ignora días posteriores a today', () => {
  const days = [day('2026-10-22', 1), day('2026-10-23', 1), day('2026-10-24', 1)];
  assert.deepEqual(computeStreak(days, '2026-10-22T23:59:00Z'), { current: 1, longest: 1 });
  assert.deepEqual(computeStreak(days, '2026-10-22T23:30:00-02:00'), { current: 2, longest: 2 });
});

// ---------- niveles 0-4 ----------

test('contributionLevels: 0 si no hay contribuciones; 1-4 por cuartiles de los días no nulos', () => {
  const window = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'];
  const totals = new Map([['d1', 0], ['d2', 1], ['d3', 2], ['d4', 3], ['d5', 4], ['d6', 5], ['d7', 6], ['d8', 7], ['d9', 8]]);
  const levels = contributionLevels(window, totals);
  // no nulos ordenados: 1..8; cuartiles (rango más cercano): q1 = 2, q2 = 4, q3 = 6
  assert.deepEqual(window.map((d) => levels.get(d)), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('contributionLevels: días sin dato → 0; todos iguales → nivel 1', () => {
  const levels = contributionLevels(['a', 'b', 'c'], new Map([['a', 5], ['c', 5]]));
  assert.deepEqual([levels.get('a'), levels.get('b'), levels.get('c')], [1, 0, 1]);
});

test('contributionLevels: un día muy alto llega a 4 y nunca se sale de 0..4', () => {
  const window = last12Months(TODAY);
  const totals = new Map(window.map((d, i) => [d, i % 3 === 0 ? 0 : (i % 17) + 1]));
  totals.set(window.at(-1), 1000);
  const levels = contributionLevels(window, totals);
  assert.equal(levels.get(window.at(-1)), 4);
  for (const d of window) assert.ok([0, 1, 2, 3, 4].includes(levels.get(d)));
});

// ---------- buildProfileStats ----------

function sampleRaw() {
  return {
    createdAt: '2019-05-01T10:00:00Z',
    repos: [
      { isPrivate: false, stars: 5, languages: [{ name: 'JavaScript', bytes: 1000 }, { name: 'HTML', bytes: 50000 }] },
      { isPrivate: true, stars: 40, languages: [{ name: 'C#', bytes: 3000 }] }, // privado (estrellas no cuentan)
      { isPrivate: false, stars: 2, languages: [] }, // archivado o perfil: también cuenta
      { isPrivate: true, stars: 0, languages: [{ name: 'Python', bytes: 1000 }] },
    ],
    yearly: [
      { year: 2024, prs: 3, issues: 1, reviews: 0 },
      { year: 2025, prs: 10, issues: 4, reviews: 2 },
      { year: 2026, prs: 7, issues: 0, reviews: 5 },
    ],
    days: [
      day('2025-10-22', 100, 0), // fuera de la ventana (366 días antes)
      day('2025-10-23', 2, 1), // primer día de la ventana
      day('2026-03-01', 4, 0),
      day('2026-10-21', 1, 1),
      day('2026-10-22', 3, 0),
    ],
  };
}

test('buildProfileStats: cifras del perfil según la tabla de la spec', () => {
  const s = buildProfileStats(sampleRaw(), TODAY, cfg);
  assert.equal(s.repositories, 4); // públicos + privados, archivados incluidos
  assert.equal(s.commitsLastYear, 2 + 4 + 1 + 3); // ventana de 365 días
  assert.equal(s.prs, 20);
  assert.equal(s.issues, 5);
  assert.equal(s.reviews, 7);
  assert.equal(s.assists, s.prs + s.issues + s.reviews);
  assert.equal(s.assists, 32);
  assert.equal(s.stars, 7); // solo públicos
  assert.equal(s.topLanguage, 'C#');
  assert.deepEqual(s.languages.map((l) => l.name), ['C#', 'JavaScript', 'Python']);
  assert.equal(s.languages[0].name, s.topLanguage);
  assert.ok(Math.abs(s.languages.reduce((a, l) => a + l.pct, 0) - 100) < 1e-9);
  assert.deepEqual(Object.keys(s.languages[0]).sort(), ['name', 'pct']);
  assert.equal(s.currentStreak, 2);
  assert.equal(s.longestStreak, 2);
  assert.equal(s.totalContributions, 100 + 3 + 4 + 2 + 3); // histórico, incluye fuera de ventana
});

test('buildProfileStats: cuadrícula de 53 semanas × 7 días con niveles 0-4 y null fuera de la ventana', () => {
  const s = buildProfileStats(sampleRaw(), TODAY, cfg);
  assert.equal(s.grid.length, 53);
  for (const week of s.grid) assert.equal(week.length, 7);
  const cells = s.grid.flat();
  assert.equal(cells.filter((c) => c !== null).length, 365);
  for (const c of cells) assert.ok(c === null || [0, 1, 2, 3, 4].includes(c));
  // 2026-10-22 es jueves → última columna [.., jue, null, null]
  const last = s.grid.at(-1);
  assert.deepEqual(last.slice(5), [null, null]);
  assert.ok(last[4] >= 1); // hoy tiene 3 contribuciones
  assert.ok(last[3] >= 1); // ayer: 2 contribuciones
  // primer día de la ventana (2025-10-23, jueves) en la primera columna
  assert.deepEqual(s.grid[0].slice(0, 4), [null, null, null, null]);
  assert.ok(s.grid[0][4] >= 1);
  // los niveles positivos son exactamente los días con contribuciones en la ventana
  assert.equal(cells.filter((c) => c > 0).length, 4);
});

test('buildProfileStats: sin datos → todo a cero sin errores', () => {
  const s = buildProfileStats(emptyRaw(), TODAY, cfg);
  assert.deepEqual(
    { ...s, grid: undefined },
    {
      repositories: 0, commitsLastYear: 0, prs: 0, issues: 0, reviews: 0, assists: 0, stars: 0,
      languages: [], topLanguage: null, currentStreak: 0, longestStreak: 0, totalContributions: 0, grid: undefined,
    },
  );
  assert.equal(s.grid.length, 53);
  assert.ok(s.grid.flat().every((c) => c === null || c === 0));
});

test('buildProfileStats tolera campos ausentes en raw', () => {
  const s = buildProfileStats({}, TODAY, cfg);
  assert.equal(s.repositories, 0);
  assert.equal(s.topLanguage, null);
  assert.equal(s.assists, 0);
});

test('buildProfileStats es determinista y no depende de la fecha real', () => {
  const a = buildProfileStats(sampleRaw(), TODAY, cfg);
  const b = buildProfileStats(sampleRaw(), new Date('2026-10-22T12:00:00Z'), cfg);
  assert.deepEqual(a, b);
  const later = buildProfileStats(sampleRaw(), '2026-10-24', cfg);
  assert.equal(later.currentStreak, 0); // ni hoy ni ayer
  assert.equal(later.commitsLastYear, 4 + 1 + 3); // 2025-10-23 sale de la ventana
});

test('buildProfileStats no expone nombres de repositorio ni campos extra', () => {
  const raw = sampleRaw();
  raw.repos[1].name = 'secret-private-repo';
  const s = buildProfileStats(raw, TODAY, cfg);
  assert.ok(!JSON.stringify(s).includes('secret-private-repo'));
  assert.deepEqual(Object.keys(s).sort(), [
    'assists', 'commitsLastYear', 'currentStreak', 'grid', 'issues', 'languages', 'longestStreak',
    'prs', 'repositories', 'reviews', 'stars', 'topLanguage', 'totalContributions',
  ]);
});
