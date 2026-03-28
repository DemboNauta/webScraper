'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Scraper } = require('./scraper');
const { closeBrowser } = require('./sources/browser');

const app = express();
const PORT = process.env.PORT || 3001;
const RESULTS_DIR = path.join(__dirname, '..', 'results');

app.use(cors());
app.use(express.json());

// Serve built frontend in production
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// ─── SSE helper ──────────────────────────────────────────────────────────────

function createSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return {
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      res.end();
    },
  };
}

// ─── Filename sanitisation ────────────────────────────────────────────────────

function isSafeFilename(name) {
  return /^[\w\-\.]+$/.test(name) && !name.includes('..');
}

// ─── POST /api/scrape/search ──────────────────────────────────────────────────

app.post('/api/scrape/search', async (req, res) => {
  const { query, location, limit = 10, engine = 'duckduckgo', browser = false } = req.body || {};

  if (!query || !location) {
    return res.status(400).json({ error: 'query and location are required' });
  }

  const sse = createSSE(res);
  const scraper = new Scraper({
    useBrowser: !!browser,
    searchEngine: engine,
    outputDir: RESULTS_DIR,
    onProgress: (result) => {
      sse.send('progress', {
        index: scraper.results.filter(Boolean).length,
        result,
      });
    },
  });

  sse.send('start', { mode: 'search', query, location, limit });

  try {
    // Run the search to get URLs first
    const { buildRestaurantQuery } = require('./sources/search');
    const { googleSearch, duckDuckGoSearch } = require('./sources/search');
    const searchQuery = buildRestaurantQuery(query, location);

    let urls = [];
    try {
      urls = engine === 'google'
        ? await googleSearch(searchQuery, { limit: Number(limit) })
        : await duckDuckGoSearch(searchQuery, { limit: Number(limit) });
    } catch (err) {
      sse.send('error', { message: `Search failed: ${err.message}` });
      return sse.close();
    }

    sse.send('urls_found', { urls, total: urls.length });

    await scraper.scrapeUrls(urls);

    const files = await scraper.export('both', 'search').catch(() => []);
    const filenames = files.map(f => path.basename(f));

    sse.send('done', {
      results: scraper.results,
      files: {
        json: filenames.find(f => f.endsWith('.json')) || null,
        csv: filenames.find(f => f.endsWith('.csv')) || null,
      },
    });
  } catch (err) {
    sse.send('error', { message: err.message });
  } finally {
    if (browser) await closeBrowser().catch(() => {});
    sse.close();
  }
});

// ─── POST /api/scrape/urls ────────────────────────────────────────────────────

app.post('/api/scrape/urls', async (req, res) => {
  const { urls, browser = false } = req.body || {};

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  const validUrls = urls.filter(u => typeof u === 'string' && u.startsWith('http'));
  if (validUrls.length === 0) {
    return res.status(400).json({ error: 'No valid URLs provided' });
  }

  const sse = createSSE(res);
  const scraper = new Scraper({
    useBrowser: !!browser,
    outputDir: RESULTS_DIR,
    onProgress: (result) => {
      sse.send('progress', {
        index: scraper.results.filter(Boolean).length,
        result,
      });
    },
  });

  sse.send('start', { mode: 'urls', total: validUrls.length });

  try {
    await scraper.scrapeUrls(validUrls);

    const files = await scraper.export('both', 'urls').catch(() => []);
    const filenames = files.map(f => path.basename(f));

    sse.send('done', {
      results: scraper.results,
      files: {
        json: filenames.find(f => f.endsWith('.json')) || null,
        csv: filenames.find(f => f.endsWith('.csv')) || null,
      },
    });
  } catch (err) {
    sse.send('error', { message: err.message });
  } finally {
    if (browser) await closeBrowser().catch(() => {});
    sse.close();
  }
});

// ─── GET /api/results ─────────────────────────────────────────────────────────

app.get('/api/results', (req, res) => {
  if (!fs.existsSync(RESULTS_DIR)) {
    return res.json({ files: [] });
  }

  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(RESULTS_DIR, f));
      return { name: f, size: stat.size, modified: stat.mtime };
    })
    .sort((a, b) => new Date(b.modified) - new Date(a.modified));

  res.json({ files });
});

// ─── GET /api/results/:filename ───────────────────────────────────────────────

app.get('/api/results/:filename', (req, res) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename) || !filename.endsWith('.json')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

// ─── GET /api/download/:filename ──────────────────────────────────────────────

app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filepath, filename);
});

// ─── SPA catch-all ────────────────────────────────────────────────────────────

if (fs.existsSync(distDir)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nWebScraper API running at http://localhost:${PORT}\n`);
});

module.exports = app;
