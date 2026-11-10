import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('../guias/Guia_Derecho_Aduanero_2do_Parcial.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const defs = script.slice(0, script.indexOf('const $=id=>')) +
  script.slice(script.indexOf('const arts='), script.indexOf('arts.forEach(([a,b])=>flash'));
const { topics, units, bank } = vm.runInNewContext(`${defs}\n({ topics, units, bank })`);

test('la guía declara título y contiene las cinco unidades y 24 temas completos', () => {
  assert.match(html, /<h1>Guía de Derecho Aduanero 2do parcial<\/h1>/);
  assert.equal(units.length, 5);
  assert.equal(topics.length, 24);
  assert.ok(topics.every(t => t.length === 6 && t.slice(1, 5).every(Boolean) && t[0] < units.length));
});

test('cada pregunta tiene una respuesta correcta única y explicación', () => {
  assert.ok(bank.length >= 60);
  for (const q of bank) {
    const options = [q.right, ...q.wrong];
    assert.equal(new Set(options).size, options.length, `Opciones repetidas: ${q.q}`);
    assert.ok(q.wrong.length >= 3 && q.why && q.topic < topics.length, q.q);
  }
  for (let u = 0; u < units.length; u++) assert.ok(bank.filter(q => q.u === u).length >= 6, `Unidad ${u + 1}`);
});

test('conserva los datos verificados en la Ley Aduanera', () => {
  assert.match(html, /10 días hábiles/);
  assert.match(html, /4 meses/);
  assert.match(html, /<b>24 meses<\/b>/);
  assert.match(html, /135-B/);
});
