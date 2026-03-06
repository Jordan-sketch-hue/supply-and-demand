# API Endpoint Outline

Base prefix: `/api/v1`

## Auth
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/oauth/:provider/callback`
- `POST /auth/logout`
- `GET /auth/me`

## Users and Suppliers
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /suppliers`
- `GET /suppliers/:id`
- `PATCH /suppliers/:id`
- `POST /suppliers/:id/verify-documents`
- `POST /suppliers/:id/onboarding/complete`

## Categories and Listings
- `GET /categories`
- `GET /categories/:slug/subcategories`
- `POST /services`
- `GET /services`
- `PATCH /services/:id`
- `POST /products`
- `GET /products`
- `PATCH /products/:id`

## Demand Engine
- `POST /demand/parse`
- `POST /demand/search`
- `POST /demand/requests`
- `GET /demand/requests/:id`
- `GET /demand/trending`
- `GET /demand/live-map`

## Booking, Quotes, Messaging
- `POST /quotes`
- `PATCH /quotes/:id/respond`
- `POST /bookings`
- `PATCH /bookings/:id/status`
- `POST /messages/threads`
- `GET /messages/threads/:id`
- `POST /messages/threads/:id/messages`

## Payments and Escrow
- `POST /payments/intents`
- `POST /escrow/hold`
- `POST /escrow/release`
- `POST /escrow/refund`
- `GET /wallet/ledger`

## Trust and Safety
- `POST /reviews`
- `POST /disputes`
- `POST /disputes/:id/evidence`
- `PATCH /disputes/:id/resolve`
- `POST /completion/confirm`
- `POST /fraud/flags`

## Growth and Visibility
- `POST /referrals`
- `GET /rewards/balance`
- `POST /promotions`
- `GET /leaderboards/providers`
