# High-Level Design (HLD)

**Project:** Peer-to-Peer EV Home-Charging Marketplace  
**Version:** 1.0  
**Date:** November 9, 2026

---

## 1. Executive Summary

A responsive web marketplace connecting EV drivers who need charging with homeowners/businesses who have idle charger capacity. The platform uses PayPal for the complete payment lifecycle and AI for intelligent booking, pricing, and dispute resolution.

---

## 2. System Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                  │
│    │   Driver     │     │    Host      │     │    Admin     │                  │
│    │   (Web)      │     │   (Web)      │     │   (Web)      │                  │
│    └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                  │
│           │                    │                    │                           │
│           └────────────────────┼────────────────────┘                           │
│                                │                                                 │
│                                ▼                                                 │
│                    ┌───────────────────────┐                                    │
│                    │   React Frontend      │                                    │
│                    │   (Vite + Leaflet)    │                                    │
│                    └───────────┬───────────┘                                    │
│                                │                                                 │
└────────────────────────────────┼────────────────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                    ┌───────────────────────┐                                    │
│                    │   Node.js Backend     │                                    │
│                    │   (Express.js)        │                                    │
│                    └───────────┬───────────┘                                    │
│                                │                                                 │
│          ┌─────────────────────┼─────────────────────┐                          │
│          │                     │                     │                          │
│          ▼                     ▼                     ▼                          │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                   │
│  │  Auth Module  │    │  Core API     │    │  AI Module    │                   │
│  │  (JWT + TOTP) │    │  (REST)       │    │  (OpenRouter) │                   │
│  └───────────────┘    └───────────────┘    └───────────────┘                   │
│                                │                     │                          │
│                                │                     │                          │
│          ┌─────────────────────┼─────────────────────┤                          │
│          │                     │                     │                          │
│          ▼                     ▼                     ▼                          │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                   │
│  │ PayPal Module │    │  KYA Module   │    │ Webhook       │                   │
│  │ (Orders API)  │    │ (Agent Auth)  │    │ Handler       │                   │
│  └───────┬───────┘    └───────────────┘    └───────┬───────┘                   │
│          │                                         │                            │
└──────────┼─────────────────────────────────────────┼────────────────────────────┘
           │                                         │
           ▼                                         │
┌─────────────────────┐                              │
│   PayPal Sandbox    │◄─────────────────────────────┘
│   - Orders v2       │         (Webhooks)
│   - Payouts         │
└─────────────────────┘

                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                    ┌───────────────────────┐                                    │
│                    │    PostgreSQL         │                                    │
│                    │    (Render)           │                                    │
│                    └───────────────────────┘                                    │
│                                                                                  │
│    Tables: users, user_roles, agents, mandates, chargers, availability,         │
│            bookings, sessions, disputes, payments, audit_log, ratings           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                  │
│    │  OpenRouter  │     │  OpenStreet  │     │   Render     │                  │
│    │  (LLM API)   │     │  Map (Tiles) │     │  (Hosting)   │                  │
│    └──────────────┘     └──────────────┘     └──────────────┘                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Overview

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Frontend | React (Vite) | UI, map display, PayPal buttons, chat interface |
| Backend | Node.js (Express) | REST API, business logic, AI orchestration |
| Database | PostgreSQL | Persistent storage for all entities |
| Auth Module | JWT + TOTP | User authentication, session management, MFA |
| PayPal Module | PayPal SDK | Orders, authorizations, captures, refunds, payouts |
| AI Module | OpenRouter | Concierge agent, dispute resolver, pricing advisor |
| KYA Module | Custom | Agent identity, mandate management, audit logging |
| Webhook Handler | Express routes | PayPal event processing |

---

## 3. Data Flow Diagrams

### 3.1 Booking Flow (Manual)

