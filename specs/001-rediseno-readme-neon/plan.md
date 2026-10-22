# Plan 001 — Rediseño del README con estilo gaming neón

Spec: `specs/001-rediseno-readme-neon/spec.md` (aprobada). Stack y reglas: `AGENTS.md` y `docs/constitution.md`.

## Resumen de la solución
- El README se escribe una vez a mano, sin tablas, con HTML permitido por GitHub (`<picture>`, `<details>`, `<p align>`, `<img align>`, `<a>`). Solo se reescriben automáticamente, entre marcadores HTML, la sección de YouTube y la etiqueta `<img>` (con su `alt` con cifras) del marcador y de las tarjetas de stats, lenguajes y racha (RF-65).
- Todas las piezas propias (banner, separador, footer, tarjetas de proyecto, botones de contacto, marcador, tarjetas de stats, snake y 3D) son SVG generados por scripts Node 24 **sin dependencias externas**, a partir de funciones puras que devuelven strings.
- Un único workflow diario (más lanzamiento manual) obtiene los datos de GitHub (GraphQL, credencial de solo lectura) y de YouTube (API de datos v3, clave), regenera las piezas dinámicas y guarda los cambios en `main` con el `GITHUB_TOKEN` del propio workflow.
- No se usa ninguna acción de terceros salvo `actions/checkout@v4` y `actions/setup-node@v4` (oficiales de GitHub). Snake y 3D se generan en casa (ver Decisiones).

## Archivos y responsabilidades

