# Project Decisions Log

**Project:** Peer-to-Peer EV Home-Charging Marketplace  
**Hackathon:** PayPal AI Hackathon  
**Deadline:** November 12, 2026, 12:00 PT (November 13, 2026, 01:30 IST)  
**Last Updated:** November 9, 2026

---

## Team

| Name | Role |
|------|------|
| Nandini A Choukimath | Co-founder & Developer |
| Shaleen Shukla | Co-founder & Developer |

---

## Tech Stack Decisions

| Component | Decision | Rationale |
|-----------|----------|-----------|
| Frontend | React (Vite) | Fast build, simpler than Next.js for MVP |
| UI Map | Leaflet + OpenStreetMap | No API key required |
| Backend | Node.js (Express) | Team familiarity |
| Database | PostgreSQL | Both local and Render deployment |
| Auth | JWT + TOTP MFA | Secure, authenticator-based (Google Authenticator/Authy) |
| AI Provider | Pluggable (Gemini, OpenRouter, OpenAI, Ollama, mock) | All speak the OpenAI chat API; `AI_PROVIDER` + one `AI_MODEL` for any of them |
| LLM Model | GPT-3.5-turbo or Claude Haiku | Cost-effective for MVP |
| Payments | PayPal Sandbox | Hackathon requirement |
| Hosting | Render | Qualifies for sponsor prize |

---

## Business Rules

### Pricing & Fees

| Parameter | Value | Notes |
|-----------|-------|-------|
| Platform Fee | 7% | Lower than typical 10-15% since we don't own chargers |
| Pricing Model (MVP) | Time-based packages | Host sets price per time slot |
| Pricing Model (Roadmap) | + Percentage-based | Requires hardware metering |

### Cancellation Policy

| Cancel Before Session | Penalty | PayPal Action |
|-----------------------|---------|---------------|
| 24+ hours | 0% (Free) | Void authorization |
| 12-24 hours | 25% of booking | Capture 25%, void rest |
| 6-12 hours | 50% of booking | Capture 50%, void rest |
| < 6 hours | 100% of booking | Capture full amount |
| No-show | 100% + rating impact | Capture full + negative rating |

### Disputes

| Parameter | Value |
|-----------|-------|
| Dispute Window | 24 hours after session end |
| AI Auto-resolve Threshold | ≥95% confidence |
| Below Threshold | Manual admin review |
| Resolution Options | Full release, partial refund, full refund |

### Ratings

| Parameter | Value |
|-----------|-------|
| Scale | 1-5 stars |
| Text Review | Optional |
| Type | Mutual (driver rates charger, host rates driver) |

---

## User & Role Model

| Decision | Value |
|----------|-------|
| User Table | Single `users` table |
| Role Storage | Separate `user_roles` table |
| Multiple Roles | Yes, one user can be both host AND driver |
| Admin Role | Separate admin role for dispute resolution |

### Role-Based UI Rendering

```
User logs in
    │
    ├── Has 'driver' role → Show driver dashboard, search, bookings
    │
    ├── Has 'host' role → Show host dashboard, listings, earnings
    │
    ├── Has both roles → Show role switcher in UI
    │
    └── Has 'admin' role → Show admin panel, dispute queue
```

---

## Agent (KYA) Configuration

### Mandate Defaults

| Parameter | Default Value | User Can Override |
|-----------|---------------|-------------------|
| Spending Cap | ₹1000 | Yes |
| Max Distance | 10 km | Yes |
| Connector Type | Any | Yes |
| Expiry | 24 hours | Yes |

### Trust Score (Roadmap)

| Factor | Weight |
|--------|--------|
| Completed bookings | +1 per booking |
| Disputes raised against | -5 per dispute |
| Guardrail violations | -10 per violation |
| Low score action | Tighten mandate limits |

---

## AI Features

### A. Charging Concierge Agent

| Parameter | Value |
|-----------|-------|
| Model | GPT-3.5-turbo / Claude Haiku |
| Temperature | 0 (deterministic) |
| Tools | See "AI Concierge Tools and Roles" below |
| Mandate Enforcement | Server-side (not in prompt) |
| Fallback | Show error, suggest manual booking |

### B. Dispute Resolver

| Parameter | Value |
|-----------|-------|
| Model | GPT-3.5-turbo / Claude Haiku |
| Output Schema | `{ decision, refund_amount, reasoning, confidence }` |
| Auto-apply | confidence ≥ 95% |
| Manual Review | confidence < 95% |
| Server Validation | Clamp refund to captured amount |

### C. Pricing Advisor

| Parameter | Value |
|-----------|-------|
| Baseline | Deterministic (electricity cost × kW tier + margin) |
| LLM Enhancement | Time-of-day, local context, plain-language explanation |
| Host Override | Always allowed |

---

## Geography

