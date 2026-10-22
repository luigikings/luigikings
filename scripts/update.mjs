// Orquestador de la actualización automática del perfil (RF-51 a RF-55, RF-59 a RF-65, RF-18).
//
// Uso:
//   node scripts/update.mjs           Actualización normal (la lanza el workflow).
//   node scripts/update.mjs --seed    Archivos iniciales (RF-60): piezas con stats vacías ("0" y "—") y
//                                     bloques ALT:* del README con esos valores. Sin red ni secretos.
//                                     No toca la sección de YouTube.
//
// Variables de entorno:
//   PROFILE_READ_TOKEN  credencial de GitHub de solo lectura (grupo GitHub).
//   YOUTUBE_API_KEY     clave de YouTube Data API v3 (grupo YouTube).
//   GITHUB_OUTPUT       (la define Actions) se le añade "failed=true|false".
//
// Códigos de salida: 0 = todo bien; 1 = algún grupo falló (lo que salió bien ya está guardado);
//                    2 = uso incorrecto o configuración ilegible (no se escribe nada).
//
// Grupos independientes (RF-52):
//   github  = marcador + tarjetas de stats, lenguajes y racha + 4 bloques ALT:*, todo o nada (RF-39, RF-64, RF-65).
//   contrib = snake claro/oscuro + 3D. Se calcula del mismo ProfileStats que "github": si falla la obtención de
//             datos de GitHub fallan los dos, pero un fallo de render o de los ALT:* de uno no afecta al otro.
//   youtube = bloque entre <!-- YOUTUBE:START --> y <!-- YOUTUBE:END --> (RF-61, RF-62).
// Todo se calcula en memoria; al final solo se escriben los archivos cuyo contenido cambia (RF-54),
// con escritura atómica. La salida solo muestra códigos de error fijos: nunca mensajes de la API,
// secretos ni nombres de repositorios (RF-18, RNF-11).
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchProfile, GitHubApiError } from './lib/github-api.mjs';
import { fetchLatest, YouTubeApiError } from './lib/youtube-api.mjs';
import { buildProfileStats } from './lib/stats.mjs';
import { buildAltTexts } from './lib/alt.mjs';
import { minifySvg } from './lib/svg.mjs';
import {
  applyStatsAlts,
  hasAnyStatsMarker,
  replaceBetweenMarkers,
  renderYoutubeSection,
  YOUTUBE_START,
  YOUTUBE_END,
} from './lib/readme.mjs';
import { renderScoreboard } from './render/scoreboard.mjs';
import { renderStatsCard, renderLanguagesCard, renderStreakCard } from './render/cards.mjs';
import { renderSnake } from './render/snake.mjs';
import { renderContrib3d } from './render/contrib3d.mjs';

export const README_PATH = 'README.md';
export const CONFIG_PATH = 'config/profile.json';

/** Piezas dinámicas (rutas relativas a la raíz del repo, con "/"). */
export const GENERATED_FILES = Object.freeze({
  scoreboard: 'assets/generated/scoreboard.svg',
  stats: 'assets/generated/stats.svg',
  languages: 'assets/generated/languages.svg',
  streak: 'assets/generated/streak.svg',
  snakeDark: 'assets/generated/snake-dark.svg',
  snakeLight: 'assets/generated/snake-light.svg',
  contrib3d: 'assets/generated/contrib-3d.svg',
});

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Error de uso o de configuración (código de salida 2). */
class FatalError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Código fijo y sin datos sensibles para la salida. Nunca se imprime `e.message`. */
export function errorCode(e) {
  if (e instanceof GitHubApiError || e instanceof YouTubeApiError) return e.code;
  if (e?.code === 'readme-markers') return 'readme-markers';
  return 'internal';
}

const minifyAll = (svgs) => Object.fromEntries(Object.entries(svgs).map(([k, svg]) => [GENERATED_FILES[k], minifySvg(svg)]));

/**
 * Grupo marcador + tarjetas, ya minificadas, y los textos alternativos (mismo `stats`, RF-39). Pura.
 * @returns {{files: Record<string, string>, alts: ReturnType<typeof buildAltTexts>}}
 */
export function renderStatsGroup(stats) {
  const alts = buildAltTexts(stats);
  const files = minifyAll({
    scoreboard: renderScoreboard(stats),
    stats: renderStatsCard(stats),
    languages: renderLanguagesCard(stats),
    streak: renderStreakCard(stats),
  });
  return { files, alts };
}

/** Renderers del grupo contrib; inyectables en tests para simular un fallo de render. */
export const CONTRIB_RENDERERS = Object.freeze({ renderSnake, renderContrib3d });

/**
 * Grupo snake claro/oscuro + 3D, ya minificados. Pura.
 * @returns {Record<string, string>}
 */
export function renderContribGroup(stats, renderers = CONTRIB_RENDERERS) {
  const r = { ...CONTRIB_RENDERERS, ...renderers };
  return minifyAll({
    snakeDark: r.renderSnake(stats.grid, 'dark'),
    snakeLight: r.renderSnake(stats.grid, 'light'),
    contrib3d: r.renderContrib3d(stats.grid),
  });
}

function readConfig(fs) {
  const text = fs.read(CONFIG_PATH);
  if (text === null) throw new FatalError('config-missing');
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch {
    throw new FatalError('config-invalid');
  }
  if (!cfg || typeof cfg.githubUser !== 'string' || !cfg.youtube || !cfg.languages) throw new FatalError('config-invalid');
  return cfg;
}

/**
 * Ejecuta la actualización. Red, disco y fecha inyectados (y los renderers de snake/3D, solo para tests).
 * @param {{seed?: boolean, env?: object, fetch?: Function, now: Date, renderers?: object,
 *          fs: {read: (p: string) => string|null, write: (p: string, c: string) => void}}} deps
 * @returns {Promise<{failed: {group: string, code: string}[], written: string[], notes: string[]}>}
 * @throws {FatalError} configuración ausente o ilegible (no se escribe nada)
 */
