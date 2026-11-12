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
| 🤖 **AI Concierge** | Natural language booking: "Find me a charger near X, budget $Y" |
| 🛡️ **Know Your Agent (KYA)** | 5 autonomy levels, spending limits, per-action permissions, audit trail |
| 💳 **PayPal-Native Payments** | Wallet, holds, payouts, invoicing - 5 APIs integrated |
| ⚖️ **AI Dispute Resolution** | Automatic analysis, 95%+ confidence auto-resolve |

---

## 💰 Business Model

| Revenue Stream | Details |
|---------------|---------|
| Platform Fee | **7%** of each successful session |
| Deposit | **$50** damage deposit required (stays in wallet) |
| Future | Premium features, fleet management, API access |

---

## 🔧 Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React, Vite, Tailwind CSS, Leaflet Maps |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| AI | Pluggable: Gemini, OpenAI, OpenRouter, Ollama |
| Payments | PayPal Orders v2, Payouts, Invoicing, Webhooks |
| Auth | JWT + TOTP MFA (Google Authenticator) |
| Deploy | Docker-ready, Render hosting |

**~28,000 lines of code** | **50+ API endpoints** | **Full test coverage**

---

## 🔐 PayPal Integration (5 APIs)

```
User → PayPal Orders → Wallet Top-up
         ↓
    Wallet Ledger (holds at booking)
         ↓
    Session Complete → Host Wallet
         ↓
   Payouts API → Host's PayPal
```

Also: **Invoicing v2** for damage claims, **Webhooks** for real-time updates

---

## 🛡️ Know Your Agent (KYA) Safety Layer

| Level | Name | Capabilities |
|-------|------|--------------|
| 0 | Off | No actions |
| 1 | Inform | Search & view only |
| 2 | Ask First | All actions need approval |
| 3 | Trust | Books within spending limit |
| 4 | Full Auto | Everything except invoices |

**Every action logged. Risky actions need human approval.**

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
| **1. MVP** | ✅ Done | Core marketplace, AI, PayPal, KYA |
| **2. Verify** | Next | Email/phone verification, ID checks, trust scoring |
| **3. Scale** | Future | Mobile apps, multi-city, fleet management |

---

## 👥 Team

| Name | Role |
|------|------|
| **Nandini A Choukimath** | Co-founder & Developer |
| **Shaleen Shukla** | Co-founder & Developer |

---

## 🔗 Links

- **GitHub:** github.com/Runtime-Error3490/chargenest
- **Demo Video:** [Coming Soon]
- **Live App:** [Render Deployment]

---

**Built for PayPal AI Hackathon 2026** 🏆
