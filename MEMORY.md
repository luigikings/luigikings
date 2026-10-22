# MEMORY.md

## Estado actual (2026-10-22)
- **Spec 001 implementada** (rediseño gaming neón estilo Rocket League). README en inglés con banner, marcador de stats (Goals/Saves/Assists/MVP), snake y contribuciones 3D generados en casa, y últimos 3 vídeos de YouTube (@lk_rl).
- Se actualiza solo con `.github/workflows/update-profile.yml`: diario a las 05:17 UTC + `workflow_dispatch`. Secretos: `PROFILE_READ_TOKEN` (PAT fine-grained, solo lectura) y `YOUTUBE_API_KEY`. `channelId` `UCLSX6ZwA-2sZmmx5rSB3-pw`.
- Comandos: tests `node --test "tests/**/*.test.mjs"`; actualizar `node scripts/update.mjs [--seed]`; SVG estáticos `node scripts/build-static.mjs`; obtener el `UC…` de un handle `node scripts/resolve-channel-id.mjs`.
- Pendiente: el usuario revisa la app móvil de GitHub y confirma que ningún vídeo es grabación de directo. Commits locales sin push hasta su OK.
- Fase 2: minijuego con issues y Actions (spec aparte).
- Opcionales del reviewer: aviso si el PAT pierde acceso a privados; test alt == `<title>` sobre los SVG en disco; subir acciones por encima de `@v4`; renovar el PAT antes de que caduque.

## Decisiones
- **Estilo gaming neón Rocket League** (azul y naranja). Elegido por el usuario frente a terminal/hacker.
- **README en inglés** para más alcance internacional.
- **Todo dinámico con Actions en el repo** porque el servidor público de `github-readme-stats` se cae por límite de uso.
- **PAT fine-grained de solo lectura para leer, `GITHUB_TOKEN` para guardar**: mínimo privilegio; el PAT nunca escribe y los commits con `GITHUB_TOKEN` no re-disparan workflows.
- **Grupos github / contrib / youtube independientes**: si falla uno (cuota, red, token) los demás se actualizan igual y la ejecución termina en rojo para avisar.
- **Snake y contribuciones 3D generados en casa**: sin servicios de terceros, con la paleta propia y sin el proxy `camo` cacheando contenido ajeno.
- **Miniaturas enlazadas a YouTube** (`i.ytimg.com` + `watch?v=`): no se guardan imágenes en el repo.
- **Títulos de vídeo en su idioma original** (sin traducir); se truncan a 60 caracteres y se escapan.
- **Los `alt` con cifras los reescribe la Action** en cada ejecución para que coincidan con los SVG.
- **Shorts detectados con la sonda `/shorts/`** (200 = Short), con tolerancia: si la sonda falla se aplica la heurística de duración.

## Errores a evitar
- `gh secret set` en PowerShell con el prompt oculto guardó secretos **vacíos** al pegar. Usar la web de GitHub o `--body`.
- `node --test tests/` no funciona en Node 24: usar el glob entre comillas.
- Animar con CSS un `<g>` que tiene `transform` como atributo lo pisa: animar un `<g>` interior.
- Los tests que leen el README real no deben asumir los valores de `--seed` (la Action pone cifras reales).
- La sonda `/shorts/` lanzada desde fuera de la UE puede recibir la página de consentimiento: tratarla como resultado no concluyente.
- skillicons.dev no tiene icono de MariaDB.
- `readme-typing-svg.herokuapp.com` está obsoleta: usar `readme-typing-svg.demolab.com`.
- No mezclar temas de terceros (p. ej. `radical`) con la paleta neón.
- En el README no hay CSS ni JS; la animación solo vive dentro de los SVG.
- `<picture>` sigue el `prefers-color-scheme` del sistema, no el tema elegido en la cuenta de GitHub.
