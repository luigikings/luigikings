// Fechas en UTC. Nunca leen la fecha actual: `today` se inyecta.

const DAY_MS = 86_400_000;

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`Fecha no válida: ${value}`);
  return d;
}

/** Día UTC "YYYY-MM-DD" de una fecha (Date, ISO o "YYYY-MM-DD"). */
export function utcDay(value) {
  return toDate(value).toISOString().slice(0, 10);
}

/** Los 365 días UTC que terminan en `today` (incluido), en orden ascendente. */
export function last12Months(today) {
  const end = Date.parse(utcDay(today) + 'T00:00:00Z');
  const days = [];
  for (let i = 364; i >= 0; i--) days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10));
  return days;
}

/**
 * Coloca días consecutivos en columnas de semana (domingo..sábado), como el gráfico de GitHub.
 * Las posiciones fuera de la ventana quedan a null.
 * @param {string[]} days días "YYYY-MM-DD" consecutivos y ascendentes
 * @returns {(string|null)[][]}
 */
export function weekGrid(days) {
  if (days.length === 0) return [];
  const lead = new Date(days[0] + 'T00:00:00Z').getUTCDay();
  const cells = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