| Archivo | Responsabilidad | RF / RNF |
|---|---|---|
| `README.md` | Portada. Secciones en orden, `<picture>` para banner, texto animado y snake. Marcadores `<!-- YOUTUBE:START -->` / `<!-- YOUTUBE:END -->` y `<!-- ALT:<pieza>:START -->` / `<!-- ALT:<pieza>:END -->` para `scoreboard`, `stats`, `languages` y `streak` | RF-65, RF-1, RF-2, RF-4, RF-6 a RF-11, RF-19 a RF-31, RF-46 a RF-49, RNF-1, RNF-2, RNF-6, RNF-7, RNF-12, RNF-13 |
| `config/profile.json` | Configuración: usuario de GitHub, `channelId`, nº de vídeos (3), lenguajes excluidos, umbrales de la heurística de vídeos | RF-40, RF-42 |
| `scripts/lib/palette.mjs` | Constantes de la paleta y tonos de texto por tema; `contrastRatio(a, b)` | RNF-5, RNF-6 |
| `scripts/lib/svg.mjs` | `escapeXml`, `svgDoc({width, height, title, body, style})` (garantiza `viewBox`, `<title>`, `role="img"`), `minifySvg(svg)` | RNF-3, RNF-4, RNF-7, RNF-10, RF-38 |
| `scripts/lib/format.mjs` | `formatNumber(n)` | RF-17 |
| `scripts/lib/dates.mjs` | `utcDay(date)`, `last12Months(today)`, `weekGrid(days, today)` (con `today` inyectado) | RF-35, RF-36, zona horaria UTC |
| `scripts/lib/stats.mjs` | Cálculos puros: `aggregateLanguages`, `topLanguage`, `computeStreak`, `buildDailyMap`, `buildProfileStats(raw, today)` | RF-13 a RF-16, RF-33, RF-34, RF-39 |
| `scripts/lib/github-api.mjs` | Consultas GraphQL y paginación; recibe `fetch`, `token` y `today` como parámetros; devuelve `raw` sin nombres de repos | RF-18, RF-63 |
| `scripts/lib/youtube.mjs` | Puros: `parseIsoDuration`, `classifyVideo(video, {isShort})`, `selectLatest(videos, n)`, `truncateTitle` | RF-41, RF-42, RF-45 |
| `scripts/lib/youtube-api.mjs` | Llamadas a la API de YouTube y sonda de Shorts; recibe `fetch` y `key` | RF-40, RF-61, RF-62 |
| `scripts/lib/readme.mjs` | `replaceBetweenMarkers(readme, start, end, content)`, `renderYoutubeSection(videos, channelUrl)`, `renderStatsImg({src, alt, width, align})` y `applyStatsAlts(readme, alts)` | RF-41, RF-43 a RF-46, RF-65 |
| `scripts/lib/alt.mjs` | `buildAltTexts(stats)` → `{scoreboard, stats, languages, streak}`. Fuente única del texto con cifras: la usan el `alt` del README y el `<title>` de los SVG de T5 | RF-65, RNF-7, RF-39 |
| `scripts/render/banner.mjs` | `renderBanner(theme)` | RF-3 a RF-6 |
| `scripts/render/divider.mjs`, `footer.mjs` | Separador y onda neón | RF-2, RF-49 |
| `scripts/render/project-card.mjs` | `renderProjectCard({name, description, accent})` | RF-19, RF-20 |
| `scripts/render/contact-button.mjs` | `renderContactButton({label, accent})` | RF-47 |
| `scripts/render/scoreboard.mjs` | `renderScoreboard(stats)` | RF-12 a RF-17 |
| `scripts/render/cards.mjs` | `renderStatsCard`, `renderLanguagesCard`, `renderStreakCard` | RF-32 a RF-34 |
| `scripts/render/snake.mjs` | `renderSnake(grid, theme)` | RF-35, RF-37 |
| `scripts/render/contrib3d.mjs` | `renderContrib3d(grid)` | RF-36, RF-37 |
| `scripts/build-static.mjs` | Genera los SVG estáticos en `assets/static/` (se ejecuta en local y se guarda el resultado) | RF-2 a RF-6, RF-19, RF-20, RF-47, RF-49 |
| `scripts/update.mjs` | Orquestador de la actualización automática: obtención común de GitHub y grupos `github`, `contrib` y `youtube` (`renderStatsGroup`, `renderContribGroup`, `renderers` inyectables), escritura atómica, detección de cambios y aviso de fallo. Modo `--seed` para los archivos iniciales | RF-51 a RF-55, RF-59 a RF-64, RF-60 |
| `scripts/resolve-channel-id.mjs` | Uso único y manual: deduce el `channelId` a partir de `@lk_rl` | RF-40 |
| `assets/static/*.svg` | Piezas propias estáticas | — |
| `assets/generated/*.svg` | Piezas dinámicas (marcador, stats, lenguajes, racha, snake claro/oscuro, 3D) | RF-60 |
| `.github/workflows/update-profile.yml` | Programación, permisos, concurrencia, guardado con reintento y marca de fallo | RF-50, RF-51, RF-53, RF-54, RF-56 a RF-58, RNF-11 |
| `tests/*.test.mjs` y `tests/fixtures/` | Tests con `node:test` y respuestas de API de ejemplo | todos los verificables por código |
| `tests/helpers/xml.mjs` | Comprobador mínimo de XML bien formado (sin dependencias) | RNF-10 |

## Lógica separada de la interfaz
- Las funciones de `scripts/lib/` y `scripts/render/` son puras: reciben datos y devuelven datos o strings. No leen la fecha actual, la red, el disco ni variables de entorno.
- `today`, `fetch`, `token` y `key` se inyectan desde `update.mjs`, que es el único módulo con efectos (red, disco, `GITHUB_OUTPUT`).
- Los tests usan `fetch` falsos que devuelven `tests/fixtures/*.json` y fechas fijas.

## Datos

### `config/profile.json`
```json
{
  "githubUser": "luigikings",
  "youtube": { "handle": "@lk_rl", "channelId": "UC…", "count": 3, "shortsMaxSeconds": 180, "titleMaxChars": 60 },
  "languages": { "exclude": ["HTML", "CSS", "SCSS", "Sass", "Less", "Markdown", "MDX"], "max": 6 }
}
```