| Parameter | Value |
|-----------|-------|
| Launch City | Bengaluru |
| Rationale | High EV density, many apartments, tech-savvy population |
| Demo Areas | Koramangala, Indiranagar, HSR Layout, Whitefield |

---

## Scope Boundaries

### In Scope (MVP)

- [x] Host listings with time-based packages
- [x] Map search (Leaflet + OSM)
- [x] Booking flow with PayPal authorize/capture/void/refund
- [x] Payouts to hosts (or simulated if sandbox limitation)
- [x] Webhooks for payment status sync
- [x] Concierge agent with mandate enforcement
- [x] KYA layer (agent identity, signed mandates, audit log)
- [x] Dispute resolver (AI + manual fallback)
- [x] Pricing advisor (baseline + LLM explanation)
- [x] Mutual ratings
- [x] Host dashboard (listings, bookings, earnings)
- [x] Driver dashboard (bookings, agent activity, mandate management)
- [x] Team page
- [x] TOTP MFA
- [x] Seeded demo data (Bengaluru)
- [x] Render deployment
- [x] Demo video (< 3 min)
- [x] README with setup instructions

### Out of Scope (Roadmap)

- [ ] Hardware metering / smart plug integration
- [ ] Percentage-based charging packages
- [ ] Native mobile apps
- [ ] Real KYC verification
- [ ] Insurance integration
- [ ] Real money transactions
- [ ] Society/apartment approval workflows
- [ ] Multi-city rollout
- [ ] External agent access (MCP server)
- [ ] Voice input
- [ ] AG Grid / Zapier integrations

### Cut List (if time runs out, cut in order)

1. Trust score implementation
2. Pricing advisor LLM explanation (keep baseline)
3. Host dashboard polish
4. Ratings text review

### Never Cut

- PayPal lifecycle (authorize → capture → void → refund → payout)
- Concierge agent with mandate enforcement
- Demo video

---

## Payment Architecture (Nov 10, 2026)

**Decision:** one PayPal sandbox business account acts as the demo escrow. The wallet in our database is a ledger of who owns what part of that account. PayPal is touched only when money enters or leaves.

```
Driver --PayPal Orders--> Escrow account (our business app) --PayPal Payouts--> Host PayPal email
            top-up                 |                                cash out
                                   v
                         Wallet ledger (database)
   top-up -> hold at booking -> release to host (minus fee) -> cancel returns hold
```

| Step | What happens | PayPal call |
|------|--------------|-------------|
| Top-up | Driver approves a PayPal order. Capture adds the amount to the wallet. | Orders create, capture |
| Deposit | The first 500 is required. 250 of it stays locked. | none |
| Book | Booking total (price plus 7% fee) moves from spendable to held. | none |
| Charging done | Held amount leaves the driver. Host wallet gets it minus the fee share. | none |
| Cancel | Held amount returns to the driver, minus any cancellation fee. | none |
| Host cash out | Spendable balance is paid to the host PayPal email. | Payouts |
| Close wallet | Whole balance, deposit included, is paid out. Blocked while a booking, dispute or unpaid invoice is open. | Payouts |
| Damage | Host sends an invoice. Paid invoice credits the host (minus fee). | Invoicing |
| Dispute | Raised and answered through PayPal. A refund moves money back in the ledger. | Disputes |

**Config:** `PLATFORM_FEE_PERCENT` (7), `WALLET_MIN_BALANCE` (500), `WALLET_DEPOSIT` (250), `DEFAULT_CURRENCY`.

**Sandbox setup that works (checked Nov 10, 2026):** a sandbox Business account with country United States, and a REST app on it. An India business account fails with `PAYOUT_NOT_AVAILABLE` for Payouts and `NOT_AUTHORIZED` for partner referrals. Use `DEFAULT_CURRENCY=USD` with it. With no keys, mock mode simulates every call.

**Limits (demo only, not for real money):**
- Holding user funds in one account needs a payments licence in real life.
- The ledger can drift from the real PayPal balance (fees, failed payouts). A balance check is not built yet.
- Held money is ledger-only. It is not a PayPal authorization.
- Damage is not taken from the deposit. It is a PayPal invoice.

**Considered and not built: PayPal Commerce Platform.** Driver pays the host directly and PayPal keeps our fee, with no pooled account. The sandbox supports it: a partner-referral call returned a sign-up link. It has no wallet or deposit, needs a sign-up link per host and a large payment rewrite. Next step for real money: add it as a second way to pay, starting with a "Connect PayPal" button for hosts.

---

## Session Success and Host Payout (Nov 10, 2026)

**One question decides every payout: did the session succeed?** `evaluateSession()` in `session.service.js` answers it. Both ways of proving a session end in `settleWalletSession()`, so money moves the same way.

| Proof source | Who vouches | Today |
|--------------|-------------|-------|
| `manual` | Driver and host tap start and end | Default, unchanged |
| `device` | Charger hardware sends signed events | Mock now, ESP32 later |

