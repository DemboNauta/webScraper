# WebScraper — Business Contact Extractor

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A versatile Node.js web scraper that extracts phone numbers, email addresses, physical addresses, and social media links from business websites. Ideal for lead generation, market research, and contact aggregation across restaurants, retail stores, service providers, and more.

It ships with a React web UI and a full-featured CLI, supports both static (axios + cheerio) and JavaScript-rendered (Puppeteer) page scraping, and can discover business URLs automatically via DuckDuckGo or Google search.

---

## Features

- **Three scraping modes**: direct URL list, automatic search-then-scrape, and batch file input
- **Dual rendering engine**: fast static scraper (axios + cheerio) with automatic fallback to headless browser (Puppeteer) for JS-heavy sites
- **Contact extraction**: phones, emails, street addresses, Instagram, Facebook, TripAdvisor, TikTok, Twitter, and Google Maps links
- **Search integration**: DuckDuckGo (default) and Google organic result scraping — no API key required
- **Sub-page following**: automatically visits contact/about pages when the homepage lacks data
- **Export**: CSV and JSON output with timestamped filenames
- **Web UI**: React dashboard with real-time Server-Sent Events progress log, results table, and download links
- **Concurrency control**: configurable parallel request limit with polite random delays

---

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd webScraper

# Install backend dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install

# (Optional) Install Chromium for browser mode
npm run install-browser
```

---

## Usage

### Web UI (recommended)

```bash
npm run dev
```

Opens the API server on `http://localhost:3001` and the Vite dev server on `http://localhost:5173`.
Navigate to the browser URL shown by Vite to use the full web interface.

---

### CLI — Mode 1: Scrape a list of URLs directly

```bash
node src/index.js urls https://example-restaurant.com https://another-place.com
```

Common options:

| Flag | Description | Default |
|---|---|---|
| `-b, --browser` | Use headless browser (JS-heavy pages) | `false` |
| `-f, --format` | Output format: `csv`, `json`, or `both` | `both` |
| `-o, --output` | Output directory | `./results` |
| `-c, --concurrency` | Max parallel requests | `3` |
| `-n, --name` | Base filename for exports | `scrape` |

---

### CLI — Mode 2: Search for businesses and scrape results

```bash
# Search DuckDuckGo (default) and scrape top 15 results
node src/index.js search "italian restaurant" "New York" --limit 15

# Use Google as search engine
node src/index.js search "tapas bar" "Seville" --engine google

# Enable browser mode for JavaScript-rendered pages
node src/index.js search "restaurant" "Barcelona" --browser --limit 10
```

Additional options for `search` mode:

| Flag | Description | Default |
|---|---|---|
| `-l, --limit` | Max search results to scrape | `10` |
| `-e, --engine` | Search engine: `google` or `duckduckgo` | `duckduckgo` |

---

### CLI — Mode 3: Scrape from a file of URLs

```bash
# urls.txt — one URL per line
node src/index.js file urls.txt --format csv --name my_batch
```

---

## Project Structure

```
webScraper/
├── src/
│   ├── index.js              CLI entry point (commander)
│   ├── scraper.js            Orchestrator class (Scraper)
│   ├── server.js             Express API + SSE endpoints
│   ├── extractors/
│   │   └── contacts.js       Phone, email, address, and social link extraction
│   ├── sources/
│   │   ├── direct.js         Static scraping (axios + cheerio) with fallback
│   │   ├── browser.js        Headless browser scraping (Puppeteer)
│   │   └── search.js         Google and DuckDuckGo search scrapers
│   └── exporters/
│       ├── csv.js            CSV export using csv-writer
│       └── json.js           JSON export
├── config/
│   └── default.js            Global config: timeouts, patterns, delays, selectors
├── frontend/
│   └── src/
│       ├── App.jsx           Root component with tab navigation
│       ├── components/
│       │   ├── SearchForm.jsx    Search-mode form
│       │   ├── UrlsForm.jsx      Direct URL input form
│       │   ├── ProgressLog.jsx   Real-time SSE log panel
│       │   ├── ResultsTable.jsx  Scraped results table with download
│       │   ├── HistoryTab.jsx    Browse and load saved result files
│       │   └── ui/               Reusable UI primitives (Button, Badge, Card, …)
│       └── lib/
│           ├── sse.js        Fetch-based SSE client
│           ├── api.js        REST API helpers
│           └── cn.js         Tailwind class merge utility
├── results/                  Default output directory (CSV + JSON files)
└── package.json
```

---

## License

[MIT](./LICENSE) © 2026 WebScraper Contributors