### `raw` (salida de `github-api.mjs`, solo en memoria; nunca se guarda ni se imprime)
```
{ createdAt, repos: [{ isPrivate, stars, languages: [{name, bytes}] }],      // sin nombres
  yearly: [{ year, prs, issues, reviews }],
  days:   [{ date: "YYYY-MM-DD", commits, others }] }                          // contribuciones por día UTC
```

### `ProfileStats` (salida de `buildProfileStats`, la única fuente para las 4 piezas del grupo, RF-39)
```
{ repositories, commitsLastYear, prs, issues, reviews, assists = prs+issues+reviews,
  stars, languages: [{name, pct}], topLanguage | null,
  currentStreak, longestStreak, totalContributions, grid: [[level 0..4 | null]] }
```

### Lista de vídeos y textos alternativos con cifras
No se guarda JSON aparte: la fuente de verdad son los bloques entre marcadores del README. Así se evita un archivo que podría desincronizarse.

Formato del bloque de una pieza de stats (una línea, dentro del `<p>` donde va la imagen):
```
<!-- ALT:scoreboard:START --><img src="assets/generated/scoreboard.svg" align="right" width="360" alt="…"><!-- ALT:scoreboard:END -->
```
Textos de `buildAltTexts` (en inglés, con `formatNumber`):
- scoreboard: `Scoreboard. Goals: {repositories} repositories. Saves: {commitsLastYear} commits (last year). Assists: {assists} PRs, issues & reviews. MVP: {topLanguage ?? "—"} (top language).`
- stats: `GitHub stats. Stars: {stars}. Commits (last year): {commitsLastYear}. Pull requests (all time): {prs}. Issues (all time): {issues}. Code reviews (all time): {reviews}.`
- languages: `Top languages: {name pct%, …}` o `Top languages: No languages yet.`
- streak: `Contribution streak. Current streak: {currentStreak} days. Longest streak: {longestStreak} days. Total contributions: {totalContributions}.`

El `alt` se escapa como atributo HTML (`& < > "`). La snake y el 3D no tienen cifras: su `alt` es fijo y lo escribe el README a mano.

### Dónde se guarda
Todo vive en `main`: `assets/generated/` y el README. Los archivos iniciales (RF-60) se crean con `node scripts/update.mjs --seed`, que pinta las piezas con `ProfileStats` vacío ("0" y "—"), escribe los 4 bloques `ALT:*` con esos mismos valores y no toca YouTube. Se guardan en el mismo cambio que el nuevo README.

## Algoritmos

### Datos de GitHub (`github-api.mjs`)
```
repos = paginar user.repositories(ownerAffiliations: OWNER, isFork: false, first: 100)
        { isPrivate, stargazerCount, languages(first: 100){ edges{ size node{name} } } }
        // Incluye archivados y el repo de perfil. Con la credencial entran los privados propios.
para cada año Y desde createdAt.year hasta today.year:
    c = contributionsCollection(from: max(1-ene-Y, createdAt), to: min(31-dic-Y, today))
    yearly += { prs: c.totalPullRequestContributions, issues: c.totalIssueContributions,
                reviews: c.totalPullRequestReviewContributions }
    // Días: SOLO nodos accesibles (excluye repos privados ajenos = "restricted")
    commitContributionsByRepository(maxRepositories: 100) → paginar contributions{ occurredAt commitCount }
    issueContributions / pullRequestContributions / pullRequestReviewContributions /
    repositoryContributions → paginar nodes{ occurredAt }
    acumular en days[utcDay(occurredAt)]
devolver raw   // los nombres de repo nunca salen de esta función
```
Invariante comprobado en los tests: la suma de `commits` de un año es igual a `totalCommitContributions` de ese año.

