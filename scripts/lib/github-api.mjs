// Capa de API de GitHub (RF-18, RF-63). Lee los datos del perfil por GraphQL y devuelve `raw`
// para buildProfileStats (stats.mjs). `fetch`, `token`, `today` y `login` se inyectan: este módulo
// no lee la fecha actual, el entorno ni el disco.
//
// Privacidad (RF-18): ninguna consulta pide nombres de repositorio y `raw` solo lleva cifras.
// Los errores son GitHubApiError con un código fijo y nunca copian textos de la API ni la credencial.
import { utcDay } from './dates.mjs';

export const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/** Máximo de repos por consulta de commits (límite de `commitContributionsByRepository`). */
const MAX_REPOS = 100;
const PAGE = 100;

const NODE_FIELDS = ['issueContributions', 'pullRequestContributions', 'pullRequestReviewContributions', 'repositoryContributions'];

export class GitHubApiError extends Error {
  /**
   * @param {'missing-token'|'unauthorized'|'forbidden'|'rate-limited'|'http'|'network'|'graphql'|'not-found'|'bad-response'|'incomplete'} code
   * @param {{status?: number, detail?: string}} [extra] `detail` solo admite texto seguro (tipos de error en mayúsculas)
   */
  constructor(code, { status, detail } = {}) {
    const parts = [code, status ? `HTTP ${status}` : '', detail ?? ''].filter(Boolean);
    super(`GitHub API error: ${parts.join(' ')}`);
    this.name = 'GitHubApiError';
    this.code = code;
    if (status) this.status = status;
  }
}

const Q_REPOS = `query ProfileRepos($login: String!, $after: String) {
  user(login: $login) {
    createdAt
    repositories(ownerAffiliations: [OWNER], isFork: false, first: ${PAGE}, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { isPrivate stargazerCount languages(first: 100) { edges { size node { name } } } }
    }
  }
}`;

const Q_COMMITS = `query ProfileCommits($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      commitContributionsByRepository(maxRepositories: ${MAX_REPOS}) {
        contributions(first: ${PAGE}) { pageInfo { hasNextPage } nodes { occurredAt commitCount } }
      }
    }
  }
}`;

const qNodes = (field) => `query ProfileNodes($login: String!, $from: DateTime!, $to: DateTime!, $after: String) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      ${field}(first: ${PAGE}, after: $after) { pageInfo { hasNextPage endCursor } nodes { occurredAt } }
    }
  }
}`;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => {
  if (!Array.isArray(v)) throw new GitHubApiError('bad-response');
  return v;
};
const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

/** Solo deja pasar tipos de error con forma de enumeración (p. ej. FORBIDDEN), nunca mensajes. */
const safeTypes = (errors) =>
  [...new Set(errors.map((e) => (typeof e?.type === 'string' && /^[A-Z_]{1,40}$/.test(e.type) ? e.type : 'UNKNOWN')))].join(',');

