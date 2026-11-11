import { config } from '../../config/index.js';
import { createOpenAICompatibleProvider } from './openaiCompatible.js';
import { createMockProvider } from './mockProvider.js';

/**
 * AI provider layer.
 *
 * A provider is `{ name, model, chat({messages, tools, temperature, maxTokens}) }` and chat() resolves to
 * `{ content, toolCalls: [{id, name, arguments}], message }`. `message` is the raw assistant message in
 * OpenAI shape so it can be pushed back into the conversation unchanged.
 *
 * Switch provider with AI_PROVIDER (and optionally AI_MODEL). Add a new one with registerProvider().
 */
const factories = {
  openrouter: (cfg) => createOpenAICompatibleProvider({
    name: 'openrouter',
    headers: { 'HTTP-Referer': config.frontendUrl, 'X-Title': 'EV Charging Marketplace' },
    ...cfg,
  }),
  openai: (cfg) => createOpenAICompatibleProvider({ name: 'openai', ...cfg }),
  gemini: (cfg) => createOpenAICompatibleProvider({ name: 'gemini', ...cfg }),
  ollama: (cfg) => createOpenAICompatibleProvider({ name: 'ollama', ...cfg }),
  mock: () => createMockProvider(),
};

export function registerProvider(name, factory) {
  factories[name.toLowerCase()] = factory;
}

export function listProviders() {
  return Object.keys(factories);
}

/**
 * Build a provider from settings. Exposed for tests; app code uses getProvider().
 */
export function createProvider(name, settings = {}, modelOverride) {
  const key = (name || '').toLowerCase();
  const factory = factories[key];
  if (!factory) {
    throw new Error(`Unknown AI provider "${name}". Available: ${listProviders().join(', ')}`);
  }
  return factory({ ...settings, model: modelOverride || settings.model });
}

let cached;
export function getProvider() {
  if (!cached) {
    const name = config.ai.provider;
    cached = createProvider(name, config.ai.providers[name] || {}, config.ai.modelOverride);
  }
  return cached;
}