### `buildProfileStats(raw, today, cfg)`
```
window   = last12Months(today)                  // 365 días UTC terminando en today
commitsLastYear = Σ days[d].commits, d ∈ window
total(d) = days[d].commits + days[d].others
totalContributions = Σ total(d) para todos los días
langs = sumar bytes por nombre en todos los repos, excluir cfg.exclude,
        ordenar por bytes desc y luego por nombre asc → top cfg.max con pct = bytes/Σ·100
topLanguage = langs[0]?.name ?? null
stars = Σ stars de repos con !isPrivate
grid = weekGrid(window): columnas = semanas (domingo..sábado), level = 0 si total = 0;
       si no, 1..4 por cuartiles de los días no nulos de la ventana
```

### `computeStreak(days, today)`
```
start = today si total(today) > 0, ayer si total(ayer) > 0; si no, current = 0
current = nº de días consecutivos hacia atrás desde start con total > 0
longest = racha máxima recorriendo todos los días ordenados (los días sin datos = 0)
```

### `formatNumber(n)` (RF-17)
```
n < 10_000      → n.toLocaleString('en-US')                      // "9,876"
n < 1_000_000   → trunc1(n/1000) + "k"                            // "10k", "10.2k"
si no           → trunc1(n/1_000_000) + "M"                       // "1M", "1.2M"
trunc1(x) = Math.floor(x*10)/10, sin ".0"
// Caso borde: 999_999 → "999.9k" (no salta a "1000k")
```

### Vídeos (`youtube.mjs` + `youtube-api.mjs`)
```
uploads = "UU" + channelId.slice(2)
ids     = playlistItems.list(playlistId: uploads, maxResults: 50).items[].contentDetails.videoId
vids    = videos.list(id: ids, part: snippet,contentDetails,liveStreamingDetails,status)
para cada v (orden publishedAt desc):
    descartar si status.privacyStatus ≠ "public"
    descartar si snippet.liveBroadcastContent ∈ {live, upcoming}       // directo o estreno aún no emitido
    dur = parseIsoDuration(contentDetails.duration)
    si dur ≤ cfg.shortsMaxSeconds:
        isShort = sonda HEAD https://www.youtube.com/shorts/{id} sin seguir redirecciones
                  (200 → Short; 3xx → no Short; error de red → dur ≤ 60)
        descartar si isShort
    si liveStreamingDetails existe:
        span = actualEndTime − actualStartTime
        estreno si dur < span y span − dur ≤ 300 s  // la emisión de un estreno incluye la cuenta atrás
        si no → grabación de directo → descartar
    conservar
devolver los 3 primeros conservados
```
La heurística de estrenos y directos es la tolerancia aceptada en la spec. Los umbrales viven en `config/profile.json` y se calibran con los vídeos reales del canal en T9, sin cambiar la spec.

`renderYoutubeSection`: una miniatura por vídeo en línea (`<a href="https://www.youtube.com/watch?v=ID"><img src="https://i.ytimg.com/vi/ID/hqdefault.jpg" width="280" alt="TÍTULO"></a>`) más el título como texto enlazado. El título se trunca a 60 caracteres con "…" y luego se escapa (`& < > " '`). Debajo va el enlace al canal.

