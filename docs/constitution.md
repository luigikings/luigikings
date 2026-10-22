# Constitución

Principios innegociables del perfil de GitHub de `luigikings`. Toda spec, plan y tarea debe cumplirlos.

## 1. Funciona dentro de GitHub
Todo lo que se muestra en el README debe renderizarse correctamente en github.com, tanto en escritorio como en la app y la web móvil, con las restricciones de sanitizado de GitHub. Si algo solo funciona en local o en otro visor de Markdown, no vale.

## 2. Identidad visual: gaming neón inspirado en Rocket League
- Fondo oscuro: `#0a0e1a`.
- Azul neón (equipo azul): `#00d4ff`.
- Naranja neón (equipo naranja): `#ff8c1a`.
- Acento de boost: `#c04bff`.
- Texto claro: `#e6f1ff`.

Todas las piezas (banners, tarjetas, stats, snake, separadores) usan esta paleta. Hay que evitar la mezcla de temas de terceros que no casen con ella.

## 3. Claro y oscuro
Cada imagen propia se lee bien con el tema claro y con el oscuro de GitHub, ya sea con variantes en `<picture>` o con un fondo propio opaco.

## 4. Autosuficiente y robusto
- Se priorizan los recursos que viven en el repo (SVG propios y generados por Actions) frente a servicios externos que pueden caerse o tener límites de uso.
- Si un recurso dinámico falla, el README no debe quedar roto: siempre hay un archivo previo en el repo o una alternativa estática.

## 5. Accesible
Todas las imágenes llevan `alt` descriptivo y los SVG llevan `<title>`. El texto importante (nombre, rol, enlaces de contacto) existe también como texto o como `alt`, no solo dentro de una animación.

## 6. Ligero
- Cada SVG propio pesa menos de 100 KB.
- Las animaciones son suaves y no marean: nada de parpadeos rápidos.
- La portada tiene que cargar rápido.

## 7. Seguro
- No hay secretos en el repo.
- Los workflows usan permisos mínimos y acciones de fuentes reconocidas, fijadas a versión.

## 8. Contenido en inglés
El README está en inglés, con un tono profesional y cercano. Destaca al desarrollador de software y, como diferencial, al creador de contenido de Rocket League.

## SEO
No aplica. El perfil de GitHub no es una web propia que se posicione.
