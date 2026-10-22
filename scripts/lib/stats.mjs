// Cálculos puros del perfil (RF-13 a RF-16, RF-33, RF-34, RF-39).
// No leen la fecha actual, la red ni el disco: `today` y los datos se inyectan.
import { utcDay, last12Months, weekGrid } from './dates.mjs';

const DAY_MS = 86_400_000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Mapa día UTC "YYYY-MM-DD" → contribuciones totales (commits + others). Fusiona duplicados.
 * @param {{date: string, commits?: number, others?: number}[]} [days]
 * @returns {Map<string, number>}
 */
export function buildDailyMap(days = []) {
  const map = new Map();
  for (const d of days ?? []) {
    const key = utcDay(d.date);
    map.set(key, (map.get(key) ?? 0) + num(d.commits) + num(d.others));
  }
  return map;
}

/**
 * Suma bytes por lenguaje en todos los repos, excluye los de `exclude` (sin distinguir mayúsculas)
 * y los de 0 bytes, ordena por bytes desc y nombre asc, y devuelve los `max` primeros.
 * `pct` = bytes / Σ bytes de todos los lenguajes no excluidos × 100.
 * @returns {{name: string, bytes: number, pct: number}[]}
 */
export function aggregateLanguages(repos = [], { exclude = [], max = 6 } = {}) {
  const excluded = new Set(exclude.map((n) => n.toLowerCase()));
  const totals = new Map();
  for (const repo of repos ?? []) {
    for (const { name, bytes } of repo.languages ?? []) {
      if (typeof name !== 'string' || excluded.has(name.toLowerCase())) continue;
      totals.set(name, (totals.get(name) ?? 0) + num(bytes));
    }
  }
  const all = [...totals].filter(([, bytes]) => bytes > 0);
  const sum = all.reduce((acc, [, bytes]) => acc + bytes, 0);
  return all
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, max)
    .map(([name, bytes]) => ({ name, bytes, pct: (bytes / sum) * 100 }));
}

/** Nombre del lenguaje top (el primero de `aggregateLanguages`) o null. */
export function topLanguage(languages) {
  return languages[0]?.name ?? null;
}

const nextDay = (key) => new Date(Date.parse(key + 'T00:00:00Z') + DAY_MS).toISOString().slice(0, 10);
const prevDay = (key) => new Date(Date.parse(key + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10);

/**
 * Racha actual (termina hoy o ayer, UTC) y racha más larga. Ignora días posteriores a `today`.
 * @param {{date: string, commits?: number, others?: number}[]} days
 * @returns {{current: number, longest: number}}
 */
export function computeStreak(days, today) {
  const todayKey = utcDay(today);
  const totals = buildDailyMap(days);
  const active = [...totals].filter(([d, n]) => n > 0 && d <= todayKey).map(([d]) => d).sort();

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of active) {
    run = prev !== null && nextDay(prev) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  const has = (d) => (totals.get(d) ?? 0) > 0;
  let cursor = has(todayKey) ? todayKey : has(prevDay(todayKey)) ? prevDay(todayKey) : null;
  let current = 0;
  while (cursor !== null && has(cursor)) {
    current++;
    cursor = prevDay(cursor);
  }
  return { current, longest };
}

/**
 * Nivel 0..4 de cada día de la ventana: 0 si no hay contribuciones; si no, 1..4 según los
 * cuartiles (rango más cercano) de los totales no nulos de la ventana: ≤ q1 → 1, ≤ q2 → 2, ≤ q3 → 3, resto → 4.
 * @param {string[]} window días "YYYY-MM-DD"
 * @param {Map<string, number>} totals
 * @returns {Map<string, number>}
 */
export function contributionLevels(window, totals) {
  const values = window.map((d) => totals.get(d) ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
  const q = (p) => values[Math.ceil(p * values.length) - 1];
  const [q1, q2, q3] = values.length ? [q(0.25), q(0.5), q(0.75)] : [0, 0, 0];
  const levels = new Map();
  for (const d of window) {
    const n = totals.get(d) ?? 0;
    levels.set(d, n <= 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);
  }
  return levels;
}

/**
 * Única fuente de datos del marcador y de las tarjetas de stats, lenguajes y racha (RF-39),
 * y de la cuadrícula de la snake y del 3D.
 * @param {object} raw salida de github-api.mjs ({createdAt, repos, yearly, days})
 * @param {Date|string} today
 * @param {{languages: {exclude: string[], max: number}}} cfg config/profile.json
 */
export function buildProfileStats(raw, today, cfg) {
  const repos = raw?.repos ?? [];
  const yearly = raw?.yearly ?? [];
  const totals = buildDailyMap(raw?.days);
  const window = last12Months(today);
  const inWindow = new Set(window);

  let commitsLastYear = 0;
  for (const d of raw?.days ?? []) if (inWindow.has(utcDay(d.date))) commitsLastYear += num(d.commits);

  const sumYearly = (key) => yearly.reduce((acc, y) => acc + num(y[key]), 0);
  const prs = sumYearly('prs');
  const issues = sumYearly('issues');
  const reviews = sumYearly('reviews');

  const langs = aggregateLanguages(repos, cfg.languages);
  const { current, longest } = computeStreak(raw?.days ?? [], today);
  const levels = contributionLevels(window, totals);

  return {
    repositories: repos.length,
    commitsLastYear,
    prs,
    issues,
    reviews,
    assists: prs + issues + reviews,
    stars: repos.filter((r) => !r.isPrivate).reduce((acc, r) => acc + num(r.stars), 0),
    languages: langs.map(({ name, pct }) => ({ name, pct })),
    topLanguage: topLanguage(langs),
    currentStreak: current,
    longestStreak: longest,
    totalContributions: [...totals.values()].reduce((a, b) => a + b, 0),
    grid: weekGrid(window).map((week) => week.map((d) => (d === null ? null : levels.get(d)))),
  };
}
