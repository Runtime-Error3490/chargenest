# ⚡ ChargeNest - EV Home-Charging Marketplace

> **ChargeNest** - The peer-to-peer marketplace connecting EV drivers with homeowners who have idle charger capacity. *Power up at home, anywhere.*

**PayPal AI Hackathon Submission**  
**Team:** Nandini A Choukimath & Shaleen Shukla

🌐 **Live Demo:** [chargenest-swbe.onrender.com](https://chargenest-swbe.onrender.com)

---

## 🧪 Testing Instructions (For Judges)

### Live Demo Access
Visit: **https://chargenest-swbe.onrender.com**

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Driver | `driver@chargenest.demo` | `ChargeNest2026!` |
| Host | `host@chargenest.demo` | `ChargeNest2026!` |
| Admin | `admin@chargenest.demo` | `ChargeNest2026!` |
| Driver+Host | `both@chargenest.demo` | `ChargeNest2026!` |

### Testing Flow
1. **As Driver:** Login → AI Chat → "Find me a charger near Koramangala" → Book → Check Wallet
2. **As Host:** Login → My Chargers → View Bookings → Check Earnings
3. **PayPal:** Uses sandbox mode (simulated payments work without real money)
4. **AI Concierge:** Try natural language queries like "Cancel my booking" or "Show my wallet balance"

### PayPal Sandbox
The app uses PayPal sandbox. No real money is involved. Wallet top-ups and withdrawals are simulated.

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
- 🎯 Smart recommendations: ranks by power, distance, rating and price using real geolocation
- ❌ Ask the agent to cancel a booking, raise a dispute, or make a wallet top-up link
- ⚖️ Disputes page with AI review and final decision
- 💳 Secure PayPal payments with authorization holds
- 🏧 Withdraw wallet balance to PayPal
- 📊 Spending mandates for agent control
- ⭐ Rate chargers after sessions

### For Hosts
- 📝 List your charger with time-based packages
- 💰 AI Pricing Advisor suggests competitive rates
- 📈 Dashboard with bookings and earnings
- 💸 93% earnings (7% platform fee), withdraw to PayPal
- 🧾 Ask the agent to send a damage invoice (approval required)
- ⭐ Rate drivers for community trust

### AI Features
1. **Charging Concierge Agent** — Natural language booking, cancelling, disputes, wallet and invoice help, with role-based tools, per-action permissions and owner approval for risky actions
2. **Dispute Resolver** — Analyzes evidence and recommends fair resolutions (95% confidence threshold)
3. **Pricing Advisor** — Suggests optimal pricing based on location and demand

### Security & Trust
- 🔐 JWT authentication with TOTP MFA (Google Authenticator)
- 🛡️ KYA (Know Your Agent) layer with 5 autonomy levels
- 📋 Complete audit trail for agent actions
- 💰 $50 damage deposit system for trust

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite), Tailwind CSS, Leaflet/OpenStreetMap |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | JWT + TOTP (speakeasy) |
| AI | Pluggable: Gemini, OpenRouter, OpenAI, Ollama or mock |
| Payments | PayPal Orders v2, Payouts, Invoicing |
| Hosting | Render |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or use Docker)
- PayPal Sandbox Account (optional - mock mode available)
- AI API key (optional - mock mode available)

### 1. Clone the repository
```bash
git clone https://github.com/your-repo/ev-charging-marketplace.git
cd ev-charging-marketplace
```

### 2. Set up environment variables

Copy the example files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env  # if exists
```

Edit `backend/.env` with your credentials. See `.env.example` for all options.

### 3. Start with the run script (recommended)
```bash
./start.sh        # starts Postgres in Docker, then runs setup
# OR
./run.sh all      # if Postgres is already running
```

The app starts in **mock mode** by default (no API keys needed):
- PayPal operations are simulated
- AI responses are scripted
- Demo wallets are pre-funded

### 4. Open the app
Navigate to `http://localhost:5173`

---

## 🔄 Payment Flow

```
1. Sign up → add wallet deposit ($50 minimum via PayPal)
2. Driver books → booking amount held from wallet
3. Session starts → Both parties confirm
4. Session ends → IoT telemetry verifies, host credited (minus 7% fee)
5. Damage? → Host sends PayPal invoice via agent
6. Withdraw → Transfer wallet balance to PayPal
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
│   ├── DECISIONS.md        # Architecture decisions
│   ├── HLD.md              # High-Level Design
│   └── LLD.md              # Low-Level Design
├── frontend/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Route pages
│       ├── hooks/          # Custom React hooks
│       └── services/       # API clients
├── backend/
│   └── src/
│       ├── routes/         # Express routes
│       ├── services/       # Business logic
│       └── middleware/     # Auth, validation
└── README.md
```

---

## 🔗 Key API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Auth | `POST /api/auth/register` | Create account |
| Auth | `POST /api/auth/login` | Login |
| Chargers | `GET /api/chargers` | Search chargers |
| Chargers | `POST /api/chargers` | Create listing |
| Wallet | `POST /api/payments/wallet/topup` | Add funds via PayPal |
| Wallet | `POST /api/payments/wallet/withdraw` | Withdraw to PayPal |
| Bookings | `POST /api/bookings` | Create booking |
| Agent | `POST /api/agent/chat` | Chat with concierge |
| Agent | `GET /api/agent/settings` | Autonomy settings |
| Disputes | `POST /api/disputes` | Raise dispute |

---

## 🗺️ Roadmap

### Phase 1 - Current (MVP) ✅
- Wallet deposit trust mechanism
- MFA with TOTP
- AI concierge with tool-calling
- PayPal integration (Orders, Payouts, Invoicing)
- Know Your Agent safety layer

### Phase 2 - User Verification
- Email verification with magic link
- Phone OTP verification
- Government ID verification for hosts

### Phase 3 - Platform Growth
- Hardware metering integration (smart plugs)
- Native mobile apps
- Voice input for concierge

### Phase 4 - Scale
- Multi-city expansion
- Fleet management for businesses
- Integration with vehicle APIs

---

## 👥 Team

| Name | Role | GitHub |
|------|------|--------|
| Nandini A Choukimath | Co-founder & Developer | [@spacescribe](https://github.com/spacescribe) |
| Shaleen Shukla | Co-founder & Developer | [@Runtime-Error3490](https://github.com/Runtime-Error3490) |

---

## 📄 License

MIT License — see [LICENSE](./LICENSE)

---

## 🙏 Acknowledgments

- PayPal for the hackathon opportunity
- Google for Gemini API
- Render for hosting
- OpenStreetMap for map tiles

---

**Built with ⚡ for the PayPal AI Hackathon 2026**
