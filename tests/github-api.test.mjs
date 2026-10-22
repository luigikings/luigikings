// T7: capa de API de GitHub (RF-18, RF-63). Solo `fetch` falsos: ningún test usa la red ni tokens reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProfile, GitHubApiError, GITHUB_GRAPHQL_URL } from '../scripts/lib/github-api.mjs';
import { buildProfileStats } from '../scripts/lib/stats.mjs';
import { createFakeGitHub, sampleDataset, fixedResponse, SECRET_REPO_NAMES } from './fixtures/github-fake.mjs';

const TOKEN = 'fake-token-for-tests-only';
const TODAY = new Date('2026-10-22T09:00:00Z');
const LOGIN = 'luigikings';
const run = (fake, extra = {}) => fetchProfile({ fetch: fake.fetch, token: TOKEN, today: TODAY, login: LOGIN, ...extra });

const sumCommits = (raw, year) => raw.days.filter((d) => d.date.startsWith(`${year}-`)).reduce((a, d) => a + d.commits, 0);
const commitsInYear = (ds, year) =>
  ds.commits.filter((c) => new Date(c.occurredAt).getUTCFullYear() === year).reduce((a, c) => a + c.commitCount, 0);

// ---------- Forma de raw ----------

test('devuelve raw con createdAt, repos, yearly y days según el contrato de buildProfileStats', async () => {
  const raw = await run(createFakeGitHub());
  assert.deepEqual(Object.keys(raw).sort(), ['createdAt', 'days', 'repos', 'yearly']);
  assert.equal(raw.createdAt, '2024-03-15T10:00:00Z');
  for (const r of raw.repos) {
    assert.deepEqual(Object.keys(r).sort(), ['isPrivate', 'languages', 'stars']);
    assert.equal(typeof r.isPrivate, 'boolean');
    assert.equal(typeof r.stars, 'number');
    for (const l of r.languages) assert.deepEqual(Object.keys(l).sort(), ['bytes', 'name']);
  }
  for (const y of raw.yearly) assert.deepEqual(Object.keys(y).sort(), ['issues', 'prs', 'reviews', 'year']);
  for (const d of raw.days) {
    assert.deepEqual(Object.keys(d).sort(), ['commits', 'date', 'others']);
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('pagina los repos (130 → 2 páginas) e incluye los privados propios con sus estrellas y lenguajes', async () => {
  const fake = createFakeGitHub();
  const raw = await run(fake);
  assert.equal(raw.repos.length, 130);
  assert.equal(raw.repos.filter((r) => r.isPrivate).length, 2);
  const repoCalls = fake.calls.filter((c) => c.body.query.includes('repositories('));
  assert.equal(repoCalls.length, 2);
  assert.equal(repoCalls[0].body.variables.after, null);
  assert.equal(repoCalls[1].body.variables.after, '100');
  assert.equal(raw.repos[1].stars, 1);
  assert.deepEqual(raw.repos[1].languages, [{ name: 'JavaScript', bytes: 1001 }, { name: 'TypeScript', bytes: 500 }]);
  assert.deepEqual(raw.repos[0].languages, []);
});

test('la consulta de repos pide solo repos propios y no forks', async () => {
  const fake = createFakeGitHub();
  await run(fake);
  const q = fake.calls.find((c) => c.body.query.includes('repositories(')).body.query;
  assert.match(q, /ownerAffiliations:\s*\[?OWNER\]?/);
  assert.match(q, /isFork:\s*false/);
});

test('consulta un año por cada año desde createdAt hasta today, con from/to en UTC y recortados', async () => {
  const fake = createFakeGitHub();
  const raw = await run(fake);
  assert.deepEqual(raw.yearly.map((y) => y.year), [2024, 2025, 2026]);
  const tops = fake.calls
    .filter((c) => c.body.query.includes('commitContributionsByRepository'))
    .map((c) => c.body.variables);
  assert.ok(tops.some((v) => v.from === '2024-03-15T00:00:00Z' && v.to === '2024-12-31T23:59:59Z'));
  assert.ok(tops.some((v) => v.from === '2025-01-01T00:00:00Z' && v.to === '2025-12-31T23:59:59Z'));
  assert.ok(tops.some((v) => v.from === '2026-01-01T00:00:00Z' && v.to === '2026-10-22T23:59:59Z'));
});

test('yearly toma los totales de PRs, issues y revisiones de cada año', async () => {
  const raw = await run(createFakeGitHub());
  assert.deepEqual(raw.yearly, [
    { year: 2024, prs: 0, issues: 1, reviews: 0 },
    { year: 2025, prs: 120, issues: 250, reviews: 30 },
    { year: 2026, prs: 1, issues: 0, reviews: 0 },
  ]);
});

// ---------- Commits: paginación e invariante ----------

test('invariante: Σ commits del año en days = totalCommitContributions del año (con > 100 nodos y > 100 repos)', async () => {
  const ds = sampleDataset();
  const raw = await run(createFakeGitHub(ds));
  for (const year of [2024, 2025, 2026]) assert.equal(sumCommits(raw, year), commitsInYear(ds, year), `año ${year}`);
  assert.equal(commitsInYear(ds, 2025), 200 * 2.5 + 105 * 2);
});

test('si un año desborda (repo con > 100 nodos o > 100 repos), parte el rango en subrangos sin huecos ni solapes', async () => {
  const fake = createFakeGitHub();
  await run(fake);
  const sub = fake.calls
    .filter((c) => c.body.query.includes('commitContributionsByRepository'))
    .map((c) => c.body.variables)
    .filter((v) => v.from.startsWith('2025') && !(v.from === '2025-01-01T00:00:00Z' && v.to === '2025-12-31T23:59:59Z'));
  assert.ok(sub.length >= 2, 'debe haber subconsultas para 2025');
  for (const v of sub) assert.ok(v.from >= '2025-01-01' && v.to <= '2025-12-31T23:59:59Z');
});

test('una contribución a las 23:30 -02:00 cuenta en su día UTC (el siguiente)', async () => {
  const raw = await run(createFakeGitHub());
  assert.deepEqual(raw.days.find((d) => d.date === '2026-10-21'), { date: '2026-10-21', commits: 4, others: 0 });
  assert.equal(raw.days.find((d) => d.date === '2026-10-20'), undefined);
});

test('days tiene un único registro por día, ordenado, con others = issues + PRs + revisiones + repos creados', async () => {
  const raw = await run(createFakeGitHub());
  const dates = raw.days.map((d) => d.date);
  assert.deepEqual(dates, [...new Set(dates)].sort());
  const ds = sampleDataset();
  const totalOthers = Object.values(ds.nodes).reduce((a, list) => a + list.length, 0);
  assert.equal(raw.days.reduce((a, d) => a + d.others, 0), totalOthers);
  assert.equal(raw.days.find((d) => d.date === '2026-10-22').others, 1);
});

test('pagina las conexiones de issues (250 → 3 páginas) y PRs (120 → 2 páginas)', async () => {
  const fake = createFakeGitHub();
  await run(fake);
  const issueCalls = fake.calls.filter((c) => c.body.query.includes('issueContributions(') && c.body.variables.from.startsWith('2025'));
  assert.deepEqual(issueCalls.map((c) => c.body.variables.after), [null, '100', '200']);
  const prCalls = fake.calls.filter((c) => c.body.query.includes('pullRequestContributions(') && c.body.variables.from.startsWith('2025'));
  assert.equal(prCalls.length, 2);
});

test('raw alimenta buildProfileStats sin errores', async () => {
  const raw = await run(createFakeGitHub());
  const stats = buildProfileStats(raw, TODAY, { languages: { exclude: ['HTML'], max: 6 } });
  assert.equal(stats.repositories, 130);
  assert.equal(stats.assists, 121 + 251 + 30);
  assert.equal(stats.topLanguage, 'JavaScript');
});

// ---------- Sin nombres de repos (RF-18) ----------

test('raw no contiene ningún nombre de repositorio (ni privado ni público)', async () => {
  const raw = JSON.stringify(await run(createFakeGitHub()));
  for (const name of SECRET_REPO_NAMES) assert.ok(!raw.includes(name), `aparece ${name}`);
  assert.ok(!raw.includes('public-repo-'));
  assert.ok(!raw.includes('nameWithOwner'));
});

test('las consultas no piden nombres de repositorio', async () => {
  const fake = createFakeGitHub();
  await run(fake);
  for (const c of fake.calls) {
    // El único `name` permitido es el del lenguaje: languages { edges { size node { name } } }
    const q = c.body.query.replace(/node\s*\{\s*name\s*\}/g, '');
    assert.doesNotMatch(q, /\bname\b|nameWithOwner|repository\s*\{/, c.body.query);
  }
});

// ---------- Credencial y errores (RF-63) ----------

test('las peticiones van a la API GraphQL por POST con la credencial en la cabecera', async () => {
  const fake = createFakeGitHub();
  await run(fake);
  for (const c of fake.calls) {
    assert.equal(c.url, GITHUB_GRAPHQL_URL);
    assert.equal(c.init.method, 'POST');
    assert.equal(c.init.headers.Authorization, `bearer ${TOKEN}`);
    assert.ok(!JSON.stringify(c.body).includes(TOKEN), 'el token no va en el cuerpo');
  }
});

for (const token of [undefined, null, '', '   ']) {
  test(`credencial ausente (${JSON.stringify(token)}) → GitHubApiError "missing-token" antes de usar la red`, async () => {
    const fake = createFakeGitHub();
    await assert.rejects(run(fake, { token }), (e) => e instanceof GitHubApiError && e.code === 'missing-token');
    assert.equal(fake.calls.length, 0);
  });
}

test('respuesta 401 (credencial caducada o inválida) → GitHubApiError "unauthorized"', async () => {
  const fake = fixedResponse(401, { message: `Bad credentials for ${SECRET_REPO_NAMES[0]}` });
  await assert.rejects(run(fake), (e) => {
    assert.ok(e instanceof GitHubApiError);
    assert.equal(e.code, 'unauthorized');
    assert.equal(e.status, 401);
    assert.ok(!e.message.includes(SECRET_REPO_NAMES[0]) && !e.message.includes(TOKEN));
    return true;
  });
  assert.equal(fake.calls.length, 1, 'no sigue consultando tras el error');
});

test('respuestas 403, 429 y 502 → códigos forbidden, rate-limited y http', async () => {
  for (const [status, code] of [[403, 'forbidden'], [429, 'rate-limited'], [502, 'http']]) {
    await assert.rejects(run(fixedResponse(status, {})), (e) => e instanceof GitHubApiError && e.code === code && e.status === status);
  }
});

test('errores GraphQL (permisos insuficientes) → GitHubApiError "graphql" sin el texto del error', async () => {
  const fake = fixedResponse(200, {
    data: null,
    errors: [{ type: 'FORBIDDEN', message: `Resource not accessible: ${SECRET_REPO_NAMES[1]}` }],
  });
  await assert.rejects(run(fake), (e) => {
    assert.equal(e.code, 'graphql');
    assert.match(e.message, /FORBIDDEN/);
    assert.ok(!e.message.includes(SECRET_REPO_NAMES[1]));
    return true;
  });
});

test('respuesta parcial con data y errors también es error (no se degradan las cifras)', async () => {
  const fake = fixedResponse(200, { data: { user: { createdAt: '2024-01-01T00:00:00Z' } }, errors: [{ type: 'INSUFFICIENT_SCOPES', message: 'x' }] });
  await assert.rejects(run(fake), (e) => e.code === 'graphql');
});

test('usuario inexistente → GitHubApiError "not-found"', async () => {
  await assert.rejects(run(createFakeGitHub(), { login: 'nobody' }), (e) => e.code === 'not-found');
});

test('error de red → GitHubApiError "network" sin el mensaje original', async () => {
  const fetch = async () => {
    throw new Error(`getaddrinfo ENOTFOUND ${SECRET_REPO_NAMES[0]} ${TOKEN}`);
  };
  await assert.rejects(fetchProfile({ fetch, token: TOKEN, today: TODAY, login: LOGIN }), (e) => {
    assert.equal(e.code, 'network');
    assert.ok(!e.message.includes(SECRET_REPO_NAMES[0]) && !e.message.includes(TOKEN));
    return true;
  });
});

test('respuesta que no es JSON o mal formada → GitHubApiError "bad-response"', async () => {
  const notJson = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  await assert.rejects(fetchProfile({ fetch: notJson, token: TOKEN, today: TODAY, login: LOGIN }), (e) => e.code === 'bad-response');
  const fake = fixedResponse(200, { data: { user: { createdAt: '2024-01-01T00:00:00Z', repositories: { nodes: 'x' } } } });
  await assert.rejects(run(fake), (e) => e.code === 'bad-response');
});

test('ningún mensaje de error incluye nombres de repos ni la credencial', async () => {
  const fakes = [
    fixedResponse(401, { message: SECRET_REPO_NAMES.join(' ') }),
    fixedResponse(500, { message: SECRET_REPO_NAMES.join(' ') }),
    fixedResponse(200, { errors: [{ type: 'NOT_FOUND', message: SECRET_REPO_NAMES.join(' '), path: SECRET_REPO_NAMES }] }),
  ];
  for (const fake of fakes) {
    const err = await run(fake).catch((e) => e);
    const text = `${err.message} ${err.stack} ${JSON.stringify(err)}`;
    for (const n of [...SECRET_REPO_NAMES, TOKEN]) assert.ok(!text.includes(n), `aparece ${n}`);
  }
});

test('si ni partiendo hasta un solo día caben los commits (> 100 repos el mismo día) → "incomplete", nunca cifras a medias', async () => {
  const ds = sampleDataset();
  for (let i = 0; i < 101; i++) ds.commits.push({ repo: `public-repo-${i}`, occurredAt: '2025-08-08T10:00:00Z', commitCount: 1 });
  await assert.rejects(run(createFakeGitHub(ds)), (e) => e instanceof GitHubApiError && e.code === 'incomplete');
});
