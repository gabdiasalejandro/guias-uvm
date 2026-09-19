import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildSite, guideDetails } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = (title, description = 'Descripción de prueba') => `<!doctype html><html lang="es"><head><meta name="description" content="${description}"><title>Otro título</title></head><body><h1>${title}</h1></body></html>`;

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'guias-build-'));
  await mkdir(path.join(directory, 'guias'));
  await cp(path.join(root, 'src'), path.join(directory, 'src'), { recursive: true });
  return directory;
}

test('extrae título, descripción y slug legible del HTML', () => {
  assert.deepEqual(guideDetails('Álgebra Básica.html', html('Álgebra básica', 'Operaciones &amp; ejercicios')), {
    slug: 'algebra-basica',
    title: 'Álgebra básica',
    description: 'Operaciones & ejercicios'
  });
});

test('cada archivo HTML produce una ruta física, tarjeta y regreso al índice', async t => {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'guias', 'Álgebra Básica.html'), html('Álgebra &amp; números'));
  await writeFile(path.join(directory, 'guias', 'historia.html'), html('Historia universal'));

  const guides = await buildSite(directory);
  assert.deepEqual(guides.map(guide => guide.slug), ['algebra-basica', 'historia']);
  const index = await readFile(path.join(directory, 'dist', 'index.html'), 'utf8');
  assert.match(index, /\.\/guias\/algebra-basica\//);
  assert.match(index, /Álgebra &amp; números/);
  assert.match(index, /collection-count">2/);
  const guide = await readFile(path.join(directory, 'dist', 'guias', 'algebra-basica', 'index.html'), 'utf8');
  assert.match(guide, /href="\.\.\/\.\.\/"/);
  assert.match(guide, /<h1>Álgebra &amp; números<\/h1>/);
});

test('rechaza rutas que colisionan antes de limpiar la compilación anterior', async t => {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'dist'));
  await writeFile(path.join(directory, 'dist', 'keep.txt'), 'anterior');
  await writeFile(path.join(directory, 'guias', 'matemáticas.html'), html('Uno'));
  await writeFile(path.join(directory, 'guias', 'matematicas.html'), html('Dos'));
  await assert.rejects(buildSite(directory), /Ruta duplicada: matematicas/);
  assert.equal(await readFile(path.join(directory, 'dist', 'keep.txt'), 'utf8'), 'anterior');
});

test('rechaza archivos incompletos antes de generar la salida', async t => {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'guias', 'fragmento.html'), '<h1>Fragmento</h1>');
  await assert.rejects(buildSite(directory), /documento HTML completo/);
});
