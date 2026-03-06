const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  if (!validateCsrf(req)) {
    json(res, 403, { error: 'CSRF validation failed' });
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  const body = await readBody(req);
  const amount = Math.round(Number(body.amount || 0) * 100);
  const currency = String(body.currency || 'usd').toLowerCase();
  const bookingId = String(body.bookingId || '').trim() || null;

  if (amount <= 0) {
    json(res, 400, { error: 'Invalid amount' });
    return;
  }

  if (!stripe) {
    json(res, 200, {
      ok: true,
      mode: 'mock',
      paymentIntentId: 'pi_mock_123',
      clientSecret: 'pi_mock_secret'
    });
    return;
  }

  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId: bookingId || '',
      userId: user.user_id
    }
  });

  if (hasDatabase()) {
    await sql`
      insert into escrow_transactions (booking_id, stripe_payment_intent_id, amount, currency, status)
      values (${bookingId}, ${intent.id}, ${amount / 100}, ${currency}, 'held');
    `;
  }

  json(res, 200, {
    ok: true,
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret
  });
}, { rateLimitKey: 'payments-intent', rateLimitMax: 50 });