```
Driver                    Frontend                   Backend                    PayPal
  │                          │                          │                          │
  │  1. Search chargers      │                          │                          │
  │─────────────────────────>│                          │                          │
  │                          │  2. GET /chargers        │                          │
  │                          │─────────────────────────>│                          │
  │                          │  3. Charger list         │                          │
  │                          │<─────────────────────────│                          │
  │  4. Display results      │                          │                          │
  │<─────────────────────────│                          │                          │
  │                          │                          │                          │
  │  5. Select & book        │                          │                          │
  │─────────────────────────>│                          │                          │
  │                          │  6. POST /bookings       │                          │
  │                          │─────────────────────────>│                          │
  │                          │                          │  7. Create Order         │
  │                          │                          │  (intent=AUTHORIZE)      │
  │                          │                          │─────────────────────────>│
  │                          │                          │  8. Order ID             │
  │                          │                          │<─────────────────────────│
  │                          │  9. Order ID + Approve URL                          │
  │                          │<─────────────────────────│                          │
  │                          │                          │                          │
  │  10. PayPal Button       │                          │                          │
  │<─────────────────────────│                          │                          │
  │                          │                          │                          │
  │  11. Approve payment     │                          │                          │
  │─────────────────────────────────────────────────────────────────────────────>│
  │                          │                          │                          │
  │                          │                          │  12. Webhook: APPROVED   │
  │                          │                          │<─────────────────────────│
  │                          │                          │                          │
  │                          │                          │  13. Authorize           │
  │                          │                          │─────────────────────────>│
  │                          │                          │  14. Auth ID             │
  │                          │                          │<─────────────────────────│
  │                          │                          │                          │
  │  15. Booking confirmed   │                          │                          │
  │<─────────────────────────│<─────────────────────────│                          │
  │                          │                          │                          │
```

### 3.2 Booking Flow (AI Agent)

```
Driver                    Frontend                   Backend                    PayPal
  │                          │                          │                          │
  │  1. "Find charger        │                          │                          │
  │      near Koramangala,   │                          │                          │
  │      budget ₹500"        │                          │                          │
  │─────────────────────────>│                          │                          │
  │                          │  2. POST /agent/chat     │                          │
  │                          │     + mandate token      │                          │
  │                          │─────────────────────────>│                          │
  │                          │                          │                          │
  │                          │      ┌──────────────────────────────────────┐      │
  │                          │      │  KYA VERIFICATION                    │      │
  │                          │      │  - Validate mandate signature        │      │
  │                          │      │  - Check expiry                      │      │
  │                          │      │  - Check revocation                  │      │
  │                          │      │  - Verify spending cap               │      │
  │                          │      └──────────────────────────────────────┘      │
  │                          │                          │                          │
  │                          │      ┌──────────────────────────────────────┐      │
  │                          │      │  AI AGENT (LLM + Tools)              │      │
  │                          │      │  - search_chargers(location, kW)     │      │
  │                          │      │  - get_host_details(charger_id)      │      │
  │                          │      │  - estimate_cost(charger, duration)  │      │
  │                          │      │  - create_booking_hold(...)          │      │
  │                          │      └──────────────────────────────────────┘      │
  │                          │                          │                          │
  │                          │                          │  3. Create Order         │
  │                          │                          │─────────────────────────>│
  │                          │                          │  4. Order ID             │
  │                          │                          │<─────────────────────────│
  │                          │                          │                          │
  │                          │      ┌──────────────────────────────────────┐      │
  │                          │      │  AUDIT LOG                           │      │
  │                          │      │  - agent_id, mandate_id              │      │
  │                          │      │  - tools_called, inputs, outputs     │      │
  │                          │      │  - booking_id, order_id              │      │
  │                          │      └──────────────────────────────────────┘      │
  │                          │                          │                          │
  │                          │  5. Agent response +     │                          │
  │                          │     reasoning + Order ID │                          │
  │                          │<─────────────────────────│                          │
  │                          │                          │                          │
  │  6. "I found X charger   │                          │                          │
  │      because... Click    │                          │                          │
  │      to approve ₹Y"      │                          │                          │
  │<─────────────────────────│                          │                          │
  │                          │                          │                          │
  │  7. Approve payment      │                          │                          │
  │─────────────────────────────────────────────────────────────────────────────>│
  │                          │                          │                          │
```

