# ⚡ ChargeNest - EV Home-Charging Marketplace

> **ChargeNest** - The peer-to-peer marketplace connecting EV drivers with homeowners who have idle charger capacity. *Power up at home, anywhere.*

**PayPal AI Hackathon Submission**  
**Team:** Nandini A Choukimath & Shaleen Shukla

---

## 🎯 Problem

EV adoption in India is rising, but many owners (apartment dwellers, renters) cannot install a home charger, and public charging infrastructure is sparse. Meanwhile, many homeowners and small businesses have idle charger capacity.

## 💡 Solution

ChargeNest is a web marketplace that connects them — think "Airbnb for EV charging" with:
- **AI-powered booking concierge** that finds and books chargers within your budget
- **Know Your Agent (KYA)** safety layer for agentic commerce
- **PayPal** for secure authorize → capture → payout payment flow
- **AI dispute resolution** for fair conflict handling

---

## ✨ Features

### For Drivers
- 🗺️ Search chargers on an interactive map
- 🤖 AI Concierge: "Find me a charger near Koramangala, budget ₹500"
- 🎯 Smart recommendations: "Which charger is fastest near me?" ranks by power, distance, rating and price
- ❌ Ask the agent to cancel a booking, raise a dispute, or make a wallet top-up link
- 💳 Secure PayPal payments with authorization holds
- 📊 Spending mandates for agent control
- ⭐ Rate chargers after sessions

### For Hosts
- 📝 List your charger with time-based packages
- 💰 AI Pricing Advisor suggests competitive rates
- 📈 Dashboard with bookings and earnings
- 💸 Automatic PayPal payouts (minus 7% platform fee)
- 🧾 Ask the agent to send a damage invoice (you approve every time)
- ⭐ Rate drivers for community trust

### AI Features
1. **Charging Concierge Agent** — Natural language booking, cancelling, disputes, wallet and invoice help, with role-based tools, per-action permissions and owner approval for risky actions. Details: `docs/DECISIONS.md`
2. **Dispute Resolver** — Analyzes evidence and recommends fair resolutions
3. **Pricing Advisor** — Suggests optimal pricing based on location and demand

### Security
- 🔐 JWT authentication with TOTP MFA (Google Authenticator)
- 🛡️ KYA (Know Your Agent) layer with signed mandates
- 📋 Complete audit trail for agent actions

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite), Tailwind CSS, Leaflet/OpenStreetMap |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | JWT + TOTP (speakeasy) |
| AI | Pluggable: Gemini, OpenRouter, OpenAI, Ollama or a mock |
| Payments | PayPal Orders v2, Payouts |
| Hosting | Render |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- PayPal Sandbox Account
- An AI API key (a free Gemini key works), or use the mock provider

### 1. Clone the repository
```bash
git clone https://github.com/your-repo/ev-charging-marketplace.git
cd ev-charging-marketplace
```

### 2. Set up environment variables

**Backend** (`backend/.env`):
```env
# Database (matches docker-compose.yml)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ev_charging_marketplace

# Auth
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
TOTP_ENCRYPTION_KEY=your-totp-encryption-key-32-chars

# PayPal Sandbox
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your-webhook-id

# Wallet: balance needed before booking or listing, and the part of it kept as a damage deposit
WALLET_MIN_BALANCE=500
WALLET_DEPOSIT=250

# AI provider: gemini | openrouter | openai | ollama | mock (mock needs no key)
AI_PROVIDER=mock
# Model for whichever provider is chosen (e.g. gemini-3.1-flash-lite)
AI_MODEL=
GEMINI_API_KEY=your-gemini-api-key
# Streamed concierge replies; false turns off POST /api/agent/chat/stream
AI_STREAMING=true

# Know Your Agent: encrypts agent signing keys at rest
KYA_KEY_SECRET=a-long-random-value

# App
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
PLATFORM_FEE_PERCENT=7
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:4000/api
```

