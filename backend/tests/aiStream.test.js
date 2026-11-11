import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAICompatibleProvider } from '../src/services/ai/openaiCompatible.js';

const fakeStream = (chunks) => ({
  chat: { completions: { create: async (req) => {
    assert.equal(req.stream, true);
    return (async function* () { for (const c of chunks) yield c; })();
  } } },
});

test('stream passes text pieces to onText and returns the joined reply', async () => {
  const provider = createOpenAICompatibleProvider({
    name: 't', model: 'm',
    clientFactory: () => fakeStream([
      { choices: [{ delta: { content: 'Hel' } }] },
      { choices: [{ delta: { content: 'lo' } }] },
    ]),
  });
  const pieces = [];
  const res = await provider.stream({ messages: [], onText: (t) => pieces.push(t) });
  assert.deepEqual(pieces, ['Hel', 'lo']);
  assert.equal(res.content, 'Hello');
  assert.deepEqual(res.toolCalls, []);
});

test('stream joins tool call pieces and keeps the Gemini signature', async () => {
  const provider = createOpenAICompatibleProvider({
    name: 't', model: 'm',
    clientFactory: () => fakeStream([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'get_wallet', arguments: '{"a"' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' }, extra_content: { google: { thought_signature: 'sig' } } }] } }] },
    ]),
  });
  const res = await provider.stream({ messages: [], tools: [{}] });
  assert.deepEqual(res.toolCalls, [{ id: 'c1', name: 'get_wallet', arguments: { a: 1 } }]);
  assert.equal(res.message.tool_calls[0].extra_content.google.thought_signature, 'sig');
});
