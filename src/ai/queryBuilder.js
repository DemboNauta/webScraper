'use strict';

/**
 * AI-powered search query builder.
 *
 * Takes a natural language description of what the user wants to find
 * and generates optimised search queries to locate business websites
 * (avoiding aggregators like TripAdvisor, Yelp, TheFork).
 */

const { generateObject } = require('ai');
const { z } = require('zod');

const SearchPlanSchema = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe('Search engine queries, most promising first'),
  suggestedLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .describe('Recommended number of results to scrape'),
  reasoning: z
    .string()
    .optional()
    .describe('Brief explanation of the search strategy'),
});

const SYSTEM_PROMPT = `You are a web research assistant helping find business contact information.
Generate targeted search engine queries to find the official websites of businesses matching the user's request.
Avoid queries that would return aggregator sites (TripAdvisor, Yelp, TheFork, OpenTable, Google Maps, Yelp).
Focus on finding the businesses' own websites where direct contact info (phone, email) would be listed.
Keep queries concise and in the same language as the user's input.`;

/**
 * Build an optimised search plan from a natural language intent.
 *
 * @param {string} intent    What the user described (e.g. "family Italian restaurants without online booking")
 * @param {string} location  City or region (e.g. "Barcelona")
 * @param {object} model     Vercel AI SDK model instance.
 * @returns {Promise<{ queries: string[], suggestedLimit: number, reasoning?: string }>}
 */
async function buildSearchPlan(intent, location, model) {
  const { object } = await generateObject({
    model,
    schema: SearchPlanSchema,
    system: SYSTEM_PROMPT,
    prompt: `Find businesses matching this description: "${intent}" in "${location}".
Generate 1-3 search queries and suggest how many results to scrape (1-30 is typical).`,
  });

  return object;
}

module.exports = { buildSearchPlan };
