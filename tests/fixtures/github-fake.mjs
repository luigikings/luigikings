// Servidor GraphQL de GitHub FALSO para los tests de T7 (github-api.mjs). Sin red real.
// Simula lo que hace la API: paginación de repos (100 por página), `commitContributionsByRepository`
// con `maxRepositories: 100` y `contributions(first: 100)` por repo, y las conexiones de
// issues / PRs / revisiones / repos creados paginadas con `after`.
// Las respuestas incluyen a propósito NOMBRES de repos (como haría una consulta descuidada)
// para comprobar que github-api.mjs nunca los deja pasar a `raw` ni a los errores.

const DAY_MS = 86_400_000;
export const SECRET_REPO_NAMES = ['top-secret-private-repo', 'another-hidden-thing'];

const iso = (day, hh = '12') => `${day}T${hh}:00:00Z`;
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);

/**
 * Datos de ejemplo de un usuario (no son datos reales).
 * - 130 repos propios (2 páginas): el 0 y el 1 son privados con nombre "secreto".
 * - 2024 (desde createdAt 2024-03-15): pocas contribuciones.
 * - 2025: un repo con commits 200 días seguidos (> 100 nodos → obliga a partir el rango) y
 *   105 repos con 1 commit cada uno en días distintos (> maxRepositories → obliga a partir).
 *   250 issues (3 páginas), 120 PRs (2 páginas), 30 revisiones, 4 repos creados.
 * - 2026 hasta today: algunos commits, incluido uno a las 23:30 -02:00 (día UTC siguiente).
 */
export function sampleDataset() {
  const repos = Array.from({ length: 130 }, (_, i) => ({
    name: i < 2 ? SECRET_REPO_NAMES[i] : `public-repo-${i}`,
    isPrivate: i < 2,
    stargazerCount: i % 7,
    languages: i % 3 === 0 ? [] : [{ name: 'JavaScript', size: 1000 + i }, { name: i % 2 ? 'TypeScript' : 'C#', size: 500 }],
  }));

  // commits: { repo, occurredAt, commitCount } (un nodo por repo y día, como CreatedCommitContribution)
  const commits = [];
  commits.push({ repo: SECRET_REPO_NAMES[0], occurredAt: iso('2024-03-20'), commitCount: 3 });
  commits.push({ repo: 'public-repo-5', occurredAt: iso('2024-12-31', '23'), commitCount: 1 });
  for (let i = 0; i < 200; i++) commits.push({ repo: SECRET_REPO_NAMES[1], occurredAt: iso(addDays('2025-01-01', i)), commitCount: 1 + (i % 4) });
  for (let i = 0; i < 105; i++) commits.push({ repo: `public-repo-${i + 10}`, occurredAt: iso(addDays('2025-01-02', i * 3)), commitCount: 2 });
  commits.push({ repo: 'public-repo-3', occurredAt: '2026-10-20T23:30:00-02:00', commitCount: 4 });
  commits.push({ repo: 'public-repo-3', occurredAt: iso('2026-01-01', '00'), commitCount: 1 });

  const nodes = { issueContributions: [], pullRequestContributions: [], pullRequestReviewContributions: [], repositoryContributions: [] };
  nodes.issueContributions.push({ occurredAt: iso('2024-04-01') });
  for (let i = 0; i < 250; i++) nodes.issueContributions.push({ occurredAt: iso(addDays('2025-02-01', i % 300)) });
  for (let i = 0; i < 120; i++) nodes.pullRequestContributions.push({ occurredAt: iso(addDays('2025-03-01', i)) });
  for (let i = 0; i < 30; i++) nodes.pullRequestReviewContributions.push({ occurredAt: iso(addDays('2025-06-01', i)) });
  for (let i = 0; i < 4; i++) nodes.repositoryContributions.push({ occurredAt: iso(addDays('2025-01-01', i)) });
  nodes.pullRequestContributions.push({ occurredAt: iso('2026-10-22', '08') });

  return { login: 'luigikings', createdAt: '2024-03-15T10:00:00Z', repos, commits, nodes };
}

