# PayPal AI Hackathon: Research Summary

Sources:
- Official page: https://paypalaihackathon.devpost.com/ (direct fetch returned HTTP 403, so the content below comes from secondary sources that quote it)
- PayPal blog: https://developer.paypal.com/community/blog/PayPal_AI_Hackathon/
- Third-party entry notes (rules copied from Devpost, 2026-10-04): https://github.com/howdycarter/paypal-ai-hackathon-2026/blob/main/docs/competition.md
- PayPal agent toolkit: https://developer.paypal.com/ai-tools/toolkit

Note: criterion weights and the full official rules text could not be read directly. Re-check the Devpost page by hand before submitting.

## The brief

"Build What's Next with PayPal and AI". No tracks, no set problem statements.
The one hard rule: the project must meaningfully use both PayPal and AI.
PayPal integration must be central, not decorative.

## Dates

- Submissions open: 2026-10-01
- Submissions close: 2026-11-12, 3:00 PM EST
- Winners announced: 2026-12-21

## Prizes (about $60k+ cash; $69,750 total)

- Best Overall: 1st $12,000, 2nd $8,000, 3rd $5,000
- $5,000 each: Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce
- Sponsor awards: AG Grid, APIMatic, Bryntum, Channel3, Render

Best fits for this project: Best Use of PayPal + AI, Best Use of Agentic Commerce.

## Judging criteria (five)

1. Technological Implementation: depth and skill in using the PayPal platform and AI. Working, non-trivial.
2. Design: a complete, coherent product experience.
3. Potential Impact: a real problem for a real audience, shown in the demo.
4. Innovation / Idea: creativity and difference from existing ideas.
5. Presentation: a video showing the project work end to end.

## Submission requirements

- Working build. Judges run it, or open a hosted demo. Mockups do not count.
- Text description of features.
- Tool list: which tools were used and how.
- Public GitHub repo with source, run instructions and a visible LICENSE file.
- Demo video under 3 minutes, public on YouTube, showing it working on the device it was built on.
  No third-party trademarks or copyrighted music.

## Entry rules

- Individual or team.
- New or existing projects are allowed if meaningful progress happens in the window.
- Must use the free PayPal sandbox. No real money.
- Sponsor tools are optional. Any AI tool or model works.
- Excluded regions: Brazil, Crimea, Cuba, Iran, North Korea, Quebec, Russia.

## Eligible PayPal APIs

No fixed list. Any PayPal Developer Platform API in the sandbox counts. Relevant ones:

| Need | PayPal API |
|---|---|
| Auth | OAuth 2.0 `POST /v1/oauth2/token` |
| Hold funds | Orders v2 with `intent=AUTHORIZE`, then Payments v2 authorizations |
| Take funds | Payments v2 `authorizations/{id}/capture` |
| Cancel a hold | Payments v2 `authorizations/{id}/void` |
| Pay host | Payouts `POST /v1/payments/payouts` |
| Invoices | Invoicing v2 `POST /v2/invoicing/invoices`, then `/send` |
| Disputes | Customer Disputes v1 `/v1/customer/disputes` |
| Events | Webhooks, verified with `verify-webhook-signature` and the webhook ID |
| Agent tooling | PayPal Agent Toolkit (MCP, LangChain, CrewAI, OpenAI Agents SDK, Vercel AI SDK, Bedrock) |

Base URL for sandbox: `https://api-m.sandbox.paypal.com`.

## AI and agent rules

- AI must be meaningful to the product, not a bolt-on.
- Any AI provider is allowed.
- "Agentic commerce" prize: agents should transact (authorize, capture, refund), not only recommend.
  Entries that do well keep a human approval step for risky actions.
- Good patterns seen in entries: limits on what the agent may do, spend budgets, escalation to a human,
  audit records of agent actions.

## Scoping decisions for this repo

- PayPal is the only payment backend. Sandbox only.
- Wallet deposit funded by PayPal; booking holds via authorize, release via capture and payout.
- Invoice and dispute flows are in scope (damage claims). Webhooks only if a flow needs them.
- AI concierge sits behind a provider interface, chosen by config.
- Agent permissions, autonomy levels and a minimal agent identity (KYA) record map to the
  "human approval and audit" pattern above.
- Keep run instructions and a LICENSE ready for the submission.

## Gap analysis (existing code vs what is missing)

Read from code on 2026-11-10. Stack: Node/Express + Prisma + React/Vite. Judging criteria and
requirements are summarised above; this section maps them to the repo.

