# MEMORY.md

## Estado actual (2026-10-22)
- SDD inicializado. Todavía no hay ninguna spec.
- `README.md` es la versión original: Typing SVG, about me, proyectos, badges de shields.io y stats de vercel con el tema `radical`.
- Siguiente paso: spec 001, rediseño visual del README con estilo gaming neón inspirado en Rocket League.

## Decisiones
- **Estilo gaming neón inspirado en Rocket League** (azul y naranja de los equipos). Lo eligió el usuario frente al estilo terminal/hacker.
- **README en inglés**, para tener más alcance internacional.
- **Elementos dinámicos con GitHub Actions**: últimos vídeos de YouTube (@lk_rl), snake de contribuciones, contribuciones en 3D y stats propios. Se usan Actions porque el servidor público de `github-readme-stats` en vercel se cae por límite de uso.
- **Minijuego con issues y Actions → fase 2**, en una spec aparte después del rediseño.

## Errores a evitar
- La URL `readme-typing-svg.herokuapp.com` está obsoleta. Hay que usar `readme-typing-svg.demolab.com`.
- No mezclar temas de colores de terceros (por ejemplo `radical`, rosa) con la paleta neón.
- En el README no funcionan CSS ni JS. Las animaciones solo funcionan dentro de los SVG.
