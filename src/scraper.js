const pLimit = require('p-limit');
const chalk = require('chalk');
const config = require('../config/default');
const { scrapeWithFallback } = require('./sources/direct');
const { scrapeWithBrowser, closeBrowser } = require('./sources/browser');
const { googleSearch, duckDuckGoSearch, buildRestaurantQuery } = require('./sources/search');
const { exportCsv } = require('./exporters/csv');
const { exportJson } = require('./exporters/json');
const path = require('path');
const fs = require('fs');

/**
 * Main scraper class. Supports two modes:
 *  - 'urls'   : scrape a provided list of URLs directly
 *  - 'search' : search for businesses by keyword + location, then scrape results
 *
 * Optional AI features (requires aiConfig.enabled = true):
 *  - AI extraction : replaces regex-based contact extraction with an LLM call
 */
class Scraper {
  constructor(options = {}) {
    this.mode = options.mode || 'urls';
    this.useBrowser = options.browser || false;
    this.concurrency = options.concurrency || config.concurrency;
    this.outputDir = options.outputDir || path.join(__dirname, '..', 'results');
    this.searchEngine = options.searchEngine || 'duckduckgo';
    this.onProgress = options.onProgress || null;
    // aiConfig: { enabled, provider, model, apiKey, baseUrl, features: { extraction } }
    this.aiConfig = options.aiConfig || null;
    this.aiModel = null; // lazy-initialised on first use
    this.results = [];

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Scrape a list of URLs.
   * @param {string[]} urls
   */
  async scrapeUrls(urls) {
    const limit = pLimit(this.concurrency);
    console.log(chalk.blue(`\nScraping ${urls.length} URL(s) [concurrency=${this.concurrency}]...\n`));

    const tasks = urls.map(url => limit(() => this._scrapeOne(url)));
    this.results = await Promise.all(tasks);
    return this.results;
  }

  /**
   * Search for businesses matching a query and location, then scrape each result.
   * @param {string} query    e.g. "italian restaurant"
   * @param {string} location e.g. "Barcelona"
   * @param {number} limit    max results to scrape
   */
  async searchAndScrape(query, location, limit = 10) {
    const searchQuery = buildRestaurantQuery(query, location);
    console.log(chalk.yellow(`\nSearching: "${searchQuery}"`));

    let urls = [];
    try {
      if (this.searchEngine === 'google') {
        urls = await googleSearch(searchQuery, { limit });
      } else {
        urls = await duckDuckGoSearch(searchQuery, { limit });
      }
    } catch (err) {
      console.error(chalk.red(`Search failed: ${err.message}`));
      return [];
    }

    console.log(chalk.green(`Found ${urls.length} URLs to scrape.`));
    return this.scrapeUrls(urls);
  }

  /**
   * Lazily initialise the AI model instance (only on first use).
   * Returns null if AI is disabled or initialisation fails.
   */
  async _getAIModel() {
    if (!this.aiConfig?.enabled) return null;
    if (this.aiModel) return this.aiModel;

    try {
      const { createModel } = require('./ai/provider');
      this.aiModel = await createModel(this.aiConfig);
      console.log(chalk.magenta(`  ✨ AI extraction enabled (${this.aiConfig.provider}/${this.aiConfig.model})`));
      return this.aiModel;
    } catch (err) {
      console.warn(chalk.yellow(`  ⚠ AI init failed, falling back to regex: ${err.message}`));
      return null;
    }
  }

  /**
   * Scrape a single URL with optional AI extraction.
   */
  async _scrapeOne(url) {
    console.log(chalk.cyan(`  → ${url}`));
    try {
      let result;

      if (this.useBrowser) {
        result = await scrapeWithBrowser(url);
        if (result.phones.length === 0 && result.emails.length === 0 && result.contactPageLinks.length > 0) {
          for (const link of result.contactPageLinks.slice(0, 2)) {
            try {
              const sub = await scrapeWithBrowser(link);
              if (sub.phones.length > 0) result.phones = sub.phones;
              if (sub.emails.length > 0) result.emails = sub.emails;
              if (!result.address && sub.address) result.address = sub.address;
              Object.assign(result.socials, sub.socials);
              if (result.phones.length > 0) break;
            } catch (_) {}
          }
        }
      } else {
        result = await scrapeWithFallback(url);
      }

      // AI extraction: run over the page text if AI is enabled and configured
      if (this.aiConfig?.enabled && this.aiConfig?.features?.extraction !== false) {
        const model = await this._getAIModel();
        if (model && result._pageText) {
          try {
            const { extractWithAI, mergeResults } = require('./ai/extractor');
            const aiData = await extractWithAI(result._pageText, model);
            result = mergeResults(aiData, result);
          } catch (aiErr) {
            console.warn(chalk.yellow(`  ⚠ AI extraction failed for ${url}: ${aiErr.message}`));
          }
        }
      }

      // Remove internal field before returning
      delete result._pageText;

      this._logResult(result);
      if (this.onProgress) this.onProgress(result);
      return result;
    } catch (err) {
      console.error(chalk.red(`  ✗ ${url}: ${err.message}`));
      const errResult = { url, error: err.message, phones: [], emails: [], socials: {} };
      if (this.onProgress) this.onProgress(errResult);
      return errResult;
    } finally {
      await sleep(randomDelay());
    }
  }

  _logResult(r) {
    const phones = r.phones.length ? chalk.green(r.phones.join(', ')) : chalk.gray('no phones');
    const emails = r.emails.length ? chalk.green(r.emails.join(', ')) : chalk.gray('no emails');
    const aiTag = r.extractedBy === 'ai' ? chalk.magenta(' ✨') : '';
    console.log(`    ${chalk.bold(r.title || r.url)}${aiTag}`);
    console.log(`    📞 ${phones}`);
    console.log(`    ✉  ${emails}`);
    if (r.address) console.log(`    📍 ${chalk.green(r.address)}`);
    if (r.openingHours) console.log(`    🕐 ${chalk.gray(r.openingHours)}`);
    const soc = Object.keys(r.socials || {}).join(', ');
    if (soc) console.log(`    🔗 ${chalk.blue(soc)}`);
    console.log('');
  }

  /**
   * Export results to CSV and/or JSON.
   * @param {string} format 'csv' | 'json' | 'both'
   * @param {string} [name] base filename (without extension)
   */
  async export(format = 'both', name = 'results') {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const base = path.join(this.outputDir, `${name}_${timestamp}`);
    const exported = [];

    if (format === 'csv' || format === 'both') {
      const p = await exportCsv(this.results, base + '.csv');
      console.log(chalk.green(`\nCSV saved: ${p}`));
      exported.push(p);
    }
    if (format === 'json' || format === 'both') {
      const p = await exportJson(this.results, base + '.json');
      console.log(chalk.green(`JSON saved: ${p}`));
      exported.push(p);
    }
    return exported;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay() {
  const { min, max } = config.delayBetweenRequests;
  return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = { Scraper };
