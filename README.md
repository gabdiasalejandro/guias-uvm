# Archivo de estudio

Biblioteca de guías HTML, completamente estática. Cada archivo en `guias/` se convierte al compilar en una página propia y una entrada del índice.

## Desarrollo

Requiere Node.js 22 o posterior. No hay dependencias de npm.

```bash
npm test
npm run build
npm run preview
```

Abre `http://localhost:4173/`. La carpeta `dist/` es la salida generada y no se versiona.

## Añadir una guía

1. Coloca un documento HTML completo en `guias/`, por ejemplo `guias/algebra-basica.html`.
2. Incluye un `<h1>` con el nombre de la guía y un `<meta name="description" content="...">` en el `<head>`.
3. Ejecuta `npm run build`. La guía aparecerá en el índice y tendrá la ruta `guias/algebra-basica/`.

El nombre del archivo determina la ruta: se convierte a minúsculas, sin acentos y con guiones. Si dos nombres producen la misma ruta, la compilación falla para evitar sobrescribir guías. También puedes usar `<meta name="guide:title" content="...">` y `<meta name="guide:description" content="...">` para controlar los textos del catálogo sin cambiar el contenido de la guía.

Cada guía sigue siendo un HTML independiente. La compilación solo le añade un enlace para volver al índice; no altera sus ejercicios ni su JavaScript. Los archivos deben estar revisados antes de incorporarlos: son HTML propio del sitio y pueden ejecutar scripts.

## GitHub Pages

`dist/` contiene archivos estáticos y rutas reales, sin redirecciones SPA. Los enlaces son relativos, por lo que también funcionan cuando Pages publica el sitio bajo `/<repositorio>/`. El workflow `.github/workflows/pages.yml` ejecuta pruebas, compila y publica `dist/` al hacer push a `main` (o manualmente desde Actions). Antes del primer despliegue, selecciona **GitHub Actions** como fuente en Settings → Pages. No apuntes Pages a la raíz del código fuente, porque primero hay que ejecutar `npm run build`.

El sitio no tiene subida compartida desde el navegador: una nueva guía se publica añadiendo su HTML a `guias/`, haciendo commit y desplegando otra compilación.