### 3.3 Session & Capture Flow

```
Driver          Host            Frontend         Backend          PayPal
  │               │                 │                │                │
  │  1. Arrive at charger          │                │                │
  │───────────────>                │                │                │
  │               │                 │                │                │
  │  2. Confirm start              │                │                │
  │──────────────────────────────>│                │                │
  │               │                 │  3. POST      │                │
  │               │                 │  /sessions/start               │
  │               │                 │───────────────>                │
  │               │                 │                │                │
  │               │  4. Confirm start               │                │
  │               │────────────────>│               │                │
  │               │                 │  5. Update    │                │
  │               │                 │  session      │                │
  │               │                 │───────────────>                │
  │               │                 │                │                │
  │               │                 │                │                │
  │  ─ ─ ─ ─ ─ CHARGING SESSION ─ ─ ─ ─ ─          │                │
  │               │                 │                │                │
  │               │                 │                │                │
  │  6. Confirm end                │                │                │
  │──────────────────────────────>│                │                │
  │               │                 │  7. POST      │                │
  │               │                 │  /sessions/end│                │
  │               │                 │───────────────>                │
  │               │                 │                │  8. Capture   │
  │               │                 │                │  (actual amt) │
  │               │                 │                │───────────────>
  │               │                 │                │  9. Capture ID│
  │               │                 │                │<───────────────
  │               │                 │                │                │
  │               │                 │                │  10. Payout   │
  │               │                 │                │  (amt - 7%)   │
  │               │                 │                │───────────────>
  │               │                 │                │                │
  │               │                 │  11. Session  │                │
  │               │                 │  complete     │                │
  │               │                 │<───────────────                │
  │  12. Receipt  │                │                │                │
  │<──────────────────────────────│                │                │
  │               │  13. Payout    │                │                │
  │               │  notification  │                │                │
  │               │<───────────────│                │                │
  │               │                 │                │                │
```

### 3.4 Dispute Flow

```
Driver/Host         Frontend            Backend             AI Module          PayPal
    │                   │                   │                   │                 │
    │  1. Raise dispute │                   │                   │                 │
    │  with evidence    │                   │                   │                 │
    │──────────────────>│                   │                   │                 │
    │                   │  2. POST          │                   │                 │
    │                   │  /disputes        │                   │                 │
    │                   │──────────────────>│                   │                 │
    │                   │                   │                   │                 │
    │                   │                   │  3. Gather        │                 │
    │                   │                   │  evidence         │                 │
    │                   │                   │  - booking data   │                 │
    │                   │                   │  - session times  │                 │
    │                   │                   │  - audit log      │                 │
    │                   │                   │  - statements     │                 │
    │                   │                   │                   │                 │
    │                   │                   │  4. Analyze       │                 │
    │                   │                   │──────────────────>│                 │
    │                   │                   │                   │                 │
    │                   │                   │  5. Decision      │                 │
    │                   │                   │  {decision,       │                 │
    │                   │                   │   refund_amount,  │                 │
    │                   │                   │   reasoning,      │                 │
    │                   │                   │   confidence}     │                 │
    │                   │                   │<──────────────────│                 │
    │                   │                   │                   │                 │
    │                   │      ┌────────────┴────────────┐      │                 │
    │                   │      │                         │      │                 │
    │                   │      ▼                         ▼      │                 │
    │                   │  confidence ≥ 95%      confidence < 95%                 │
    │                   │      │                         │      │                 │
    │                   │      ▼                         ▼      │                 │
    │                   │  Auto-apply            Queue for      │                 │
    │                   │                        admin review   │                 │
    │                   │      │                         │      │                 │
    │                   │      └────────────┬────────────┘      │                 │
    │                   │                   │                   │                 │
    │                   │                   │  6. Execute       │                 │
    │                   │                   │  refund (if any)  │                 │
    │                   │                   │──────────────────────────────────>│
    │                   │                   │                   │                 │
    │  7. Resolution    │                   │                   │                 │
    │  notification     │                   │                   │                 │
    │<──────────────────│<──────────────────│                   │                 │
    │                   │                   │                   │                 │
```

