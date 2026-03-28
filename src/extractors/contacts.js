const config = require('../../config/default');
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

/**
 * Deduplicate and clean an array of strings.
 */
function dedupe(arr) {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))];
}

/**
 * Validate a raw phone candidate and return its E.164 international format, or null if invalid.
 * Uses Spain ('ES') as default country for local numbers without a country prefix.
 */
function validatePhone(raw) {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  try {
    if (isValidPhoneNumber(cleaned, 'ES')) {
      return parsePhoneNumber(cleaned, 'ES').formatInternational();
    }
  } catch (_) {}
  return null;
}

/**
 * Extract phone numbers from a text string.
 * Returns an array of unique, validated phone strings in international format.
 */
function extractPhones(text) {
  const found = [];
  for (const pattern of config.extraction.phonePatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    const matches = text.match(re) || [];
    found.push(...matches);
  }
  const validated = dedupe(found).map(validatePhone).filter(Boolean);
  return dedupe(validated);
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

  const candidates = lines.filter(line => {
    // Must contain an address keyword
    if (!keywords.some(kw => line.toLowerCase().includes(kw))) return false;
    // Discard questions
    if (line.startsWith('¿') || line.startsWith('?')) return false;
    // Discard lines with HTML/JSON artifacts
    if (/[{}"<>\\u00]/.test(line)) return false;
    // Discard attribution / copyright lines
    if (/attribution|openstreetmap|copyright|©/i.test(line)) return false;
    // Discard very long lines (nav menus, paragraph text)
    if (line.length > 120) return false;
    // Discard lines that are mostly navigation words
    if ((line.match(/\b(inicio|home|sobre|nosotros|blog|contacto|política|aviso|legal|términos|cookies|instagram|facebook|pinterest|twitter)\b/gi) || []).length >= 2) return false;
    return true;
  });

  if (!candidates.length) return null;

  // Prefer shorter, cleaner candidates (less likely to be sentences)
  candidates.sort((a, b) => a.length - b.length);

  // Clean up verbose prefixes like "en la calle X" or "ubicado en la calle X"
  let best = candidates[0];
  best = best.replace(/^(estamos?\s+)?(ubicad[oa]s?\s+)?(en\s+la\s+|en\s+el\s+|en\s+)/i, '');
  best = best.replace(/^(se\s+encuentra\s+(en\s+)?)/i, '');

  return best.trim() || null;
}

/**
 * Try to extract address from structured HTML (schema.org microdata, <address> tag).
 * Returns a string or null.
 */
function extractAddressFromHtml($) {
  // schema.org streetAddress (microdata or itemprop)
  const itemprop = $('[itemprop="streetAddress"]').first().text().trim();
  if (itemprop) return itemprop;

  // JSON-LD schema.org
  const scripts = $('script[type="application/ld+json"]');
  let jsonLdAddress = null;
  scripts.each((_, el) => {
    if (jsonLdAddress) return;
    try {
      const data = JSON.parse($(el).html());
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const addr = entry.address || (entry['@graph'] || []).map(n => n.address).find(Boolean);
        if (addr) {
          jsonLdAddress = typeof addr === 'string' ? addr : addr.streetAddress || null;
          break;
        }
      }
    } catch (_e) { /* ignore */ }
  });
  if (jsonLdAddress) return jsonLdAddress;

  // <address> tag
  const addressTag = $('address').first().text().replace(/\s+/g, ' ').trim();
  if (addressTag && addressTag.length < 200) return addressTag;

  return null;
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
    address: extractAddressFromHtml($) || extractAddress(searchText) || extractAddress(fullText),
    socials: extractSocialLinks(allHrefs),
  };
}

/**
 * Given raw HTML text, extract contacts (used for puppeteer-retrieved HTML).
 */
function extractFromHtml(html, $) {
  return extractFromCheerio($);
}

module.exports = { extractFromCheerio, extractFromHtml, extractPhones, extractEmails, extractAddress, extractAddressFromHtml, extractSocialLinks };
