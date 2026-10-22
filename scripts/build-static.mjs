// Genera las piezas propias estáticas en assets/static/ (se ejecuta en local y se guarda el resultado).
// Uso: node scripts/build-static.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderBanner } from './render/banner.mjs';
import { renderDivider } from './render/divider.mjs';
import { renderFooterWave } from './render/footer.mjs';
import { renderProjectCard } from './render/project-card.mjs';
import { renderContactButton } from './render/contact-button.mjs';
import { PALETTE } from './lib/palette.mjs';
import { minifySvg } from './lib/svg.mjs';

export const STATIC_DIR = fileURLToPath(new URL('../assets/static/', import.meta.url));

/** Tarjetas de proyecto en el orden de RF-19, con los textos exactos de RF-20 y los destinos de RF-21 a RF-25. */
export const PROJECTS = Object.freeze([
  { file: 'project-magnar-wargames.svg', name: 'Magnar WarGames', description: 'Game of Thrones–inspired strategy web app', url: 'https://www.magnarwargames.com/', accent: PALETTE.blue },
  { file: 'project-chatarrero-metal-renova.svg', name: 'ChatarreroMetalRenova', description: 'Static Astro + TypeScript site for a Madrid scrap-metal business, built for speed and local SEO', url: 'https://github.com/luigikings/ChatarreroMetalRenova', accent: PALETTE.orange },
  { file: 'project-agencymac.svg', name: 'AgencyMac', description: 'Astro monorepo for a marketing & coding agency — public site + internal CRM', url: 'https://github.com/luigikings/AgencyMac', accent: PALETTE.boost },
  { file: 'project-chefasesoriaj.svg', name: 'ChefAsesoriaJ', description: 'Multi-page React + Vite + Tailwind marketing site for Gatrobatos, a hospitality brand', url: 'https://github.com/luigikings/ChefAsesoriaJ', accent: PALETTE.blue },
  { file: 'project-youtube.svg', name: 'YouTube (Rocket League content)', description: 'Rocket League content and tutorials to help players improve', url: 'https://youtube.com/@lk_rl', accent: PALETTE.orange },
]);

/** Botones de contacto (RF-47) con los destinos de RF-48. */
export const CONTACTS = Object.freeze([
  { file: 'contact-linkedin.svg', label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/luis-angel-da-silva-a18a13244', accent: PALETTE.blue },
  { file: 'contact-youtube.svg', label: 'YouTube', icon: 'youtube', url: 'https://youtube.com/@lk_rl', accent: PALETTE.orange },
  { file: 'contact-gmail.svg', label: 'Gmail', icon: 'gmail', url: 'mailto:luigidasilv@gmail.com', accent: PALETTE.boost },
]);

/** Todas las piezas estáticas, ya minificadas: { "archivo.svg": "<svg…>" }. Función pura. */
export function buildStatic() {
  const pieces = {
    'banner-dark.svg': renderBanner('dark'),
    'banner-light.svg': renderBanner('light'),
    'divider.svg': renderDivider(),
    'footer-wave.svg': renderFooterWave(),
    ...Object.fromEntries(PROJECTS.map((p) => [p.file, renderProjectCard(p)])),
    ...Object.fromEntries(CONTACTS.map((c) => [c.file, renderContactButton(c)])),
  };
  return Object.fromEntries(Object.entries(pieces).map(([name, svg]) => [name, minifySvg(svg)]));
}

function main() {
  mkdirSync(STATIC_DIR, { recursive: true });
  for (const [name, svg] of Object.entries(buildStatic())) {
    writeFileSync(STATIC_DIR + name, svg, 'utf8');
    console.log(`${name.padEnd(36)} ${(Buffer.byteLength(svg, 'utf8') / 1024).toFixed(1)} KB`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
