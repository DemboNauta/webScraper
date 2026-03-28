const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config/default');
const { extractFromCheerio } = require('../extractors/contacts');

/**
 * Fetch a URL with axios (static pages, fast).
 * Returns { html, $ } or throws.
 */
async function fetchStatic(url, userAgent) {
  const headers = {
    ...config.request.headers,
    'User-Agent': userAgent || 'Mozilla/5.0 (compatible; WebScraper/1.0)',
  };

  let lastError;
  for (let attempt = 1; attempt <= config.request.retries; attempt++) {
    try {
      const resp = await axios.get(url, {
        headers,
        timeout: config.request.timeout,
        maxRedirects: 5,
      });
      const $ = cheerio.load(resp.data);
      return { html: resp.data, $ };
    } catch (err) {
      lastError = err;
      if (attempt < config.request.retries) {
        await sleep(config.request.retryDelay * attempt);
      }
    }
  }
  throw lastError;
}

/**
 * Scrape a URL (static method) and return structured contact data.
 */
async function scrapeUrl(url, options = {}) {
  const { html, $ } = await fetchStatic(url, options.userAgent);

  const title = $('title').text().trim() || $('h1').first().text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const contacts = extractFromCheerio($);

  // Try to find a dedicated contact page
  const contactPageLinks = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = ($(a).text() || '').toLowerCase();
    if (/contact|contacto|sobre|about|aviso|info/i.test(text + href)) {
      contactPageLinks.push(resolveUrl(url, href));
    }
  });

  return {
    url,
    title,
    description,
    ...contacts,
    contactPageLinks: [...new Set(contactPageLinks)].slice(0, 5),
  };
}

/**
 * If the main page lacks phones/emails, follow contact sub-pages.
 */
async function scrapeWithFallback(url, options = {}) {
  const result = await scrapeUrl(url, options);

  const needsMore = result.phones.length === 0 && result.emails.length === 0;
  if (needsMore && result.contactPageLinks.length > 0) {
    for (const link of result.contactPageLinks.slice(0, 2)) {
      try {
        await sleep(randomDelay());
        const sub = await scrapeUrl(link, options);
        if (sub.phones.length > 0) result.phones = sub.phones;
        if (sub.emails.length > 0) result.emails = sub.emails;
        if (!result.address && sub.address) result.address = sub.address;
        Object.assign(result.socials, sub.socials);
        if (result.phones.length > 0 && result.emails.length > 0) break;
      } catch (_) {
        // ignore sub-page errors
      }
    }
  }

  return result;
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch (_) {
    return href;
  }
}

function randomDelay() {
  const { min, max } = config.delayBetweenRequests;
  return Math.floor(Math.random() * (max - min)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeUrl, scrapeWithFallback, fetchStatic };
