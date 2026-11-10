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
- 💳 Secure PayPal payments with authorization holds
- 📊 Spending mandates for agent control
- ⭐ Rate chargers after sessions

### For Hosts
- 📝 List your charger with time-based packages
- 💰 AI Pricing Advisor suggests competitive rates
- 📈 Dashboard with bookings and earnings
- 💸 Automatic PayPal payouts (minus 7% platform fee)
- ⭐ Rate drivers for community trust

### AI Features
1. **Charging Concierge Agent** — Natural language booking with mandate enforcement
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
| AI | OpenRouter (GPT-3.5-turbo / Claude Haiku) |
| Payments | PayPal Orders v2, Payouts |
| Hosting | Render |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- PayPal Sandbox Account
- OpenRouter API Key

### 1. Clone the repository
```bash
git clone https://github.com/your-repo/ev-charging-marketplace.git
cd ev-charging-marketplace
```

### 2. Set up environment variables

**Backend** (`backend/.env`):
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/evcharge

# Auth
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
TOTP_ENCRYPTION_KEY=your-totp-encryption-key-32-chars

# PayPal Sandbox
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_MODE=sandbox

# AI
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-3.5-turbo

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
PLATFORM_FEE_PERCENT=7
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3001/api
VITE_PAYPAL_CLIENT_ID=your-sandbox-client-id
```

### 3. Set up database
```bash
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
```

### 4. Start the servers

**Option A: Use the setup script (recommended)**
```bash
./setup.sh
```

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
| Client | client@demo.com | Demo123! |
| Host | host@demo.com | Demo123! |
| Client+Host | clienthost@demo.com | Demo123! |
| Admin | admin@evcharge.com | Demo123! |

**PayPal Sandbox Buyer:** `sb-buyer@personal.example.com`  
**PayPal Sandbox Seller:** `sb-seller@business.example.com`

---

## 🔄 Payment Flow

```
1. Driver books → PayPal Order created (intent=AUTHORIZE)
2. Driver approves → Funds held (not charged)
3. Session starts → Both parties confirm
4. Session ends → Actual amount captured
5. Platform takes 7% → Host receives payout
6. Dispute? → AI analyzes → Refund if needed
```

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

### Bookings
- `POST /api/bookings` — Create booking
- `POST /api/bookings/:id/cancel` — Cancel

### Sessions
- `POST /api/sessions/:id/start` — Confirm start
- `POST /api/sessions/:id/end` — End session

### Agent
- `POST /api/agent/chat` — Chat with concierge
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
- [ ] UPI payments (India-specific)
- [ ] Native mobile apps
- [ ] Society/apartment approval workflows
- [ ] External agent access via MCP server
- [ ] Voice input for concierge

---

## 👥 Team

| Name | Role | GitHub |
|------|------|--------|
| Nandini A Choukimath | Co-founder & Developer | [@nandini](https://github.com/nandini) |
| Shaleen Shukla | Co-founder & Developer | [@shaleen](https://github.com/shaleen) |

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
