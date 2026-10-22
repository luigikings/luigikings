// Piezas dinámicas guardadas en disco (assets/generated/): las que enlaza el README (RF-60, RNF-7).
// Lee los archivos reales del repo; no usa red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runUpdate, GENERATED_FILES, CONFIG_PATH } from '../scripts/update.mjs';
import { assertSvgRules } from './helpers/svg-rules.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Piezas de --seed que no dependen de la fecha (snake y 3D dibujan la rejilla de las últimas semanas). */
const DATE_INDEPENDENT = ['scoreboard', 'stats', 'languages', 'streak'];

async function seedFiles(now) {
  const files = new Map([[CONFIG_PATH, read(CONFIG_PATH)]]);
  const fs = { read: (p) => (files.has(p) ? files.get(p) : null), write: (p, c) => files.set(p, c) };
  const res = await runUpdate({ seed: true, env: {}, fetch: () => assert.fail('sin red'), now, fs });
  assert.deepEqual(res.failed, []);
  return files;
}

const titleOf = (svg) => /<title>([^<]*)<\/title>/.exec(svg)?.[1];

test('cada SVG de assets/generated/ existe y es XML válido con viewBox, <title> y nada externo', () => {
  for (const [key, p] of Object.entries(GENERATED_FILES)) {
    const svg = read(p);
    assertSvgRules(svg, p, { maxBytes: /^(snake|contrib3d)/.test(key) ? Infinity : undefined });
  }
});

test('las piezas de --seed que no dependen de la fecha son idénticas con dos fechas distintas', async () => {
  const a = await seedFiles(new Date('2026-10-22T09:00:00Z'));
  const b = await seedFiles(new Date('2027-03-05T09:00:00Z'));
  for (const k of DATE_INDEPENDENT) assert.equal(a.get(GENERATED_FILES[k]), b.get(GENERATED_FILES[k]), k);
});

test('mientras assets/generated/ tenga las piezas iniciales, coinciden byte a byte con lo que produce --seed', async (t) => {
  const seed = await seedFiles(new Date('2026-10-22T09:00:00Z'));
  const seedTitle = titleOf(seed.get(GENERATED_FILES.scoreboard));
  if (titleOf(read(GENERATED_FILES.scoreboard)) !== seedTitle) {
    // La Action ya las regeneró con datos reales: la comparación con --seed deja de tener sentido.
    t.skip('assets/generated/ ya contiene datos reales');
    return;
  }
  for (const k of DATE_INDEPENDENT) {
    const p = GENERATED_FILES[k];
    assert.equal(read(p), seed.get(p), `${p} distinto de --seed`);
  }
});
