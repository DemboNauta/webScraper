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
    .describe('Brief explanation of the search strategy'),
});

const SYSTEM_PROMPT = `You are a web research assistant helping find business contact information.
Generate simple, effective search engine queries to find official business websites with direct contact info (phone, email).

Rules:
- Keep queries SHORT (under 10 words). Long queries with many operators return 0 results.
- Use plain natural language, not complex boolean syntax.
- At most ONE exclusion operator (e.g. -tripadvisor), never more.
- Never nest quoted phrases inside other quoted phrases.
- Never use site: operator unless the user explicitly asks for a specific domain.
- Each query must be meaningfully different (vary keywords, not just add operators).
- Write queries in the same language as the user's input.`;

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
