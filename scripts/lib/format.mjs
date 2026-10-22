// Formato de cifras del marcador y de las tarjetas (RF-17).

/** Trunca a un decimal (sin redondear) y omite ".0". Trabaja con enteros para evitar errores de coma flotante. */
function trunc1(n, unit) {
  return String(Math.floor(n / (unit / 10)) / 10);
}

/**
 * < 10 000 → "9,876"; < 1 000 000 → "10.2k"; resto → "1.2M".
 * @param {number} n entero >= 0
 */
export function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new TypeError('formatNumber espera un número finito >= 0');
  }
  n = Math.floor(n);
  if (n < 10_000) return n.toLocaleString('en-US');
  if (n < 1_000_000) return trunc1(n, 1_000) + 'k';
  return trunc1(n, 1_000_000) + 'M';
}

/** Porcentaje con un decimal redondeado ("41.2%"); por debajo de 0,05 y mayor que 0 → "<0.1%". */
export function formatPct(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0) throw new TypeError('formatPct espera un número >= 0');
  if (pct > 0 && pct < 0.05) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}