---

## 4. Technology Stack Details

### 4.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | 5.x | Build tool |
| React Router | 6.x | Client-side routing |
| Leaflet | 1.9.x | Map rendering |
| React-Leaflet | 4.x | React bindings for Leaflet |
| Axios | 1.x | HTTP client |
| PayPal JS SDK | Latest | Payment buttons |
| Tailwind CSS | 3.x | Styling |
| React Hook Form | 7.x | Form handling |
| Zustand | 4.x | State management |

### 4.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| Express | 4.x | Web framework |
| PostgreSQL | 15.x | Database |
| Prisma | 5.x | ORM |
| jsonwebtoken | 9.x | JWT handling |
| speakeasy | 2.x | TOTP generation/verification |
| qrcode | 1.x | QR code for authenticator setup |
| @paypal/checkout-server-sdk | Latest | PayPal integration |
| openai | 4.x | OpenRouter client (OpenAI-compatible) |
| zod | 3.x | Schema validation |
| helmet | 7.x | Security headers |
| cors | 2.x | CORS handling |

### 4.3 Infrastructure

| Service | Purpose | Tier |
|---------|---------|------|
| Render | Backend hosting | Free/Starter |
| Render | PostgreSQL | Free (90-day) |
| Render | Static site (Frontend) | Free |
| OpenRouter | LLM API | Pay-per-use |
| PayPal Sandbox | Payments | Free |

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. REGISTRATION                                                 │
│     User signs up → Password hashed (bcrypt) → Store in DB      │
│     → Generate TOTP secret → Show QR code → User scans          │
│                                                                  │
│  2. LOGIN (Step 1: Credentials)                                  │
│     Email + Password → Verify hash → Return temp token          │
│                                                                  │
│  3. LOGIN (Step 2: MFA)                                          │
│     Temp token + TOTP code → Verify TOTP → Issue JWT            │
│                                                                  │
│  4. AUTHENTICATED REQUESTS                                       │
│     JWT in Authorization header → Verify signature → Extract     │
│     user_id → Attach to request → Process                       │
│                                                                  │
│  5. TOKEN REFRESH                                                │
│     Refresh token → Verify → Issue new access token             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

JWT Structure:
{
  "sub": "user_id",
  "roles": ["driver", "host"],
  "iat": 1699500000,
  "exp": 1699586400  // 24 hours
}
```

### 5.2 KYA (Know Your Agent) Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    KYA LAYER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Agent Registry │    │  Mandate Store  │                     │
│  │  (agents table) │    │ (mandates table)│                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           └──────────┬───────────┘                               │
│                      │                                           │
│                      ▼                                           │
│           ┌─────────────────────┐                               │
│           │  KYA Verification   │                               │
│           │  Service            │                               │
│           └─────────┬───────────┘                               │
│                     │                                            │
│    ┌────────────────┼────────────────┐                          │
│    │                │                │                          │
│    ▼                ▼                ▼                          │
│ ┌──────────┐  ┌──────────┐  ┌──────────────┐                   │
│ │ Verify   │  │ Check    │  │ Enforce      │                   │
│ │ Signature│  │ Limits   │  │ Constraints  │                   │
│ └──────────┘  └──────────┘  └──────────────┘                   │
│                                                                  │
│ Mandate Token (JWT):                                             │
│ {                                                                │
│   "mandate_id": "uuid",                                         │
│   "agent_id": "uuid",                                           │
│   "user_id": "uuid",                                            │
│   "constraints": {                                              │
│     "max_amount": 1000,                                         │
│     "currency": "INR",                                          │
│     "max_distance_km": 10,                                      │
│     "connector_types": ["Type2", "CCS2"],                       │
│     "expires_at": "2026-11-10T00:00:00Z"                        │
│   },                                                             │
│   "iat": 1699500000,                                            │
│   "exp": 1699586400                                             │
│ }                                                                │
│                                                                  │
│ Audit Log Entry:                                                 │
│ {                                                                │
│   "id": "uuid",                                                 │
│   "agent_id": "uuid",                                           │
│   "mandate_id": "uuid",                                         │
│   "action": "create_booking_hold",                              │
│   "inputs": {...},                                              │
│   "outputs": {...},                                             │
│   "timestamp": "2026-11-09T10:00:00Z"                           │
│ }                                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API Design Overview

### 6.1 API Groups

| Group | Base Path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth` | Registration, login, MFA, token refresh |
| Users | `/api/users` | Profile management, role switching |
| Chargers | `/api/chargers` | CRUD for charger listings |
| Bookings | `/api/bookings` | Create, view, cancel bookings |
| Sessions | `/api/sessions` | Start, end charging sessions |
| Payments | `/api/payments` | Payment status, history |
| Disputes | `/api/disputes` | Raise, view, resolve disputes |
| Agent | `/api/agent` | Chat endpoint, mandate management |
| Admin | `/api/admin` | Dispute queue, user management |
| Webhooks | `/api/webhooks` | PayPal webhook handler |

