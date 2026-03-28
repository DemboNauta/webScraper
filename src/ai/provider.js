'use strict';

/**
 * Creates a Vercel AI SDK model instance for the given provider config.
 * Packages are loaded dynamically so every provider is optional —
 * if the package is missing a clear error is thrown.
 *
 * Supported providers:
 *  - anthropic  → @ai-sdk/anthropic  (Claude)
 *  - openai     → @ai-sdk/openai     (GPT-*)
 *  - deepseek   → @ai-sdk/openai     (OpenAI-compatible, custom baseURL)
 *  - groq       → @ai-sdk/groq       (Llama, Mixtral hosted by Groq)
 *  - ollama     → ollama-ai-provider  (local Ollama server)
 *  - mistral    → @ai-sdk/openai     (OpenAI-compatible)
 *  - google     → @ai-sdk/google     (Gemini)
 *
 * @param {object} cfg
 * @param {string} cfg.provider
 * @param {string} cfg.model
 * @param {string} [cfg.apiKey]
 * @param {string} [cfg.baseUrl]   Custom endpoint (Ollama, DeepSeek, etc.)
 * @returns {Promise<LanguageModelV1>}
 */
async function createModel(cfg) {
  const { provider, model, apiKey, baseUrl } = cfg;

  try {
    switch (provider) {

      case 'anthropic': {
        const { createAnthropic } = await import('@ai-sdk/anthropic');
        return createAnthropic({ apiKey })(model || 'claude-haiku-4-5-20251001');
      }

      case 'openai': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({ apiKey, ...(baseUrl && { baseURL: baseUrl }) })(model || 'gpt-4o-mini');
      }

      case 'deepseek': {
        // DeepSeek is OpenAI-compatible
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({
          apiKey,
          baseURL: baseUrl || 'https://api.deepseek.com/v1',
        })(model || 'deepseek-chat');
      }

      case 'groq': {
        const { createGroq } = await import('@ai-sdk/groq');
        return createGroq({ apiKey })(model || 'llama-3.1-8b-instant');
      }

      case 'ollama': {
        // Uses the ollama-ai-provider community package
        const { createOllama } = await import('ollama-ai-provider');
        return createOllama({
          baseURL: baseUrl || 'http://localhost:11434/api',
        })(model || 'llama3');
      }

      case 'mistral': {
        // Mistral is OpenAI-compatible
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({
          apiKey,
          baseURL: baseUrl || 'https://api.mistral.ai/v1',
        })(model || 'mistral-small-latest');
      }

      case 'google': {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        return createGoogleGenerativeAI({ apiKey })(model || 'gemini-1.5-flash');
      }

      default:
        throw new Error(`Unknown provider "${provider}". Supported: anthropic, openai, deepseek, groq, ollama, mistral, google`);
    }
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      const pkg = packageForProvider(provider);
      throw new Error(`Provider "${provider}" requires package "${pkg}". Run: npm install ${pkg}`);
    }
    throw err;
  }
}

function packageForProvider(provider) {
  const map = {
    anthropic: '@ai-sdk/anthropic',
    openai: '@ai-sdk/openai',
    deepseek: '@ai-sdk/openai',
    groq: '@ai-sdk/groq',
    ollama: 'ollama-ai-provider',
    mistral: '@ai-sdk/openai',
    google: '@ai-sdk/google',
  };
  return map[provider] || `@ai-sdk/${provider}`;
}

module.exports = { createModel };
