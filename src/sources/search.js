const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config/default');

/**
 * Search Google for a query and return organic result URLs.
 * Uses the public HTML endpoint (no API key needed).
 * NOTE: Google may block automated requests; use browser mode if needed.
 */
async function googleSearch(query, { limit = 10, userAgent } = {}) {
  const encoded = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encoded}&num=${limit}&hl=en`;

  const headers = {
    ...config.request.headers,
    'User-Agent': userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const resp = await axios.get(url, { headers, timeout: config.request.timeout });
  const $ = cheerio.load(resp.data);

  const results = [];
  // Google organic results: anchors inside #search with /url? redirect or direct hrefs
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/^\/url\?q=([^&]+)/);
    if (match) {
      try {
        const target = decodeURIComponent(match[1]);
        if (target.startsWith('http') && !target.includes('google.com')) {
          results.push(target);
        }
      } catch (_) {}
    }
  });

  return [...new Set(results)].slice(0, limit);
}

/**
 * Search DuckDuckGo (more scraper-friendly than Google).
 */
async function duckDuckGoSearch(query, { limit = 10, userAgent } = {}) {
  const encoded = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

  const headers = {
    ...config.request.headers,
    'User-Agent': userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  };

  const resp = await axios.get(url, { headers, timeout: config.request.timeout });
  const $ = cheerio.load(resp.data);

  const results = [];
  $('.result__url, .result__a').each((_, el) => {
    const href = $(el).attr('href') || $(el).text().trim();
    if (href.startsWith('http') && !href.includes('duckduckgo.com')) {
      results.push(href);
    }
  });

  // Also try redirect links
  $('a.result__a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/uddg=([^&]+)/);
    if (match) {
      try {
        results.push(decodeURIComponent(match[1]));
      } catch (_) {}
    }
  });

  return [...new Set(results)].slice(0, limit);
}

/**
 * Build a business-specific search query to find contact details.
 * @param {string} name - Business name or type (e.g. "italian restaurant")
 * @param {string} location - City or area (e.g. "Madrid")
 */
function buildRestaurantQuery(name, location) {
  return `${name} ${location} phone contact -tripadvisor -eltenedor -thefork`;
}

module.exports = { googleSearch, duckDuckGoSearch, buildRestaurantQuery };