const NODE_FIELDS = ['issueContributions', 'pullRequestContributions', 'pullRequestReviewContributions', 'repositoryContributions'];
const TOTALS = {
  issueContributions: 'totalIssueContributions',
  pullRequestContributions: 'totalPullRequestContributions',
  pullRequestReviewContributions: 'totalPullRequestReviewContributions',
  repositoryContributions: 'totalRepositoryContributions',
};

const inRange = (occurredAt, from, to) => {
  const t = Date.parse(occurredAt);
  return t >= Date.parse(from) && t <= Date.parse(to);
};

function page(list, after, size = 100) {
  const start = after ? Number(after) : 0;
  const slice = list.slice(start, start + size);
  const end = start + slice.length;
  return { slice, pageInfo: { hasNextPage: end < list.length, endCursor: String(end) } };
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Map(),
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/**
 * Crea un `fetch` falso que responde como la API GraphQL de GitHub con `dataset`.
 * `calls` registra cada petición ({url, init, body}) para inspeccionarla en los tests.
 */
export function createFakeGitHub(dataset = sampleDataset()) {
  const calls = [];
  async function fakeFetch(url, init = {}) {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const q = body.query;
    const v = body.variables ?? {};
    if (v.login !== dataset.login) return json(200, { data: { user: null } });

    if (q.includes('repositories(')) {
      const { slice, pageInfo } = page(dataset.repos, v.after);
      return json(200, {
        data: {
          user: {
            createdAt: dataset.createdAt,
            repositories: {
              pageInfo,
              nodes: slice.map((r) => ({
                name: r.name,
                nameWithOwner: `${dataset.login}/${r.name}`,
                isPrivate: r.isPrivate,
                stargazerCount: r.stargazerCount,
                languages: { edges: r.languages.map((l) => ({ size: l.size, node: { name: l.name } })) },
              })),
            },
          },
        },
      });
    }

    const collection = {};
    if (q.includes('commitContributionsByRepository')) {
      const inR = dataset.commits.filter((c) => inRange(c.occurredAt, v.from, v.to));
      const byRepo = new Map();
      for (const c of inR) byRepo.set(c.repo, [...(byRepo.get(c.repo) ?? []), c]);
      const groups = [...byRepo].sort((a, b) => b[1].length - a[1].length).slice(0, 100);
      collection.totalCommitContributions = inR.reduce((a, c) => a + c.commitCount, 0);
      collection.commitContributionsByRepository = groups.map(([repo, list]) => {
        const { slice, pageInfo } = page(list, undefined);
        return {
          repository: { name: repo, nameWithOwner: `${dataset.login}/${repo}` },
          contributions: { totalCount: list.length, pageInfo, nodes: slice.map((c) => ({ occurredAt: c.occurredAt, commitCount: c.commitCount })) },
        };
      });
      for (const f of NODE_FIELDS) collection[TOTALS[f]] = dataset.nodes[f].filter((n) => inRange(n.occurredAt, v.from, v.to)).length;
    }
    for (const f of NODE_FIELDS) {
      if (!q.includes(`${f}(`)) continue;
      const list = dataset.nodes[f].filter((n) => inRange(n.occurredAt, v.from, v.to));
      const { slice, pageInfo } = page(list, v.after);
      collection[f] = { pageInfo, nodes: slice.map((n) => ({ occurredAt: n.occurredAt, repository: { name: SECRET_REPO_NAMES[0] } })) };
    }
    return json(200, { data: { user: { contributionsCollection: collection } } });
  }
  return { fetch: fakeFetch, calls };
}

/** `fetch` falso que siempre responde con `status` y `body` (por ejemplo, 401). */
export function fixedResponse(status, body) {
  const calls = [];
  return { calls, fetch: async (url, init) => (calls.push({ url, init }), json(status, body)) };
}
