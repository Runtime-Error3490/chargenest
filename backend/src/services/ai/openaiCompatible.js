import OpenAI from 'openai';

/**
 * Provider for any service that speaks the OpenAI chat-completions API
 * (OpenRouter, OpenAI, Ollama, Azure-style gateways). Only baseUrl, key and model differ.
 * The SDK client is created on first use so a missing key does not crash app start.
 */
export function createOpenAICompatibleProvider({ name, apiKey, baseUrl, model, headers = {}, clientFactory }) {
  let client;
  const getClient = () => {
    if (!client) {
      client = clientFactory
        ? clientFactory({ apiKey, baseUrl, headers })
        : new OpenAI({ apiKey, baseURL: baseUrl, defaultHeaders: headers });
    }
    return client;
  };

  return {
    name,
    model,
    async chat({ messages, tools, temperature = 0, maxTokens = 2048 }) {
      const request = { model, messages, temperature, max_tokens: maxTokens };
      if (tools && tools.length > 0) {
        request.tools = tools;
        request.tool_choice = 'auto';
      }

      const response = await getClient().chat.completions.create(request);
      const message = response.choices?.[0]?.message || { role: 'assistant', content: '' };

      const toolCalls = (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParse(tc.function.arguments),
      }));

      return { content: message.content || '', toolCalls, message };
    },

    /**
     * Same result as chat(), but text is passed to onText(delta) as it arrives.
     * Tool calls come in pieces, so they are joined and returned whole at the end.
     */
    async stream({ messages, tools, temperature = 0, maxTokens = 2048, onText }) {
      const request = { model, messages, temperature, max_tokens: maxTokens, stream: true };
      if (tools && tools.length > 0) {
        request.tools = tools;
        request.tool_choice = 'auto';
      }

      const stream = await getClient().chat.completions.create(request);
      let content = '';
      const calls = [];

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          content += delta.content;
          onText?.(delta.content);
        }
        for (const tc of delta.tool_calls || []) {
          const slot = calls[tc.index ?? 0] || (calls[tc.index ?? 0] = { id: '', type: 'function', function: { name: '', arguments: '' } });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
          // Gemini sends a signature with each tool call that must be echoed back
          if (tc.extra_content) slot.extra_content = tc.extra_content;
        }
      }

      const finished = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
      const message = { role: 'assistant', content: content || null };
      if (finished.length > 0) message.tool_calls = finished;

      return {
        content,
        toolCalls: finished.map((tc) => ({ id: tc.id, name: tc.function.name, arguments: safeParse(tc.function.arguments) })),
        message,
      };
    },
  };
}

function safeParse(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}
