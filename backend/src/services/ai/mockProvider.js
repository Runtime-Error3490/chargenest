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
      if (has('cancel_booking') && /cancel/i.test(text) && ids.length >= 1) {
        return respond('Cancelling that booking.', [call('cancel_booking', { booking_id: ids[0], reason: 'Cancelled by the user' })]);
      }
      if (has('top_up_wallet') && /(top.?up|add money|add funds)/i.test(text)) {
        const amount = parseFloat(text.match(/(\d+(\.\d{1,2})?)/)?.[1]);
        if (amount) return respond('Creating a top-up link.', [call('top_up_wallet', { amount })]);
      }
      if (has('recommend_chargers') && /(recommend|best|fastest|cheapest|nearest|suggest)/i.test(text)) {
        const loc = text.match(/User location:\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
        const priority = /fastest|fast/i.test(text) ? 'fastest' : /cheap/i.test(text) ? 'cheapest' : /near|close/i.test(text) ? 'nearest' : /rated|rating/i.test(text) ? 'best_rated' : 'balanced';
        return respond('Ranking chargers for you.', [
          call('recommend_chargers', {
            latitude: loc ? parseFloat(loc[1]) : 12.9716,
            longitude: loc ? parseFloat(loc[3]) : 77.5946,
            radius_km: 10,
            priority,
          }),
        ]);
      }
      if (has('create_damage_invoice') && /invoice/i.test(text) && ids.length >= 1) {
        const amount = parseFloat(text.replace(UUID, '').match(/(\d+(\.\d{1,2})?)/)?.[1]);
        if (amount) {
          return respond('Preparing the invoice.', [
            call('create_damage_invoice', { booking_id: ids[0], amount, description: `Damage reported by the host: ${text.slice(0, 120)}` }),
          ]);
        }
      }
      if (has('check_device_status') && /(device|session status)/i.test(text) && ids.length >= 1) {
        return respond('Checking the device.', [call('check_device_status', { booking_id: ids[0] })]);
      }
      if (has('get_wallet') && /(wallet|balance)/i.test(text)) {
        return respond('Checking your wallet.', [call('get_wallet', {})]);
      }
      if (has('list_disputes') && /disputes/i.test(text)) {
        return respond('Looking up your disputes.', [call('list_disputes', {})]);
      }
      if (has('list_invoices') && /invoice/i.test(text)) {
        return respond('Looking up your invoices.', [call('list_invoices', {})]);
      }
      if (has('list_my_bookings') && /(my bookings|bookings)/i.test(text)) {
        return respond('Looking up your bookings.', [call('list_my_bookings', { as: /\bhost\b/i.test(text) ? 'host' : 'driver' })]);
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
      return respond('I can find chargers, estimate costs, book them from your wallet, raise disputes, and show your wallet, bookings, disputes, invoices and device status.');
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