### 3. Set up database
```bash
cd backend
npm install
npx prisma migrate deploy
npm run db:seed
```
The seed funds the demo wallets above the minimum balance, so booking works straight away.

### 4. Start the servers

**Option A: Use the run script (recommended)**
```bash
./start.sh        # starts Postgres in Docker, then runs: ./run.sh all
./run.sh all      # install, env files, migrate, seed, start (Postgres already running)
./run.sh test     # backend tests
```
`./run.sh` creates `backend/.env` with `AI_PROVIDER=mock` so the app starts without keys.
Without PayPal credentials the backend runs PayPal in **mock mode**: top-ups, booking holds,
invoices and disputes are simulated with dummy PayPal ids and accept the amounts you enter, and the
wallet page shows a "mock mode" notice. Add sandbox `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
to `backend/.env` to use the real PayPal sandbox. `PAYPAL_MOCK=true` forces mock mode, `false`
forces it off. Mock mode is never active when `NODE_ENV=production`.
In mock mode a wallet that has never been used gets a one-time demo credit (`WALLET_MOCK_CREDIT`,
default 1000, `0` turns it off), so the wallet page has data to show.

**Run with the real PayPal sandbox**
1. Create a REST app at developer.paypal.com (Sandbox) and copy its client ID and secret.
2. Put them in `backend/.env`: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`,
   `PAYPAL_API_URL=https://api-m.sandbox.paypal.com`. Add `PAYPAL_WEBHOOK_ID` if you use webhooks.
3. Restart the backend. The wallet page no longer shows the "mock mode" notice.
4. Pay with a sandbox buyer account. Set the minimum balance with `WALLET_MIN_BALANCE`.

**Switch the AI provider** (no code change): set `AI_PROVIDER` to `gemini`, `openrouter`, `openai`,
`ollama` or `mock`, and `AI_MODEL` (one model setting for any provider). Set the provider's key:
`GEMINI_API_KEY` (free key from Google AI Studio), `OPENROUTER_API_KEY` or `OPENAI_API_KEY`.
Concierge replies stream to the chat page. Set `AI_STREAMING=false` (backend) or
`VITE_AI_STREAMING=false` (frontend) to switch that off.

**Host on Render:** `render.yaml` is a Blueprint for the Docker web service plus a Postgres database.
Render > New > Blueprint, pick the repo, then fill the secret values it asks for (PayPal keys, an AI key).
No site address setting is needed: PayPal return links and CORS use the address the browser called.
`FRONTEND_URL` is only an override. `SEED_DEMO_DATA=true` loads the demo users on start; set it to
`false` after the first deploy. The device mock is always off in production.

`./setup.sh` is an alternative that uses its own database name (`evcharge`).

**Option B: Manual start**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Open the app
Navigate to `http://localhost:5173`

---

## 🧪 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | demo_driver@example.com | REDACTED_PASSWORD |
| Host | demo_host@example.com | REDACTED_PASSWORD |
| Client+Host | clientdemo_host@example.com | REDACTED_PASSWORD |
| Admin | demo_admin@example.com | REDACTED_PASSWORD |

**PayPal Sandbox Buyer:** `sb-buyer@personal.example.com`  
**PayPal Sandbox Seller:** `sb-seller@business.example.com`

---

## 🔄 Payment Flow

```
1. Sign up → add the minimum balance (500) with PayPal. 250 stays as a damage deposit, the rest is spendable
2. Driver books → the booking amount is held from the wallet balance
3. Session starts → Both parties confirm
4. Session ends → Held funds are released to the host's wallet (minus 7% fee)
5. Damage? → Host sends a PayPal invoice, or a PayPal dispute is raised
6. Cash out → Host withdraws to PayPal. "Close wallet" returns the deposit too
```

