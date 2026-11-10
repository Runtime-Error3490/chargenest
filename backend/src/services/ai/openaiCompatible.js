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
  };
}

function safeParse(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}