### Orquestador (`update.mjs`)
```
runUpdate({ today, fetch, env, fs, renderers = porDefecto })   // renderers inyectables en tests
failed = {}; readme = leer(README); salidas = {}           // todo se calcula en memoria

// Datos de GitHub: obtención común a los grupos github y contrib
try raw = fetchProfile(...); stats = buildProfileStats(raw, today)
catch e → failed.github = failed.contrib = código(e)       // mismo código en ambos; sin nombres (RF-18)

grupo github (todo o nada: RF-39, RF-52, RF-64, RF-65)  — si hay stats:
    try { piezas, readmeG } = renderers.renderStatsGroup(stats, readme)
            // marcador + stats + lenguajes + racha con buildAltTexts, y applyStatsAlts sobre los 4 bloques ALT:*
        salidas += piezas; readme = readmeG                // solo si TODO lo anterior fue bien
    catch e → failed.github = código(e)                    // p. ej. readme-markers o render: piezas y alt anteriores intactos

grupo contrib (independiente: RF-52)  — si hay stats:
    try piezas = renderers.renderContribGroup(stats.grid)   // snake-light, snake-dark, contrib-3d
        salidas += piezas
    catch e → failed.contrib = código(e)
    // Un fallo de github no impide escribir contrib, y viceversa

grupo youtube (independiente):
    try vids = fetchLatest(...); si vids.length == 0 → throw "sin vídeos elegibles" (RF-61)
        readme = replaceBetweenMarkers(readme, YOUTUBE, renderYoutubeSection(vids))
    catch e → failed.youtube = código(e)

salidas[README] = readme
para cada (path, contenido) en salidas: escribirSiCambia(path, contenido)
    // Si las cifras no cambian, los alt generados son idénticos byte a byte → README sin cambios (RF-54)
consola: una línea por grupo → "github: ok|<código>", "contrib: ok|<código>", "youtube: ok|<código>"
si algún grupo falló → "failed=true" en $GITHUB_OUTPUT y código de salida 1 (RF-53)
escribirSiCambia(path, contenido): si contenido == actual → no hacer nada (RF-54);
    si no → escribir en path.tmp y renombrar (escritura atómica)
```
Si falta la credencial o la clave, la llamada correspondiente lanza un error antes de usar la red. Así se cumplen RF-62 y RF-63 sin degradar las cifras.

## Cómo se pinta
- **Fuentes**: pila del sistema (`'Segoe UI', Verdana, sans-serif`) dentro del SVG. Nada de fuentes web (RNF-4).
- **Animación**: CSS `@keyframes` dentro del `<style>` de cada SVG. Ciclos ≥ 1 s, sin parpadeos (RNF-9). Brillo del nombre con `filter: drop-shadow` pulsante de 3 s, partículas con traslación de 4-8 s y líneas del campo con desplazamiento de guiones.
- **Tema**:
  - Banner, texto animado y snake usan `<picture>` con variante clara y oscura. En la variante clara, el texto va en `#0a0e1a` y el neón solo en líneas y brillos (RNF-5).
  - Las tarjetas de proyecto, el marcador, las tarjetas de stats, el 3D y los botones llevan fondo opaco `#0a0e1a` con borde neón, así que tienen una sola variante.
  - El separador y la onda son decorativos, sin texto, con una sola variante.
- **Texto animado**: dos URL de `readme-typing-svg.demolab.com` con las 4 frases de RF-8 codificadas: `color=00D4FF` para oscuro y `color=0A0E1A` para claro.
- **Maquetación sin tablas** (RNF-2):
  - About me: el marcador va como `<img align="right" width="360">` y el texto fluye a su lado.
  - Tarjetas, stats y miniaturas son imágenes en línea que bajan de fila solas.
  - GitHub aplica `max-width: 100%` a las imágenes, así que nunca desbordan a 375 px.
- **Marcador**: dos franjas (azul a la izquierda con Goals y Saves, naranja a la derecha con Assists y MVP) y un título "SCOREBOARD". Cada casilla tiene el título de juego, el valor con `formatNumber` y la subetiqueta. Las cifras se repiten en el `<title>` del SVG y en el `alt` del README, ambos generados con `buildAltTexts` (RNF-7, RF-65).
- **Snake**:
  - Cuadrícula de 53 × 7 celdas.
  - La serpiente recorre las columnas en zigzag (abajo y arriba) en un ciclo de 20 s.
  - Cada celda baja su `fill-opacity` cuando pasa la cabeza, con un `@keyframes` compartido y `animation-delay` por celda.
  - No muestra cifras (RF-37).
- **3D**:
  - Proyección isométrica de la cuadrícula: altura = nivel × h.
  - Las caras se agrupan por color en un `<path>` por cara y nivel, para mantener el peso bajo.
  - Sin cifras.
