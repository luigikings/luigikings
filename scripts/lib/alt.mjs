// Textos alternativos con cifras del marcador y de las tarjetas de stats, lenguajes y racha
// (RF-65, RNF-7, RF-39). Fuente única: la usan el `alt` del README (applyStatsAlts) y el <title>
// de cada SVG (scoreboard.mjs, cards.mjs), así las cifras coinciden siempre. Devuelve texto plano
// (sin escapar): svgDoc lo escapa como XML y renderStatsImg como atributo HTML. Funciones puras.
import { formatNumber, formatPct } from './format.mjs';

/** Máximo de lenguajes que pinta la tarjeta (y que, por tanto, se describen). */
const MAX_LANGUAGES = 6;
const NO_LANGUAGES = 'No languages yet';

function requireStats(stats, who) {
  if (stats === null || typeof stats !== 'object') throw new TypeError(`${who}: falta ProfileStats`);
  return stats;
}

/** @param {object} stats ProfileStats */
export function scoreboardAlt(stats) {
  const s = requireStats(stats, 'scoreboardAlt');
  const top = typeof s.topLanguage === 'string' && s.topLanguage.trim() ? s.topLanguage : '—';
  return (
    `Scoreboard. Goals: ${formatNumber(s.repositories)} repositories. ` +
    `Saves: ${formatNumber(s.commitsLastYear)} commits (last year). ` +
    // Assists = PRs + issues + revisiones, como la casilla del marcador.
    `Assists: ${formatNumber(s.prs + s.issues + s.reviews)} PRs, issues & reviews. ` +
    `MVP: ${top} (top language).`
  );
}

/** @param {object} stats ProfileStats */
export function statsAlt(stats) {
  const s = requireStats(stats, 'statsAlt');
  return (
    `GitHub stats. Stars: ${formatNumber(s.stars)}. ` +
    `Commits (last year): ${formatNumber(s.commitsLastYear)}. ` +
    `Pull requests (all time): ${formatNumber(s.prs)}. ` +
    `Issues (all time): ${formatNumber(s.issues)}. ` +
    `Code reviews (all time): ${formatNumber(s.reviews)}.`
  );
}

/** @param {object} stats ProfileStats */
export function languagesAlt(stats) {
  const s = requireStats(stats, 'languagesAlt');
  if (!Array.isArray(s.languages)) throw new TypeError('languagesAlt: languages debe ser una lista');
  const langs = s.languages.slice(0, MAX_LANGUAGES).map((l) => {
    if (typeof l?.name !== 'string' || !l.name.trim()) throw new TypeError('languagesAlt: lenguaje sin nombre');
    return `${l.name} ${formatPct(l.pct)}`;
  });
  return `Top languages: ${langs.length ? langs.join(', ') : NO_LANGUAGES}.`;
}

/** @param {object} stats ProfileStats */
export function streakAlt(stats) {
  const s = requireStats(stats, 'streakAlt');
  return (
    `Contribution streak. Current streak: ${formatNumber(s.currentStreak)} days. ` +
    `Longest streak: ${formatNumber(s.longestStreak)} days. ` +
    `Total contributions: ${formatNumber(s.totalContributions)}.`
  );
}

/**
 * Los 4 textos con cifras a partir de un único ProfileStats (RF-39).
 * @param {object} stats ProfileStats
 * @returns {{scoreboard: string, stats: string, languages: string, streak: string}}
 */
export function buildAltTexts(stats) {
  requireStats(stats, 'buildAltTexts');
  return { scoreboard: scoreboardAlt(stats), stats: statsAlt(stats), languages: languagesAlt(stats), streak: streakAlt(stats) };
}
