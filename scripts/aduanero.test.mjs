import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('../guias/Guia_Derecho_Aduanero.html', import.meta.url), 'utf8');
const study = html.slice(html.indexOf('<section id="study"'), html.indexOf('<section id="exam"'));
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('la guía se centra en estudio legal y deja la memorización antes de las fuentes', () => {
  assert.match(html, /<title>Guía de Derecho Aduanero 1er parcial<\/title>/);
  assert.match(study, /<h1>Guía de Derecho Aduanero 1er parcial<\/h1>/);
  assert.ok(study.indexOf('id="units"') < study.indexOf('id="openPractice"'));
  assert.ok(study.indexOf('id="openPractice"') < study.indexOf('id="memory"'));
  assert.ok(study.indexOf('id="memory"') < study.indexOf('id="sources"'));
  assert.doesNotMatch(study, /errata|correcciones|apuntes|fotografías|Base:/i);
  assert.match(study, /diputados\.gob\.mx\/LeyesBiblio\/pdf_mov\/Ley_de_Comercio_Exterior\.pdf/);
});

test('los temas conservan sus notas de memoria sin fuentes de apuntes', () => {
  assert.doesNotThrow(() => new vm.Script(script));
  const definitions = script.slice(0, script.indexOf('const $=id=>'));
  const { count, complete } = vm.runInNewContext(`${definitions}\n({ count: topics.length, complete: topics.every(topic => topic.length === 5 && topic[4]) })`);
  assert.equal(count, 29);
  assert.equal(complete, true);
  assert.match(script, /memoryNotes.*memory/);
  assert.doesNotMatch(script, /corrections|errata|Base:|fotografía|apuntes/i);
});