- **Iconos del stack**: `https://skillicons.dev/icons?i=…&perline=8`. Las tecnologías sin icono (previsiblemente MariaDB, se confirma en T11) solo aparecen como texto en su `<details>` (RF-29).

## Decisiones técnicas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Snake y 3D generados en casa a partir del mismo mapa de días, con `minifySvg` como posprocesado (salida ≤ entrada, RF-38) | Acciones de terceros (`Platane/snk`, `yoshi389111/github-profile-3d-contrib`) más un posprocesado | Las de terceros leen el calendario por su cuenta, que puede incluir contribuciones restringidas (rompe la "actividad contable" de RF-35 y RF-36). Además añaden dependencias externas y SVG pesados que habría que recolorear con expresiones regulares frágiles |
| Días reconstruidos a partir de los nodos de contribución accesibles | `contributionCalendar` | El calendario puede sumar las contribuciones en repos privados ajenos si el usuario comparte sus contribuciones privadas; los nodos solo devuelven lo accesible con la credencial |
| Guardar en `main` | Rama `output` aparte | Hay una sola fuente y el README usa rutas relativas. Además, los guardados cuentan como actividad y evitan que GitHub desactive la programación a los 60 días. El ruido de historial se limita porque solo se guarda cuando hay cambios (RF-54) |
| Guardar con `GITHUB_TOKEN` (`contents: write`) | Hacer push con la credencial personal | La credencial es solo de lectura (RF-56) y los push con `GITHUB_TOKEN` no disparan workflows (RF-57). Además, el workflow solo escucha `schedule` y `workflow_dispatch`, no `push` |
| README escrito a mano con marcadores solo para YouTube y los 4 `<img>` con cifras | Generar todo el README desde una plantilla | Menos código. Solo cambian YouTube y los `alt` con cifras; las demás imágenes dinámicas cambian de archivo, no de README |
| Marcadores alrededor de cada `<img>` completo, regenerado con `renderStatsImg` | Sustituir solo el atributo `alt` con una expresión regular sobre el `src` | Mismo mecanismo que YouTube (`replaceBetweenMarkers`), sin expresiones regulares frágiles sobre HTML y fácil de comprobar en tests |
| `alt` y `<title>` salen de la misma función `buildAltTexts` | Textos separados en el README y en cada render | Garantiza que las cifras del `alt` y del SVG coinciden siempre (RF-39, RNF-7) |
| Una sola obtención de datos de GitHub y dos grupos de escritura: `github` (marcador + 3 tarjetas + 4 `ALT:*`, todo o nada) y `contrib` (snake ×2 + 3D, independiente) | Una llamada a la API por pieza / un único bloque todo o nada con snake y 3D dentro | Cumple RF-39 y RF-64 con una sola obtención de datos y menos cuota, y RF-52, porque un fallo de render o de marcadores en un grupo no bloquea el otro |
| Sonda `HEAD /shorts/{id}` para Shorts | Solo duración ≤ 60 s | Los Shorts pueden durar hasta 3 min; la sonda es la señal indirecta más fiable y, si falla, se vuelve a la regla de duración |
| Concurrencia `group: update-profile`, `cancel-in-progress: false` | Ejecuciones en paralelo | Evita escrituras simultáneas: la segunda ejecución espera a que termine la primera |
| Comprobador de XML propio en los tests | Dependencia (`fast-xml-parser`, `xmllint`) | `AGENTS.md`: sin dependencias mientras no haga falta |

## Workflow `.github/workflows/update-profile.yml`
```yaml
on:
  schedule: [{ cron: "17 5 * * *" }]     # diario 05:17 UTC (fuera de la hora en punto, que va más cargada)
  workflow_dispatch: {}
permissions: { contents: write }          # nada más
concurrency: { group: update-profile, cancel-in-progress: false }
jobs.update.steps:
  - actions/checkout@v4
  - actions/setup-node@v4 (node-version: 24)
  - id: run;  node scripts/update.mjs      env: PROFILE_READ_TOKEN, YOUTUBE_API_KEY (secrets)
  - guardar: si `git status --porcelain` vacío → salir;
             git add assets/generated README.md; commit "chore: actualizar perfil [bot]";
             git push || (git pull --rebase && git push) || exit 1        # RF-58
  - if: steps.run.outputs.failed == 'true' → exit 1                       # RF-53
```

