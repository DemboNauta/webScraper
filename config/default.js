module.exports = {
  // HTTP request settings
  request: {
    timeout: 15000,
    retries: 3,
    retryDelay: 2000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  },

  // Puppeteer settings for dynamic pages
  browser: {
    headless: true,
    waitUntil: 'networkidle2',
    timeout: 30000,
    viewport: { width: 1280, height: 800 },
  },

  // Concurrency: max parallel requests
  concurrency: 3,

  // Delay between requests (ms) to avoid rate limiting
  delayBetweenRequests: { min: 1000, max: 3000 },

  // Selectors and patterns used for contact extraction
  extraction: {
    phonePatterns: [
      // Spain
      /(?:\+34|0034)?[\s.-]?[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g,
      // International generic
      /\+?\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g,
    ],
    emailPattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    addressKeywords: ['calle', 'c/', 'avda', 'avenida', 'plaza', 'paseo', 'carretera', 'street', 'avenue', 'road'],
    socialDomains: {
      instagram: 'instagram.com',
      facebook: 'facebook.com',
      twitter: 'twitter.com',
      tiktok: 'tiktok.com',
      tripadvisor: 'tripadvisor',
      google_maps: 'maps.google',
    },
  },

  // CSS selectors to prioritize for contact info
  contactSelectors: [
    'footer',
    '.contact', '#contact', '[class*="contact"]',
    '.info', '#info', '[class*="info"]',
    '.direccion', '.address', '[class*="address"]',
    'aside',
    '.sidebar',
  ],
};
