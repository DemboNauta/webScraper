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
  name: z.string().optional().describe('Business or restaurant name'),
  phones: z.array(z.string()).default([]).describe('All phone numbers found, in original format'),
  emails: z.array(z.string()).default([]).describe('All email addresses found'),
  address: z.string().optional().describe('Full street address'),
  openingHours: z.string().optional().describe('Opening hours as a single readable string'),
  socials: z.object({
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
    twitter: z.string().url().optional(),
    tiktok: z.string().url().optional(),
    tripadvisor: z.string().url().optional(),
  }).default({}),
  description: z.string().optional().describe('Short description of the business (1-2 sentences)'),
});

const SYSTEM_PROMPT = `You are a data extraction assistant. Extract structured contact information from business website text.
Be precise: only extract data that is explicitly present in the text. Do not invent or guess values.
For phone numbers keep the original format. For social media only include full URLs.`;

/**
 * Extract contacts from page text using an LLM.
 *
 * @param {string} pageText   Plain text content of the page (will be truncated).
 * @param {object} model      Vercel AI SDK model instance from provider.js.
 * @returns {Promise<object>} Extracted contact fields (may be partial).
 */
async function extractWithAI(pageText, model) {
  // Limit to ~6k chars to keep costs low and stay within context limits
  const text = pageText.slice(0, 6000);

  const { object } = await generateObject({
    model,
    schema: ContactSchema,
    system: SYSTEM_PROMPT,
    prompt: `Extract all contact information from the following business website text:\n\n${text}`,
  });

  return object;
}

/**
 * Merge AI extraction result with regex-based result.
 * AI result takes precedence for non-empty fields; regex fills gaps.
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
    address: aiResult.address || regexResult.address,
    openingHours: aiResult.openingHours || regexResult.openingHours,
    socials: {
      ...regexResult.socials,
      ...Object.fromEntries(
        Object.entries(aiResult.socials || {}).filter(([, v]) => v)
      ),
    },
    // Only override title/description if AI found something and original is empty
    title: regexResult.title || aiResult.name,
    description: regexResult.description || aiResult.description,
    extractedBy: 'ai',
  };
}

module.exports = { extractWithAI, mergeResults };