## Estrategia de tests (`node --test "tests/**/*.test.mjs"`)

| Test | Qué comprueba | RF / RNF |
|---|---|---|
| `format.test.mjs` | 0, 9 876, 10 000, 10 290, 999 999, 1 000 000, 1 250 000 | RF-17 |
| `stats.test.mjs` | Lenguajes (exclusión, empate alfabético, ninguno → null), racha (hoy, ayer, cortada, vacía), ventana de 365 días, `assists` = suma, estrellas solo públicas, ceros | RF-13 a RF-16, RF-33, RF-34, RF-39 |
| `github-api.test.mjs` | `fetch` falso con fixtures: paginación, invariante de commits, `raw` y errores sin nombres de repo, credencial ausente → error | RF-18, RF-63 |
| `youtube.test.mjs` | Fixtures de vídeo normal, Short (sonda 200/303/error), directo, grabación, estreno emitido o programado, privado; orden; menos de 3; título largo o con `& < "`; sección renderizada y enlaces | RF-41 a RF-46, RF-61, RF-62 |
| `svg.test.mjs` | Cada SVG generado (estáticos y dinámicos con fixture): XML bien formado, `viewBox`, `<title>`, sin `href` ni `url(` externos ni `<script>`, < 100 KB (snake y 3D solo se avisan), `minifySvg(x).length ≤ x.length`, sin cifras en snake y 3D, contraste ≥ 4.5 de los pares de texto, duraciones de animación ≥ 1 s | RNF-3, RNF-4, RNF-5, RNF-7 a RNF-10, RF-37, RF-38 |
| `cards.test.mjs` | Etiquetas exactas del marcador y de las tarjetas; valores formateados; mismo `ProfileStats` en todas | RF-12 a RF-16, RF-32 a RF-34, RF-39 |
| `alt.test.mjs` | `buildAltTexts` con `ProfileStats` de ejemplo, a cero y con números ≥ 10 000: textos exactos y formateados, escapado. El `<title>` de cada SVG de T5 contiene el mismo texto. `applyStatsAlts` cambia solo los 4 bloques `ALT:*` y es idempotente | RF-65, RNF-7, RF-39 |
| `update.test.mjs` | Orquestador con dependencias falsas y `renderers` inyectados. Falla la obtención de GitHub → `github` y `contrib` fallan con el mismo código y YouTube se escribe. Falla `renderStatsGroup` (p. ej. `readme-markers`) → no cambia ninguna pieza ni `ALT:*`, pero snake y 3D sí se escriben. Falla `renderContribGroup` → marcador, tarjetas y `alt` sí se escriben. Falla YouTube → solo su bloque queda intacto. Cualquier fallo → `failed=true` y código 1. Línea `contrib: ok\|<código>` en consola. Sin cambios → sin escritura (README incluido). `--seed` con los `alt` iniciales | RF-51 a RF-55, RF-59 a RF-65 |
| `generated-assets.test.mjs` | Los SVG de `assets/generated/` en disco son XML válidos y coinciden con los que produce `--seed`. Se salta si la actualización automática ya guardó datos reales | RF-60, RNF-10 |
| `readme.test.mjs` | Orden de secciones, 6 separadores, frases exactas del texto animado, dominio `demolab`, 5 tarjetas con sus URL y descripciones, sin enlace al repo de Magnar, AgencyMac sin ".NET", stack exacto con `<details>` cerrados, contactos, sin `<table>`/`<style>`/`<script>`/`class=`/`id=`/`style=`, todas las `<img>` con `alt`, todo `src` relativo existe en disco, sin "last updated", peso total de las piezas propias por tema ≤ 1.5 MB | RF-1, RF-2, RF-7, RF-8, RF-11, RF-19 a RF-31, RF-47, RF-48, RF-55, RF-60, RNF-1, RNF-2, RNF-7, RNF-8 |
| `workflow.test.mjs` | Lectura de texto del YAML: `schedule`, `workflow_dispatch`, `permissions: contents: write` como único permiso, `concurrency`, acciones `@v4`, sin disparador `push`, secretos por `secrets.` | RF-50, RF-56, RF-57, RNF-11 |

