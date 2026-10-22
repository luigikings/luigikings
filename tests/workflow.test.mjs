// T12: workflow .github/workflows/update-profile.yml (RF-50, RF-51, RF-53, RF-54, RF-56, RF-57, RF-58, RNF-11).
// Sin dependencias: se lee el YAML como texto con una estructura fija (2 espacios por nivel) y se
// comprueba por bloques. No ejecuta el workflow (eso queda para la ejecución real de T13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GENERATED_FILES, README_PATH } from '../scripts/update.mjs';

const WF_URL = new URL('../.github/workflows/update-profile.yml', import.meta.url);
const load = () => {
  assert.ok(existsSync(WF_URL), 'falta .github/workflows/update-profile.yml');
  return readFileSync(WF_URL, 'utf8');
};

/** Quita comentarios de línea completos y finales (" # ...") fuera de comillas simples/dobles simples. */
const stripComments = (text) =>
  text
    .split(/\r?\n/)
    .map((l) => (/^\s*#/.test(l) ? '' : l.replace(/\s+#\s.*$/, '')))
    .join('\n');

/** Bloque de nivel superior `key:` (hasta la siguiente clave sin sangría). */
const topBlock = (text, key) => {
  const m = new RegExp(`^${key}:(.*)\\n((?:(?:[ \\t]+.*)?\\n)*)`, 'm').exec(text + '\n');
  return m ? { inline: m[1].trim(), body: m[2] } : null;
};

/** Pasos del job `update`: lista de textos, uno por `- ` de la lista `steps:`. */
const steps = (text) => {
  const m = /^( +)steps:\n((?:\1 +.*\n|\s*\n)*)/m.exec(text + '\n');
  assert.ok(m, 'no hay steps');
  const indent = /^( *)- /m.exec(m[2])[1];
  return m[2].split(new RegExp(`^${indent}- `, 'm')).slice(1).map((s) => '- ' + s);
};
const stepById = (text, id) => steps(text).find((s) => new RegExp(`^\\s*(- )?id: ${id}\\s*$`, 'm').test(s));

test('el archivo existe y no usa tabuladores ni CRLF', () => {
  const wf = load();
  assert.doesNotMatch(wf, /\t/);
  assert.doesNotMatch(wf, /\r/);
});

// --- Disparadores (RF-50, RF-57) ----------------------------------------------------

test('on: schedule diario a las 05:17 UTC y workflow_dispatch, sin push ni otros disparadores', () => {
  const wf = stripComments(load());
  const on = topBlock(wf, 'on');
  assert.ok(on, 'falta on:');
  assert.equal(on.inline, '');
  const triggers = [...on.body.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual(triggers, ['schedule', 'workflow_dispatch']);
  const crons = [...on.body.matchAll(/cron:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(crons, ['17 5 * * *']);
  assert.doesNotMatch(wf, /^\s*(push|pull_request|pull_request_target|workflow_run|repository_dispatch):/m);
});

// --- Permisos (RF-56, RNF-11) -------------------------------------------------------

test('permissions: solo contents: write, a nivel de workflow, y ningún job los amplía', () => {
  const wf = stripComments(load());
  const perms = topBlock(wf, 'permissions');
  assert.ok(perms, 'falta permissions:');
  assert.equal(perms.inline, '');
  const entries = perms.body.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(entries, ['contents: write']);
  assert.equal(wf.match(/^\s*permissions:/gm).length, 1, 'permissions solo una vez (sin permisos por job)');
  assert.doesNotMatch(wf, /write-all|read-all/);
});

// --- Concurrencia -------------------------------------------------------------------

test('concurrency: grupo update-profile sin cancelar la ejecución en curso', () => {
  const wf = stripComments(load());
  const c = topBlock(wf, 'concurrency');
  assert.ok(c, 'falta concurrency:');
  assert.match(c.body, /^\s+group:\s*update-profile\s*$/m);
  assert.match(c.body, /^\s+cancel-in-progress:\s*false\s*$/m);
});

// --- Acciones (RNF-11) --------------------------------------------------------------

test('solo actions/checkout@v4 y actions/setup-node@v4 con Node 24', () => {
  const wf = stripComments(load());
  const uses = [...wf.matchAll(/^\s*(?:- )?uses:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(uses, ['actions/checkout@v4', 'actions/setup-node@v4']);
  const setup = steps(wf).find((s) => s.includes('actions/setup-node@v4'));
  assert.match(setup, /^\s+node-version:\s*["']?24["']?\s*$/m);
});

test('checkout no recibe la credencial personal (guarda con GITHUB_TOKEN)', () => {
  const wf = stripComments(load());
  const checkout = steps(wf).find((s) => s.includes('actions/checkout@v4'));
  assert.doesNotMatch(checkout, /token:/);
  assert.doesNotMatch(checkout, /persist-credentials:\s*false/);
});

// --- Secretos (RF-56, RNF-11) -------------------------------------------------------

test('PROFILE_READ_TOKEN y YOUTUBE_API_KEY vía secrets. solo en el paso que ejecuta update.mjs', () => {
  const wf = stripComments(load());
  const run = stepById(wf, 'run');
  assert.ok(run, 'falta el paso id: run');
  assert.match(run, /^\s+run:\s*node scripts\/update\.mjs\s*$/m);
  assert.match(run, /^\s+PROFILE_READ_TOKEN:\s*\$\{\{\s*secrets\.PROFILE_READ_TOKEN\s*\}\}\s*$/m);
  assert.match(run, /^\s+YOUTUBE_API_KEY:\s*\$\{\{\s*secrets\.YOUTUBE_API_KEY\s*\}\}\s*$/m);
  const all = [...wf.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(all, ['PROFILE_READ_TOKEN', 'YOUTUBE_API_KEY'], 'ningún otro uso de secrets.');
  for (const s of steps(wf).filter((x) => x !== run)) assert.doesNotMatch(s, /secrets\./);
  assert.doesNotMatch(wf, /^env:/m, 'sin env a nivel de workflow');
});

test('no hay secretos literales ni volcados de entorno en el workflow', () => {
  const wf = load();
  assert.doesNotMatch(wf, /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(wf, /\bprintenv\b|\benv\s*$|set -x|toJSON\(\s*secrets/m);
});

// --- Ejecución y fallo (RF-51, RF-53) -----------------------------------------------

test('el paso de actualización no corta el job: el guardado se ejecuta después aunque haya fallos', () => {
  const wf = stripComments(load());
  const run = stepById(wf, 'run');
  assert.match(run, /^\s+continue-on-error:\s*true\s*$/m);
  const all = steps(wf);
  const i = all.indexOf(run);
  const save = all[i + 1];
  assert.ok(save && /git push/.test(save), 'el guardado va justo después del paso run');
  assert.doesNotMatch(save, /^\s+if:/m, 'el guardado no depende de que run acabe en verde');
});

test('paso final que falla si failed == true (o si update.mjs terminó con error)', () => {
  const wf = stripComments(load());
  const all = steps(wf);
  const last = all[all.length - 1];
  assert.match(last, /^\s+if:.*steps\.run\.outputs\.failed\s*==\s*'true'/m);
  assert.match(last, /^\s+if:.*steps\.run\.outcome\s*!=\s*'success'/m);
  assert.match(last, /exit 1/);
});

// --- Guardado (RF-54, RF-56, RF-57, RF-58) ------------------------------------------

test('guardado: solo las piezas generadas y el README, sin commit si no hay cambios', () => {
  const wf = stripComments(load());
  const save = steps(wf).find((s) => /git push/.test(s));
  const dirs = [...new Set(Object.values(GENERATED_FILES).map((p) => p.split('/').slice(0, -1).join('/')))];
  assert.deepEqual(dirs, ['assets/generated']);
  assert.match(save, new RegExp(`git add ${dirs[0]} ${README_PATH.replace('.', '\\.')}\\b`));
  assert.doesNotMatch(save, /git add (-A|\.|--all)/);
  const noChanges = save.search(/git diff --cached --quiet/);
  const commit = save.search(/git commit/);
  assert.ok(noChanges > -1 && noChanges < commit, 'comprueba si hay cambios antes del commit');
  assert.match(save, /git diff --cached --quiet[^\n]*\n?[^\n]*exit 0/);
});

test('guardado: un único reintento tras pull --rebase, sin forzar ni usar la credencial personal', () => {
  const wf = stripComments(load());
  const save = steps(wf).find((s) => /git push/.test(s));
  assert.equal(save.match(/git pull --rebase/g).length, 1);
  assert.equal(save.match(/git push\b/g).length, 2, 'push inicial + un reintento');
  assert.ok(save.indexOf('git pull --rebase') < save.lastIndexOf('git push'));
  assert.match(save, /git rebase --abort/, 'si el rebase tiene conflictos se aborta sin sobrescribir');
  assert.doesNotMatch(save, /--force|-f\b|\+HEAD|reset --hard/);
  assert.doesNotMatch(save, /PROFILE_READ_TOKEN|secrets\./);
  assert.match(save, /^\s+shell:\s*bash\s*$/m, 'bash con -e -o pipefail');
});

test('el commit del bot lleva identidad de github-actions y mensaje fijo sin datos variables', () => {
  const wf = stripComments(load());
  const save = steps(wf).find((s) => /git push/.test(s));
  assert.match(save, /git config user\.name "github-actions\[bot\]"/);
  assert.match(save, /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/);
  assert.match(save, /git commit -m "chore: actualizar perfil \[bot\]"/);
});

test('el job tiene timeout y corre en ubuntu-latest', () => {
  const wf = stripComments(load());
  assert.match(wf, /^ {2}update:\s*$/m);
  assert.match(wf, /^ {4}runs-on:\s*ubuntu-latest\s*$/m);
  assert.match(wf, /^ {4}timeout-minutes:\s*\d+\s*$/m);
});