### 6.2 Key Endpoints

```
Auth:
  POST   /api/auth/register          - Create account
  POST   /api/auth/login             - Login (returns temp token)
  POST   /api/auth/verify-mfa        - Verify TOTP (returns JWT)
  POST   /api/auth/refresh           - Refresh access token
  POST   /api/auth/setup-mfa         - Get QR code for authenticator

Chargers:
  GET    /api/chargers               - Search/list chargers
  GET    /api/chargers/:id           - Get charger details
  POST   /api/chargers               - Create listing (host)
  PUT    /api/chargers/:id           - Update listing (host)
  DELETE /api/chargers/:id           - Delete listing (host)
  GET    /api/chargers/:id/availability - Get availability slots

Bookings:
  GET    /api/bookings               - List user's bookings
  POST   /api/bookings               - Create booking (with PayPal auth)
  GET    /api/bookings/:id           - Get booking details
  POST   /api/bookings/:id/cancel    - Cancel booking

Sessions:
  POST   /api/sessions/:bookingId/start  - Start session
  POST   /api/sessions/:bookingId/end    - End session (triggers capture)

Agent:
  POST   /api/agent/chat             - Send message to concierge
  GET    /api/agent/mandates         - List user's mandates
  POST   /api/agent/mandates         - Create new mandate
  DELETE /api/agent/mandates/:id     - Revoke mandate
  GET    /api/agent/activity         - View agent activity log

Disputes:
  GET    /api/disputes               - List user's disputes
  POST   /api/disputes               - Raise dispute
  GET    /api/disputes/:id           - Get dispute details

Webhooks:
  POST   /api/webhooks/paypal        - PayPal event handler
```

---

## 7. AI Integration Architecture

### 7.1 AI Module Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI MODULE                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    LLM Client                            │    │
│  │  - Provider: OpenRouter                                  │    │
│  │  - Model: gpt-3.5-turbo / claude-3-haiku                │    │
│  │  - Timeout: 30s                                          │    │
│  │  - Retries: 2                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  Concierge  │     │  Dispute    │     │  Pricing    │       │
│  │  Agent      │     │  Resolver   │     │  Advisor    │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                    │                    │             │
│         │                    │                    │             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ Tools:      │     │ Input:      │     │ Input:      │       │
│  │ - search_   │     │ - booking   │     │ - kW tier   │       │
│  │   chargers  │     │ - session   │     │ - location  │       │
│  │ - get_host_ │     │ - audit_log │     │ - time      │       │
│  │   details   │     │ - statements│     │             │       │
│  │ - estimate_ │     │             │     │ Output:     │       │
│  │   cost      │     │ Output:     │     │ - baseline  │       │
│  │ - create_   │     │ - decision  │     │ - suggested │       │
│  │   booking_  │     │ - amount    │     │ - reasoning │       │
│  │   hold      │     │ - reasoning │     │             │       │
│  │             │     │ - confidence│     │             │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Tool Definitions

