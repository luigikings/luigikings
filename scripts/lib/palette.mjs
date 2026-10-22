// Paleta de docs/constitution.md y tonos de texto por tema (RNF-5, RNF-6).

export const PALETTE = Object.freeze({
  bg: '#0a0e1a', // fondo oscuro
  blue: '#00d4ff', // equipo azul
  orange: '#ff8c1a', // equipo naranja
  boost: '#c04bff', // acento de boost
  text: '#e6f1ff', // texto claro
});

/** Fondos de página de GitHub sobre los que se ven las piezas sin fondo opaco. */
export const GITHUB_BG = Object.freeze({ light: '#ffffff', dark: '#0d1117' });

/** Color de texto por tema para las piezas sin fondo opaco (variantes en <picture>). */
export const THEME_TEXT = Object.freeze({ dark: PALETTE.text, light: PALETTE.bg });

/**
 * Pares texto/fondo permitidos. Solo estos colores se usan como texto (RNF-5).
 * En las variantes claras sin fondo opaco, los neones solo se usan como acento no textual.
 */
export const TEXT_PAIRS = Object.freeze([
  { name: 'texto claro sobre fondo opaco', fg: PALETTE.text, bg: PALETTE.bg },
  { name: 'azul neón sobre fondo opaco', fg: PALETTE.blue, bg: PALETTE.bg },
  { name: 'naranja neón sobre fondo opaco', fg: PALETTE.orange, bg: PALETTE.bg },
  { name: 'morado boost sobre fondo opaco', fg: PALETTE.boost, bg: PALETTE.bg },
  { name: 'variante oscura sobre GitHub oscuro', fg: THEME_TEXT.dark, bg: GITHUB_BG.dark },
  { name: 'variante clara sobre GitHub claro', fg: THEME_TEXT.light, bg: GITHUB_BG.light },
]);

function parseHex(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new TypeError(`Color no válido: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG 2.x entre dos colores hex (1..21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