All money sits in one PayPal sandbox business account (the demo escrow). The wallet is a ledger on top of it. Full design, limits and the Commerce Platform note: [docs/DECISIONS.md](docs/DECISIONS.md#payment-architecture-nov-10-2026).

---

## 🤖 AI Concierge Demo

**User:** "I'm at 15% battery near Koramangala, need a charge by 6 PM, max ₹500"

**Agent:**
> I found 3 chargers. I recommend **Priya's Home Charger** in HSR Layout:
> - 📍 2.3 km away
> - 💰 ₹260 for 2 hours (within budget)
> - ⭐ 4.8 rating (45 bookings)
> - ⚡ 7.4kW Type2 — expect ~30% charge gain
>
> Shall I book this for you?

**User:** "Yes, book it"

**Agent:** ✅ Booking created. Please approve the ₹278.20 payment hold.

---

## 📁 Project Structure

```
ev-charging-marketplace/
├── docs/
│   ├── DECISIONS.md        # All project decisions
│   ├── HLD.md              # High-Level Design
│   └── LLD.md              # Low-Level Design (DB schema, APIs)
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API clients
│   │   ├── store/          # Zustand state
│   │   └── utils/          # Helper functions
│   └── ...
├── backend/
│   ├── src/
│   │   ├── routes/         # Express routes
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Prisma models
│   │   ├── middleware/     # Auth, validation
│   │   └── utils/          # Helpers
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── ...
└── README.md
```

---

## 🔗 API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login (returns temp token)
- `POST /api/auth/verify-mfa` — Verify TOTP
- `POST /api/auth/refresh` — Refresh token

### Chargers
- `GET /api/chargers` — Search chargers
- `POST /api/chargers` — Create listing (host)
- `GET /api/chargers/:id` — Get details

### Wallet and invoices
- `GET /api/payments/wallet` — Balance, held funds, deposit status
- `POST /api/payments/wallet/topup` — Create PayPal order (then `/topup/capture`)
- `GET /api/payments/invoices`, `POST /api/payments/invoices` — PayPal invoices

### Bookings
- `POST /api/bookings` — Create booking
- `POST /api/bookings/:id/cancel` — Cancel

### Sessions
- `POST /api/sessions/:id/start` — Confirm start
- `POST /api/sessions/:id/end` — End session

### Agent
- `POST /api/agent/chat` — Chat with concierge
- `GET /api/agent/identity` — KYA identity card
- `GET/PUT /api/agent/settings` — Autonomy level and per-action permissions
- `GET /api/agent/approvals`, `POST /api/agent/approvals/:id/respond` — Confirm or deny agent actions
- `POST /api/agent/mandates` — Create mandate
- `DELETE /api/agent/mandates/:id` — Revoke mandate

### Disputes
- `POST /api/disputes` — Raise dispute
- `GET /api/disputes/:id` — Get status

---

## 🎬 Demo Video

[Watch on YouTube](https://youtube.com/your-demo-video) (< 3 minutes)

**Script:**
1. Problem statement (20s)
2. Host lists charger with AI price suggestion
3. Driver uses AI concierge with budget
4. Agent explains reasoning, driver approves
5. PayPal authorization completes
6. Session runs, actual amount captured
7. Dispute raised, AI resolves with refund
8. Impact and roadmap

---

## 🗺️ Roadmap

- [ ] Hardware metering integration (smart plugs)
- [ ] Percentage-based charging ("charge to 80%")
- [ ] Native mobile apps
- [ ] Society/apartment approval workflows
- [ ] External agent access via MCP server
- [ ] Voice input for concierge

---

## 👥 Team

| Name | Role | GitHub |
|------|------|--------|
| Nandini A Choukimath | Co-founder & Developer | [@nandini](https://github.com/spacescribe) |
| Shaleen Shukla | Co-founder & Developer | [@shaleen](https://github.com/Runtime-Error3490) |

---

## 📄 License

MIT License — see [LICENSE](./LICENSE)

---

## 🙏 Acknowledgments

- PayPal for the hackathon opportunity
- OpenRouter for LLM API access
- Render for hosting
- OpenStreetMap for map tiles

---

**Built with ⚡ for the PayPal AI Hackathon 2026**