function makeClient(fetchFn, token) {
  return async function gql(query, variables) {
    let res;
    try {
      res = await fetchFn(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'luigikings-profile-updater',
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new GitHubApiError('network');
    }
    const status = res?.status;
    if (status === 401) throw new GitHubApiError('unauthorized', { status });
    if (status === 403) throw new GitHubApiError('forbidden', { status });
    if (status === 429) throw new GitHubApiError('rate-limited', { status });
    if (!res?.ok) throw new GitHubApiError('http', { status });
    let body;
    try {
      body = await res.json();
    } catch {
      throw new GitHubApiError('bad-response');
    }
    if (!isObj(body)) throw new GitHubApiError('bad-response');
    if (Array.isArray(body.errors) && body.errors.length) throw new GitHubApiError('graphql', { detail: safeTypes(body.errors) });
    if (!isObj(body.data)) throw new GitHubApiError('bad-response');
    if (body.data.user === null) throw new GitHubApiError('not-found');
    if (!isObj(body.data.user)) throw new GitHubApiError('bad-response');
    return body.data.user;
  };
}

const DAY_MS = 86_400_000;
const dayMs = (day) => Date.parse(day + 'T00:00:00Z');
const toDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const rangeVars = (fromDay, toDayKey) => ({ from: `${fromDay}T00:00:00Z`, to: `${toDayKey}T23:59:59Z` });

async function fetchRepos(gql, login) {
  const repos = [];
  let createdAt;
  let after = null;
  do {
    const user = await gql(Q_REPOS, { login, after });
    createdAt ??= user.createdAt;
    const conn = user.repositories;
    if (!isObj(conn) || !isObj(conn.pageInfo)) throw new GitHubApiError('bad-response');
    for (const r of arr(conn.nodes)) {
      if (!isObj(r)) throw new GitHubApiError('bad-response');
      repos.push({
        isPrivate: r.isPrivate === true,
        stars: int(r.stargazerCount),
        languages: arr(r.languages?.edges ?? []).map((e) => ({ name: String(e?.node?.name ?? ''), bytes: int(e?.size) })).filter((l) => l.name),
      });
    }
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) throw new GitHubApiError('bad-response');
  return { createdAt, repos };
}

/**
 * Commits por día de [fromDay, toDay]. `commitContributionsByRepository` no se puede paginar por repo
 * sin pedir su nombre, así que si algún repo tiene más de 100 nodos (uno por día) o se alcanza el
 * máximo de repos, se parte el rango por la mitad y se repite. Con un solo día cada repo tiene como
 * mucho 1 nodo; si aun así faltan commits, es 'incomplete'.
 * @returns {Promise<{collection: object, nodes: {occurredAt: string, commitCount: number}[]}>}
 */
async function fetchCommits(gql, login, fromDay, toDayKey) {
  const user = await gql(Q_COMMITS, { login, ...rangeVars(fromDay, toDayKey) });
  const c = user.contributionsCollection;
  if (!isObj(c)) throw new GitHubApiError('bad-response');
  const groups = arr(c.commitContributionsByRepository);
  const nodes = [];
  let overflow = false;
  for (const g of groups) {
    const conn = g?.contributions;
    if (!isObj(conn)) throw new GitHubApiError('bad-response');
    if (conn.pageInfo?.hasNextPage) overflow = true;
    for (const n of arr(conn.nodes)) nodes.push({ occurredAt: n?.occurredAt, commitCount: int(n?.commitCount) });
  }
  const sum = nodes.reduce((a, n) => a + n.commitCount, 0);
  if (groups.length >= MAX_REPOS && sum !== int(c.totalCommitContributions)) overflow = true;
  if (!overflow) return { collection: c, nodes };
  if (fromDay === toDayKey) throw new GitHubApiError('incomplete');
  const mid = toDay(dayMs(fromDay) + Math.floor((dayMs(toDayKey) - dayMs(fromDay)) / DAY_MS / 2) * DAY_MS);
  const left = await fetchCommits(gql, login, fromDay, mid);
  const right = await fetchCommits(gql, login, toDay(dayMs(mid) + DAY_MS), toDayKey);
  return { collection: c, nodes: [...left.nodes, ...right.nodes] };
}

async function fetchNodes(gql, login, field, fromDay, toDayKey) {
  const out = [];
  let after = null;
  do {
    const user = await gql(qNodes(field), { login, ...rangeVars(fromDay, toDayKey), after });
    const conn = user.contributionsCollection?.[field];
    if (!isObj(conn) || !isObj(conn.pageInfo)) throw new GitHubApiError('bad-response');
    for (const n of arr(conn.nodes)) out.push(n?.occurredAt);
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);
  return out;
}

function addDay(days, occurredAt, key, n) {
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) throw new GitHubApiError('bad-response');
  const date = utcDay(occurredAt);
  const d = days.get(date) ?? { date, commits: 0, others: 0 };
  d[key] += n;
  days.set(date, d);
}

/**
 * Lee el perfil de `login` y devuelve `raw` (sin nombres de repos):
 * { createdAt, repos: [{isPrivate, stars, languages: [{name, bytes}]}],
 *   yearly: [{year, prs, issues, reviews}], days: [{date, commits, others}] }
 * Los días se reconstruyen con los nodos de contribución accesibles con la credencial (no con
 * `contributionCalendar`), así que las contribuciones restringidas (privados ajenos) no cuentan.
 * @param {{fetch: Function, token: string, today: Date|string, login: string}} opts
 * @throws {GitHubApiError}
 */
export async function fetchProfile({ fetch: fetchFn, token, today, login } = {}) {
  if (typeof token !== 'string' || token.trim() === '') throw new GitHubApiError('missing-token');
  if (typeof fetchFn !== 'function') throw new TypeError('fetchProfile necesita una función fetch');
  if (typeof login !== 'string' || login === '') throw new TypeError('fetchProfile necesita el usuario (login)');
  const todayKey = utcDay(today);
  const gql = makeClient(fetchFn, token.trim());

  const { createdAt, repos } = await fetchRepos(gql, login);
  const startKey = utcDay(createdAt);
  const yearly = [];
  const days = new Map();

  for (let year = Number(startKey.slice(0, 4)); year <= Number(todayKey.slice(0, 4)); year++) {
    const fromDay = year === Number(startKey.slice(0, 4)) ? startKey : `${year}-01-01`;
    const toDayKey = year === Number(todayKey.slice(0, 4)) ? todayKey : `${year}-12-31`;
    if (fromDay > toDayKey) continue;

    const { collection, nodes } = await fetchCommits(gql, login, fromDay, toDayKey);
    yearly.push({
      year,
      prs: int(collection.totalPullRequestContributions),
      issues: int(collection.totalIssueContributions),
      reviews: int(collection.totalPullRequestReviewContributions),
    });
    for (const n of nodes) addDay(days, n.occurredAt, 'commits', n.commitCount);
    for (const field of NODE_FIELDS) {
      for (const occurredAt of await fetchNodes(gql, login, field, fromDay, toDayKey)) addDay(days, occurredAt, 'others', 1);
    }
  }

  return {
    createdAt,
    repos,
    yearly,
    days: [...days.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  };
}
