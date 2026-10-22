// Utilidades para generar SVG propios (RNF-3, RNF-4, RNF-7, RNF-10, RF-38).

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** Escapa texto para contenido o atributos XML. */
export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

/**
 * Documento SVG autocontenido: siempre con xmlns, viewBox, role="img" y <title> como primer hijo.
 * `body` es SVG ya construido (no se escapa); `title` y `desc` sí se escapan.
 */
export function svgDoc({ width, height, title, desc, body = '', style }) {
  for (const [k, v] of Object.entries({ width, height })) {
    if (typeof v !== 'number' || !(v > 0)) throw new TypeError(`svgDoc: ${k} debe ser > 0`);
  }
  if (typeof title !== 'string' || title.trim() === '') throw new TypeError('svgDoc: falta title');
  if (style && style.includes(']]>')) throw new TypeError('svgDoc: style no puede contener "]]>"');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img">` +
    `<title>${escapeXml(title)}</title>` +
    (desc ? `<desc>${escapeXml(desc)}</desc>` : '') +
    (style ? `<style><![CDATA[${style}]]></style>` : '') +
    body +
    `</svg>`
  );
}

// Bloques que no se tocan: CDATA y elementos con texto visible o accesible.
const PROTECTED = /<!\[CDATA\[[\s\S]*?\]\]>|<(text|title|desc)\b[\s\S]*?<\/\1>/g;

function minifyMarkup(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .replace(/\s*(\/?>)/g, '$1');
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

/**
 * Optimiza un SVG sin cambiar su aspecto: quita comentarios y espacios entre etiquetas y compacta el CSS.
 * Conserva tal cual el contenido de <text>, <title> y <desc>. Nunca devuelve algo más largo que la entrada.
 */
export function minifySvg(svg) {
  let out = '';
  let last = 0;
  for (const m of svg.matchAll(PROTECTED)) {
    out += minifyMarkup(svg.slice(last, m.index));
    const block = m[0];
    out += block.startsWith('<![CDATA[') ? `<![CDATA[${minifyCss(block.slice(9, -3))}]]>` : block;
    last = m.index + block.length;
  }
  out += minifyMarkup(svg.slice(last));
  out = out.trim();
  return out.length <= svg.length ? out : svg;
}
