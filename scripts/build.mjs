import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const number = entity[1]?.toLowerCase() === 'x'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(number) && number > 0 && number <= 0x10ffff
        ? String.fromCodePoint(number) : '';
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[entity.toLowerCase()];
  });
}

function plainText(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match?.[1] ?? match?.[2];
}

function metaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(match[0], 'name')?.toLowerCase() === name) {
      return decodeEntities(attribute(match[0], 'content') ?? '').trim();
    }
  }
  return '';
}

function slugify(filename) {
  return path.basename(filename, '.html').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function guideDetails(filename, html) {
  if (!/<html\b/i.test(html) || !/<body\b[^>]*>/i.test(html)) {
    throw new Error(`${filename}: se esperaba un documento HTML completo con <html> y <body>.`);
  }
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = metaContent(html, 'guide:title') || (heading && plainText(heading)) ||
    plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  if (!title) throw new Error(`${filename}: agrega un <h1>, <title> o meta guide:title.`);
  const slug = slugify(filename);
  if (!slug) throw new Error(`${filename}: el nombre del archivo no permite crear una ruta.`);
  return {
    slug,
    title,
    description: metaContent(html, 'guide:description') || metaContent(html, 'description') || 'Guía de estudio interactiva.'
  };
}

function addReturnLink(html) {
  const style = `<style>
    .archivo-return { display:block; padding:11px max(18px, calc((100% - 1180px)/2)); background:#202b30; color:#f7f6f2; font:600 13px/1.4 system-ui,sans-serif; text-decoration:none; }
    .archivo-return:hover, .archivo-return:focus-visible { background:#34443f; color:#fff; }
  </style>`;
  return html.replace(/<\/head>/i, `${style}\n</head>`)
    .replace(/(<body\b[^>]*>)/i, '$1\n  <a class="archivo-return" href="../../" aria-label="Volver al índice de guías">← Volver al índice</a>');
}

function renderCard(guide) {
  return `<article class="guide-card">
          <a href="./guias/${encodeURIComponent(guide.slug)}/" aria-label="Abrir ${escapeHtml(guide.title)}">
            <span class="guide-body">
              <h3>${escapeHtml(guide.title)}</h3>
              <p>${escapeHtml(guide.description)}</p>
            </span>
            <span class="guide-arrow" aria-hidden="true">↗</span>
          </a>
        </article>`;
}

export async function buildSite(root = projectRoot) {
  const source = path.join(root, 'guias');
  const output = path.join(root, 'dist');
  const entries = (await readdir(source, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const guides = [];
  const slugs = new Set();
  for (const entry of entries) {
    const html = await readFile(path.join(source, entry.name), 'utf8');
    const guide = guideDetails(entry.name, html);
    if (slugs.has(guide.slug)) throw new Error(`Ruta duplicada: ${guide.slug}. Renombra uno de los archivos.`);
    slugs.add(guide.slug);
    guides.push({ ...guide, html });
  }

  const template = await readFile(path.join(root, 'src', 'index.html'), 'utf8');
  if (!template.includes('{{GUIDE_CARDS}}') || !template.includes('{{GUIDE_COUNT}}')) {
    throw new Error('La plantilla del índice no tiene los marcadores de guías.');
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const cards = guides.length
    ? guides.map(renderCard).join('\n        ')
    : '<p class="empty-search">No hay guías disponibles.</p>';
  const index = template.replace('{{GUIDE_COUNT}}', String(guides.length)).replace('{{GUIDE_CARDS}}', cards);
  await writeFile(path.join(output, 'index.html'), index);
  await copyFile(path.join(root, 'src', 'styles.css'), path.join(output, 'styles.css'));
  await copyFile(path.join(root, 'src', 'catalog.js'), path.join(output, 'catalog.js'));
  await writeFile(path.join(output, '.nojekyll'), '');

  for (const guide of guides) {
    const directory = path.join(output, 'guias', guide.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), addReturnLink(guide.html));
  }
  return guides.map(({ slug, title, description }) => ({ slug, title, description }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildSite().then(guides => {
    console.log(`Compiladas ${guides.length} guía(s):`);
    guides.forEach(guide => console.log(`  /guias/${guide.slug}/ — ${guide.title}`));
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