**Success (device):** the device unlocked, the session ran at least `MIN_SESSION_MINUTES`, and if a meter reported energy it was at least `MIN_ENERGY_KWH`. The driver pays for the share of booked time used. The unused part of the hold returns to the driver. The host gets the amount minus the platform fee.

**Failed (full refund, booking cancelled):**

| Reason | When |
|--------|------|
| `no_unlock` | Booked time passed (plus `DEVICE_GRACE_MINUTES`) and the device never unlocked. Covers a station that is offline or broken. |
| `too_short` | Ran less than `MIN_SESSION_MINUTES` |
| `meter_anomaly` | Long enough session but about zero energy |

An unknown device id or a bad signature never reaches a booking, so a fake station cannot take payment.

**Payout delay:** with `PAYOUT_DELAY_HOURS` above 0 the driver's hold is cleared at the end but the host is credited later. A dispute before then freezes it (booking status `disputed`). A refund on a dispute shrinks the pending amount instead of debiting the host wallet. Default 0 keeps the old behavior.

**Device events** (`POST /api/device/events`, no login, HMAC-SHA256 signed with the device secret): `unlocked`, `meter`, `ended`. Each carries a counter that must rise, so a replay is rejected. The signature covers device id, booking id, type, counter, time and payload.

**Mock device:** `POST /api/device/mock/simulate` (needs `DEVICE_MOCK=true`, never in production) sends signed events through the same handler. Scenarios: `success`, `short_session`, `bad_meter`, `fake_station`, `offline`, `no_unlock`. Real hardware replaces only the sender.

**Background runner:** every `JOB_INTERVAL_SEC` it closes device bookings whose time is over and pays hosts whose delay has passed.

**Not built yet:** QR code and unlock command to the device, host strikes for offline stations, email receipts, blocking a charger from going live until its device passes a test charge, device key rotation, MQTT and OCPP naming. Device sessions support wallet bookings only.

---

## AI Concierge Tools and Roles (Nov 11, 2026)

The agent acts for one user. Each tool maps to a permission switch in `agentPolicy.js`. Tools for a role the user does not have are not offered to the model, and are refused again when run. A user with both roles gets both sets.

| Tool | For | Switch | Approval |
|------|-----|--------|----------|
| `search_chargers`, `estimate_cost` | Driver | `search_chargers`, `compare_prices` | None |
| `get_charger_details` | Driver, host | `view_charger` | None |
| `create_booking` | Driver | `create_booking` + `make_payment` | Below level 3, or over the spending limit |
| `cancel_booking` | Driver | `cancel_booking` | Below level 3 |
| `top_up_wallet` | Driver | `top_up_wallet` (new) | Below level 4 |
| `raise_dispute` | Everyone | `create_dispute` | Below level 4 |
| `get_wallet`, `list_my_bookings`, `list_disputes`, `list_invoices` | Everyone | `view_payment` | None |
| `check_device_status` | Driver or host of that booking | `view_charger` | None |
| `recommend_chargers` | Driver | `search_chargers` + `compare_prices` | None |
| `create_damage_invoice` | Host | `create_invoice` (new) | Always, at every level. Limit `AGENT_MAX_INVOICES_PER_DAY` (default 5), checked in code. |

- **Recommendations:** `rankChargers()` in `charger.service.js` scores nearby chargers on power, distance, rating and price, each scaled against the other candidates. The driver's priority (`balanced`, `fastest`, `nearest`, `cheapest`, `best_rated`) sets the weights. The code picks the top 3 and the model only explains them, so the ranking is repeatable. A charger nobody rated gets a neutral 3. Phase 2 travel plans can reuse it by feeding it chargers found along a route.
- **Invoice:** the tool uses the same code as the host's invoice button, so its checks (booking finished, amount cap of 5x the booking) still apply.

- **Top-up:** the tool only creates a PayPal link. The owner approves on PayPal, so the agent never pays by itself.
- **Cancel:** it calls the same code as the cancel button, so the fee rule and wallet refund are identical.
- **Decided:** the agent may act as host or driver by role. `raise_dispute` does not open a dispute on PayPal at raise time.
- **Planned, not built:** respond to disputes, accept resolution, host withdraw.
- **Not built, needs new backend code first:** `modify_booking` (no reschedule code exists) and `request_refund` (refunds only happen through disputes).

---

## Open Items Resolved

| Question | Resolution |
|----------|------------|
| INR in PayPal Sandbox | Test first; fallback to USD with INR display |
| Payouts API access | Test first; fallback to simulated payout |
| Authorization validity | Capture within demo flow; note in video if short |

---

## Document History

| Date | Change |
|------|--------|
| Nov 9, 2026 | Initial decisions document created |
| Nov 11, 2026 | Added AI Concierge Tools and Roles |
| Nov 11, 2026 | Added Gemini provider, streamed concierge replies (`POST /agent/chat/stream`, switchable), markdown in chat, Render Blueprint (`render.yaml`) |