### AI concierge
- EXISTS: `POST /agent/chat` (driver, mandate token), tool-calling loop in `ai.service.js`, tools
  `search_chargers`, `get_host_details`, `estimate_cost`, `create_booking_hold`, dispute analysis, pricing suggestion.
- MISSING: tools for cancel booking, raise dispute, create/send invoice. Policy tool names do not match service tool names.
- MISSING: provider interface, factory, second provider, mock. `ai.service.js` is hard-coded to the OpenAI SDK
  with an OpenRouter base URL. Config and `.env.example` already carry `AI_PROVIDER`, `OPENAI_*`, `OLLAMA_*`.
- `agent.service.js#createAgent` hard-codes `provider: 'openrouter'`.

### Agent settings: permissions and autonomy
- EXISTS: schema (`Agent.autonomyLevel`, `permissions`, `spendingLimit`, `AgentApproval`; no migration yet),
  pure policy `services/agentPolicy.js` (levels 0-4, 13 actions, allow/confirm/deny; not imported anywhere),
  `AgentSettingsPage.jsx`, approvals UI in `ChatPage.jsx`.
- MISSING: enforcement in `agent.service.js#chat` (only the mandate JWT cap is enforced); settings, status,
  approval and audit endpoints; frontend service methods the pages call (`getMandateSettings`,
  `updateMandateSettings`, `getAgentAuditLog`, `getAgentStatus`, `getPendingApprovals`, `respondToApproval`, `getActionResult`).
- Copy mismatch: page level 4 "Make payments within limit" vs policy `make_payment` auto at level 3.

### KYA (Know Your Agent)
- EXISTS: signed mandate JWT (caps, expiry, revoke); schema columns `publicKey`, `privateKeyEnc`, `kyaVerifiedAt`,
  plus `decision`, `kyaPayload`, `kyaSignature` on audit; `logAgentAction` writes `AuditLog`.
- MISSING: key generation, registration, verification, signing; filling the new audit columns;
  requiring a verified agent before agent actions. `KYA_KEY_SECRET` placeholder is in `.env.example`.

### Payments (PayPal only)
- EXISTS: `paypal.service.js` (OAuth, create order AUTHORIZE, get, authorize, capture, void, refund, payout, webhook verify);
  booking create/authorize/cancel; session end capture + payout to host PayPal email; `/webhooks/paypal`
  (order approved, authorization created, capture completed/denied/refunded); dispute refund; read-only payment history.
- MISSING: invoices (create, send), PayPal disputes, order capture for wallet top-up. No invoice service, route or UI
  (schema has `InvoiceStatus` only). No dispute or invoice webhook events.
- Risks: `createPayout` returns `SIMULATED` on any error (hides failures); default currency `INR` (sandbox may reject it);
  `BookingConfirmPage.jsx` calls missing `bookingService.createPaymentOrder` and uses SDK `intent=capture`
  while the backend uses AUTHORIZE.

### Wallet and minimum balance
- EXISTS: schema (`User.walletBalance`, `walletHeld`, `WalletTransaction`, `WalletTxType`, `FundingSource`; no migration),
  config `WALLET_MIN_BALANCE=500`.
- MISSING: wallet service (top-up, hold, release to host, refund, damage charge), wallet routes, signup deposit step in
  `RegisterPage.jsx`, guards on booking (`booking.service#createBooking`) and charger listing (`charger.service` create).
  Today host payout goes to a PayPal email, not a wallet.

### Non-PayPal payment methods
- No other processor or SDK in code or `package.json`. Only PayPal.
- Remove: README roadmap line `UPI payments (India-specific)`. Check `CreditCard` icon wording in `HomePage.jsx`
  and `AdminBookingsPage.jsx` (decorative). `FundingSource` values `wallet` and `paypal` are both PayPal-backed; keep.

### Build list
1. Wallet service, routes, signup deposit, min-balance guards.
2. PayPal invoices, disputes, top-up capture; payout errors fail loudly outside sandbox.
3. Booking hold from wallet, release to host wallet, cancel and failure paths.
4. AI provider interface and factory (openrouter, openai/ollama, mock); refactor `ai.service.js`.
5. Wire `agentPolicy.evaluateTool` into `agent.service#chat`; confirm/approval flow; add dispute, cancel, invoice tools.
6. KYA: key generation, register/verify, signed audit records.
7. Agent routes (settings, status, approvals, audit log) and matching frontend service methods.
8. Frontend fixes: `createPaymentOrder`, SDK intent, wallet UI, signup deposit.
9. Prisma migration for the schema additions.
10. Tests with `node:test` (none exist).
11. Docs: `ISSUES_AND_SOLUTIONS.md`, README env vars, ADR in `docs/DECISIONS.md`.
