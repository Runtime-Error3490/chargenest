# Issues and Solutions - EV Charging Marketplace

> This document captures all issues encountered during development and their solutions for future reference.

---

## Table of Contents
1. [Backend Issues](#backend-issues)
2. [Frontend Issues](#frontend-issues)
3. [Database Issues](#database-issues)
4. [UI/UX Issues](#uiux-issues)
5. [Configuration](#configuration)

---

## Backend Issues

### 1. Host Stats Endpoint Missing

**Problem:** Host dashboard showed ₹0 for all earnings even though bookings existed with payments.

**Root Cause:** The frontend was calling `GET /api/users/host/stats` but this endpoint didn't exist. The `/api/users/dashboard` endpoint had host stats but in a different structure.

**Solution:** Created new endpoint in `backend/src/routes/user.routes.js`:

```javascript
router.get('/host/stats', authenticate, requireRole('host'), async (req, res, next) => {
  const chargers = await prisma.charger.findMany({
    where: { hostId: req.user.id },
    select: { id: true, status: true, avgRating: true }
  });
  
  const chargerIds = chargers.map(c => c.id);
  
  const totalEarnings = await prisma.payment.aggregate({
    where: {
      booking: { chargerId: { in: chargerIds } },
      status: 'captured',
    },
    _sum: { hostPayoutAmount: true },
  });
  
  // ... rest of stats
});
```

**File:** `backend/src/routes/user.routes.js`

---

### 2. Booking Field Name Mismatches

**Problem:** Frontend expected field names like `startTime`, `endTime`, `title`, `images` but backend returned `scheduledStart`, `scheduledEnd`, `name`, `photos`.

**Root Cause:** Backend Prisma schema uses different naming conventions than what frontend components expected.

**Solution:** Updated backend service to return aliased fields:

```javascript
// backend/src/services/booking.service.js
return {
  ...booking,
  startTime: booking.scheduledStart,
  endTime: booking.scheduledEnd,
  charger: {
    ...booking.charger,
    photos: booking.charger.photos || [],
  }
};
```

**Files Modified:**
- `backend/src/services/booking.service.js`
- `frontend/src/pages/BookingsPage.jsx`
- `frontend/src/pages/BookingDetailPage.jsx`
- `frontend/src/pages/DashboardPage.jsx`

---

### 3. Status Value Mismatches

**Problem:** Backend used status values like `authorized`, `in_progress` but frontend expected `confirmed`, `active`.

**Solution:** Added status mapping in frontend:

```javascript
const STATUS_CONFIG = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  authorized: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmed' },
  in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Show' },
};
```

**Files:** `frontend/src/pages/BookingsPage.jsx`, `frontend/src/pages/BookingDetailPage.jsx`

---

### 4. Admin Bookings Page Missing

**Problem:** `/admin/bookings` route returned null/error because `AdminBookingsPage` component didn't exist.

**Solution:** Created new `AdminBookingsPage.jsx` with:
- Table view of all bookings
- Status filters using custom Select
- Pagination
- Booking details sidebar
- Export functionality

**Files:**
- Created: `frontend/src/pages/admin/AdminBookingsPage.jsx`
- Updated: `frontend/src/pages/admin/index.js` (added export)
- Updated: `frontend/src/App.jsx` (added route)

---

## Frontend Issues

### 5. Card Padding Inconsistency

**Problem:** Some Cards had proper padding, others had content flush against edges.

**Solution:** Added consistent padding classes:

```jsx
// Search page charger cards
<Card className="p-5">

// Charger detail page sections
<Card className="p-6">

// Agent settings page
<Card className="p-6">
```

**Files Modified:**
- `frontend/src/pages/SearchPage.jsx`
- `frontend/src/pages/ChargerDetailPage.jsx`
- `frontend/src/pages/AgentSettingsPage.jsx`

---

### 6. Native HTML Select Dropdowns

**Problem:** Classic HTML `<select>` elements looked outdated and inconsistent with modern UI.

**Solution:** Created custom `Select` component with:
- Modern styling with Tailwind
- Keyboard navigation (Arrow keys, Enter, Escape)
- Checkmarks for selected option
- Smooth animations
- Consistent look across all pages

**File Created:** `frontend/src/components/ui/Select.jsx`

```jsx
export function Select({ value, onChange, options, placeholder, className }) {
  // Custom dropdown with Listbox from @headlessui/react pattern
}
```

**Pages Updated:**
- `SearchPage.jsx` - Connector type filter
- `BookingDetailPage.jsx` - Dispute reason
- `AdminUsersPage.jsx` - Role filter
- `AdminPaymentsPage.jsx` - Status filter
- `AdminAnalyticsPage.jsx` - Period selector
- `AdminAuditLogsPage.jsx` - Action type filter
- `AdminDisputesPage.jsx` - Resolution decision
- `AdminChargersPage.jsx` - Status filter and change

---

### 7. Custom Select onChange Handler Mismatch

**Problem:** After replacing native `<select>` with custom `Select`, filters stopped working because the onChange signature was different.

**Root Cause:** 
- Native select: `onChange={(e) => setValue(e.target.value)}`
- Custom Select: `onChange={(value) => setValue(value)}`

**Solution:** Updated all onChange handlers:

```jsx
// Before (native select pattern)
<Select onChange={(e) => setFilter(e.target.value)} />

// After (custom Select pattern)
<Select onChange={setFilter} />
// or
<Select onChange={(value) => handleChange('field', value)} />
```

---

> **Note:** The component itself was fixed later. See [#10](#10-select-dropdown-emitted-an-event-object-role-filter-broken).

---

### 8. Export Buttons Not Working

**Problem:** Admin pages had "Export" buttons that did nothing when clicked.

**Solution:** Created export utility and wired buttons:

**File Created:** `frontend/src/utils/export.js`

```javascript
export function exportToCSV(data, filename, columnMapping) {
  // Convert data to CSV with proper escaping
  // Auto-download file
}
```

**Implementation:**
```jsx
const handleExport = () => {
  exportToCSV(users, 'users', {
    'Name': 'name',
    'Email': 'email',
    'Roles': 'roles',
    'Joined': 'createdAt',
  });
};
```

---

### 9. "Become a Host" Page Missing

**Problem:** Clicking "Become a Host" navigated to `/host/register` which didn't exist.

**Solution:** Created `BecomeHostPage.jsx` with:
- Benefits display
- How it works section
- Terms agreement checkbox
- API call to `POST /api/users/roles` with `{ role: 'host' }`
- Success state with next steps

**Files:**
- Created: `frontend/src/pages/BecomeHostPage.jsx`
- Updated: `frontend/src/App.jsx` (added route)

---

### 10. Select Dropdown Emitted an Event Object (Role Filter Broken)

**Problem:** On `/admin/users` the role dropdown did nothing. Same bug hit the Search connector filter, Admin Bookings/Payments/Chargers/Audit Logs status filters, Booking Details issue type and Analytics period.

**Root Cause:** Issue #7 changed callers to `onChange={(value) => ...}`, but `Select.jsx` still called `onChange({ target: { value } })`. Callers stored an object as the filter value, so nothing matched.

**Solution:** `components/ui/Select.jsx` now calls `onChange(newValue)` with the plain value.

**Known limit:** Role filter and search on `/admin/users` run client-side on the current page only (20 users). A full fix needs `role`/`search` query params on `GET /api/admin/users`.

---

### 11. Admin "View Details" Link Showed the List Again

**Problem:** Clicking "View Details" on `/admin/users` opened `/admin/users/:id`, which rendered the same user list.

**Root Cause:** `App.jsx` mapped `/admin/users/:id` to `AdminUsersPage`, which had no detail view and never called `GET /api/admin/users/:id` (the backend route already existed).

**Solution:** `AdminUsersPage` reads `:id` with `useParams`. With an id it renders `UserDetail` (profile, roles, stats, recent bookings, chargers, disputes, Verify/Unverify). Without one it renders the list.

---

### 12. Booking Details Page Spacing and Oversized Button

**Problem:** Cards felt cramped and the "View Charger" button stretched to the full card height.

**Solution:** In `BookingDetailPage.jsx` cards use `p-8`, grid and column gaps are 32px, and the button is small with `self-start whitespace-nowrap`.

---

### 13. Search Filters Allowed Invalid Numbers

**Problem:** Min kW and Max ₹/hr accepted negative values, `e`, and changed on mouse-wheel scroll. `minPower` was saved to the URL but read back as `minKw`, so a refresh lost it.

**Solution:** Added an inline `NumberFilter` in `SearchPage.jsx`: blocks `-`, `+`, `e`, clamps to max (350 kW, ₹10,000), shows an inline hint, has a clear (×) button, and adds quick buttons `7+ 11+ 22+ 50+`. The URL now reads `minPower`, ignoring non-positive values.

---

### 14. Dollar Icon Shown Next to Rupee Amounts (Host Bookings)

**Problem:** `/host/bookings` showed a `$` icon beside the `₹` booking amount.

**Root Cause:** `HostBookingsPage.jsx` rendered the lucide `DollarSign` icon next to `formatCurrency()`, which already outputs `₹`.

**Solution:** Removed the icon and its import. Other pages still use `DollarSign` as a decorative icon (Admin Dashboard, Analytics, Settings, Payments, Become a Host); swap to `IndianRupee` if those should change too.

---

### 15. Host Dashboard "Avg Rating" Always N/A (Review flow fixed in #18)

**Problem:** `/host/dashboard` shows `N/A` for average rating.

**Root Cause:**
1. The DB has 0 rows in `host_ratings` and `driver_ratings`, and every `Charger.avgRating` is 0. The dashboard shows `N/A` when the average is 0, so this display is expected for now.
2. Reviews cannot be created yet: `BookingDetailPage` calls `bookingService.submitReview()`, which does not exist, and the backend has no endpoint that writes ratings.
3. Nothing updates `Charger.avgRating` (it is a stored field, not computed).

**Fix needed:** Add a review endpoint (create `DriverRating`, recompute `Charger.avgRating`), add `submitReview` to `bookingService.js`, and optionally seed a few ratings.

---

### 16. No Photo Upload on Create Charger; Terms/Host Policy Links 404

**Problem:**
1. Hosts could not add photos when creating a charger.
2. "Terms of Service" and "Host Policy" links on the last step opened a 404 (`/terms`, `/host-policy` had no routes).
3. The create form sent `title`, `powerKw`, `pricePerHour`, `images`, but `POST /api/chargers` expects `name`, `kwTier`, `packages`, `photos`, so creation failed validation.

**Solution:**
- Backend: `POST /api/chargers/photos` (host only, multer 2.5.0). Up to 5 files, 5 MB each, JPG/PNG/WebP, saved to `backend/uploads/chargers/` with random names and served from `/uploads` (with `Cross-Origin-Resource-Policy: cross-origin` so the frontend can show them). `photos` is capped at 5 in the create/update schemas. `uploads/` is git-ignored.
- Frontend: photo picker on step 2 of `CreateChargerPage` (previews, remove, "Make cover", limit checks). On submit, photos are uploaded first and the returned URLs are sent as `photos`. The existing carousel on the charger detail and search pages reads `charger.photos`, so photos appear there automatically.
- Payload now maps to the backend: `name`, `kwTier` (nearest tier to the entered kW), and a 1-hour package at the entered price.
- New `LegalPage.jsx` serves `/terms` and `/host-policy`. The links open in a new tab so form data is not lost.

**Default image:** Chargers with no photos (or a photo that fails to load) show `frontend/public/charger-placeholder.svg`. `ImageCarousel` uses it by default, and the booking, dashboard and host charger lists use it instead of the old ⚡ box.

**Notes:** Local disk storage suits dev only; use S3 or similar for production. Restart the backend after pulling. The "Wall Socket" connector option is not in the backend enum and will still fail validation.

---

### 17. Broken and Placeholder Links Across the Site

**Problem:** Several links went nowhere: Footer social icons, Privacy Policy and Terms of Service (`href="#"`), footer "Become a Host" (`#`), "How It Works" (no matching section id), host "Manage Bookings" went to the driver `/bookings` page, Become a Host agreement links (`#`), Team page LinkedIn/GitHub (`#`), and the Admin Dashboard "Geographic" link (`?tab=geographic` was ignored).

**Solution:**
- `LegalPage.jsx` now holds the Terms, Privacy and Host Policy text in one place (`/terms`, `/privacy`, `/host-policy`). The Register page modals render the same `LegalSections`, so the text cannot drift. The Terms cancellation rules now match the backend config (24h free, then 25/50/100%), not the old "2h / 10%" text.
- Footer: Privacy/Terms/Host Policy go to the real pages, "Become a Host" goes to `/host/register`, "How It Works" goes to `/#how-it-works` (HomePage scrolls to it), host "Manage Bookings" goes to `/host/bookings`, and the placeholder social icons are removed.
- Become a Host agreement links open the policy pages in a new tab.
- Team page social icons are hidden while their URL is `#`. The "Our Journey" section was removed on request.
- `AdminAnalyticsPage` reads `?tab=`.
- Audit: every `to=`, `href=` and `navigate()` target (192) matched a route in `App.jsx`.

**Still open:** `/host/chargers/:id/edit` renders `CreateChargerPage`, which ignores the id, so "Edit" opens an empty create form.

---

### 18. Reviews Could Not Be Submitted; No Role or Booking Checks

**Problem:** "Leave Review" called `bookingService.submitReview()`, which did not exist, and no backend endpoint saved ratings (see #15). Hosts could not review drivers.

**Solution:** `POST /api/bookings/:id/review` with `{ rating: 1-5, reviewText? }`. Rules live in `booking.service.js` (`getReviewerSide`, `submitReview`):
- Only the booking's driver (must hold the `driver` role) can review the **charger**, which writes `DriverRating` and recomputes `Charger.avgRating`.
- Only the charger's host (must hold the `host` role) can review the **driver**, which writes `HostRating`.
- Anyone else gets 403. Reviewing a booking on your own charger is blocked.
- The booking must be `completed` (or `disputed`), meaning the charger was actually used.
- One review per side per booking (409 on repeat). Each review is audit-logged (`RATING_SUBMIT`).
- `GET /api/bookings/:id` now returns `canReview`, `reviewTarget` and both reviews. Hosts also see the driver's average host rating.
- `BookingDetailPage` shows "Rate this Charger" or "Rate the Driver", errors stay inside the modal, and both reviews are listed.
- Admin user detail "ratings received" now uses `hostRatingsReceived`. It used `driverRatings`, which are ratings the user gave.

**Verified:** 8 scripted checks against the dev DB (stranger, wrong role, not completed, success, duplicate, for both sides). Test rows were removed afterwards. This closes the review part of #15.

---

### 19. Dark Mode

**Solution:** Moon/sun toggle in the Navbar (`ThemeToggle`). It sets `class="dark"` on `<html>` and saves the choice in `localStorage('theme')`, defaulting to the OS setting. A small script in `index.html` applies it before first paint, so there is no light flash. Pages use light utility classes directly, so `index.css` remaps them under `.dark` (surfaces, text, borders, tinted boxes, inputs, cards, map tiles) instead of adding `dark:` to every page. Tailwind `darkMode: 'class'` is enabled for future `dark:` use.

---

### 20. Agent Settings: `agentService.getMandateSettings is not a function` (Open)

**Root Cause:** `AgentSettingsPage.jsx` calls `getMandateSettings()`, `getAgentAuditLog()` and `updateMandateSettings()`. None of them exist in `services/agentService.js`, which only has `createMandate`, `getMandates`, `revokeMandate`, `chat` and `getActivity`. The backend also has no settings endpoint. `agent.routes.js` only exposes `/mandates`, `/mandates/:id`, `/activity` and `/chat`. The page was written against an API that was never built, and the first call throws.

**Fix options:** (a) map the page to what exists: read limits from the active mandate (`GET /agent/mandates`), save by creating a new mandate (`POST /agent/mandates`), and use `GET /agent/activity` for the log; or (b) add a `GET/PUT /agent/settings` endpoint that stores level, permissions and spending limit.

---

### 21. Create Charger Fails With "Request failed with status code 400"

**Problem:** Creating a charger with address "Bellandur" failed. The UI showed axios's generic `Request failed with status code 400`, while the API returned a clear reason (`Address must be at least 10 characters`).

**Root Cause:**
1. Frontend and backend rules did not match. `CreateChargerPage.validateStep` only checked that title and address were not empty. The backend (`createChargerSchema`) requires name ≥ 3 and address ≥ 10 characters, so the problem was only caught after submit on the last step.
2. Pages showed `err.message`, which axios sets to a generic status text. Nothing read the API's `error.message` / `error.details`.

**Solution:**
- `services/api.js` response interceptor now replaces `error.message` with a readable message: field messages from `details`, else the API's `message`, else friendly text per status (401/403/404/413/5xx), timeout or "can't reach the server". It also sets `error.fieldErrors`. This applies to every page.
- `CreateChargerPage` checks the same rules as the backend on each step (`MIN_TITLE = 3`, `MIN_ADDRESS = 10`, power ≤ 350 kW). The address field shows a live "N more needed" hint and a clearer placeholder.
- If the server still rejects, the page jumps back to the step that owns the field (`FIELD_STEP`) and shows `Couldn't create your charger. <reason>`.

**Note:** Keep `MIN_TITLE` / `MIN_ADDRESS` in sync with `charger.routes.js` if the schema changes.

---

## Database Issues

### 22. Mock Bookings Without Payments

**Problem:** Admin dashboard showed ₹0 revenue because bookings were created without corresponding Payment records.

**Solution:** Updated seed file to create Payment records for completed bookings:

```javascript
if (bookingData.status === 'completed') {
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      authorizedAmount: bookingData.totalAmount,
      capturedAmount: bookingData.totalAmount,
      hostPayoutAmount: bookingData.baseAmount,
      platformFeeAmount: bookingData.platformFee,
      status: 'captured',
      capturedAt: bookingData.scheduledEnd,
      // ... PayPal mock IDs
    },
  });
}
```

**File:** `backend/prisma/seed.js`

---

### 23. Seed Booking Field Names

**Problem:** Seed file used wrong field names like `userId` instead of `driverId`, `startTime` instead of `scheduledStart`.

**Solution:** Updated to match Prisma schema:

```javascript
// Before
{ userId: driver.id, startTime: date, status: 'confirmed' }

// After
{ driverId: driver.id, scheduledStart: date, status: 'authorized' }
```

---

### 24. Payment Model Field Names

**Problem:** Seed tried to create Payment with `payerId`, `amount`, `paypalAuthorizationId` which don't exist in schema.

**Solution:** Used correct field names from Prisma schema:

```javascript
// Before (incorrect)
{ payerId: driver.id, amount: 100, paypalAuthorizationId: 'xxx' }

// After (correct)
{ authorizedAmount: 100, capturedAmount: 100, paypalAuthId: 'xxx' }
```

---

## UI/UX Issues

### 25. Host Dashboard "This Month" Showing Wrong Data

**Problem:** "This Month" in Earnings Summary showed `pendingPayout` instead of actual monthly earnings.

**Solution:** 
1. Added `thisMonthEarnings` to backend response
2. Updated frontend to use correct field

```jsx
<div className="flex justify-between py-2">
  <span>This Month</span>
  <span className="text-green-600">{formatCurrency(stats.thisMonthEarnings)}</span>
</div>
```

---

## Configuration

### 26. Demo Account Email Consistency

**Problem:** Different emails used in docs vs seed file (driver@demo.com vs demo_driver@example.com).

**Solution:** Standardized demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Client | demo_driver@example.com | REDACTED_PASSWORD |
| Host | demo_host@example.com | REDACTED_PASSWORD |
| Client+Host | clientdemo_host@example.com | REDACTED_PASSWORD |
| Admin | demo_admin@example.com | REDACTED_PASSWORD |

**Files Updated:**
- `backend/prisma/seed.js`
- `README.md`

---

### 27. PayPal AI Hackathon: Requirements and Gap Analysis

**Problem:** The marketplace needs PayPal as its only payment backend and a pluggable AI concierge, scoped to the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). The Devpost page returned HTTP 403 on direct fetch, so requirements come from secondary sources. Full notes: `docs/HACKATHON_RESEARCH.md`. Re-check the official rules before submitting.

**Hackathon requirements:**
- Use PayPal and AI in a meaningful way. PayPal must be central.
- Working build, feature text, tool list, public repo with run steps and LICENSE, demo video under 3 minutes.
- PayPal sandbox only. Any AI provider is allowed.
- Closes 2026-11-12, 3:00 PM EST.

**Judging criteria:** Technological Implementation, Design, Potential Impact, Innovation, Presentation. Best fit prizes: Best Use of PayPal + AI, Best Use of Agentic Commerce (agents that transact, with human approval and audit for risky actions).

**Eligible PayPal APIs (any sandbox API counts):** OAuth 2.0, Orders v2 (`AUTHORIZE`), Payments v2 (capture, void, refund), Payouts, Invoicing v2, Customer Disputes v1, Webhooks.

**Gap analysis (from a read of the code; "-> task" is the planned work):**

| Area | Exists | Missing | -> Task |
|------|--------|---------|---------|
| AI concierge | `POST /agent/chat`, tool loop in `ai.service.js`, tools `search_chargers`, `get_host_details`, `estimate_cost`, `create_booking_hold`; dispute analysis and pricing | Client is hard-coded to the OpenAI SDK with an OpenRouter URL. No provider interface, factory, second provider or mock. No cancel, dispute or invoice tools | 29, 10, 30, 12 |
| Agent permissions and autonomy | Schema (`autonomyLevel`, `permissions`, `spendingLimit`, `AgentApproval`); pure `agentPolicy.js` (levels 0-4, 13 actions); `AgentSettingsPage.jsx`, `ChatPage.jsx` | Policy not called in `agent.service#chat` (only the mandate JWT cap is enforced). No settings, status or approval routes. UI calls `agentService` methods that do not exist. Tool names differ from policy map. Level wording differs between page and policy | 30, 11, 15 |
| KYA | Mandate JWT (caps, expiry, revoke); schema columns `publicKey`, `privateKeyEnc`, `kyaVerifiedAt`; audit columns `decision`, `kyaPayload`, `kyaSignature` | Key generation, register, verify, signing; audit columns never filled; no check for a verified agent | 31, 13, 14 |
| PayPal client | `paypal.service.js`: OAuth, order (AUTHORIZE), authorize, capture, void, refund, payout, webhook verify | Invoices, PayPal disputes, wallet top-up capture. Payouts return `SIMULATED` on any error (hides failures). Currency default `INR` may fail in sandbox | 24, 5 |
| Booking and session | Order, authorize (hold), cancel (capture fee or void), session end (capture and payout to host PayPal email), webhook route | Hold from wallet and release to host wallet (today the host is paid by PayPal email). No dispute or invoice webhook events | 26, 7 |
| Invoices and disputes | `dispute.service.js` refunds via `refundCapture`; `InvoiceStatus` enum | Invoice service, route and UI; PayPal dispute create and handle | 27, 8 |
| Wallet and minimum balance | Schema (`walletBalance`, `walletHeld`, `WalletTransaction`, `FundingSource`); `WALLET_MIN_BALANCE=500` in config | Top-up, hold, release, routes, signup deposit step, guards on booking and charger create; Prisma migration for the schema changes | 25, 6, 15 |
| Frontend payment | PayPal JS SDK buttons on `BookingConfirmPage.jsx` | Calls missing `bookingService.createPaymentOrder`; SDK uses `intent=capture` but backend uses AUTHORIZE | 15 |
| Other payment methods | Only PayPal in code and `package.json` | Remove README roadmap line "UPI payments"; check `CreditCard` icon copy on `HomePage.jsx` | 28, 9 |
| Tests | No test runner | Add `node:test` backend tests with mocked PayPal and AI calls | 32, 16, 17, 33 |
| Config and docs | Placeholders for PayPal, AI and `KYA_KEY_SECRET` in `.env.example` and `config/index.js` | README env vars and sandbox steps; ADR in `docs/DECISIONS.md` | 23, 4, 34, 18 |

**Decisions:** Sandbox only. Reuse what exists (PayPal service, booking and session flow, `agentPolicy.js`, schema additions, settings and chat pages). Webhooks only where hold or dispute status needs them. Nothing is committed.

---

### 28. Frontend Out of Step With PayPal Wallet, Agent Settings and Local Run Scripts

**Problem:** The frontend still used a card-style PayPal SDK checkout and called agent-service methods that did not exist (`getMandateSettings`, `getAgentStatus`, `getPendingApprovals`). Chat and settings pages failed. `run.sh` and `.env.example` disagreed on the backend port (3001 vs 4000) and database name, and the seed left wallets empty, so booking was blocked by the deposit check.

**Solution:**
- New `/wallet` page (`WalletPage.jsx`, `walletService.js`): PayPal top-up by redirect, capture on return, deposit status, ledger, invoices. `WalletBanner` prompts for the deposit on both dashboards.
- Booking from the charger page holds funds from the wallet (`fundingSource: 'wallet'`). `BookingConfirmPage` only finishes PayPal-direct authorizations on return. `PayPalScriptProvider` removed.
- `agentService` now matches the backend (settings, identity, approvals). Settings page shows the KYA identity card. Chat approvals run through `/agent/approvals/:id/respond`.
- `api.js` exposes `error.apiCode` so pages can send the user to the wallet on `DEPOSIT_REQUIRED`.
- Local run: `.env.example` uses port 4000 and the docker-compose database. `run.sh` creates `.env` with `AI_PROVIDER=mock`, creates `frontend/.env`, uses `prisma migrate deploy` and has a `test` command. Added migration `20261110120000_paypal_wallet_kya`. Seed funds the demo wallets.

### 29. PayPal Top-Up Not Credited After Returning From PayPal

**Problem:**
1. Top-up failed with `CURRENCY_NOT_SUPPORTED`. `DEFAULT_CURRENCY=INR`, which the US sandbox business account cannot take.
2. After approving on PayPal, the user landed on `/wallet?token=...` but was bounced to `/login` and then `/dashboard`. The `token` was lost, so the capture never ran and the wallet was not credited. Cause: `authStore` persisted the tokens but not `isAuthenticated`, so on a full page load `ProtectedRoute` saw a logged-out user before `initAuth` finished.
3. Once that was fixed, the capture was sent three times: once without the auth header (401, retried after refresh), and twice because React StrictMode mounts the page twice in dev. The extra call returned `ORDER_ALREADY_CAPTURED` (502) and showed a false error, even though the money was credited.

**Solution:**
- `backend/.env`: `DEFAULT_CURRENCY=USD` for the sandbox.
- `authStore.js`: persist `isAuthenticated` too. A bad token is still cleared by the refresh/logout path.
- `api.js`: the request interceptor attaches the saved access token, so calls made before `initAuth` are authenticated.
- `walletService.completeTopUp`: one request per order id, shared between mounts.
- `wallet.service.js completeTopUp`: if PayPal says `ORDER_ALREADY_CAPTURED` and the ledger already has that order for this user, return `credited: false` instead of an error. Test added in `paymentFlows.test.js`.
- Cleanup: removed unused `paypalService.getOrder()`, `resetProviderCache()` and the no-op "fallback to USD" variables in `createOrder`.

**Testing note:** pay with a sandbox **Personal** account on the PayPal page, not the business account that owns the app

### 30. No Clear Definition of a Successful Session (Phase 2 Prep)

**Problem:** A booking was paid to the host as soon as one person tapped "end". Nothing proved the session happened, the driver always paid the full booked amount, and the host was credited at once with no room for a dispute.

**Solution:**
- `evaluateSession()` (`session.service.js`) decides success, failed or pending from the proof. `settleWalletSession()` moves the money for every proof source. Manual taps stay the default.
- Device proof: new `devices` and `device_events` tables, signed events at `POST /api/device/events` (HMAC, rising counter), device registration, and a mock device at `POST /api/device/mock/simulate` (`DEVICE_MOCK=true`).
- Failed sessions (never unlocked, too short, zero meter) refund the whole hold. Shorter sessions pay for time used and return the rest.
- `PAYOUT_DELAY_HOURS` credits the host later. A dispute freezes it. Default 0, so nothing changes until it is set.
- A background runner (`JOB_INTERVAL_SEC`) closes expired device bookings and pays due hosts.
- Migration `20261110180000_device_proof_payout_delay` only adds columns and tables.
- Not built: QR and unlock command, email receipts, host strikes, go-live check, key rotation. See `docs/DECISIONS.md`.

### 31. Held Balance Shown as -140 After a Device Simulation

**Problem:** The simulate-device card was run on a booking that never had a wallet hold (no `booking_hold` row, seed-style data). Settling it released 140 from the driver's `walletHeld` that was never there, so held went to -140. The host was also credited 130.2 that no driver had paid. The same booking also had no session row, which crashed the first run.

**Solution:**
- `walletService.assertHold()`: money for a wallet booking can only move if its ledger has a `booking_hold` row. Checked at device unlock and again inside `settleWalletSession` (covers release and refund, manual and device).
- `device.service.js`: a missing session row is created on unlock.
- The simulate card now shows each failed step's message.
- `prisma/seed.js`: upcoming (authorized) demo bookings now take a real wallet hold, write the `booking_hold` ledger row and get a session row. If the demo driver cannot afford the hold, that booking is skipped with a warning. When the seed recreates bookings, it first gives back the holds of the old ones.

**Repair for data already damaged** (plain SQL, run once; the ids come from the HAR, check them first):
```sql
-- Driver held amount: put back the 140 that was taken without a hold
UPDATE users SET wallet_held = wallet_held + 140
WHERE id = (SELECT driver_id FROM bookings WHERE id = 'cb36e67e-ab54-4ac1-8f79-b889fd11a0ca');
-- Host: take back the 130.2 credited for that booking
UPDATE users SET wallet_balance = wallet_balance - 130.2
WHERE id = (SELECT c.host_id FROM bookings b JOIN chargers c ON c.id = b.charger_id
            WHERE b.id = 'cb36e67e-ab54-4ac1-8f79-b889fd11a0ca');
```.

---

### 30. Docker Image for Render; Migrations Out of Step With the Schema

**Goal:** One container that runs the API and serves the built frontend, for a Render Docker web service.

**Problem found while testing:** On a fresh database, `prisma migrate deploy` applied all migrations, but `GET /api/chargers` returned 500: `The column chargers.is_blocked does not exist`. Some schema changes had been added with `prisma db push` and never written as migrations: charger block fields, `ChargerStatus.blocked`, user terms/privacy fields, the `(host_id, name, address)` unique index, and the `blocked_by` foreign key. Local DBs had them, so nobody noticed.

**Solution:**
- `Dockerfile` (repo root), multi-stage on `node:20-slim`:
  1. Builds the frontend with `VITE_API_URL=/api` (same origin). Other `VITE_*` values are build args.
  2. Installs the backend, runs `prisma generate`, copies in `frontend/dist`, and runs as the `node` user.
  3. Start: `npx prisma migrate deploy && node src/index.js`, with a `/health` healthcheck.
- `.dockerignore` keeps `.env`, `node_modules`, `dist` and uploads out of the image.
- `backend/src/index.js` (opt-in, no change when unset):
  - `FRONTEND_DIST`: serves static files, plus `index.html` for client routes. `/api/*` and `/uploads/*` misses still return the JSON 404. Helmet's CSP is off only in this mode, because the app loads PayPal, map tiles and fonts from other origins.
  - `TRUST_PROXY`: trusts the proxy, so `req.protocol` is https (photo URLs) and rate limits see the real client IP.
- New migration `20261110200000_sync_schema_drift`. Every statement uses `IF NOT EXISTS`, so it is a no-op on DBs that already have these columns.

**Verified:** image built; fresh Postgres applied 4 migrations; `migrate diff --exit-code` shows no drift; `/health`, `/`, `/host/chargers/new`, `/api/chargers` → 200; `/api/nope` → JSON 404; running as `node`; healthcheck `healthy`; re-running the new migration on an up-to-date DB succeeds.

**Render setup:**
- New Web Service → Docker, root of the repo.
- Env: `DATABASE_URL` (Render Postgres internal URL), `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` (the service URL), plus `NODE_ENV=production` with `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `TOTP_ENCRYPTION_KEY`, `KYA_KEY_SECRET` and an AI key (or `AI_PROVIDER=mock`).
- `VITE_PAYPAL_CLIENT_ID` is needed at **build** time.
- Health check path: `/health`. Render sets `PORT` itself.
- Charger photos go to `/app/backend/uploads`, which is wiped on each deploy. Attach a Render Disk there or move uploads to S3.

**Going forward:** add schema changes with `npm run db:migrate` (`prisma migrate dev`), not `db:push`, or deploys will miss them.

---

## Quick Reference

### Backend Port
- Default: `4000`
- Health check: `GET http://localhost:4000/health`

### Frontend Port
- Default: `5173`
- URL: `http://localhost:5173`

### Common Commands

```bash
# Restart backend (after code changes)
cd backend && npm run dev

# Re-seed database
cd backend && node prisma/seed.js

# Reset database completely
cd backend && npx prisma db push --force-reset && node prisma/seed.js

# Build frontend
cd frontend && npm run build
```

### 32. Booking Page Prices Did Not Follow the Host's Rate

**Problem:** The booking page showed whatever fixed packages were stored for a charger (30 min, 60 min and so on). The seeded packages had unrelated prices, and a host only enters one price per hour when listing. A 2 hour booking did not cost twice the hourly rate.

**Solution:**
- The host's rate is the price of the 1 hour package (`hourlyRateOf` in `charger.service.js`). `GET /api/chargers/:id` now returns it as `hourlyRate`.
- Any duration is priced as `hourlyRate × minutes / 60`, rounded to 2 decimals (`priceForDuration`).
- `POST /api/bookings` accepts `durationMin` (15 to 480, steps of 15) instead of `packageId`. The server finds or creates a package with that length and price, so a booking keeps the price it was made at even if the host changes the rate later. Old requests with `packageId` still work.
- The charger page offers 30 min, 1, 1.5, 2, 3 and 4 hours, each priced from the rate, and shows "₹X per hour".
- The AI concierge and the search page still read the stored packages.
- Not done: hours-based limits from the host's availability.

### Debugging Tips

1. **API not responding:** Check if backend is running on port 4000
2. **Data not showing:** Check browser console for API errors
3. **Auth issues:** Clear localStorage and login again
4. **Stats showing 0:** Ensure Payment records exist with `status: 'captured'`

---

*Last Updated: November 2026*

### KYA limits (minimal version)
- Each agent has an Ed25519 identity linked to one owner. Each agent action is signed and stored in the audit log with a snapshot of the permissions (`grants`) in force at that time.
- Limits: the platform holds the private key and signs for the agent; no key rotation or revocation list; one agent per user; audit log is not append-only at database level; no external agent registry.

### Wallet close and platform fee config
- Platform fee comes only from `PLATFORM_FEE_PERCENT` (default 7). Two places still had 0.93 and 0.07 written in (host dashboard pending payout, admin net revenue). They now read the config, and the admin config default does too.
- `POST /api/payments/wallet/close` pays out the whole wallet, deposit included, to the user's PayPal email. It is blocked while the user has an open booking, an open dispute they raised, or an unpaid invoice they received. If PayPal fails, the money returns to the wallet.
- Not built: taking damage money from the deposit first. Damage is still an invoice through PayPal.
