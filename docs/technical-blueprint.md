# Supply & Demand Technical Blueprint

## 1. Product Positioning
Supply & Demand is a demand-triggered local commerce operating system where users search intent first and receive high-trust supply matches in seconds.

Core loops:
1. Demand creation (`search`, `post request`)
2. Supply matching (`ranking`, `availability`, `trust score`)
3. Transaction execution (`booking`, `escrow`, `completion`)
4. Trust resolution (`reviews`, `verification`, `disputes`)

## 2. Platform Architecture (Macro)
- Client web: static marketing + app shell (current scaffold)
- API layer: Node.js service modules
- Data layer: PostgreSQL (OLTP)
- Queue/events: async jobs for notifications, fraud, verification
- Storage: object storage for images, licenses, evidence
- Payments: Stripe + Stripe Connect escrow-like flow
- Identity: OAuth + email/password

### Recommended service boundaries
- `identity-service`
- `demand-service`
- `supply-service`
- `matching-service`
- `booking-service`
- `trust-service`
- `payments-service`
- `growth-service`

## 3. Website Structure
Public routes:
- `/` Home
- `/pages/search-demand.html`
- `/pages/browse-supply.html`
- `/pages/categories.html`
- `/pages/post-request.html`
- `/pages/become-supplier.html`
- `/pages/how-it-works.html`
- `/pages/trust-safety.html`
- `/pages/pricing.html`
- `/pages/login.html`
- `/pages/signup.html`

Category detail routes:
- `/pages/categories-services.html`
- `/pages/categories-products.html`
- `/pages/categories-rentals.html`
- `/pages/categories-local-deals.html`
- `/pages/categories-urgent-jobs.html`
- `/pages/categories-gigs.html`
- `/pages/categories-b2b-supply.html`

## 4. App Structure (Consumer + Supplier)
Consumer app tabs:
1. Home (demand search)
2. Explore (browse categories)
3. Requests (active jobs/orders)
4. Messages
5. Account

Supplier app tabs:
1. Demand feed (nearby + matching)
2. Jobs (inbox, booked, completed)
3. Listings/Services
4. Wallet (escrow + payouts)
5. Analytics

## 5. Homepage UI Layout
Sections:
1. Hero: demand search input + fast CTAs
2. Spectrum category grid
3. Live demand map stream
4. How-it-works sequence
5. Trust layer teaser
6. Supplier conversion CTA
7. FAQ and footer utility links

## 6. Onboarding System (Supplier)
1. Account creation (email + OAuth)
2. Profile setup (identity + geo radius)
3. Content import (social links, portfolio sync)
4. Service setup (category/subcategory mapping)
5. Pricing setup (fixed/hourly/quote)
6. Verification uploads (license, insurance, certificates)
7. Commission + terms acceptance
8. Temporary supplier agreement and activation

State model:
- `draft`
- `pending_verification`
- `verified`
- `restricted`
- `active`

## 7. Trust Infrastructure
Modules:
1. Dispute resolution center
2. Escrow and conditional payout release
3. Provider insurance/license verification
4. Job completion proof and bilateral confirmation
5. Fraud intelligence and risk scoring

Trust score inputs:
- verification level
- completion ratio
- dispute frequency
- review quality score
- response SLA

## 8. Smart Demand Discovery Engine
Inputs:
- natural language query
- explicit filters
- geolocation and radius
- urgency and availability

Parse outputs:
- `intent_type` (`service`, `product`, `rental`, `gig`, `b2b`)
- `subcategory`
- `location_scope`
- `urgency`
- `budget_hint`

Ranking weights (initial):
- relevance: 35%
- trust score: 25%
- distance: 15%
- response speed: 10%
- price fit: 10%
- conversion history: 5%

## 9. Feature Modules
- Demand search NLP + parser
- Category browse and filter engine
- Messaging and quote workflow
- Booking scheduler
- Escrow payment orchestration
- Reviews and reputation
- Supplier analytics dashboard
- Referrals and rewards
- Visibility ads and promoted placements

## 10. Brand Identity System
Brand: **The Spectrum Marketplace**

Tagline options:
- Search Your Demand.
- Everything You Need, On Demand.
- Where Demand Meets Supply.

Color system:
- Base `#0B132B`
- Urgent `#FF3B3B`
- Products `#FF8A00`
- Gigs `#FFC300`
- Deals `#2ECC71`
- Services `#3498DB`
- B2B `#5B5FEF`
- Rentals `#9B59B6`
- Neutral `#F7F9FC`, `#1F2937`, `#E5E7EB`

Typography:
- Headlines: Sora
- Body: Inter
- Accent: Space Grotesk (limited use)

## 11. Component Breakdown
Atomic:
- buttons, badges, pills, inputs, chips

Composite:
- demand search bar
- supplier card
- service listing row
- product card
- trust badge cluster
- booking panel
- quote composer
- chat thread

Page modules:
- demand feed grid
- live demand map card
- onboarding stepper
- dispute case timeline
- payout ledger

## 12. API Outline
See `docs/api-endpoints.md` for endpoint-level details.

## 13. Data Architecture
See `docs/database-schema.sql` for relational DDL starter.

## 14. Scale Strategy (City -> Global)
Phase 1: single city launch
- dense supply verticals (home services, auto, gigs)
- SLA and trust instrumentation

Phase 2: multi-city expansion
- local operations pods
- city-level demand intelligence dashboards

Phase 3: regional and global
- multi-currency, tax, language packs
- compliance and market-specific trust workflows

## 15. Delivery Plan
1. Build backend contract and auth
2. Implement demand parser and match API
3. Launch onboarding and verification workflows
4. Integrate Stripe + escrow release logic
5. Add messaging, bookings, and reviews
6. Ship analytics and growth loops
