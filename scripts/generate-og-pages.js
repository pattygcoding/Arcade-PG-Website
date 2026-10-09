// Link-preview crawlers (LinkedIn, Slack, Discord, X, Facebook) do not run
// JavaScript, so every route needs its own static HTML carrying the right Open
// Graph tags.  Angular renders the app client side, so this runs after `ng build`
// and rewrites the emitted shell once per page.
//
// It also emits `<route>.html` siblings, which is what makes a deep link like
// /alkalab resolve on GitHub Pages instead of 404ing, plus a sitemap.
const fs = require('fs');
const path = require('path');

const t = require('../src/app/i18n/en.json');

const SITE = 'https://arcade.pattygcoding.com';
const BUILD_DIR = path.join(__dirname, '..', 'dist', 'arcade-pg-website', 'browser');
const SHELL = path.join(BUILD_DIR, 'index.html');

const ogImage = (name) => `${SITE}/og/${name}.png`;

const PAGES = [
  {
    route: '',
    title: t.meta.appName,
    description: t.home.tagline,
    image: ogImage('home'),
    alt: t.meta.appName,
    priority: '1.0',
  },
  {
    route: 'alkalab',
    title: `${t.games.alkalab.name} - ${t.meta.appName}`,
    description: t.alkalab.description,
    image: ogImage('alkalab'),
    alt: t.alkalab.title,
    priority: '0.8',
  },
  {
    route: 'snake',
    title: `${t.games.snake.name} - ${t.meta.appName}`,
    description: t.snake.description,
    image: ogImage('snake'),
    alt: t.snake.title,
    priority: '0.8',
  },
  {
    route: 'suprememc',
    title: `${t.games.suprememc.name} - ${t.meta.appName}`,
    description: t.suprememc.description,
    image: ogImage('suprememc'),
    alt: t.suprememc.title,
    priority: '0.8',
  },
];

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Replace the content of a meta tag, failing loudly if the shell lost it. */
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) {
    throw new Error(`Missing <meta ${attr}="${key}"> in ${path.relative(process.cwd(), SHELL)}`);
  }
  return html.replace(re, `$1${escapeAttr(value)}$2`);
};

const setHref = (html, rel, value) => {
  const re = new RegExp(`(<link\\s+rel="${rel}"\\s+href=")[^"]*(")`);
  if (!re.test(html)) {
    throw new Error(`Missing <link rel="${rel}"> in ${path.relative(process.cwd(), SHELL)}`);
  }
  return html.replace(re, `$1${escapeAttr(value)}$2`);
};

function render(shell, page) {
  const url = page.route ? `${SITE}/${page.route}` : `${SITE}/`;
  let html = shell.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`);

  html = setHref(html, 'canonical', url);
  html = setMeta(html, 'name', 'description', page.description);
  html = setMeta(html, 'property', 'og:title', page.title);
  html = setMeta(html, 'property', 'og:description', page.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', page.image);
  html = setMeta(html, 'property', 'og:image:alt', page.alt);
  html = setMeta(html, 'name', 'twitter:title', page.title);
  html = setMeta(html, 'name', 'twitter:description', page.description);
  html = setMeta(html, 'name', 'twitter:image', page.image);
  return html;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map((page) => {
    const url = page.route ? `${SITE}/${page.route}` : `${SITE}/`;
    return [
      '  <url>',
      `    <loc>${escapeAttr(url)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <priority>${page.priority}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function main() {
  if (!fs.existsSync(SHELL)) {
    console.error(`No build found at ${SHELL}. Run "npm run build" first.`);
    process.exitCode = 1;
    return;
  }

  const shell = fs.readFileSync(SHELL, 'utf8');
  const written = [];

  for (const page of PAGES) {
    const html = render(shell, page);
    if (!page.route) {
      fs.writeFileSync(path.join(BUILD_DIR, 'index.html'), html);
      written.push('index.html');
      continue;
    }
    // Emit both forms so the deep link resolves whether the host maps an
    // extensionless path onto `<route>.html` or falls back to a directory index.
    // (The router tolerates the trailing slash the second form redirects to.)
    fs.writeFileSync(path.join(BUILD_DIR, `${page.route}.html`), html);
    fs.mkdirSync(path.join(BUILD_DIR, page.route), { recursive: true });
    fs.writeFileSync(path.join(BUILD_DIR, page.route, 'index.html'), html);
    written.push(`${page.route}.html`, `${page.route}/index.html`);
  }

  // SPA fallback: unknown paths still boot the app (with the home page's tags).
  fs.writeFileSync(path.join(BUILD_DIR, '404.html'), render(shell, PAGES[0]));
  written.push('404.html');

  fs.writeFileSync(path.join(BUILD_DIR, 'sitemap.xml'), sitemap());
  written.push('sitemap.xml');

  console.log(`Generated OG pages: ${written.join(', ')}`);
}

main();