Se verifica a mano, siguiendo los criterios de finalización de la spec: el aspecto en github.com en claro, oscuro, 375 px y la app; la ejecución real; la calibración de la heurística de vídeos; y la ausencia de autodisparo.

## Pasos manuales del usuario
1. **Credencial de GitHub** (Settings → Developer settings → Fine-grained tokens → Generate):
   - Resource owner: `luigikings`.
   - Repository access: *All repositories*.
   - Permisos de repositorio, todos *Read-only*: **Metadata**, **Contents**, **Issues** y **Pull requests**. Sin permisos de cuenta.
   - Caducidad: la máxima que permita GitHub. Hay que renovarla al caducar (RF-63).
   - Se guarda en el repo `luigikings/luigikings` → Settings → Secrets and variables → Actions → New secret: **`PROFILE_READ_TOKEN`**.
2. **Clave de YouTube**:
   - En Google Cloud Console, crear un proyecto, activar *YouTube Data API v3* y crear una *API key*.
   - Restringirla a esa API.
   - Guardarla como secreto **`YOUTUBE_API_KEY`**.
3. **Permiso de escritura de Actions**: repo → Settings → Actions → General → *Workflow permissions* → *Read and write permissions* → Save.
4. **ID del canal**:
   - Ejecutar en local `YOUTUBE_API_KEY=… node scripts/resolve-channel-id.mjs @lk_rl`.
   - Comprobar que el `UC…` que imprime es su canal (abriendo `https://www.youtube.com/channel/UC…`).
   - Dar el OK para fijarlo en `config/profile.json`.
5. **Publicación**: revisar el diff y dar el OK explícito al push. Después, lanzar a mano el workflow (Actions → Update profile → Run workflow) y revisar el perfil.

**Riesgo a vigilar en T7:** si la credencial de grano fino no da acceso a las contribuciones privadas propias a través de GraphQL, se para y se consulta al usuario. Pasarse a un token clásico implicaría permisos de escritura y contradiría RNF-11.

## Cobertura de RF
- **Estructura y cabecera:** RF-1 a RF-9 → README y `banner.mjs`/`divider.mjs` (T2, T11).
- **About me y marcador:** RF-10 y RF-11 → README (T11). RF-12 a RF-17 → `scoreboard.mjs`, `format.mjs` y `stats.mjs` (T1, T4, T5). RF-18 → `github-api.mjs` y `update.mjs` (T7, T10).
- **Proyectos, stack y contacto:** RF-19 a RF-27, RF-47 y RF-48 → `project-card.mjs`, `contact-button.mjs` y README (T3, T11). RF-28 a RF-31 → README (T11).
- **Stats y contribuciones:** RF-32 a RF-39 → `cards.mjs`, `snake.mjs`, `contrib3d.mjs` y `stats.mjs` (T4 a T6).
- **YouTube:** RF-40 a RF-46 → `youtube*.mjs` y `readme.mjs` (T8, T9).
- **Footer:** RF-49 → `footer.mjs` (T2).
- **Actualización y robustez:** RF-50 a RF-58 → `update.mjs` y workflow (T10, T12). RF-59 a RF-64 → `update.mjs`, `github-api.mjs` y `youtube-api.mjs` (T7, T9, T10).
- **Textos alternativos con cifras:** RF-65 → `alt.mjs`, `readme.mjs` y `update.mjs` (T10), y los bloques `ALT:*` del README (T11).
