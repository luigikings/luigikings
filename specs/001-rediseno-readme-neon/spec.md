# Spec 001 — Rediseño del README con estilo gaming neón

Estado: implementada

## Contexto y objetivo
El README del perfil de GitHub de `luigikings` es la portada pública del usuario en <https://github.com/luigikings>. La versión actual es correcta pero plana: un texto animado con una URL obsoleta, texto con emojis, badges genéricos y stats de un servicio público que se cae por límite de uso y usa un tema (`radical`) que no casa con su identidad. Además, describe AgencyMac de forma desactualizada. El usuario quiere que sea "muchísimo más visual e incluso más interactivo". El objetivo es rediseñarlo con una identidad gaming neón inspirada en Rocket League (la paleta de la constitución) que destaque al desarrollador de software y, como diferencial, al creador de contenido de Rocket League. Su contenido dinámico (vídeos, marcador, stats, contribuciones) debe mantenerse actualizado solo, con datos reales que incluyen la actividad privada propia como cifras agregadas, y sin depender de servicios que se caen.

## Usuarios
- Visitantes del perfil: reclutadores, otros desarrolladores, colaboradores potenciales y espectadores del canal de YouTube, en escritorio y en móvil (navegador y app de GitHub), con tema claro u oscuro.
- El propio usuario (`luigikings`), que mantiene el perfil, hace a mano la puesta en marcha inicial (credenciales y permisos) y quiere que después el contenido dinámico se actualice sin su intervención.

## Historias de usuario
- HU-1. Como visitante, quiero ver nada más entrar una cabecera animada con el nombre y el rol del usuario para saber en segundos quién es y qué le diferencia.
- HU-2. Como visitante, quiero leer una presentación breve acompañada de un marcador de partida con datos reales del perfil para conocer al usuario de forma rápida y memorable.
- HU-3. Como reclutador o desarrollador, quiero ver los proyectos más importantes como tarjetas clicables para entender en qué trabaja y acceder a ellos.
- HU-4. Como reclutador, quiero ver el stack tecnológico de un vistazo y poder desplegar el detalle por categorías para evaluar sus conocimientos sin que la página se haga larga.
- HU-5. Como espectador de Rocket League, quiero ver los últimos vídeos del canal con su miniatura para ir directamente a verlos.
- HU-6. Como visitante, quiero ver estadísticas de GitHub y la actividad de contribuciones de forma visual para hacerme una idea de su actividad.
- HU-7. Como visitante, quiero botones de contacto claros al final para escribirle o seguirle.
- HU-8. Como propietario del perfil, quiero que vídeos, marcador, stats y gráficos de contribuciones se actualicen solos, que un fallo no rompa la portada y que nunca se expongan mis repositorios privados.

