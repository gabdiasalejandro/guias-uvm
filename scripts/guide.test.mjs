import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('../guias/herramientas-gestion-internacional-parcial-1.html', import.meta.url), 'utf8');
const study = html.slice(html.indexOf('<section id="study-view"'), html.indexOf('<section id="exam-view"'));
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const articles = [...study.matchAll(/<article class="study-card" id="block-(\d+)" data-block="(\d+)">([\s\S]*?)<\/article>/g)];

test('el índice y los contadores corresponden a los 16 bloques restantes', () => {
  const ids = articles.map(match => match[1]);
  const links = [...study.matchAll(/href="#block-(\d+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 16);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(links, ids);
  assert.ok(articles.every(match => match[1] === match[2]));
  assert.equal([...study.matchAll(/class="complete-button"/g)].length, 16);
  assert.match(study, />16 bloques</);
  assert.match(study, /id="study-progress-text">0 de 16</);
  assert.doesNotMatch(study, /block-17|Estrategia para el examen|Alcance y fuentes|El temario se infirió|class="sources"/);
});

test('cada bloque conserva al menos un ejemplo concreto', () => {
  for (const [, id, , content] of articles) {
    assert.match(content, /ejemplo|camisa|auto|tela/i, `El bloque ${id} necesita un ejemplo.`);
    assert.match(content, /<h2>.+?<\/h2>/);
  }
});

test('las preguntas de repaso conservan opciones, respuesta y explicación', () => {
  const checks = [...study.matchAll(/<div class="quick-check" data-correct="(\d+)" data-feedback="([^"]+)">([\s\S]*?)<p class="check-feedback" hidden><\/p>/g)];
  assert.equal(checks.length, 7);
  for (const [, correct, feedback, content] of checks) {
    const options = [...content.matchAll(/class="check-option"/g)];
    assert.ok(Number(correct) < options.length);
    assert.ok(feedback.length > 0);
  }
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(html, /id="start-exam"/);
});

function loadProgress(value, inaccessible = false) {
  const reader = script.match(/    function readStudyProgress\(validIds\) \{[\s\S]*?\n    \}/)[0];
  return Array.from(vm.runInNewContext(`
    const progressKey = 'test';
    ${reader}
    [...readStudyProgress(new Set(Array.from({ length: 16 }, (_, index) => index + 1)))];
  `, {
    localStorage: { getItem() {
      if (inaccessible) throw new Error('Storage blocked');
      return value;
    } }
  }));
}

test('el progreso antiguo no cuenta el bloque eliminado ni supera el 100%', () => {
  const before = Array.from({ length: 17 }, (_, index) => index + 1);
  const after = loadProgress(JSON.stringify(before));
  assert.deepEqual(after, before.slice(0, 16));
  assert.equal(Math.round(after.length / 16 * 100), 100);
  assert.deepEqual(loadProgress('[1, 3, 16, 17, 0, -1, "2", 3]'), [1, 3, 16]);
});

test('el progreso funciona con datos ausentes, corruptos o almacenamiento bloqueado', () => {
  for (const value of [null, 'invalid', '{}', 'null', '17', '"123"']) {
    assert.deepEqual(loadProgress(value), []);
  }
  assert.deepEqual(loadProgress('[1]', true), []);
});

class TestNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this._text = '';
    this.hidden = false;
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); }
  replaceChildren() { this.children = []; }
  scrollIntoView() {}
}

function examContext(answers) {
  const nodes = new Map();
  const document = {
    createElement: tag => new TestNode(tag),
    createTextNode: value => { const node = new TestNode('#text'); node.textContent = value; return node; },
    getElementById: id => {
      if (!nodes.has(id)) nodes.set(id, new TestNode('div'));
      return nodes.get(id);
    }
  };
  const questions = [
    { q: 'Pregunta uno', o: ['A', 'B'], a: 0, r: 'A es la opción correcta.' },
    { q: 'Pregunta dos', o: ['C', 'D'], a: 1, r: 'D responde al caso.' },
    { q: 'Pregunta tres', o: ['E', 'F'], a: 0, r: 'E explica el concepto.' }
  ];
  const context = vm.createContext({ document, state: { questions, answers, timer: null }, confirm: () => true, clearInterval() {} });
  return { context, nodes };
}

test('la revisión separa correctas, incorrectas y sin respuesta con explicación visible', () => {
  const { context, nodes } = examContext([0, 0, null]);
  const reviewCode = script.slice(script.indexOf('    function makeReviewItem('), script.indexOf('    function resetExamScreen()'));
  vm.runInContext(`${reviewCode}\nrenderReview();`, context);

  const needs = nodes.get('needs-review-list').children;
  const correct = nodes.get('correct-review-list').children;
  assert.equal(needs.length, 2);
  assert.equal(correct.length, 1);
  assert.deepEqual(needs.map(item => item.dataset.status), ['incorrect', 'unanswered']);
  assert.match(needs[0].textContent, /Incorrecta.*Tu respuesta: C.*Respuesta correcta: D.*Por qué: D responde al caso/s);
  assert.match(needs[1].textContent, /Sin responder.*No respondiste.*Respuesta correcta: E.*Por qué: E explica el concepto/s);
  assert.match(correct[0].textContent, /Correcta.*Tu respuesta: A/s);
  assert.doesNotMatch(correct[0].textContent, /Por qué:|Respuesta correcta:/);
  assert.equal(nodes.get('needs-review-count').textContent, '(2)');
  assert.equal(nodes.get('correct-review-count').textContent, '(1)');
});

test('el resumen distingue errores de preguntas no respondidas', () => {
  const { context, nodes } = examContext([0, 0, null]);
  const finishCode = script.slice(script.indexOf('    function finishExam('), script.indexOf('    function renderBreakdown()'));
  vm.runInContext(`${finishCode}\nfunction renderBreakdown() {}\nfunction renderReview() {}\nfinishExam(true);`, context);

  assert.equal(nodes.get('correct-count').textContent, '1');
  assert.equal(nodes.get('incorrect-count').textContent, '1');
  assert.equal(nodes.get('unanswered-count').textContent, '1');
  assert.equal(nodes.get('result-heading').textContent, '1 de 3 correctas');
  assert.match(nodes.get('result-detail').textContent, /El tiempo terminó/);
  assert.equal(nodes.get('score-ring').dataset.score, 33);
});
