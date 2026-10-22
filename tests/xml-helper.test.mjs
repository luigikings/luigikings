import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkXml } from './helpers/xml.mjs';

test('checkXml acepta XML bien formado', () => {
  for (const ok of [
    '<svg/>',
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg a="1" b=\'2\'><g><rect/></g><!-- c --></svg>',
    '<svg><style><![CDATA[a > b { x: "<" }]]></style><text>&amp; &#169; &#xA9;</text></svg>',
  ]) assert.deepEqual(checkXml(ok), { ok: true }, ok);
});

test('checkXml rechaza XML mal formado', () => {
  for (const bad of [
    '',
    'texto',
    '<svg>',
    '<svg></g>',
    '<svg><g></svg></g>',
    '<svg a="1" a="2"/>',
    '<svg a=1/>',
    '<svg a="<"/>',
    '<svg>a & b</svg>',
    '<svg>&nbsp;</svg>',
    '<svg/><svg/>',
    '<svg/>texto',
    '<svg><!-- sin cerrar </svg>',
    '<svg><![CDATA[ sin cerrar </svg>',
  ]) assert.equal(checkXml(bad).ok, false, bad);
});
