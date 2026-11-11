# Future Scope - ChargeNest

This document outlines planned features and improvements for future releases.

---

## 1. User Verification System

### Current State (MVP)
- **Admin-only verification**: Admins manually verify users through the admin portal
- **Wallet deposit as trust**: Users must fund wallet (₹500 min, ₹250 deposit) before booking or hosting
- **MFA enabled**: TOTP-based two-factor authentication via authenticator apps

### Planned Improvements

#### 1.1 Email Verification (Priority: High)
**Why**: Prevent fake accounts, ensure valid contact method

**Implementation**:
- Generate verification token on registration
- Send email with magic link (valid 24 hours)
- Verify endpoint to confirm email
- Block booking/hosting until email verified

**Tech Stack**:
- Nodemailer + SendGrid/AWS SES/Resend
- Token stored in DB with expiry

**Schema Changes**:
```prisma
model User {
  emailVerified    Boolean   @default(false)
  emailVerifiedAt  DateTime?
  emailVerifyToken String?   @unique
  emailVerifyExpiry DateTime?
}
```

#### 1.2 Phone OTP Verification (Priority: High for India)
**Why**: Critical for India market, enables SMS communication for bookings

**Implementation**:
- Send 6-digit OTP via SMS when user adds/updates phone
- OTP valid for 10 minutes, max 3 attempts
- Rate limit: 3 OTPs per hour per phone number

**Tech Stack Options**:
| Provider | Pros | Cons |
|----------|------|------|
| MSG91 | India-focused, good rates, DLT compliant | India only |
| Twilio | Global, reliable, good docs | Expensive for India |
| AWS SNS | Cheap, scalable | Complex setup |
| Gupshup | India-focused, WhatsApp too | Less documentation |

**Recommendation**: MSG91 for India-first launch

**Schema Changes**:
```prisma
model User {
  phoneVerified    Boolean   @default(false)
  phoneVerifiedAt  DateTime?
}

model PhoneOTP {
  id        String   @id @default(uuid())
  phone     String
  otp       String   // hashed
  attempts  Int      @default(0)
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([phone, expiresAt])
}
```

#### 1.3 Tiered Verification Levels (Priority: Medium)
**Why**: Different trust levels for different actions

**Levels**:
| Level | Requirements | Capabilities |
|-------|--------------|--------------|
| 0 - Registered | Account created | Browse chargers only |
| 1 - Email Verified | Email confirmed | Book as driver |
| 2 - Phone Verified | Email + Phone OTP | Become a host, higher booking limits |
| 3 - ID Verified | Email + Phone + Govt ID | Premium host badge, priority in search |

**Implementation**:
```javascript
// Middleware example
const requireVerificationLevel = (level) => (req, res, next) => {
  const userLevel = getUserVerificationLevel(req.user);
  if (userLevel < level) {
    return res.status(403).json({ 
      error: 'VERIFICATION_REQUIRED',
      requiredLevel: level,
      currentLevel: userLevel 
    });
  }
  next();
};

// Usage
router.post('/chargers', requireVerificationLevel(2), createCharger);
```

#### 1.4 Government ID Verification (Priority: Low - Phase 2)
**Why**: Higher trust for hosts, fraud prevention

**Documents Accepted** (India):
- Aadhaar Card
- PAN Card
- Driving License
- Voter ID

**Tech Stack Options**:
| Provider | Features | Pricing |
|----------|----------|---------|
| Digio | Aadhaar eKYC, eSign, India-focused | Pay per verification |
| Hyperverge | AI-based, face match, global | Enterprise pricing |
| Onfido | Global, comprehensive | Expensive |
| IDfy | India-focused, affordable | Pay per verification |

**Flow**:
1. User uploads ID photo
2. AI extracts details (name, DOB, ID number)
3. Face match with selfie (optional)
4. Manual review for edge cases
5. Store verification status (not the ID itself for privacy)

---

## 2. Communication Features

### 2.1 In-App Chat (Priority: Medium)
**Why**: Direct driver-host communication without sharing phone numbers

**Features**:
- Real-time messaging (WebSocket)
- Message history per booking
- Typing indicators
- Read receipts
- Image sharing for location help

**Tech Stack**: Socket.io or Pusher

