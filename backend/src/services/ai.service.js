import { config } from '../config/index.js';
import { getProvider } from './ai/index.js';
import { AIError } from '../utils/errors.js';

/**
 * Call the configured AI provider with retry logic.
 * Returns { content, toolCalls, message } whichever provider is configured.
 */
async function callLLM(messages, tools = null, options = {}) {
  const maxRetries = config.ai.maxRetries;
  const provider = getProvider();
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timer;
    try {
      return await Promise.race([
        provider.chat({
          messages,
          tools,
          temperature: options.temperature ?? config.ai.temperature,
          maxTokens: options.maxTokens || 2048,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timeout')), config.ai.timeoutMs);
        }),
      ]);
    } catch (error) {
      lastError = error;
      console.error(`LLM attempt ${attempt + 1} failed (${provider.name}):`, error.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new AIError(`LLM request failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

export const aiService = {
  /**
   * Chat with concierge agent
   */
  async chatWithConcierge(messages, tools, executeToolCall) {
    const startTime = Date.now();
    const toolsUsed = [];
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    // Initial system message for concierge
    const systemMessage = {
      role: 'system',
      content: `You are a helpful EV charging concierge assistant. You help users find and book EV chargers.

Your capabilities:
- Search for chargers near a location
- Get details about specific chargers and hosts
- Estimate costs for charging sessions
- Create bookings paid from the user's wallet (only when user confirms)
- Raise a dispute for a booking (only when user asks)

Guidelines:
- Always explain your reasoning before suggesting a charger
- Consider distance, price, rating, and connector compatibility
- Only call create_booking when the user explicitly confirms they want to book
- The user sets your permissions. If a tool answers requiresApproval, tell the user it waits for their approval. If it is denied, explain why and do not retry
- Present options clearly with key details (distance, price, rating)
- Be helpful and conversational

When presenting charger options:
- Mention the charger name and distance
- State the price clearly
- Highlight the rating and number of bookings
- Explain why you recommend a particular option`,
    };

    const conversationMessages = [systemMessage, ...messages];

    while (iterations < maxIterations) {
      iterations++;

      const response = await callLLM(conversationMessages, tools);
      const toolCalls = response.toolCalls.length > 0 ? response.toolCalls : null;

      if (!toolCalls) {
        // No tool calls - return the text response
        return {
          message: response.content,
          toolsUsed,
          durationMs: Date.now() - startTime,
        };
      }

      // Execute tool calls
      conversationMessages.push(response.message);

      for (const toolCall of toolCalls) {
        toolsUsed.push(toolCall.name);
        
        try {
          const result = await executeToolCall(toolCall.name, toolCall.arguments);
          
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }
    }

    throw new AIError('Max iterations reached in concierge conversation');
  },

  /**
   * Analyze dispute and generate recommendation
   */
  async analyzeDispute(disputeData) {
    const systemMessage = {
      role: 'system',
      content: `You are a fair dispute resolver for an EV charging marketplace. Analyze the evidence and make a recommendation.

Your task:
1. Review the booking details, session data, and statements from both parties
2. Check if the agent (if used) operated within its mandate
3. Determine the fair outcome

Output your decision as JSON with this exact structure:
{
  "decision": "release_to_host" | "partial_refund" | "full_refund",
  "refund_amount": <number - 0 for release_to_host, partial amount, or full amount>,
  "reasoning": "<clear explanation of your decision>",
  "confidence": <number between 0.0 and 1.0>
}

Guidelines:
- Be fair to both parties
- Consider timestamp evidence carefully
- If evidence is unclear, lean toward partial refund
- High confidence (>0.95) only when evidence is clear
- Never exceed the captured amount in refund_amount`,
    };

    const userMessage = {
      role: 'user',
      content: `Please analyze this dispute:

**Booking Details:**
${JSON.stringify(disputeData.booking, null, 2)}

**Session Data:**
${JSON.stringify(disputeData.session, null, 2)}

**Payment Info:**
- Captured Amount: ${disputeData.capturedAmount}
- Currency: ${disputeData.currency}

**Dispute Reason:** ${disputeData.reason}
**Description:** ${disputeData.description}

**Driver Statement:**
${disputeData.driverStatement || 'No statement provided'}

**Host Statement:**
${disputeData.hostStatement || 'No statement provided'}

**Agent Audit Trail:**
${disputeData.auditTrail ? JSON.stringify(disputeData.auditTrail, null, 2) : 'No agent involvement'}

Please provide your decision as JSON.`,
    };

    const response = await callLLM([systemMessage, userMessage], null, {
      temperature: 0,
      maxTokens: 1024,
    });

    const content = response.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AIError('Failed to parse dispute analysis response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Validate and clamp values
    const validDecisions = ['release_to_host', 'partial_refund', 'full_refund'];
    if (!validDecisions.includes(analysis.decision)) {
      analysis.decision = 'partial_refund';
    }

    analysis.confidence = Math.min(1, Math.max(0, analysis.confidence || 0.5));
    analysis.refund_amount = Math.min(
      disputeData.capturedAmount,
      Math.max(0, analysis.refund_amount || 0)
    );

    if (analysis.decision === 'release_to_host') {
      analysis.refund_amount = 0;
    } else if (analysis.decision === 'full_refund') {
      analysis.refund_amount = disputeData.capturedAmount;
    }

    return analysis;
  },

  /**
   * Generate pricing suggestion with explanation
   */
  async generatePricingSuggestion(chargerData) {
    const { kwTier, connectorType, city, amenities, basePrice } = chargerData;

    const systemMessage = {
      role: 'system',
      content: `You are a pricing advisor for an EV charging marketplace. Generate a brief, helpful explanation for the suggested hourly price.

Consider:
- The charger's kW tier affects charging speed
- Location affects electricity costs and demand
- Amenities add value
- Competition in the area

Keep the explanation to 2-3 sentences. Be specific and helpful.`,
    };

    const userMessage = {
      role: 'user',
      content: `Charger details:
- Power: ${kwTier}
- Connector: ${connectorType}
- City: ${city}
- Amenities: ${amenities.join(', ') || 'None'}
- Calculated base price: ₹${basePrice}/hour

Explain why ₹${basePrice}/hour is a good price for this charger.`,
    };

    const response = await callLLM([systemMessage, userMessage], null, {
      temperature: 0.3,
      maxTokens: 256,
    });

    return response.content;
  },
};

export default aiService;
