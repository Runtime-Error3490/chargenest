import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider, listProviders, registerProvider } from '../src/services/ai/index.js';
import { createOpenAICompatibleProvider } from '../src/services/ai/openaiCompatible.js';
import { aiService } from '../src/services/ai.service.js';

test('the registry lists the built-in providers', () => {
  for (const name of ['openrouter', 'openai', 'ollama', 'mock']) {
    assert.ok(listProviders().includes(name), name);
  }
});

test('an unknown provider name fails with the available names', () => {
  assert.throws(() => createProvider('nope'), /Unknown AI provider "nope".*openrouter/);
});

test('provider and model come from settings, AI_MODEL style override wins', () => {
  const p = createProvider('openai', { apiKey: 'k', baseUrl: 'https://x.test/v1', model: 'gpt-a' });
  assert.equal(p.name, 'openai');
  assert.equal(p.model, 'gpt-a');
  assert.equal(createProvider('openai', { model: 'gpt-a' }, 'gpt-b').model, 'gpt-b');
});

test('a new provider can be registered without touching the concierge', async () => {
  registerProvider('echo', () => ({
    name: 'echo',
    model: 'echo-1',
    chat: async ({ messages }) => ({ content: messages.at(-1).content, toolCalls: [], message: {} }),
  }));
  const p = createProvider('echo');
  assert.equal((await p.chat({ messages: [{ role: 'user', content: 'hi' }] })).content, 'hi');
});

test('OpenAI-compatible provider sends model and tools and normalizes tool calls', async () => {
  let sent;
  const provider = createOpenAICompatibleProvider({
    name: 'openrouter',
    apiKey: 'k',
    baseUrl: 'https://x.test/v1',
    model: 'anthropic/claude-3-haiku',
    clientFactory: () => ({
      chat: {
        completions: {
          create: async (req) => {
            sent = req;
            return {
              choices: [{
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_chargers', arguments: '{"latitude":1,"longitude":2}' } }],
                },
              }],
            };
          },
        },
      },
    }),
  });

  const tools = [{ type: 'function', function: { name: 'search_chargers' } }];
  const result = await provider.chat({ messages: [{ role: 'user', content: 'find' }], tools, temperature: 0.2 });

  assert.equal(sent.model, 'anthropic/claude-3-haiku');
  assert.equal(sent.tool_choice, 'auto');
  assert.deepEqual(result.toolCalls, [{ id: 'c1', name: 'search_chargers', arguments: { latitude: 1, longitude: 2 } }]);
});

test('the client is created lazily, so a missing key does not break import or construction', () => {
  let created = 0;
  createOpenAICompatibleProvider({ name: 'x', model: 'm', clientFactory: () => { created++; return {}; } });
  assert.equal(created, 0);
});

test('the concierge loop runs tools through the configured (mock) provider', async () => {
  const seen = [];
  const tools = [
    { type: 'function', function: { name: 'search_chargers' } },
    { type: 'function', function: { name: 'create_booking' } },
  ];
  const reply = await aiService.chatWithConcierge(
    [{ role: 'user', content: '[User location: 12.9, 77.6]\n\nfind a charger near me' }],
    tools,
    async (name, args) => {
      seen.push([name, args]);
      return [{ name: 'Home charger' }];
    }
  );

  assert.deepEqual(seen.map(([n]) => n), ['search_chargers']);
  assert.equal(seen[0][1].latitude, 12.9);
  assert.deepEqual(reply.toolsUsed, ['search_chargers']);
  assert.match(reply.message, /Home charger/);
});

test('a tool error reaches the model as an error result, not a crash', async () => {
  const chargerId = '11111111-1111-4111-8111-111111111111';
  const packageId = '22222222-2222-4222-8222-222222222222';
  const reply = await aiService.chatWithConcierge(
    [{ role: 'user', content: `book charger ${chargerId} package ${packageId} at 2030-01-01T10:00:00Z` }],
    [{ type: 'function', function: { name: 'create_booking' } }],
    async () => { throw new Error('Not allowed: agent is off'); }
  );
  assert.match(reply.message, /Not allowed: agent is off/);
});
