import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, TEXT_PAIRS, contrastRatio } from '../scripts/lib/palette.mjs';

test('PALETTE coincide con la constitución', () => {
  assert.deepEqual(
    { bg: PALETTE.bg, blue: PALETTE.blue, orange: PALETTE.orange, boost: PALETTE.boost, text: PALETTE.text },
    { bg: '#0a0e1a', blue: '#00d4ff', orange: '#ff8c1a', boost: '#c04bff', text: '#e6f1ff' },
  );
});

test('contrastRatio: valores de referencia WCAG', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff') * 100) / 100, 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.equal(contrastRatio('#0a0e1a', '#e6f1ff'), contrastRatio('#e6f1ff', '#0a0e1a'));
  assert.equal(contrastRatio('#fff', '#ffffff'), 1);
});

test('contrastRatio: rechaza colores no válidos', () => {
  assert.throws(() => contrastRatio('blue', '#ffffff'), TypeError);
});

test('todos los pares de texto declarados tienen contraste >= 4.5 (RNF-5)', () => {
  assert.ok(TEXT_PAIRS.length >= 4);
  for (const { fg, bg, name } of TEXT_PAIRS) {
    const r = contrastRatio(fg, bg);
    assert.ok(r >= 4.5, `${name}: ${fg} sobre ${bg} = ${r.toFixed(2)}`);
  }
});
