# AGENTS.md

Repositorio de **perfil de GitHub** de `luigikings`. GitHub muestra `README.md` en la portada del perfil: <https://github.com/luigikings>.

## Stack
- `README.md`: Markdown con el HTML que GitHub permite (`<picture>`, `<details>`, `<p align>`, `<img>`, `<a>`, tablas).
- `assets/`: SVG propios (animados con CSS o SMIL dentro del propio SVG), imágenes y GIF.
- `.github/workflows/`: GitHub Actions que generan contenido dinámico (snake, contribuciones 3D, stats, últimos vídeos de YouTube).
- `scripts/` (si hace falta): scripts Node sin dependencias externas que usan las Actions o los tests.
- `tests/`: tests con el runner nativo de Node (`node:test`).

## Comandos
- Tests: `node --test "tests/**/*.test.mjs"`
- Node 24 o superior. No hay `package.json` mientras no haga falta ninguna dependencia.

## Límites de GitHub (son la causa de la mayoría de los errores)
- El README **no ejecuta JavaScript** y GitHub elimina `<style>`, `<script>`, `style=""`, `class` e `id` del Markdown.
- La animación solo funciona **dentro de un SVG** cargado como `<img>`. Ese SVG no puede cargar recursos externos (fuentes web, imágenes remotas) ni ejecutar scripts, y no recibe clics: el enlace va en el `<a>` que lo envuelve.
- Modo claro y oscuro: `<picture>` con `<source media="(prefers-color-scheme: dark)">`.
- Las imágenes externas pasan por el proxy `camo` de GitHub, que las cachea. Para lo dinámico se prefieren SVG generados por Actions y guardados en el repo.

## Convenciones
- El contenido del README va en **inglés**. Specs, planes, tareas y commits van en español.
- Se usa la paleta y la estética definidas en `docs/constitution.md`.
- Los SVG deben ser XML válido, llevar `viewBox` y `<title>` para accesibilidad, y nada externo.
- Los workflows deben tener `permissions` mínimos y explícitos, `schedule` y `workflow_dispatch`, y acciones fijadas a una versión mayor (`@v4`) o superior.
- Los commits de los bots no deben disparar bucles de workflows.

## Lo que no se hace
- No se añaden servicios externos de terceros sin necesidad si se puede generar lo mismo con una Action en el repo.
- No se meten secretos en el repo. Si una Action necesita token, va en *Secrets*.
- No se hace push ni se cambian ajustes del repo sin el OK del usuario.