## Definiciones
- **Paleta neón**: los colores de `docs/constitution.md` (fondo `#0a0e1a`, azul `#00d4ff`, naranja `#ff8c1a`, boost `#c04bff`, texto `#e6f1ff`).
- **Sección principal**: cada uno de estos bloques del README, en este orden: (1) Cabecera (banner + texto animado), (2) About me + marcador, (3) Projects, (4) Tech stack, (5) GitHub stats (tarjetas + snake + gráfico 3D), (6) Latest YouTube videos, (7) Contact + footer.
- **Pieza visual**: cada imagen que forma parte del README (banner, texto animado, marcador, tarjetas, iconos, separadores, footer, stats, snake, gráfico 3D, miniaturas).
- **Pieza propia**: pieza visual creada o generada dentro del repositorio y servida desde él.
- **Pieza dinámica**: pieza propia que se regenera automáticamente con datos actualizados: lista de vídeos, marcador, tarjeta de stats, tarjeta de lenguajes, tarjeta de racha, snake y gráfico 3D.
- **Actualización automática**: proceso que regenera las piezas dinámicas. Se ejecuta de forma programada una vez al día y también puede lanzarse a mano.
- **Ejecución fallida**: ejecución de la actualización automática que termina con estado de error visible para el usuario en el historial de ejecuciones del repositorio.
- **Variante clara / oscura**: versión de una pieza pensada para el tema claro u oscuro de GitHub, que se muestra según el tema del visitante.
- **Credencial de GitHub**: token personal de grano fino y solo lectura, creado a mano por el usuario y guardado como secreto del repositorio. Se usa únicamente para leer datos (incluida la actividad privada propia como cifras agregadas), nunca para escribir en el repositorio.
- **Permiso de escritura propio**: permiso que el propio repositorio concede a la actualización automática para guardar sus cambios. Es independiente de la credencial de GitHub.
- **Clave de YouTube**: clave gratuita de la API de datos de YouTube creada a mano por el usuario y guardada como secreto del repositorio.
- **ID del canal**: identificador del canal de YouTube (empieza por `UC`) correspondiente al handle `@lk_rl`. Se deduce una sola vez a partir del handle, queda fijado en la configuración del proyecto y el usuario lo confirma.
- **Vídeo elegible**: vídeo público y ya publicado del canal que no es un Short, ni un directo (en emisión o programado), ni la grabación de un directo terminado. Un estreno ya emitido cuenta como vídeo elegible. **Tolerancia aceptada por el usuario**: YouTube no marca de forma explícita todos estos tipos, así que la clasificación usa señales indirectas (duración, proporción o formato, datos de emisión) y puede equivocarse alguna vez con un vídeo concreto. Esto no se considera un defecto.
- **Repositorio propio**: repositorio cuyo propietario es `luigikings` y que no es un fork, público o privado, incluidos los archivados y el repositorio de perfil.
- **Actividad contable**: contribuciones del usuario en repositorios públicos (de cualquier propietario) y en repositorios privados propios. No cuentan las contribuciones en repositorios privados de otros propietarios u organizaciones.
- **Zona horaria de referencia**: UTC. Todos los periodos ("últimos 12 meses", días de racha) se calculan en UTC. Motivo: es la zona en la que se ejecuta la actualización automática y en la que GitHub devuelve las fechas de contribución, así que el cálculo es determinista. La diferencia con la hora de Madrid (1-2 h en el cambio de día) se acepta.
- **Últimos 12 meses**: los 365 días anteriores al día UTC de la ejecución, incluido este (la misma ventana que el gráfico de contribuciones de GitHub).
- **Lenguaje top**: el lenguaje con más bytes de código sumados entre todos los repositorios propios, contando los privados mediante la credencial de GitHub. Se excluyen los lenguajes de marcado y estilo HTML, CSS, SCSS, Sass, Less, Markdown y MDX, porque inflan el recuento sin reflejar lógica de programación. Si hay empate, gana el primero por orden alfabético.
- **Cifras del perfil**: cada número que muestran el marcador y las tarjetas de stats. Su definición, alcance y etiqueta visible exacta están en esta tabla, que es la única fuente de verdad:

| Cifra | Dónde se muestra | Etiqueta visible | Periodo | Alcance |
|---|---|---|---|---|
| Repositorios | Marcador (Goals) | "Repositories" | Actual | Repositorios propios, públicos + privados |
| Commits | Marcador (Saves) y tarjeta de stats | "Commits (last year)" | Últimos 12 meses | Contribuciones de commit de la actividad contable |
| PRs + issues + revisiones | Marcador (Assists) | "PRs, issues & reviews" | Histórico total | Actividad contable |
| Lenguaje top | Marcador (MVP) | "Top language" | Actual | Según la definición de lenguaje top |
| Estrellas | Tarjeta de stats | "Stars" | Actual | Estrellas recibidas en repositorios propios públicos |
| Pull requests | Tarjeta de stats | "Pull requests (all time)" | Histórico total | Actividad contable |
| Issues | Tarjeta de stats | "Issues (all time)" | Histórico total | Actividad contable |
| Revisiones | Tarjeta de stats | "Code reviews (all time)" | Histórico total | Actividad contable |
| Contribuciones totales | Tarjeta de racha | "Total contributions" | Histórico total | Todas las contribuciones de la actividad contable |
| Racha actual | Tarjeta de racha | "Current streak" | Hasta hoy (UTC) | Días consecutivos con al menos 1 contribución de la actividad contable, terminando hoy o ayer |
| Racha más larga | Tarjeta de racha | "Longest streak" | Histórico total | Máximo de días consecutivos con al menos 1 contribución de la actividad contable |

  En el marcador, la etiqueta de juego (Goals, Saves, Assists, MVP) es el título de cada casilla y la etiqueta visible de la tabla es su subetiqueta. "PRs, issues & reviews" del marcador es igual a la suma de "Pull requests (all time)", "Issues (all time)" y "Code reviews (all time)" de la tarjeta de stats. La snake y el gráfico 3D no muestran cifras (RF-37), así que no forman parte de esta tabla.

## Requisitos funcionales

