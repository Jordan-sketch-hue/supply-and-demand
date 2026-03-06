# GitHub -> Vercel Live Deploy Guide

## What I cannot do automatically
I cannot push to your GitHub or connect your personal Vercel account from this environment because it requires your credentials and account authorization.

## 1. Push project to GitHub

```bash
git init
git add .
git commit -m "Initial marketplace execution pack"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 2. Import to Vercel
1. Go to Vercel dashboard.
2. Click `Add New` -> `Project`.
3. Select your GitHub repo.
4. Framework preset: `Other` (static + serverless functions).
5. Deploy.

## 3. Add environment variables in Vercel
- `BOOTSTRAP_KEY`
- `POSTGRES_URL` and related variables (auto-added by Vercel Postgres integration)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 4. Provision free database
1. In Vercel project -> `Storage` -> `Create` -> `Postgres` (free tier).
2. Link it to this project.
3. Run bootstrap endpoint once:

```bash
curl -X POST https://<your-project>.vercel.app/api/admin/bootstrap -H "x-bootstrap-key: <BOOTSTRAP_KEY>"
```

## 5. Configure Stripe webhooks
1. In Stripe dashboard create webhook endpoint:
- `https://<your-project>.vercel.app/api/payments/webhook`
2. Subscribe to:
- `payment_intent.succeeded`
- `charge.refunded`
3. Copy webhook secret into `STRIPE_WEBHOOK_SECRET`.

## 6. Verify core routes
- `/pages/adverts.html`
- `/pages/admin-console.html`
- `/api/health`
- `/api/auth/login`
- `/api/ads/placements`
- `/api/ops/metrics`

## 7. Monitoring and alerts
- Enable Vercel Analytics + Logs.
- Set alert rules for function error spikes and latency.
- Optionally connect to Sentry/Datadog for distributed tracing.
