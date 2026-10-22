// Reglas comunes de los SVG propios (RNF-3, RNF-4, RNF-6, RNF-8, RNF-9, RNF-10, RNF-7).
// Se reutiliza en las tareas que generan SVG (T2, T3, T5, T6).
import assert from 'node:assert/strict';
import { checkXml } from './xml.mjs';
import { PALETTE, contrastRatio } from '../../scripts/lib/palette.mjs';

export const MAX_SVG_BYTES = 100 * 1024;

const TIME = /(-?\d*\.?\d+)(ms|s)\b/g;

function toSeconds(value, unit) {
  return unit === 'ms' ? Number(value) / 1000 : Number(value);
}

/**
 * Duraciones de animación (en segundos) declaradas en un SVG:
 * - CSS `animation:` (la primera unidad de tiempo de cada animación es la duración)
 * - CSS `animation-duration:`
 * - SMIL `dur="..."`
 */
export function animationDurations(svg) {
  const out = [];
  for (const m of svg.matchAll(/animation\s*:\s*([^;}]+)/g)) {
    for (const part of m[1].split(',')) {
      if (/^\s*none\b/.test(part)) continue; // p. ej. prefers-reduced-motion
      const t = [...part.matchAll(TIME)][0];
      if (t) out.push(toSeconds(t[1], t[2]));
      else out.push(NaN); // animación sin duración explícita = 0 s
    }
  }
  for (const m of svg.matchAll(/animation-duration\s*:\s*([^;}]+)/g)) {
    for (const t of m[1].matchAll(TIME)) out.push(toSeconds(t[1], t[2]));
  }
  for (const m of svg.matchAll(/\bdur\s*=\s*"([^"]*)"/g)) {
    const t = [...m[1].matchAll(TIME)][0];
    out.push(t ? toSeconds(t[1], t[2]) : NaN);
  }
  return out;
}

/** Problemas de autosuficiencia: recursos externos, scripts o manejadores de eventos (RNF-4). */
export function externalProblems(svg) {
  const problems = [];
  if (/<script\b/i.test(svg)) problems.push('<script>');
  if (/<foreignObject\b/i.test(svg)) problems.push('<foreignObject>');
  if (/<image\b/i.test(svg)) problems.push('<image>');
  if (/@import/i.test(svg)) problems.push('@import');
  if (/javascript:/i.test(svg)) problems.push('javascript:');
  if (/\son[a-z]+\s*=/i.test(svg)) problems.push('manejador de eventos');
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*"([^"]*)"/g)) {
    if (!m[1].startsWith('#')) problems.push(`href externo ${m[1]}`);
  }
  for (const m of svg.matchAll(/url\(\s*['"]?([^)'"]*)/g)) {
    if (!m[1].startsWith('#')) problems.push(`url() externa ${m[1]}`);
  }
  return problems;
}

/** Colores hex usados que no son de la paleta (RNF-6). */
export function offPaletteColors(svg) {
  const allowed = new Set(Object.values(PALETTE).map((c) => c.toLowerCase()));
  const found = new Set((svg.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []).map((c) => c.toLowerCase()));
  return [...found].filter((c) => !allowed.has(c));
}

/** Texto visible: contenido de los <text>, sin etiquetas y con entidades básicas resueltas. */
export function visibleText(svg) {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, ''))
    .map((s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'))
    .join('\n');
}

/** Colores de relleno de los <text> y <tspan> (cada <text> debe declarar `fill`). */
export function textFills(svg) {
  const fills = [];
  for (const m of svg.matchAll(/<(text|tspan)\b([^>]*)>/g)) {
    const fill = /\sfill="([^"]+)"/.exec(m[2]);
    if (fill) fills.push(fill[1].toLowerCase());
    else if (m[1] === 'text') fills.push(null);
  }
  return fills;
}

/**
 * Comprueba las reglas comunes de un SVG propio.
 * @param {string} svg
 * @param {string} name nombre para los mensajes
 * @param {{animated?: boolean, maxBytes?: number}} [opts]
 */
export function assertSvgRules(svg, name, { animated = false, maxBytes = MAX_SVG_BYTES } = {}) {
  assert.equal(typeof svg, 'string', `${name}: no es un string`);
  assert.deepEqual(checkXml(svg), { ok: true }, `${name}: XML no válido`);
  assert.match(svg, /^<svg\b[^>]*\sviewBox="0 0 [\d.]+ [\d.]+"/, `${name}: falta viewBox`);
  assert.match(svg, /<title>[^<]*\S[^<]*<\/title>/, `${name}: falta <title>`);
  assert.deepEqual(externalProblems(svg), [], `${name}: recursos externos o scripts`);
  assert.deepEqual(offPaletteColors(svg), [], `${name}: colores fuera de la paleta`);
  const bytes = Buffer.byteLength(svg, 'utf8');
  assert.ok(bytes < maxBytes, `${name}: pesa ${bytes} B (máximo ${maxBytes})`);
  const durations = animationDurations(svg);
  if (animated) assert.ok(durations.length > 0, `${name}: no tiene animaciones`);
  for (const d of durations) {
    assert.ok(d >= 1, `${name}: animación de ${d} s (mínimo 1 s, RNF-9)`);
  }
}

/** Texto visible de cada <text> por separado, en una línea (incluye sus <tspan>). */
export function textNodes(svg) {
  return [...svg.matchAll(/<text\b[\s\S]*?<\/text>/g)].map((m) => visibleText(m[0]).replace(/\s+/g, ' ').trim());
}

/** Fondo opaco #0a0e1a (class="bg") que cubre todo el viewBox: una sola variante válida en ambos temas (RNF-5). */
export function assertOpaqueDarkBackground(svg, name) {
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const bg = /<rect\b[^>]*class="bg"[^>]*>/.exec(svg)?.[0];
  assert.ok(bg, `${name}: falta el fondo class="bg"`);
  assert.match(bg, /fill="#0a0e1a"/, `${name}: el fondo no es #0a0e1a`);
  assert.doesNotMatch(bg, /(fill-)?opacity="/, `${name}: el fondo no es opaco`);
  assert.match(bg, new RegExp(`width="${w}"`), `${name}: el fondo no cubre el ancho`);
  assert.match(bg, new RegExp(`height="${h}"`), `${name}: el fondo no cubre el alto`);
}

/** Todo <text>/<tspan> declara fill y contrasta >= 4.5 con el fondo #0a0e1a; sin opacidad en el texto (RNF-5). */
export function assertTextContrast(svg, name) {
  const fills = textFills(svg);
  assert.ok(fills.length > 0, `${name}: sin texto`);
  assert.ok(!fills.includes(null), `${name}: todos los <text> declaran fill`);
  for (const f of fills) {
    assert.ok(contrastRatio(f, PALETTE.bg) >= 4.5, `${name}: texto ${f} sobre ${PALETTE.bg} < 4.5`);
  }
  for (const m of svg.matchAll(/<(text|tspan)\b([^>]*)>/g)) {
    assert.doesNotMatch(m[2], /opacity=/, `${name}: texto con opacidad (baja el contraste real)`);
  }
}
