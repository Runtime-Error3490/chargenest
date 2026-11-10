/**
 * Offline provider with scripted behaviour. Lets judges run the concierge without an API key
 * and lets tests exercise the full tool loop. It is chosen with AI_PROVIDER=mock.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z/;

let counter = 0;
const call = (name, args) => ({
  id: `mock_call_${++counter}`,
  name,
  arguments: args,
});

export function createMockProvider() {
  return {
    name: 'mock',
    model: 'mock',
    async chat({ messages, tools }) {
      const last = messages[messages.length - 1];
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const has = (tool) => (tools || []).some((t) => t.function.name === tool);
      const respond = (content, toolCalls = []) => ({
        content,
        toolCalls,
        message: {
          role: 'assistant',
          content,
          ...(toolCalls.length > 0 && {
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          }),
        },
      });

      // Dispute analyser asks for JSON
      if (/dispute resolver/i.test(system)) {
        return respond(JSON.stringify({
          decision: 'partial_refund',
          refund_amount: 0,
          reasoning: 'Mock provider: evidence is not conclusive, escalating to an admin.',
          confidence: 0.5,
        }));
      }

      if (last.role === 'tool') {
        const parsed = safeJson(last.content);
        if (parsed?.requiresApproval) {
          return respond(`I need your approval first: ${parsed.summary}`);
        }
        if (parsed?.error) {
          return respond(`I could not do that: ${parsed.error}`);
        }
        return respond(`Done. Result: ${String(last.content).slice(0, 400)}`);
      }

      const text = String(last.content || '');
      const ids = text.match(UUID) || [];
      const date = text.match(ISO_DATE)?.[0];

      if (has('create_booking') && /\bbook\b/i.test(text) && ids.length >= 2 && date) {
        return respond('Booking that for you now.', [
          call('create_booking', { charger_id: ids[0], package_id: ids[1], scheduled_start: date }),
        ]);
      }
      if (has('raise_dispute') && /dispute/i.test(text) && ids.length >= 1) {
        return respond('Raising a dispute.', [
          call('raise_dispute', { booking_id: ids[0], reason: 'Damage reported by the user', description: text.slice(0, 500) }),
        ]);
      }
      if (has('search_chargers') && /(find|search|near|charger)/i.test(text)) {
        const loc = text.match(/User location:\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
        return respond('Searching nearby chargers.', [
          call('search_chargers', {
            latitude: loc ? parseFloat(loc[1]) : 12.9716,
            longitude: loc ? parseFloat(loc[3]) : 77.5946,
            radius_km: 10,
          }),
        ]);
      }
      return respond('I can find chargers, estimate costs, book them from your wallet and raise disputes.');
    },
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