export async function runUpdate({ seed = false, env = {}, fetch: fetchFn, now, fs, renderers }) {
  const cfg = readConfig(fs);
  const failed = [];
  const notes = [];
  const outputs = {};
  const original = fs.read(README_PATH) ?? '';
  let readme = original;

  // --- Datos de GitHub: fuente común de los grupos "github" y "contrib" (RF-39) ---
  let stats = null;
  try {
    if (seed) {
      stats = buildProfileStats({}, now, cfg);
    } else {
      const raw = await fetchProfile({ fetch: fetchFn, token: env.PROFILE_READ_TOKEN, today: now, login: cfg.githubUser });
      stats = buildProfileStats(raw, now, cfg);
    }
  } catch (e) {
    const code = errorCode(e);
    failed.push({ group: 'github', code }, { group: 'contrib', code });
  }

  if (stats) {
    // --- Grupo "github": marcador + tarjetas + ALT:*, todo o nada (RF-52, RF-65) ---
    try {
      const { files, alts } = renderStatsGroup(stats);
      let readmeG = readme;
      if (seed && !hasAnyStatsMarker(readme)) {
        notes.push('README sin bloques ALT:*: no se toca (vuelve a ejecutar --seed con el README nuevo).');
      } else {
        readmeG = applyStatsAlts(readme, alts);
      }
      Object.assign(outputs, files);
      readme = readmeG;
    } catch (e) {
      failed.push({ group: 'github', code: errorCode(e) });
    }

    // --- Grupo "contrib": snake claro/oscuro + 3D, independiente del anterior (RF-52) ---
    try {
      Object.assign(outputs, renderContribGroup(stats, renderers));
    } catch (e) {
      failed.push({ group: 'contrib', code: errorCode(e) });
    }
  }

  // --- Grupo YouTube (no en --seed) ---
  if (!seed) {
    try {
      const yt = cfg.youtube;
      const videos = await fetchLatest({
        fetch: fetchFn,
        key: env.YOUTUBE_API_KEY,
        channelId: yt.channelId,
        count: yt.count,
        shortsMaxSeconds: yt.shortsMaxSeconds,
        premiereMaxGapSeconds: yt.premiereMaxGapSeconds,
      });
      const section = renderYoutubeSection(videos, `https://youtube.com/${yt.handle}`, { titleMaxChars: yt.titleMaxChars });
      readme = replaceBetweenMarkers(readme, YOUTUBE_START, YOUTUBE_END, section);
    } catch (e) {
      failed.push({ group: 'youtube', code: errorCode(e) });
    }
  }

  if (readme !== original) outputs[README_PATH] = readme;

  // --- Escritura: solo lo que cambia (RF-54) ---
  const written = [];
  for (const [path, content] of Object.entries(outputs)) {
    if (fs.read(path) === content) continue;
    fs.write(path, content);
    written.push(path);
  }
  return { failed, written, notes };
}

/**
 * Disco real con raíz `root`. `write` es atómica: escribe un temporal en la misma carpeta y lo renombra.
 * Rechaza rutas fuera de la raíz.
 */
export function createNodeFs(root = ROOT) {
  const abs = (p) => {
    const full = resolve(root, p);
    const rel = relative(resolve(root), full);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`ruta fuera de la raíz: ${p}`);
    return full;
  };
  return {
    read(p) {
      try {
        return readFileSync(abs(p), 'utf8');
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    write(p, content) {
      const full = abs(p);
      mkdirSync(dirname(full), { recursive: true });
      const tmp = `${full}.${process.pid}.tmp`;
      try {
        writeFileSync(tmp, content, 'utf8');
        renameSync(tmp, full);
      } catch (e) {
        rmSync(tmp, { force: true });
        throw e;
      }
    },
  };
}

const USAGE = 'Uso: node scripts/update.mjs [--seed]\n';

/**
 * Punto de entrada con dependencias inyectables.
 * @returns {Promise<number>} código de salida (0, 1 o 2)
 */
export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetch: fetchFn = globalThis.fetch,
  now = new Date(),
  fs = createNodeFs(),
  stdout = process.stdout,
  stderr = process.stderr,
  appendFile = appendFileSync,
  renderers,
} = {}) {
  const setOutput = (failed) => {
    if (env.GITHUB_OUTPUT) appendFile(env.GITHUB_OUTPUT, `failed=${failed}\n`);
  };

  const unknown = argv.filter((a) => a !== '--seed');
  if (unknown.length) {
    stderr.write(`Opción desconocida: ${unknown.map((a) => a.replace(/[^\w-]/g, '?')).join(' ')}\n${USAGE}`);
    return 2;
  }
  const seed = argv.includes('--seed');

  let result;
  try {
    result = await runUpdate({ seed, env, fetch: fetchFn, now, fs, renderers });
  } catch (e) {
    stderr.write(`Error: ${e instanceof FatalError ? e.code : 'internal'}\n`);
    setOutput(true);
    return 2;
  }

  const { failed, written, notes } = result;
  const groups = seed ? ['github', 'contrib'] : ['github', 'contrib', 'youtube'];
  for (const g of groups) {
    const f = failed.find((x) => x.group === g);
    (f ? stderr : stdout).write(f ? `${g}: ${f.code}\n` : `${g}: ok\n`);
  }
  for (const n of notes) stdout.write(`Nota: ${n}\n`);
  stdout.write(written.length ? written.map((p) => `escrito ${p.split(sep).join('/')}\n`).join('') : 'sin cambios\n');

  setOutput(failed.length > 0);
  return failed.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
