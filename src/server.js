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

// ─── Webhook helper ───────────────────────────────────────────────────────────

async function sendWebhook(webhookConfig, payload) {
  if (!webhookConfig?.enabled || !webhookConfig?.url) return null

  const headers = { 'Content-Type': 'application/json' }
  if (webhookConfig.secret) headers['X-Webhook-Secret'] = webhookConfig.secret

  const resp = await fetch(webhookConfig.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.status
}

// ─── AI config validation ─────────────────────────────────────────────────────

/**
 * Extract and validate aiConfig from the request body.
 * Returns null if AI is disabled or config is missing/invalid.
 */
function parseAIConfig(body) {
  const cfg = body?.aiConfig;
  if (!cfg?.enabled) return null;
  if (!cfg.provider) return null;
  // apiKey is optional for Ollama
  return {
    enabled: true,
    provider: cfg.provider,
    model: cfg.model || null,
    apiKey: cfg.apiKey || null,
    baseUrl: cfg.baseUrl || null,
    features: {
      extraction: cfg.features?.extraction !== false,
      queryBuilder: cfg.features?.queryBuilder !== false,
    },
  };
}

// ─── POST /api/scrape/search ──────────────────────────────────────────────────

app.post('/api/scrape/search', async (req, res) => {
  const { query, location, limit = 10, engine = 'duckduckgo', browser = false } = req.body || {};
  const aiConfig = parseAIConfig(req.body);

  if (!query || !location) {
    return res.status(400).json({ error: 'query and location are required' });
  }

  const sse = createSSE(res);
  const scraper = new Scraper({
    useBrowser: !!browser,
    searchEngine: engine,
    outputDir: RESULTS_DIR,
    aiConfig,
    onProgress: (result) => {
      sse.send('progress', {
        index: scraper.results.filter(Boolean).length,
        result,
      });
    },
    onAiStep: (data) => {
      sse.send('ai_step', data);
    },
  });

  sse.send('start', { mode: 'search', query, location, limit });

  try {
    const { googleSearch, duckDuckGoSearch, buildRestaurantQuery } = require('./sources/search');

    // If AI query builder is enabled, use it to generate optimised queries
    let searchQueries = [buildRestaurantQuery(query, location)];
    let actualLimit = Number(limit);

    if (aiConfig?.enabled && aiConfig?.features?.queryBuilder) {
      try {
        const { buildSearchPlan } = require('./ai/queryBuilder');
        const { createModel } = require('./ai/provider');
        const model = await createModel(aiConfig);
        sse.send('ai_step', { step: 'building_queries', message: 'Building optimised search queries…' });
        const plan = await buildSearchPlan(query, location, model);
        searchQueries = plan.queries;
        if (plan.suggestedLimit) actualLimit = Math.min(plan.suggestedLimit, 50);
        sse.send('ai_queries', { queries: searchQueries, limit: actualLimit, reasoning: plan.reasoning });
      } catch (aiErr) {
        sse.send('ai_warning', { message: `AI query builder failed, using default: ${aiErr.message}` });
      }
    }

    // Collect URLs from all generated queries (deduplicated)
    let allUrls = [];
    for (const q of searchQueries) {
      try {
        const found = engine === 'google'
          ? await googleSearch(q, { limit: actualLimit })
          : await duckDuckGoSearch(q, { limit: actualLimit });
        allUrls.push(...found);
      } catch (_) {}
    }
    allUrls = [...new Set(allUrls)].slice(0, actualLimit);

    if (allUrls.length === 0) {
      sse.send('error', { message: 'Search returned no results' });
      return sse.close();
    }

    sse.send('urls_found', { urls: allUrls, total: allUrls.length });

    await scraper.scrapeUrls(allUrls);

    const files = await scraper.export('both', 'search').catch(() => []);
    const filenames = files.map(f => path.basename(f));

    // Send webhook if configured
    const webhookCfg = req.body?.webhookConfig?.enabled ? req.body.webhookConfig : null;
    if (webhookCfg?.url) {
      const withPhone = scraper.results.filter(r => r.phones?.length > 0).length;
      const withEmail = scraper.results.filter(r => r.emails?.length > 0).length;
      try {
        await sendWebhook(webhookCfg, {
          event: 'scrape.completed',
          timestamp: new Date().toISOString(),
          results: scraper.results,
          meta: { total: scraper.results.length, withPhone, withEmail, mode: 'search' },
        });
        sse.send('webhook_sent', { url: webhookCfg.url });
      } catch (err) {
        sse.send('webhook_error', { url: webhookCfg.url, message: err.message });
      }
    }

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
  const aiConfig = parseAIConfig(req.body);

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
    aiConfig,
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

    // Send webhook if configured
    const webhookCfg = req.body?.webhookConfig?.enabled ? req.body.webhookConfig : null;
    if (webhookCfg?.url) {
      const withPhone = scraper.results.filter(r => r.phones?.length > 0).length;
      const withEmail = scraper.results.filter(r => r.emails?.length > 0).length;
      try {
        await sendWebhook(webhookCfg, {
          event: 'scrape.completed',
          timestamp: new Date().toISOString(),
          results: scraper.results,
          meta: { total: scraper.results.length, withPhone, withEmail, mode: 'urls' },
        });
        sse.send('webhook_sent', { url: webhookCfg.url });
      } catch (err) {
        sse.send('webhook_error', { url: webhookCfg.url, message: err.message });
      }
    }

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

// ─── POST /api/ai/test ────────────────────────────────────────────────────────

app.post('/api/ai/test', async (req, res) => {
  const aiConfig = parseAIConfig(req.body);
  if (!aiConfig) {
    return res.status(400).json({ error: 'AI config missing or disabled' });
  }

  try {
    const { createModel } = require('./ai/provider');
    const { generateText } = await import('ai');
    const model = await createModel(aiConfig);
    const { text } = await generateText({
      model,
      prompt: 'Reply with exactly: "OK"',
      maxTokens: 10,
    });
    res.json({ ok: true, response: text.trim() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
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