### Estructura (HU-1 a HU-7)
- RF-1: EL SISTEMA muestra las secciones principales en este orden: Cabecera, About me + marcador, Projects, Tech stack, GitHub stats, Latest YouTube videos, Contact + footer.
- RF-2: EL SISTEMA muestra un separador animado en la paleta neón entre cada par de secciones principales consecutivas (6 separadores).

### Cabecera (HU-1)
- RF-3: EL SISTEMA muestra al inicio del README un banner propio animado que representa un campo de Rocket League en perspectiva con líneas en la paleta neón.
- RF-4: EL SISTEMA muestra en el banner el nombre "Luis Ángel Jose Da Silva" con un brillo (glow) pulsante y el subtítulo "Software Developer · Rocket League Creator". Que el subtítulo diga "Software Developer" y la primera frase del texto animado (RF-8) diga "Full-Stack Developer" es intencionado: el subtítulo es el rol general y la frase rotativa lo concreta.
- RF-5: EL SISTEMA muestra en el banner partículas de boost animadas en el color de boost de la paleta.
- RF-6: MIENTRAS el visitante usa el tema claro de GitHub, EL SISTEMA muestra la variante clara del banner; MIENTRAS usa el tema oscuro, muestra la variante oscura.
- RF-7: EL SISTEMA muestra debajo del banner un texto animado de tipo "máquina de escribir" con colores de la paleta neón según RNF-5, servido desde el dominio vigente del servicio (no el obsoleto).
- RF-8: EL SISTEMA muestra en el texto animado exactamente estas frases y en este orden: "Full-Stack Developer", "Building web apps with .NET, React & Node", "Rocket League content creator", "Always shipping, always boosting 🚀". "Full-Stack Developer" es distinto del subtítulo de RF-4 de forma intencionada.
- RF-9: MIENTRAS el visitante usa el tema claro o el oscuro, EL SISTEMA muestra la variante del texto animado correspondiente a ese tema, con un color de texto que cumple el contraste de RNF-5 sobre el fondo de la página.

### About me y marcador (HU-2)
- RF-10: EL SISTEMA muestra la sección "About me" en dos columnas: el marcador a un lado y un texto breve en inglés al otro.
- RF-11: EL SISTEMA muestra en el texto breve que el usuario es Software Developer, creador de contenido de Rocket League en YouTube (@lk_rl), que ha terminado DAW (Web Application Development), que combina frontend, backend y bases de datos, que experimenta con herramientas de IA para mejorar su forma de trabajar y que está abierto a colaboraciones.
- RF-12: EL SISTEMA muestra el marcador con la estética de marcador de partida de Rocket League (equipos azul y naranja de la paleta) y cuatro casillas con los títulos Goals, Saves, Assists y MVP.
- RF-13: EL SISTEMA muestra en la casilla Goals la cifra "Repositories" de la tabla de cifras del perfil.
- RF-14: EL SISTEMA muestra en la casilla Saves la cifra "Commits (last year)" de la tabla de cifras del perfil.
- RF-15: EL SISTEMA muestra en la casilla Assists la cifra "PRs, issues & reviews" de la tabla de cifras del perfil.
- RF-16: EL SISTEMA muestra en la casilla MVP el nombre del lenguaje top, con la subetiqueta "Top language".
- RF-17: EL SISTEMA muestra cada cifra numérica del marcador y de las tarjetas de stats completa con separador de miles en inglés (p. ej. "9,876") si es menor que 10 000. Desde 10 000 hasta 999 999 la muestra abreviada con sufijo "k", y desde 1 000 000 con sufijo "M". En ambos casos se trunca a un decimal y se omite el decimal si es 0 (p. ej. 10 000 → "10k", 10 290 → "10.2k", 1 000 000 → "1M", 1 250 000 → "1.2M").
- RF-18: EL SISTEMA incluye la actividad de repositorios privados propios solo como cifras agregadas, sin mostrar el nombre de ningún repositorio privado en ninguna pieza, en ningún texto alternativo, en el README ni en la salida pública de la actualización automática.

### Proyectos (HU-3)
- RF-19: EL SISTEMA muestra cinco tarjetas neón de proyecto, en este orden: Magnar WarGames, ChatarreroMetalRenova, AgencyMac, ChefAsesoriaJ y YouTube (Rocket League content). Estas tarjetas sustituyen a la sección "Currently working on" del README actual.
- RF-20: EL SISTEMA muestra en cada tarjeta el nombre del proyecto y una descripción breve en inglés de una sola frase, con estos textos exactos:
  - Magnar WarGames: "Game of Thrones–inspired strategy web app"
  - ChatarreroMetalRenova: "Static Astro + TypeScript site for a Madrid scrap-metal business, built for speed and local SEO"
  - AgencyMac: "Astro monorepo for a marketing & coding agency — public site + internal CRM"
  - ChefAsesoriaJ: "Multi-page React + Vite + Tailwind marketing site for Gatrobatos, a hospitality brand"
  - YouTube (Rocket League content): "Rocket League content and tutorials to help players improve"
