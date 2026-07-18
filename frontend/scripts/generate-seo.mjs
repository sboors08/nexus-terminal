import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const configuredOrigin = process.env.NEXUS_PUBLIC_URL || process.env.VITE_PUBLIC_SITE_URL || 'http://localhost:5173';
const siteOrigin = configuredOrigin.replace(/\/$/, '');

try {
  const parsedOrigin = new URL(siteOrigin);
  if (!['http:', 'https:'].includes(parsedOrigin.protocol)) throw new Error('Unsupported protocol');
} catch {
  throw new Error(`Invalid public site URL: ${configuredOrigin}`);
}

const locales = [
  { path: '/ru', hrefLang: 'ru', priority: '1.0' },
  { path: '/en', hrefLang: 'en', priority: '0.9' },
  { path: '/zh-cn', hrefLang: 'zh-CN', priority: '0.8' },
];

const alternateLinks = locales
  .map(({ path, hrefLang }) => `    <xhtml:link rel="alternate" hreflang="${hrefLang}" href="${siteOrigin}${path}" />`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${siteOrigin}/ru" />`)
  .join('\n');

const urls = locales
  .map(({ path, priority }) => `  <url>\n    <loc>${siteOrigin}${path}</loc>\n${alternateLinks}\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`)
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /app
Disallow: /app/

Sitemap: ${siteOrigin}/sitemap.xml
`;

await mkdir(publicDir, { recursive: true });
await Promise.all([
  writeFile(resolve(publicDir, 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve(publicDir, 'robots.txt'), robots, 'utf8'),
]);

console.log(`SEO files generated for ${siteOrigin}`);
