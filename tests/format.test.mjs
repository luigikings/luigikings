import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber } from '../scripts/lib/format.mjs';

test('formatNumber: casos de RF-17', () => {
  const cases = [
    [0, '0'],
    [7, '7'],
    [9876, '9,876'],
    [9999, '9,999'],
    [10000, '10k'],
    [10290, '10.2k'],
    [10299, '10.2k'],
    [999999, '999.9k'],
    [1000000, '1M'],
    [1250000, '1.2M'],
    [1299999, '1.2M'],
  ];
  for (const [n, expected] of cases) assert.equal(formatNumber(n), expected, `formatNumber(${n})`);
});

test('formatNumber: rechaza valores no válidos', () => {
  for (const bad of [-1, NaN, Infinity, undefined, '10']) {
    assert.throws(() => formatNumber(bad), TypeError);
  }
});
