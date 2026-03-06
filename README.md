# Supply & Demand

Demand-triggered marketplace scaffold and technical blueprint.

## Major modules now included

- Adverts marketplace page with categorized placements and submission flow
- Sitewide ad slot rendering on key pages
- Auth/session system with RBAC (`consumer`, `supplier`, `admin`)
- Supplier onboarding persistence + verification document backend
- Booking and messaging state APIs
- Stripe payment intent + webhook escrow scaffolding
- Admin trust operations console for dispute/fraud/verification workflows
- Security hardening baseline (rate limits, CSRF checks, CSP, anti-bot honeypot)
- CI smoke checks and ops metrics endpoint

## Run locally

```bash
npm run dev
```

Default local URL with APIs: `http://localhost:3000`

Static-only preview: `npm run dev:static` (`http://localhost:4173`)

## Project structure

- `public/index.html` - homepage
- `public/pages/*.html` - sitemap pages and category pages
- `public/assets/css/styles.css` - global styles, tokens, animations
- `public/assets/js/main.js` - ES module interactions (menu, modal, reveal, FAQ, smooth scroll)
- `public/assets/img/*.svg` - logo and favicon
- `public/sitemap.xml` - SEO sitemap
- `public/robots.txt` - crawler directives
- `public/pages/legal-center.html` - legal navigation hub
- `public/pages/terms-of-service.html` - terms, liability, arbitration, indemnity
- `public/pages/privacy-policy.html` - privacy and data processing policy
- `public/pages/supplier-agreement.html` - supplier obligations and risk allocation
- `public/pages/dispute-escrow-policy.html` - escrow, dispute, and payout rules
- `docs/technical-blueprint.md` - full product and system blueprint
- `docs/database-schema.sql` - PostgreSQL relational schema starter
- `docs/api-endpoints.md` - API contract outline
- `docs/component-hierarchy.md` - frontend component map
- `docs/legal-framework.md` - platform-first legal posture checklist
- `docs/vercel-free-db-setup.md` - free Vercel Postgres setup and bootstrap
- `docs/completion-roadmap.md` - production readiness gap checklist
- `docs/deploy-github-vercel.md` - end-to-end live deploy instructions
- `vercel.json` - static deployment config

## API endpoints added

- `GET /api/health`
- `GET /api/demand-search?q=...`
- `GET /api/trending-demands`
- `POST /api/demand-request`
- `POST /api/admin/bootstrap` (requires `x-bootstrap-key`)
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/ads/placements`
- `GET /api/ads/list`
- `POST /api/ads/submit`
- `GET /api/bookings/list`
- `POST /api/bookings/create`
- `POST /api/bookings/status`
- `GET|POST /api/messages/thread`
- `POST /api/messages/send`
- `POST /api/suppliers/onboarding`
- `GET|POST /api/suppliers/documents`
- `POST /api/payments/create-intent`
- `POST /api/payments/webhook`
- `GET /api/admin/trust-queue`
- `GET /api/admin/adverts`
- `GET /api/admin/verification-docs`
- `GET /api/admin/audit-logs`
- `POST /api/admin/review-advert`
- `POST /api/admin/review-verification`
- `GET /api/ops/metrics`

Admin console supports:
- Pagination + date range filters
- Bulk approve/reject actions
- Full audit log (actor, action, entity, timestamp)

## Default seeded admin (after bootstrap)

- Email: `admin@supplyanddemand.com`
- Password: `Admin123!ChangeMe`

Change this immediately in production.

## Included platform systems

1. Marketplace engine
2. Trust infrastructure
3. Supplier onboarding system
4. Demand-first discovery engine
