const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const config = require('../../config/default');
const { extractFromCheerio } = require('../extractors/contacts');

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    // Try to find a system Chrome/Chromium binary
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
      || findSystemChrome();

    if (!executablePath) {
      throw new Error(
        'No Chrome/Chromium found. Set PUPPETEER_EXECUTABLE_PATH env variable or install chromium.\n' +
        'e.g. PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser node src/index.js ...'
      );
    }

    browserInstance = await puppeteer.launch({
      executablePath,
      headless: config.browser.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserInstance;
}

function findSystemChrome() {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const fs = require('fs');
  return candidates.find(p => fs.existsSync(p)) || null;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Scrape a URL using a real browser (handles JS-rendered content).
 */
async function scrapeWithBrowser(url, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport(config.browser.viewport);

    // Randomise user agent if provided
    if (options.userAgent) {
      await page.setUserAgent(options.userAgent);
    }

    // Block images/fonts to speed things up
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: config.browser.waitUntil,
      timeout: config.browser.timeout,
    });

    // Scroll to bottom to trigger lazy-loaded content
    await autoScroll(page);

    const html = await page.content();
    const $ = cheerio.load(html);

    const title = await page.title();
    const description = $('meta[name="description"]').attr('content') || '';
    const contacts = extractFromCheerio($);

    // Collect contact-page links
    const contactPageLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .filter(a => /contact|contacto|sobre|about|info/i.test(a.textContent + a.href))
        .map(a => a.href)
        .slice(0, 5);
    });

    return {
      url,
      title,
      description,
      ...contacts,
      contactPageLinks: [...new Set(contactPageLinks)],
      _pageText: $('body').text().replace(/\s+/g, ' ').trim(),
    };
  } finally {
    await page.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

module.exports = { scrapeWithBrowser, closeBrowser };
