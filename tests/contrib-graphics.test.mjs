// T6: snake (claro/oscuro) y gráfico 3D de contribuciones generados en casa
// (RF-35, RF-36, RF-37, RF-38, RNF-8, RNF-9).
// Las cuadrículas son de ejemplo, generadas aquí: no son datos reales del usuario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSnake, SNAKE_CYCLE_S, validateGrid } from '../scripts/render/snake.mjs';
import { renderContrib3d } from '../scripts/render/contrib3d.mjs';
import { buildProfileStats } from '../scripts/lib/stats.mjs';
import { minifySvg } from '../scripts/lib/svg.mjs';
import { assertSvgRules, animationDurations, visibleText, assertOpaqueDarkBackground, MAX_SVG_BYTES } from './helpers/svg-rules.mjs';

/** Tope duro para snake y 3D: RNF-8 permite superar 100 KB (solo se avisa), pero no sin límite. */
const HARD_MAX = 512 * 1024;

/** Cuadrícula de ejemplo 53 × 7 con huecos null al principio y al final, como la de stats (T4). */
function sampleGrid() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: 53 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      if ((w === 0 && d < 3) || (w === 52 && d > 3)) return null;
      const r = rnd();
      return r < 0.45 ? 0 : r < 0.65 ? 1 : r < 0.8 ? 2 : r < 0.92 ? 3 : 4;
    }),
  );
}

/** Peor caso de peso: todas las celdas a nivel 4. */
const fullGrid = () => Array.from({ length: 53 }, () => Array(7).fill(4));

/** Cuadrícula del perfil vacío (la misma forma que dará T4 sin datos). */
const emptyGrid = () => buildProfileStats({}, '2026-10-22', {}).grid;

const count = (svg, re) => (svg.match(re) ?? []).length;

const PIECES = [
  ['snake oscuro', (g) => renderSnake(g, 'dark')],
  ['snake claro', (g) => renderSnake(g, 'light')],
  ['gráfico 3D', (g) => renderContrib3d(g)],
];

function checkWeight(t, name, raw) {
  const min = minifySvg(raw);
  assert.ok(min.length <= raw.length, `${name}: minifySvg aumenta el tamaño`);
  const bytes = Buffer.byteLength(min, 'utf8');
  t.diagnostic(`${name}: ${bytes} B minificado (${Buffer.byteLength(raw, 'utf8')} B sin minificar)`);
  if (bytes >= MAX_SVG_BYTES) t.diagnostic(`AVISO RNF-8: ${name} supera 100 KB (${bytes} B), excepción documentada`);
  return min;
}

for (const [name, render] of PIECES) {
  for (const [gname, grid] of [['ejemplo', sampleGrid()], ['lleno de nivel 4', fullGrid()], ['vacío', emptyGrid()]]) {
    test(`${name} (${gname}): reglas de SVG, sin cifras y peso registrado (RF-37, RF-38, RNF-8)`, (t) => {
      const raw = render(grid);
      const min = checkWeight(t, `${name} ${gname}`, raw);
      for (const svg of [raw, min]) {
        assertSvgRules(svg, name, { animated: name.startsWith('snake'), maxBytes: HARD_MAX });
        assert.doesNotMatch(svg, /\n/, `${name}: el SVG va en una línea`);
        assert.doesNotMatch(svg, /<text\b|<tspan\b/, `${name}: no debe tener texto visible`);
        assert.equal(visibleText(svg), '');
        assert.doesNotMatch(svg, /rgba?\(|hsla?\(/, `${name}: colores fuera de la paleta`);
        const title = /<title>([^<]*)<\/title>/.exec(svg)[1];
        assert.doesNotMatch(title, /\d/, `${name}: el <title> no lleva cifras`);
        assert.match(title, /contribution/i);
      }
    });
  }
}

test('snake: el ciclo de la serpiente dura ≥ 1 s y se para con prefers-reduced-motion (RNF-9)', () => {
  assert.ok(SNAKE_CYCLE_S >= 1);
  for (const theme of ['dark', 'light']) {
    const svg = renderSnake(sampleGrid(), theme);
    const durations = animationDurations(svg);
    assert.ok(durations.length >= 2, 'serpiente y celdas animadas');
    for (const d of durations) assert.ok(d >= 1, `animación de ${d} s`);
    assert.ok(durations.includes(SNAKE_CYCLE_S), 'la serpiente usa el ciclo declarado');
    assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\*\{animation:none!important\}\}/);
  }
});