```typescript
// Concierge Agent Tools

search_chargers: {
  description: "Search for available chargers near a location",
  parameters: {
    latitude: number,
    longitude: number,
    radius_km: number,
    connector_type?: string[],
    min_kw?: number,
    available_from?: datetime,
    available_to?: datetime
  },
  returns: Charger[]
}

get_host_details: {
  description: "Get detailed information about a charger and its host",
  parameters: {
    charger_id: string
  },
  returns: { charger: Charger, host: HostProfile, ratings: Rating[] }
}

estimate_cost: {
  description: "Calculate estimated cost for a charging session",
  parameters: {
    charger_id: string,
    duration_minutes: number
  },
  returns: { amount: number, currency: string, breakdown: object }
}

create_booking_hold: {
  description: "Create a booking with payment authorization",
  parameters: {
    charger_id: string,
    start_time: datetime,
    duration_minutes: number
  },
  returns: { booking_id: string, order_id: string, amount: number }
}
```

---

## 8. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER DEPLOYMENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Render Platform                       │    │
│  │                                                          │    │
│  │   ┌─────────────┐    ┌─────────────┐    ┌───────────┐   │    │
│  │   │  Static     │    │  Web        │    │ PostgreSQL│   │    │
│  │   │  Site       │    │  Service    │    │           │   │    │
│  │   │  (Frontend) │    │  (Backend)  │    │           │   │    │
│  │   │             │    │             │    │           │   │    │
│  │   │  React      │───>│  Node.js    │───>│  Database │   │    │
│  │   │  Build      │    │  Express    │    │           │   │    │
│  │   │             │    │             │    │           │   │    │
│  │   └─────────────┘    └─────────────┘    └───────────┘   │    │
│  │         │                   │                            │    │
│  │         │                   │                            │    │
│  │   https://app.     https://api.                         │    │
│  │   evcharge.        evcharge.                            │    │
│  │   onrender.com     onrender.com                         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Environment Variables:                                          │
│  - DATABASE_URL (auto-injected)                                 │
│  - PAYPAL_CLIENT_ID                                             │
│  - PAYPAL_CLIENT_SECRET                                         │
│  - OPENROUTER_API_KEY                                           │
│  - JWT_SECRET                                                   │
│  - JWT_REFRESH_SECRET                                           │
│  - TOTP_SECRET_ENCRYPTION_KEY                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Monitoring & Logging

### 9.1 Logging Strategy

| Log Type | Content | Retention |
|----------|---------|-----------|
| Request logs | Method, path, status, duration | 7 days |
| Auth logs | Login attempts, MFA failures | 30 days |
| Payment logs | PayPal interactions, amounts | 90 days |
| Agent logs | Tool calls, inputs, outputs | 90 days |
| Error logs | Stack traces, context | 30 days |

### 9.2 Key Metrics (Roadmap)

- API response times
- Payment success/failure rates
- AI agent success rate
- Dispute resolution time
- User activation funnel

---

## 10. Appendix

### 10.1 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Auth
JWT_SECRET=<random-256-bit>
JWT_REFRESH_SECRET=<random-256-bit>
JWT_EXPIRY=24h
TOTP_SECRET_ENCRYPTION_KEY=<random-256-bit>

# PayPal Sandbox
PAYPAL_CLIENT_ID=<sandbox-client-id>
PAYPAL_CLIENT_SECRET=<sandbox-client-secret>
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=<webhook-id>

# AI
OPENROUTER_API_KEY=<api-key>
OPENROUTER_MODEL=openai/gpt-3.5-turbo
AI_TEMPERATURE=0
AI_TIMEOUT_MS=30000

# App
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://app.evcharge.onrender.com
PLATFORM_FEE_PERCENT=7
```

### 10.2 Related Documents

- [DECISIONS.md](./DECISIONS.md) - All project decisions
- [LLD.md](./LLD.md) - Low-Level Design (database schema, API specs)
- [API.md](./API.md) - Detailed API documentation
- [DATABASE.md](./DATABASE.md) - Database schema and migrations
