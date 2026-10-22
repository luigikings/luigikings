import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, svgDoc, minifySvg } from '../scripts/lib/svg.mjs';
import { checkXml } from './helpers/xml.mjs';

test('escapeXml escapa & < > " \'', () => {
  assert.equal(escapeXml(`a & b <c> "d" 'e'`), 'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  assert.equal(escapeXml(42), '42');
});

test('svgDoc siempre lleva viewBox, <title> y role="img"', () => {
  const svg = svgDoc({ width: 400, height: 120, title: 'Banner', body: '<rect width="10" height="10"/>' });
  assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 400 120"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /<svg[^>]*><title>Banner<\/title>/);
  assert.deepEqual(checkXml(svg), { ok: true });
});

test('svgDoc escapa el título y la descripción', () => {
  const svg = svgDoc({ width: 10, height: 10, title: 'Tom & <Jerry> "x"', desc: 'a<b', body: '' });
  assert.ok(svg.includes('<title>Tom &amp; &lt;Jerry&gt; &quot;x&quot;</title>'));
  assert.ok(svg.includes('<desc>a&lt;b</desc>'));
  assert.deepEqual(checkXml(svg), { ok: true });
});

test('svgDoc mete el estilo en CDATA y sigue siendo XML válido', () => {
  const svg = svgDoc({ width: 10, height: 10, title: 't', style: 'svg > rect { fill: #00d4ff }', body: '<rect/>' });
  assert.ok(svg.includes('<style><![CDATA[svg > rect { fill: #00d4ff }]]></style>'));
  assert.deepEqual(checkXml(svg), { ok: true });
});

test('svgDoc exige título y dimensiones', () => {
  assert.throws(() => svgDoc({ width: 10, height: 10, title: '', body: '' }), TypeError);
  assert.throws(() => svgDoc({ width: 0, height: 10, title: 't', body: '' }), TypeError);
});

test('minifySvg: salida <= entrada, XML válido y conserva el texto', () => {
  const input = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
    <!-- comentario -->
    <title>Hola   mundo</title>
    <style><![CDATA[
      .a   {   fill:   red; }
    ]]></style>
    <g>
      <text x="1" y="2"><tspan>Goals</tspan> <tspan>12</tspan></text>
    </g>
  </svg>
  `;
  const out = minifySvg(input);
  assert.ok(out.length <= input.length);
  assert.ok(out.length < input.length);
  assert.ok(!out.includes('comentario'));
  assert.ok(out.includes('<tspan>Goals</tspan> <tspan>12</tspan>'), 'conserva espacios dentro de <text>');
  assert.ok(out.includes('<title>Hola   mundo</title>'), 'no toca el texto del title');
  assert.deepEqual(checkXml(out), { ok: true });
});

test('minifySvg es idempotente y no aumenta un SVG ya mínimo', () => {
  const svg = svgDoc({ width: 10, height: 10, title: 't', body: '<rect/>' });
  const once = minifySvg(svg);
  assert.ok(once.length <= svg.length);
  assert.equal(minifySvg(once), once);
});