test('snake: pinta una celda por día de la ventana con su nivel y omite los null (RF-35)', () => {
  const grid = sampleGrid();
  const svg = renderSnake(grid, 'dark');
  const flat = grid.flat();
  for (const level of [1, 2, 3, 4]) {
    assert.equal(count(svg, new RegExp(`<use href="#k" y="[\\d.]+" class="c${level}"/>`, 'g')), flat.filter((v) => v === level).length, `nivel ${level}`);
  }
  assert.equal(count(svg, /<use href="#k" y="[\d.]+"\/>/g), flat.filter((v) => v === 0).length, 'nivel 0');
  assert.equal(count(svg, /<use href="#k"/g), flat.filter((v) => v !== null).length, 'sin celdas para null');
  assert.equal(count(svg, /style="--c:\d+"/g), 53, 'una columna por semana');
});

test('snake: claro y oscuro solo cambian el color de las celdas vacías (RNF-5)', () => {
  const dark = renderSnake(sampleGrid(), 'dark');
  const light = renderSnake(sampleGrid(), 'light');
  assert.notEqual(dark, light);
  assert.match(dark, /\.w>\*\{fill:#e6f1ff/);
  assert.match(light, /\.w>\*\{fill:#0a0e1a/);
  // Sin fondo opaco: se ven sobre el fondo de GitHub de cada tema.
  assert.doesNotMatch(dark, /class="bg"/);
});

test('gráfico 3D: fondo opaco, un prisma por día y alturas por nivel (RF-36, RNF-5)', () => {
  const grid = sampleGrid();
  const svg = renderContrib3d(grid);
  assertOpaqueDarkBackground(svg, 'gráfico 3D');
  const flat = grid.flat();
  for (const level of [0, 1, 2, 3, 4]) {
    assert.equal(count(svg, new RegExp(`<use href="#p${level}" `, 'g')), flat.filter((v) => v === level).length, `nivel ${level}`);
    assert.match(svg, new RegExp(`<g id="p${level}"`), `símbolo del nivel ${level}`);
  }
});

test('gráfico 3D: los prismas se dibujan de atrás hacia delante (semana y luego día)', () => {
  const svg = renderContrib3d(fullGrid());
  const ys = [...svg.matchAll(/<use href="#p\d" x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(ys.length, 371);
  // Dentro de cada semana, cada día queda más abajo (más cerca) que el anterior.
  for (let w = 0; w < 53; w++) {
    for (let d = 1; d < 7; d++) assert.ok(ys[w * 7 + d][1] > ys[w * 7 + d - 1][1]);
  }
});

test('validateGrid: rechaza formas o valores no válidos y temas desconocidos', () => {
  assert.doesNotThrow(() => validateGrid(sampleGrid()));
  assert.throws(() => validateGrid([]), TypeError);
  assert.throws(() => validateGrid('x'), TypeError);
  assert.throws(() => validateGrid([[0, 0, 0]]), TypeError);
  assert.throws(() => validateGrid([[0, 0, 0, 0, 0, 0, 5]]), TypeError);
  assert.throws(() => validateGrid([[0, 0, 0, 0, 0, 0, '1']]), TypeError);
  assert.throws(() => renderSnake(sampleGrid(), 'blue'), TypeError);
  assert.throws(() => renderContrib3d([[1]]), TypeError);
});

test('el perfil vacío da una cuadrícula 53 × 7 que ambos renderizan', () => {
  const g = emptyGrid();
  assert.equal(g.length, 53);
  assert.ok(g.every((w) => w.length === 7));
  assert.doesNotThrow(() => renderSnake(g, 'dark'));
  assert.doesNotThrow(() => renderContrib3d(g));
});
