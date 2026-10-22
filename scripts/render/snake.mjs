// Snake de contribuciones (RF-35, RF-37, RF-38): la serpiente recorre la cuadrícula de 53 × 7 en zigzag
// por columnas (abajo, arriba, ...) y "se come" cada celda al pasar; las celdas vuelven a crecer después.
// Variantes claro/oscuro sin fondo opaco (RNF-5). Sin cifras ni texto aparte del <title>.
//
// Peso: las celdas son <use> de un único <rect>, y el retraso de cada una se calcula en CSS con
// dos variables: --c (columna, en el grupo de la columna) y --r (posición en la columna, por :nth-child).
// Así no hay un retraso escrito por celda y el peso apenas depende de los datos.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc } from '../lib/svg.mjs';

/** Duración en segundos de una vuelta completa de la serpiente (RNF-9: ≥ 1 s). */
export const SNAKE_CYCLE_S = 20;

const ROWS = 7;
const CELL = 12;
const STEP = 15;
const PAD = 16;
const SEGMENTS = 6;

/**
 * Comprueba la cuadrícula de ProfileStats: columnas (semanas) de 7 días con nivel 0..4 o null.
 * @param {unknown} grid
 */
export function validateGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) throw new TypeError('grid: debe ser un array de semanas no vacío');
  for (const week of grid) {
    if (!Array.isArray(week) || week.length !== ROWS) throw new TypeError('grid: cada semana debe tener 7 días');
    for (const v of week) {
      if (v !== null && !(Number.isInteger(v) && v >= 0 && v <= 4)) throw new TypeError(`grid: nivel no válido ${v}`);
    }
  }
}

const num = (v) => String(Math.round(v * 10000) / 10000).replace(/^0\./, '.');

/**
 * @param {(0|1|2|3|4|null)[][]} grid semanas × 7 días (domingo..sábado), null fuera de la ventana
 * @param {'dark'|'light'} theme
 * @returns {string} SVG sin minificar
 */
export function renderSnake(grid, theme) {
  if (theme !== 'dark' && theme !== 'light') throw new TypeError(`renderSnake: tema desconocido ${theme}`);
  validateGrid(grid);
  const { blue, orange, boost, text, bg } = PALETTE;
  const cols = grid.length;
  const width = 2 * PAD + cols * STEP - (STEP - CELL);
  const height = 2 * PAD + ROWS * STEP - (STEP - CELL);
  const moves = cols * ROWS - 1;
  const tCell = SNAKE_CYCLE_S / moves; // segundos que tarda la cabeza en pasar de una celda a la siguiente
  const empty = theme === 'dark' ? text : bg;

  // Recorrido de la cabeza: inicio y fin de cada columna, alternando el sentido.
  const stops = [];
  for (let c = 0; c < cols; c++) {
    const [y0, y1] = c % 2 === 0 ? [0, (ROWS - 1) * STEP] : [(ROWS - 1) * STEP, 0];
    stops.push([c * ROWS, c * STEP, y0], [c * ROWS + ROWS - 1, c * STEP, y1]);
  }
  const move = stops.map(([i, x, y]) => `${num((i / moves) * 100)}%{transform:translate(${x}px,${y}px)}`).join('');

  const style = [
    `.w>*{fill:${empty};fill-opacity:${theme === 'dark' ? '.1' : '.08'};animation:eat ${SNAKE_CYCLE_S}s linear infinite;animation-delay:calc((var(--c)*${ROWS} + var(--r))*${num(tCell)}s)}`,
    ...Array.from({ length: ROWS }, (_, r) => `.w>:nth-child(${r + 1}){--r:${r}}`),
    `.c1{fill:${blue};fill-opacity:.4}`,
    `.c2{fill:${blue};fill-opacity:.85}`,
    `.c3{fill:${boost};fill-opacity:.9}`,
    `.c4{fill:${orange};fill-opacity:1}`,
    `@keyframes eat{0%{opacity:1}1.5%{opacity:.15}55%{opacity:.15}70%{opacity:1}100%{opacity:1}}`,
    `.s{animation:move ${SNAKE_CYCLE_S}s linear infinite}`,
    `@keyframes move{${move}}`,
    ...Array.from({ length: SEGMENTS }, (_, i) =>
      `.s${i}{animation-delay:${num(i * tCell)}s;fill:${i === 0 ? orange : boost};fill-opacity:${num(1 - i * 0.12)}}`,
    ),
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
  ].join('');

  let columns = '';
  for (let c = 0; c < cols; c++) {
    // En las columnas impares la serpiente sube: se escriben de abajo arriba para que :nth-child siga el recorrido.
    const rows = c % 2 === 0 ? [0, 1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1, 0];
    const cells = rows
      .map((r) => {
        const v = grid[c][r];
        if (v === null) return '<g/>'; // hueco fuera de la ventana: mantiene la posición en :nth-child
        return `<use href="#k" y="${r * STEP}"${v > 0 ? ` class="c${v}"` : ''}/>`;
      })
      .join('');
    columns += `<g class="w" transform="translate(${c * STEP} 0)" style="--c:${c}">${cells}</g>`;
  }
  const snake = Array.from({ length: SEGMENTS }, (_, i) => SEGMENTS - 1 - i)
    .map((i) => `<rect class="s s${i}" width="${CELL}" height="${CELL}" rx="3"/>`)
    .join('');

  const body =
    `<defs><rect id="k" width="${CELL}" height="${CELL}" rx="2.5"/></defs>` +
    `<g transform="translate(${PAD} ${PAD})">${columns}${snake}</g>`;
  return svgDoc({
    width,
    height,
    title: 'Neon snake eating the GitHub contribution grid of the last year',
    style,
    body,
  });
}
