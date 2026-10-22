# Tareas 001 — Rediseño del README con estilo gaming neón

Plan: `specs/001-rediseno-readme-neon/plan.md`. Tests: `node --test "tests/**/*.test.mjs"`. Cada tarea: tests primero (en rojo), código, tests en verde, marcar y parar.

- [x] **T1. Base común: configuración, paleta, utilidades SVG, formato de números y comprobador de XML.** RF-17, RF-38, RNF-5, RNF-7, RNF-10
  - Hecho cuando: existen `config/profile.json`, `scripts/lib/{palette,svg,format,dates}.mjs` y `tests/helpers/xml.mjs`. Hay tests en verde para `formatNumber` (0, 9 876 → "9,876", 10 000 → "10k", 10 290 → "10.2k", 999 999 → "999.9k", 1 000 000 → "1M", 1 250 000 → "1.2M"), `contrastRatio` (pares de texto ≥ 4.5), `svgDoc` (siempre con `viewBox` y `<title>`, y escapa el texto), `minifySvg` (salida ≤ entrada y XML válido) y `last12Months` (365 días UTC con fecha inyectada).

- [x] **T2. Banner claro/oscuro, separador y onda del footer, más `build-static.mjs`.** RF-2, RF-3, RF-4, RF-5, RF-6, RF-49, RNF-3, RNF-4, RNF-5, RNF-8, RNF-9
  - Hecho cuando: `node scripts/build-static.mjs` genera `assets/static/banner-dark.svg`, `banner-light.svg`, `divider.svg` y `footer-wave.svg`. Los tests comprueban en cada uno: XML válido, `viewBox`, `<title>`, sin recursos externos ni `<script>`, < 100 KB y animaciones ≥ 1 s. El banner contiene el nombre exacto y "Software Developer · Rocket League Creator", tiene partículas en `#c04bff` y su variante clara usa `#0a0e1a` para el texto.

- [x] **T3. Tarjetas de proyecto (5) y botones de contacto (3).** RF-19, RF-20, RF-47, RNF-5, RNF-7
  - Hecho cuando: `build-static.mjs` genera las 5 tarjetas con nombre y descripción exactos de RF-20, y los botones LinkedIn, YouTube y Gmail con fondo opaco `#0a0e1a`. Los tests comprueban los textos exactos, un contraste ≥ 4.5 y las mismas reglas de SVG que T2.

- [x] **T4. Cálculos puros del perfil (`stats.mjs`).** RF-13, RF-14, RF-15, RF-16, RF-33, RF-34, RF-39
  - Hecho cuando: `buildProfileStats(raw, today, cfg)` devuelve `ProfileStats` según el plan. Hay tests en verde para: repos (con privados y archivados), commits en la ventana de 365 días, `assists` = PRs + issues + revisiones, estrellas solo de repos públicos, lenguajes (exclusiones, máximo 6, porcentajes, empate alfabético, ninguno → `null`), racha (termina hoy, termina ayer, cortada, vacía), total de contribuciones, niveles de la cuadrícula 0-4 y todo a cero sin errores.

- [x] **T5. Marcador y tarjetas de stats, lenguajes y racha.** RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-32, RF-33, RF-34, RNF-7
  - Hecho cuando: `renderScoreboard` y las tres tarjetas de `cards.mjs` pintan desde un único `ProfileStats` de ejemplo. Los tests comprueban:
    - Títulos Goals, Saves, Assists y MVP con las subetiquetas exactas de la tabla de la spec.
    - Las etiquetas exactas de RF-32 y RF-34.
    - Números formateados, "—" si no hay lenguaje y "No languages yet".
    - Las cifras también en el `<title>`.
    - Reglas de SVG de T2.

- [x] **T6. Snake (claro/oscuro) y gráfico 3D generados en casa, con posprocesado.** RF-35, RF-36, RF-37, RF-38, RNF-8, RNF-9
  - Hecho cuando: `renderSnake(grid, theme)` y `renderContrib3d(grid)` generan SVG válidos desde una cuadrícula de ejemplo de 53 × 7. Los tests comprueban:
    - Sin cifras ni texto aparte del `<title>`.
    - Colores solo de la paleta.
    - El ciclo de la serpiente dura ≥ 1 s.
    - `minifySvg` no aumenta el tamaño.
    - El peso queda registrado; si supera 100 KB, el test avisa sin fallar (excepción de RNF-8).

- [x] **T7. Capa de API de GitHub (`github-api.mjs`).** RF-18, RF-63 *(parte con `fetch` falso hecha; la comprobación con la credencial real queda PENDIENTE para T13: no había token disponible)*
  - Hecho cuando: con un `fetch` falso y fixtures, se cumplen la paginación de repos y de nodos de contribución por año, el invariante "Σ commits del año = `totalCommitContributions`" y que `raw` no contiene nombres de repositorio. También: credencial ausente → error antes de usar la red; respuesta 401 → error tipado; y ningún mensaje de error incluye nombres de repos.
  - Además: se comprueba una vez con la credencial real del usuario que los privados propios aparecen en `raw`. Si no aparecen, se para y se consulta.

- [x] **T8. Selección de vídeos y sección de YouTube (lógica pura).** RF-41, RF-42, RF-43, RF-44, RF-45, RF-46
  - Hecho cuando: hay tests en verde con fixtures de vídeo normal, Short (sonda 200, 303 y error de red), directo en curso, programado, grabación de directo, estreno emitido, estreno programado y privado. Se cubren el orden por fecha, el caso de menos de 3 elegibles y el de cero, y el título de más de 60 caracteres truncado con "…" y escapado (`& < > "`). `renderYoutubeSection` genera miniaturas `i.ytimg.com` con `alt` = título, enlaces `watch?v=ID` y el enlace al canal, y `replaceBetweenMarkers` solo cambia el bloque entre marcadores.

