<div align="center">

# ⚡ ChargeNest

### The peer-to-peer marketplace for EV home charging, with an AI agent you can actually trust with your money

*Power up at home, anywhere.*

**PayPal AI Hackathon 2026** · Built by **Nandini A Choukimath** & **Shaleen Shukla**

[**🌐 Live demo**](https://chargenest-swbe.onrender.com) · [**🎬 Demo video**](https://youtube.com/your-demo-video) · [**📊 Pitch deck**](presentation/ChargeNest_Hackathon_Presentation.html) · [**📄 One-page summary**](presentation/ONE_PAGE_SUMMARY.md)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![PayPal](https://img.shields.io/badge/PayPal-6%20APIs-003087?logo=paypal&logoColor=white)
![Tests](https://img.shields.io/badge/tests-131%20passing-22c55e)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## 📌 TL;DR for judges

| | |
|---|---|
| **Problem** | ~70% of city EV owners can't install a home charger, while ~80% of existing home chargers sit idle most of the day. |
| **Solution** | An "Airbnb for EV charging": drivers book a neighbour's charger by the hour, hosts earn from idle capacity. |
| **The AI twist** | A tool-calling **AI Concierge** books, cancels, tops up, raises disputes and sends invoices, wrapped in a **Know Your Agent (KYA)** safety layer that enforces limits **in code, not in the prompt**. |
| **The PayPal twist** | **6 PayPal APIs** power a full money loop: wallet top-up → hold → device-verified settlement → host payout → withdrawals, plus invoicing and disputes. |
| **Status** | A working product, not a mock-up. Live on Render, ~31k lines of code, 85+ API endpoints, 131 automated tests. |

**Try it in 30 seconds:** open the [live demo](https://chargenest-swbe.onrender.com), log in as `client@demo.com` / `Demo123!`, open **AI Concierge** and type *"Find me the fastest charger near Koramangala"*.

> The free Render instance sleeps when idle, so the first load can take ~30–50 seconds.

---

## 🏆 What makes ChargeNest different

### 1. 🛡 Know Your Agent (KYA): agentic commerce with guard rails
Most AI demos let the model decide what it is allowed to do. ChargeNest does not.

- **Every agent has its own Ed25519 identity.** Each action it takes is **signed** and written to an audit log.
- **5 autonomy levels** chosen by the owner, plus per-action on/off switches and a spending limit.
- **Policy is enforced in code** (`agentPolicy.js`) *before* any tool runs. The model never sees tools for a role you don't have, and a forbidden call is refused again at execution time.
- **Risky actions pause for approval.** The agent proposes; you approve in the chat. **Damage invoices always need approval, at every level**, and are rate-limited per day.

| Level | Name | What the agent may do |
|:-:|---|---|
| 0 | Off | Nothing |
| 1 | Inform only | Search, compare, recommend, answer |
| 2 | Ask first *(default)* | Book, cancel, report, but only after you approve |
| 3 | Act & report | Book and cancel within budget, then tell you |
| 4 | Full autonomy | Also top up and handle disputes, within limits |

### 2. 🎯 Deterministic recommendations, explained by AI
Ask *"Which charger is fastest near me?"* and `rankChargers()` scores nearby chargers on **power, distance, rating and price**, weighted by your priority (`fastest`, `nearest`, `cheapest`, `best_rated`, `balanced`). **Code picks the top 3; the model only explains them**, so the same question always gives the same answer. Place names like *"Yeshwantpur"* are resolved to real coordinates with OpenStreetMap, never invented.

### 3. 💳 A complete PayPal money loop (6 APIs)

```mermaid
flowchart LR
    A[Driver tops up<br/>Orders v2] --> B[Wallet ledger<br/>booking amount HELD]
    B --> C{Session verified?}
    C -- success --> D[Driver charged for time used<br/>unused time refunded]
    D --> E[Host credited<br/>minus 7% fee]
    E --> F[Withdraw<br/>Payouts API]
    C -- failed --> G[Full refund<br/>booking cancelled]
    H[Host damage claim<br/>Invoicing v2] -.-> B
    I[Buyer dispute<br/>Disputes API + Webhooks] -.-> B
```

| PayPal API | Used for |
|---|---|
| **Orders v2** | Wallet top-ups (PayPal checkout) |
| **Payments v2** | Authorizations, captures and refunds |
| **Payouts** | Withdraw wallet balance to any PayPal account (hosts *and* drivers) |
| **Invoicing v2** | Host damage invoices (agent-assisted, always owner-approved) |
| **Customer Disputes** | Import buyer disputes, accept claims, send messages |
| **Webhooks** | Signature-verified payment, invoice and dispute events |

A **$50 damage deposit** stays locked in every wallet as a trust mechanism; anything above it is spendable.

### 4. 🔌 Device-verified sessions: no "he said, she said"
Payouts hinge on one question: *did the session really happen?* Charger hardware (ESP32 + relay + meter) sends **HMAC-SHA256-signed** events (`unlocked → meter → ended`) with a rising counter, so replays and fake stations are rejected. The backend decides the outcome automatically:

| Outcome | When | Money |
|---|---|---|
| ✅ `success` | Unlocked, ran long enough, real energy measured | Pay for time used, refund the rest, credit host |
| ❌ `no_unlock` | Booked time passed, charger never unlocked | Full refund |
| ❌ `too_short` | Session shorter than the minimum | Full refund |
| ❌ `meter_anomaly` | Long session but ~zero energy | Full refund |

An optional **payout delay** gives drivers a window to dispute before the host is paid. A built-in device simulator exercises all scenarios today; real hardware only replaces the sender.

### 5. ⚖ AI dispute resolution with a human in the loop
Drivers report an issue; the AI reviews the booking, the session evidence and the audit trail. **At 95%+ confidence it resolves automatically; below that, an admin decides.** Hosts don't open disputes. They send a PayPal damage invoice instead.

---

## ✨ Feature tour

<table>
<tr>
<td valign="top" width="33%">

### 🚗 Drivers
- Interactive map search with filters (connector, kW, price, amenities) and browser location
- AI Concierge: plain-English booking, cancelling, top-ups and disputes, with streamed replies and conversation memory
- Smart *fastest / nearest / cheapest* recommendations
- Wallet: PayPal top-up, live held / spendable balance, withdraw to PayPal
- Booking details, directions, cost breakdown
- Rate the charger after a completed session
- Disputes page with the AI review and final decision

</td>
<td valign="top" width="33%">

### 🏠 Hosts
- List a charger in 3 steps, with up to 5 photos and map pin
- AI Pricing Advisor suggests a competitive rate
- Dashboard: bookings, earnings, this month, ratings
- Earnings land in the wallet after each verified session (minus 7%)
- Withdraw to PayPal
- Agent-assisted damage invoices (always approved by you)
- Rate drivers; see each driver's reputation before accepting

</td>
<td valign="top" width="33%">

### 🛠 Admins
- Platform dashboard and analytics (revenue, geography, usage)
- User management, verification, user detail view
- Charger moderation (block / unblock)
- Bookings, payments and disputes oversight
- Ratings moderation
- Full audit log of user **and agent** actions
- Platform settings

</td>
</tr>
</table>

**Everyone:** JWT + **TOTP MFA** (Google Authenticator) · role-based UI (driver, host, both, admin) · **dark mode** · larger-text accessibility option · friendly error messages · Terms, Privacy and Host Policy pages · Support page.

### ⭐ Two-way reviews with real checks
Only the **driver of a completed booking** can rate the charger, and only the **host of that charger** can rate the driver. Each side reviews once per booking, you can't review your own charger, and role checks run on the server. A charger's average rating updates automatically.

---

## 🧠 AI Concierge tools

The agent acts for one user, and only with the tools their role allows.

| Tool | Role | Needs approval? |
|---|---|---|
| `find_place`, `search_chargers`, `get_charger_details`, `estimate_cost`, `recommend_chargers` | Driver | No |
| `get_wallet`, `list_my_bookings`, `list_disputes`, `list_invoices`, `check_device_status` | Everyone | No |
| `create_booking` | Driver | Below level 3, or over the spending limit |
| `cancel_booking` | Driver | Below level 3 |
| `top_up_wallet` | Driver | Below level 4 (it only creates a PayPal link; you pay on PayPal) |
| `raise_dispute` | Everyone | Below level 4 |
| `create_damage_invoice` | Host | **Always**, plus a daily cap |

**Pluggable LLM, one env var:** `AI_PROVIDER = gemini | openrouter | openai | ollama | mock`. The `mock` provider needs no key, so the whole app runs offline for demos and tests.

**Example**

> **Driver:** I'm at 15% near Koramangala, need a charge by 6 PM, budget $40
>
> **Concierge:** I found 3 chargers. The best match is **Priya's Home Charger** (HSR Layout): 2.3 km away, 7.4 kW Type 2, ⭐ 4.8, **$26 for 2 hours**. Want me to book it?
>
> **Driver:** Yes
>
> **Concierge:** I've prepared the booking. Please approve the hold below. ✅

---

## 🏗 Architecture

```mermaid
flowchart TB
    subgraph Client["React SPA (Vite + Tailwind)"]
        UI[Pages: search, chat, wallet,<br/>host, admin] --> API[Axios client]
    end
    subgraph Server["Node.js + Express API"]
        R[Routes + Zod validation] --> S[Services]
        S --> AG[Agent + KYA policy]
        S --> PP[PayPal service]
        S --> DV[Device service]
        AG --> LLM[(LLM provider)]
    end
    API --> R
    S --> DB[(PostgreSQL<br/>Prisma ORM)]
    PP <--> PAY[PayPal REST APIs]
    HW[Charger hardware / simulator] -- signed events --> DV
    PAY -- webhooks --> R
    AG --> GEO[OpenStreetMap Nominatim]
```

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, Leaflet / OpenStreetMap, lazy-loaded routes |
| Backend | Node.js 20, Express, Prisma, Zod, Helmet, rate limiting |
| Database | PostgreSQL 15 (19 models, versioned migrations) |
| Auth | JWT access + refresh tokens, TOTP MFA (speakeasy), encrypted TOTP secrets |
| AI | OpenAI-compatible tool calling over Gemini / OpenRouter / OpenAI / Ollama, or a mock |
| Agent identity | Ed25519 signing keys, encrypted at rest |
| Payments | PayPal Orders v2, Payments v2, Payouts, Invoicing v2, Disputes, Webhooks |
| Deploy | Docker (single container: API + built SPA), Render Blueprint (`render.yaml`) |

---

## 🚀 Run it locally

### Prerequisites
Node.js 20+, Docker (for Postgres). PayPal sandbox keys and an AI key are **optional**: without them the app runs PayPal and the AI in mock mode.

### One command

```bash
git clone https://github.com/Runtime-Error3490/chargenest.git
cd chargenest
./start.sh          # starts Postgres in Docker, installs, migrates, seeds and runs everything
```

Then open **http://localhost:5173**.

| Script | What it does |
|---|---|
| `./start.sh` | Starts Postgres in Docker, then `./run.sh all` |
| `./run.sh all` | Installs, creates `.env` files, migrates, seeds, starts backend and frontend |
| `./run.sh test` | Runs the 131 backend tests |

<details>
<summary><b>Manual setup and environment variables</b></summary>

```bash
docker compose up -d postgres

cd backend
cp .env.example .env        # edit values as needed
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                 # API on :4000

cd ../frontend
npm install
npm run dev                 # app on :5173
```

Key backend variables (`backend/.env`):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ev_charging_marketplace
JWT_SECRET=...                 # 32+ chars
JWT_REFRESH_SECRET=...         # 32+ chars
TOTP_ENCRYPTION_KEY=...        # 32 chars
KYA_KEY_SECRET=...             # long random value

# PayPal sandbox (omit both to run in mock mode)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=...

# AI: gemini | openrouter | openai | ollama | mock
AI_PROVIDER=mock
AI_MODEL=
GEMINI_API_KEY=...

WALLET_DEPOSIT=50              # locked damage deposit (USD)
PLATFORM_FEE_PERCENT=7
DEVICE_MOCK=true               # device simulator (never on in production)
```

Frontend (`frontend/.env`): `VITE_API_URL=http://localhost:4000/api`

**Mock modes.** Without PayPal keys, top-ups, holds, invoices and disputes are simulated with dummy PayPal ids, and new wallets get a one-time demo credit (`WALLET_MOCK_CREDIT`). `PAYPAL_MOCK=true|false` forces it. Mock mode is never active when `NODE_ENV=production`.

</details>

<details>
<summary><b>Deploy to Render</b></summary>

`render.yaml` is a Blueprint for one Docker web service (API + built React app) plus a Postgres database.

1. Render → **New → Blueprint** → pick this repo.
2. Fill the secret values it asks for (PayPal keys, an AI key). JWT, TOTP and KYA secrets are generated for you.
3. `SEED_DEMO_DATA=true` loads the demo users on first start; set it to `false` afterwards.

The container runs `prisma migrate deploy` on start, so the database schema is always up to date. Uploaded charger photos need a persistent disk (paid plans) or object storage to survive redeploys.

</details>

---

## 🧪 Demo accounts

Seeded locally and on the live demo (`SEED_DEMO_DATA=true`):

| Role | Email | Password |
|---|---|---|
| Driver | `client@demo.com` | `Demo123!` |
| Host | `host@demo.com` | `Demo123!` |
| Driver + Host | `clienthost@demo.com` | `Demo123!` |
| Admin | `admin@evcharge.com` | `Demo123!` |

New sign-ups go through TOTP MFA setup with Google Authenticator. To test **real** PayPal flows, pay with a sandbox personal account from [developer.paypal.com](https://developer.paypal.com) (Testing Tools → Sandbox Accounts), and save that account's email on the Wallet page before withdrawing.

---

## 🎬 3-minute demo walkthrough

1. **Problem** (20s): idle home chargers vs. drivers with nowhere to charge.
2. **Driver asks the Concierge** for the fastest charger near a named place → real lookup, ranked top 3, explained.
3. **KYA in action:** the agent wants to spend money, so it **stops and asks**. Show autonomy levels, limits and the signed audit trail.
4. **PayPal:** wallet top-up via PayPal checkout; booking amount held.
5. **Device-verified session:** simulator sends signed events → success → unused time refunded, host credited minus 7%.
6. **Host withdraws** earnings to PayPal with Payouts.
7. **Something goes wrong:** driver reports an issue, AI reviews with confidence score; host sends an approved damage invoice.
8. **Polish:** dashboards, dark mode, accessibility, 131 tests, live on Render.

---

## ✅ Quality

- **131 automated tests** (`node --test`): agent policy, KYA signing, AI providers and streaming, PayPal real + mock, wallet maths, booking lifecycle, device outcomes, pricing, recommendation ranking, geocoding.
- **Server-side validation** on every write (Zod), with friendly field-level messages in the UI.
- **Security:** Helmet, CORS, rate limiting, MFA, encrypted secrets at rest, HMAC-signed device events with replay protection, signature-verified PayPal webhooks, full audit log.
- **Versioned database migrations** applied automatically on deploy.

```bash
cd backend && npm test
```

---

## 📁 Project structure

```
chargenest/
├── backend/
│   ├── src/
│   │   ├── routes/          # 12 Express routers (auth, chargers, bookings, payments, agent, device, admin, ...)
│   │   ├── services/        # Business logic: agent, agentPolicy (KYA), kya, paypal, wallet, device, dispute, ...
│   │   │   └── ai/          # Pluggable LLM providers (OpenAI-compatible + mock)
│   │   ├── middleware/      # Auth, validation, errors, logging
│   │   └── config/
│   ├── prisma/              # schema.prisma, migrations, seed
│   └── tests/               # 131 node:test tests
├── frontend/
│   └── src/
│       ├── pages/           # Driver, host, admin, auth, legal pages
│       ├── components/      # UI kit + layout
│       ├── services/        # API clients
│       └── store/           # Zustand auth store
├── docs/                    # HLD, LLD, decisions, issues & solutions, future scope
├── presentation/            # Pitch deck, one-pager, speaker notes
├── Dockerfile               # Single-container build (API + SPA)
└── render.yaml              # Render Blueprint (web service + Postgres)
```

### 📚 Documentation

| Doc | What's inside |
|---|---|
| [HLD](docs/HLD.md) | High-level design |
| [LLD](docs/LLD.md) | Database schema and API design |
| [DECISIONS](docs/DECISIONS.md) | Every product and technical decision: payments, sessions, agent tools |
| [ISSUES_AND_SOLUTIONS](docs/ISSUES_AND_SOLUTIONS.md) | Bugs we hit and how we fixed them |
| [FUTURE_SCOPE](docs/FUTURE_SCOPE.md) | Detailed roadmap |
| [HACKATHON_RESEARCH](docs/HACKATHON_RESEARCH.md) | Requirements and gap analysis |

---

## 🔗 Key API endpoints

<details>
<summary>Show endpoints (85+ in total)</summary>

| Area | Endpoints |
|---|---|
| **Auth** | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/verify-mfa` · `POST /api/auth/refresh` · `GET /api/auth/me` |
| **Chargers** | `GET /api/chargers` · `GET /api/chargers/:id` · `POST /api/chargers` · `POST /api/chargers/photos` |
| **Bookings** | `POST /api/bookings` · `GET /api/bookings/:id` · `POST /api/bookings/:id/cancel` · `POST /api/bookings/:id/review` |
| **Sessions** | `POST /api/sessions/:id/start` · `POST /api/sessions/:id/end` |
| **Wallet & PayPal** | `GET /api/payments/wallet` · `POST /api/payments/wallet/topup` (+ `/capture`) · `POST /api/payments/wallet/withdraw` · `GET/POST /api/payments/invoices` |
| **Agent (KYA)** | `POST /api/agent/chat` (+ `/stream`) · `GET /api/agent/identity` · `GET/PUT /api/agent/settings` · `GET /api/agent/approvals` · `POST /api/agent/approvals/:id/respond` · `POST/DELETE /api/agent/mandates` |
| **Device** | `POST /api/device/register` · `POST /api/device/events` (HMAC-signed) · `POST /api/device/mock/simulate` |
| **Disputes** | `POST /api/disputes` · `GET /api/disputes` · `GET /api/disputes/:id` |
| **Webhooks** | `POST /api/webhooks/paypal` (signature-verified) |
| **Admin** | Dashboard, analytics, users, chargers, bookings, payments, disputes, ratings, audit logs, config |

</details>

---

## 🗺 Roadmap

| Phase | Status | Focus |
|---|:-:|---|
| **1. MVP** | ✅ Done | Marketplace, AI Concierge, KYA, PayPal wallet + payouts + invoicing + disputes, device-verified sessions, two-way reviews |
| **2. Verify** | ⏭ Next | Email / SMS notifications, email + phone verification, ID checks for hosts, trust scores |
| **3. Hardware** | 🔜 | ESP32 charger kit, QR unlock, OCPP support, percentage-based charging |
| **4. Scale** | 🔭 | Mobile apps, multi-city, fleet accounts, external agents via MCP, voice input |

---

## 👥 Team

| | Name | Role | GitHub |
|---|---|---|---|
| 👩‍💻 | **Nandini A Choukimath** | Co-founder & Developer | [@spacescribe](https://github.com/spacescribe) |
| 👨‍💻 | **Shaleen Shukla** | Co-founder & Developer | [@Runtime-Error3490](https://github.com/Runtime-Error3490) |

---

## 🙏 Acknowledgments

PayPal for the hackathon and sandbox APIs · Google Gemini, OpenRouter and OpenAI for LLM access · OpenStreetMap for maps and geocoding · Render for hosting.

## 📄 License

MIT. See [LICENSE](./LICENSE).

<div align="center">

**More home chargers means more people can own an EV.**<br/>
Passive income for hosts. Cheaper charging for drivers. A safe pattern for AI agents that handle money.

⚡ **Built for the PayPal AI Hackathon 2026** ⚡

</div>