### 2.2 Push Notifications (Priority: Medium)
**Why**: Booking updates, session reminders

**Channels**:
- Web push (service workers)
- Email notifications
- SMS for critical updates (booking confirmed, session starting)

### 2.3 WhatsApp Business Integration (Priority: Low)
**Why**: Popular in India, high engagement

**Use Cases**:
- Booking confirmations
- Session reminders
- Payment receipts

---

## 3. Payment Enhancements

### 3.1 UPI Integration (Priority: High for India)
**Why**: Most popular payment method in India

**Options**:
- Razorpay (UPI + cards)
- PhonePe Business
- Google Pay Business

### 3.2 Subscription Plans (Priority: Medium)
**Plans**:
- **Free**: Pay per session
- **Plus (₹299/mo)**: 5% fee instead of 7%, priority support
- **Pro (₹799/mo)**: 3% fee, analytics dashboard, API access

### 3.3 Corporate/Fleet Accounts (Priority: Low)
**Features**:
- Centralized billing
- Employee cards/limits
- Usage reports
- Bulk booking discounts

---

## 4. Hardware Integration

### 4.1 Smart Plug Integration (Priority: High)
**Why**: Automated session tracking, accurate billing

**Supported Devices**:
- WiFi smart plugs with energy monitoring
- Dedicated EV charger APIs (Wallbox, ChargePoint)
- Custom ESP32/Arduino solution (current prototype)

### 4.2 Vehicle API Integration (Priority: Medium)
**Why**: Auto-detect charge level, optimal charging

**APIs**:
- Tesla Fleet API
- Tata EV API (when available)
- OCPP standard for public chargers

---

## 5. Trust & Safety

### 5.1 Background Checks for Hosts (Priority: Low)
**Why**: Higher trust for drivers

**Checks**:
- Address verification
- Criminal record (optional, with consent)
- Property ownership verification

### 5.2 Insurance Integration (Priority: Medium)
**Why**: Protect both parties

**Options**:
- Partner with insurers for per-session coverage
- Annual host insurance plans
- Damage protection fund from platform fees

### 5.3 Emergency SOS (Priority: Medium)
**Why**: Safety during sessions

**Features**:
- One-tap emergency button
- Share live location with emergency contacts
- Direct connect to local emergency services

---

## 6. Analytics & Insights

### 6.1 Host Analytics Dashboard (Priority: Medium)
**Metrics**:
- Earnings over time
- Peak booking hours
- Customer demographics
- Utilization rate
- Pricing optimization suggestions

### 6.2 Driver Insights (Priority: Low)
**Metrics**:
- Spending patterns
- Favorite chargers
- Carbon savings
- Charging history export

---

## 7. Platform Expansion

### 7.1 Multi-City Launch (Priority: High)
**Phase 1 Cities** (India):
1. Bengaluru (current pilot)
2. Mumbai
3. Delhi NCR
4. Pune
5. Hyderabad

### 7.2 B2B Partnerships (Priority: Medium)
**Targets**:
- Apartment complexes (bulk host onboarding)
- Corporate parks (employee charging)
- Shopping malls (premium locations)
- Hotels (guest charging)

### 7.3 White-Label Solution (Priority: Low)
**Offer ChargeNest as SaaS for**:
- EV manufacturers
- Energy companies
- Property management firms

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Email Verification | High | Low | P0 |
| Phone OTP | High | Medium | P0 |
| UPI Payments | High | Medium | P1 |
| In-App Chat | Medium | Medium | P1 |
| Smart Plug Integration | High | High | P1 |
| Push Notifications | Medium | Low | P2 |
| Tiered Verification | Medium | Medium | P2 |
| Host Analytics | Medium | Medium | P2 |
| ID Verification | Medium | High | P3 |
| Subscription Plans | Medium | Medium | P3 |
| WhatsApp Integration | Low | Medium | P3 |

---

## Timeline Estimate

| Quarter | Features |
|---------|----------|
| Q1 2027 | Email verification, Phone OTP, UPI payments |
| Q2 2027 | Smart plug integration, Push notifications, Multi-city (Mumbai) |
| Q3 2027 | In-App chat, Host analytics, Tiered verification |
| Q4 2027 | ID verification, Subscription plans, Multi-city (Delhi, Pune) |

---

*Last updated: November 2026*
