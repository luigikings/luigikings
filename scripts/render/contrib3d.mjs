// Gráfico 3D isométrico de la cuadrícula de contribuciones (RF-36, RF-37, RF-38).
// Una sola variante con fondo opaco #0a0e1a (RNF-5). Sin cifras ni texto aparte del <title>.
//
// Cada día es un prisma cuya altura depende del nivel (0..4). Para que el peso sea bajo, hay un prisma
// por nivel definido una vez en <defs> y cada día es un <use> con su posición. Los prismas se dibujan
// de atrás hacia delante (semana y, dentro de ella, día), así las caras de delante tapan a las de detrás.
// Agrupar las caras por color en un <path> por cara y nivel rompería ese orden y se verían caras
// traseras por encima de las delanteras.
import { PALETTE } from '../lib/palette.mjs';
import { svgDoc } from '../lib/svg.mjs';
import { validateGrid } from './snake.mjs';

const ROWS = 7;
const U = [12, 3.5]; // eje de las semanas (hacia la derecha)
const V = [-7, 6]; // eje de los días (hacia abajo a la izquierda)
const K = 0.8; // tamaño de la base respecto a la celda (deja un hueco entre prismas)
const HEIGHTS = [2, 7, 13, 20, 28];
const PAD = 18;

const num = (v) => String(Math.round(v * 10) / 10);
const pt = ([x, y], h = 0) => `${num(x)} ${num(y - h)}`;

function prism(level) {
  const { blue, orange, boost, text, bg } = PALETTE;
  const color = [text, blue, blue, boost, orange][level];
  const h = HEIGHTS[level];
  const p0 = [0, 0];
  const p1 = [K * U[0], K * U[1]];
  const p3 = [K * V[0], K * V[1]];
  const p2 = [p1[0] + p3[0], p1[1] + p3[1]];
  const top = `M${pt(p0, h)}L${pt(p1, h)}L${pt(p2, h)}L${pt(p3, h)}Z`;
  const right = `M${pt(p1, h)}L${pt(p2, h)}L${pt(p2)}L${pt(p1)}Z`;
  const front = `M${pt(p3, h)}L${pt(p2, h)}L${pt(p2)}L${pt(p3)}Z`;
  // Sombreado con capas de fondo semitransparentes encima de un color opaco: el prisma sigue siendo opaco.
  const dimTop = [0.86, 0.55, 0, 0, 0][level];
  return (
    `<g id="p${level}">` +
    `<path d="${top}${right}${front}" fill="${color}"/>` +
    (dimTop ? `<path d="${top}" fill="${bg}" fill-opacity="${dimTop}"/>` : '') +
    `<path d="${right}" fill="${bg}" fill-opacity="${level === 0 ? 0.9 : 0.35}"/>` +
    `<path d="${front}" fill="${bg}" fill-opacity="${level === 0 ? 0.94 : 0.55}"/>` +
    (level > 0 ? `<path d="${top}" fill="none" stroke="${color}" stroke-width=".6"/>` : '') +
    `</g>`
  );
}

/**
 * @param {(0|1|2|3|4|null)[][]} grid semanas × 7 días (domingo..sábado), null fuera de la ventana
 * @returns {string} SVG sin minificar
 */
export function renderContrib3d(grid) {
  validateGrid(grid);
  const cols = grid.length;
  const maxH = HEIGHTS[HEIGHTS.length - 1];
  // Caja que ocupa la cuadrícula completa (no depende de los datos: el tamaño es estable).
  const minX = (ROWS - 1 + K) * V[0];
  const maxX = (cols - 1 + K) * U[0];
  const minY = -maxH;
  const maxY = (cols - 1 + K) * U[1] + (ROWS - 1 + K) * V[1];
  const width = Math.ceil(maxX - minX + 2 * PAD);
  const height = Math.ceil(maxY - minY + 2 * PAD);
  const ox = PAD - minX;
  const oy = PAD - minY;

  let cells = '';
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < ROWS; d++) {
      const v = grid[w][d];
      if (v === null) continue;
      const x = ox + w * U[0] + d * V[0];
      const y = oy + w * U[1] + d * V[1];
      cells += `<use href="#p${v}" x="${num(x)}" y="${num(y)}"/>`;
    }
  }

  const body =
    `<rect class="bg" width="${width}" height="${height}" fill="${PALETTE.bg}"/>` +
    `<defs>${[0, 1, 2, 3, 4].map(prism).join('')}</defs>` +
    cells;
  return svgDoc({
    width,
    height,
    title: 'Isometric neon chart of GitHub contributions over the last year',
    body,
  });
}
