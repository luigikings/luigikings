// Uso único y manual (RF-40): deduce el ID del canal (UC…) a partir de su handle y lo imprime.
// NO escribe config/profile.json: el usuario comprueba el ID y da el OK para fijarlo a mano.
//
// Uso (PowerShell):  $env:YOUTUBE_API_KEY="…"; node scripts/resolve-channel-id.mjs @lk_rl
// Uso (bash):        YOUTUBE_API_KEY=… node scripts/resolve-channel-id.mjs @lk_rl
// Sin handle, usa youtube.handle de config/profile.json. Gasta 1 unidad de cuota.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveChannelId, YouTubeApiError } from './lib/youtube-api.mjs';

const CONFIG_PATH = fileURLToPath(new URL('../config/profile.json', import.meta.url));

function configHandle() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))?.youtube?.handle;
  } catch {
    return undefined;
  }
}

/**
 * @param {{argv?: string[], env?: object, fetch?: Function, stdout?: {write: Function}, stderr?: {write: Function}}} deps
 * @returns {Promise<number>} código de salida
 */
export async function main({ argv = process.argv.slice(2), env = process.env, fetch: fetchFn = globalThis.fetch, stdout = process.stdout, stderr = process.stderr } = {}) {
  const handle = argv[0] ?? configHandle();
  try {
    const id = await resolveChannelId({ fetch: fetchFn, key: env.YOUTUBE_API_KEY, handle });
    stdout.write(id + '\n');
    stderr.write(
      `Handle ${handle} → ${id}\n` +
        `Comprueba que es tu canal: https://www.youtube.com/channel/${id}\n` +
        'Si es correcto, da el OK para fijarlo en config/profile.json (youtube.channelId). Este script no lo escribe.\n',
    );
    return 0;
  } catch (e) {
    if (e instanceof YouTubeApiError) {
      stderr.write(`Error: ${e.code}${e.status ? ` (HTTP ${e.status})` : ''}\n`);
      if (e.code === 'missing-key') stderr.write('Define la variable de entorno YOUTUBE_API_KEY con tu clave de YouTube Data API v3.\n');
      if (e.code === 'not-found') stderr.write(`No hay ningún canal con el handle ${handle}.\n`);
    } else {
      stderr.write(`Error: ${e instanceof TypeError ? e.message : 'inesperado'}\n`);
    }
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
