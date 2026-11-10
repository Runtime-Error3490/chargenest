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
| AI Provider | OpenRouter | OpenAI-compatible, model flexibility |
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
| Tools | `search_chargers`, `get_host_details`, `estimate_cost`, `create_booking_hold` |
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