- RF-21: CUANDO el visitante pulsa la tarjeta de Magnar WarGames, EL SISTEMA abre `https://www.magnarwargames.com/`.
- RF-22: CUANDO el visitante pulsa la tarjeta de ChatarreroMetalRenova, EL SISTEMA abre `https://github.com/luigikings/ChatarreroMetalRenova`.
- RF-23: CUANDO el visitante pulsa la tarjeta de AgencyMac, EL SISTEMA abre `https://github.com/luigikings/AgencyMac`.
- RF-24: CUANDO el visitante pulsa la tarjeta de ChefAsesoriaJ, EL SISTEMA abre `https://github.com/luigikings/ChefAsesoriaJ`.
- RF-25: CUANDO el visitante pulsa la tarjeta de YouTube, EL SISTEMA abre `https://youtube.com/@lk_rl`.
- RF-26: EL SISTEMA no enlaza en ningún punto del README al repositorio de Magnar WarGames, porque es privado.
- RF-27: EL SISTEMA describe AgencyMac en cualquier parte del README de forma coherente con RF-20 y no lo presenta como un proyecto .NET + TailwindCSS.

### Tech stack (HU-4)
- RF-28: EL SISTEMA muestra filas de iconos de tecnología, sin texto de badge, para exactamente estas tecnologías: HTML5, CSS3, JavaScript, TypeScript, React, TailwindCSS, Node.js, Django, .NET, PHP, MySQL, MariaDB, MongoDB, Java, Python, C, C#, Kotlin, Git, Docker, Linux, AWS y Azure.
- RF-29: SI una tecnología de RF-28 no tiene icono disponible en el servicio de iconos, ENTONCES EL SISTEMA la omite de las filas de iconos y la muestra solo como texto dentro de su sección desplegable.
- RF-30: EL SISTEMA muestra, debajo de los iconos, cinco secciones desplegables cerradas por defecto, una por categoría y en este orden: Frontend, Backend, Databases, Programming Languages y Tools & DevOps.
- RF-31: CUANDO el visitante abre una sección desplegable, EL SISTEMA muestra exactamente las tecnologías de esa categoría: Frontend (HTML5, CSS3, JavaScript, TypeScript, React, TailwindCSS); Backend (Node.js, Django, .NET, PHP); Databases (MySQL, MariaDB, MongoDB); Programming Languages (Java, Python, C, C#, Kotlin); Tools & DevOps (Git, Docker, Linux, AWS, Azure).

### GitHub stats y contribuciones (HU-6)
- RF-32: EL SISTEMA muestra una tarjeta de stats propia, con la paleta neón, que contiene exactamente las cifras "Stars", "Commits (last year)", "Pull requests (all time)", "Issues (all time)" y "Code reviews (all time)".
- RF-33: EL SISTEMA muestra una tarjeta de lenguajes propia, con la paleta neón, con hasta 6 lenguajes ordenados por bytes de mayor a menor y su porcentaje, calculados con el mismo criterio que el lenguaje top (el primero de la tarjeta es siempre el lenguaje top).
- RF-34: EL SISTEMA muestra una tarjeta de racha propia, con la paleta neón, con las cifras "Current streak", "Longest streak" y "Total contributions".
- RF-35: EL SISTEMA muestra la animación "snake" que recorre la cuadrícula de contribuciones de la actividad contable de los últimos 12 meses, con variante clara y oscura.
- RF-36: EL SISTEMA muestra un gráfico 3D de la cuadrícula de contribuciones de la actividad contable de los últimos 12 meses.
- RF-37: EL SISTEMA muestra en la snake y en el gráfico 3D solo la cuadrícula de contribuciones, sin cifras, totales, estrellas ni gráficos de lenguajes propios.
- RF-38: CUANDO se generan la snake y el gráfico 3D, EL SISTEMA los posprocesa: recolorea a la paleta neón, añade un `<title>` descriptivo y optimiza el archivo, de forma que el resultado no pesa más que el generado originalmente.
- RF-39: EL SISTEMA calcula el marcador, la tarjeta de stats, la tarjeta de lenguajes y la tarjeta de racha a partir de un único conjunto de datos obtenido en la misma ejecución, de forma que las cifras compartidas coinciden siempre entre piezas.

### Latest YouTube videos (HU-5)
- RF-40: EL SISTEMA obtiene los vídeos del canal usando el ID del canal fijado en la configuración, no el handle en cada ejecución.
- RF-41: EL SISTEMA muestra los 3 vídeos elegibles más recientes del canal, ordenados del más nuevo al más antiguo, cada uno con su miniatura y su título.
- RF-42: EL SISTEMA excluye de la lista los Shorts, los directos en emisión o programados y las grabaciones de directos, e incluye los estrenos ya emitidos, aplicando las señales indirectas y la tolerancia de la definición de vídeo elegible. Se verifica con datos de ejemplo de cada tipo y con una revisión manual de la lista real.
- RF-43: EL SISTEMA muestra la miniatura de cada vídeo enlazando directamente a la imagen oficial servida por YouTube (no se guarda en el repositorio), con el título del vídeo como texto alternativo. El título es el real del canal y se muestra tal cual, en el idioma en que esté publicado (excepción de idioma de RNF-7 y RNF-13).
- RF-44: CUANDO el visitante pulsa la miniatura o el título de un vídeo, EL SISTEMA abre ese vídeo en YouTube.
- RF-45: CUANDO se ejecuta la actualización automática y la lista de 3 vídeos elegibles más recientes difiere de la mostrada (vídeo nuevo, vídeo eliminado o hecho privado, título o miniatura cambiados), EL SISTEMA sustituye la lista mostrada por la nueva.
- RF-46: EL SISTEMA muestra en la sección un enlace al canal de YouTube.

### Contacto y footer (HU-7)
- RF-47: EL SISTEMA muestra botones de contacto restilizados en la paleta neón para LinkedIn, YouTube y Gmail.
- RF-48: CUANDO el visitante pulsa un botón de contacto, EL SISTEMA abre el destino actual: LinkedIn `https://www.linkedin.com/in/luis-angel-da-silva-a18a13244`, YouTube `https://youtube.com/@lk_rl` y correo `mailto:luigidasilv@gmail.com`.
- RF-49: EL SISTEMA muestra al final del README un footer con una onda (wave) neón animada.

### Actualización automática (HU-8)
- RF-50: EL SISTEMA tiene programada la actualización automática una vez al día y permite lanzarla a mano en cualquier momento.
- RF-51: CUANDO se ejecuta la actualización automática (programada o manual), EL SISTEMA intenta regenerar todas las piezas dinámicas.
- RF-52: EL SISTEMA actualiza cada pieza dinámica de forma independiente: guarda las que se generan correctamente y conserva la versión anterior de las que fallan. El marcador y las tres tarjetas de stats, lenguajes y racha, junto con sus textos alternativos del README (RF-65), cuentan como un único grupo que se actualiza entero o no se actualiza (RF-39).
- RF-53: SI alguna pieza dinámica falla durante una ejecución, ENTONCES EL SISTEMA marca esa ejecución como ejecución fallida después de guardar las piezas que sí se generaron. Motivo: el usuario se entera del fallo sin que se pierdan las piezas correctas.
- RF-54: SI una ejecución no produce cambios en ninguna pieza, ENTONCES EL SISTEMA no guarda ningún cambio en el repositorio.
- RF-55: EL SISTEMA no incluye en las piezas ni en el README marcas de "última actualización" ni ningún otro dato que cambie en cada ejecución sin que cambien los datos de origen.
- RF-56: EL SISTEMA guarda los cambios de la actualización automática usando el permiso de escritura propio, nunca la credencial de GitHub (que es solo de lectura).
- RF-57: CUANDO la actualización automática guarda cambios en el repositorio, EL SISTEMA no dispara una nueva ejecución de la actualización automática.
- RF-58: SI al guardar los cambios el repositorio remoto tiene cambios nuevos (p. ej. un envío simultáneo del usuario), ENTONCES EL SISTEMA integra los cambios remotos y reintenta el guardado una vez; si vuelve a fallar, marca la ejecución como fallida sin sobrescribir los cambios del usuario.
- RF-65: CUANDO la actualización automática regenera el grupo marcador + tarjetas de stats, lenguajes y racha, EL SISTEMA reescribe en el README el texto alternativo de esas cuatro piezas con las mismas cifras que muestran, como parte del mismo grupo (si el grupo no se actualiza, los textos alternativos anteriores se mantienen).

### Robustez (HU-8)
- RF-59: SI la actualización automática falla (error de red, de la API de YouTube, de la API de GitHub o del propio proceso), ENTONCES EL SISTEMA mantiene en el repositorio la última versión generada correctamente de cada pieza afectada.
- RF-60: EL SISTEMA tiene en el repositorio, desde la primera publicación del nuevo README, un archivo inicial válido para cada pieza dinámica, de forma que ninguna imagen del README apunta a un archivo inexistente.
- RF-61: SI la fuente de vídeos devuelve una respuesta vacía, mal formada o sin ningún vídeo elegible, ENTONCES EL SISTEMA no sobrescribe la lista de vídeos existente.
- RF-62: SI la clave de YouTube no existe, no es válida o ha agotado su cuota, ENTONCES EL SISTEMA mantiene la última lista de vídeos válida y marca la ejecución como fallida.
- RF-63: SI la credencial de GitHub no existe, ha caducado o no tiene permisos suficientes, ENTONCES EL SISTEMA mantiene el último marcador y las últimas tarjetas de stats, lenguajes y racha válidos (sin degradar a cifras solo públicas) y marca la ejecución como fallida. Motivo: degradar haría que las cifras bajaran de golpe y se contradijeran con las publicadas antes.
- RF-64: SI el cálculo de cualquier cifra del grupo marcador + tarjetas falla, ENTONCES EL SISTEMA mantiene el último grupo válido completo, sin mezclar valores nuevos y antiguos.

## Requisitos no funcionales
- RNF-1 (plataforma): todo el README se renderiza correctamente en github.com en escritorio, en navegador móvil a 375 px de ancho y en la app móvil de GitHub, con el sanitizado de GitHub. No se usa JavaScript, `<style>`, `style=""`, `class` ni `id` en el README.
- RNF-2 (móvil): a 375 px de ancho no hay scroll horizontal ni en la página ni dentro de ningún bloque (tablas incluidas), cada imagen se escala para caber en el ancho disponible sin recortarse y ningún texto queda cortado. Se acepta que las dos columnas de "About me" y las tarjetas de proyectos se muestren reducidas en lugar de apiladas, siempre que se cumpla lo anterior.
- RNF-3 (animación): toda animación vive dentro de un SVG mostrado como imagen; los enlaces van en el elemento que envuelve la imagen.
- RNF-4 (autosuficiencia de SVG): ningún SVG propio carga recursos externos (fuentes web, imágenes remotas) ni contiene scripts.
- RNF-5 (claro/oscuro y contraste): cada pieza propia y el texto animado se leen bien con el tema claro y con el oscuro, mediante variantes por tema o con un fondo propio opaco oscuro (`#0a0e1a`). Todo texto de las piezas propias y del texto animado tiene un contraste de al menos 4.5:1 con su fondo inmediato en ambos temas. En las variantes claras sin fondo opaco, el texto usa `#0a0e1a` (u otro tono oscuro derivado de la paleta) y los colores neón se usan solo como acentos no textuales (líneas, brillos, partículas, bordes). Sobre un fondo oscuro opaco, el texto puede usar `#e6f1ff` o los neones.
- RNF-6 (paleta): todas las piezas propias y el texto animado usan exclusivamente la paleta neón (y los tonos oscuros para texto de RNF-5) como colores de marca, y no usan temas de terceros (p. ej. `radical`). Excepciones documentadas: los iconos de tecnologías usan los colores de marca de cada tecnología y las miniaturas de YouTube son las originales.
- RNF-7 (accesibilidad): toda imagen lleva texto alternativo descriptivo en inglés y todo SVG propio lleva `<title>`. Excepción documentada: el texto alternativo de las miniaturas de YouTube es el título real del vídeo, tal cual y en su idioma original (RF-43). El nombre, el rol, los nombres de proyecto, los títulos de vídeo y los enlaces de contacto existen también como texto o texto alternativo, no solo dentro de una animación. Las cifras del marcador y de las tarjetas de stats, lenguajes y racha figuran tanto en el `<title>` de cada pieza como en su texto alternativo del README, con las mismas cifras (RF-65).
- RNF-8 (peso): cada SVG propio pesa menos de 100 KB. Excepción documentada: la snake y el gráfico 3D pueden superarlo si siguen por encima tras el posprocesado de RF-38. El peso total de las piezas propias que carga la portada (todas las variantes de un mismo tema) no supera 1.5 MB.
- RNF-9 (animación segura): ninguna animación parpadea más de 3 veces por segundo y los ciclos de pulso y movimiento duran al menos 1 segundo.
- RNF-10 (validez): cada SVG propio es XML válido y declara `viewBox`.
- RNF-11 (seguridad): no hay secretos en el repositorio. La credencial de GitHub y la clave de YouTube solo existen como secretos del repositorio. La credencial de GitHub es de grano fino, solo lectura y se usa únicamente para leer datos. La actualización automática declara de forma explícita solo los permisos mínimos que necesita (lectura del contenido y escritura propia para guardar sus piezas), usa componentes de fuentes reconocidas fijados a versión y no imprime en su salida secretos ni nombres de repositorios privados.
- RNF-12 (dependencia de terceros): solo se usan servicios externos en vivo para el texto animado de tipo máquina de escribir, los iconos del stack y las miniaturas de YouTube. El marcador, los stats, los lenguajes, la racha, la snake, el gráfico 3D y la lista de vídeos se generan en el repositorio.
- RNF-13 (idioma): todo el contenido visible del README está en inglés, con tono profesional y cercano. Excepción documentada: los títulos de los vídeos de YouTube (texto visible y texto alternativo) son datos externos del canal y se muestran tal cual, en el idioma en que estén publicados, sin traducir. El resto de la sección de YouTube (encabezado y enlace al canal) sigue en inglés.
- RNF-14 (caché): las piezas dinámicas se sirven desde el propio repositorio para que su actualización no dependa de la caché del proxy de imágenes de GitHub sobre servicios externos.

## Casos límite
- El visitante usa tema claro: banner, texto animado, snake, tarjetas, marcador, separadores y footer siguen cumpliendo el contraste de RNF-5 (texto oscuro, neón solo como acento).
- Pantalla de 375 px: se cumple RNF-2 (sin scroll horizontal en la página ni en ningún bloque y con las imágenes escaladas).
- El canal tiene menos de 3 vídeos elegibles: se muestran los que haya, sin huecos ni enlaces rotos.
- Los vídeos más recientes del canal son todos Shorts o directos: se recorren vídeos más antiguos hasta reunir 3 elegibles o agotar los disponibles.
- La clasificación indirecta se equivoca con un vídeo (p. ej. un Short largo o una grabación de directo sin datos de emisión): se acepta según la tolerancia de la definición de vídeo elegible. El usuario puede detectarlo en la revisión manual.
- Un vídeo mostrado se elimina, se hace privado o cambia de título: la siguiente ejecución actualiza la lista (RF-45). Hasta entonces se acepta que el enlace o la miniatura dejen de funcionar; el título sigue visible como texto alternativo y texto del enlace.
- Un título de vídeo es muy largo o contiene caracteres especiales (emojis, `&`, `<`, comillas): se escapa sin romper el README y, si supera 60 caracteres, se trunca con "…".
- Un título de vídeo está en español u otro idioma (o tiene tildes y "ñ"): se muestra tal cual, sin traducir y sin caracteres corruptos (excepción de RNF-13).
- Un estreno ya emitido aparece en la lista; un estreno programado todavía no emitido no aparece.
- El ID del canal configurado deja de ser válido: se mantiene la última lista (RF-59) y la ejecución es fallida.
- La clave de YouTube no existe, es inválida o agota la cuota diaria: RF-62.
- La credencial de GitHub no existe, caduca o pierde permisos: RF-63. El usuario debe renovarla a mano.
- El usuario contribuye en repositorios privados de otros propietarios u organizaciones: esas contribuciones no se cuentan en ninguna cifra, ni en la snake ni en el gráfico 3D. Por eso las cifras pueden ser menores que las que GitHub muestra en el perfil si el usuario tiene activada la visualización de contribuciones privadas.
- El usuario tiene 0 repositorios propios, 0 commits en los últimos 12 meses o 0 PRs/issues/revisiones: el marcador y las tarjetas muestran "0" sin errores.
- No hay ningún lenguaje que cumpla la definición de lenguaje top: el marcador muestra "—" en MVP y la tarjeta de lenguajes muestra un mensaje neutro ("No languages yet").
- Números grandes (≥ 10 000): se abrevian según RF-17 ("10k", "10.2k", "1.2M") sin desbordar la casilla ni la tarjeta.
- Ventana móvil de 12 meses: "Commits (last year)" puede bajar de un día para otro al salir contribuciones antiguas de la ventana; es lo esperado.
- La racha actual termina ayer (UTC) y hoy todavía no hay contribuciones: la racha actual se mantiene y no se reinicia a 0 hasta que acabe el día UTC sin contribuciones.
- Las cifras agregadas incluyen actividad privada propia: ni las piezas, ni los textos alternativos, ni la salida de la ejecución exponen nombres de repositorios privados (RF-18).
- Fallo parcial: por ejemplo, YouTube falla y GitHub no. Los stats se actualizan, la lista de vídeos se mantiene y la ejecución queda como fallida (RF-52, RF-53).
- GitHub retrasa la ejecución programada o la desactiva tras 60 días sin actividad en el repositorio: el README sigue mostrando la última versión y el usuario puede lanzarla a mano o reactivar la programación. Un retraso de horas respecto a la hora programada se acepta.
- Dos ejecuciones de la actualización automática coinciden en el tiempo: no se pierden cambios ni queda ninguna pieza a medio escribir. La segunda espera a que termine la primera o se descarta.
- El usuario envía cambios mientras se ejecuta la actualización automática: RF-58.
- Los servicios externos en vivo (texto animado, iconos o miniaturas) están caídos: se muestra el texto alternativo y el resto del README no se ve afectado.
- La frase con emoji "Always shipping, always boosting 🚀" del texto animado se muestra sin caracteres corruptos.
- Un repositorio enlazado en una tarjeta pasa a ser privado o se renombra: el enlace deja de funcionar; se acepta, pero se detecta en la revisión manual.
- La caché del proxy de imágenes de GitHub sirve una versión antigua durante un tiempo: se acepta mientras no se muestre una imagen rota.
- El enlace de LinkedIn actual incluye parámetros de seguimiento: se conserva el perfil de destino, sin esos parámetros.

## Fuera de alcance
- Minijuego interactivo mediante issues y actualizaciones automáticas (fase 2, spec aparte).
- Enlazar el repositorio privado de Magnar WarGames o mostrar nombres de cualquier repositorio privado.
- Contar contribuciones en repositorios privados de otros propietarios u organizaciones.
- Automatizar la creación o renovación de la credencial de GitHub y de la clave de YouTube (las crea el usuario a mano; ver Criterios de finalización).
- Otros cambios en la configuración del repositorio o de la cuenta de GitHub (páginas fijadas, foto de perfil, etc.) distintos de los pasos manuales listados.
- Contenido del README en idiomas distintos del inglés.
- Contadores de visitas, trofeos u otros widgets de terceros no listados en esta spec.

## Criterios de finalización
- Pasos manuales del usuario completados: (1) crear la credencial de GitHub de grano fino y solo lectura y guardarla como secreto del repositorio; (2) crear la clave de YouTube y guardarla como secreto del repositorio; (3) conceder a la actualización automática el permiso de escritura propio; (4) confirmar el ID del canal fijado en la configuración; (5) dar el OK a la publicación del nuevo README.
- Todos los RF verificables por código (cálculo y formato de cifras, lenguaje top, actividad contable, filtrado y orden de vídeos con datos de ejemplo de cada tipo, escape de títulos, actualización independiente por piezas, robustez RF-59 a RF-64, ausencia de nombres privados, validez, `<title>` y peso de los SVG, posprocesado de RF-38, textos alternativos con cifras de RF-65) con test en verde con `node --test "tests/**/*.test.mjs"`.
- Al menos una ejecución manual real de la actualización automática que regenere todas las piezas dinámicas sin fallos, con revisión de que su salida no contiene secretos ni nombres de repositorios privados y de que la lista real de vídeos no incluye Shorts ni directos.
- Revisión de la configuración de la actualización automática: permisos explícitos y mínimos, componentes fijados a versión, programación diaria y lanzamiento manual, guardado con el permiso propio y ausencia de autodisparo (RF-50, RF-56, RF-57, RNF-11).
- Revisión manual en github.com del README publicado, en tema claro y oscuro, en escritorio, en navegador móvil a 375 px y en la app móvil de GitHub (la de la app la hace el usuario). Se comprueban RF-1 a RF-49, RNF-1 a RNF-9 y RNF-12 a RNF-14, incluidos los cinco enlaces de proyecto, los tres de contacto y el peso total de RNF-8.
- La spec solo se cierra con el OK del usuario a la publicación y con la ejecución real indicada arriba.

## Dudas abiertas
Ninguna. La descripción de la tarjeta de YouTube ("Rocket League content and tutorials to help players improve") quedó confirmada por el usuario al aprobar la spec.
