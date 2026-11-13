import { defineConfig } from 'vite';

function latestFacultyNews(html) {
  const items = [];
  const pattern = /<a[^>]+href="(https:\/\/fds\.cityu\.edu\.mo\/News\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) && items.length < 3) {
    const title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!title || items.some((item) => item.url === match[1])) continue;
    const after = html.slice(match.index, match.index + 800);
    const dateMatch = after.match(/<div class="date[^"]*">\s*(\d{4}\/\d{2}\/\d{2})\s*<\/div>/);
    if (!dateMatch) continue;
    items.push({ title, url: match[1], date: dateMatch[1] });
  }
  return items;
}

function facultyNewsProxy() {
  return {
    name: 'fds-news',
    configureServer(server) {
      server.middlewares.use('/fds-news', (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end();
          return;
        }
        fetch('https://fds.cityu.edu.mo/News', {
          headers: { 'user-agent': 'Mozilla/5.0' },
        })
          .then(async (page) => {
            if (!page.ok) throw new Error(String(page.status));
            const items = latestFacultyNews(await page.text());
            if (items.length < 3) throw new Error('incomplete');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ items }));
          })
          .catch(() => {
            if (res.writableEnded) return;
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ items: [] }));
          });
      });
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/cityu_fds/' : '/',
  plugins: [facultyNewsProxy()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
