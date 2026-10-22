// Comprobador mínimo de XML bien formado, sin dependencias (RNF-10).
// Cubre lo que usan los SVG del proyecto: declaración, comentarios, CDATA, elementos,
// atributos entre comillas sin duplicados, entidades predefinidas o numéricas y una sola raíz.
// No valida DTD: un <!DOCTYPE> se rechaza (los SVG propios no lo usan).

const NAME = /^[A-Za-z_:][\w.:-]*/;
const ENTITY = /^&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;

function checkText(text, where) {
  for (let i = text.indexOf('&'); i !== -1; i = text.indexOf('&', i + 1)) {
    if (!ENTITY.test(text.slice(i))) return `entidad no válida en ${where}`;
  }
  return null;
}

/** @returns {{ok: true} | {ok: false, error: string}} */
export function checkXml(src) {
  const fail = (error) => ({ ok: false, error });
  if (typeof src !== 'string') return fail('no es un string');
  let i = 0;
  const stack = [];
  let roots = 0;

  if (src.startsWith('<?xml')) {
    const end = src.indexOf('?>');
    if (end === -1) return fail('declaración XML sin cerrar');
    i = end + 2;
  }

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const text = src.slice(i, lt === -1 ? src.length : lt);
    if (stack.length === 0) {
      if (text.trim() !== '') return fail('texto fuera del elemento raíz');
    } else {
      const err = checkText(text, 'texto');
      if (err) return fail(err);
    }
    if (lt === -1) break;
    i = lt;

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) return fail('comentario sin cerrar');
      i = end + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      if (stack.length === 0) return fail('CDATA fuera del elemento raíz');
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) return fail('CDATA sin cerrar');
      i = end + 3;
    } else if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      if (end === -1) return fail('instrucción de procesado sin cerrar');
      i = end + 2;
    } else if (src.startsWith('<!', i)) {
      return fail('DOCTYPE o declaración no admitida');
    } else if (src.startsWith('</', i)) {
      const m = NAME.exec(src.slice(i + 2));
      if (!m) return fail('etiqueta de cierre sin nombre');
      const after = src.slice(i + 2 + m[0].length);
      const close = /^\s*>/.exec(after);
      if (!close) return fail(`cierre mal formado </${m[0]}`);
      const open = stack.pop();
      if (open !== m[0]) return fail(`cierre </${m[0]}> no coincide con <${open ?? ''}>`);
      i += 2 + m[0].length + close[0].length;
    } else {
      const m = NAME.exec(src.slice(i + 1));
      if (!m) return fail('etiqueta sin nombre');
      const name = m[0];
      if (stack.length === 0 && roots++ > 0) return fail('más de un elemento raíz');
      let j = i + 1 + name.length;
      const seen = new Set();
      for (;;) {
        const ws = /^\s*/.exec(src.slice(j))[0];
        j += ws.length;
        if (src.startsWith('/>', j)) { j += 2; break; }
        if (src[j] === '>') { j += 1; stack.push(name); break; }
        if (j >= src.length) return fail(`etiqueta <${name}> sin cerrar`);
        if (!ws) return fail(`falta espacio entre atributos en <${name}>`);
        const a = NAME.exec(src.slice(j));
        if (!a) return fail(`atributo mal formado en <${name}>`);
        if (seen.has(a[0])) return fail(`atributo duplicado ${a[0]}`);
        seen.add(a[0]);
        j += a[0].length;
        const eq = /^\s*=\s*/.exec(src.slice(j));
        if (!eq) return fail(`atributo ${a[0]} sin valor`);
        j += eq[0].length;
        const q = src[j];
        if (q !== '"' && q !== "'") return fail(`valor de ${a[0]} sin comillas`);
        const end = src.indexOf(q, j + 1);
        if (end === -1) return fail(`valor de ${a[0]} sin cerrar`);
        const value = src.slice(j + 1, end);
        if (value.includes('<')) return fail(`"<" en el valor de ${a[0]}`);
        const err = checkText(value, `atributo ${a[0]}`);
        if (err) return fail(err);
        j = end + 1;
      }
      i = j;
    }
  }

  if (stack.length) return fail(`elementos sin cerrar: ${stack.join(', ')}`);
  if (roots === 0) return fail('no hay elemento raíz');
  return { ok: true };
}
