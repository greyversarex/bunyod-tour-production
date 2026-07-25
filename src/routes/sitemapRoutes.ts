import { Router, Request, Response } from 'express';
// ♻️ Единый Prisma-клиент (singleton), а не отдельный пул подключений.
import prisma from '../config/database';

const router = Router();

const STATIC_PAGES = [
  { path: '/',                         priority: '1.0', changefreq: 'daily'   },
  { path: '/tours-search.html',        priority: '0.9', changefreq: 'daily'   },
  { path: '/hotels-catalog.html',      priority: '0.8', changefreq: 'weekly'  },
  { path: '/about-us.html',            priority: '0.7', changefreq: 'monthly' },
  { path: '/news.html',                priority: '0.7', changefreq: 'daily'   },
  { path: '/aktsii.html',              priority: '0.7', changefreq: 'weekly'  },
  { path: '/visa-support.html',        priority: '0.6', changefreq: 'monthly' },
  { path: '/transfer.html',            priority: '0.6', changefreq: 'monthly' },
  { path: '/vehicles-catalog.html',    priority: '0.6', changefreq: 'weekly'  },
  { path: '/tour-agents-catalog.html', priority: '0.6', changefreq: 'weekly'  },
  { path: '/tour-guides.html',         priority: '0.6', changefreq: 'weekly'  },
  { path: '/custom-tour-order.html',   priority: '0.6', changefreq: 'monthly' },
  { path: '/investment-projects.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/special-notes.html',       priority: '0.4', changefreq: 'monthly' },
  { path: '/accommodation-regulation.html', priority: '0.4', changefreq: 'monthly' },
];

function xmlEscape(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toW3CDate(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
}

// Локализованный JSON ({ru,en}) или строка → читаемый текст (приоритет EN)
function localizedText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj.en || obj.ru || Object.values(obj)[0] || '');
  }
  return '';
}

// Первое пригодное изображение (mainImage или первое из галереи images)
function firstImage(mainImage: string | null | undefined, images: string | null | undefined): string | null {
  if (mainImage && mainImage.trim()) return mainImage.trim();
  if (!images || !images.trim()) return null;
  const raw = images.trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      return parsed[0].trim();
    }
  } catch {
    // не JSON — трактуем как список через запятую или одиночный URL
  }
  const first = raw.split(',')[0].trim();
  return first || null;
}

// Относительный путь картинки → абсолютный URL
function absoluteImage(baseUrl: string, raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

// Блок <image:image> для sitemap (пустая строка, если картинки нет)
function imageBlock(baseUrl: string, imgRaw: string | null, title: string): string {
  if (!imgRaw) return '';
  const loc = xmlEscape(absoluteImage(baseUrl, imgRaw));
  const caption = title ? `
      <image:title>${xmlEscape(title)}</image:title>` : '';
  return `
    <image:image>
      <image:loc>${loc}</image:loc>${caption}
    </image:image>`;
}

router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.SITE_URL?.replace(/\/$/, '') ||
      `${req.protocol}://${req.get('host')}`;

    const [tours, hotels, newsList] = await Promise.all([
      prisma.tour.findMany({
        where: { isActive: true, isDraft: false },
        select: { id: true, updatedAt: true, mainImage: true, images: true, title: true },
      }),
      prisma.hotel.findMany({
        where: { isActive: true, isDraft: false },
        select: { id: true, updatedAt: true, images: true, name: true },
      }),
      prisma.news.findMany({
        where: { isPublished: true },
        select: { id: true, updatedAt: true },
      }).catch(() => [] as { id: number; updatedAt: Date }[]),
    ]);

    const urls: string[] = [];

    for (const page of STATIC_PAGES) {
      urls.push(`
  <url>
    <loc>${xmlEscape(baseUrl + page.path)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
    }

    for (const tour of tours) {
      const img = imageBlock(baseUrl, firstImage(tour.mainImage, tour.images), localizedText(tour.title));
      urls.push(`
  <url>
    <loc>${xmlEscape(`${baseUrl}/tour-template.html?tour=${tour.id}`)}</loc>
    <lastmod>${toW3CDate(tour.updatedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${img}
  </url>`);
    }

    for (const hotel of hotels) {
      const img = imageBlock(baseUrl, firstImage(null, hotel.images), localizedText(hotel.name));
      urls.push(`
  <url>
    <loc>${xmlEscape(`${baseUrl}/hotel-template.html?id=${hotel.id}`)}</loc>
    <lastmod>${toW3CDate(hotel.updatedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${img}
  </url>`);
    }

    for (const news of newsList) {
      urls.push(`
  <url>
    <loc>${xmlEscape(`${baseUrl}/news-detail.html?id=${news.id}`)}</loc>
    <lastmod>${toW3CDate(news.updatedAt)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);

    console.log(`🗺️ Sitemap served: ${STATIC_PAGES.length} static + ${tours.length} tours + ${hotels.length} hotels + ${newsList.length} news`);
  } catch (err) {
    console.error('❌ Sitemap generation error:', err);
    res.status(500).send('<?xml version="1.0"?><error>Sitemap generation failed</error>');
  }
});

router.get('/robots.txt', (req: Request, res: Response) => {
  const baseUrl = process.env.SITE_URL?.replace(/\/$/, '') ||
    `${req.protocol}://${req.get('host')}`;

  const robots = `User-agent: *
Allow: /

Disallow: /admin-dashboard.html
Disallow: /agent-dashboard.html
Disallow: /driver-dashboard.html
Disallow: /guide-cabinet.html
Disallow: /guide-profile.html
Disallow: /agent-login.html
Disallow: /driver-login.html
Disallow: /guide-login.html
Disallow: /test-email.html
Disallow: /test-tour.html
Disallow: /payment-success.html
Disallow: /payment-fail.html
Disallow: /payment-selection.html
Disallow: /transfer-payment.html
Allow: /api/objects/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(robots);
});

export default router;
