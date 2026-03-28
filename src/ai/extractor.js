'use strict';

/**
 * AI-powered contact extractor.
 *
 * Uses generateObject() with a Zod schema to extract structured contact
 * information from raw page text. Falls back gracefully to an empty result
 * on any error so the caller can merge with the regex-based extraction.
 */

const { generateObject } = require('ai');
const { z } = require('zod');

const ContactSchema = z.object({
  name: z.string().describe('Business or restaurant name, empty string if not found'),
  phones: z.array(z.string()).describe('All phone numbers found, in international format'),
  emails: z.array(z.string()).describe('All email addresses found'),
  address: z.string().describe('Full street address (street + number), empty string if not found'),
  openingHours: z.string().describe('Opening hours as a single readable string, empty string if not found'),
  socials: z.object({
    instagram: z.string().describe('Instagram profile URL, empty string if not found'),
    facebook: z.string().describe('Facebook page URL, empty string if not found'),
    twitter: z.string().describe('Twitter/X profile URL, empty string if not found'),
    tiktok: z.string().describe('TikTok profile URL, empty string if not found'),
    tripadvisor: z.string().describe('TripAdvisor page URL, empty string if not found'),
  }),
  description: z.string().describe('Short description of the business (1-2 sentences), empty string if not found'),
});

const SYSTEM_PROMPT = `You are a data extraction and validation assistant. Your job is to:
1. Extract all contact information from the business website text provided.
2. Review any pre-extracted data passed to you and correct errors (wrong formats, truncated numbers, misidentified fields, duplicates).
3. Be precise: only use data explicitly present in the text. Do not invent values.
4. For phone numbers: return them in international format (e.g. +34 612 345 678). Discard anything that is not a real phone number.
5. For social media: only include full URLs. Discard partial or relative paths.
6. If pre-extracted data looks correct and the text confirms it, keep it. If it looks wrong or inconsistent with the text, fix or discard it.`;

/**
 * Extract and validate contacts from page text using an LLM.
 * Passes any pre-extracted regex data so the AI can review and correct it.
 *
 * @param {string} pageText      Plain text content of the page (will be truncated).
 * @param {object} model         Vercel AI SDK model instance from provider.js.
 * @param {object} [existing]    Pre-extracted data from regex to review and correct.
 * @returns {Promise<object>}    Validated and corrected contact fields.
 */
async function extractWithAI(pageText, model, existing = {}) {
  // Limit to ~6k chars to keep costs low and stay within context limits
  const text = pageText.slice(0, 6000);

  const existingSummary = Object.keys(existing).length
    ? `\n\nPre-extracted data to review and correct:\n${JSON.stringify(existing, null, 2)}`
    : '';

  const { object } = await generateObject({
    model,
    schema: ContactSchema,
    system: SYSTEM_PROMPT,
    prompt: `Extract and validate all contact information from the following business website text:${existingSummary}\n\nPage text:\n${text}`,
  });

  return object;
}

/**
 * Merge AI extraction result with regex-based result.
 * AI is authoritative on all fields it extracted; regex fills remaining gaps.
 *
 * @param {object} aiResult
 * @param {object} regexResult
 * @returns {object}
 */
function mergeResults(aiResult, regexResult) {
  return {
    ...regexResult,
    phones: aiResult.phones?.length ? aiResult.phones : regexResult.phones,
    emails: aiResult.emails?.length ? aiResult.emails : regexResult.emails,
    address: (aiResult.address?.trim()) || regexResult.address,
    openingHours: (aiResult.openingHours?.trim()) || regexResult.openingHours,
    socials: {
      ...regexResult.socials,
      ...Object.fromEntries(
        Object.entries(aiResult.socials || {}).filter(([, v]) => v?.trim())
      ),
    },
    title: (aiResult.name?.trim()) || regexResult.title || undefined,
    description: (aiResult.description?.trim()) || regexResult.description || undefined,
    extractedBy: 'ai',
  };
}

module.exports = { extractWithAI, mergeResults };