- [x] **T9. Capa de API de YouTube y `resolve-channel-id.mjs`.** RF-40, RF-61, RF-62
  - Hecho cuando: con un `fetch` falso, se usa la lista de subidas `UU…` derivada del `channelId` de la configuración. Clave ausente, clave inválida o cuota agotada → error tipado. Respuesta vacía o mal formada → error sin vídeos. `resolve-channel-id.mjs` imprime el `UC…` a partir de un handle (probado con un `fetch` falso).
  - Si el usuario ya ha creado la clave: se calibran los umbrales de la heurística con los vídeos reales del canal.

- [x] **T10. Textos alternativos con cifras, orquestador `update.mjs` y archivos iniciales.** RF-18, RF-39, RF-51, RF-52, RF-53, RF-54, RF-55, RF-59, RF-60, RF-61, RF-62, RF-63, RF-64, RF-65, RNF-7
  - Hecho cuando `tests/alt.test.mjs` está en verde:
    - `buildAltTexts(stats)` devuelve los 4 textos exactos del plan (ejemplo, todo a cero con "—" y "No languages yet", números ≥ 10 000 abreviados) con `alt` escapado.
    - `renderScoreboard` y las tarjetas de `cards.mjs` usan ese mismo texto en su `<title>` (refactor mínimo de T5 sin cambiar su salida visual; los tests de T5 siguen en verde).
    - `applyStatsAlts` sustituye solo los 4 bloques `ALT:*` y aplicarla dos veces da el mismo resultado.
  - Y con dependencias falsas, los tests de `update.mjs` comprueban:
    - Todo bien → se escriben todas las piezas y los 4 `alt` del README tienen las cifras de las piezas.
    - Falla GitHub → no cambia ninguna pieza del grupo ni ningún bloque `ALT:*`, sí cambia YouTube y `failed=true`.
    - Falla YouTube → el bloque de YouTube no cambia; los stats y sus `alt` sí.
    - Sin cambios en los datos → no se escribe nada, tampoco el README.
    - La salida no contiene secretos ni nombres de repos.
    - Ninguna pieza incluye fechas de "última actualización".
    - Escritura atómica.
  - Además: `node scripts/update.mjs --seed` crea todos los `assets/generated/*.svg` iniciales válidos y rellena los 4 bloques `ALT:*` del README con los valores iniciales ("0" y "—").

- [x] **T11. Nuevo README.** RF-1, RF-2, RF-4, RF-6, RF-7, RF-8, RF-9, RF-10, RF-11, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-46, RF-47, RF-48, RF-49, RF-60, RF-65, RNF-1, RNF-2, RNF-6, RNF-7, RNF-8, RNF-12, RNF-13
  - Hecho cuando: `tests/readme.test.mjs` está en verde y comprueba todo lo que lista el plan:
    - Orden de las 7 secciones y 6 separadores.
    - `<picture>` para banner, texto animado y snake.
    - URL `demolab` con las 4 frases exactas y los colores por tema.
    - Marcador con `align`.
    - 5 tarjetas con sus URL y ningún enlace al repo de Magnar.
    - AgencyMac sin ".NET".
    - Iconos de las 23 tecnologías, salvo las que no tienen icono en skillicons (comprobadas a mano), que solo aparecen como texto.
    - 5 `<details>` cerrados con su lista exacta.
    - Marcadores de YouTube.
    - 4 bloques `ALT:scoreboard`, `ALT:stats`, `ALT:languages` y `ALT:streak` presentes una sola vez, con `alt` igual a `buildAltTexts` de los valores iniciales de `--seed`.
    - Snake y 3D con `alt` fijo y sin cifras.
    - Contactos con las URL de RF-48.
    - Sin `<table>`, `<style>`, `<script>`, `class=`, `id=` ni `style=`.
    - Todas las `<img>` con `alt`.
    - Todo `src` relativo existe en disco.
    - Peso total por tema ≤ 1.5 MB.
    - Todo el texto en inglés.

- [x] **T12. Workflow `update-profile.yml`.** RF-50, RF-51, RF-53, RF-54, RF-56, RF-57, RF-58, RNF-11
  - Hecho cuando: `tests/workflow.test.mjs` está en verde y comprueba:
    - `schedule` diario y `workflow_dispatch`, sin disparador `push`.
    - `permissions` con solo `contents: write`.
    - `concurrency` sin cancelar la ejecución en curso.
    - Acciones solo `actions/checkout@v4` y `actions/setup-node@v4` con Node 24.
    - Secretos `PROFILE_READ_TOKEN` y `YOUTUBE_API_KEY` vía `secrets.`.
    - Guardado solo si hay cambios, con un reintento tras `pull --rebase`.
    - Paso final que falla si `failed == 'true'`.

- [ ] **T13. Puesta en marcha y validación manual (con el usuario).** Criterios de finalización, RF-42, RF-57, RNF-1, RNF-2, RNF-5, RNF-9
  - Hecho cuando:
    - El usuario ha completado los 5 pasos manuales del plan y ha dado el OK al push.
    - Hay una ejecución manual del workflow en verde que no se vuelve a disparar sola.
    - La salida de esa ejecución no muestra secretos ni nombres privados.
    - La lista real de vídeos no tiene Shorts ni directos (si los tiene, se ajustan los umbrales de la configuración).
    - El perfil se ha revisado en github.com en claro y oscuro, en escritorio, a 375 px sin scroll horizontal y en la app móvil (esta última, el usuario).
