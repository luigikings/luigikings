import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utcDay, last12Months, weekGrid } from '../scripts/lib/dates.mjs';

test('utcDay devuelve el día UTC', () => {
  assert.equal(utcDay(new Date('2026-10-22T23:30:00-02:00')), '2026-10-23');
  assert.equal(utcDay('2026-10-22T00:10:00+02:00'), '2026-10-21');
  assert.equal(utcDay('2026-01-05'), '2026-01-05');
  assert.throws(() => utcDay('no es fecha'), TypeError);
});

test('last12Months: 365 días UTC terminando en today (incluido)', () => {
  const days = last12Months(new Date('2026-10-22T05:17:00Z'));
  assert.equal(days.length, 365);
  assert.equal(days.at(-1), '2026-10-22');
  assert.equal(days[0], '2025-10-23');
  for (let i = 1; i < days.length; i++) assert.ok(days[i - 1] < days[i]);
  assert.equal(new Set(days).size, 365);
});

test('last12Months cruza años bisiestos con 365 días exactos', () => {
  const days = last12Months('2028-03-01');
  assert.equal(days.length, 365);
  assert.equal(days.at(-1), '2028-03-01');
  assert.equal(days[0], '2027-03-03'); // 2027-03-03..2028-03-01 = 365 días al incluir el 29-feb
  assert.ok(days.includes('2028-02-29'));
});

test('last12Months usa el día UTC de la fecha inyectada', () => {
  assert.equal(last12Months('2026-10-22T23:30:00-02:00').at(-1), '2026-10-23');
});

test('weekGrid: columnas domingo..sábado con null fuera de la ventana', () => {
  const days = last12Months('2026-10-22'); // 2026-10-22 es jueves
  const grid = weekGrid(days);
  for (const week of grid) assert.equal(week.length, 7);
  assert.equal(grid.flat().filter(Boolean).length, 365);
  assert.deepEqual(grid.flat().filter(Boolean), days);
  assert.equal(new Date(grid[0].find(Boolean) + 'T00:00:00Z').getUTCDay(), new Date(days[0] + 'T00:00:00Z').getUTCDay());
  const last = grid.at(-1);
  assert.equal(last[4], '2026-10-22');
  assert.deepEqual(last.slice(5), [null, null]);
  assert.equal(grid.length, 53);
});
