const config = require('../../config/default');

/**
 * Deduplicate and clean an array of strings.
 */
function dedupe(arr) {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))];
}

/**
 * Extract phone numbers from a text string.
 * Returns an array of unique phone strings.
 */
function extractPhones(text) {
  const found = [];
  for (const pattern of config.extraction.phonePatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    const matches = text.match(re) || [];
    found.push(...matches);
  }
  // Clean non-digit noise, keep + prefix
  return dedupe(found).map(p => p.replace(/\s+/g, ' ').trim());
}

/**
 * Extract email addresses from a text string.
 */
function extractEmails(text) {
  const re = new RegExp(config.extraction.emailPattern.source, config.extraction.emailPattern.flags);
  return dedupe(text.match(re) || []);
}

/**
 * Extract social media links from an array of <a href> values.
 */
function extractSocialLinks(hrefs) {
  const socials = {};
  for (const href of hrefs) {
    for (const [name, domain] of Object.entries(config.extraction.socialDomains)) {
      if (href.includes(domain) && !socials[name]) {
        socials[name] = href;
      }
    }
  }
  return socials;
}

/**
 * Try to find an address-like string in a text block.
 * Returns the best candidate line or null.
 */
function extractAddress(text) {
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 5);
  const keywords = config.extraction.addressKeywords;
  const candidates = lines.filter(line =>
    keywords.some(kw => line.toLowerCase().includes(kw))
  );
  return candidates[0] || null;
}

/**
 * Given a cheerio-loaded document, extract all contact data.
 * Prioritises contact-related sections, falls back to full body.
 */
function extractFromCheerio($) {
  let priorityText = '';
  let allHrefs = [];

  // Collect text from contact-priority areas
  for (const selector of config.contactSelectors) {
    const el = $(selector);
    if (el.length) {
      priorityText += ' ' + el.text();
      el.find('a[href]').each((_, a) => {
        allHrefs.push($(a).attr('href') || '');
      });
    }
  }

  // Also collect all links from the page
  $('a[href]').each((_, a) => {
    allHrefs.push($(a).attr('href') || '');
  });

  // Full body text as fallback
  const fullText = $('body').text();
  const searchText = priorityText || fullText;

  return {
    phones: extractPhones(searchText) || extractPhones(fullText),
    emails: extractEmails(searchText) || extractEmails(fullText),
    address: extractAddress(searchText) || extractAddress(fullText),
    socials: extractSocialLinks(allHrefs),
  };
}

/**
 * Given raw HTML text, extract contacts (used for puppeteer-retrieved HTML).
 */
function extractFromHtml(html, $) {
  return extractFromCheerio($);
}

module.exports = { extractFromCheerio, extractFromHtml, extractPhones, extractEmails, extractAddress, extractSocialLinks };
