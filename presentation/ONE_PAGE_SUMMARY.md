# ⚡ ChargeNest - Executive Summary

> **The peer-to-peer marketplace for EV home charging, powered by AI and PayPal**

---

## 🎯 The Problem

| Challenge | Impact |
|-----------|--------|
| 70% of urban EV owners can't install home chargers | Apartment dwellers, renters excluded from EV ownership |
| 45-minute average wait at public stations | Range anxiety limits EV adoption |
| 80% of home chargers sit idle | Massive underutilized infrastructure |

**Bottom line:** There's a supply-demand mismatch in EV charging.

---

## 💡 The Solution

**ChargeNest = Airbnb for EV Charging**

Connect drivers who need charging with homeowners who have idle capacity.

### Key Differentiators

| Feature | Description |
|---------|-------------|
| 🤖 **AI Concierge** | Natural language booking: "Find me a charger near Yeshwantpur, budget $Y". Knows your real location, looks up place names, remembers the conversation, streams its replies |
| 🎯 **Smart recommendations** | Ranks nearby chargers on power, distance, rating and price in plain code, so the same question gives the same ranking |
| 🛡 **Know Your Agent (KYA)** | 5 autonomy levels, spending limits, per-action permissions, signed audit trail, owner approval for risky actions |
| 💳 **PayPal-Native Payments** | Wallet top-up, holds, withdrawals, invoicing, disputes - 6 PayPal APIs integrated |
| ⚖ **AI Dispute Resolution** | Drivers report an issue, AI analyses it, 95%+ confidence auto-resolves, an admin handles the rest |
| 🔌 **Device-verified sessions** | Signed charger events decide success, refund or payout delay automatically |
| 👥 **Role-aware** | Drivers book and report issues; hosts earn, withdraw and send damage invoices |

---

## 💰 Business Model

| Revenue Stream | Details |
|---------------|---------|
| Platform Fee | **7%** of each successful session |
| Deposit | **$50** damage deposit required (stays locked in the wallet; anything above it pays for bookings) |
| Future | Premium features, fleet management, API access |

---

## 🔧 Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React, Vite, Tailwind CSS, Leaflet Maps |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| AI | Pluggable: Gemini, OpenAI, OpenRouter, Ollama. Tool-calling agent, streamed replies, free place lookup (OpenStreetMap) |
| Payments | PayPal Orders v2, Payments v2, Payouts, Invoicing v2, Customer Disputes, Webhooks |
| Auth | JWT + TOTP MFA (Google Authenticator) |
| Deploy | Docker + Render Blueprint (one file), dark mode, larger-text accessibility option |

**~33,000 lines of code** | **85+ API endpoints** | **131 automated tests**

---

## 🔐 PayPal Integration (6 APIs)

```
Driver → PayPal Orders v2 → Wallet top-up
              ↓
    Wallet ledger: booking amount is HELD
              ↓
    Session verified → driver charged, unused time refunded
              ↓
    Host wallet credited (minus 7%), optional payout delay
              ↓
    Withdraw → Payouts API → PayPal account (host or driver)
```

Also: **Invoicing v2** for host damage invoices, **Payments v2** for authorizations, captures and refunds, **Customer Disputes** (accept claim, send message) and **Webhooks** (payment, invoice and dispute events, signature-verified)

---

## 🛡️ Know Your Agent (KYA) Safety Layer

| Level | Name | Capabilities |
|-------|------|--------------|
| 0 | Off | No actions |
| 1 | Inform Only | Search, recommend, answer questions |
| 2 | Ask First | Books, cancels and reports only after you approve |
| 3 | Act & Report | Books and cancels within budget, then reports back |
| 4 | Full Autonomy | Also tops up and handles disputes within limits |

**Invoices always need your approval, at every level.** Every agent has its own Ed25519 identity; each action is signed, checked against your permissions in code (not by the model) and written to the audit log.

---

## 📈 Impact

| Dimension | Value |
|-----------|-------|
| **Environmental** | Accelerates EV adoption → reduced emissions |
| **Economic** | Passive income for hosts, cheaper for drivers |
| **Community** | Neighborhood connections through mutual ratings |
| **Scalability** | Hardware metering ready, any city, fleet APIs |

---

## 🗺️ Roadmap

| Phase | Status | Focus |
|-------|--------|-------|
| **1. MVP** | ✅ Done | Marketplace, AI concierge, PayPal wallet + withdrawals + invoicing + disputes, KYA, device-verified sessions |
| **2. Verify** | Next | Email/SMS notifications, email/phone verification, ID checks, trust scoring |
| **3. Scale** | Future | Mobile apps, multi-city, fleet management |

---

## 👥 Team

| Photo | Name | Role |
|:-----:|------|------|
| <img src="team/nandini.jpg" alt="Nandini A Choukimath" width="80" height="80"> | **Nandini A Choukimath** | Co-founder & Developer |
| <img src="team/shaleen.jpg" alt="Shaleen Shukla" width="80" height="80"> | **Shaleen Shukla** | Co-founder & Developer |

---

## 🔗 Links

- **GitHub:** github.com/Runtime-Error3490/chargenest
- **Demo Video:** [Coming Soon]
- **Live App:** https://chargenest-swbe.onrender.com (PayPal sandbox, demo data)

---

**Built for PayPal AI Hackathon 2026** 🏆
