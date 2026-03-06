const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql } = require('../server/lib/db');
const { requireUser } = require('../server/lib/auth');
const { validateCsrf } = require('../server/lib/csrf');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'create-intent') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Unauthorized' });

    const body = await readBody(req);
    const amount = Math.round(Number(body.amount || 0) * 100);
    const currency = String(body.currency || 'usd').toLowerCase();
    const bookingId = String(body.bookingId || '').trim() || null;
    if (amount <= 0) return json(res, 400, { error: 'Invalid amount' });

    if (!stripe) {
      return json(res, 200, { ok: true, mode: 'mock', paymentIntentId: 'pi_mock_123', clientSecret: 'pi_mock_secret' });
    }

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { bookingId: bookingId || '', userId: user.user_id }
    });

    if (hasDatabase()) {
      await sql`insert into escrow_transactions (booking_id, stripe_payment_intent_id, amount, currency, status) values (${bookingId}, ${intent.id}, ${amount / 100}, ${currency}, 'held');`;
    }

    return json(res, 200, { ok: true, paymentIntentId: intent.id, clientSecret: intent.client_secret });
  }

  if (op === 'webhook') {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' });
      return;
    }

    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      json(res, 200, { ok: true, mode: 'mock', note: 'Stripe not configured' });
      return;
    }

    const sig = req.headers['stripe-signature'];
    let raw = '';
    await new Promise((resolve, reject) => {
      req.on('data', chunk => {
        raw += chunk;
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      json(res, 400, { error: `Webhook signature failed: ${error.message}` });
      return;
    }

    if (hasDatabase()) {
      await sql`insert into webhook_events (provider, event_id, event_type, payload, processed) values ('stripe', ${event.id}, ${event.type}, ${JSON.stringify(event)}, false) on conflict (provider, event_id) do nothing;`;

      if (event.type === 'payment_intent.succeeded') {
        const intentId = event.data.object.id;
        await sql`update escrow_transactions set status = 'held' where stripe_payment_intent_id = ${intentId};`;
      }

      if (event.type === 'charge.refunded') {
        const paymentIntentId = event.data.object.payment_intent;
        await sql`update escrow_transactions set status = 'refunded' where stripe_payment_intent_id = ${paymentIntentId};`;
      }

      await sql`update webhook_events set processed = true where provider = 'stripe' and event_id = ${event.id};`;
    }

    json(res, 200, { received: true });
    return;
  }

  json(res, 404, { error: 'Unknown payments operation' });
}, { rateLimitKey: 'payments-group', rateLimitMax: 240 });
